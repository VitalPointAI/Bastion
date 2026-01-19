/**
 * Commander's Intent Store
 * PostgreSQL persistence for commander's intents
 */

import { randomUUID } from 'crypto';
import { getPool } from '../../lib/database.js';

/**
 * Commander's Intent - Klein's 7 Facets of Intent Communication
 */
export interface CommanderIntent {
  id: string;
  objectiveId: string;

  // Core 3 components (JP 5-0)
  purpose: string;           // WHY we are doing this
  keyTasks: string[];        // WHAT must be done
  endState: string;          // WHAT success looks like

  // Extended facets (Klein's research)
  expandedPurpose?: string;  // Deeper context on purpose
  rationale?: string;        // Decision rationale
  keyDecisions?: string[];   // Critical decisions to be made
  antiGoals?: string[];      // What NOT to do (pitfalls to avoid)
  constraints?: string[];    // Limitations on action

  // Metadata
  sourceObjectiveId: string; // Link to original objective
  issuedBy: string;          // DID of commander issuing intent
  issuedAt: Date;            // When intent was issued
  classification: string;    // Security classification

  // Timestamps
  createdAt: Date;
  updatedAt?: Date;
}

/**
 * Input for creating a commander's intent
 */
export interface IntentInput {
  objectiveId: string;
  purpose: string;
  keyTasks: string[];
  endState: string;
  expandedPurpose?: string;
  rationale?: string;
  keyDecisions?: string[];
  antiGoals?: string[];
  constraints?: string[];
  sourceObjectiveId: string;
  issuedBy: string;
  classification?: string;
}

/**
 * Input for updating a commander's intent
 */
export interface IntentUpdate {
  purpose?: string;
  keyTasks?: string[];
  endState?: string;
  expandedPurpose?: string;
  rationale?: string;
  keyDecisions?: string[];
  antiGoals?: string[];
  constraints?: string[];
  classification?: string;
}

/**
 * Initialize commander_intents table
 */
export async function initCommanderIntentsTable(): Promise<void> {
  const pool = getPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS commander_intents (
      id TEXT PRIMARY KEY,
      objective_id TEXT NOT NULL,
      purpose TEXT NOT NULL,
      key_tasks TEXT[] NOT NULL,
      end_state TEXT NOT NULL,
      expanded_purpose TEXT,
      rationale TEXT,
      key_decisions TEXT[],
      anti_goals TEXT[],
      constraints TEXT[],
      source_objective_id TEXT NOT NULL,
      issued_by TEXT NOT NULL,
      issued_at TIMESTAMPTZ NOT NULL,
      classification TEXT NOT NULL DEFAULT 'UNCLASSIFIED',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ
    );
    CREATE INDEX IF NOT EXISTS idx_intents_objective ON commander_intents(objective_id);
    CREATE INDEX IF NOT EXISTS idx_intents_issued_by ON commander_intents(issued_by);
  `);
}

/**
 * Commander's Intent Store
 * CRUD operations for commander's intents
 */
export class IntentStore {
  private initialized = false;

  /**
   * Ensure table exists before operations
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await initCommanderIntentsTable();
      this.initialized = true;
    }
  }

  /**
   * Save a commander's intent
   */
  async saveIntent(input: IntentInput): Promise<string> {
    await this.ensureInitialized();
    const pool = getPool();
    const id = `INT-${randomUUID().slice(0, 8)}`;
    const now = new Date();

    await pool.query(`
      INSERT INTO commander_intents (
        id, objective_id, purpose, key_tasks, end_state,
        expanded_purpose, rationale, key_decisions, anti_goals, constraints,
        source_objective_id, issued_by, issued_at, classification, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
    `, [
      id,
      input.objectiveId,
      input.purpose,
      input.keyTasks,
      input.endState,
      input.expandedPurpose || null,
      input.rationale || null,
      input.keyDecisions || [],
      input.antiGoals || [],
      input.constraints || [],
      input.sourceObjectiveId,
      input.issuedBy,
      now,
      input.classification || 'UNCLASSIFIED',
      now,
    ]);

    return id;
  }

  /**
   * Get an intent by ID
   */
  async getIntent(id: string): Promise<CommanderIntent | null> {
    await this.ensureInitialized();
    const pool = getPool();
    const result = await pool.query(
      'SELECT * FROM commander_intents WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.rowToIntent(result.rows[0]);
  }

  /**
   * Get all intents for an objective
   */
  async getIntentsForObjective(objectiveId: string): Promise<CommanderIntent[]> {
    await this.ensureInitialized();
    const pool = getPool();
    const result = await pool.query(
      'SELECT * FROM commander_intents WHERE objective_id = $1 ORDER BY issued_at DESC',
      [objectiveId]
    );

    return result.rows.map(row => this.rowToIntent(row));
  }

  /**
   * Update an intent
   */
  async updateIntent(id: string, updates: IntentUpdate): Promise<boolean> {
    await this.ensureInitialized();
    const pool = getPool();

    const setClauses: string[] = ['updated_at = NOW()'];
    const params: unknown[] = [];
    let paramIndex = 1;

    if (updates.purpose !== undefined) {
      setClauses.push(`purpose = $${paramIndex++}`);
      params.push(updates.purpose);
    }

    if (updates.keyTasks !== undefined) {
      setClauses.push(`key_tasks = $${paramIndex++}`);
      params.push(updates.keyTasks);
    }

    if (updates.endState !== undefined) {
      setClauses.push(`end_state = $${paramIndex++}`);
      params.push(updates.endState);
    }

    if (updates.expandedPurpose !== undefined) {
      setClauses.push(`expanded_purpose = $${paramIndex++}`);
      params.push(updates.expandedPurpose);
    }

    if (updates.rationale !== undefined) {
      setClauses.push(`rationale = $${paramIndex++}`);
      params.push(updates.rationale);
    }

    if (updates.keyDecisions !== undefined) {
      setClauses.push(`key_decisions = $${paramIndex++}`);
      params.push(updates.keyDecisions);
    }

    if (updates.antiGoals !== undefined) {
      setClauses.push(`anti_goals = $${paramIndex++}`);
      params.push(updates.antiGoals);
    }

    if (updates.constraints !== undefined) {
      setClauses.push(`constraints = $${paramIndex++}`);
      params.push(updates.constraints);
    }

    if (updates.classification !== undefined) {
      setClauses.push(`classification = $${paramIndex++}`);
      params.push(updates.classification);
    }

    params.push(id);

    const result = await pool.query(
      `UPDATE commander_intents SET ${setClauses.join(', ')} WHERE id = $${paramIndex}`,
      params
    );

    return (result.rowCount ?? 0) > 0;
  }

  /**
   * Delete an intent
   */
  async deleteIntent(id: string): Promise<boolean> {
    await this.ensureInitialized();
    const pool = getPool();

    const result = await pool.query(
      'DELETE FROM commander_intents WHERE id = $1',
      [id]
    );

    return (result.rowCount ?? 0) > 0;
  }

  /**
   * Convert database row to CommanderIntent
   */
  private rowToIntent(row: Record<string, unknown>): CommanderIntent {
    return {
      id: row.id as string,
      objectiveId: row.objective_id as string,
      purpose: row.purpose as string,
      keyTasks: row.key_tasks as string[],
      endState: row.end_state as string,
      expandedPurpose: row.expanded_purpose as string | undefined,
      rationale: row.rationale as string | undefined,
      keyDecisions: row.key_decisions as string[] | undefined,
      antiGoals: row.anti_goals as string[] | undefined,
      constraints: row.constraints as string[] | undefined,
      sourceObjectiveId: row.source_objective_id as string,
      issuedBy: row.issued_by as string,
      issuedAt: new Date(row.issued_at as string),
      classification: row.classification as string,
      createdAt: new Date(row.created_at as string),
      updatedAt: row.updated_at ? new Date(row.updated_at as string) : undefined,
    };
  }
}

// Export singleton instance
export const intentStore = new IntentStore();
