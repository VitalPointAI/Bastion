/**
 * Member Reporting Relationship Store
 *
 * CRUD for ORBAT reporting relationships between problem set members.
 * Supports 'direct' (solid line) and 'dotted' (coordination) relationships.
 */

import { randomUUID } from 'crypto';
import { getPool } from '../lib/database.js';

export interface MemberReportingRelationship {
  id: string;
  problem_set_id: string;
  superior_did: string;
  subordinate_did: string;
  relationship_type: 'direct' | 'dotted';
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

class MemberReportingStore {
  /**
   * Get all reporting relationships for a problem set.
   */
  async getByProblemSet(problemSetId: string): Promise<MemberReportingRelationship[]> {
    const pool = getPool();
    const result = await pool.query(
      `SELECT * FROM member_reporting_relationships WHERE problem_set_id = $1 ORDER BY created_at`,
      [problemSetId],
    );
    return result.rows;
  }

  /**
   * Set all relationships for a problem set (replace all).
   * Accepts the full edge list and replaces existing relationships atomically.
   */
  async replaceAll(
    problemSetId: string,
    relationships: Array<{
      superior_did: string;
      subordinate_did: string;
      relationship_type: 'direct' | 'dotted';
    }>,
    createdBy?: string,
  ): Promise<MemberReportingRelationship[]> {
    const pool = getPool();
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Delete existing
      await client.query(
        `DELETE FROM member_reporting_relationships WHERE problem_set_id = $1`,
        [problemSetId],
      );

      // Insert new
      const inserted: MemberReportingRelationship[] = [];
      for (const rel of relationships) {
        // Skip self-referential
        if (rel.superior_did === rel.subordinate_did) continue;

        const id = randomUUID();
        const result = await client.query(
          `INSERT INTO member_reporting_relationships (id, problem_set_id, superior_did, subordinate_did, relationship_type, created_by)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (problem_set_id, superior_did, subordinate_did, relationship_type) DO NOTHING
           RETURNING *`,
          [id, problemSetId, rel.superior_did, rel.subordinate_did, rel.relationship_type, createdBy ?? null],
        );
        if (result.rows[0]) inserted.push(result.rows[0]);
      }

      await client.query('COMMIT');
      return inserted;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }
}

export const memberReportingStore = new MemberReportingStore();
