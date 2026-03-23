/**
 * Design Interview Store
 *
 * Phase 55 Plan 01: PostgreSQL persistence for design interview section progress.
 * Tracks which sections have been confirmed via the guided design interview.
 *
 * Uses the existing getPool() database connection.
 * Creates design_interview_progress table on demand (same pattern as other stores).
 */

import { getPool } from '../lib/database.js';
import type { DesignInterviewSection } from './design-interview-types.js';

// ============================================================================
// Types
// ============================================================================

export interface SectionProgress {
  section: DesignInterviewSection;
  confirmed: boolean;
  confirmedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface InterviewProgress {
  problemSetId: string;
  sections: Record<string, SectionProgress>;
}

// ============================================================================
// DDL: Ensure table exists
// ============================================================================

let tableEnsured = false;

async function ensureTable(): Promise<void> {
  if (tableEnsured) return;

  const pool = getPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS design_interview_progress (
      problem_set_id  TEXT        NOT NULL,
      section         TEXT        NOT NULL,
      confirmed       BOOLEAN     NOT NULL DEFAULT FALSE,
      confirmed_at    TIMESTAMPTZ,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (problem_set_id, section)
    )
  `);

  tableEnsured = true;
}

// ============================================================================
// DesignInterviewStore
// ============================================================================

export class DesignInterviewStore {
  /**
   * Save or update interview progress for a section.
   * Upserts on (problem_set_id, section).
   */
  async saveInterviewProgress(
    problemSetId: string,
    section: DesignInterviewSection,
    confirmed: boolean,
  ): Promise<void> {
    await ensureTable();
    const pool = getPool();

    await pool.query(
      `INSERT INTO design_interview_progress
         (problem_set_id, section, confirmed, confirmed_at, updated_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (problem_set_id, section) DO UPDATE SET
         confirmed   = EXCLUDED.confirmed,
         confirmed_at = CASE
           WHEN EXCLUDED.confirmed = TRUE AND design_interview_progress.confirmed_at IS NULL
           THEN NOW()
           ELSE design_interview_progress.confirmed_at
         END,
         updated_at  = NOW()`,
      [problemSetId, section, confirmed, confirmed ? new Date().toISOString() : null],
    );
  }

  /**
   * Get section confirmation status for a problem set.
   * Returns a map of section → progress.
   */
  async getInterviewProgress(problemSetId: string): Promise<InterviewProgress> {
    await ensureTable();
    const pool = getPool();

    const result = await pool.query(
      `SELECT section, confirmed, confirmed_at, created_at, updated_at
       FROM design_interview_progress
       WHERE problem_set_id = $1
       ORDER BY section`,
      [problemSetId],
    );

    const sections: Record<string, SectionProgress> = {};
    for (const row of result.rows) {
      sections[row.section as string] = {
        section: row.section as DesignInterviewSection,
        confirmed: row.confirmed as boolean,
        confirmedAt: row.confirmed_at ? (row.confirmed_at as Date).toISOString() : null,
        createdAt: (row.created_at as Date).toISOString(),
        updatedAt: (row.updated_at as Date).toISOString(),
      };
    }

    return { problemSetId, sections };
  }

  /**
   * Mark a section as confirmed (reviewed by user).
   */
  async markSectionConfirmed(
    problemSetId: string,
    section: DesignInterviewSection,
  ): Promise<void> {
    await this.saveInterviewProgress(problemSetId, section, true);
  }

  /**
   * Convenience wrapper — returns full interview progress.
   * Alias for getInterviewProgress for API clarity.
   */
  async getDesignInterviewState(problemSetId: string): Promise<InterviewProgress> {
    return this.getInterviewProgress(problemSetId);
  }

  /**
   * Reset interview progress for a problem set.
   * Used when starting fresh (resetInterview).
   */
  async resetProgress(problemSetId: string): Promise<void> {
    await ensureTable();
    const pool = getPool();

    await pool.query(
      `DELETE FROM design_interview_progress WHERE problem_set_id = $1`,
      [problemSetId],
    );
  }
}

/** Singleton instance */
let storeInstance: DesignInterviewStore | null = null;

export function getDesignInterviewStore(): DesignInterviewStore {
  if (!storeInstance) {
    storeInstance = new DesignInterviewStore();
  }
  return storeInstance;
}
