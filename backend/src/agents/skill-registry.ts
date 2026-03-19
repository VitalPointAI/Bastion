/**
 * SkillRegistry
 *
 * Phase 52: Agent Skills & MCP
 * Write-through cache singleton for agent skills.
 *
 * Backed by SkillStore (PostgreSQL) with an in-memory Map cache.
 * Writes go to both cache and DB; reads hit cache after initialization.
 * Follows the same pattern as AgentRegistry wrapping AgentStore.
 */

import { getSkillStore } from './skill-store.js';
import type { SkillRow, SkillInput, SkillUpdate, SkillAssignment } from './skill-store.js';

// ============================================================================
// SkillRegistry class
// ============================================================================

export class SkillRegistry {
  /** In-memory write-through cache: skillId -> SkillRow */
  private skills: Map<string, SkillRow> = new Map();
  private initialized = false;
  private initPromise: Promise<void> | null = null;

  constructor() {
    this.initPromise = this.initialize();
  }

  /**
   * Load all skills from DB into cache on first access.
   */
  private async initialize(): Promise<void> {
    if (this.initialized) return;
    try {
      const store = getSkillStore();
      const existing = await store.listSkills();
      for (const skill of existing) {
        this.skills.set(skill.skillId, skill);
      }
    } catch (err) {
      console.warn('[SkillRegistry] init warning (DB may not be ready yet):', err instanceof Error ? err.message : err);
    }
    this.initialized = true;
  }

  /**
   * Ensure initialization is complete before operations.
   */
  async ensureInitialized(): Promise<void> {
    if (this.initPromise) {
      await this.initPromise;
    }
  }

  // ==========================================================================
  // CRUD
  // ==========================================================================

  /**
   * Create or upsert a skill.
   * Writes to DB then updates cache.
   */
  async createSkill(input: SkillInput): Promise<SkillRow> {
    await this.ensureInitialized();
    const store = getSkillStore();
    const skill = await store.createSkill(input);
    this.skills.set(skill.skillId, skill);
    return skill;
  }

  /**
   * Get a skill by ID from cache.
   * Returns undefined if not found.
   */
  getSkill(skillId: string): SkillRow | undefined {
    return this.skills.get(skillId);
  }

  /**
   * List all skills from cache, optionally filtered.
   */
  listSkills(filters?: { enabled?: boolean }): SkillRow[] {
    let skills = Array.from(this.skills.values());
    if (filters?.enabled !== undefined) {
      skills = skills.filter((s) => s.isEnabled === filters.enabled);
    }
    return skills.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }

  /**
   * Update a skill.
   * Writes to DB then updates cache.
   */
  async updateSkill(skillId: string, updates: SkillUpdate): Promise<SkillRow | undefined> {
    await this.ensureInitialized();
    const store = getSkillStore();
    const updated = await store.updateSkill(skillId, updates);
    if (updated) {
      this.skills.set(skillId, updated);
    }
    return updated;
  }

  /**
   * Delete a skill.
   * Removes from DB and cache.
   */
  async deleteSkill(skillId: string): Promise<void> {
    await this.ensureInitialized();
    const store = getSkillStore();
    await store.deleteSkill(skillId);
    this.skills.delete(skillId);
  }

  // ==========================================================================
  // Assignment operations
  // ==========================================================================

  /**
   * Assign a skill to an agent.
   */
  async assignSkillToAgent(skillId: string, agentId: string, assignedBy: string): Promise<void> {
    await this.ensureInitialized();
    const store = getSkillStore();
    await store.assignSkillToAgent(skillId, agentId, assignedBy);
  }

  /**
   * Unassign a skill from an agent.
   */
  async unassignSkillFromAgent(skillId: string, agentId: string): Promise<void> {
    await this.ensureInitialized();
    const store = getSkillStore();
    await store.unassignSkillFromAgent(skillId, agentId);
  }

  /**
   * Get all skills assigned to an agent.
   * Queries DB directly (not cache) to ensure freshness.
   */
  async getSkillsForAgent(agentId: string): Promise<SkillRow[]> {
    await this.ensureInitialized();
    const store = getSkillStore();
    return store.getSkillsForAgent(agentId);
  }

  /**
   * Get all agents assigned to a skill.
   */
  async getAgentsForSkill(skillId: string): Promise<SkillAssignment[]> {
    await this.ensureInitialized();
    const store = getSkillStore();
    return store.getAgentsForSkill(skillId);
  }

  /**
   * Get assignment counts for all skills.
   * Returns a Map of skillId -> count.
   */
  async getAssignmentCounts(skillIds: string[]): Promise<Map<string, number>> {
    const store = getSkillStore();
    return store.getAssignmentCounts(skillIds);
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let registryInstance: SkillRegistry | null = null;

/**
 * Get or create the skill registry singleton.
 */
export function getSkillRegistry(): SkillRegistry {
  if (!registryInstance) {
    registryInstance = new SkillRegistry();
  }
  return registryInstance;
}
