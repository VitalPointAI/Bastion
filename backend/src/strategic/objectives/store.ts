/**
 * Strategic Objective Store
 * PostgreSQL persistence for strategic objectives
 */

import { randomUUID } from 'crypto';
import { getPool } from '../../lib/database.js';
import type { StrategicObjective, Priority, ObjectiveStatus, ExtractedBy } from '../schemas/strategic-objective.js';
import type { EndsWaysMeans } from '../schemas/ends-ways-means.js';
import type { DIMEInstrument } from '../schemas/dime.js';

/**
 * Initialize strategic_objectives table
 */
export async function initStrategicObjectivesTable(): Promise<void> {
  const pool = getPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS strategic_objectives (
      id TEXT PRIMARY KEY,
      document_id TEXT NOT NULL REFERENCES strategic_documents(id),
      source_reference TEXT NOT NULL,
      description TEXT NOT NULL,
      ends_ways_means JSONB NOT NULL,
      primary_instrument TEXT NOT NULL,
      supporting_instruments TEXT[] NOT NULL DEFAULT '{}',
      parent_objective_id TEXT REFERENCES strategic_objectives(id),
      child_objective_ids TEXT[] NOT NULL DEFAULT '{}',
      constraints TEXT[] NOT NULL DEFAULT '{}',
      assumptions TEXT[] NOT NULL DEFAULT '{}',
      risks TEXT[] NOT NULL DEFAULT '{}',
      status TEXT NOT NULL DEFAULT 'DRAFT',
      priority TEXT NOT NULL DEFAULT 'MEDIUM',
      extracted_by TEXT NOT NULL,
      extraction_confidence REAL,
      human_verified BOOLEAN NOT NULL DEFAULT FALSE,
      verified_by TEXT,
      verified_at TIMESTAMPTZ,
      created_by TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_objectives_document ON strategic_objectives(document_id);
    CREATE INDEX IF NOT EXISTS idx_objectives_status ON strategic_objectives(status);
    CREATE INDEX IF NOT EXISTS idx_objectives_parent ON strategic_objectives(parent_objective_id);
    CREATE INDEX IF NOT EXISTS idx_objectives_priority ON strategic_objectives(priority);
  `);
}

/**
 * Objective creation input
 */
export interface ObjectiveInput {
  documentId: string;
  sourceReference: string;
  description: string;
  endsWaysMeans: EndsWaysMeans;
  primaryInstrument: DIMEInstrument;
  supportingInstruments?: DIMEInstrument[];
  parentObjectiveId?: string;
  constraints?: string[];
  assumptions?: string[];
  risks?: string[];
  priority?: Priority;
  extractedBy: ExtractedBy;
  extractionConfidence?: number;
  createdBy: string;
}

/**
 * Objective update input
 */
export interface ObjectiveUpdate {
  description?: string;
  endsWaysMeans?: EndsWaysMeans;
  primaryInstrument?: DIMEInstrument;
  supportingInstruments?: DIMEInstrument[];
  parentObjectiveId?: string | null;
  constraints?: string[];
  assumptions?: string[];
  risks?: string[];
  status?: ObjectiveStatus;
  priority?: Priority;
  humanVerified?: boolean;
  verifiedBy?: string;
}

/**
 * Strategic Objective Store
 * CRUD operations for strategic objectives
 */
export class ObjectiveStore {
  private initialized = false;

  /**
   * Ensure table exists before operations
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await initStrategicObjectivesTable();
      this.initialized = true;
    }
  }

  /**
   * Save a single objective
   */
  async saveObjective(input: ObjectiveInput): Promise<string> {
    await this.ensureInitialized();
    const pool = getPool();
    const id = `OBJ-${randomUUID().slice(0, 8)}`;
    const now = new Date();

    await pool.query(`
      INSERT INTO strategic_objectives (
        id, document_id, source_reference, description, ends_ways_means,
        primary_instrument, supporting_instruments, parent_objective_id,
        child_objective_ids, constraints, assumptions, risks,
        status, priority, extracted_by, extraction_confidence,
        human_verified, created_by, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
    `, [
      id,
      input.documentId,
      input.sourceReference,
      input.description,
      JSON.stringify(input.endsWaysMeans),
      input.primaryInstrument,
      input.supportingInstruments || [],
      input.parentObjectiveId || null,
      [],
      input.constraints || [],
      input.assumptions || [],
      input.risks || [],
      'DRAFT',
      input.priority || 'MEDIUM',
      input.extractedBy,
      input.extractionConfidence ?? null,
      false,
      input.createdBy,
      now,
      now,
    ]);

    return id;
  }

  /**
   * Save multiple objectives in a batch
   */
  async saveObjectives(inputs: ObjectiveInput[]): Promise<string[]> {
    await this.ensureInitialized();
    const pool = getPool();
    const ids: string[] = [];
    const now = new Date();

    // Use a transaction for batch insert
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      for (const input of inputs) {
        const id = `OBJ-${randomUUID().slice(0, 8)}`;
        ids.push(id);

        await client.query(`
          INSERT INTO strategic_objectives (
            id, document_id, source_reference, description, ends_ways_means,
            primary_instrument, supporting_instruments, parent_objective_id,
            child_objective_ids, constraints, assumptions, risks,
            status, priority, extracted_by, extraction_confidence,
            human_verified, created_by, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
        `, [
          id,
          input.documentId,
          input.sourceReference,
          input.description,
          JSON.stringify(input.endsWaysMeans),
          input.primaryInstrument,
          input.supportingInstruments || [],
          input.parentObjectiveId || null,
          [],
          input.constraints || [],
          input.assumptions || [],
          input.risks || [],
          'DRAFT',
          input.priority || 'MEDIUM',
          input.extractedBy,
          input.extractionConfidence ?? null,
          false,
          input.createdBy,
          now,
          now,
        ]);
      }

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

    return ids;
  }

  /**
   * Get an objective by ID
   */
  async getObjective(id: string): Promise<StrategicObjective | null> {
    await this.ensureInitialized();
    const pool = getPool();
    const result = await pool.query(
      'SELECT * FROM strategic_objectives WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.rowToObjective(result.rows[0]);
  }

  /**
   * Get all objectives for a document
   */
  async getObjectivesForDocument(documentId: string): Promise<StrategicObjective[]> {
    await this.ensureInitialized();
    const pool = getPool();
    const result = await pool.query(
      'SELECT * FROM strategic_objectives WHERE document_id = $1 ORDER BY created_at ASC',
      [documentId]
    );

    return result.rows.map(row => this.rowToObjective(row));
  }

  /**
   * Get objectives by status
   */
  async getObjectivesByStatus(status: ObjectiveStatus): Promise<StrategicObjective[]> {
    await this.ensureInitialized();
    const pool = getPool();
    const result = await pool.query(
      'SELECT * FROM strategic_objectives WHERE status = $1 ORDER BY created_at DESC',
      [status]
    );

    return result.rows.map(row => this.rowToObjective(row));
  }

  /**
   * List all objectives with filters and pagination
   */
  async listObjectives(options: {
    status?: ObjectiveStatus;
    priority?: Priority;
    instrument?: DIMEInstrument;
    limit?: number;
    offset?: number;
  } = {}): Promise<{ objectives: StrategicObjective[]; total: number }> {
    await this.ensureInitialized();
    const pool = getPool();

    const conditions: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 1;

    if (options.status) {
      conditions.push(`status = $${paramIndex++}`);
      params.push(options.status);
    }

    if (options.priority) {
      conditions.push(`priority = $${paramIndex++}`);
      params.push(options.priority);
    }

    if (options.instrument) {
      conditions.push(`primary_instrument = $${paramIndex++}`);
      params.push(options.instrument);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Get total count
    const countResult = await pool.query(
      `SELECT COUNT(*) FROM strategic_objectives ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].count, 10);

    // Get paginated results
    const limit = options.limit || 20;
    const offset = options.offset || 0;

    const result = await pool.query(
      `SELECT * FROM strategic_objectives ${whereClause}
       ORDER BY
         CASE priority WHEN 'CRITICAL' THEN 0 WHEN 'HIGH' THEN 1 WHEN 'MEDIUM' THEN 2 ELSE 3 END,
         created_at DESC
       LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
      [...params, limit, offset]
    );

    return {
      objectives: result.rows.map(row => this.rowToObjective(row)),
      total,
    };
  }

  /**
   * Update an objective
   */
  async updateObjective(id: string, updates: ObjectiveUpdate): Promise<boolean> {
    await this.ensureInitialized();
    const pool = getPool();

    const setClauses: string[] = ['updated_at = NOW()'];
    const params: unknown[] = [];
    let paramIndex = 1;

    if (updates.description !== undefined) {
      setClauses.push(`description = $${paramIndex++}`);
      params.push(updates.description);
    }

    if (updates.endsWaysMeans !== undefined) {
      setClauses.push(`ends_ways_means = $${paramIndex++}`);
      params.push(JSON.stringify(updates.endsWaysMeans));
    }

    if (updates.primaryInstrument !== undefined) {
      setClauses.push(`primary_instrument = $${paramIndex++}`);
      params.push(updates.primaryInstrument);
    }

    if (updates.supportingInstruments !== undefined) {
      setClauses.push(`supporting_instruments = $${paramIndex++}`);
      params.push(updates.supportingInstruments);
    }

    if (updates.parentObjectiveId !== undefined) {
      setClauses.push(`parent_objective_id = $${paramIndex++}`);
      params.push(updates.parentObjectiveId);
    }

    if (updates.constraints !== undefined) {
      setClauses.push(`constraints = $${paramIndex++}`);
      params.push(updates.constraints);
    }

    if (updates.assumptions !== undefined) {
      setClauses.push(`assumptions = $${paramIndex++}`);
      params.push(updates.assumptions);
    }

    if (updates.risks !== undefined) {
      setClauses.push(`risks = $${paramIndex++}`);
      params.push(updates.risks);
    }

    if (updates.status !== undefined) {
      setClauses.push(`status = $${paramIndex++}`);
      params.push(updates.status);
    }

    if (updates.priority !== undefined) {
      setClauses.push(`priority = $${paramIndex++}`);
      params.push(updates.priority);
    }

    if (updates.humanVerified !== undefined) {
      setClauses.push(`human_verified = $${paramIndex++}`);
      params.push(updates.humanVerified);

      if (updates.humanVerified && updates.verifiedBy) {
        setClauses.push(`verified_by = $${paramIndex++}`);
        params.push(updates.verifiedBy);
        setClauses.push(`verified_at = NOW()`);
      }
    }

    params.push(id);

    const result = await pool.query(
      `UPDATE strategic_objectives SET ${setClauses.join(', ')} WHERE id = $${paramIndex}`,
      params
    );

    return (result.rowCount ?? 0) > 0;
  }

  /**
   * Delete an objective
   */
  async deleteObjective(id: string): Promise<boolean> {
    await this.ensureInitialized();
    const pool = getPool();

    const result = await pool.query(
      'DELETE FROM strategic_objectives WHERE id = $1',
      [id]
    );

    return (result.rowCount ?? 0) > 0;
  }

  /**
   * Convert database row to StrategicObjective
   */
  private rowToObjective(row: Record<string, unknown>): StrategicObjective {
    return {
      id: row.id as string,
      documentId: row.document_id as string,
      sourceReference: row.source_reference as string,
      description: row.description as string,
      endsWaysMeans: row.ends_ways_means as EndsWaysMeans,
      primaryInstrument: row.primary_instrument as DIMEInstrument,
      supportingInstruments: row.supporting_instruments as DIMEInstrument[],
      parentObjectiveId: row.parent_objective_id as string | undefined,
      childObjectiveIds: row.child_objective_ids as string[],
      constraints: row.constraints as string[],
      assumptions: row.assumptions as string[],
      risks: row.risks as string[],
      status: row.status as ObjectiveStatus,
      extractedBy: row.extracted_by as ExtractedBy,
      extractionConfidence: row.extraction_confidence as number | undefined,
      humanVerified: row.human_verified as boolean,
      createdAt: new Date(row.created_at as string),
      updatedAt: new Date(row.updated_at as string),
    };
  }
}

// Export singleton instance
export const objectiveStore = new ObjectiveStore();
