# Athlos Orchestrator

Competition bracket orchestration platform with job queuing, persistence, and webhook notifications.

## Overview

The Orchestrator manages the complete bracket lifecycle: generation, storage, locking, and external notifications. It provides REST APIs for tournament management and ensures production reliability.

## Architecture

- **Job Queue**: Asynchronous bracket generation
- **Lifecycle Management**: Draft → Ready → Locked → Completed states
- **Webhook Notifications**: Reliable event delivery with HMAC signing
- **Preview & Diff**: Compare bracket changes before committing

## Quick Start

```bash
# Setup
cp .env.example .env
# Edit .env with your settings

# Start services
docker-compose -f docker-compose.prod.yml up -d

# Generate brackets for an event
curl -X POST http://localhost:3001/v1/events/1/generate-all-brackets \
  -H "Content-Type: application/json" \
  -d '{
    "webhook": {
      "url": "https://your-app.com/webhooks",
      "secret": "your-webhook-secret"
    }
  }'

# Preview bracket changes
curl -X POST http://localhost:3001/v1/events/1/divisions/1/preview-bracket \
  -H "Content-Type: application/json" \
  -d '{"overrides": {"rules": {"max_seeds": 8}}}'
```

## API Reference

### POST /v1/events/{event_id}/generate-all-brackets
Enqueue bracket generation for all divisions in an event.

### GET /v1/events/{event_id}/divisions/{division_id}/bracket
Retrieve the current bracket.

### POST /v1/events/{event_id}/divisions/{division_id}/preview-bracket
Generate preview bracket with diff from current.

### POST /v1/events/{event_id}/divisions/{division_id}/lock-bracket
Lock bracket to prevent regeneration.

## Lifecycle States

- **draft**: Not yet generated
- **ready**: Generated and editable
- **locked**: Immutable, tournament in progress
- **completed**: Tournament finished

## Webhook Events

Standardized events with HMAC SHA256 signatures:

- `bracket.generated`: New bracket created
- `bracket.failed`: Generation error
- `bracket.locked`: Bracket locked
- `bracket.completed`: Tournament completed

Payload includes version and timestamp for audit trails.

## Limits

- **Concurrent Jobs**: Limited by worker pool
- **Storage**: PostgreSQL with JSONB for flexibility
- **Webhooks**: 3 retry attempts with exponential backoff

## FAQ

### Why bracket lifecycle?

Prevents accidental changes during tournaments. Clear states eliminate confusion about regeneration.

### How do webhooks work?

Events are signed with HMAC for security. Failed deliveries retry automatically with dead letter logging.

### Can I preview changes?

Yes, use the preview endpoint to see diffs before committing changes.

## Deployment

```bash
# Production
docker-compose -f docker-compose.prod.yml up -d

# Development
docker-compose up -d
```

## Demo

Run the deterministic demo:

```bash
./scripts/demo-judo-27.sh
```

Generates a consistent 27-athlete judo bracket with quality analysis.