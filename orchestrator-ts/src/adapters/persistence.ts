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
  saveEngineResult(params: { eventId: string; divisionId: string; engineResult: any }): Promise<{ bracketId: string }>;
  markJob(jobId: string, status: JobStatus, data?: any): Promise<void>;
}
