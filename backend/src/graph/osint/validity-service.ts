/**
 * Validity Service
 *
 * Calculates and tracks objective validity scores based on linked evidence.
 * Includes trend analysis and automated alerting for significant changes.
 */

import { randomUUID } from 'crypto';
import { getPool } from '../../lib/database.js';
import { osintEventStore } from './event-store.js';
import type { ValidityScore, ValidityAlert, AlertType } from './types.js';

/**
 * Initialize validity tables
 */
export async function initValidityTables(): Promise<void> {
  const pool = getPool();

  await pool.query(`
    CREATE TABLE IF NOT EXISTS validity_scores (
      id TEXT PRIMARY KEY,
      objective_id TEXT NOT NULL,
      score INTEGER NOT NULL CHECK (score >= 0 AND score <= 100),
      previous_score INTEGER,
      reasoning TEXT NOT NULL,
      evidence_ids TEXT[] NOT NULL DEFAULT '{}',
      calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      calculated_by TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_validity_objective ON validity_scores(objective_id);
    CREATE INDEX IF NOT EXISTS idx_validity_calculated ON validity_scores(calculated_at DESC);
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS validity_alerts (
      id TEXT PRIMARY KEY,
      objective_id TEXT NOT NULL,
      alert_type TEXT NOT NULL,
      severity TEXT NOT NULL,
      title TEXT NOT NULL,
      details TEXT NOT NULL,
      evidence_ids TEXT[] NOT NULL DEFAULT '{}',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      acknowledged_at TIMESTAMPTZ,
      acknowledged_by TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_alerts_objective ON validity_alerts(objective_id);
    CREATE INDEX IF NOT EXISTS idx_alerts_unacknowledged ON validity_alerts(acknowledged_at) WHERE acknowledged_at IS NULL;
  `);
}

/**
 * Validity Service - calculates objective validity based on evidence
 */
export class ValidityService {
  private initialized = false;

  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await initValidityTables();
      this.initialized = true;
    }
  }

  /**
   * Calculate validity score based on linked evidence
   */
  async calculateValidity(
    objectiveId: string,
    calculatedBy: string
  ): Promise<ValidityScore> {
    await this.ensureInitialized();
    const pool = getPool();

    // Get all evidence for this objective
    const evidence = await osintEventStore.getObjectiveEvidence(objectiveId);

    // Get previous score
    const prevResult = await pool.query(
      'SELECT score FROM validity_scores WHERE objective_id = $1 ORDER BY calculated_at DESC LIMIT 1',
      [objectiveId]
    );
    const previousScore = prevResult.rows.length > 0 ? prevResult.rows[0].score : undefined;

    // Calculate new score based on evidence
    let score = 70; // Base score (no evidence = moderate validity)

    if (evidence.length > 0) {
      // Weighted sum based on relevance and recency
      let totalWeight = 0;
      let weightedSum = 0;

      for (const ev of evidence) {
        // More recent evidence weighted higher
        const ageInDays = (Date.now() - ev.event.publishedAt.getTime()) / (1000 * 60 * 60 * 24);
        const recencyWeight = Math.max(0.2, 1 - (ageInDays / 90)); // Decays over 90 days

        const evidenceWeight = ev.relevanceScore * recencyWeight;
        totalWeight += evidenceWeight;

        // Supporting increases score, contradicting decreases
        let evidenceImpact: number;
        switch (ev.relevance) {
          case 'supporting':
            evidenceImpact = 80 + (ev.relevanceScore * 20); // 80-100
            break;
          case 'contradicting':
            evidenceImpact = 40 - (ev.relevanceScore * 30); // 10-40
            break;
          case 'neutral':
            evidenceImpact = 60; // Neutral keeps it moderate
            break;
          default:
            evidenceImpact = 50;
        }

        weightedSum += evidenceImpact * evidenceWeight;
      }

      score = totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 70;
    }

    // Build reasoning
    const supportingCount = evidence.filter(e => e.relevance === 'supporting').length;
    const contradictingCount = evidence.filter(e => e.relevance === 'contradicting').length;
    const reasoning = this.buildReasoning(score, previousScore, supportingCount, contradictingCount, evidence.length);

    // Save score
    const id = `VAL-${randomUUID().slice(0, 8)}`;
    const now = new Date();

    await pool.query(`
      INSERT INTO validity_scores (id, objective_id, score, previous_score, reasoning, evidence_ids, calculated_at, calculated_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `, [
      id,
      objectiveId,
      score,
      previousScore ?? null,
      reasoning,
      evidence.map(e => e.id),
      now,
      calculatedBy,
    ]);

    // Check for alerts
    await this.checkForAlerts(objectiveId, score, previousScore, evidence.map(e => e.id));

    return {
      id,
      objectiveId,
      score,
      previousScore,
      reasoning,
      evidenceIds: evidence.map(e => e.id),
      calculatedAt: now,
      calculatedBy,
    };
  }

  private buildReasoning(
    score: number,
    previousScore: number | undefined,
    supporting: number,
    contradicting: number,
    total: number
  ): string {
    const parts: string[] = [];

    if (total === 0) {
      parts.push('No evidence linked yet. Score based on baseline assumption.');
    } else {
      parts.push(`Based on ${total} evidence item(s): ${supporting} supporting, ${contradicting} contradicting.`);
    }

    if (previousScore !== undefined) {
      const change = score - previousScore;
      if (Math.abs(change) >= 10) {
        parts.push(`Significant ${change > 0 ? 'increase' : 'decrease'} of ${Math.abs(change)} points from previous assessment.`);
      }
    }

    if (score >= 80) {
      parts.push('High confidence in objective validity.');
    } else if (score >= 60) {
      parts.push('Moderate confidence in objective validity.');
    } else if (score >= 40) {
      parts.push('Reduced confidence - review recommended.');
    } else {
      parts.push('Low confidence - objective may no longer be valid.');
    }

    return parts.join(' ');
  }

  private async checkForAlerts(
    objectiveId: string,
    score: number,
    previousScore: number | undefined,
    evidenceIds: string[]
  ): Promise<void> {
    const pool = getPool();

    const alerts: Array<{ type: AlertType; severity: ValidityAlert['severity']; title: string; details: string }> = [];

    // Check for significant score decrease
    if (previousScore !== undefined) {
      const change = score - previousScore;
      if (change <= -20) {
        alerts.push({
          type: 'validity_decreased',
          severity: change <= -30 ? 'high' : 'medium',
          title: 'Significant validity decrease',
          details: `Validity score decreased by ${Math.abs(change)} points (${previousScore} → ${score}). Review new evidence.`,
        });
      } else if (change >= 20) {
        alerts.push({
          type: 'validity_increased',
          severity: 'low',
          title: 'Validity increased',
          details: `Validity score increased by ${change} points (${previousScore} → ${score}).`,
        });
      }
    }

    // Critical low validity
    if (score < 30) {
      alerts.push({
        type: 'validity_decreased',
        severity: 'critical',
        title: 'Critical low validity',
        details: `Objective validity has dropped to ${score}%. Immediate review recommended.`,
      });
    }

    // Create alerts
    for (const alert of alerts) {
      const id = `ALT-${randomUUID().slice(0, 8)}`;
      await pool.query(`
        INSERT INTO validity_alerts (id, objective_id, alert_type, severity, title, details, evidence_ids, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      `, [id, objectiveId, alert.type, alert.severity, alert.title, alert.details, evidenceIds]);
    }
  }

  /**
   * Get validity score history for an objective
   */
  async getValidityHistory(
    objectiveId: string,
    limit: number = 30
  ): Promise<ValidityScore[]> {
    await this.ensureInitialized();
    const pool = getPool();

    const result = await pool.query(`
      SELECT * FROM validity_scores WHERE objective_id = $1 ORDER BY calculated_at DESC LIMIT $2
    `, [objectiveId, limit]);

    return result.rows.map(row => ({
      id: row.id,
      objectiveId: row.objective_id,
      score: row.score,
      previousScore: row.previous_score ?? undefined,
      reasoning: row.reasoning,
      evidenceIds: row.evidence_ids,
      calculatedAt: new Date(row.calculated_at),
      calculatedBy: row.calculated_by,
    }));
  }

  /**
   * Calculate trend over a time window
   */
  async calculateTrend(
    objectiveId: string,
    windowDays: number = 30
  ): Promise<{ trend: 'improving' | 'declining' | 'stable'; changePercent: number }> {
    await this.ensureInitialized();
    const pool = getPool();

    const cutoff = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);

    const result = await pool.query(`
      SELECT score, calculated_at FROM validity_scores
      WHERE objective_id = $1 AND calculated_at >= $2
      ORDER BY calculated_at ASC
    `, [objectiveId, cutoff]);

    if (result.rows.length < 2) {
      return { trend: 'stable', changePercent: 0 };
    }

    const first = result.rows[0].score;
    const last = result.rows[result.rows.length - 1].score;
    const changePercent = ((last - first) / first) * 100;

    let trend: 'improving' | 'declining' | 'stable';
    if (changePercent > 5) {
      trend = 'improving';
    } else if (changePercent < -5) {
      trend = 'declining';
    } else {
      trend = 'stable';
    }

    return { trend, changePercent: Math.round(changePercent * 10) / 10 };
  }

  /**
   * Get unacknowledged alerts
   */
  async getUnacknowledgedAlerts(
    objectiveId?: string
  ): Promise<ValidityAlert[]> {
    await this.ensureInitialized();
    const pool = getPool();

    const query = objectiveId
      ? 'SELECT * FROM validity_alerts WHERE acknowledged_at IS NULL AND objective_id = $1 ORDER BY created_at DESC'
      : 'SELECT * FROM validity_alerts WHERE acknowledged_at IS NULL ORDER BY created_at DESC';
    const params = objectiveId ? [objectiveId] : [];

    const result = await pool.query(query, params);

    return result.rows.map(row => ({
      id: row.id,
      objectiveId: row.objective_id,
      alertType: row.alert_type as AlertType,
      severity: row.severity,
      title: row.title,
      details: row.details,
      evidenceIds: row.evidence_ids,
      createdAt: new Date(row.created_at),
      acknowledgedAt: row.acknowledged_at ? new Date(row.acknowledged_at) : undefined,
      acknowledgedBy: row.acknowledged_by ?? undefined,
    }));
  }

  /**
   * Acknowledge an alert
   */
  async acknowledgeAlert(alertId: string, acknowledgedBy: string): Promise<boolean> {
    await this.ensureInitialized();
    const pool = getPool();

    const result = await pool.query(`
      UPDATE validity_alerts SET acknowledged_at = NOW(), acknowledged_by = $2 WHERE id = $1
    `, [alertId, acknowledgedBy]);

    return (result.rowCount ?? 0) > 0;
  }

  /**
   * Get the latest validity score for an objective
   */
  async getLatestValidity(objectiveId: string): Promise<ValidityScore | null> {
    await this.ensureInitialized();
    const pool = getPool();

    const result = await pool.query(`
      SELECT * FROM validity_scores WHERE objective_id = $1 ORDER BY calculated_at DESC LIMIT 1
    `, [objectiveId]);

    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    return {
      id: row.id,
      objectiveId: row.objective_id,
      score: row.score,
      previousScore: row.previous_score ?? undefined,
      reasoning: row.reasoning,
      evidenceIds: row.evidence_ids,
      calculatedAt: new Date(row.calculated_at),
      calculatedBy: row.calculated_by,
    };
  }
}

// Singleton instance
export const validityService = new ValidityService();
