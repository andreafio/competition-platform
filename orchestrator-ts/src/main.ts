import Fastify from 'fastify';
import { PostgresAdapter } from './adapters/persistence.js';
import { z } from 'zod';

const app = Fastify({ logger: true });

const dbUrl = process.env.DATABASE_URL || 'postgres://user:pass@localhost:5432/db';
const adapter = new PostgresAdapter(dbUrl);

const engineUrl = process.env.ENGINE_BASE_URL || 'http://localhost:8000';
const engineApiKey = process.env.ENGINE_API_KEY || 'test';

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
  event_id: z.string(),
  divisions_prepared: z.boolean(),
  jobs_enqueued: z.number(),
  jobs_skipped: z.number(),
});

// Endpoints
app.post('/v1/events/:eventId/generate-all-brackets', async (request, reply) => {
  const { eventId } = request.params as { eventId: string };
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
        athlete_id: p.athlete_id,
        club_id: p.club_id,
        nation_code: p.nation_code,
        ranking_points: p.ranking_points || 0,
        seed: p.seed,
        meta: p.meta,
      })),
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
  }
}, parseInt(process.env.WORKER_POLL_INTERVAL_MS || '1000'));

async function sendWebhook(url: string, secret: string, event: string, data: any) {
  const body = JSON.stringify(data);
  const signature = require('crypto').createHmac('sha256', secret).update(body).digest('hex');

  await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Athlos-Event': event,
      'X-Athlos-Signature': `sha256=${signature}`,
    },
    body,
  });
}

app.get('/health', async () => ({ status: 'ok' }));

const port = Number(process.env.PORT || 3001);
app.listen({ port, host: '0.0.0.0' }).catch(err => {
  app.log.error(err);
  process.exit(1);
});

export default app;
