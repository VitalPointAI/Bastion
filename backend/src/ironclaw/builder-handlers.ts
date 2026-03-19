/**
 * Ironclaw Builder Handlers
 *
 * Phase 52 Plan 03: Dispatch map from action type string to CRUD handler
 * function. Called by tool-bridge.ts after the action pipeline approves an
 * action (status === 'executed').
 *
 * Design:
 * - Each handler validates required payload fields and throws a descriptive
 *   error if any are missing.
 * - Handlers call the same store/registry functions used by the admin API
 *   (no parallel code paths — locked decision from Phase 51).
 * - Skill handlers use dynamic imports so they load lazily. If skill modules
 *   are not yet present (Plan 02 not yet executed), the handler fails
 *   gracefully with a clear error.
 * - Idempotency: agent/team registries use ON CONFLICT upserts; tool registry
 *   skips if already registered.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ActionHandler = (
  payload: Record<string, unknown>,
  userDid: string,
) => Promise<Record<string, unknown>>;

export interface ExecuteResult {
  success: boolean;
  result?: Record<string, unknown>;
  error?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function requireField<T>(
  payload: Record<string, unknown>,
  field: string,
): T {
  const value = payload[field];
  if (value === undefined || value === null) {
    throw new Error(`Missing required payload field: "${field}"`);
  }
  return value as T;
}

// ---------------------------------------------------------------------------
// Agent Handlers
// ---------------------------------------------------------------------------

const agentCreate: ActionHandler = async (payload, userDid) => {
  const agentId = requireField<string>(payload, 'agentId');
  const name = requireField<string>(payload, 'name');
  const description = requireField<string>(payload, 'description');

  const { getAgentRegistry } = await import('../agents/registry.js');
  const registry = getAgentRegistry();

  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- used in typeof expressions for type assertions
  const { AgentPhase, AutonomyLevel, AgentCapability, ProposalKind } = await import('../agents/types.js');

  const manifest = {
    agentId,
    name,
    description,
    phase: ((payload['phase'] as string) ?? AgentPhase.Support) as typeof AgentPhase[keyof typeof AgentPhase],
    capabilities: (payload['capabilities'] as typeof AgentCapability[keyof typeof AgentCapability][]) ?? [],
    maxAutonomy: ((payload['maxAutonomy'] as string) ?? AutonomyLevel.SemiAutonomous) as typeof AutonomyLevel[keyof typeof AutonomyLevel],
    allowedProposalKinds: (payload['allowedProposalKinds'] as typeof ProposalKind[keyof typeof ProposalKind][]) ?? [],
    requiresHumanApproval: (payload['requiresHumanApproval'] as typeof ProposalKind[keyof typeof ProposalKind][]) ?? [],
    createdAt: new Date(),
    createdBy: userDid,
    active: (payload['active'] as boolean) ?? false,
    agentDID: payload['agentDID'] as string | undefined,
  };

  const registered = await registry.registerAgent(manifest);
  return { agentId: registered.agentId, status: 'created' };
};

const agentUpdate: ActionHandler = async (payload, _userDid) => {
  const agentId = requireField<string>(payload, 'agentId');
  const { getAgentStore } = await import('../agents/agent-store.js');
  const store = getAgentStore();

  const updates = payload['updates'] as Record<string, unknown> | undefined;
  if (!updates || typeof updates !== 'object') {
    throw new Error('Missing required payload field: "updates" (object)');
  }

  // Cast status to known literal union — unknown values will be silently ignored by the store
  await store.updateAgent(agentId, updates as Parameters<typeof store.updateAgent>[1]);
  return { agentId, status: 'updated' };
};

const agentDelete: ActionHandler = async (payload, _userDid) => {
  const agentId = requireField<string>(payload, 'agentId');
  const { getAgentStore } = await import('../agents/agent-store.js');
  const store = getAgentStore();
  await store.deleteAgent(agentId);
  return { agentId, status: 'deleted' };
};

const agentActivate: ActionHandler = async (payload, _userDid) => {
  const agentId = requireField<string>(payload, 'agentId');
  const { getAgentRegistry } = await import('../agents/registry.js');
  const registry = getAgentRegistry();
  const result = await registry.activateAgent(agentId);
  if (!result.allowed) {
    throw new Error(`Activation blocked: ${result.reason}`);
  }
  return { agentId, status: 'activated' };
};

const agentDeactivate: ActionHandler = async (payload, _userDid) => {
  const agentId = requireField<string>(payload, 'agentId');
  const { getAgentRegistry } = await import('../agents/registry.js');
  const registry = getAgentRegistry();
  registry.deactivateAgent(agentId);
  return { agentId, status: 'deactivated' };
};

// ---------------------------------------------------------------------------
// Tool Handlers
// ---------------------------------------------------------------------------

const toolCreate: ActionHandler = async (payload, userDid) => {
  const toolId = requireField<string>(payload, 'toolId');
  const name = requireField<string>(payload, 'name');
  const description = requireField<string>(payload, 'description');

  const { getToolRegistry } = await import('../agents/tool-registry.js');
  const registry = getToolRegistry();
  await registry.ensureInitialized();

  // Idempotent: skip if already registered
  const existing = registry.getTool(toolId);
  if (existing) {
    return { toolId: existing.toolId, status: 'already_exists' };
  }

  type RegisterToolInput = Parameters<typeof registry.registerTool>[0];
  const defaultSchema = { type: 'object' as const, properties: {} as Record<string, Record<string, unknown>>, required: [] as string[] };
  const input: RegisterToolInput = {
    toolId,
    name,
    description,
    category: ((payload['category'] as string) ?? 'action') as 'data' | 'action' | 'integration' | 'analysis',
    inputSchema: (payload['inputSchema'] as RegisterToolInput['inputSchema']) ?? defaultSchema,
    outputSchema: (payload['outputSchema'] as RegisterToolInput['inputSchema']) ?? defaultSchema,
    handler: ((payload['handler'] as string) ?? 'function') as 'builtin' | 'webhook' | 'function',
    permissions: (payload['permissions'] as string[]) ?? [],
    isEnabled: (payload['isEnabled'] as boolean) ?? true,
  };

  const tool = await registry.registerTool(input, userDid);
  return { toolId: tool.toolId, status: 'created' };
};

const toolUpdate: ActionHandler = async (payload, _userDid) => {
  const toolId = requireField<string>(payload, 'toolId');
  const updates = payload['updates'] as Record<string, unknown> | undefined;
  if (!updates || typeof updates !== 'object') {
    throw new Error('Missing required payload field: "updates" (object)');
  }

  const { getToolRegistry } = await import('../agents/tool-registry.js');
  const registry = getToolRegistry();
  await registry.ensureInitialized();

  const updated = registry.updateTool(toolId, updates as Parameters<typeof registry.updateTool>[1]);
  if (!updated) {
    throw new Error(`Tool ${toolId} not found`);
  }
  return { toolId, status: 'updated' };
};

const toolDelete: ActionHandler = async (payload, _userDid) => {
  const toolId = requireField<string>(payload, 'toolId');
  const { getToolRegistry } = await import('../agents/tool-registry.js');
  const registry = getToolRegistry();
  await registry.ensureInitialized();

  const deleted = registry.deleteTool(toolId);
  if (!deleted) {
    throw new Error(`Tool ${toolId} not found`);
  }
  return { toolId, status: 'deleted' };
};

const toolAssignToAgent: ActionHandler = async (payload, userDid) => {
  const toolId = requireField<string>(payload, 'toolId');
  const agentId = requireField<string>(payload, 'agentId');

  const { getToolRegistry } = await import('../agents/tool-registry.js');
  const registry = getToolRegistry();
  await registry.ensureInitialized();

  // Idempotent: skip if already assigned
  const assignedTools = registry.getToolsForAgent(agentId);
  if (assignedTools.some((t) => t.toolId === toolId)) {
    return { toolId, agentId, status: 'already_assigned' };
  }

  registry.assignToolToAgent(toolId, agentId, userDid);
  return { toolId, agentId, status: 'assigned' };
};

// ---------------------------------------------------------------------------
// Team Handlers
// ---------------------------------------------------------------------------

const teamCreate: ActionHandler = async (payload, userDid) => {
  const teamId = requireField<string>(payload, 'teamId');
  const name = requireField<string>(payload, 'name');

  const { getTeamRegistry } = await import('../agents/team-registry.js');
  const registry = getTeamRegistry();
  await registry.ensureInitialized();

  // Idempotent: skip if already exists
  const existing = registry.getTeam(teamId);
  if (existing) {
    return { teamId: existing.teamId, status: 'already_exists' };
  }

  const input = {
    teamId,
    name,
    description: (payload['description'] as string) ?? '',
    purpose: (payload['purpose'] as string) ?? name,
    members: (payload['members'] as unknown[]) ?? [],
    workflow: (payload['workflow'] as Record<string, unknown>) ?? { type: 'sequential', stages: [], humanCheckpoints: [] },
    sharedContext: (payload['sharedContext'] as string[]) ?? [],
    escalationPolicy: (payload['escalationPolicy'] as Record<string, unknown>) ?? {
      enabled: true,
      timeoutSeconds: 3600,
      targets: [],
      notificationChannels: [],
    },
    maxConcurrency: (payload['maxConcurrency'] as number) ?? 5,
    isEnabled: (payload['isEnabled'] as boolean) ?? true,
  };

  const team = await registry.createTeam(input as Parameters<typeof registry.createTeam>[0], userDid);
  return { teamId: team.teamId, status: 'created' };
};

const teamUpdate: ActionHandler = async (payload, _userDid) => {
  const teamId = requireField<string>(payload, 'teamId');
  const updates = payload['updates'] as Record<string, unknown> | undefined;
  if (!updates || typeof updates !== 'object') {
    throw new Error('Missing required payload field: "updates" (object)');
  }

  const { getTeamRegistry } = await import('../agents/team-registry.js');
  const registry = getTeamRegistry();
  await registry.ensureInitialized();

  const updated = await registry.updateTeam(teamId, updates as Parameters<typeof registry.updateTeam>[1]);
  if (!updated) {
    throw new Error(`Team ${teamId} not found`);
  }
  return { teamId, status: 'updated' };
};

const teamDelete: ActionHandler = async (payload, _userDid) => {
  const teamId = requireField<string>(payload, 'teamId');
  const { getTeamRegistry } = await import('../agents/team-registry.js');
  const registry = getTeamRegistry();
  const deleted = registry.deleteTeam(teamId);
  if (!deleted) {
    throw new Error(`Team ${teamId} not found`);
  }
  return { teamId, status: 'deleted' };
};

const teamAddMember: ActionHandler = async (payload, _userDid) => {
  const teamId = requireField<string>(payload, 'teamId');
  const agentId = requireField<string>(payload, 'agentId');

  const { getTeamRegistry } = await import('../agents/team-registry.js');
  const registry = getTeamRegistry();
  await registry.ensureInitialized();

  // Idempotent: skip if already a member
  if (registry.isAgentInTeam(teamId, agentId)) {
    return { teamId, agentId, status: 'already_member' };
  }

  const role = (payload['role'] as string) ?? 'specialist';
  const member = {
    agentId,
    role: role as 'coordinator' | 'specialist' | 'validator' | 'executor',
    responsibilities: (payload['responsibilities'] as string[]) ?? [],
    canInitiate: (payload['canInitiate'] as boolean) ?? false,
    canEscalate: (payload['canEscalate'] as boolean) ?? true,
  };

  await registry.addMember(teamId, member);
  return { teamId, agentId, status: 'added' };
};

const teamRemoveMember: ActionHandler = async (payload, _userDid) => {
  const teamId = requireField<string>(payload, 'teamId');
  const agentId = requireField<string>(payload, 'agentId');

  const { getTeamRegistry } = await import('../agents/team-registry.js');
  const registry = getTeamRegistry();

  // Idempotent: skip if not a member
  if (!registry.isAgentInTeam(teamId, agentId)) {
    return { teamId, agentId, status: 'not_member' };
  }

  registry.removeMember(teamId, agentId);
  return { teamId, agentId, status: 'removed' };
};

// ---------------------------------------------------------------------------
// Skill Handlers (lazy — skill modules may not yet be present)
// ---------------------------------------------------------------------------

const skillCreate: ActionHandler = async (payload, userDid) => {
  const skillId = requireField<string>(payload, 'skillId');
  const name = requireField<string>(payload, 'name');
  const description = requireField<string>(payload, 'description');

  let getSkillRegistry: ((...args: unknown[]) => unknown) | undefined;
  try {
    const mod = await import('../agents/skill-registry.js');
    getSkillRegistry = mod.getSkillRegistry as typeof getSkillRegistry;
  } catch {
    throw new Error(
      'skill.create failed: skill-registry module not available — ensure Plan 52-02 has been executed',
    );
  }

  const registry = (getSkillRegistry as () => { createSkill: (input: Record<string, unknown>, createdBy: string) => Promise<{ skillId: string }> })();
  const skill = await registry.createSkill(
    {
      skillId,
      name,
      description,
      version: (payload['version'] as string) ?? '1.0.0',
      tags: (payload['tags'] as string[]) ?? [],
      parameters: payload['parameters'] as Record<string, unknown> | undefined,
    },
    userDid,
  );
  return { skillId: skill.skillId, status: 'created' };
};

const skillUpdate: ActionHandler = async (payload, _userDid) => {
  const skillId = requireField<string>(payload, 'skillId');
  const updates = payload['updates'] as Record<string, unknown> | undefined;
  if (!updates || typeof updates !== 'object') {
    throw new Error('Missing required payload field: "updates" (object)');
  }

  let getSkillRegistry: ((...args: unknown[]) => unknown) | undefined;
  try {
    const mod = await import('../agents/skill-registry.js');
    getSkillRegistry = mod.getSkillRegistry as typeof getSkillRegistry;
  } catch {
    throw new Error(
      'skill.update failed: skill-registry module not available — ensure Plan 52-02 has been executed',
    );
  }

  const registry = (getSkillRegistry as () => { updateSkill: (id: string, updates: Record<string, unknown>) => Promise<unknown> })();
  await registry.updateSkill(skillId, updates);
  return { skillId, status: 'updated' };
};

const skillDelete: ActionHandler = async (payload, _userDid) => {
  const skillId = requireField<string>(payload, 'skillId');

  let getSkillRegistry: ((...args: unknown[]) => unknown) | undefined;
  try {
    const mod = await import('../agents/skill-registry.js');
    getSkillRegistry = mod.getSkillRegistry as typeof getSkillRegistry;
  } catch {
    throw new Error(
      'skill.delete failed: skill-registry module not available — ensure Plan 52-02 has been executed',
    );
  }

  const registry = (getSkillRegistry as () => { deleteSkill: (id: string) => Promise<boolean> })();
  const deleted = await registry.deleteSkill(skillId);
  if (!deleted) {
    throw new Error(`Skill ${skillId} not found`);
  }
  return { skillId, status: 'deleted' };
};

const skillAssign: ActionHandler = async (payload, userDid) => {
  const skillId = requireField<string>(payload, 'skillId');
  const agentId = requireField<string>(payload, 'agentId');

  let getSkillStore: ((...args: unknown[]) => unknown) | undefined;
  try {
    const mod = await import('../agents/skill-store.js');
    getSkillStore = mod.getSkillStore as typeof getSkillStore;
  } catch {
    throw new Error(
      'skill.assign failed: skill-store module not available — ensure Plan 52-02 has been executed',
    );
  }

  const store = (getSkillStore as () => { assignSkillToAgent: (skillId: string, agentId: string, assignedBy: string) => Promise<{ skillId: string; agentId: string }> })();
  const result = await store.assignSkillToAgent(skillId, agentId, userDid);
  return { skillId: result.skillId, agentId: result.agentId, status: 'assigned' };
};

const skillUnassign: ActionHandler = async (payload, _userDid) => {
  const skillId = requireField<string>(payload, 'skillId');
  const agentId = requireField<string>(payload, 'agentId');

  let getSkillStore: ((...args: unknown[]) => unknown) | undefined;
  try {
    const mod = await import('../agents/skill-store.js');
    getSkillStore = mod.getSkillStore as typeof getSkillStore;
  } catch {
    throw new Error(
      'skill.unassign failed: skill-store module not available — ensure Plan 52-02 has been executed',
    );
  }

  const store = (getSkillStore as () => { unassignSkillFromAgent: (skillId: string, agentId: string) => Promise<boolean> })();
  const removed = await store.unassignSkillFromAgent(skillId, agentId);
  if (!removed) {
    return { skillId, agentId, status: 'not_assigned' };
  }
  return { skillId, agentId, status: 'unassigned' };
};

// ---------------------------------------------------------------------------
// Dispatch Map
// ---------------------------------------------------------------------------

/**
 * Maps action type strings to their handler functions.
 * All 19 action types: 14 existing (agent×5, tool×4, team×5) + 5 skill.
 */
export const BUILDER_HANDLERS: Record<string, ActionHandler> = {
  // Agent CRUD (5)
  'agent.create': agentCreate,
  'agent.update': agentUpdate,
  'agent.delete': agentDelete,
  'agent.activate': agentActivate,
  'agent.deactivate': agentDeactivate,
  // Tool CRUD (4)
  'tool.create': toolCreate,
  'tool.update': toolUpdate,
  'tool.delete': toolDelete,
  'tool.assign_to_agent': toolAssignToAgent,
  // Team CRUD (5)
  'team.create': teamCreate,
  'team.update': teamUpdate,
  'team.delete': teamDelete,
  'team.add_member': teamAddMember,
  'team.remove_member': teamRemoveMember,
  // Skill CRUD (5)
  'skill.create': skillCreate,
  'skill.update': skillUpdate,
  'skill.delete': skillDelete,
  'skill.assign': skillAssign,
  'skill.unassign': skillUnassign,
};

// ---------------------------------------------------------------------------
// Execution Entry Point
// ---------------------------------------------------------------------------

/**
 * Execute an approved builder action.
 *
 * Called by tool-bridge.ts after action pipeline returns status='executed'.
 * Looks up the handler for the given action type, calls it, and returns a
 * structured result.
 *
 * Returns success=false (not thrown) for unknown action types so that the
 * caller can surface a clean error message without crashing.
 */
export async function executeApprovedAction(
  actionType: string,
  payload: Record<string, unknown>,
  userDid: string,
): Promise<ExecuteResult> {
  const handler = BUILDER_HANDLERS[actionType];
  if (!handler) {
    // Not a builder action — the action pipeline approved it but no CRUD
    // handler is registered. Return success=false so tool-bridge can log it.
    return {
      success: false,
      error: `No builder handler registered for action type "${actionType}"`,
    };
  }

  try {
    const result = await handler(payload, userDid);
    return { success: true, result };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[builder-handlers] Handler failed for ${actionType}:`, message);
    return { success: false, error: message };
  }
}
