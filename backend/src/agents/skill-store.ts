/**
 * SkillStore
 *
 * Phase 52: Agent Skills & MCP
 * PostgreSQL-backed CRUD store for agent skills.
 *
 * IMPORTANT: Zod schemas CANNOT be serialized. inputSchema and outputSchema
 * are stored as JSON Schema objects (via zodToJsonSchema) in skill_data JSONB.
 * On read, raw JSON Schema objects are returned — do NOT attempt to reconstruct
 * Zod at read time.
 *
 * Tables: skills, agent_skill_assignments (created by migration 038)
 */

import { getPool } from '../lib/database.js';

// ============================================================================
// Types
// ============================================================================

/** Stored representation of a skill — schemas as plain JSON Schema objects */
export interface SkillRow {
  skillId: string;
  name: string;
  description: string;
  version: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  isEnabled: boolean;
  /** Raw JSON Schema for input parameters */
  inputSchema: Record<string, unknown>;
  /** Raw JSON Schema for output (optional) */
  outputSchema?: Record<string, unknown>;
  /** MCP tool IDs this skill composes */
  toolIds?: string[];
  /** System prompt fragment injected when skill is active */
  systemPromptFragment?: string;
  /** Arbitrary skill-specific metadata */
  metadata?: Record<string, unknown>;
}

export interface SkillInput {
  skillId: string;
  name: string;
  description: string;
  version?: string;
  createdBy: string;
  isEnabled?: boolean;
  inputSchema: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
  toolIds?: string[];
  systemPromptFragment?: string;
  metadata?: Record<string, unknown>;
}

export type SkillUpdate = Partial<Omit<SkillInput, 'skillId' | 'createdBy'>>;

export interface SkillAssignment {
  skillId: string;
  agentId: string;
  assignedAt: Date;
  assignedBy: string;
}

// ============================================================================
// DB row shapes
// ============================================================================

interface SkillDbRow {
  skill_id: string;
  skill_data: SkillRow;
  version: string;
  created_by: string;
  created_at: Date;
  updated_at: Date;
  is_enabled: boolean;
}

interface AssignmentDbRow {
  skill_id: string;
  agent_id: string;
  assigned_at: Date;
  assigned_by: string;
}

// ============================================================================
// Mapper
// ============================================================================

function rowToSkill(row: SkillDbRow): SkillRow {
  const data = row.skill_data as unknown as Record<string, unknown>;
  return {
    skillId: row.skill_id,
    name: data.name as string,
    description: data.description as string,
    version: row.version,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    isEnabled: row.is_enabled,
    inputSchema: (data.inputSchema ?? {}) as Record<string, unknown>,
    outputSchema: data.outputSchema as Record<string, unknown> | undefined,
    toolIds: data.toolIds as string[] | undefined,
    systemPromptFragment: data.systemPromptFragment as string | undefined,
    metadata: data.metadata as Record<string, unknown> | undefined,
  };
}

// ============================================================================
// SkillStore class
// ============================================================================

export class SkillStore {
  /**
   * Persist a skill (insert or update on conflict).
   * Idempotent — safe to call multiple times for the same skillId.
   */
  async createSkill(input: SkillInput): Promise<SkillRow> {
    const pool = getPool();
    const skillData = {
      name: input.name,
      description: input.description,
      inputSchema: input.inputSchema,
      outputSchema: input.outputSchema,
      toolIds: input.toolIds,
      systemPromptFragment: input.systemPromptFragment,
      metadata: input.metadata,
    };

    const result = await pool.query<SkillDbRow>(
      `INSERT INTO skills (
         skill_id, skill_data, version, created_by, is_enabled, created_at, updated_at
       ) VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
       ON CONFLICT (skill_id) DO UPDATE SET
         skill_data = EXCLUDED.skill_data,
         version    = EXCLUDED.version,
         is_enabled = EXCLUDED.is_enabled,
         updated_at = NOW()
       RETURNING skill_id, skill_data, version, created_by, created_at, updated_at, is_enabled`,
      [
        input.skillId,
        JSON.stringify(skillData),
        input.version ?? '1.0.0',
        input.createdBy,
        input.isEnabled ?? true,
      ]
    );

    return rowToSkill(result.rows[0]);
  }

  /**
   * Retrieve a single skill by ID.
   * Returns undefined if not found.
   */
  async getSkill(skillId: string): Promise<SkillRow | undefined> {
    const pool = getPool();
    const result = await pool.query<SkillDbRow>(
      `SELECT skill_id, skill_data, version, created_by, created_at, updated_at, is_enabled
       FROM skills WHERE skill_id = $1`,
      [skillId]
    );
    if (result.rows.length === 0) return undefined;
    return rowToSkill(result.rows[0]);
  }

  /**
   * List all skills, optionally filtered by enabled/disabled state.
   */
  async listSkills(filters?: { enabled?: boolean }): Promise<SkillRow[]> {
    const pool = getPool();
    let query = `SELECT skill_id, skill_data, version, created_by, created_at, updated_at, is_enabled FROM skills`;
    const params: unknown[] = [];

    if (filters?.enabled !== undefined) {
      query += ` WHERE is_enabled = $1`;
      params.push(filters.enabled);
    }

    query += ` ORDER BY created_at`;

    const result = await pool.query<SkillDbRow>(query, params);
    return result.rows.map(rowToSkill);
  }

  /**
   * Apply partial updates to an existing skill.
   * Merges updates into the existing skill_data JSONB.
   */
  async updateSkill(skillId: string, updates: SkillUpdate): Promise<SkillRow | undefined> {
    const pool = getPool();

    // Build the skill_data patch from updates (only non-undefined fields)
    const dataPatch: Record<string, unknown> = {};
    if (updates.name !== undefined) dataPatch.name = updates.name;
    if (updates.description !== undefined) dataPatch.description = updates.description;
    if (updates.inputSchema !== undefined) dataPatch.inputSchema = updates.inputSchema;
    if (updates.outputSchema !== undefined) dataPatch.outputSchema = updates.outputSchema;
    if (updates.toolIds !== undefined) dataPatch.toolIds = updates.toolIds;
    if (updates.systemPromptFragment !== undefined) dataPatch.systemPromptFragment = updates.systemPromptFragment;
    if (updates.metadata !== undefined) dataPatch.metadata = updates.metadata;

    const result = await pool.query<SkillDbRow>(
      `UPDATE skills
       SET skill_data = skill_data || $2::jsonb,
           version    = COALESCE($3, version),
           is_enabled = COALESCE($4, is_enabled),
           updated_at = NOW()
       WHERE skill_id = $1
       RETURNING skill_id, skill_data, version, created_by, created_at, updated_at, is_enabled`,
      [
        skillId,
        JSON.stringify(dataPatch),
        updates.version ?? null,
        updates.isEnabled ?? null,
      ]
    );

    if (result.rows.length === 0) return undefined;
    return rowToSkill(result.rows[0]);
  }

  /**
   * Delete a skill by ID.
   * Cascades to agent_skill_assignments via FK.
   */
  async deleteSkill(skillId: string): Promise<void> {
    const pool = getPool();
    await pool.query(`DELETE FROM skills WHERE skill_id = $1`, [skillId]);
  }

  /**
   * Assign a skill to an agent.
   * Idempotent — safe to call if assignment already exists.
   */
  async assignSkillToAgent(skillId: string, agentId: string, assignedBy: string): Promise<void> {
    const pool = getPool();
    await pool.query(
      `INSERT INTO agent_skill_assignments (skill_id, agent_id, assigned_by, assigned_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (skill_id, agent_id) DO NOTHING`,
      [skillId, agentId, assignedBy]
    );
  }

  /**
   * Unassign a skill from an agent.
   */
  async unassignSkillFromAgent(skillId: string, agentId: string): Promise<void> {
    const pool = getPool();
    await pool.query(
      `DELETE FROM agent_skill_assignments WHERE skill_id = $1 AND agent_id = $2`,
      [skillId, agentId]
    );
  }

  /**
   * Get all skills assigned to a specific agent.
   * Joins skills + agent_skill_assignments.
   */
  async getSkillsForAgent(agentId: string): Promise<SkillRow[]> {
    const pool = getPool();
    const result = await pool.query<SkillDbRow>(
      `SELECT s.skill_id, s.skill_data, s.version, s.created_by, s.created_at, s.updated_at, s.is_enabled
       FROM skills s
       INNER JOIN agent_skill_assignments asa ON s.skill_id = asa.skill_id
       WHERE asa.agent_id = $1
       ORDER BY s.created_at`,
      [agentId]
    );
    return result.rows.map(rowToSkill);
  }

  /**
   * Get all agent IDs that have a specific skill assigned.
   */
  async getAgentsForSkill(skillId: string): Promise<SkillAssignment[]> {
    const pool = getPool();
    const result = await pool.query<AssignmentDbRow>(
      `SELECT skill_id, agent_id, assigned_at, assigned_by
       FROM agent_skill_assignments
       WHERE skill_id = $1
       ORDER BY assigned_at`,
      [skillId]
    );
    return result.rows.map((r) => ({
      skillId: r.skill_id,
      agentId: r.agent_id,
      assignedAt: r.assigned_at,
      assignedBy: r.assigned_by,
    }));
  }

  /**
   * Count how many agents have each skill assigned.
   * Returns a Map of skillId -> count.
   */
  async getAssignmentCounts(skillIds: string[]): Promise<Map<string, number>> {
    if (skillIds.length === 0) return new Map();
    const pool = getPool();
    const result = await pool.query<{ skill_id: string; count: string }>(
      `SELECT skill_id, COUNT(*) as count
       FROM agent_skill_assignments
       WHERE skill_id = ANY($1)
       GROUP BY skill_id`,
      [skillIds]
    );
    const map = new Map<string, number>();
    for (const row of result.rows) {
      map.set(row.skill_id, parseInt(row.count, 10));
    }
    return map;
  }
}

// ============================================================================
// Singleton factory
// ============================================================================

let _store: SkillStore | null = null;

/**
 * Returns the shared SkillStore singleton.
 */
export function getSkillStore(): SkillStore {
  if (!_store) _store = new SkillStore();
  return _store;
}
