import { randomUUID } from 'crypto';
import { getPool } from '../../lib/database.js';
import type { Workspace, WorkspaceInput, WorkspaceStats, WorkspaceType } from './types.js';

export async function initWorkspaceTable(): Promise<void> {
  const pool = getPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS graph_problem_sets (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      echelon TEXT NOT NULL,
      parent_problem_set_id TEXT,
      linked_problem_set_ids TEXT[] NOT NULL DEFAULT '{}',
      tags TEXT[] NOT NULL DEFAULT '{}',
      classification TEXT NOT NULL DEFAULT 'SECRET',
      created_by TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      metadata JSONB NOT NULL DEFAULT '{}'
    );
    CREATE INDEX IF NOT EXISTS idx_graph_problem_set_echelon ON graph_problem_sets(echelon);
    CREATE INDEX IF NOT EXISTS idx_graph_problem_set_parent ON graph_problem_sets(parent_problem_set_id);
    CREATE INDEX IF NOT EXISTS idx_graph_problem_set_classification ON graph_problem_sets(classification);
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
    const id = `GPS-${randomUUID().slice(0, 8)}`;
    const now = new Date();

    await pool.query(`
      INSERT INTO graph_problem_sets (
        id, name, description, echelon, parent_problem_set_id, linked_problem_set_ids,
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
    const result = await pool.query('SELECT * FROM graph_problem_sets WHERE id = $1', [id]);
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
      conditions.push(`echelon = $${idx++}`);
      params.push(options.type);
    }
    if (options.parentId) {
      conditions.push(`parent_problem_set_id = $${idx++}`);
      params.push(options.parentId);
    }
    if (options.classification) {
      conditions.push(`classification = $${idx++}`);
      params.push(options.classification);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const result = await pool.query(
      `SELECT * FROM graph_problem_sets ${where} ORDER BY name ASC`,
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
      setClauses.push(`linked_problem_set_ids = $${idx++}`);
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
      `UPDATE graph_problem_sets SET ${setClauses.join(', ')} WHERE id = $${idx}`,
      params
    );

    return (result.rowCount ?? 0) > 0;
  }

  async deleteWorkspace(id: string): Promise<boolean> {
    await this.ensureInitialized();
    const pool = getPool();
    const result = await pool.query('DELETE FROM graph_problem_sets WHERE id = $1', [id]);
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
      'SELECT * FROM graph_problem_sets WHERE parent_problem_set_id = $1 ORDER BY name ASC',
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
      `SELECT * FROM graph_problem_sets WHERE id = ANY($1)`,
      [workspace.linkedWorkspaceIds]
    );
    return result.rows.map(row => this.rowToWorkspace(row));
  }

  private rowToWorkspace(row: Record<string, unknown>): Workspace {
    return {
      id: row.id as string,
      name: row.name as string,
      description: row.description as string,
      type: row.echelon as WorkspaceType,
      parentWorkspaceId: (row.parent_problem_set_id as string | undefined),
      linkedWorkspaceIds: (row.linked_problem_set_ids as string[]),
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
