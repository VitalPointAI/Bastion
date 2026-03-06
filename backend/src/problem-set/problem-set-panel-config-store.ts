/**
 * Problem Set Panel Config Store
 *
 * Phase 23: Problem Set Model & Workspace Rename
 *
 * Manages per-problem-set panel visibility configuration — which tabs each role can see.
 * Default templates are derived from doctrinal echelon conventions and are
 * auto-populated on first access via getOrCreateDefault().
 *
 * Table: problem_set_panel_config
 * ID format: PPC-{uuid}
 */

import { randomUUID } from 'crypto';
import { getPool } from '../lib/database.js';

// ============================================================================
// Default Visibility Templates
// ============================================================================

/**
 * Default tab visibility by echelon and role.
 * strategic = theater/combatant command focus (Design/Decide prominent)
 * operational = corps/division focus (Campaign/Monitor prominent)
 * tactical = brigade/battalion focus (Train/Campaign prominent)
 */
const DEFAULT_VISIBILITY_BY_ECHELON: Record<string, Record<string, string[]>> = {
  strategic: {
    commander: ['overview', 'decide', 'design', 'campaign', 'monitor', 'train'],
    xo: ['overview', 'decide', 'design', 'campaign', 'monitor', 'train'],
    s2: ['overview', 'decide', 'monitor'],
    s3: ['overview', 'decide', 'design', 'campaign'],
    s4: ['overview', 'campaign'],
    s5: ['overview', 'decide', 'design', 'campaign'],
    member: ['overview', 'monitor'],
    observer: ['overview'],
  },
  operational: {
    commander: ['overview', 'decide', 'design', 'campaign', 'monitor', 'train'],
    xo: ['overview', 'decide', 'campaign', 'monitor', 'train'],
    s2: ['overview', 'monitor'],
    s3: ['overview', 'decide', 'campaign', 'monitor'],
    s4: ['overview', 'campaign'],
    s5: ['overview', 'campaign'],
    member: ['overview', 'campaign', 'train'],
    observer: ['overview'],
  },
  tactical: {
    commander: ['overview', 'decide', 'design', 'campaign', 'monitor', 'train'],
    xo: ['overview', 'decide', 'campaign', 'train'],
    s2: ['overview', 'monitor'],
    s3: ['overview', 'campaign', 'train'],
    s4: ['overview', 'campaign'],
    s5: ['overview', 'campaign', 'train'],
    member: ['overview', 'campaign', 'train'],
    observer: ['overview'],
  },
};

// ============================================================================
// Table Initialization
// ============================================================================

async function initProblemSetPanelConfigTable(): Promise<void> {
  const pool = getPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS problem_set_panel_config (
      id TEXT PRIMARY KEY,
      problem_set_id TEXT NOT NULL UNIQUE REFERENCES problem_sets(id) ON DELETE CASCADE,
      panel_visibility JSONB NOT NULL DEFAULT '{}',
      default_tab TEXT NOT NULL DEFAULT 'overview',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_ppc_problem_set ON problem_set_panel_config(problem_set_id);
  `);
}

// ============================================================================
// Types
// ============================================================================

export interface PanelConfig {
  id: string;
  problemSetId: string;
  panelVisibility: Record<string, string[]>;
  defaultTab: string;
  createdAt: Date;
  updatedAt: Date;
}

interface PanelConfigRow {
  id: string;
  problem_set_id: string;
  panel_visibility: Record<string, string[]>;
  default_tab: string;
  created_at: Date;
  updated_at: Date;
}

// ============================================================================
// Problem Set Panel Config Store
// ============================================================================

export class ProblemSetPanelConfigStore {
  private initialized = false;

  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await initProblemSetPanelConfigTable();
      this.initialized = true;
    }
  }

  private mapRow(row: PanelConfigRow): PanelConfig {
    return {
      id: row.id,
      problemSetId: row.problem_set_id,
      panelVisibility: row.panel_visibility,
      defaultTab: row.default_tab,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  /**
   * Get panel config for a problem set. Returns null if no config has been set.
   */
  async getConfig(problemSetId: string): Promise<PanelConfig | null> {
    await this.ensureInitialized();
    const pool = getPool();

    const result = await pool.query(
      'SELECT * FROM problem_set_panel_config WHERE problem_set_id = $1',
      [problemSetId],
    );

    if (result.rows.length === 0) return null;
    return this.mapRow(result.rows[0] as PanelConfigRow);
  }

  /**
   * Create or update panel visibility config for a problem set.
   * On conflict (same problem_set_id), updates panel_visibility, default_tab, and updated_at.
   */
  async upsertConfig(
    problemSetId: string,
    panelVisibility: Record<string, string[]>,
    defaultTab = 'overview',
  ): Promise<PanelConfig> {
    await this.ensureInitialized();
    const pool = getPool();

    const id = `PPC-${randomUUID()}`;
    const now = new Date();

    const result = await pool.query(
      `
      INSERT INTO problem_set_panel_config (id, problem_set_id, panel_visibility, default_tab, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (problem_set_id) DO UPDATE SET
        panel_visibility = EXCLUDED.panel_visibility,
        default_tab = EXCLUDED.default_tab,
        updated_at = EXCLUDED.updated_at
      RETURNING *
      `,
      [id, problemSetId, JSON.stringify(panelVisibility), defaultTab, now, now],
    );

    return this.mapRow(result.rows[0] as PanelConfigRow);
  }

  /**
   * Return existing config, or create default visibility for the echelon.
   * Echelon defaults:
   *   - strategic    -> default_tab 'design'
   *   - operational  -> default_tab 'campaign'
   *   - tactical     -> default_tab 'train'
   */
  async getOrCreateDefault(problemSetId: string, echelon: string): Promise<PanelConfig> {
    const existing = await this.getConfig(problemSetId);
    if (existing) return existing;

    const visibility =
      DEFAULT_VISIBILITY_BY_ECHELON[echelon] ?? DEFAULT_VISIBILITY_BY_ECHELON['tactical'];

    const defaultTabByEchelon: Record<string, string> = {
      strategic: 'design',
      operational: 'campaign',
      tactical: 'train',
    };
    const defaultTab = defaultTabByEchelon[echelon] ?? 'overview';

    return this.upsertConfig(problemSetId, visibility, defaultTab);
  }

  /**
   * Delete panel config for a problem set. No-op if config does not exist.
   */
  async deleteConfig(problemSetId: string): Promise<void> {
    await this.ensureInitialized();
    const pool = getPool();

    await pool.query('DELETE FROM problem_set_panel_config WHERE problem_set_id = $1', [problemSetId]);
  }
}

// Singleton export
export const problemSetPanelConfigStore = new ProblemSetPanelConfigStore();
