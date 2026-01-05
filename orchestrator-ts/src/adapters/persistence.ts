export type JobStatus = 'queued' | 'running' | 'success' | 'failed';

export interface DivisionCount {
  divisionId: string;
  code: string;
  participants: number;
}

export interface ParticipantRow {
  athlete_id: string;
  club_id: string | null;
  nation_code: string | null;
  ranking_points: number | null;
  seed: number | null;
  meta?: any;
}

export interface PersistenceAdapter {
  prepareDivisions(eventId: string): Promise<void>;
  listDivisionsWithCounts(eventId: string): Promise<DivisionCount[]>;
  fetchParticipants(eventId: string, divisionId: string): Promise<ParticipantRow[]>;
  enqueueJob(params: {
    eventId: string;
    divisionId: string;
    webhookUrl: string;
    webhookSecret: string;
    overrides: any;
  }): Promise<{ jobId: string; created: boolean }>;
  acquireNextJob(): Promise<null | {
    jobId: string;
    eventId: string;
    divisionId: string;
    webhookUrl: string;
    webhookSecret: string;
    overrides: any;
  }>;
  markJob(jobId: string, status: JobStatus, data?: any): Promise<void>;
  saveEngineResult(params: { eventId: string; divisionId: string; engineResult: any }): Promise<{ bracketId: string }>;
  isBracketLocked(eventId: string, divisionId: string): Promise<boolean>;
}

import { Pool } from 'pg';

export class PostgresAdapter implements PersistenceAdapter {
  private pool: Pool;

  constructor(connectionString: string) {
    this.pool = new Pool({ connectionString });
  }

  async prepareDivisions(eventId: string): Promise<void> {
    // Stub: assume divisions are already prepared
    // In real, insert into event_divisions based on registrations
  }

  async listDivisionsWithCounts(eventId: string): Promise<DivisionCount[]> {
    const query = `
      SELECT ed.id as division_id, ed.code, COUNT(er.athlete_id) as participants
      FROM event_divisions ed
      LEFT JOIN event_registrations er ON ed.id = er.division_id
      WHERE ed.event_id = $1
      GROUP BY ed.id, ed.code
    `;
    const result = await this.pool.query(query, [eventId]);
    return result.rows.map(row => ({
      divisionId: row.division_id,
      code: row.code,
      participants: parseInt(row.participants)
    }));
  }

  async fetchParticipants(eventId: string, divisionId: string): Promise<ParticipantRow[]> {
    const query = `
      SELECT er.athlete_id, a.club_id, a.nation_code, a.ranking_points, er.seed, er.meta
      FROM event_registrations er
      JOIN athletes a ON er.athlete_id = a.id
      WHERE er.event_id = $1 AND er.division_id = $2
    `;
    const result = await this.pool.query(query, [eventId, divisionId]);
    return result.rows.map(row => ({
      athlete_id: row.athlete_id,
      club_id: row.club_id,
      nation_code: row.nation_code,
      ranking_points: row.ranking_points,
      seed: row.seed,
      meta: row.meta
    }));
  }

  async enqueueJob(params: {
    eventId: string;
    divisionId: string;
    webhookUrl: string;
    webhookSecret: string;
    overrides: any;
  }): Promise<{ jobId: string; created: boolean }> {
    // Check if job exists
    const existing = await this.pool.query(
      'SELECT id FROM bracket_jobs WHERE event_id = $1 AND division_id = $2 AND status IN ($3, $4, $5)',
      [params.eventId, params.divisionId, 'queued', 'running', 'success']
    );
    if (existing.rows.length > 0) {
      return { jobId: existing.rows[0].id, created: false };
    }
    const query = `
      INSERT INTO bracket_jobs (event_id, division_id, webhook_url, webhook_secret, overrides, status)
      VALUES ($1, $2, $3, $4, $5, 'queued')
      RETURNING id
    `;
    const result = await this.pool.query(query, [
      params.eventId,
      params.divisionId,
      params.webhookUrl,
      params.webhookSecret,
      JSON.stringify(params.overrides)
    ]);
    return { jobId: result.rows[0].id, created: true };
  }

  async acquireNextJob(): Promise<null | {
    jobId: string;
    eventId: string;
    divisionId: string;
    webhookUrl: string;
    webhookSecret: string;
    overrides: any;
  }> {
    const query = `
      UPDATE bracket_jobs
      SET status = 'running', updated_at = NOW()
      WHERE id = (
        SELECT id FROM bracket_jobs
        WHERE status = 'queued'
        ORDER BY created_at ASC
        LIMIT 1
        FOR UPDATE SKIP LOCKED
      )
      RETURNING id, event_id, division_id, webhook_url, webhook_secret, overrides
    `;
    const result = await this.pool.query(query);
    if (result.rows.length === 0) {
      return null;
    }
    const row = result.rows[0];
    return {
      jobId: row.id,
      eventId: row.event_id,
      divisionId: row.division_id,
      webhookUrl: row.webhook_url,
      webhookSecret: row.webhook_secret,
      overrides: JSON.parse(row.overrides)
    };
  }

  async markJob(jobId: string, status: JobStatus, data?: any): Promise<void> {
    const query = 'UPDATE bracket_jobs SET status = $1, data = $2, updated_at = NOW() WHERE id = $3';
    await this.pool.query(query, [status, data ? JSON.stringify(data) : null, jobId]);
  }

  async saveEngineResult(params: { eventId: string; divisionId: string; engineResult: any }): Promise<{ bracketId: string }> {
    // Stub: insert into brackets and matches
    const bracketQuery = `
      INSERT INTO brackets (event_id, division_id, data)
      VALUES ($1, $2, $3)
      RETURNING id
    `;
    const result = await this.pool.query(bracketQuery, [
      params.eventId,
      params.divisionId,
      JSON.stringify(params.engineResult)
    ]);
    return { bracketId: result.rows[0].id };
  }

  async isBracketLocked(eventId: string, divisionId: string): Promise<boolean> {
    const query = 'SELECT locked FROM brackets WHERE event_id = $1 AND division_id = $2';
    const result = await this.pool.query(query, [eventId, divisionId]);
    return result.rows.length > 0 && result.rows[0].locked;
  }
}
