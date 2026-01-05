import Fastify from 'fastify';
import { MockAdapter, PostgresAdapter } from './adapters/persistence.js';
import { z } from 'zod';

const app = Fastify({ logger: true });

const databaseUrl = process.env.DATABASE_URL;
const adapter = databaseUrl ? new PostgresAdapter(databaseUrl) : new MockAdapter();

const engineUrl = process.env.ENGINE_BASE_URL || 'http://localhost:8081';
const engineApiKey = process.env.ENGINE_API_KEY || 'dev';
const webhookAllowedDomains = (process.env.WEBHOOK_ALLOWED_DOMAINS || '').split(',').map(d => d.trim());

// Correlation ID hook
app.addHook('onRequest', (request, reply, done) => {
  const correlationId = request.headers['x-request-id'] as string || request.id;
  request.correlationId = correlationId;
  reply.header('X-Request-Id', correlationId);
  done();
});

// Schemas
const WebhookSchema = z.object({
  url: z.string(),
  secret: z.string(),
});

const GenerateAllRequestSchema = z.object({
  webhook: WebhookSchema,
  overrides: z.record(z.any()).optional(),
});

const GenerateAllResponseSchema = z.object({
  event_id: z.number(),
  divisions_prepared: z.boolean(),
  jobs_enqueued: z.number(),
  jobs_skipped: z.number(),
});

// Compute bracket diff
function computeBracketDiff(oldBracket: any, newBracket: any) {
  if (!oldBracket) {
    return { type: 'new', new_matches: newBracket.matches || [] };
  }

  const oldMatches = oldBracket.matches || [];
  const newMatches = newBracket.matches || [];

  const oldMatchMap = new Map(oldMatches.map((m: any) => [m.id, m]));
  const newMatchMap = new Map(newMatches.map((m: any) => [m.id, m]));

  const changed = [];
  const added = [];
  const removed = [];

  for (const [id, newMatch] of newMatchMap) {
    const oldMatch = oldMatchMap.get(id);
    if (!oldMatch) {
      added.push(newMatch);
    } else if (JSON.stringify(oldMatch) !== JSON.stringify(newMatch)) {
      changed.push({ old: oldMatch, new: newMatch });
    }
  }

  for (const [id, oldMatch] of oldMatchMap) {
    if (!newMatchMap.has(id)) {
      removed.push(oldMatch);
    }
  }

  return {
    type: 'diff',
    changed_matches: changed,
    added_matches: added,
    removed_matches: removed,
  };
}

// Lock bracket endpoint
app.post('/v1/events/:eventId/divisions/:divisionId/lock-bracket', async (request, reply) => {
  const eventId = parseInt(request.params.eventId);
  const divisionId = parseInt(request.params.divisionId);
  const lockedBy = request.headers['x-user-id'] as string || 'system';

  await adapter.lockBracket(eventId, divisionId, lockedBy);

  // Send webhook (assuming webhook from job, but for simplicity, skip or add webhook to brackets)
  // For now, just log

  return { event_id: eventId, division_id: divisionId, locked: true };
});

// Get bracket endpoint
app.get('/v1/events/:eventId/divisions/:divisionId/bracket', async (request, reply) => {
  const eventId = parseInt(request.params.eventId);
  const divisionId = parseInt(request.params.divisionId);

  const bracket = await adapter.getBracket(eventId, divisionId);
  if (!bracket) {
    return reply.code(404).send({ error: 'Bracket not found' });
  }

  return bracket;
});

// Preview bracket with diff
app.post('/v1/events/:eventId/divisions/:divisionId/preview-bracket', async (request, reply) => {
  const eventId = parseInt(request.params.eventId);
  const divisionId = parseInt(request.params.divisionId);
  const body = z.object({
    overrides: z.record(z.any()).optional(),
  }).parse(request.body);

  // Fetch participants
  const participants = await adapter.fetchParticipants(eventId, divisionId);

  // Call Engine
  const engineRequest = {
    context: {
      sport: 'judo',
      format: 'single_elim',
      repechage: true,
      ...body.overrides,
    },
    rules: {
      seeding_mode: 'auto',
      ...body.overrides,
    },
    participants: participants.map(p => ({
      athlete_id: String(p.athlete_id),
      club_id: p.club_id,
      nation_code: p.nation_code,
      ranking_points: p.ranking_points || 0,
      seed: p.seed,
      meta: p.meta,
    })),
    history: { recent_pairs: [] },
  };

  // Call Engine with timeout and retry
  const callEngineWithRetry = async (maxRetries = 2, timeoutMs = 30000) => {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

        const response = await fetch(`${engineUrl}/v1/brackets/generate`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${engineApiKey}`,
            'X-Request-Id': request.correlationId,
          },
          body: JSON.stringify(engineRequest),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`Engine error: ${response.status}`);
        }

        return response;
      } catch (error) {
        if (attempt === maxRetries) {
          throw error;
        }
        // Wait before retry (exponential backoff)
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
      }
    }
  };

  const response = await callEngineWithRetry();

  const newBracket = await response.json();

  // Get old bracket
  const oldBracket = await adapter.getBracket(eventId, divisionId);

  // Compute diff
  const diff = computeBracketDiff(oldBracket, newBracket);

  return {
    event_id: eventId,
    division_id: divisionId,
    old_bracket: oldBracket,
    new_bracket: newBracket,
    diff,
  };
});

// Endpoints
app.post('/v1/events/:eventId/generate-all-brackets', async (request, reply) => {
  const eventId = parseInt(request.params.eventId);
  const body = GenerateAllRequestSchema.parse(request.body);

  // Prepare divisions
  await adapter.prepareDivisions(eventId);

  // List divisions
  const divisions = await adapter.listDivisionsWithCounts(eventId);

  let enqueued = 0;
  let skipped = 0;

  for (const div of divisions) {
    if (div.participants === 0) continue;
    const job = await adapter.enqueueJob({
      eventId,
      divisionId: div.divisionId,
      webhookUrl: body.webhook.url,
      webhookSecret: body.webhook.secret,
      overrides: body.overrides || {},
    });
    if (job.created) {
      enqueued++;
    } else {
      skipped++;
    }
  }

  return {
    event_id: eventId,
    divisions_prepared: true,
    jobs_enqueued: enqueued,
    jobs_skipped: skipped,
  };
});

// Job stuck detection (check every 5 minutes)
setInterval(async () => {
  try {
    await adapter.markStuckJobsAsFailed(5 * 60 * 1000); // 5 minutes
  } catch (error) {
    app.log.error('Failed to check for stuck jobs', { error: error.message });
  }
}, 60 * 1000); // Check every minute

// Worker (simple poller)
setInterval(async () => {
  const job = await adapter.acquireNextJob();
  if (!job) return;

  try {
    // Fetch participants
    const participants = await adapter.fetchParticipants(job.eventId, job.divisionId);

    // Call Engine
    const engineRequest = {
      context: {
        sport: 'judo',
        format: 'single_elim',
        repechage: true,
        ...job.overrides,
      },
      rules: {
        seeding_mode: 'auto',
        ...job.overrides,
      },
      participants: participants.map(p => ({
        athlete_id: p.athlete_id.toString().toString(),
        club_id: p.club_id,
        nation_code: p.nation_code,
        ranking_points: p.ranking_points || 0,
        seed: p.seed,
        meta: p.meta,
      })),
      history: { recent_pairs: [] },
    };

    const response = await fetch(`${engineUrl}/v1/brackets/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${engineApiKey}`,
      },
      body: JSON.stringify(engineRequest),
    });

    if (!response.ok) {
      throw new Error(`Engine error: ${response.status}`);
    }

    const engineResult = await response.json();

    // Save result
    await adapter.saveEngineResult({
      eventId: job.eventId,
      divisionId: job.divisionId,
      engineResult,
    });

    // Send webhook
    await sendWebhook(job.webhookUrl, job.webhookSecret, 'bracket.generated', {
      event_id: job.eventId,
      division_id: job.divisionId,
      bracket_id: 'generated',
    });

    await adapter.markJob(job.jobId, 'success');
  } catch (error) {
    app.log.error(error);
    await adapter.markJob(job.jobId, 'failed', { error: error.message });

    // Send failure webhook
    await sendWebhook(job.webhookUrl, job.webhookSecret, 'bracket.failed', {
      event_id: job.eventId,
      division_id: job.divisionId,
      error: error.message,
    });
  }
}, parseInt(process.env.WORKER_POLL_INTERVAL_MS || '1000'));

async function sendWebhook(url: string, secret: string, event: string, data: any) {
  // Domain allowlist check
  if (webhookAllowedDomains.length > 0 && webhookAllowedDomains[0] !== '') {
    try {
      const urlObj = new URL(url);
      const isAllowed = webhookAllowedDomains.some(domain =>
        urlObj.hostname === domain || urlObj.hostname.endsWith('.' + domain)
      );
      if (!isAllowed) {
        throw new Error(`Webhook domain ${urlObj.hostname} not in allowlist`);
      }
    } catch (error) {
      throw new Error(`Invalid webhook URL or domain not allowed: ${error.message}`);
    }
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const payload = {
    v: 1, // payload version
    event,
    timestamp,
    ...data,
  };
  const body = JSON.stringify(payload);
  const signature = require('crypto').createHmac('sha256', secret).update(body).digest('hex');

  const maxRetries = 3;
  let attempt = 0;
  while (attempt < maxRetries) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Athlos-Event': event,
          'X-Athlos-Signature': `sha256=${signature}`,
          'X-Athlos-Version': '1.0.0',
          'X-Athlos-Timestamp': timestamp.toString(),
        },
        body,
      });
      if (response.ok) {
        return;
      } else {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch (error) {
      attempt++;
      if (attempt >= maxRetries) {
        app.log.error(`Webhook failed after ${maxRetries} attempts: ${error.message}`, { url, event, data });
        // Dead letter: save to DB
        try {
          await adapter.saveDeadLetter({
            jobId: data.jobId,
            webhookUrl: url,
            payload,
            errorMessage: error.message,
            retryCount: maxRetries
          });
        } catch (dlqError) {
          app.log.error('Failed to save to dead letter queue', { error: dlqError.message });
        }
      } else {
        // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
      }
    }
  }
}

app.get('/health', async () => ({ status: 'ok' }));

// Metrics endpoint
app.get('/metrics', async () => {
  const metrics = await adapter.getMetrics();
  return {
    jobs_success: metrics.jobsSuccess,
    jobs_failed: metrics.jobsFailed,
    engine_latency_p95: metrics.engineLatencyP95,
    quality_score_avg: metrics.qualityScoreAvg,
    timestamp: new Date().toISOString()
  };
});

const port = Number(process.env.PORT || 3001);
app.listen({ port, host: '0.0.0.0' }).catch(err => {
  app.log.error(err);
  process.exit(1);
});

export default app;
