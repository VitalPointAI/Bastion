/**
 * Problem Set Panel Config Store
 *
 * Phase 24: Doctrinal Tab Restructure
 * (Originally Phase 23: Problem Set Model & Workspace Rename)
 *
 * Manages per-problem-set panel visibility configuration — which tabs each role can see.
 * Default templates use the JP 5-0 doctrinal lifecycle tabs:
 *   Understand -> Design -> Plan -> Direct -> COP -> Assess
 *
 * All roles see all 6 tabs by default (per user decision).
 * Default tab for all echelons is 'cop'.
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
 * The 6 doctrinal lifecycle tabs (JP 5-0 aligned).
 * Phase 24: All roles see all tabs — no per-role restrictions.
 */
const ALL_DOCTRINAL_TABS = ['understand', 'design', 'plan', 'direct', 'cop', 'assess', 'resources'];

const DEFAULT_VISIBILITY_BY_ECHELON: Record<string, Record<string, string[]>> = {
  strategic: {
    commander: ALL_DOCTRINAL_TABS,
    xo: ALL_DOCTRINAL_TABS,
    s2: ALL_DOCTRINAL_TABS,
    s3: ALL_DOCTRINAL_TABS,
    s4: ALL_DOCTRINAL_TABS,
    s5: ALL_DOCTRINAL_TABS,
    member: ALL_DOCTRINAL_TABS,
    observer: ALL_DOCTRINAL_TABS,
  },
  operational: {
    commander: ALL_DOCTRINAL_TABS,
    xo: ALL_DOCTRINAL_TABS,
    s2: ALL_DOCTRINAL_TABS,
    s3: ALL_DOCTRINAL_TABS,
    s4: ALL_DOCTRINAL_TABS,
    s5: ALL_DOCTRINAL_TABS,
    member: ALL_DOCTRINAL_TABS,
    observer: ALL_DOCTRINAL_TABS,
  },
  tactical: {
    commander: ALL_DOCTRINAL_TABS,
    xo: ALL_DOCTRINAL_TABS,
    s2: ALL_DOCTRINAL_TABS,
    s3: ALL_DOCTRINAL_TABS,
    s4: ALL_DOCTRINAL_TABS,
    s5: ALL_DOCTRINAL_TABS,
    member: ALL_DOCTRINAL_TABS,
    observer: ALL_DOCTRINAL_TABS,
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
      default_tab TEXT NOT NULL DEFAULT 'cop',
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
    defaultTab = 'cop',
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
   * Phase 24: All echelons default to 'cop' tab.
   */
  async getOrCreateDefault(problemSetId: string, echelon: string): Promise<PanelConfig> {
    const existing = await this.getConfig(problemSetId);
    if (existing) {
      // Backfill: ensure all doctrinal tabs are present in each role's visibility list.
      // Handles configs created before new tabs (e.g. 'resources') were added.
      let patched = false;
      const vis = { ...existing.panelVisibility };
      for (const [role, tabs] of Object.entries(vis)) {
        const missing = ALL_DOCTRINAL_TABS.filter(t => !tabs.includes(t));
        if (missing.length > 0) {
          vis[role] = [...tabs, ...missing];
          patched = true;
        }
      }
      if (patched) {
        return this.upsertConfig(problemSetId, vis, existing.defaultTab);
      }
      return existing;
    }

    const visibility =
      DEFAULT_VISIBILITY_BY_ECHELON[echelon] ?? DEFAULT_VISIBILITY_BY_ECHELON['tactical'];

    // Phase 24: All echelons default to COP tab
    return this.upsertConfig(problemSetId, visibility, 'cop');
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
