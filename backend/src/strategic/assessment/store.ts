/**
 * Risk Assessment Store
 * PostgreSQL persistence for risk assessments
 */

import { getPool } from '../../lib/database.js';
import type { RiskAssessment, RiskLevel, AIRiskAssessment } from './types.js';

/**
 * Initialize risk_assessments table
 */
export async function initRiskAssessmentTable(): Promise<void> {
  const pool = getPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS risk_assessments (
      id TEXT PRIMARY KEY,
      objective_id TEXT NOT NULL,
      risk_to_mission JSONB NOT NULL,
      risk_to_force JSONB NOT NULL,
      mitigations JSONB NOT NULL DEFAULT '[]',
      risk_decision TEXT NOT NULL,
      risk_decision_authority TEXT NOT NULL,
      residual_risk TEXT NOT NULL,
      assessed_by TEXT NOT NULL,
      assessed_at TIMESTAMPTZ NOT NULL,
      reviewed_by TEXT,
      reviewed_at TIMESTAMPTZ,
      ai_metadata JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_risk_assessments_objective
      ON risk_assessments(objective_id);

    CREATE INDEX IF NOT EXISTS idx_risk_assessments_residual
      ON risk_assessments(residual_risk);
  `);
}

/**
 * Risk Assessment Store
 * CRUD operations for risk assessments
 */
export class RiskAssessmentStore {
  /**
   * Save a risk assessment to the database
   */
  async saveAssessment(assessment: RiskAssessment, aiMetadata?: Partial<AIRiskAssessment>): Promise<void> {
    const pool = getPool();
    await pool.query(`
      INSERT INTO risk_assessments (
        id, objective_id, risk_to_mission, risk_to_force, mitigations,
        risk_decision, risk_decision_authority, residual_risk,
        assessed_by, assessed_at, reviewed_by, reviewed_at, ai_metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      ON CONFLICT (id) DO UPDATE SET
        risk_to_mission = EXCLUDED.risk_to_mission,
        risk_to_force = EXCLUDED.risk_to_force,
        mitigations = EXCLUDED.mitigations,
        risk_decision = EXCLUDED.risk_decision,
        risk_decision_authority = EXCLUDED.risk_decision_authority,
        residual_risk = EXCLUDED.residual_risk,
        reviewed_by = EXCLUDED.reviewed_by,
        reviewed_at = EXCLUDED.reviewed_at,
        ai_metadata = EXCLUDED.ai_metadata
    `, [
      assessment.id,
      assessment.objectiveId,
      JSON.stringify(assessment.riskToMission),
      JSON.stringify(assessment.riskToForce),
      JSON.stringify(assessment.mitigations),
      assessment.riskDecision,
      assessment.riskDecisionAuthority,
      assessment.residualRisk,
      assessment.assessedBy,
      assessment.assessedAt,
      assessment.reviewedBy ?? null,
      assessment.reviewedAt ?? null,
      aiMetadata ? JSON.stringify(aiMetadata) : null,
    ]);
  }

  /**
   * Get a risk assessment by ID
   */
  async getAssessment(id: string): Promise<RiskAssessment | null> {
    const pool = getPool();
    const result = await pool.query(
      'SELECT * FROM risk_assessments WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.rowToAssessment(result.rows[0]);
  }

  /**
   * Get all risk assessments for an objective
   */
  async getAssessmentsForObjective(objectiveId: string): Promise<RiskAssessment[]> {
    const pool = getPool();
    const result = await pool.query(
      'SELECT * FROM risk_assessments WHERE objective_id = $1 ORDER BY assessed_at DESC',
      [objectiveId]
    );

    return result.rows.map(row => this.rowToAssessment(row));
  }

  /**
   * Update review information for an assessment
   */
  async updateReview(id: string, reviewedBy: string): Promise<void> {
    const pool = getPool();
    await pool.query(`
      UPDATE risk_assessments
      SET reviewed_by = $2, reviewed_at = NOW()
      WHERE id = $1
    `, [id, reviewedBy]);
  }

  /**
   * Get all HIGH or EXTREME risk assessments
   */
  async getHighRiskAssessments(): Promise<RiskAssessment[]> {
    const pool = getPool();
    const result = await pool.query(`
      SELECT * FROM risk_assessments
      WHERE residual_risk IN ('HIGH', 'EXTREME')
      ORDER BY
        CASE residual_risk
          WHEN 'EXTREME' THEN 0
          WHEN 'HIGH' THEN 1
        END,
        assessed_at DESC
    `);

    return result.rows.map(row => this.rowToAssessment(row));
  }

  /**
   * Get unreviewed assessments
   */
  async getUnreviewedAssessments(): Promise<RiskAssessment[]> {
    const pool = getPool();
    const result = await pool.query(`
      SELECT * FROM risk_assessments
      WHERE reviewed_by IS NULL
      ORDER BY assessed_at ASC
    `);

    return result.rows.map(row => this.rowToAssessment(row));
  }

  /**
   * Delete an assessment
   */
  async deleteAssessment(id: string): Promise<boolean> {
    const pool = getPool();
    const result = await pool.query(
      'DELETE FROM risk_assessments WHERE id = $1',
      [id]
    );
    return (result.rowCount ?? 0) > 0;
  }

  /**
   * Convert database row to RiskAssessment
   */
  private rowToAssessment(row: Record<string, unknown>): RiskAssessment {
    return {
      id: row.id as string,
      objectiveId: row.objective_id as string,
      riskToMission: row.risk_to_mission as RiskAssessment['riskToMission'],
      riskToForce: row.risk_to_force as RiskAssessment['riskToForce'],
      mitigations: row.mitigations as RiskAssessment['mitigations'],
      riskDecision: row.risk_decision as RiskAssessment['riskDecision'],
      riskDecisionAuthority: row.risk_decision_authority as string,
      residualRisk: row.residual_risk as RiskLevel,
      assessedBy: row.assessed_by as string,
      assessedAt: new Date(row.assessed_at as string),
      reviewedBy: row.reviewed_by as string | undefined,
      reviewedAt: row.reviewed_at ? new Date(row.reviewed_at as string) : undefined,
    };
  }

  /**
   * Get AI metadata for an assessment
   */
  async getAIMetadata(id: string): Promise<Partial<AIRiskAssessment> | null> {
    const pool = getPool();
    const result = await pool.query(
      'SELECT ai_metadata FROM risk_assessments WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0 || !result.rows[0].ai_metadata) {
      return null;
    }

    return result.rows[0].ai_metadata as Partial<AIRiskAssessment>;
  }
}

// Export singleton instance
export const riskAssessmentStore = new RiskAssessmentStore();
