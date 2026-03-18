/**
 * TeamStore
 *
 * Phase 51: Unified Agent Architecture
 * PostgreSQL-backed CRUD store for AgentTeam configurations.
 * Replaces the in-memory Map in TeamRegistry with durable storage.
 *
 * Table: agent_teams (created by migration 034)
 */

import { getPool } from '../lib/database.js';
import type { AgentTeam } from './types.js';

// ============================================================================
// TeamStore class
// ============================================================================

export class TeamStore {
  /**
   * Persist a new team. Throws if a team with the same ID already exists.
   */
  async createTeam(team: AgentTeam): Promise<void> {
    const pool = getPool();
    await pool.query(
      `INSERT INTO agent_teams (team_id, team_data, created_at, updated_at)
       VALUES ($1, $2, NOW(), NOW())`,
      [team.teamId, JSON.stringify(team)]
    );
  }

  /**
   * Retrieve a team by ID. Returns undefined if not found.
   */
  async getTeam(teamId: string): Promise<AgentTeam | undefined> {
    const pool = getPool();
    const result = await pool.query<{ team_data: AgentTeam }>(
      `SELECT team_data FROM agent_teams WHERE team_id = $1`,
      [teamId]
    );
    if (result.rows.length === 0) return undefined;
    return result.rows[0].team_data;
  }

  /**
   * List all teams, ordered by creation time.
   */
  async listTeams(): Promise<AgentTeam[]> {
    const pool = getPool();
    const result = await pool.query<{ team_data: AgentTeam }>(
      `SELECT team_data FROM agent_teams ORDER BY created_at`
    );
    return result.rows.map((r) => r.team_data);
  }

  /**
   * Apply partial updates to an existing team's stored data.
   * Merges the updates into the existing team_data JSONB.
   */
  async updateTeam(teamId: string, updates: Partial<AgentTeam>): Promise<void> {
    const pool = getPool();
    await pool.query(
      `UPDATE agent_teams
       SET team_data  = team_data || $2::jsonb,
           updated_at = NOW()
       WHERE team_id = $1`,
      [teamId, JSON.stringify(updates)]
    );
  }

  /**
   * Delete a team by ID.
   */
  async deleteTeam(teamId: string): Promise<void> {
    const pool = getPool();
    await pool.query(`DELETE FROM agent_teams WHERE team_id = $1`, [teamId]);
  }
}

// ============================================================================
// Singleton factory
// ============================================================================

let _store: TeamStore | null = null;

/**
 * Returns the shared TeamStore singleton.
 */
export function getTeamStore(): TeamStore {
  if (!_store) _store = new TeamStore();
  return _store;
}
