import { randomUUID } from 'crypto';
import { getPool } from '../../lib/database.js';
import type { Workspace, WorkspaceInput, WorkspaceStats, WorkspaceType } from './types.js';

export async function initWorkspaceTable(): Promise<void> {
  const pool = getPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS workspaces (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      type TEXT NOT NULL,
      parent_workspace_id TEXT REFERENCES workspaces(id),
      linked_workspace_ids TEXT[] NOT NULL DEFAULT '{}',
      tags TEXT[] NOT NULL DEFAULT '{}',
      classification TEXT NOT NULL DEFAULT 'SECRET',
      created_by TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      metadata JSONB NOT NULL DEFAULT '{}'
    );
    CREATE INDEX IF NOT EXISTS idx_workspace_type ON workspaces(type);
    CREATE INDEX IF NOT EXISTS idx_workspace_parent ON workspaces(parent_workspace_id);
  `);
}

export class WorkspaceStore {
  private initialized = false;

  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await initWorkspaceTable();
      this.initialized = true;
    }
  }

  async createWorkspace(input: WorkspaceInput, createdBy: string): Promise<Workspace> {
    await this.ensureInitialized();
    const pool = getPool();
    const id = `WKS-${randomUUID().slice(0, 8)}`;
    const now = new Date();

    await pool.query(`
      INSERT INTO workspaces (
        id, name, description, type, parent_workspace_id, linked_workspace_ids,
        tags, classification, created_by, created_at, updated_at, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
    `, [
      id, input.name, input.description, input.type, input.parentWorkspaceId || null,
      input.linkedWorkspaceIds, input.tags, input.classification, createdBy,
      now, now, JSON.stringify(input.metadata),
    ]);

    return {
      id,
      ...input,
      createdBy,
      createdAt: now,
      updatedAt: now,
    };
  }

  async getWorkspace(id: string): Promise<Workspace | null> {
    await this.ensureInitialized();
    const pool = getPool();
    const result = await pool.query('SELECT * FROM workspaces WHERE id = $1', [id]);
    if (result.rows.length === 0) return null;
    return this.rowToWorkspace(result.rows[0]);
  }

  async listWorkspaces(options: {
    type?: WorkspaceType;
    parentId?: string;
    classification?: string;
  } = {}): Promise<Workspace[]> {
    await this.ensureInitialized();
    const pool = getPool();

    const conditions: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (options.type) {
      conditions.push(`type = $${idx++}`);
      params.push(options.type);
    }
    if (options.parentId) {
      conditions.push(`parent_workspace_id = $${idx++}`);
      params.push(options.parentId);
    }
    if (options.classification) {
      conditions.push(`classification = $${idx++}`);
      params.push(options.classification);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const result = await pool.query(
      `SELECT * FROM workspaces ${where} ORDER BY name ASC`,
      params
    );

    return result.rows.map(row => this.rowToWorkspace(row));
  }

  async updateWorkspace(id: string, updates: Partial<WorkspaceInput>): Promise<boolean> {
    await this.ensureInitialized();
    const pool = getPool();

    const setClauses: string[] = ['updated_at = NOW()'];
    const params: unknown[] = [];
    let idx = 1;

    if (updates.name !== undefined) {
      setClauses.push(`name = $${idx++}`);
      params.push(updates.name);
    }
    if (updates.description !== undefined) {
      setClauses.push(`description = $${idx++}`);
      params.push(updates.description);
    }
    if (updates.linkedWorkspaceIds !== undefined) {
      setClauses.push(`linked_workspace_ids = $${idx++}`);
      params.push(updates.linkedWorkspaceIds);
    }
    if (updates.tags !== undefined) {
      setClauses.push(`tags = $${idx++}`);
      params.push(updates.tags);
    }
    if (updates.metadata !== undefined) {
      setClauses.push(`metadata = $${idx++}`);
      params.push(JSON.stringify(updates.metadata));
    }

    params.push(id);
    const result = await pool.query(
      `UPDATE workspaces SET ${setClauses.join(', ')} WHERE id = $${idx}`,
      params
    );

    return (result.rowCount ?? 0) > 0;
  }

  async deleteWorkspace(id: string): Promise<boolean> {
    await this.ensureInitialized();
    const pool = getPool();
    const result = await pool.query('DELETE FROM workspaces WHERE id = $1', [id]);
    return (result.rowCount ?? 0) > 0;
  }

  async getWorkspaceStats(workspaceId: string): Promise<WorkspaceStats> {
    await this.ensureInitialized();
    const pool = getPool();

    // Query counts from various tables (use workspace_id column where available)
    const [actors, objectives, events, alerts] = await Promise.all([
      pool.query("SELECT COUNT(*) FROM (SELECT 1 FROM information_schema.tables WHERE table_name = 'actors') t"),
      pool.query("SELECT COUNT(*) FROM strategic_objectives WHERE document_id IN (SELECT id FROM strategic_documents)"),
      pool.query("SELECT COUNT(*) FROM osint_events WHERE workspace_id = $1", [workspaceId]),
      pool.query("SELECT COUNT(*) FROM validity_alerts WHERE acknowledged_at IS NULL"),
    ]);

    // Note: Full stats require Neo4j queries for actors/relationships/tensions
    // Simplified version using available PostgreSQL data

    return {
      actorCount: 0, // Would need Neo4j query
      relationshipCount: 0, // Would need Neo4j query
      tensionCount: 0, // Would need Neo4j query
      objectiveCount: parseInt(objectives.rows[0]?.count || '0', 10),
      eventCount: parseInt(events.rows[0]?.count || '0', 10),
      alertCount: parseInt(alerts.rows[0]?.count || '0', 10),
    };
  }

  async getChildWorkspaces(parentId: string): Promise<Workspace[]> {
    await this.ensureInitialized();
    const pool = getPool();
    const result = await pool.query(
      'SELECT * FROM workspaces WHERE parent_workspace_id = $1 ORDER BY name ASC',
      [parentId]
    );
    return result.rows.map(row => this.rowToWorkspace(row));
  }

  async getLinkedWorkspaces(workspaceId: string): Promise<Workspace[]> {
    await this.ensureInitialized();
    const workspace = await this.getWorkspace(workspaceId);
    if (!workspace || workspace.linkedWorkspaceIds.length === 0) return [];

    const pool = getPool();
    const result = await pool.query(
      `SELECT * FROM workspaces WHERE id = ANY($1)`,
      [workspace.linkedWorkspaceIds]
    );
    return result.rows.map(row => this.rowToWorkspace(row));
  }

  private rowToWorkspace(row: Record<string, unknown>): Workspace {
    return {
      id: row.id as string,
      name: row.name as string,
      description: row.description as string,
      type: row.type as WorkspaceType,
      parentWorkspaceId: row.parent_workspace_id as string | undefined,
      linkedWorkspaceIds: row.linked_workspace_ids as string[],
      tags: row.tags as string[],
      classification: row.classification as Workspace['classification'],
      createdBy: row.created_by as string,
      createdAt: new Date(row.created_at as string),
      updatedAt: new Date(row.updated_at as string),
      metadata: row.metadata as Record<string, unknown>,
    };
  }
}

export const workspaceStore = new WorkspaceStore();
