/**
 * Command Relationship Store
 *
 * Phase 4.4 Plan 01: Command relationship management with hierarchy queries
 */

import { randomUUID } from 'crypto';
import { getPool } from '../lib/database.js';
import type { CommandRelationship, RelationshipType } from './types.js';

export async function initRelationshipTable(): Promise<void> {
  const pool = getPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS command_relationships (
      id TEXT PRIMARY KEY,
      mission_id TEXT NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
      superior_unit_id TEXT NOT NULL REFERENCES units(id) ON DELETE CASCADE,
      subordinate_unit_id TEXT NOT NULL REFERENCES units(id) ON DELETE CASCADE,
      relationship_type TEXT NOT NULL,
      effective_from TIMESTAMPTZ,
      effective_to TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(mission_id, superior_unit_id, subordinate_unit_id, relationship_type)
    );
    CREATE INDEX IF NOT EXISTS idx_relationship_mission ON command_relationships(mission_id);
    CREATE INDEX IF NOT EXISTS idx_relationship_superior ON command_relationships(superior_unit_id);
    CREATE INDEX IF NOT EXISTS idx_relationship_subordinate ON command_relationships(subordinate_unit_id);
  `);
}

export class RelationshipStore {
  private initialized = false;

  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await initRelationshipTable();
      this.initialized = true;
    }
  }

  /**
   * Create a command relationship with cycle detection
   */
  async createRelationship(
    missionId: string,
    superiorUnitId: string,
    subordinateUnitId: string,
    relationshipType: RelationshipType,
    effectiveFrom?: Date,
    effectiveTo?: Date
  ): Promise<CommandRelationship> {
    await this.ensureInitialized();

    // Prevent self-referential relationships
    if (superiorUnitId === subordinateUnitId) {
      throw new Error('Unit cannot have a relationship with itself');
    }

    // Check for cycles
    const hasCycle = await this.validateNoCycle(
      missionId,
      superiorUnitId,
      subordinateUnitId
    );
    if (hasCycle) {
      throw new Error('Relationship would create a cycle in the hierarchy');
    }

    const pool = getPool();
    const id = `REL-${randomUUID()}`;
    const now = new Date();

    await pool.query(
      `
      INSERT INTO command_relationships (
        id, mission_id, superior_unit_id, subordinate_unit_id,
        relationship_type, effective_from, effective_to, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `,
      [
        id,
        missionId,
        superiorUnitId,
        subordinateUnitId,
        relationshipType,
        effectiveFrom || null,
        effectiveTo || null,
        now,
      ]
    );

    return {
      id,
      missionId,
      superiorUnitId,
      subordinateUnitId,
      relationshipType,
      effectiveFrom,
      effectiveTo,
      createdAt: now,
    };
  }

  /**
   * Validate that adding a relationship won't create a cycle
   *
   * Uses depth-first search to detect cycles
   */
  async validateNoCycle(
    missionId: string,
    superiorUnitId: string,
    subordinateUnitId: string
  ): Promise<boolean> {
    await this.ensureInitialized();
    const pool = getPool();

    // Check if subordinate is an ancestor of superior (would create cycle)
    // Using recursive CTE to traverse hierarchy
    const result = await pool.query(
      `
      WITH RECURSIVE ancestors AS (
        -- Base case: direct superiors of the proposed superior unit
        SELECT superior_unit_id
        FROM command_relationships
        WHERE mission_id = $1
          AND subordinate_unit_id = $2

        UNION

        -- Recursive case: traverse up the hierarchy
        SELECT cr.superior_unit_id
        FROM command_relationships cr
        INNER JOIN ancestors a ON cr.subordinate_unit_id = a.superior_unit_id
        WHERE cr.mission_id = $1
      )
      SELECT 1 FROM ancestors WHERE superior_unit_id = $3
    `,
      [missionId, superiorUnitId, subordinateUnitId]
    );

    return result.rows.length > 0;
  }

  /**
   * Get hierarchy for a mission using recursive CTE
   *
   * Returns all relationships in the mission's command structure
   */
  async getHierarchy(missionId: string): Promise<CommandRelationship[]> {
    await this.ensureInitialized();
    const pool = getPool();

    const result = await pool.query(
      `
      SELECT * FROM command_relationships
      WHERE mission_id = $1
      ORDER BY created_at ASC
    `,
      [missionId]
    );

    return result.rows.map((row) => this.rowToRelationship(row));
  }

  /**
   * Get subordinates of a unit
   */
  async getSubordinates(unitId: string): Promise<CommandRelationship[]> {
    await this.ensureInitialized();
    const pool = getPool();
    const result = await pool.query(
      'SELECT * FROM command_relationships WHERE superior_unit_id = $1',
      [unitId]
    );

    return result.rows.map((row) => this.rowToRelationship(row));
  }

  /**
   * Get superiors of a unit
   */
  async getSuperiors(unitId: string): Promise<CommandRelationship[]> {
    await this.ensureInitialized();
    const pool = getPool();
    const result = await pool.query(
      'SELECT * FROM command_relationships WHERE subordinate_unit_id = $1',
      [unitId]
    );

    return result.rows.map((row) => this.rowToRelationship(row));
  }

  /**
   * Delete a relationship
   */
  async deleteRelationship(id: string): Promise<boolean> {
    await this.ensureInitialized();
    const pool = getPool();
    const result = await pool.query(
      'DELETE FROM command_relationships WHERE id = $1',
      [id]
    );
    return result.rowCount !== null && result.rowCount > 0;
  }

  /**
   * Convert database row to CommandRelationship object
   */
  private rowToRelationship(row: {
    id: string;
    mission_id: string;
    superior_unit_id: string;
    subordinate_unit_id: string;
    relationship_type: string;
    effective_from?: Date;
    effective_to?: Date;
    created_at: Date;
  }): CommandRelationship {
    return {
      id: row.id,
      missionId: row.mission_id,
      superiorUnitId: row.superior_unit_id,
      subordinateUnitId: row.subordinate_unit_id,
      relationshipType: row.relationship_type as RelationshipType,
      effectiveFrom: row.effective_from
        ? new Date(row.effective_from)
        : undefined,
      effectiveTo: row.effective_to ? new Date(row.effective_to) : undefined,
      createdAt: new Date(row.created_at),
    };
  }
}

// Singleton instance
export const relationshipStore = new RelationshipStore();
