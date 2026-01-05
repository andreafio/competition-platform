# Competition Platform (Engine + Orchestrator) — anti lock-in

Repo con **due servizi**:

- **Competition Engine** (`engine-python/`) — *vendibile, stateless*: riceve `participants + rules`, ritorna `bracket + matches (+ repechage)`.
- **Athlos Orchestrator** (`orchestrator-ts/`) — *specifico Athlos*: prepara divisioni evento, legge i partecipanti dal DB via SQL standard, chiama l’Engine, salva su DB e invia webhook al frontend.

## Principi (non negoziabili)
- L’Engine **non** chiama DB.
- L’Orchestrator accede al DB tramite **adapter** (SQL standard). Supabase è solo “Postgres ospitato”.
- Contratti API versionati in `contracts/`.

## Dove iniziare
1) Leggi `docs/SPEC_FOR_COPILOT.md` (documento principale per generazione con AI).
2) Implementa prima l’Engine (`engine-python/`).
3) Implementa l’Orchestrator (`orchestrator-ts/`) e l’adapter Postgres.

## Comandi (indicativi)
- Engine: `uvicorn app.main:app --reload`
- Orchestrator: `npm run dev`

## Eseguire con Docker
```bash
docker-compose up --build
```
Servizi disponibili:
- Engine: http://localhost:8000
- Orchestrator: http://localhost:3001
- DB: postgres://user:pass@localhost:5432/athlos

## Contratti
- Engine OpenAPI: `contracts/engine.openapi.yaml`
- Orchestrator OpenAPI: `contracts/orchestrator.openapi.yaml`
