/**
 * Robot PostgreSQL Store
 *
 * Phase 06 Plan 01: Persistence layer for robot missions and connection records.
 * Uses getPool() pattern consistent with other stores in the project.
 *
 * Tables created lazily via ensureRobotTables() at startup:
 *
 *   robot_missions
 *   robot_connections
 */

import { getPool } from '../lib/database.js';
import type { RobotMissionState, MissionJSON } from './robot-types.js';

// ---------------------------------------------------------------------------
// Lazy-init flag
// ---------------------------------------------------------------------------

let tablesEnsured = false;

export async function ensureRobotTables(): Promise<void> {
  if (tablesEnsured) return;
  const pool = getPool();

  await pool.query(`
    CREATE TABLE IF NOT EXISTS robot_missions (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      mission_id  TEXT NOT NULL UNIQUE,
      robot_id    TEXT NOT NULL,
      problem_set_id TEXT,
      command     TEXT NOT NULL,
      params      JSONB NOT NULL DEFAULT '{}',
      state       TEXT NOT NULL DEFAULT 'pending',
      issued_by   TEXT NOT NULL,
      issued_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      gate_id     TEXT,
      rejection_reason TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_robot_missions_robot_id
      ON robot_missions (robot_id);
    CREATE INDEX IF NOT EXISTS idx_robot_missions_state
      ON robot_missions (state);
    CREATE INDEX IF NOT EXISTS idx_robot_missions_problem_set_id
      ON robot_missions (problem_set_id);

    CREATE TABLE IF NOT EXISTS robot_connections (
      id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      robot_id      TEXT NOT NULL UNIQUE,
      did           TEXT NOT NULL,
      capabilities  JSONB NOT NULL DEFAULT '[]',
      state         TEXT NOT NULL DEFAULT 'connected',
      connected_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_heartbeat TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_robot_connections_state
      ON robot_connections (state);
  `);

  tablesEnsured = true;
}

// ---------------------------------------------------------------------------
// Mission CRUD
// ---------------------------------------------------------------------------

export interface SaveMissionParams {
  mission_id: string;
  robot_id: string;
  problem_set_id?: string;
  command: string;
  params: MissionJSON['params'];
  issued_by: string;
  state?: RobotMissionState;
}

export interface MissionRow {
  id: string;
  mission_id: string;
  robot_id: string;
  problem_set_id: string | null;
  command: string;
  params: MissionJSON['params'];
  state: RobotMissionState;
  issued_by: string;
  issued_at: string;
  updated_at: string;
  gate_id: string | null;
  rejection_reason: string | null;
}

export async function saveMission(params: SaveMissionParams): Promise<MissionRow> {
  await ensureRobotTables();
  const pool = getPool();

  const result = await pool.query<MissionRow>(
    `INSERT INTO robot_missions
       (mission_id, robot_id, problem_set_id, command, params, issued_by, state)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [
      params.mission_id,
      params.robot_id,
      params.problem_set_id ?? null,
      params.command,
      JSON.stringify(params.params),
      params.issued_by,
      params.state ?? 'pending',
    ],
  );

  return result.rows[0];
}

export async function updateMissionState(
  missionId: string,
  state: RobotMissionState,
  opts: { gateId?: string; rejectionReason?: string } = {},
): Promise<void> {
  await ensureRobotTables();
  const pool = getPool();

  await pool.query(
    `UPDATE robot_missions
     SET state = $1,
         gate_id = COALESCE($2, gate_id),
         rejection_reason = COALESCE($3, rejection_reason),
         updated_at = NOW()
     WHERE mission_id = $4`,
    [state, opts.gateId ?? null, opts.rejectionReason ?? null, missionId],
  );
}

export async function getMission(missionId: string): Promise<MissionRow | null> {
  await ensureRobotTables();
  const pool = getPool();

  const result = await pool.query<MissionRow>(
    'SELECT * FROM robot_missions WHERE mission_id = $1',
    [missionId],
  );
  return result.rows[0] ?? null;
}

export async function getActiveMissions(robotId?: string): Promise<MissionRow[]> {
  await ensureRobotTables();
  const pool = getPool();

  const ACTIVE_STATES: RobotMissionState[] = ['pending', 'accepted', 'executing', 'awaiting_auth'];

  if (robotId) {
    const result = await pool.query<MissionRow>(
      `SELECT * FROM robot_missions
       WHERE robot_id = $1 AND state = ANY($2::text[])
       ORDER BY issued_at DESC`,
      [robotId, ACTIVE_STATES],
    );
    return result.rows;
  }

  const result = await pool.query<MissionRow>(
    `SELECT * FROM robot_missions
     WHERE state = ANY($1::text[])
     ORDER BY issued_at DESC`,
    [ACTIVE_STATES],
  );
  return result.rows;
}

// ---------------------------------------------------------------------------
// Connection CRUD
// ---------------------------------------------------------------------------

export interface ConnectionRow {
  id: string;
  robot_id: string;
  did: string;
  capabilities: string[];
  state: string;
  connected_at: string;
  last_heartbeat: string;
}

export async function saveConnection(params: {
  robot_id: string;
  did: string;
  capabilities: string[];
}): Promise<void> {
  await ensureRobotTables();
  const pool = getPool();

  await pool.query(
    `INSERT INTO robot_connections (robot_id, did, capabilities, state, connected_at, last_heartbeat)
     VALUES ($1, $2, $3, 'connected', NOW(), NOW())
     ON CONFLICT (robot_id) DO UPDATE
       SET did = EXCLUDED.did,
           capabilities = EXCLUDED.capabilities,
           state = 'connected',
           connected_at = NOW(),
           last_heartbeat = NOW()`,
    [params.robot_id, params.did, JSON.stringify(params.capabilities)],
  );
}

export async function updateConnectionHeartbeat(robotId: string): Promise<void> {
  await ensureRobotTables();
  const pool = getPool();

  await pool.query(
    `UPDATE robot_connections SET last_heartbeat = NOW() WHERE robot_id = $1`,
    [robotId],
  );
}

export async function removeConnection(robotId: string): Promise<void> {
  await ensureRobotTables();
  const pool = getPool();

  await pool.query(
    `UPDATE robot_connections SET state = 'disconnected' WHERE robot_id = $1`,
    [robotId],
  );
}

// ---------------------------------------------------------------------------
// Singleton export
// ---------------------------------------------------------------------------

export const robotStore = {
  ensureRobotTables,
  saveMission,
  updateMissionState,
  getMission,
  getActiveMissions,
  saveConnection,
  updateConnectionHeartbeat,
  removeConnection,
};
