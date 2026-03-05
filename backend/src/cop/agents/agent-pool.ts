/**
 * COP Agent Pool - Pool-with-Affinity Manager
 *
 * Phase 21 Plan 02: Manages agent assignments to workspace sections with
 * affinity tracking. Agents develop context for their assigned section over time.
 *
 * Pool-with-affinity: when multiple agents share the same roleKey, prefer
 * the one with an existing section assignment (affinity). If none assigned,
 * pick the least-recently-active one.
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export interface AgentAssignment {
  agentId: string;
  workspaceId: string;
  sectionId: string;
  assignedAt: Date;
  lastActiveAt: Date;
  contextSummary?: string;
}

// ─── Agent Pool ──────────────────────────────────────────────────────────────

/**
 * Manages a pool of COP agents with section affinity.
 * Tracks which agents are assigned to which workspace sections,
 * and prefers agents with existing context when making new assignments.
 */
export class AgentPool {
  /** Assignments keyed by `${agentId}:${workspaceId}:${sectionId}` */
  private assignments: Map<string, AgentAssignment> = new Map();

  /**
   * Build a composite key for an assignment.
   */
  private key(agentId: string, workspaceId: string, sectionId: string): string {
    return `${agentId}:${workspaceId}:${sectionId}`;
  }

  /**
   * Assign an agent to a workspace section.
   * Creates a new assignment with current timestamp.
   */
  assign(agentId: string, workspaceId: string, sectionId: string): AgentAssignment {
    const k = this.key(agentId, workspaceId, sectionId);
    const now = new Date();
    const assignment: AgentAssignment = {
      agentId,
      workspaceId,
      sectionId,
      assignedAt: now,
      lastActiveAt: now,
    };
    this.assignments.set(k, assignment);
    return assignment;
  }

  /**
   * Get the current assignment for an agent in a specific workspace section.
   * Returns null if no assignment exists.
   */
  getAssignment(
    agentId: string,
    workspaceId: string,
    sectionId: string,
  ): AgentAssignment | null {
    return this.assignments.get(this.key(agentId, workspaceId, sectionId)) ?? null;
  }

  /**
   * Get all agents assigned to a workspace section.
   */
  getAgentsForSection(workspaceId: string, sectionId: string): AgentAssignment[] {
    const results: AgentAssignment[] = [];
    for (const assignment of this.assignments.values()) {
      if (assignment.workspaceId === workspaceId && assignment.sectionId === sectionId) {
        results.push(assignment);
      }
    }
    return results;
  }

  /**
   * Get the preferred agent for a role in a workspace section.
   *
   * Pool-with-affinity algorithm:
   * 1. If an agent with this roleKey is already assigned to this section, return it (affinity)
   * 2. Otherwise, return the agent with the roleKey that has the oldest lastActiveAt
   *    (least-recently-active = most available)
   *
   * @param roleKey - The role to find an agent for
   * @param workspaceId - Target workspace
   * @param sectionId - Target section
   * @param availableAgentIds - List of agent IDs with this roleKey to choose from
   * @returns The preferred agent assignment, or null if no agents available
   */
  getPreferredAgent(
    roleKey: string,
    workspaceId: string,
    sectionId: string,
    availableAgentIds: string[],
  ): AgentAssignment | null {
    if (availableAgentIds.length === 0) return null;

    // 1. Check for affinity: agent already assigned to this section
    for (const agentId of availableAgentIds) {
      const existing = this.getAssignment(agentId, workspaceId, sectionId);
      if (existing) {
        return existing;
      }
    }

    // 2. No affinity match: find least-recently-active agent
    let leastRecentAgent: string | null = null;
    let leastRecentTime = Infinity;

    for (const agentId of availableAgentIds) {
      // Find the most recent activity across all assignments for this agent
      let mostRecentActivity = 0;
      for (const assignment of this.assignments.values()) {
        if (assignment.agentId === agentId) {
          const time = assignment.lastActiveAt.getTime();
          if (time > mostRecentActivity) {
            mostRecentActivity = time;
          }
        }
      }

      // Agent with no assignments at all is the most available
      if (mostRecentActivity === 0) {
        leastRecentAgent = agentId;
        break;
      }

      if (mostRecentActivity < leastRecentTime) {
        leastRecentTime = mostRecentActivity;
        leastRecentAgent = agentId;
      }
    }

    if (leastRecentAgent) {
      // Auto-assign the selected agent to this section
      return this.assign(leastRecentAgent, workspaceId, sectionId);
    }

    return null;
  }

  /**
   * Record activity for an agent in a workspace section.
   * Updates lastActiveAt for affinity tracking.
   */
  recordActivity(agentId: string, workspaceId: string, sectionId: string): void {
    const k = this.key(agentId, workspaceId, sectionId);
    const assignment = this.assignments.get(k);
    if (assignment) {
      assignment.lastActiveAt = new Date();
    }
  }

  /**
   * Release an agent from a workspace section assignment.
   */
  releaseAgent(agentId: string, workspaceId: string, sectionId: string): void {
    this.assignments.delete(this.key(agentId, workspaceId, sectionId));
  }

  /**
   * Get all current assignments (for debugging/monitoring).
   */
  getAllAssignments(): AgentAssignment[] {
    return Array.from(this.assignments.values());
  }
}
