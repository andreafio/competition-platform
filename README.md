# Athlos Competition Platform

Enterprise-grade tournament bracket generation and management system.

## Components

- **Engine** (`engine-python/`): Stateless bracket generation API
- **Orchestrator** (`orchestrator-ts/`): Job queuing, persistence, and webhooks

## Quick Start

```bash
# Clone and setup
git clone <repo>
cd generatore_brackets
cp .env.example .env
# Edit .env

# Start development environment
docker-compose up -d

# Run demo
cd orchestrator-ts/scripts
./demo-judo-27.sh
```

## Production Deployment

```bash
# Build and deploy
docker-compose -f docker-compose.prod.yml up -d
```

## Documentation

- [Engine API](./engine-python/README.md) - For external integrations
- [Orchestrator API](./orchestrator-ts/README.md) - For platform management

## Features

- ⚡ **High Performance**: Sub-second bracket generation
- 🎯 **Quality Scoring**: Algorithmic fairness metrics
- 🔒 **Lifecycle Management**: Immutable bracket states
- 📡 **Webhook Notifications**: Reliable event delivery
- 🔍 **Preview & Diff**: Compare changes before committing
- 🏆 **Deterministic**: Consistent results for demos

## Version

Current: **v1.0.0**

---

## Principi (non negoziabili)
- L'Engine **non** chiama DB.
- L'Orchestrator accede al DB tramite **adapter** (SQL standard). Supabase è solo "Postgres ospitato".
- Contratti API versionati in `contracts/`.

## Dove iniziare
1) Leggi `docs/SPEC_FOR_COPILOT.md` (documento principale per generazione con AI).
2) Implementa prima l'Engine (`engine-python/`).
3) Implementa l'Orchestrator (`orchestrator-ts/`) e l'adapter Postgres.

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
