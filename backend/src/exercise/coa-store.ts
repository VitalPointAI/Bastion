/**
 * COA Store
 *
 * Phase 14 Plan 01: CRUD for scenario_coas with information barrier filtering
 * and commander decision tracking.
 * All team-specific queries use `AND team = ANY($N)`.
 */

import { randomUUID } from 'crypto';
import { getPool } from '../lib/database.js';
import type { ScenarioCOA, CreateScenarioCOA, ExerciseCOAScore } from './types.js';

// ─── Row Mapper ───────────────────────────────────────────────────────────────

function rowToCOA(row: Record<string, unknown>): ScenarioCOA {
  return {
    id: row.id as string,
    scenarioId: row.scenario_id as string,
    team: row.team as ScenarioCOA['team'],
    exercisePhase: row.exercise_phase as string,
    number: row.number as number,
    name: row.name as string,
    description: (row.description as string) ?? '',
    scheme: (row.scheme as string) ?? '',
    doctScores: (row.doct_scores as ExerciseCOAScore | null) ?? null,
    wargameEvidence: (row.wargame_evidence as Record<string, unknown>) ?? {},
    combinedScore: row.combined_score !== null ? parseFloat(String(row.combined_score)) : null,
    narrative: (row.narrative as string) ?? '',
    commanderDecision: (row.commander_decision as ScenarioCOA['commanderDecision']) ?? null,
    commanderDecisionNotes: (row.commander_decision_notes as string) ?? '',
    decisionHash: (row.decision_hash as string | null) ?? null,
    blockchainTx: (row.blockchain_tx as string | null) ?? null,
    selected: Boolean(row.selected),
    createdBy: row.created_by as string,
    createdAt: new Date(row.created_at as string),
    updatedAt: new Date(row.updated_at as string),
  };
}

// ─── Store ────────────────────────────────────────────────────────────────────

export class COAStore {
  private pool = getPool();

  /**
   * Create a new COA
   */
  async create(data: CreateScenarioCOA): Promise<ScenarioCOA> {
    const id = randomUUID();
    const now = new Date();

    await this.pool.query(
      `INSERT INTO scenario_coas
         (id, scenario_id, team, exercise_phase, number, name, description, scheme,
          doct_scores, wargame_evidence, combined_score, narrative,
          commander_decision, commander_decision_notes, decision_hash, blockchain_tx,
          selected, created_by, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)`,
      [
        id,
        data.scenarioId,
        data.team,
        data.exercisePhase,
        data.number,
        data.name,
        data.description ?? '',
        data.scheme ?? '',
        data.doctScores ? JSON.stringify(data.doctScores) : null,
        JSON.stringify(data.wargameEvidence ?? {}),
        data.combinedScore ?? null,
        data.narrative ?? '',
        data.commanderDecision ?? null,
        data.commanderDecisionNotes ?? '',
        data.decisionHash ?? null,
        data.blockchainTx ?? null,
        data.selected ?? false,
        data.createdBy,
        now,
        now,
      ]
    );

    const result = await this.pool.query(
      'SELECT * FROM scenario_coas WHERE id = $1',
      [id]
    );
    return rowToCOA(result.rows[0]);
  }

  /**
   * Find all COAs for a scenario visible to the given teams
   */
  async findByScenario(
    scenarioId: string,
    visibleTeams: string[]
  ): Promise<ScenarioCOA[]> {
    const result = await this.pool.query(
      `SELECT * FROM scenario_coas
       WHERE scenario_id = $1 AND team = ANY($2)
       ORDER BY team, number ASC`,
      [scenarioId, visibleTeams]
    );
    return result.rows.map(rowToCOA);
  }

  /**
   * Find a COA by ID with team barrier check
   */
  async findById(
    id: string,
    visibleTeams: string[]
  ): Promise<ScenarioCOA | null> {
    const result = await this.pool.query(
      `SELECT * FROM scenario_coas
       WHERE id = $1 AND team = ANY($2)`,
      [id, visibleTeams]
    );
    return result.rows[0] ? rowToCOA(result.rows[0]) : null;
  }

  /**
   * Update doctrinal scores
   */
  async updateScores(id: string, scores: ExerciseCOAScore): Promise<void> {
    await this.pool.query(
      `UPDATE scenario_coas
       SET doct_scores = $1, combined_score = $2, updated_at = NOW()
       WHERE id = $3`,
      [JSON.stringify(scores), scores.combinedScore, id]
    );
  }

  /**
   * Update wargaming evidence JSONB
   */
  async updateWargameEvidence(
    id: string,
    evidence: Record<string, unknown>
  ): Promise<void> {
    await this.pool.query(
      `UPDATE scenario_coas
       SET wargame_evidence = $1, updated_at = NOW()
       WHERE id = $2`,
      [JSON.stringify(evidence), id]
    );
  }

  /**
   * Record commander decision
   */
  async recordDecision(
    id: string,
    decision: string,
    notes: string
  ): Promise<void> {
    await this.pool.query(
      `UPDATE scenario_coas
       SET commander_decision = $1, commander_decision_notes = $2, updated_at = NOW()
       WHERE id = $3`,
      [decision, notes, id]
    );
  }

  /**
   * Update the decision hash (SHA-256 of the decision record)
   */
  async updateDecisionHash(id: string, hash: string): Promise<void> {
    await this.pool.query(
      `UPDATE scenario_coas
       SET decision_hash = $1, updated_at = NOW()
       WHERE id = $2`,
      [hash, id]
    );
  }

  /**
   * Update the NEAR blockchain transaction hash
   */
  async updateBlockchainTx(id: string, txHash: string): Promise<void> {
    await this.pool.query(
      `UPDATE scenario_coas
       SET blockchain_tx = $1, updated_at = NOW()
       WHERE id = $2`,
      [txHash, id]
    );
  }

  /**
   * Update the staff-editable narrative
   */
  async updateNarrative(id: string, narrative: string): Promise<void> {
    await this.pool.query(
      `UPDATE scenario_coas
       SET narrative = $1, updated_at = NOW()
       WHERE id = $2`,
      [narrative, id]
    );
  }
}
