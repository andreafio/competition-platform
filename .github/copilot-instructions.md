# Copilot Instructions — Competition Platform

## Fonte di verità
- Segui `docs/SPEC_FOR_COPILOT.md`.

## Vincoli chiave
- **Competition Engine (Python/FastAPI)**
  - Stateless: nessun DB, nessuna persistenza.
  - Deterministico: stesso input -> stesso output.
  - Idempotenza: supporta `Idempotency-Key` (cache in-memory per processo ok in MVP).
  - Output: bracket + matches + repechage parametrico.

- **Athlos Orchestrator (Node/TS)**
  - Accesso DB solo via `DATABASE_URL` e SQL standard.
  - Nessun coupling a Supabase SDK.
  - Job-based: `bracket_jobs` + worker.
  - Webhook firmati HMAC e retry.

## Qualità
- Scrivi test automatizzati (pytest per Engine, vitest/jest per Orchestrator).
- Preferisci tipi espliciti, gestione errori e logging strutturato.
- Mantieni backward compatibility dei contratti in `contracts/`.
