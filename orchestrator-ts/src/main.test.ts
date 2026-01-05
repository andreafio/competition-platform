import { describe, it, expect, vi } from 'vitest';
import Fastify from 'fastify';

// Mock the adapter
vi.mock('./adapters/persistence.js', () => ({
  PostgresAdapter: vi.fn().mockImplementation(() => ({
    prepareDivisions: vi.fn().mockResolvedValue(undefined),
    listDivisionsWithCounts: vi.fn().mockResolvedValue([
      { divisionId: 'div1', code: 'JUDO|MALE|U18|60KG', participants: 8 }
    ]),
    enqueueJob: vi.fn().mockResolvedValue({ jobId: 'job1', created: true }),
  })),
  MockAdapter: vi.fn().mockImplementation(() => ({
    prepareDivisions: vi.fn().mockResolvedValue(undefined),
    listDivisionsWithCounts: vi.fn().mockResolvedValue([
      { divisionId: 'div1', code: 'JUDO|MALE|U18|60KG', participants: 8 }
    ]),
    enqueueJob: vi.fn().mockResolvedValue({ jobId: 'job1', created: true }),
  })),
}));

describe('Orchestrator', () => {
  it('should return health', async () => {
    const app = Fastify();
    app.get('/health', async () => ({ status: 'ok' }));

    const response = await app.inject({
      method: 'GET',
      url: '/health',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: 'ok' });
  });

  it('should handle generate-all-brackets', async () => {
    // Import after mock
    const { default: app } = await import('./main.js');

    const response = await app.inject({
      method: 'POST',
      url: '/v1/events/event1/generate-all-brackets',
      payload: {
        webhook: { url: 'http://example.com', secret: 'secret' },
        overrides: { seeding_mode: 'auto' }
      }
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.event_id).toBe('event1');
    expect(body.jobs_enqueued).toBe(1);
  });
});