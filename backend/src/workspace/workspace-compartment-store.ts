/**
 * Workspace Compartment Store
 *
 * Manages workspace_compartments and workspace_member_compartments tables.
 * Compartments enforce need-to-know access beyond classification level.
 *
 * Example compartment names: 'SIGINT', 'HUMINT', 'OP-PLAN-X', 'CYBER'
 *
 * Phase 19 Plan 08: Org Tree + Member Directory + Compartment Manager
 */

import { randomUUID } from 'crypto';
import { getPool } from '../lib/database.js';
import type { WorkspaceCompartment } from './types.js';

// ─── Table Initialization ─────────────────────────────────────────────────────

async function initCompartmentTables(): Promise<void> {
  const pool = getPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS workspace_compartments (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      description TEXT,
      created_by TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(workspace_id, name)
    );
    CREATE INDEX IF NOT EXISTS idx_wc_workspace ON workspace_compartments(workspace_id);

    CREATE TABLE IF NOT EXISTS workspace_member_compartments (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      member_did TEXT NOT NULL,
      compartment_id TEXT NOT NULL REFERENCES workspace_compartments(id) ON DELETE CASCADE,
      assigned_by TEXT NOT NULL,
      assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(workspace_id, member_did, compartment_id)
    );
    CREATE INDEX IF NOT EXISTS idx_wmc_workspace ON workspace_member_compartments(workspace_id);
    CREATE INDEX IF NOT EXISTS idx_wmc_member ON workspace_member_compartments(member_did);
    CREATE INDEX IF NOT EXISTS idx_wmc_compartment ON workspace_member_compartments(compartment_id);
  `);
}

// ─── Row mappers ──────────────────────────────────────────────────────────────

interface CompartmentRow {
  id: string;
  workspace_id: string;
  name: string;
  description: string | null;
  created_by: string;
  created_at: Date;
}

function mapCompartment(row: CompartmentRow): WorkspaceCompartment {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    name: row.name,
    description: row.description,
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
}

// ─── Store Class ──────────────────────────────────────────────────────────────

export class WorkspaceCompartmentStore {
  private initialized = false;

  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await initCompartmentTables();
      this.initialized = true;
    }
  }

  /**
   * Create a new compartment in a workspace.
   * Compartment names must be unique per workspace.
   */
  async createCompartment(
    workspaceId: string,
    name: string,
    description: string | null,
    createdBy: string,
  ): Promise<WorkspaceCompartment> {
    await this.ensureInitialized();
    const pool = getPool();
    const id = `WC-${randomUUID()}`;

    const result = await pool.query<CompartmentRow>(
      `INSERT INTO workspace_compartments (id, workspace_id, name, description, created_by)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [id, workspaceId, name.trim().toUpperCase(), description, createdBy],
    );

    return mapCompartment(result.rows[0]);
  }

  /**
   * List all compartments for a workspace.
   */
  async listCompartments(workspaceId: string): Promise<WorkspaceCompartment[]> {
    await this.ensureInitialized();
    const pool = getPool();

    const result = await pool.query<CompartmentRow>(
      `SELECT * FROM workspace_compartments WHERE workspace_id = $1 ORDER BY name ASC`,
      [workspaceId],
    );

    return result.rows.map(mapCompartment);
  }

  /**
   * Get a compartment by ID.
   */
  async getCompartment(compartmentId: string): Promise<WorkspaceCompartment | null> {
    await this.ensureInitialized();
    const pool = getPool();

    const result = await pool.query<CompartmentRow>(
      `SELECT * FROM workspace_compartments WHERE id = $1`,
      [compartmentId],
    );

    return result.rows[0] ? mapCompartment(result.rows[0]) : null;
  }

  /**
   * Delete a compartment and all its member assignments (via CASCADE).
   */
  async deleteCompartment(compartmentId: string): Promise<void> {
    await this.ensureInitialized();
    const pool = getPool();

    await pool.query(
      `DELETE FROM workspace_compartments WHERE id = $1`,
      [compartmentId],
    );
  }

  /**
   * Assign a member to a compartment.
   * Idempotent — duplicate assignments are silently ignored.
   */
  async assignMember(
    workspaceId: string,
    memberDid: string,
    compartmentId: string,
    assignedBy: string,
  ): Promise<void> {
    await this.ensureInitialized();
    const pool = getPool();
    const id = `WMC-${randomUUID()}`;

    await pool.query(
      `INSERT INTO workspace_member_compartments
         (id, workspace_id, member_did, compartment_id, assigned_by)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (workspace_id, member_did, compartment_id) DO NOTHING`,
      [id, workspaceId, memberDid, compartmentId, assignedBy],
    );
  }

  /**
   * Remove a member from a compartment.
   */
  async removeMember(
    workspaceId: string,
    memberDid: string,
    compartmentId: string,
  ): Promise<void> {
    await this.ensureInitialized();
    const pool = getPool();

    await pool.query(
      `DELETE FROM workspace_member_compartments
       WHERE workspace_id = $1 AND member_did = $2 AND compartment_id = $3`,
      [workspaceId, memberDid, compartmentId],
    );
  }

  /**
   * List all members assigned to a specific compartment.
   * Returns DIDs of members in the compartment.
   */
  async listMembersInCompartment(compartmentId: string): Promise<string[]> {
    await this.ensureInitialized();
    const pool = getPool();

    const result = await pool.query<{ member_did: string }>(
      `SELECT member_did FROM workspace_member_compartments
       WHERE compartment_id = $1
       ORDER BY assigned_at ASC`,
      [compartmentId],
    );

    return result.rows.map((r) => r.member_did);
  }

  /**
   * List all compartment IDs that a member belongs to within a workspace.
   */
  async listCompartmentsForMember(
    workspaceId: string,
    memberDid: string,
  ): Promise<string[]> {
    await this.ensureInitialized();
    const pool = getPool();

    const result = await pool.query<{ compartment_id: string }>(
      `SELECT compartment_id FROM workspace_member_compartments
       WHERE workspace_id = $1 AND member_did = $2`,
      [workspaceId, memberDid],
    );

    return result.rows.map((r) => r.compartment_id);
  }

  /**
   * List compartments with their member DIDs for a workspace.
   * Useful for CompartmentManager display without extra round-trips.
   */
  async listCompartmentsWithMembers(
    workspaceId: string,
  ): Promise<Array<WorkspaceCompartment & { memberDids: string[] }>> {
    await this.ensureInitialized();
    const compartments = await this.listCompartments(workspaceId);

    const withMembers = await Promise.all(
      compartments.map(async (c) => {
        const memberDids = await this.listMembersInCompartment(c.id);
        return { ...c, memberDids };
      }),
    );

    return withMembers;
  }
}

export const workspaceCompartmentStore = new WorkspaceCompartmentStore();
