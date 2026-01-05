export type JobStatus = 'queued' | 'running' | 'success' | 'failed';

export interface DivisionCount {
  divisionId: number;
  code: string;
  participants: number;
}

export interface ParticipantRow {
  athlete_id: number;
  club_id: string | null;
  nation_code: string | null;
  ranking_points: number | null;
  seed: number | null;
  meta?: any;
}

export interface PersistenceAdapter {
  prepareDivisions(eventId: number): Promise<void>;
  listDivisionsWithCounts(eventId: number): Promise<DivisionCount[]>;
  fetchParticipants(eventId: number, divisionId: number): Promise<ParticipantRow[]>;
  enqueueJob(params: {
    eventId: number;
    divisionId: number;
    webhookUrl: string;
    webhookSecret: string;
    overrides: any;
  }): Promise<{ jobId: number; created: boolean }>;
  acquireNextJob(): Promise<null | {
    jobId: number;
    eventId: number;
    divisionId: number;
    webhookUrl: string;
    webhookSecret: string;
    overrides: any;
  }>;
  markJob(jobId: number, status: JobStatus, data?: any): Promise<void>;
  saveEngineResult(params: { eventId: number; divisionId: number; engineResult: any }): Promise<{ bracketId: number }>;
  isBracketLocked(eventId: number, divisionId: number): Promise<boolean>;
}

import { Pool } from 'pg';

export class MockAdapter implements PersistenceAdapter {
  private divisions: any[] = [
    { divisionId: 1, code: 'JUDO|MALE|U18|60KG', participants: 4 }
  ];
  private participants: { [key: number]: ParticipantRow[] } = {
    1: [
      { athlete_id: 1, club_id: 'club1', nation_code: 'ITA', ranking_points: 100, seed: null, meta: {} },
      { athlete_id: 'a2', club_id: 'club2', nation_code: 'ITA', ranking_points: 90, seed: null, meta: {} },
      { athlete_id: 'a3', club_id: 'club1', nation_code: 'FRA', ranking_points: 80, seed: null, meta: {} },
      { athlete_id: 'a4', club_id: 'club2', nation_code: 'FRA', ranking_points: 70, seed: null, meta: {} }
    ]
  };
  private jobs: any[] = [];
  private brackets: any[] = [];

  async prepareDivisions(eventId: number): Promise<void> {
    // Mock: do nothing
  }

  async listDivisionsWithCounts(eventId: number): Promise<DivisionCount[]> {
    return this.divisions;
  }

  async fetchParticipants(eventId: number, divisionId: number): Promise<ParticipantRow[]> {
    return this.participants[divisionId] || [];
  }

  async enqueueJob(params: {
    eventId: number;
    divisionId: number;
    webhookUrl: string;
    webhookSecret: string;
    overrides: any;
  }): Promise<{ jobId: number; created: boolean }> {
    const existing = this.jobs.find(j => j.eventId === params.eventId && j.divisionId === params.divisionId && ['queued', 'running', 'success'].includes(j.status));
    if (existing) {
      return { jobId: parseInt(existing.jobId), created: false };
    }
    const jobId = this.jobs.length + 1;
    this.jobs.push({ ...params, jobId: jobId.toString(), status: 'queued' });
    return { jobId, created: true };
  }

  async acquireNextJob(): Promise<null | {
    jobId: number;
    eventId: number;
    divisionId: number;
    webhookUrl: string;
    webhookSecret: string;
    overrides: any;
  }> {
    const job = this.jobs.find(j => j.status === 'queued');
    if (!job) return null;
    job.status = 'running';
    return {
      jobId: parseInt(job.jobId),
      eventId: job.eventId,
      divisionId: job.divisionId,
      webhookUrl: job.webhookUrl,
      webhookSecret: job.webhookSecret,
      overrides: job.overrides
    };
  }

  async markJob(jobId: number, status: JobStatus, data?: any): Promise<void> {
    const job = this.jobs.find(j => parseInt(j.jobId) === jobId);
    if (job) {
      job.status = status;
      job.data = data;
    }
  }

  async saveEngineResult(params: { eventId: number; divisionId: number; engineResult: any }): Promise<{ bracketId: number }> {
    const bracketId = this.brackets.length + 1;
    this.brackets.push({ ...params, bracketId });
    return { bracketId };
  }

  async isBracketLocked(eventId: number, divisionId: number): Promise<boolean> {
    return false;
  }
}

export class PostgresAdapter implements PersistenceAdapter {
  private pool: Pool;

  constructor(databaseUrl: string) {
    this.pool = new Pool({ connectionString: databaseUrl });
  }

  async prepareDivisions(eventId: string): Promise<void> {
    // Assume divisions are already prepared or create them based on registrations
    // For simplicity, do nothing
  }

  async listDivisionsWithCounts(eventId: string): Promise<DivisionCount[]> {
    const query = `
      SELECT 
        d.id as divisionId,
        d.code,
        COUNT(r.athlete_id) as participants
      FROM event_divisions d
      LEFT JOIN event_registrations r ON d.id = r.division_id AND r.event_id = $1 AND r.status = 'confirmed'
      WHERE d.event_id = $1
      GROUP BY d.id, d.code
      ORDER BY d.code
    `;
    const result = await this.pool.query(query, [eventId]);
    return result.rows.map(row => ({
      divisionId: row.divisionid,
      code: row.code,
      participants: parseInt(row.participants)
    }));
  }

  async fetchParticipants(eventId: string, divisionId: string): Promise<ParticipantRow[]> {
    const query = `
      SELECT 
        a.id as athlete_id,
        a.club_id,
        a.nation_code,
        a.ranking_points,
        r.seed,
        a.meta
      FROM event_registrations r
      JOIN athletes a ON r.athlete_id = a.id
      WHERE r.event_id = $1 AND r.division_id = $2 AND r.status = 'confirmed'
      ORDER BY a.ranking_points DESC NULLS LAST
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
    const existingQuery = `
      SELECT id FROM bracket_jobs 
      WHERE event_id = $1 AND division_id = $2 AND status IN ('queued', 'running', 'success')
    `;
    const existing = await this.pool.query(existingQuery, [params.eventId, params.divisionId]);
    if (existing.rows.length > 0) {
      return { jobId: existing.rows[0].id, created: false };
    }

    const insertQuery = `
      INSERT INTO bracket_jobs (event_id, division_id, webhook_url, webhook_secret, overrides, status)
      VALUES ($1, $2, $3, $4, $5, 'queued')
      RETURNING id
    `;
    const result = await this.pool.query(insertQuery, [
      params.eventId, params.divisionId, params.webhookUrl, params.webhookSecret, params.overrides
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
    const updateQuery = `
      UPDATE bracket_jobs 
      SET status = 'running', started_at = NOW()
      WHERE id = (
        SELECT id FROM bracket_jobs 
        WHERE status = 'queued' 
        ORDER BY created_at ASC 
        LIMIT 1
        FOR UPDATE SKIP LOCKED
      )
      RETURNING id, event_id, division_id, webhook_url, webhook_secret, overrides
    `;
    const result = await this.pool.query(updateQuery);
    if (result.rows.length === 0) return null;
    const row = result.rows[0];
    return {
      jobId: row.id,
      eventId: row.event_id,
      divisionId: row.division_id,
      webhookUrl: row.webhook_url,
      webhookSecret: row.webhook_secret,
      overrides: row.overrides || {}
    };
  }

  async markJob(jobId: string, status: JobStatus, data?: any): Promise<void> {
    const updateQuery = `
      UPDATE bracket_jobs 
      SET status = $2, data = $3, completed_at = CASE WHEN $2 IN ('success', 'failed') THEN NOW() ELSE NULL END
      WHERE id = $1
    `;
    await this.pool.query(updateQuery, [jobId, status, data ? JSON.stringify(data) : null]);
  }

  async saveEngineResult(params: { eventId: string; divisionId: string; engineResult: any }): Promise<{ bracketId: string }> {
    const insertBracketQuery = `
      INSERT INTO brackets (event_id, division_id, engine_result, created_at)
      VALUES ($1, $2, $3, NOW())
      RETURNING id
    `;
    const bracketResult = await this.pool.query(insertBracketQuery, [
      params.eventId, params.divisionId, JSON.stringify(params.engineResult)
    ]);
    const bracketId = bracketResult.rows[0].id;

    // Save participants
    const participants = params.engineResult.participants_slots || [];
    for (const p of participants) {
      await this.pool.query(`
        INSERT INTO bracket_participants (bracket_id, athlete_id, slot, seed)
        VALUES ($1, $2, $3, $4)
      `, [bracketId, p.athlete_id, p.slot, p.seed]);
    }

    // Save matches
    const matches = params.engineResult.matches || [];
    for (const m of matches) {
      await this.pool.query(`
        INSERT INTO matches (bracket_id, match_id, match_type, round, position, athlete_red, athlete_white, is_bye, next_match_id, metadata)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      `, [bracketId, m.id, m.match_type, m.round, m.position, m.athlete_red, m.athlete_white, m.is_bye, m.next_match_id, JSON.stringify(m.metadata)]);
    }

    // Save repechage
    const repechage = params.engineResult.repechage_matches || [];
    for (const m of repechage) {
      await this.pool.query(`
        INSERT INTO matches (bracket_id, match_id, match_type, round, position, source_loser_match_id, metadata)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [bracketId, m.id, m.match_type, m.round, m.position, m.source_loser_match_id, JSON.stringify(m.metadata)]);
    }

    return { bracketId };
  }

  async isBracketLocked(eventId: string, divisionId: string): Promise<boolean> {
    const query = `
      SELECT locked FROM brackets 
      WHERE event_id = $1 AND division_id = $2 AND locked = true
      LIMIT 1
    `;
    const result = await this.pool.query(query, [eventId, divisionId]);
    return result.rows.length > 0;
  }
}
