# SPEC FOR COPILOT / AI — Competition Engine + Athlos Orchestrator

## 0) Scopo
Questo documento è la **fonte di verità** per generare codice con Copilot/AI.

Obiettivi:
- **Minimo lock-in**: Supabase è solo Postgres ospitato, non un requisito.
- **Vendibilità**: l’Engine deve essere riusabile su qualsiasi cliente/DB.
- **Robustezza**: job-based, idempotenza, determinismo, retry webhook.

Componenti:
1) **Competition Engine** (`engine-python/`) — Python/FastAPI, *stateless*, algoritmo.
2) **Athlos Orchestrator** (`orchestrator-ts/`) — Node/TypeScript, orchestration + persistence.
3) **Contracts** (`contracts/`) — OpenAPI + tipi condivisi.

---

## 1) Requisiti non negoziabili
1. Engine **NON** deve:
   - chiamare DB (nessun SQL, nessun Supabase SDK)
   - conoscere eventi, divisioni, tabelle Athlos
2. Orchestrator **DEVE**:
   - essere l’unico che legge/scrive DB
   - parlare con DB tramite **SQL standard** (Postgres) usando `DATABASE_URL`
   - avere un layer `PersistenceAdapter` (swappabile)
3. Contratti API versionati.
4. Webhook firmati (HMAC) e retry.
5. Determinismo: stesso input + stessa draw_seed → stesso output.

---

## 2) Competition Engine — API vendibile
### 2.1 Endpoint
`POST /v1/brackets/generate`

Headers:
- `Authorization: Bearer <ENGINE_API_KEY>`
- `Idempotency-Key: <uuid>` (opzionale ma supportato)

### 2.2 Request schema (Pydantic)
```json
{
  "context": {
    "sport": "judo",
    "format": "single_elim",
    "repechage": true,
    "draw_seed": "sha256:...|optional",
    "engine_mode": "deterministic"
  },
  "rules": {
    "seeding_mode": "off|auto|manual",
    "max_seeds": 8,
    "seeding_thresholds": {"min_16": 8, "lt_16": 4},
    "separate_by": ["club", "nation"],
    "avoid_rematch_days": 90,
    "byes_policy": "prefer_high_seeds"
  },
  "participants": [
    {
      "athlete_id": "string-or-uuid",
      "club_id": "string-or-null",
      "nation_code": "string-or-null",
      "ranking_points": 1234,
      "seed": null,
      "meta": {"belt": "brown"}
    }
  ],
  "history": {
    "recent_pairs": [{"a": "id1", "b": "id2", "date": "2025-12-01"}]
  }
}
```

### 2.3 Response schema
```json
{
  "engine_version": "1.0.0",
  "summary": {
    "participants": 27,
    "size": 32,
    "rounds": 5,
    "byes": 5,
    "repechage": true,
    "quality": {"club_collisions_r1": 0, "nation_collisions_r1": 1}
  },
  "participants_slots": [{"athlete_id": "id", "slot": 1, "seed": 1}],
  "matches": [
    {
      "id": "uuid",
      "match_type": "main|final|bronze",
      "round": 1,
      "position": 1,
      "athlete_red": "id-or-null",
      "athlete_white": "id-or-null",
      "is_bye": false,
      "next_match_id": "uuid-or-null",
      "metadata": {"path": "R1:M1"}
    }
  ],
  "repechage_matches": [
    {
      "id": "uuid",
      "match_type": "repechage",
      "round": 1,
      "position": 1,
      "source_loser_match_id": "uuid",
      "metadata": {"path": "REP:R1:M1"}
    }
  ]
}
```

### 2.4 Algoritmo richiesto (Engine)
Formato: single elimination (power-of-two) con BYE.

1) **Bracket size**: `size = next_power_of_two(n_participants)`
2) **Seeding**:
   - `manual`: usa `seed` in input (validazione: univoci, range 1..max_seeds)
   - `auto`: ordina per `ranking_points desc`, assegna seed ai primi N dove:
     - N = min(rules.max_seeds, threshold)
     - threshold = `rules.seeding_thresholds.min_16` se n>=16 else `lt_16`
   - `off`: nessun seed
3) **Seed placement** (slot fissi):
   - 4 seed: 1 e 4 stessa metà, 2 e 3 nell’altra metà.
   - 8 seed: distribuzione per quarti (pattern classico) per evitare scontro precoce.
4) **Fill non-seed** con greedy scoring (soft constraints):
   - penalità altissima per same `club_id` nello stesso match round1
   - penalità media per same `nation_code` round1
   - penalità rematch usando `history.recent_pairs` se presente (entro avoid_rematch_days)
   - tie-break deterministico usando RNG con draw_seed
5) **BYE policy**: preferire BYE per seed alti se possibile.
6) **Match graph**:
   - crea match di tutti i round con `next_match_id`
   - round1 assegna atleti (o bye)
   - round>1 inizialmente `null` competitor
7) **Repechage parametrico**:
   - genera struttura repechage (e bronze) usando `source_loser_match_id`.
   - non serve conoscere i finalisti al momento della generazione; basta riferire i match main.
8) **Quality metrics**:
   - calcolare collisioni club/nation al round1.

### 2.5 Determinismo
Se `context.draw_seed` mancante, Engine calcola `draw_seed` come hash stabile di:
- rules + participants (ids, ranking, club/nation, seed) + sport/format.

---

## 3) Athlos Orchestrator — API
### 3.1 Endpoint admin
`POST /v1/events/{event_id}/generate-all-brackets`

Request:
```json
{
  "webhook": {"url": "https://front/api/webhooks/brackets", "secret": "shared"},
  "overrides": {"seeding_mode": "auto", "max_seeds": 8, "repechage": true, "separate_by": ["club"]}
}
```

Response 202:
```json
{
  "event_id": "uuid",
  "divisions_prepared": true,
  "jobs_enqueued": 9,
  "jobs_skipped": 3
}
```

### 3.2 Endpoint singola divisione
`POST /v1/events/{event_id}/divisions/{division_id}/generate`

---

## 4) Orchestrator — Job model
Approccio job-based (robusto):
- tabella `bracket_jobs` (queued, running, success, failed)
- worker/poller nel servizio Orchestrator

Regole:
- job idempotente per (event_id, division_id) se status in queued/running/success
- se bracket `locked`: rigenerazione proibita

---

## 5) PersistenceAdapter (anti lock-in)
L’Orchestrator usa una interfaccia astratta; implementazione concreta `PostgresAdapter` usa SQL standard via `DATABASE_URL`.

TypeScript interface:
```ts
export interface PersistenceAdapter {
  prepareDivisions(eventId: string): Promise<void>;

  listDivisionsWithCounts(eventId: string): Promise<Array<{ divisionId: string; code: string; participants: number }>>;

  fetchParticipants(eventId: string, divisionId: string): Promise<Array<{
    athlete_id: string;
    club_id: string | null;
    nation_code: string | null;
    ranking_points: number | null;
    seed: number | null;
    meta?: any;
  }>>;

  enqueueJob(params: {
    eventId: string;
    divisionId: string;
    webhookUrl: string;
    webhookSecret: string;
    overrides: any;
  }): Promise<{ jobId: string; created: boolean }>

  acquireNextJob(): Promise<null | { jobId: string; eventId: string; divisionId: string; webhookUrl: string; webhookSecret: string; overrides: any }>

  markJob(jobId: string, status: "running"|"success"|"failed", data?: any): Promise<void>;

  saveEngineResult(params: {
    eventId: string;
    divisionId: string;
    engineResult: any;
  }): Promise<{ bracketId: string }>

  isBracketLocked(eventId: string, divisionId: string): Promise<boolean>;
}
```

---

## 6) Database (Postgres standard, portabile)
Assumiamo già creati:
- `events`
- `athletes` (con `club_id`, `weight_category`, `gender`, `date_of_birth`, etc.)
- `event_registrations` (con `event_id`, `athlete_id`, `division_id`, `status`)
- `event_divisions`
- `event_settings`
- `bracket_jobs`
- `brackets`
- `bracket_participants`
- `matches`

Nota: Supabase RLS ok per sicurezza, ma la logica business vive nell’Orchestrator.

---

## 7) Divisioni — preparazione automatica (Orchestrator)
L’Orchestrator deve poter creare/assegnare divisioni per evento senza “categorie hardcoded”.

Regola consigliata per `division_code`:
`JUDO|{gender_norm}|{age_class}|{weight_category}`

- gender_norm: male/female/mixed
- age_class: U18/Senior/Master/unknown
- weight_category: `athletes.weight_category` o OPEN

L’implementazione può:
- usare query SQL standard
- opzionalmente chiamare una funzione DB equivalente (se presente) ma non deve essere requisito.

---

## 8) Webhook (Orchestrator → Frontend)
Eventi:
- `bracket.generated`
- `bracket.failed`

Headers webhook:
- `Content-Type: application/json`
- `X-Athlos-Event: <event>`
- `X-Athlos-Signature: sha256=<hmac>`
- `X-Athlos-Delivery: <jobId>`

Firma:
- HMAC-SHA256 del body JSON bytes usando `webhook_secret`.

Retry:
- 3 tentativi con backoff (es: 1s, 3s, 9s)
- fallimento webhook non deve corrompere lo stato bracket salvato.

---

## 9) Env vars
### Engine
- `ENGINE_API_KEY`
- `ENGINE_VERSION=1.0.0`

### Orchestrator
- `DATABASE_URL=postgres://...`
- `ENGINE_BASE_URL=http://...`
- `ENGINE_API_KEY=...`
- `WORKER_POLL_INTERVAL_MS=1000`
- `WEBHOOK_RETRY=3`
- `WEBHOOK_TIMEOUT_MS=5000`

---

## 10) Testing
### Engine
- Unit test: next_pow2, seed placement, determinismo.
- Property tests (Hypothesis):
  - nessun atleta duplicato
  - stessi input → stessi output
  - match graph coerente

### Orchestrator
- MockAdapter per test del flow (no DB).
- Test integrazione (opzionale) su Postgres.

---

## 11) Deliverable richiesti (Copilot/AI)
1) Engine FastAPI completo con:
   - Pydantic models
   - endpoint /v1/brackets/generate
   - algoritmo implementato (seed placement + greedy scoring + bye + repechage parametrico)
   - test
   - Dockerfile
2) Orchestrator TS completo con:
   - endpoints admin
   - job worker
   - PostgresAdapter con SQL standard
   - webhook signing + retry
   - Dockerfile
3) OpenAPI YAML in `contracts/` per entrambi.

---

## 12) Nota importante
L’Engine deve accettare `athlete_id` come stringa (non assumere UUID). Questo aumenta la rivendibilità.
