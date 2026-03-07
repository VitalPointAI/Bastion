/**
 * Resource Group Store
 *
 * Phase 27 Plan 03: CRUD for resource groups (units, formations, task forces).
 * Groups aggregate capability tags from their member resources.
 * Aggregate capabilities auto-update on membership changes.
 */

import { randomUUID } from 'crypto';
import { getPool } from '../lib/database.js';
import { initResourceTable } from './resource-store.js';
import type { Resource, ResourceGroup } from './types.js';

/**
 * ResourceGroupStore — manages resource group lifecycle and membership.
 *
 * Groups organize resources into military units, formations, or task forces.
 * Aggregate capabilities are computed from member resources via batch SQL.
 */
export class ResourceGroupStore {
  private initialized = false;

  /**
   * Ensure tables exist. Reuses initResourceTable which creates resource_groups.
   */
  private async ensureInitialized(): Promise<void> {
    if (this.initialized) return;
    await initResourceTable();
    this.initialized = true;
  }

  /**
   * Create a new resource group.
   */
  async createGroup(
    missionId: string,
    name: string,
    groupType: string,
    description?: string,
    parentGroupId?: string
  ): Promise<ResourceGroup> {
    await this.ensureInitialized();
    const pool = getPool();
    const id = `GRP-${randomUUID()}`;
    const now = new Date();

    await pool.query(
      `INSERT INTO resource_groups (id, mission_id, name, description, group_type, parent_group_id, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [id, missionId, name, description || null, groupType, parentGroupId || null, now, now]
    );

    return {
      id,
      missionId,
      name,
      description,
      groupType: groupType as ResourceGroup['groupType'],
      parentGroupId,
      aggregateCapabilities: [],
      createdAt: now,
      updatedAt: now,
    };
  }

  /**
   * Get a group by ID.
   */
  async getGroup(id: string): Promise<ResourceGroup | null> {
    await this.ensureInitialized();
    const pool = getPool();
    const result = await pool.query('SELECT * FROM resource_groups WHERE id = $1', [id]);
    if (result.rows.length === 0) return null;
    return this.rowToGroup(result.rows[0]);
  }

  /**
   * List all groups for a mission.
   */
  async listGroups(missionId: string): Promise<ResourceGroup[]> {
    await this.ensureInitialized();
    const pool = getPool();
    const result = await pool.query(
      'SELECT * FROM resource_groups WHERE mission_id = $1 ORDER BY name ASC',
      [missionId]
    );
    return result.rows.map((row: Record<string, unknown>) => this.rowToGroup(row));
  }

  /**
   * Get all resources that belong to a group (batch query, not N+1).
   */
  async getGroupMembers(groupId: string): Promise<Resource[]> {
    await this.ensureInitialized();
    const pool = getPool();
    const result = await pool.query(
      'SELECT * FROM resources WHERE group_id = $1 ORDER BY name ASC',
      [groupId]
    );
    return result.rows.map((row: Record<string, unknown>) => this.rowToResource(row));
  }

  /**
   * Add a resource to a group and refresh aggregate capabilities.
   */
  async addToGroup(resourceId: string, groupId: string): Promise<void> {
    await this.ensureInitialized();
    const pool = getPool();
    await pool.query(
      'UPDATE resources SET group_id = $1, updated_at = NOW() WHERE id = $2',
      [groupId, resourceId]
    );
    await this.updateAggregateCapabilities(groupId);
  }

  /**
   * Remove a resource from its group and refresh aggregate capabilities.
   */
  async removeFromGroup(resourceId: string): Promise<void> {
    await this.ensureInitialized();
    const pool = getPool();

    // Get current group before removal
    const current = await pool.query('SELECT group_id FROM resources WHERE id = $1', [resourceId]);
    const oldGroupId = current.rows[0]?.group_id;

    await pool.query(
      'UPDATE resources SET group_id = NULL, updated_at = NOW() WHERE id = $1',
      [resourceId]
    );

    if (oldGroupId) {
      await this.updateAggregateCapabilities(oldGroupId);
    }
  }

  /**
   * Recompute aggregate capabilities for a group from its members.
   * Uses batch SQL with unnest for efficiency.
   */
  async updateAggregateCapabilities(groupId: string): Promise<void> {
    const pool = getPool();

    const result = await pool.query(
      `SELECT DISTINCT unnest(capabilities) AS cap FROM resources WHERE group_id = $1`,
      [groupId]
    );

    const caps = result.rows.map((row: { cap: string }) => row.cap);
    await pool.query(
      'UPDATE resource_groups SET aggregate_capabilities = $1, updated_at = NOW() WHERE id = $2',
      [caps, groupId]
    );
  }

  /**
   * Get a group with its member count.
   */
  async getGroupWithMemberCount(groupId: string): Promise<(ResourceGroup & { memberCount: number }) | null> {
    await this.ensureInitialized();
    const pool = getPool();

    const result = await pool.query(
      `SELECT g.*, COALESCE(m.cnt, 0)::int AS member_count
       FROM resource_groups g
       LEFT JOIN (SELECT group_id, COUNT(*) AS cnt FROM resources GROUP BY group_id) m
         ON m.group_id = g.id
       WHERE g.id = $1`,
      [groupId]
    );

    if (result.rows.length === 0) return null;
    const row = result.rows[0];
    return {
      ...this.rowToGroup(row),
      memberCount: row.member_count,
    };
  }

  /**
   * Delete a group. Unassigns all members first.
   */
  async deleteGroup(id: string): Promise<boolean> {
    await this.ensureInitialized();
    const pool = getPool();

    // Unassign all members
    await pool.query('UPDATE resources SET group_id = NULL WHERE group_id = $1', [id]);

    // Delete the group
    const result = await pool.query('DELETE FROM resource_groups WHERE id = $1', [id]);
    return result.rowCount !== null && result.rowCount > 0;
  }

  /**
   * Convert DB row to ResourceGroup (snake_case -> camelCase).
   */
  private rowToGroup(row: Record<string, unknown>): ResourceGroup {
    return {
      id: row.id as string,
      missionId: row.mission_id as string,
      name: row.name as string,
      description: row.description as string | undefined,
      groupType: row.group_type as ResourceGroup['groupType'],
      parentGroupId: row.parent_group_id as string | undefined,
      aggregateCapabilities: (row.aggregate_capabilities as string[]) ?? [],
      createdAt: new Date(row.created_at as string),
      updatedAt: new Date(row.updated_at as string),
    };
  }

  /**
   * Convert DB row to Resource (reuses same mapping as ResourceStore).
   */
  private rowToResource(row: Record<string, unknown>): Resource {
    const specs = row.specifications;
    return {
      id: row.id as string,
      missionId: row.mission_id as string,
      name: row.name as string,
      category: row.category as Resource['category'],
      serialNumber: row.serial_number as string | undefined,
      sidc: row.sidc as string | undefined,
      status: row.status as Resource['status'],
      specifications: typeof specs === 'string' ? JSON.parse(specs) : (specs as Record<string, unknown>),
      location:
        row.location_lat != null && row.location_lng != null
          ? { lat: row.location_lat as number, lng: row.location_lng as number }
          : undefined,
      did: row.did as string | undefined,
      blindedKey: row.blinded_key as string | undefined,
      publicKey: row.public_key as string | undefined,
      isAutonomous: (row.is_autonomous as boolean) ?? false,
      capabilities: (row.capabilities as string[]) ?? [],
      groupId: row.group_id as string | undefined,
      createdAt: new Date(row.created_at as string),
      updatedAt: row.updated_at ? new Date(row.updated_at as string) : new Date(row.created_at as string),
    };
  }
}

/** Singleton instance */
export const resourceGroupStore = new ResourceGroupStore();
