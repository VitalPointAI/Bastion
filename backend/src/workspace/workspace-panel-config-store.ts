/**
 * Workspace Panel Config Store
 *
 * Phase 20: Workspace Operational Panels & Cross-Workspace Intelligence Sharing
 *
 * Manages per-workspace panel visibility configuration — which tabs each role can see.
 * Default templates are derived from doctrinal workspace type conventions and are
 * auto-populated on first access via getOrCreateDefault().
 *
 * Table: workspace_panel_config
 * ID format: WPC-{uuid}
 */

import { randomUUID } from 'crypto';
import { getPool } from '../lib/database.js';

// ============================================================================
// Default Visibility Templates
// ============================================================================

/**
 * Default tab visibility by workspace type and role.
 * Organization = strategic focus (Design/Decide prominent)
 * Unit = operational focus (Campaign/Monitor prominent)
 * Team = tactical focus (Train/Campaign prominent)
 */
const DEFAULT_VISIBILITY_BY_TYPE: Record<string, Record<string, string[]>> = {
  Organization: {
    commander: ['overview', 'decide', 'design', 'campaign', 'monitor', 'train'],
    xo: ['overview', 'decide', 'design', 'campaign', 'monitor', 'train'],
    s2: ['overview', 'decide', 'monitor'],
    s3: ['overview', 'decide', 'design', 'campaign'],
    s4: ['overview', 'campaign'],
    s5: ['overview', 'decide', 'design', 'campaign'],
    member: ['overview', 'monitor'],
    observer: ['overview'],
  },
  Unit: {
    commander: ['overview', 'decide', 'design', 'campaign', 'monitor', 'train'],
    xo: ['overview', 'decide', 'campaign', 'monitor', 'train'],
    s2: ['overview', 'monitor'],
    s3: ['overview', 'decide', 'campaign', 'monitor'],
    s4: ['overview', 'campaign'],
    s5: ['overview', 'campaign'],
    member: ['overview', 'campaign', 'train'],
    observer: ['overview'],
  },
  Team: {
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

async function initWorkspacePanelConfigTable(): Promise<void> {
  const pool = getPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS workspace_panel_config (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL UNIQUE REFERENCES workspaces(id) ON DELETE CASCADE,
      panel_visibility JSONB NOT NULL DEFAULT '{}',
      default_tab TEXT NOT NULL DEFAULT 'overview',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_wpc_workspace ON workspace_panel_config(workspace_id);
  `);
}

// ============================================================================
// Types
// ============================================================================

export interface PanelConfig {
  id: string;
  workspaceId: string;
  panelVisibility: Record<string, string[]>;
  defaultTab: string;
  createdAt: Date;
  updatedAt: Date;
}

interface PanelConfigRow {
  id: string;
  workspace_id: string;
  panel_visibility: Record<string, string[]>;
  default_tab: string;
  created_at: Date;
  updated_at: Date;
}

// ============================================================================
// Workspace Panel Config Store
// ============================================================================

export class WorkspacePanelConfigStore {
  private initialized = false;

  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await initWorkspacePanelConfigTable();
      this.initialized = true;
    }
  }

  private mapRow(row: PanelConfigRow): PanelConfig {
    return {
      id: row.id,
      workspaceId: row.workspace_id,
      panelVisibility: row.panel_visibility,
      defaultTab: row.default_tab,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  /**
   * Get panel config for a workspace. Returns null if no config has been set.
   */
  async getConfig(workspaceId: string): Promise<PanelConfig | null> {
    await this.ensureInitialized();
    const pool = getPool();

    const result = await pool.query(
      'SELECT * FROM workspace_panel_config WHERE workspace_id = $1',
      [workspaceId],
    );

    if (result.rows.length === 0) return null;
    return this.mapRow(result.rows[0] as PanelConfigRow);
  }

  /**
   * Create or update panel visibility config for a workspace.
   * On conflict (same workspace_id), updates panel_visibility, default_tab, and updated_at.
   */
  async upsertConfig(
    workspaceId: string,
    panelVisibility: Record<string, string[]>,
    defaultTab = 'overview',
  ): Promise<PanelConfig> {
    await this.ensureInitialized();
    const pool = getPool();

    const id = `WPC-${randomUUID()}`;
    const now = new Date();

    const result = await pool.query(
      `
      INSERT INTO workspace_panel_config (id, workspace_id, panel_visibility, default_tab, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (workspace_id) DO UPDATE SET
        panel_visibility = EXCLUDED.panel_visibility,
        default_tab = EXCLUDED.default_tab,
        updated_at = EXCLUDED.updated_at
      RETURNING *
      `,
      [id, workspaceId, JSON.stringify(panelVisibility), defaultTab, now, now],
    );

    return this.mapRow(result.rows[0] as PanelConfigRow);
  }

  /**
   * Return existing config, or create default visibility for the workspace type.
   * Workspace type defaults:
   *   - Organization → default_tab 'design'
   *   - Unit         → default_tab 'campaign'
   *   - Team         → default_tab 'train'
   */
  async getOrCreateDefault(workspaceId: string, workspaceType: string): Promise<PanelConfig> {
    const existing = await this.getConfig(workspaceId);
    if (existing) return existing;

    const visibility =
      DEFAULT_VISIBILITY_BY_TYPE[workspaceType] ?? DEFAULT_VISIBILITY_BY_TYPE['Team'];

    const defaultTabByType: Record<string, string> = {
      Organization: 'design',
      Unit: 'campaign',
      Team: 'train',
    };
    const defaultTab = defaultTabByType[workspaceType] ?? 'overview';

    return this.upsertConfig(workspaceId, visibility, defaultTab);
  }

  /**
   * Delete panel config for a workspace. No-op if config does not exist.
   */
  async deleteConfig(workspaceId: string): Promise<void> {
    await this.ensureInitialized();
    const pool = getPool();

    await pool.query('DELETE FROM workspace_panel_config WHERE workspace_id = $1', [workspaceId]);
  }
}

// Singleton export
export const workspacePanelConfigStore = new WorkspacePanelConfigStore();
