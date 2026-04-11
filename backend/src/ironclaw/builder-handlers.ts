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

/**
 * Emit a data_updated SSE event so the frontend can re-fetch affected data.
 * Non-blocking — logs a warning on failure but never throws.
 */
async function emitDataUpdated(
  problemSetId: string,
  userDid: string,
  domain: string,
  section?: string,
): Promise<void> {
  try {
    const { ironclawEventStore } = await import('./ironclaw-event-store.js');
    const { IronclawEventType } = await import('./ironclaw-event-types.js');
    await ironclawEventStore.append(
      problemSetId, userDid, IronclawEventType.data_updated,
      { domain, section, problemSetId, source: 'ironclaw' },
    );
  } catch (err) {
    console.warn('[builder-handlers] Failed to emit data_updated SSE event:', err);
  }
}

// ---------------------------------------------------------------------------
// Agent Handlers
// ---------------------------------------------------------------------------

const agentList: ActionHandler = async (_payload, _userDid) => {
  const { getAgentStore } = await import('../agents/agent-store.js');
  const store = getAgentStore();
  const agents = await store.listAgents();
  return {
    agents: agents.map((a) => ({
      agentId: a.agentId,
      name: a.name,
      description: a.description,
      status: a.status,
      capabilities: a.capabilities,
      successRate: a.successRate,
      lastInvocation: a.lastInvocation,
    })),
    count: agents.length,
  };
};

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
  await emitDataUpdated('global', userDid, 'agents');
  return { agentId: registered.agentId, status: 'created' };
};

const agentUpdate: ActionHandler = async (payload, userDid) => {
  const agentId = requireField<string>(payload, 'agentId');
  const { getAgentStore } = await import('../agents/agent-store.js');
  const store = getAgentStore();

  const updates = payload['updates'] as Record<string, unknown> | undefined;
  if (!updates || typeof updates !== 'object') {
    throw new Error('Missing required payload field: "updates" (object)');
  }

  // Cast status to known literal union — unknown values will be silently ignored by the store
  await store.updateAgent(agentId, updates as Parameters<typeof store.updateAgent>[1]);
  await emitDataUpdated('global', userDid, 'agents');
  return { agentId, status: 'updated' };
};

const agentDelete: ActionHandler = async (payload, userDid) => {
  const agentId = requireField<string>(payload, 'agentId');
  const { getAgentStore } = await import('../agents/agent-store.js');
  const store = getAgentStore();
  await store.deleteAgent(agentId);
  await emitDataUpdated('global', userDid, 'agents');
  return { agentId, status: 'deleted' };
};

const agentActivate: ActionHandler = async (payload, userDid) => {
  const agentId = requireField<string>(payload, 'agentId');
  const { getAgentRegistry } = await import('../agents/registry.js');
  const registry = getAgentRegistry();
  const result = await registry.activateAgent(agentId);
  if (!result.allowed) {
    throw new Error(`Activation blocked: ${result.reason}`);
  }
  await emitDataUpdated('global', userDid, 'agents');
  return { agentId, status: 'activated' };
};

const agentDeactivate: ActionHandler = async (payload, userDid) => {
  const agentId = requireField<string>(payload, 'agentId');
  const { getAgentRegistry } = await import('../agents/registry.js');
  const registry = getAgentRegistry();
  registry.deactivateAgent(agentId);
  await emitDataUpdated('global', userDid, 'agents');
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
  await emitDataUpdated('global', userDid, 'tools');
  return { toolId: tool.toolId, status: 'created' };
};

const toolUpdate: ActionHandler = async (payload, userDid) => {
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
  await emitDataUpdated('global', userDid, 'tools');
  return { toolId, status: 'updated' };
};

const toolDelete: ActionHandler = async (payload, userDid) => {
  const toolId = requireField<string>(payload, 'toolId');
  const { getToolRegistry } = await import('../agents/tool-registry.js');
  const registry = getToolRegistry();
  await registry.ensureInitialized();

  const deleted = registry.deleteTool(toolId);
  if (!deleted) {
    throw new Error(`Tool ${toolId} not found`);
  }
  await emitDataUpdated('global', userDid, 'tools');
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
  await emitDataUpdated('global', userDid, 'tools');
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
  await emitDataUpdated('global', userDid, 'teams');
  return { teamId: team.teamId, status: 'created' };
};

const teamUpdate: ActionHandler = async (payload, userDid) => {
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
  await emitDataUpdated('global', userDid, 'teams');
  return { teamId, status: 'updated' };
};

const teamDelete: ActionHandler = async (payload, userDid) => {
  const teamId = requireField<string>(payload, 'teamId');
  const { getTeamRegistry } = await import('../agents/team-registry.js');
  const registry = getTeamRegistry();
  const deleted = registry.deleteTeam(teamId);
  if (!deleted) {
    throw new Error(`Team ${teamId} not found`);
  }
  await emitDataUpdated('global', userDid, 'teams');
  return { teamId, status: 'deleted' };
};

const teamAddMember: ActionHandler = async (payload, userDid) => {
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
  await emitDataUpdated('global', userDid, 'teams');
  return { teamId, agentId, status: 'added' };
};

const teamRemoveMember: ActionHandler = async (payload, userDid) => {
  const teamId = requireField<string>(payload, 'teamId');
  const agentId = requireField<string>(payload, 'agentId');

  const { getTeamRegistry } = await import('../agents/team-registry.js');
  const registry = getTeamRegistry();

  // Idempotent: skip if not a member
  if (!registry.isAgentInTeam(teamId, agentId)) {
    return { teamId, agentId, status: 'not_member' };
  }

  registry.removeMember(teamId, agentId);
  await emitDataUpdated('global', userDid, 'teams');
  return { teamId, agentId, status: 'removed' };
};

// ---------------------------------------------------------------------------
// Skill Handlers (lazy — skill modules may not yet be present)
// ---------------------------------------------------------------------------

const skillCreate: ActionHandler = async (payload, userDid) => {
  const skillId = requireField<string>(payload, 'skillId');
  const name = requireField<string>(payload, 'name');
  const description = requireField<string>(payload, 'description');

  // Use registerRuntimeSkill to write .md file + register in DB + enable dynamic handler
  try {
    const { registerRuntimeSkill } = await import('../skills/skill-handler-registry.js');
    const result = await registerRuntimeSkill(
      {
        skillId,
        name,
        description,
        category: (payload['category'] as string) ?? 'general',
        tags: (payload['tags'] as string[]) ?? [],
        version: (payload['version'] as string) ?? '1.0.0',
        inputSchema: (payload['inputSchema'] as Record<string, unknown>) ?? (payload['parameters'] as Record<string, unknown>) ?? { type: 'object', properties: {} },
        outputSchema: (payload['outputSchema'] as Record<string, unknown>) ?? undefined,
        systemPromptFragment: (payload['systemPromptFragment'] as string) ?? description,
        overview: payload['overview'] as string | undefined,
        tacticalContext: payload['tacticalContext'] as string | undefined,
        constraints: payload['constraints'] as string | undefined,
      },
      userDid,
    );
    await emitDataUpdated('global', userDid, 'skills');
    return { skillId: result.skillId, filePath: result.filePath, status: 'created' };
  } catch (err) {
    // Fallback to DB-only registration if .md write fails
    console.warn('[skill.create] registerRuntimeSkill failed, falling back to DB-only:', err);
    const { getSkillRegistry } = await import('../agents/skill-registry.js');
    const registry = getSkillRegistry();
    const skill = await registry.createSkill({
      skillId,
      name,
      description,
      version: (payload['version'] as string) ?? '1.0.0',
      isEnabled: true,
      inputSchema: (payload['inputSchema'] as Record<string, unknown>) ?? {},
      systemPromptFragment: (payload['systemPromptFragment'] as string) ?? description,
      metadata: {
        category: (payload['category'] as string) ?? 'general',
        tags: (payload['tags'] as string[]) ?? [],
        handler: `${(payload['category'] as string) ?? 'general'}/${name.replace(/_([a-z])/g, (_: string, c: string) => c.toUpperCase())}`,
      },
      createdBy: userDid,
    });
    await emitDataUpdated('global', userDid, 'skills');
    return { skillId: skill.skillId, status: 'created_db_only' };
  }
};

const skillUpdate: ActionHandler = async (payload, userDid) => {
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
  await emitDataUpdated('global', userDid, 'skills');
  return { skillId, status: 'updated' };
};

const skillDelete: ActionHandler = async (payload, userDid) => {
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
  await emitDataUpdated('global', userDid, 'skills');
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
  await emitDataUpdated('global', userDid, 'skills');
  return { skillId: result.skillId, agentId: result.agentId, status: 'assigned' };
};

const skillUnassign: ActionHandler = async (payload, userDid) => {
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
  await emitDataUpdated('global', userDid, 'skills');
  return { skillId, agentId, status: 'unassigned' };
};

// ---------------------------------------------------------------------------
// Design Interview Handlers
// ---------------------------------------------------------------------------

/** Generate a simple UUID without importing crypto (used in sync normalizers) */
function makeId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

/**
 * Normalize a single CoG node from LLM output into the expected schema.
 * Handles missing ids, alternate field names, and doctrinal child keys
 * (critical_capabilities, critical_requirements, critical_vulnerabilities).
 */
function normalizeCoGNode(raw: Record<string, unknown>, nodeType: string): Record<string, unknown> {
  // Collect children from all possible keys the LLM might use
  let rawChildren: unknown[] = [];
  if (Array.isArray(raw.children) && (raw.children as unknown[]).length > 0) {
    rawChildren = raw.children as unknown[];
  } else {
    // Doctrinal child keys — build hierarchy: CC children are CRs, CR children are CVs
    const ccArr = (raw.critical_capabilities as unknown[]) ?? (raw.criticalCapabilities as unknown[]) ?? (raw.critical_components as unknown[]) ?? (raw.cc as unknown[]);
    const crArr = (raw.critical_requirements as unknown[]) ?? (raw.criticalRequirements as unknown[]) ?? (raw.cr as unknown[]);
    const cvArr = (raw.critical_vulnerabilities as unknown[]) ?? (raw.criticalVulnerabilities as unknown[]) ?? (raw.cv as unknown[]);

    if (ccArr) rawChildren.push(...ccArr.map(c => ({ ...(typeof c === 'string' ? { label: c } : c as Record<string, unknown>), type: 'critical-capability' })));
    if (crArr) rawChildren.push(...crArr.map(c => ({ ...(typeof c === 'string' ? { label: c } : c as Record<string, unknown>), type: 'critical-requirement' })));
    if (cvArr) rawChildren.push(...cvArr.map(c => ({ ...(typeof c === 'string' ? { label: c } : c as Record<string, unknown>), type: 'critical-vulnerability' })));
  }

  return {
    id: (raw.id as string) ?? makeId(),
    type: (raw.type as string) ?? nodeType,
    label: (raw.label as string) ?? (raw.name as string) ?? (raw.title as string) ?? '',
    description: (raw.description as string) ?? (raw.assessment as string) ?? '',
    children: rawChildren.map(c => normalizeCoGNode(c as Record<string, unknown>, (c as Record<string, unknown>).type as string ?? 'critical-capability')),
  };
}

/**
 * Enforce doctrinal CoG hierarchy: CoG → CC → CR → CV (Strange's framework).
 *
 * If CCs, CRs, and CVs are flat children of the root (no nesting),
 * restructure using `parent_cc` / `parent_cr` fields if the LLM provided
 * them, otherwise leave flat (bad associations are worse than no nesting).
 */
function enforceCoGHierarchy(root: Record<string, unknown>): Record<string, unknown> {
  const children = root.children as Record<string, unknown>[] | undefined;
  if (!Array.isArray(children) || children.length === 0) return root;

  const ccs = children.filter(c => c.type === 'critical-capability');
  const crs = children.filter(c => c.type === 'critical-requirement');
  const cvs = children.filter(c => c.type === 'critical-vulnerability');

  // If CCs already have nested children, the hierarchy is already correct
  const ccsHaveChildren = ccs.some(cc =>
    Array.isArray(cc.children) && (cc.children as unknown[]).length > 0,
  );
  if (ccsHaveChildren) return root;

  // Only restructure if we have CCs + (CRs or CVs) as flat siblings
  if (ccs.length === 0) return root;
  if (crs.length === 0 && cvs.length === 0) return root;

  // Build a lookup of CCs by label (lowercased) for parent matching
  const ccByLabel = new Map<string, Record<string, unknown>>();
  const ccById = new Map<string, Record<string, unknown>>();
  for (const cc of ccs) {
    cc.children = [];
    ccByLabel.set(String(cc.label ?? '').toLowerCase(), cc);
    ccById.set(String(cc.id ?? ''), cc);
  }

  // Assign CRs to their parent CC using parent_cc field or first CC as fallback
  const crById = new Map<string, Record<string, unknown>>();
  for (const cr of crs) {
    cr.children = [];
    crById.set(String(cr.id ?? ''), cr);
    const parentRef = (cr.parent_cc as string) ?? (cr.parentCc as string) ?? (cr.cc as string) ?? '';
    const parentCC = ccById.get(parentRef) ?? ccByLabel.get(parentRef.toLowerCase());
    if (parentCC) {
      (parentCC.children as Record<string, unknown>[]).push(cr);
    } else {
      // No explicit parent — attach to first CC
      (ccs[0].children as Record<string, unknown>[]).push(cr);
    }
  }

  // Assign CVs to their parent CR using parent_cr field
  for (const cv of cvs) {
    const parentRef = (cv.parent_cr as string) ?? (cv.parentCr as string) ?? (cv.cr as string) ?? '';
    const parentCR = crById.get(parentRef);
    if (parentCR) {
      if (!Array.isArray(parentCR.children)) parentCR.children = [];
      (parentCR.children as Record<string, unknown>[]).push(cv);
    } else if (crs.length > 0) {
      // No explicit parent — attach to first CR
      if (!Array.isArray(crs[0].children)) crs[0].children = [];
      (crs[0].children as Record<string, unknown>[]).push(cv);
    } else {
      // No CRs at all — attach directly to first CC
      (ccs[0].children as Record<string, unknown>[]).push(cv);
    }
  }

  // Root's children are now only CCs (CRs and CVs are nested within)
  return { ...root, children: ccs };
}

/**
 * Normalize CoG analysis data from LLM output into the tree format the frontend expects:
 * { friendly: { root: CoGNode | null }, adversary: { root: CoGNode | null } }
 *
 * Enforces doctrinal hierarchy: CoG → CC → CR → CV (Strange's framework).
 *
 * Handles common LLM output patterns:
 * 1. Already correct format: { friendly: { root: { ... } } }
 * 2. Flat components: { friendly: { cog_statement, critical_components: [...] } }
 * 3. Top-level flat: { cog_statement, critical_components: [...], side: 'friendly' }
 * 4. Nested with snake_case keys
 */
function normalizeCoGAnalysis(data: Record<string, unknown>): Record<string, unknown> {

  function buildTreeFromFlat(side: Record<string, unknown>): Record<string, unknown> {
    // If it already has a valid root object, normalize it then enforce hierarchy
    if (side.root && typeof side.root === 'object') {
      const root = normalizeCoGNode(side.root as Record<string, unknown>, 'cog');
      return { root: enforceCoGHierarchy(root) };
    }
    // If root is a string (just the CoG statement), build from flat fields
    if (typeof side.root === 'string') {
      return buildFromFlatFields(side, side.root as string);
    }
    // Check for flat structure: cog_statement or cogStatement + component arrays
    const cogLabel = (side.cog_statement as string) ??
      (side.cogStatement as string) ??
      (side.cog as string) ??
      (side.label as string) ??
      (side.name as string) ??
      (side.statement as string);
    if (cogLabel) {
      return buildFromFlatFields(side, cogLabel);
    }
    return { root: null };
  }

  function buildFromFlatFields(side: Record<string, unknown>, cogLabel: string): Record<string, unknown> {
    const cogDescription = (side.description as string) ?? (side.cog_description as string) ?? '';

    // Collect CC, CR, CV arrays
    const ccArray = (side.critical_components as unknown[]) ?? (side.criticalComponents as unknown[]) ?? (side.cc as unknown[]) ?? [];
    const crArray = (side.critical_requirements as unknown[]) ?? (side.criticalRequirements as unknown[]) ?? (side.cr as unknown[]) ?? [];
    const cvArray = (side.critical_vulnerabilities as unknown[]) ?? (side.criticalVulnerabilities as unknown[]) ?? (side.cv as unknown[]) ?? [];

    function makeNodes(arr: unknown[], type: string): Record<string, unknown>[] {
      return arr.map((item) => {
        const obj = (typeof item === 'string') ? { label: item } : (item as Record<string, unknown>);
        return normalizeCoGNode({ ...obj, type }, type);
      });
    }

    const ccNodes = makeNodes(ccArray, 'critical-capability');
    const crNodes = makeNodes(crArray, 'critical-requirement');
    const cvNodes = makeNodes(cvArray, 'critical-vulnerability');

    // Build flat tree, then enforce doctrinal hierarchy
    const flatRoot = {
      id: makeId(),
      type: 'cog',
      label: cogLabel,
      description: cogDescription,
      children: [...ccNodes, ...crNodes, ...cvNodes],
    };

    return { root: enforceCoGHierarchy(flatRoot) };
  }

  // Check if data already has friendly/adversary structure
  const friendly = data.friendly as Record<string, unknown> | undefined;
  const adversary = data.adversary as Record<string, unknown> | undefined;

  if (friendly || adversary) {
    return {
      friendly: friendly ? buildTreeFromFlat(friendly) : { root: null },
      adversary: adversary ? buildTreeFromFlat(adversary) : { root: null },
    };
  }

  // Data might be a single side's analysis — check for side indicator
  const side = (data.side as string) ?? 'friendly';
  const tree = buildTreeFromFlat(data);
  return {
    friendly: side === 'friendly' ? tree : { root: null },
    adversary: side === 'adversary' ? tree : { root: null },
  };
}

const designUpdateSection: ActionHandler = async (payload, userDid) => {
  const problemSetId = requireField<string>(payload, 'problem_set_id');
  const section = requireField<string>(payload, 'section');
  let data = (payload.data ?? {}) as Record<string, unknown>;

  // LLMs often put section content at the top level of the payload instead of
  // nesting it under `data`. If `data` is empty, reconstruct it from the
  // payload by stripping the control fields.
  if (Object.keys(data).length === 0) {
    const { problem_set_id: _ps, section: _sec, data: _d, partial: _p, ...rest } = payload;
    if (Object.keys(rest).length > 0) {
      data = rest;
      console.log('[designUpdateSection] data was empty — reconstructed from payload top-level keys: %s',
        Object.keys(rest).join(', '));
    }
  }

  console.log('[designUpdateSection] section=%s, data keys=%s, payload=%s',
    section,
    Object.keys(data).join(','),
    JSON.stringify(payload).slice(0, 3000),
  );

  // Normalize CoG analysis data from LLM output into expected tree structure
  if (section === 'cog-analysis') {
    // Preserve existing side when Ironclaw only updates one side
    const { designStore } = await import('../design/design-store.js');
    const existing = await designStore.getByProblemSetId(problemSetId);
    const normalized = normalizeCoGAnalysis(data);
    const norm = normalized as { friendly: { root: unknown }; adversary: { root: unknown } };
    data = {
      friendly: norm.friendly?.root ? norm.friendly : existing.cogAnalysis.friendly,
      adversary: norm.adversary?.root ? norm.adversary : existing.cogAnalysis.adversary,
    };
  }

  const { designStore } = await import('../design/design-store.js');
  const result = await designStore.updateSection(problemSetId, section, data);

  await emitDataUpdated(problemSetId, userDid, 'design', section);

  return { problemSetId, section, status: 'updated', design: result };
};

// ---------------------------------------------------------------------------
// Map Overlay Handlers
// ---------------------------------------------------------------------------

/**
 * Derive MIL-STD-2525D affiliation from SIDC code character 2.
 * Returns 'friendly', 'enemy', 'neutral', or 'unknown'.
 */
function getSIDCAffiliation(sidc: string): 'friendly' | 'enemy' | 'neutral' | 'unknown' {
  const code = sidc.charAt(1)?.toUpperCase();
  if (code === 'F' || code === 'A' || code === 'D' || code === 'M') return 'friendly';
  if (code === 'H' || code === 'S' || code === 'J') return 'enemy';
  if (code === 'N' || code === 'L') return 'neutral';
  return 'unknown';
}

/**
 * Convert MGRS string to { lat, lng } decimal degrees.
 * Returns null if conversion fails.
 */
async function mgrsToLatLng(mgrsStr: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const { toPoint } = await import('mgrs');
    const [lng, lat] = toPoint(mgrsStr);
    return { lat, lng };
  } catch (err) {
    console.warn('[builder-handlers] MGRS conversion failed:', err);
    return null;
  }
}

const designMapAddSymbol: ActionHandler = async (payload, userDid) => {
  const problemSetId = requireField<string>(payload, 'problem_set_id');
  const sidc = requireField<string>(payload, 'sidc');

  let lat = payload['lat'] as number | undefined;
  let lng = payload['lng'] as number | undefined;

  // Convert MGRS to lat/lng if provided
  if (payload['mgrs'] && (lat === undefined || lng === undefined)) {
    const coords = await mgrsToLatLng(payload['mgrs'] as string);
    if (coords) {
      lat = coords.lat;
      lng = coords.lng;
    }
  }

  if (lat === undefined || lng === undefined) {
    throw new Error('Position required: provide lat/lng or mgrs');
  }

  const { randomUUID } = await import('crypto');
  const { designStore } = await import('../design/design-store.js');

  const symbol = {
    id: randomUUID(),
    sidc,
    designation: (payload['designation'] as string) ?? '',
    affiliation: getSIDCAffiliation(sidc),
    lat,
    lng,
    echelon: payload['echelon'] as string | undefined,
    createdBy: 'ironclaw' as const,
    createdAt: new Date().toISOString(),
  };

  await designStore.addMapSymbol(problemSetId, symbol);

  // Publish real-time WebSocket event
  try {
    const { getMessageBus } = await import('../messaging/message-bus.js');
    const bus = getMessageBus();
    await bus.publish({
      sourceDid: 'system:ironclaw',
      sourceType: 'system',
      destinationType: 'channel',
      destinationTarget: `ironclaw.${problemSetId}`,
      messageType: 'design.map_updated',
      payload: { symbol, action: 'add' },
    });
  } catch (err) {
    console.warn('[builder-handlers] Failed to publish design.map_updated (add) WS event:', err);
  }

  await emitDataUpdated(problemSetId, userDid, 'design', 'map');
  return { success: true, symbolId: symbol.id };
};

const designMapMoveSymbol: ActionHandler = async (payload, userDid) => {
  const problemSetId = requireField<string>(payload, 'problem_set_id');
  const symbolId = requireField<string>(payload, 'symbol_id');

  let lat = payload['lat'] as number | undefined;
  let lng = payload['lng'] as number | undefined;

  if (payload['mgrs'] && (lat === undefined || lng === undefined)) {
    const coords = await mgrsToLatLng(payload['mgrs'] as string);
    if (coords) {
      lat = coords.lat;
      lng = coords.lng;
    }
  }

  if (lat === undefined || lng === undefined) {
    throw new Error('Position required: provide lat/lng or mgrs');
  }

  const { designStore } = await import('../design/design-store.js');
  await designStore.moveMapSymbol(problemSetId, symbolId, lat, lng);

  try {
    const { getMessageBus } = await import('../messaging/message-bus.js');
    const bus = getMessageBus();
    await bus.publish({
      sourceDid: 'system:ironclaw',
      sourceType: 'system',
      destinationType: 'channel',
      destinationTarget: `ironclaw.${problemSetId}`,
      messageType: 'design.map_updated',
      payload: { symbolId, action: 'move', lat, lng },
    });
  } catch (err) {
    console.warn('[builder-handlers] Failed to publish design.map_updated (move) WS event:', err);
  }

  await emitDataUpdated(problemSetId, userDid, 'design', 'map');
  return { success: true };
};

const designMapRemoveSymbol: ActionHandler = async (payload, userDid) => {
  const problemSetId = requireField<string>(payload, 'problem_set_id');
  const symbolId = requireField<string>(payload, 'symbol_id');

  const { designStore } = await import('../design/design-store.js');
  await designStore.removeMapSymbol(problemSetId, symbolId);

  try {
    const { getMessageBus } = await import('../messaging/message-bus.js');
    const bus = getMessageBus();
    await bus.publish({
      sourceDid: 'system:ironclaw',
      sourceType: 'system',
      destinationType: 'channel',
      destinationTarget: `ironclaw.${problemSetId}`,
      messageType: 'design.map_updated',
      payload: { symbolId, action: 'remove' },
    });
  } catch (err) {
    console.warn('[builder-handlers] Failed to publish design.map_updated (remove) WS event:', err);
  }

  await emitDataUpdated(problemSetId, userDid, 'design', 'map');
  return { success: true };
};

const designMapUpdateSymbol: ActionHandler = async (payload, userDid) => {
  const problemSetId = requireField<string>(payload, 'problem_set_id');
  const symbolId = requireField<string>(payload, 'symbol_id');

  // Build partial update from only provided fields
  const updates: Record<string, unknown> = {};
  if (payload['sidc'] !== undefined) {
    updates['sidc'] = payload['sidc'];
    updates['affiliation'] = getSIDCAffiliation(payload['sidc'] as string);
  }
  if (payload['designation'] !== undefined) updates['designation'] = payload['designation'];
  if (payload['echelon'] !== undefined) updates['echelon'] = payload['echelon'];

  if (Object.keys(updates).length === 0) {
    throw new Error('No update fields provided: supply at least one of sidc, designation, echelon');
  }

  const { designStore } = await import('../design/design-store.js');
  await designStore.updateMapSymbol(problemSetId, symbolId, updates as Parameters<typeof designStore.updateMapSymbol>[2]);

  try {
    const { getMessageBus } = await import('../messaging/message-bus.js');
    const bus = getMessageBus();
    await bus.publish({
      sourceDid: 'system:ironclaw',
      sourceType: 'system',
      destinationType: 'channel',
      destinationTarget: `ironclaw.${problemSetId}`,
      messageType: 'design.map_updated',
      payload: { symbolId, action: 'update', updates },
    });
  } catch (err) {
    console.warn('[builder-handlers] Failed to publish design.map_updated (update) WS event:', err);
  }

  await emitDataUpdated(problemSetId, userDid, 'design', 'map');
  return { success: true };
};

const designMapAddControlMeasure: ActionHandler = async (payload, userDid) => {
  const problemSetId = requireField<string>(payload, 'problem_set_id');
  const type = requireField<string>(payload, 'type');
  const label = requireField<string>(payload, 'label');
  const coordinates = requireField<Array<{ lat: number; lng: number }>>(payload, 'coordinates');

  if (!Array.isArray(coordinates) || coordinates.length === 0) {
    throw new Error('coordinates must be a non-empty array of {lat, lng} objects');
  }

  // Infer geometry type from coordinate count and measure type
  let geometryType: 'point' | 'line' | 'polygon';
  if (coordinates.length === 1) {
    geometryType = 'point';
  } else if (type === 'engagement_area' || type === 'objective') {
    geometryType = 'polygon';
  } else {
    geometryType = 'line';
  }

  const { randomUUID } = await import('crypto');
  const { designStore } = await import('../design/design-store.js');

  const measure = {
    id: randomUUID(),
    type: type as 'phase_line' | 'boundary' | 'axis_of_advance' | 'objective' | 'engagement_area' | 'nai' | 'fscm' | 'flot' | 'other',
    label,
    affiliation: ((payload['affiliation'] as string) ?? 'friendly') as 'friendly' | 'enemy' | 'neutral',
    geometry: {
      type: geometryType,
      coordinates,
    },
    createdBy: 'ironclaw' as const,
    createdAt: new Date().toISOString(),
  };

  await designStore.addControlMeasure(problemSetId, measure);

  try {
    const { getMessageBus } = await import('../messaging/message-bus.js');
    const bus = getMessageBus();
    await bus.publish({
      sourceDid: 'system:ironclaw',
      sourceType: 'system',
      destinationType: 'channel',
      destinationTarget: `ironclaw.${problemSetId}`,
      messageType: 'design.map_updated',
      payload: { measure, action: 'add_control_measure' },
    });
  } catch (err) {
    console.warn('[builder-handlers] Failed to publish design.map_updated (add_control_measure) WS event:', err);
  }

  await emitDataUpdated(problemSetId, userDid, 'design', 'map');
  return { success: true, measureId: measure.id };
};

const designMapAddOverlayGraphic: ActionHandler = async (payload, userDid) => {
  const problemSetId = requireField<string>(payload, 'problem_set_id');
  const graphicType = requireField<string>(payload, 'graphic_type');
  const label = requireField<string>(payload, 'label');
  const coordinates = requireField<Array<{ lat: number; lng: number }>>(payload, 'coordinates');

  if (!Array.isArray(coordinates) || coordinates.length === 0) {
    throw new Error('coordinates must be a non-empty array of {lat, lng} objects');
  }

  const geometryType: 'point' | 'line' | 'polygon' = coordinates.length === 1 ? 'point' : 'line';

  const { randomUUID } = await import('crypto');
  const { designStore } = await import('../design/design-store.js');

  // Store as type 'other' control measure with graphic_type prefix in label
  const measure = {
    id: randomUUID(),
    type: 'other' as const,
    label: `[${graphicType}] ${label}`,
    affiliation: 'friendly' as const,
    geometry: {
      type: geometryType,
      coordinates,
    },
    createdBy: 'ironclaw' as const,
    createdAt: new Date().toISOString(),
  };

  await designStore.addControlMeasure(problemSetId, measure);

  try {
    const { getMessageBus } = await import('../messaging/message-bus.js');
    const bus = getMessageBus();
    await bus.publish({
      sourceDid: 'system:ironclaw',
      sourceType: 'system',
      destinationType: 'channel',
      destinationTarget: `ironclaw.${problemSetId}`,
      messageType: 'design.map_updated',
      payload: { measure, action: 'add_overlay_graphic', graphicType },
    });
  } catch (err) {
    console.warn('[builder-handlers] Failed to publish design.map_updated (add_overlay_graphic) WS event:', err);
  }

  await emitDataUpdated(problemSetId, userDid, 'design', 'map');
  return { success: true, measureId: measure.id };
};

// ---------------------------------------------------------------------------
// Dispatch Map
// ---------------------------------------------------------------------------
// Design Synthesis Handler
// ---------------------------------------------------------------------------

const designSynthesizeCurrentState: ActionHandler = async (payload, userDid) => {
  const problemSetId = payload.problem_set_id as string;
  if (!problemSetId) return { success: false, error: 'problem_set_id is required' };

  // Call the synthesis endpoint internally
  const res = await fetch(`http://localhost:${process.env.PORT ?? 3001}/api/design/${problemSetId}/synthesize-current-state`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });

  if (!res.ok) {
    const err = await res.text();
    return { success: false, error: `Synthesis failed: ${err}` };
  }

  const data = await res.json() as Record<string, unknown>;
  const currentState = data.currentState as string;

  if (!currentState) {
    return { success: false, error: (data.hint as string) ?? 'No data to synthesize' };
  }

  // Auto-save to design store
  const { designStore } = await import('../design/design-store.js');
  await designStore.updateSection(problemSetId, 'problem-framing', { currentState });

  await emitDataUpdated(problemSetId, userDid, 'design', 'problem-framing');

  return {
    success: true,
    result: {
      message: `Current State synthesized from ${data.actorCount} actors, ${data.relationshipCount} relationships, ${data.tensionCount} tensions.`,
      currentState: currentState.slice(0, 200) + '...',
    },
  };
};

// ---------------------------------------------------------------------------
// Knowledge Graph Handlers
// ---------------------------------------------------------------------------

const graphSearchActors: ActionHandler = async (payload) => {
  const { executeReadQuery } = await import('../graph/neo4j-client.js');
  const query = (payload.query as string) ?? '';
  const type = payload.type as string | undefined;
  const limit = Math.min(Number(payload.limit) || 20, 100);

  let cypher = `MATCH (a:Actor) WHERE toLower(a.name) CONTAINS toLower($query)`;
  if (type) cypher += ` AND a.type = $type`;
  cypher += ` RETURN a, COUNT { (a)--() } AS relCount ORDER BY relCount DESC LIMIT $limit`;

  const result = await executeReadQuery(cypher, { query, type: type ?? '', limit });
  const actors = result.records.map((rec) => {
    const a = rec.get('a').properties;
    return { ...a, relationshipCount: rec.get('relCount').toInt() };
  });
  return { success: true, result: actors };
}

const graphGetActor: ActionHandler = async (payload) => {
  const { executeReadQuery } = await import('../graph/neo4j-client.js');
  const name = (payload.name as string) ?? '';

  try {
    const result = await executeReadQuery(`
      MATCH (a:Actor {name: $name})
      OPTIONAL MATCH (a)-[r]-(related)
      WITH a, r, related
      LIMIT 50
      RETURN a, collect(DISTINCT {
        name: related.name,
        type: type(r),
        relProps: properties(r),
        nodeType: related.type
      }) AS relationships
    `, { name });

    if (result.records.length === 0) {
      return { success: false, error: `Actor "${name}" not found in the knowledge graph` };
    }

    const rec = result.records[0];
    const actor = rec.get('a').properties;
    const rels = rec.get('relationships');
    return { success: true, result: { ...actor, relationships: rels } };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[builder-handlers] graphGetActor failed:', msg);
    return { success: false, error: `Actor lookup failed: ${msg}. The knowledge graph database may be temporarily unavailable — try again shortly.` };
  }
}

const graphQuery: ActionHandler = async (payload) => {
  const { executeReadQuery } = await import('../graph/neo4j-client.js');
  const cypher = (payload.cypher as string) ?? '';

  // Safety: block any write operations
  const normalized = cypher.toUpperCase().replace(/\s+/g, ' ');
  if (/\b(CREATE|DELETE|SET|REMOVE|MERGE|DROP|DETACH)\b/.test(normalized)) {
    return { success: false, error: 'Write operations are not allowed. Use MATCH/RETURN only.' };
  }

  try {
    const result = await executeReadQuery(cypher, {});
    const records = result.records.map((rec) => {
      const obj: Record<string, unknown> = {};
      for (const key of rec.keys) {
        const val = rec.get(key);
        obj[key as string] = val?.properties ?? (typeof val?.toInt === 'function' ? val.toInt() : val);
      }
      return obj;
    });
    return { success: true, result: records };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[builder-handlers] graphQuery failed:', msg);
    return { success: false, error: `Graph query failed: ${msg}. The knowledge graph database may be temporarily unavailable — try again shortly.` };
  }
}

const graphStats: ActionHandler = async () => {
  const { executeReadQuery } = await import('../graph/neo4j-client.js');

  try {
    const [totalNodes, totalRels, types, topActors] = await Promise.all([
      executeReadQuery('MATCH (n) RETURN count(n) AS count', {}),
      executeReadQuery('MATCH ()-[r]-() RETURN count(r) AS count', {}),
      executeReadQuery('MATCH (n) RETURN DISTINCT labels(n) AS labels, count(n) AS count ORDER BY count DESC', {}),
      executeReadQuery('MATCH (a:Actor) RETURN a.name AS name, a.type AS type, COUNT { (a)--() } AS rels ORDER BY rels DESC LIMIT 15', {}),
    ]);

    return {
      success: true,
      result: {
        totalNodes: totalNodes.records[0]?.get('count')?.toInt() ?? 0,
        totalRelationships: totalRels.records[0]?.get('count')?.toInt() ?? 0,
        nodeTypes: types.records.map((r) => ({ labels: r.get('labels'), count: r.get('count').toInt() })),
        topActors: topActors.records.map((r) => ({ name: r.get('name'), type: r.get('type'), relationships: r.get('rels').toInt() })),
      },
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[builder-handlers] graphStats failed:', msg);
    return { success: false, error: `Graph stats query failed: ${msg}. The knowledge graph database may be temporarily unavailable — try again shortly.` };
  }
}

// ---------------------------------------------------------------------------
// Knowledge Tool Handlers (Phase 60 Plan 02 — MCP domain tools)
// ---------------------------------------------------------------------------

const knowledgeSearch: ActionHandler = async (payload) => {
  const { executeReadQuery } = await import('../graph/neo4j-client.js');
  const query = (payload.query as string) ?? '';
  const entityType = payload.entity_type as string | undefined;
  const limit = Math.min(Number(payload.limit) || 20, 100);

  let cypher = `MATCH (a:Actor) WHERE toLower(a.name) CONTAINS toLower($query)`;
  if (entityType) cypher += ` AND a.type = $entityType`;
  cypher += ` RETURN a, COUNT { (a)--() } AS relCount ORDER BY relCount DESC LIMIT $limit`;

  try {
    const result = await executeReadQuery(cypher, { query, entityType: entityType ?? '', limit });
    const entities = result.records.map((rec) => {
      const a = rec.get('a').properties as Record<string, unknown>;
      return { id: a.id, name: a.name, type: a.type, description: a.description, relationshipCount: rec.get('relCount').toInt() };
    });
    return { success: true, result: entities };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[builder-handlers] knowledgeSearch failed:', msg);
    return { success: false, error: `Knowledge search failed: ${msg}. The knowledge graph database may be temporarily unavailable — try again shortly.` };
  }
};

const knowledgeGetEntity: ActionHandler = async (payload) => {
  const { executeReadQuery } = await import('../graph/neo4j-client.js');
  const entityId = (payload.entity_id as string) ?? '';
  const includeRelationships = payload.include_relationships !== false;

  const cypher = includeRelationships
    ? `MATCH (a:Actor) WHERE a.id = $entityId OR a.name = $entityId
       WITH a LIMIT 1
       OPTIONAL MATCH (a)-[r]-(related)
       WITH a, r, related LIMIT 50
       RETURN a, collect(DISTINCT {
         name: related.name, type: type(r), relProps: properties(r), nodeType: related.type
       }) AS relationships`
    : `MATCH (a:Actor) WHERE a.id = $entityId OR a.name = $entityId RETURN a LIMIT 1`;

  try {
    const result = await executeReadQuery(cypher, { entityId });
    if (result.records.length === 0) {
      return { success: false, error: `Entity "${entityId}" not found in the knowledge graph` };
    }
    const rec = result.records[0];
    const actor = rec.get('a').properties;
    const rels = includeRelationships ? rec.get('relationships') : [];
    return { success: true, result: { ...actor, relationships: rels } };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[builder-handlers] knowledgeGetEntity failed:', msg);
    return { success: false, error: `Entity lookup failed: ${msg}. The knowledge graph database may be temporarily unavailable — try again shortly.` };
  }
};

const knowledgeGetRelationships: ActionHandler = async (payload) => {
  const { executeReadQuery } = await import('../graph/neo4j-client.js');
  const entityId = (payload.entity_id as string) ?? '';
  const relType = payload.relationship_type as string | undefined;
  const direction = (payload.direction as string) ?? 'both';
  const limit = Math.min(Number(payload.limit) || 50, 200);

  let matchClause: string;
  if (direction === 'outgoing') matchClause = '(a)-[r]->(b)';
  else if (direction === 'incoming') matchClause = '(a)<-[r]-(b)';
  else matchClause = '(a)-[r]-(b)';

  let cypher = `MATCH (a:Actor) WHERE a.id = $entityId OR a.name = $entityId WITH a LIMIT 1 MATCH ${matchClause}`;
  if (relType) cypher += ` WHERE type(r) = $relType`;
  cypher += ` RETURN type(r) AS relType, b.name AS target, b.type AS targetType, properties(r) AS props LIMIT $limit`;

  try {
    const result = await executeReadQuery(cypher, { entityId, relType: relType ?? '', limit });
    const rels = result.records.map((rec) => ({
      type: rec.get('relType'),
      target: rec.get('target'),
      targetType: rec.get('targetType'),
      properties: rec.get('props'),
    }));
    return { success: true, result: rels };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[builder-handlers] knowledgeGetRelationships failed:', msg);
    return { success: false, error: `Relationship lookup failed: ${msg}. The knowledge graph database may be temporarily unavailable — try again shortly.` };
  }
};

const knowledgeSearchDocuments: ActionHandler = async (payload) => {
  const { getPool } = await import('../lib/database.js');
  const pool = getPool();
  const query = (payload.query as string) ?? '';
  const docType = payload.document_type as string | undefined;
  const problemSetId = payload.problem_set_id as string | undefined;
  const limit = Math.min(Number(payload.limit) || 10, 50);

  let sql = `SELECT id, title, type, source_url, created_at,
    ts_rank(to_tsvector('english', coalesce(title,'') || ' ' || coalesce(content,'')), plainto_tsquery('english', $1)) AS rank
    FROM documents WHERE to_tsvector('english', coalesce(title,'') || ' ' || coalesce(content,'')) @@ plainto_tsquery('english', $1)`;
  const params: unknown[] = [query];
  let paramIdx = 2;

  if (docType) {
    sql += ` AND type = $${paramIdx}`;
    params.push(docType);
    paramIdx++;
  }
  if (problemSetId) {
    sql += ` AND workspace_id = $${paramIdx}`;
    params.push(problemSetId);
    paramIdx++;
  }
  sql += ` ORDER BY rank DESC LIMIT $${paramIdx}`;
  params.push(limit);

  try {
    const result = await pool.query(sql, params);
    return { success: true, result: result.rows };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[builder-handlers] knowledgeSearchDocuments failed:', msg);
    return { success: false, error: `Document search failed: ${msg}. The database may be temporarily unavailable — try again shortly.` };
  }
};

// ---------------------------------------------------------------------------
// Problem Set Handlers (BASTION_TOOLS — tool-bridge.ts)
// ---------------------------------------------------------------------------

const problemSetRead: ActionHandler = async (payload) => {
  const { problemSetStore } = await import('../problem-set/problem-set-store.js');
  const id = (payload.id ?? payload.problem_set_id) as string;
  if (!id) return { success: false, error: 'id is required' };
  const ps = await problemSetStore.getProblemSet(id);
  if (!ps) return { success: false, error: `Problem set "${id}" not found` };
  return { success: true, result: ps };
};

const problemSetListChildren: ActionHandler = async (payload) => {
  const { problemSetStore } = await import('../problem-set/problem-set-store.js');
  const parentId = (payload.parent_id ?? payload.parentId) as string;
  if (!parentId) return { success: false, error: 'parent_id is required' };
  const children = await problemSetStore.listChildProblemSets(parentId);
  return { success: true, result: children };
};

const problemSetUpdateField: ActionHandler = async (payload, userDid) => {
  const { problemSetStore } = await import('../problem-set/problem-set-store.js');
  const id = (payload.id ?? payload.problem_set_id) as string;
  const field = payload.field as string;
  const value = payload.value;
  if (!id || !field) return { success: false, error: 'id and field are required' };

  const allowedFields = ['name', 'description', 'problemStatement', 'inviteMode', 'discoverability'];
  // Normalize snake_case to camelCase
  const camelField = field.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
  if (!allowedFields.includes(camelField)) {
    return { success: false, error: `Field "${field}" is not updatable. Allowed: ${allowedFields.join(', ')}` };
  }
  const updated = await problemSetStore.updateProblemSet(id, { [camelField]: value });
  await emitDataUpdated(id, userDid, 'problem-set');
  return { success: true, result: updated };
};

const problemSetCreateChild: ActionHandler = async (payload, userDid) => {
  const { problemSetStore } = await import('../problem-set/problem-set-store.js');
  const parentId = (payload.parent_id ?? payload.parentId) as string;
  const name = payload.name as string;
  const echelon = (payload.echelon as string) ?? 'tactical';
  if (!parentId || !name) return { success: false, error: 'parent_id and name are required' };

  const child = await problemSetStore.createProblemSet(
    { name, description: (payload.description as string) ?? null, echelon: echelon as 'strategic' | 'operational' | 'tactical', classification: ((payload.classification as string) ?? 'UNCLASSIFIED') as 'UNCLASSIFIED' | 'SECRET' | 'TOPSECRET', parentProblemSetId: parentId },
    userDid,
  );
  await emitDataUpdated(parentId, userDid, 'problem-set');
  return { success: true, result: child };
};

const problemSetConfigureAgents: ActionHandler = async (payload, userDid) => {
  const { agentConfigStore } = await import('./agent-config-store.js');
  const psId = (payload.id ?? payload.problem_set_id) as string;
  const agentConfig = payload.agent_config as Record<string, unknown>;
  if (!psId || !agentConfig) return { success: false, error: 'id and agent_config are required' };

  const did = agentConfig.did as string | undefined;
  if (!did) return { success: false, error: 'agent_config.did is required' };
  const existing = await agentConfigStore.getByDid(did);
  if (!existing) return { success: false, error: `Agent config for DID "${did}" not found` };

  const updated = await agentConfigStore.upsert({ ...existing, ...agentConfig } as Parameters<typeof agentConfigStore.upsert>[0]);
  await emitDataUpdated(psId, userDid, 'problem-set', 'agents');
  return { success: true, result: updated };
};

// ---------------------------------------------------------------------------
// Resource Handlers (BASTION_TOOLS + MCP resources domain)
// ---------------------------------------------------------------------------

const resourceCreate: ActionHandler = async (payload, userDid) => {
  const { resourceStore } = await import('../resources/resource-store.js');
  const name = payload.name as string;
  const category = (payload.type ?? payload.category) as string;
  const status = (payload.status as string) ?? 'available';
  if (!name || !category) return { success: false, error: 'name and type are required' };

  const psId = (payload.problem_set_id ?? payload.mission_id ?? '') as string;
  const resource = await resourceStore.createResource(
    psId,
    name, category as Parameters<typeof resourceStore.createResource>[2], status as Parameters<typeof resourceStore.createResource>[3],
    (payload.capabilities as Record<string, unknown>) ?? {},
  );
  await emitDataUpdated(psId || 'global', userDid, 'resources');
  return { success: true, result: resource };
};

const resourceDelete: ActionHandler = async (payload, userDid) => {
  const { resourceStore } = await import('../resources/resource-store.js');
  const id = payload.id as string;
  if (!id) return { success: false, error: 'id is required' };
  const deleted = await resourceStore.deleteResource(id);
  await emitDataUpdated('global', userDid, 'resources');
  return { success: true, result: { deleted } };
};

const resourcesList: ActionHandler = async (payload) => {
  const { resourceStore } = await import('../resources/resource-store.js');
  const filters: Record<string, unknown> = {};
  if (payload.problem_set_id || payload.mission_id) filters.missionId = payload.problem_set_id ?? payload.mission_id;
  if (payload.resource_type || payload.category) filters.category = payload.resource_type ?? payload.category;
  if (payload.status && payload.status !== 'all') filters.status = payload.status;
  const resources = await resourceStore.listResources(filters as Parameters<typeof resourceStore.listResources>[0]);
  const limit = Math.min(Number(payload.limit) || 50, 200);
  return { success: true, result: resources.slice(0, limit) };
};

const resourcesGetStatus: ActionHandler = async (payload) => {
  const { resourceStore } = await import('../resources/resource-store.js');
  const id = (payload.resource_id ?? payload.id) as string;
  if (!id) return { success: false, error: 'resource_id is required' };
  const resource = await resourceStore.getResource(id);
  if (!resource) return { success: false, error: `Resource "${id}" not found` };
  return { success: true, result: resource };
};

const resourcesSearchCapabilities: ActionHandler = async (payload) => {
  const { resourceStore } = await import('../resources/resource-store.js');
  const capabilities = (payload.capabilities as string[]) ?? [];
  if (capabilities.length === 0) return { success: false, error: 'capabilities array is required' };
  const resources = await resourceStore.findByCapabilities(capabilities);
  const limit = Math.min(Number(payload.limit) || 20, 100);
  return { success: true, result: resources.slice(0, limit) };
};

// ---------------------------------------------------------------------------
// Gate Handlers (BASTION_TOOLS)
// ---------------------------------------------------------------------------

const gateCreate: ActionHandler = async (payload, userDid) => {
  const { gateService } = await import('../gates/gate-service.js');
  const problemSetId = (payload.problem_set_id ?? payload.problemSetId) as string;
  const gateType = (payload.gate_type ?? payload.gateType) as string;
  const targetItemId = (payload.target_item_id ?? payload.targetItemId) as string;
  const targetItemTitle = (payload.target_item_title ?? payload.targetItemTitle) as string;
  if (!problemSetId || !gateType || !targetItemId || !targetItemTitle) {
    return { success: false, error: 'problem_set_id, gate_type, target_item_id, and target_item_title are required' };
  }
  const gate = await gateService.createGate({
    problem_set_id: problemSetId, gate_type: gateType as Parameters<typeof gateService.createGate>[0]['gate_type'], target_item_id: targetItemId, target_item_title: targetItemTitle,
    target_item_type: (payload.target_item_type as string) ?? 'unknown',
    tab: ((payload.tab as string) ?? 'design') as Parameters<typeof gateService.createGate>[0]['tab'],
  });
  await emitDataUpdated(problemSetId, userDid, 'gates');
  return { success: true, result: gate };
};

// ---------------------------------------------------------------------------
// Code / GitHub PR Handler (BASTION_TOOLS)
// ---------------------------------------------------------------------------

const codeCreatePR: ActionHandler = async (payload) => {
  const { GitHubService } = await import('./github-service.js');
  const ghService = new GitHubService();
  if (!ghService.isConfigured()) {
    return { success: false, error: 'GitHub integration is not configured (GITHUB_TOKEN / GITHUB_REPO missing)' };
  }
  const title = payload.title as string;
  const description = payload.description as string;
  const branchName = (payload.branch ?? payload.branchName) as string;
  const files = payload.files as Array<{ path: string; content: string }>;
  if (!title || !branchName || !files?.length) {
    return { success: false, error: 'title, branch, and files are required' };
  }
  const result = await ghService.createPR({ title, description: description ?? '', branchName, files });
  return { success: true, result };
};

// ---------------------------------------------------------------------------
// System Config Handler (BASTION_TOOLS)
// ---------------------------------------------------------------------------

const systemUpdateConfig: ActionHandler = async (payload, userDid) => {
  const { getPlatformSettingsStore } = await import('../auth/platform-settings-store.js');
  const store = getPlatformSettingsStore();
  const key = payload.key as string;
  const value = payload.value;
  if (!key) return { success: false, error: 'key is required' };

  // Only expose safe config updates
  if (key === 'environment') {
    const config = await store.setEnvironment(value as Parameters<typeof store.setEnvironment>[0]);
    await emitDataUpdated('global', userDid, 'system', 'config');
    return { success: true, result: config };
  }
  // Read-only fallback: return current config
  if (key === 'read') {
    const config = await store.getConfig();
    return { success: true, result: config };
  }
  return { success: false, error: `Config key "${key}" is not supported via this tool` };
};

// ---------------------------------------------------------------------------
// Operations Domain Handlers (MCP operations tools)
// ---------------------------------------------------------------------------

const opsGetProblemSet: ActionHandler = async (payload) => {
  const { problemSetStore } = await import('../problem-set/problem-set-store.js');
  const psId = (payload.problem_set_id ?? payload.problemSetId) as string;
  if (!psId) return { success: false, error: 'problem_set_id is required' };
  const ps = await problemSetStore.getProblemSet(psId);
  if (!ps) return { success: false, error: `Problem set "${psId}" not found` };

  const result: Record<string, unknown> = { ...ps };
  if (payload.include_children) {
    result.children = await problemSetStore.listChildProblemSets(psId);
  }
  return { success: true, result };
};

const opsListProblemSets: ActionHandler = async (payload) => {
  const { problemSetStore } = await import('../problem-set/problem-set-store.js');
  const parentId = (payload.parent_id ?? payload.parentId) as string | undefined;
  if (parentId) {
    const children = await problemSetStore.listChildProblemSets(parentId);
    return { success: true, result: children };
  }
  // List by echelon or all
  const echelons = ['strategic', 'operational', 'tactical'] as const;
  const all: unknown[] = [];
  for (const e of echelons) {
    const list = await problemSetStore.listProblemSetsByEchelon(e);
    all.push(...list);
  }
  const limit = Math.min(Number(payload.limit) || 50, 200);
  return { success: true, result: all.slice(0, limit) };
};

const opsGetOperationalDesign: ActionHandler = async (payload) => {
  const { designStore } = await import('../design/design-store.js');
  const psId = (payload.problem_set_id ?? payload.problemSetId) as string;
  if (!psId) return { success: false, error: 'problem_set_id is required' };
  const design = await designStore.getByProblemSetId(psId);
  return { success: true, result: design };
};

const opsGetCampaignPlan: ActionHandler = async (payload) => {
  const { planStore } = await import('../planning/stores/plan-store.js');
  const psId = (payload.problem_set_id ?? payload.problemSetId) as string;
  if (!psId) return { success: false, error: 'problem_set_id is required' };
  // Plans are linked via mission_id which maps to the problem set
  const plans = await planStore.findByMission(psId);
  if (plans.length === 0) {
    return { success: true, result: { message: 'No campaign plans found for this problem set', plans: [] } };
  }
  return { success: true, result: plans };
};

const opsGetCOA: ActionHandler = async (payload) => {
  const { coaStore } = await import('../planning/stores/coa-store.js');
  const coaId = (payload.coa_id ?? payload.coaId) as string;
  if (!coaId) return { success: false, error: 'coa_id is required' };
  const coa = await coaStore.findById(coaId);
  if (!coa) return { success: false, error: `COA "${coaId}" not found` };
  return { success: true, result: coa };
};

// ---------------------------------------------------------------------------
// Calendar Domain Handlers (MCP calendar tools)
// ---------------------------------------------------------------------------

const calendarGetSchedule: ActionHandler = async (payload) => {
  const { getPool } = await import('../lib/database.js');
  const pool = getPool();
  const psId = (payload.problem_set_id ?? payload.problemSetId) as string;
  if (!psId) return { success: false, error: 'problem_set_id is required' };

  // Gather decision gates as schedule milestones
  const gates = await pool.query(
    `SELECT id, gate_type, target_item_title, status, deadline_at, created_at
     FROM decision_gates WHERE problem_set_id = $1 ORDER BY deadline_at ASC NULLS LAST`,
    [psId],
  );
  // Gather OSINT events as timeline events
  const includePast = payload.include_past_events === true;
  const eventSql = includePast
    ? `SELECT id, title, source_type, published_at FROM osint_events WHERE workspace_id = $1 ORDER BY published_at DESC LIMIT 50`
    : `SELECT id, title, source_type, published_at FROM osint_events WHERE workspace_id = $1 AND published_at >= NOW() ORDER BY published_at ASC LIMIT 50`;
  const events = await pool.query(eventSql, [psId]);

  return {
    success: true,
    result: {
      decisionGates: gates.rows,
      events: events.rows,
    },
  };
};

const calendarGetEvents: ActionHandler = async (payload) => {
  const { getPool } = await import('../lib/database.js');
  const pool = getPool();
  const dateFrom = payload.date_from as string;
  const dateTo = payload.date_to as string;
  if (!dateFrom || !dateTo) return { success: false, error: 'date_from and date_to are required' };

  let sql = `SELECT id, title, source_type, published_at, workspace_id, description
    FROM osint_events WHERE published_at >= $1 AND published_at <= $2`;
  const params: unknown[] = [dateFrom, dateTo];
  let paramIdx = 3;

  if (payload.problem_set_id) {
    sql += ` AND workspace_id = $${paramIdx}`;
    params.push(payload.problem_set_id);
    paramIdx++;
  }
  const limit = Math.min(Number(payload.limit) || 50, 200);
  sql += ` ORDER BY published_at ASC LIMIT $${paramIdx}`;
  params.push(limit);

  const result = await pool.query(sql, params);
  return { success: true, result: result.rows };
};

// ---------------------------------------------------------------------------
// Personnel Domain Handlers (MCP personnel tools — clearance-gated)
// ---------------------------------------------------------------------------

const personnelListStaff: ActionHandler = async (payload) => {
  const { getPool } = await import('../lib/database.js');
  const pool = getPool();
  const section = payload.staff_section as string | undefined;
  const psId = (payload.problem_set_id ?? payload.problemSetId) as string | undefined;
  const limit = Math.min(Number(payload.limit) || 50, 200);

  // Staff are problem_set_members with their agent_config profile
  let sql = `SELECT m.user_did, m.role, m.status, m.joined_at,
      c.display_name, c.rank, c.staff_section, c.position, c.unit
    FROM problem_set_members m
    LEFT JOIN agent_config c ON c.did = m.user_did
    WHERE m.status = 'active'`;
  const params: unknown[] = [];
  let paramIdx = 1;

  if (psId) {
    sql += ` AND m.problem_set_id = $${paramIdx}`;
    params.push(psId);
    paramIdx++;
  }
  if (section && section !== 'all') {
    sql += ` AND c.staff_section = $${paramIdx}`;
    params.push(section);
    paramIdx++;
  }
  sql += ` ORDER BY c.rank ASC NULLS LAST LIMIT $${paramIdx}`;
  params.push(limit);

  const result = await pool.query(sql, params);
  return { success: true, result: result.rows };
};

const personnelGetMember: ActionHandler = async (payload) => {
  const { getPool } = await import('../lib/database.js');
  const pool = getPool();
  const memberId = (payload.member_id ?? payload.memberId) as string;
  if (!memberId) return { success: false, error: 'member_id is required' };

  const result = await pool.query(
    `SELECT c.*, m.role, m.problem_set_id, m.joined_at, m.status
     FROM agent_config c
     LEFT JOIN problem_set_members m ON m.user_did = c.did
     WHERE c.did = $1 OR c.near_account = $1
     LIMIT 5`,
    [memberId],
  );
  if (result.rows.length === 0) {
    return { success: false, error: `Member "${memberId}" not found` };
  }
  return { success: true, result: result.rows };
};

const personnelGetClearances: ActionHandler = async (payload) => {
  const { getPool } = await import('../lib/database.js');
  const pool = getPool();
  const memberIds: string[] = payload.member_ids as string[]
    ?? (payload.member_id ? [payload.member_id as string] : []);
  if (memberIds.length === 0) return { success: false, error: 'member_id or member_ids is required' };

  const result = await pool.query(
    `SELECT p.id, p.name, p.rank, p.clearance_level, p.specialty, p.readiness_status
     FROM personnel p WHERE p.id = ANY($1)`,
    [memberIds],
  );
  return { success: true, result: result.rows };
};

// ---------------------------------------------------------------------------
// Cross-scope Graph & Objective Hierarchy Handlers
// ---------------------------------------------------------------------------

const graphGetObjectiveHierarchy: ActionHandler = async (payload) => {
  const { objectiveStore } = await import('../strategic/objectives/store.js');
  const problemSetId = (payload.problem_set_id ?? payload.problemSetId) as string;
  if (!problemSetId) return { success: false, error: 'problem_set_id is required' };

  const hierarchy = await objectiveStore.getObjectivesForParentChain(problemSetId);
  return { success: true, result: hierarchy };
};

const graphAdoptObjective: ActionHandler = async (payload, userDid) => {
  const { objectiveStore } = await import('../strategic/objectives/store.js');
  const sourceObjectiveId = (payload.source_objective_id ?? payload.sourceObjectiveId) as string;
  const targetWorkspaceId = (payload.target_workspace_id ?? payload.targetWorkspaceId) as string;
  if (!sourceObjectiveId || !targetWorkspaceId) {
    return { success: false, error: 'source_objective_id and target_workspace_id are required' };
  }

  const objective = await objectiveStore.adoptObjective(sourceObjectiveId, targetWorkspaceId);
  await emitDataUpdated(targetWorkspaceId, userDid, 'objectives');
  return { success: true, result: objective };
};

const graphAssessObjectives: ActionHandler = async (payload, userDid) => {
  const { objectiveStore } = await import('../strategic/objectives/store.js');
  const { getPool } = await import('../lib/database.js');
  const pool = getPool();
  const problemSetId = (payload.problem_set_id ?? payload.problemSetId) as string;
  if (!problemSetId) return { success: false, error: 'problem_set_id is required' };

  // Look up parent workspace
  const parentResult = await pool.query(
    'SELECT parent_problem_set_id FROM problem_sets WHERE id = $1',
    [problemSetId],
  );

  if (parentResult.rows.length === 0 || !parentResult.rows[0].parent_problem_set_id) {
    return { success: true, result: { parentObjectiveCount: 0, newlyAdoptedCount: 0, skippedCount: 0 } };
  }

  const parentWorkspaceId = parentResult.rows[0].parent_problem_set_id as string;

  const parentObjectives = await objectiveStore.listObjectives({
    workspaceId: parentWorkspaceId,
    limit: 200,
    offset: 0,
  });

  if (parentObjectives.objectives.length === 0) {
    return { success: true, result: { parentObjectiveCount: 0, newlyAdoptedCount: 0, skippedCount: 0 } };
  }

  const existingObjectives = await objectiveStore.listObjectives({
    workspaceId: problemSetId,
    limit: 200,
    offset: 0,
  });

  const alreadyAdoptedParentIds = new Set(
    existingObjectives.objectives
      .filter((o) => o.parentObjectiveId)
      .map((o) => o.parentObjectiveId),
  );

  let newlyAdoptedCount = 0;
  for (const parentObj of parentObjectives.objectives) {
    if (alreadyAdoptedParentIds.has(parentObj.id)) continue;
    try {
      await objectiveStore.adoptObjective(parentObj.id, problemSetId);
      newlyAdoptedCount++;
    } catch (err) {
      console.warn(`[graphAssessObjectives] Failed to adopt ${parentObj.id}:`, err);
    }
  }

  await emitDataUpdated(problemSetId, userDid, 'objectives');

  return {
    success: true,
    result: {
      parentObjectiveCount: parentObjectives.objectives.length,
      newlyAdoptedCount,
      skippedCount: parentObjectives.objectives.length - newlyAdoptedCount,
    },
  };
};

const graphQueryGlobal: ActionHandler = async (payload) => {
  const { executeReadQuery } = await import('../graph/neo4j-client.js');
  const classification = payload.classification as string | undefined;
  const limit = Math.min(Number(payload.limit) || 50, 200);

  let cypher = 'MATCH (a:Actor)';
  const params: Record<string, unknown> = { limit };

  if (classification) {
    cypher += ' WHERE a.classification = $classification';
    params.classification = classification;
  }

  cypher += ' RETURN a, COUNT { (a)--() } AS relCount ORDER BY relCount DESC LIMIT $limit';

  const result = await executeReadQuery(cypher, params);
  const actors = result.records.map((rec) => {
    const a = rec.get('a').properties;
    return { ...a, relationshipCount: rec.get('relCount').toInt() };
  });
  return { success: true, result: actors };
};

const graphQueryParent: ActionHandler = async (payload) => {
  const { executeReadQuery } = await import('../graph/neo4j-client.js');
  const { getPool } = await import('../lib/database.js');
  const pool = getPool();
  const problemSetId = (payload.problem_set_id ?? payload.problemSetId) as string;
  if (!problemSetId) return { success: false, error: 'problem_set_id is required' };

  // Find parent workspace
  const parentResult = await pool.query(
    'SELECT parent_problem_set_id FROM problem_sets WHERE id = $1',
    [problemSetId],
  );
  const parentId = parentResult.rows[0]?.parent_problem_set_id as string | undefined;

  const workspaceIds = [problemSetId];
  if (parentId) workspaceIds.push(parentId);

  const cypher = `
    MATCH (a:Actor)
    WHERE a.workspaceId IN $workspaceIds
    RETURN a, COUNT { (a)--() } AS relCount
    ORDER BY relCount DESC
    LIMIT 200
  `;

  const result = await executeReadQuery(cypher, { workspaceIds });
  const nodes = result.records.map((rec) => {
    const a = rec.get('a').properties;
    return { ...a, relationshipCount: rec.get('relCount').toInt(), sourceWorkspaceId: a.workspaceId };
  });
  return { success: true, result: nodes };
};

// ---------------------------------------------------------------------------
// Intelligence Gap Handlers
// ---------------------------------------------------------------------------

const intelGetGaps: ActionHandler = async (payload) => {
  const problemSetId = (payload.problem_set_id ?? payload.problemSetId) as string;
  if (!problemSetId) return { success: false, error: 'problem_set_id is required' };

  const { brainStore } = await import('../brain/brain-store.js');
  const report = await brainStore.getIntelligenceGapsWithParentContext(problemSetId);
  return {
    success: true,
    localGaps: report.gaps,
    parentSuggestions: report.parentSuggestions,
    totalLocalGaps: report.gaps.length,
    totalParentSuggestions: report.parentSuggestions.length,
  };
};

const intelGetGapFillerStatus: ActionHandler = async (payload) => {
  const problemSetId = (payload.problem_set_id ?? payload.problemSetId) as string;
  if (!problemSetId) return { success: false, error: 'problem_set_id is required' };

  const { gapFillerService } = await import('./gap-filler-service.js');
  const status = gapFillerService.getStatus(problemSetId);
  return { success: true, ...status };
};

const intelPrioritizeGap: ActionHandler = async (payload, userDid) => {
  const problemSetId = (payload.problem_set_id ?? payload.problemSetId) as string;
  const gapNodeId = (payload.gap_node_id ?? payload.gapNodeId) as string;
  const reason = payload.reason as string;
  if (!problemSetId || !gapNodeId || !reason) {
    return { success: false, error: 'problem_set_id, gap_node_id, and reason are required' };
  }

  const { gapFillerService } = await import('./gap-filler-service.js');

  // Clear cooldown so it is eligible for immediate research
  gapFillerService.prioritizeGap(gapNodeId);

  // Attempt immediate fill cycle
  try {
    const results = await gapFillerService.fillGapsForProblemSet(problemSetId);
    const filled = results.find((r) => r.gapId === gapNodeId);
    await emitDataUpdated(problemSetId, userDid, 'intel', 'gaps');
    return {
      success: true,
      prioritized: true,
      gapNodeId,
      reason,
      immediateResearchResult: filled
        ? {
            actorName: filled.actorName,
            searchResultCount: filled.searchResultCount,
            actorsCreated: filled.actorsCreated,
            relationshipsCreated: filled.relationshipsCreated,
          }
        : null,
      note: filled
        ? 'Gap was researched immediately'
        : 'Gap cooldown cleared; gap will be researched on next eligible cycle',
    };
  } catch (err) {
    await emitDataUpdated(problemSetId, userDid, 'intel', 'gaps');
    return {
      success: true,
      prioritized: true,
      gapNodeId,
      reason,
      immediateResearchResult: null,
      note: `Cooldown cleared but immediate research failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
};

const intelRequestTargetedResearch: ActionHandler = async (payload, userDid) => {
  const problemSetId = (payload.problem_set_id ?? payload.problemSetId) as string;
  const query = payload.query as string;
  const context = payload.context as string;
  if (!problemSetId || !query) {
    return { success: false, error: 'problem_set_id and query are required' };
  }

  try {
    const { Researcher } = await import('../doc-intelligence/specialists/researcher.js');
    const researcher = new Researcher();
    const gapDescription = `${query} -- Context: ${context || 'none'}`;
    await researcher.triggerGapResearch(
      problemSetId,
      [gapDescription],
      0,
      'ironclaw-targeted-research',
    );

    const jobId = `targeted-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    await emitDataUpdated(problemSetId, userDid, 'intel', 'research');
    return {
      success: true,
      jobId,
      problemSetId,
      query,
      context: context || null,
      status: 'queued',
      note: 'Research job queued via pg-boss. Results will appear as strategic documents.',
    };
  } catch (err) {
    return {
      success: false,
      error: `Failed to queue research: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
};

// ---------------------------------------------------------------------------
// Team Task Assignment Handler
// ---------------------------------------------------------------------------

const teamAssignTask: ActionHandler = async (payload, userDid) => {
  const teamId = requireField<string>(payload, 'team_id');
  const taskDescription = requireField<string>(payload, 'task_description');
  const problemSetId = requireField<string>(payload, 'problem_set_id');

  const { getTaskOrchestrator } = await import('./task-orchestrator.js');
  const orchestrator = getTaskOrchestrator();

  const task = await orchestrator.assignTaskToTeam(teamId, taskDescription, problemSetId, userDid);

  await emitDataUpdated(problemSetId, userDid, 'teams');

  return {
    taskId: task.taskId,
    teamId,
    status: task.status,
    stepCount: task.steps.length,
    assignedAgents: task.assignedAgents,
  };
};

// ---------------------------------------------------------------------------
// PIR Handlers
// ---------------------------------------------------------------------------

const intelGetPIRs: ActionHandler = async (payload) => {
  const problemSetId = (payload.problem_set_id ?? payload.problemSetId) as string;
  if (!problemSetId) return { success: false, error: 'problem_set_id is required' };

  const { pirStore } = await import('../design/pir-store.js');
  const filters: Record<string, string> = {};
  if (payload.type) filters.type = payload.type as string;
  if (payload.status) filters.status = payload.status as string;

  const pirs = await pirStore.listPIRs(
    problemSetId,
    filters as { type?: 'CCIR' | 'PIR' | 'FFIR' | 'EEFI'; status?: 'ACTIVE' | 'ANSWERED' | 'SUPERSEDED' | 'CANCELLED' },
  );

  return {
    success: true,
    pirs,
    totalCount: pirs.length,
    activeCount: pirs.filter((p) => p.status === 'ACTIVE').length,
  };
};

const intelCreatePIRFromAssumption: ActionHandler = async (payload, userDid) => {
  const problemSetId = (payload.problem_set_id ?? payload.problemSetId) as string;
  const assumptionText = (payload.assumption_text ?? payload.assumptionText) as string;
  if (!problemSetId || !assumptionText) {
    return { success: false, error: 'problem_set_id and assumption_text are required' };
  }

  const { pirStore } = await import('../design/pir-store.js');
  const pirType = ((payload.type as string) || 'PIR') as 'CCIR' | 'PIR' | 'FFIR' | 'EEFI';
  const priority = (payload.priority as number) || 1;
  const assumptionId = (payload.assumption_id ?? payload.assumptionId) as string | undefined;

  const description =
    `Validate assumption: "${assumptionText}" -- Determine whether this ` +
    `assumption holds true under current operational conditions and identify ` +
    `indicators that would confirm or deny it.`;

  const pir = await pirStore.createPIR({
    problemSetId,
    type: pirType,
    description,
    priority,
    sourceType: 'assumption',
    sourceId: assumptionId,
    linkedAssumptionIds: assumptionId ? [assumptionId] : [],
    createdBy: 'ironclaw',
  });

  await emitDataUpdated(problemSetId, userDid, 'intel', 'pir');
  return { success: true, pir };
};

const intelAnswerPIR: ActionHandler = async (payload, userDid) => {
  const pirId = (payload.pir_id ?? payload.pirId) as string;
  const answer = payload.answer as string;
  if (!pirId || !answer) {
    return { success: false, error: 'pir_id and answer are required' };
  }

  const { pirStore } = await import('../design/pir-store.js');
  const answeredBy = (payload.answered_by ?? payload.answeredBy ?? 'ironclaw') as string;

  const pir = await pirStore.updatePIR(pirId, {
    answer,
    answeredBy,
    status: 'ANSWERED',
  });

  if (!pir) return { success: false, error: `PIR ${pirId} not found` };
  await emitDataUpdated((pir as unknown as Record<string, unknown>).problemSetId as string ?? 'global', userDid, 'intel', 'pir');
  return { success: true, pir };
};

const intelDerivePIRsFromDesign: ActionHandler = async (payload, userDid) => {
  const problemSetId = (payload.problem_set_id ?? payload.problemSetId) as string;
  if (!problemSetId) return { success: false, error: 'problem_set_id is required' };

  const { pirToolHandlers } = await import('../graph/tools/intelligence-gap-tools.js');
  const result = await pirToolHandlers.derive_pirs_from_design({ problemSetId });
  await emitDataUpdated(problemSetId, userDid, 'intel', 'pir');
  return result;
};

// ---------------------------------------------------------------------------
// PIR Alert Handlers
// ---------------------------------------------------------------------------

const intelCreatePIRAlert: ActionHandler = async (payload, userDid) => {
  const problemSetId = (payload.problem_set_id ?? payload.problemSetId) as string;
  if (!problemSetId) return { success: false, error: 'problem_set_id is required' };

  const pirId = (payload.pir_id ?? payload.pirId) as string;
  if (!pirId) return { success: false, error: 'pir_id is required' };

  const summary = payload.summary as string;
  if (!summary) return { success: false, error: 'summary is required' };

  const evidence = payload.evidence as string;
  if (!evidence) return { success: false, error: 'evidence is required' };

  const suggestedAnswer = (payload.suggested_answer ?? payload.suggestedAnswer) as string;
  if (!suggestedAnswer) return { success: false, error: 'suggested_answer is required' };

  // Fetch the PIR to get its metadata
  const { pirStore } = await import('../design/pir-store.js');
  const pir = await pirStore.getPIR(pirId);
  if (!pir) return { success: false, error: `PIR ${pirId} not found` };
  if (pir.status !== 'ACTIVE') return { success: false, error: `PIR ${pirId} is not active (status: ${pir.status})` };

  const { createPIRAlertDecision } = await import('../decisions/pir-alert-handler.js');
  const decision = await createPIRAlertDecision({
    problemSetId,
    pirId,
    pirType: pir.type,
    pirPriority: pir.priority,
    pirDescription: pir.description,
    suggestedAnswer,
    linkedAssumptionIds: pir.linkedAssumptionIds,
    linkedObjectiveIds: pir.linkedObjectiveIds,
  });

  await emitDataUpdated(problemSetId, userDid, 'intel', 'pir');

  return {
    success: true,
    decisionId: decision.id,
    pirId,
    pirType: pir.type,
    pirPriority: pir.priority,
    message: `PIR alert decision created (${decision.id}). Commander will be prompted to accept, reject, or request more info.`,
  };
};

const intelGetPIRAlertHistory: ActionHandler = async (payload, _userDid) => {
  const problemSetId = (payload.problem_set_id ?? payload.problemSetId) as string;
  if (!problemSetId) return { success: false, error: 'problem_set_id is required' };

  const { decisionStore } = await import('../decisions/decision-store.js');
  const decisions = await decisionStore.getByProblemSet(problemSetId, {
    decision_type: 'pir_alert',
  });

  return {
    success: true,
    alerts: decisions.map((d) => ({
      decisionId: d.id,
      title: d.title,
      status: d.status,
      pirId: (d.context_json as Record<string, unknown>).pirId,
      pirType: (d.context_json as Record<string, unknown>).pirType,
      pirPriority: (d.context_json as Record<string, unknown>).pirPriority,
      suggestedAnswer: (d.context_json as Record<string, unknown>).suggestedAnswer,
      decidedBy: d.decided_by,
      decidedAt: d.decided_at,
      createdAt: d.created_at,
    })),
    total: decisions.length,
    pending: decisions.filter((d) => d.status === 'pending').length,
    approved: decisions.filter((d) => d.status === 'approved').length,
    rejected: decisions.filter((d) => d.status === 'rejected').length,
  };
};

// ---------------------------------------------------------------------------
// Autonomous Intelligence Handlers (Phase 65 Plan 02)
// ---------------------------------------------------------------------------

const intelWebSearch: ActionHandler = async (payload, _userDid) => {
  const query = payload.query as string;
  if (!query) return { success: false, error: 'query is required' };

  const { performWebSearch } = await import('../doc-intelligence/web-search.js');
  const maxResults = (payload.max_results as number | undefined) ?? 5;
  const results = await performWebSearch(query, maxResults);
  return { success: true, results, count: results.length };
};

const intelCreateResearchEvent: ActionHandler = async (payload, userDid) => {
  const problemSetId = (payload.problem_set_id ?? payload.problemSetId) as string;
  const title = payload.title as string;
  const content = payload.content as string;
  if (!problemSetId || !title || !content) {
    return { success: false, error: 'problem_set_id, title, and content are required' };
  }

  const { osintEventStore } = await import('../graph/osint/event-store.js');
  const sourceUrl = payload.source_url as string | undefined;
  const sourceName = (payload.source_name as string | undefined) ?? 'Ironclaw Research';

  const event = await osintEventStore.createEvent({
    title,
    description: content,
    sourceType: 'other',
    sourceUrl,
    sourceName,
    publishedAt: new Date(),
    actors: [],
    tags: ['ironclaw-research'],
    workspaceId: problemSetId,
    metadata: { feedId: 'ironclaw-autonomous', createdBy: 'ironclaw' },
  });

  await emitDataUpdated(problemSetId, userDid, 'intel', 'osint');
  return { success: true, eventId: event.id, event };
};

const intelProcessOsintEvent: ActionHandler = async (payload, userDid) => {
  const eventId = (payload.event_id ?? payload.eventId) as string;
  const problemSetId = (payload.problem_set_id ?? payload.problemSetId) as string;
  if (!eventId || !problemSetId) {
    return { success: false, error: 'event_id and problem_set_id are required' };
  }

  const { osintEventStore } = await import('../graph/osint/event-store.js');
  const event = await osintEventStore.getEvent(eventId);
  if (!event) return { success: false, error: `Event ${eventId} not found` };

  const { processOSINTEventThroughAgents } = await import('../osint/osint-agent-bridge.js');

  // Build a synthetic feed config for pipeline routing (cast: 'simulated' is a valid FeedSourceType)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const syntheticFeed: any = {
    id: 'ironclaw-autonomous',
    problemSetId,
    sourceName: event.sourceName,
    sourceType: 'simulated',
    endpointUrl: null,
    pollingIntervalMs: 0,
    relevanceMode: 'ai_semantic',
    active: true,
    scope: 'local',
    config: {},
    createdAt: new Date(),
  };

  const stats = await processOSINTEventThroughAgents(event, syntheticFeed);
  await emitDataUpdated(problemSetId, userDid, 'intel', 'osint');
  return { success: true, eventId, ...stats };
};

const intelDetectConflicts: ActionHandler = async (payload, _userDid) => {
  const problemSetId = (payload.problem_set_id ?? payload.problemSetId) as string;
  if (!problemSetId) return { success: false, error: 'problem_set_id is required' };

  const entityName = payload.entity_name as string | undefined;
  const { executeReadQuery } = await import('../graph/neo4j-client.js');

  // Query for relationships with opposing sentiment between actors in this PS slice
  const actorFilter = entityName
    ? 'AND (a.name CONTAINS $entityName OR b.name CONTAINS $entityName)'
    : '';

  const conflictQuery = `
    MATCH (a:Actor)-[r1:RELATES_TO]->(b:Actor)
    WHERE $psId IN a.containerIds
      ${actorFilter}
    WITH a, b, collect(r1) AS rels
    WHERE size(rels) > 1
    RETURN
      a.name AS entityA,
      b.name AS entityB,
      [r IN rels | {type: r.type, sentiment: r.sentiment, source: r.source}] AS relationships
    LIMIT 50
  `;

  const params: Record<string, unknown> = { psId: problemSetId };
  if (entityName) params.entityName = entityName;

  const result = await executeReadQuery(conflictQuery, params);

  const conflicts = result.records
    .map((rec) => {
      const rels = rec.get('relationships') as Array<{ type: string; sentiment: string; source: string }>;
      const sentiments = rels.map((r) => r.sentiment).filter(Boolean);
      const hasConflict = sentiments.includes('positive') && sentiments.includes('negative');
      if (!hasConflict) return null;

      return {
        entity: rec.get('entityA') as string,
        relatedEntity: rec.get('entityB') as string,
        claim_a: rels.find((r) => r.sentiment === 'positive'),
        claim_b: rels.find((r) => r.sentiment === 'negative'),
      };
    })
    .filter(Boolean);

  return { success: true, conflicts, conflictCount: conflicts.length };
};

const intelDraftSituationAssessment: ActionHandler = async (payload, _userDid) => {
  const problemSetId = (payload.problem_set_id ?? payload.problemSetId) as string;
  if (!problemSetId) return { success: false, error: 'problem_set_id is required' };

  const timeWindowHours = (payload.time_window_hours as number | undefined) ?? 24;
  const focusArea = payload.focus_area as string | undefined;
  const since = new Date(Date.now() - timeWindowHours * 60 * 60 * 1000);

  // Gather recent OSINT events
  const { osintEventStore } = await import('../graph/osint/event-store.js');
  const { events: recentEvents } = await osintEventStore.listEvents({
    workspaceId: problemSetId,
    startDate: since,
    limit: 20,
  });

  // Gather active PIRs
  const { pirStore } = await import('../design/pir-store.js');
  const activePIRs = await pirStore.listPIRs(problemSetId, { status: 'ACTIVE' });

  // Gather recent intelligence gaps
  const { brainStore } = await import('../brain/brain-store.js');
  const gapReport = await brainStore.getIntelligenceGaps(problemSetId);

  const keyDevelopments = recentEvents.map((e) => ({
    title: e.title,
    source: e.sourceName,
    publishedAt: e.publishedAt,
    actors: e.actors,
  }));

  const intelligenceGaps = gapReport.gaps.slice(0, 10).map((g) => ({
    entity: g.nodeLabel,
    nodeType: g.nodeType,
    missingConnectionTypes: g.missingConnectionTypes,
    actualConnections: g.actualConnections,
  }));

  const recommendedActions = activePIRs.slice(0, 5).map((p) => ({
    pirId: p.id,
    type: p.type,
    description: p.description,
    priority: p.priority,
  }));

  return {
    success: true,
    assessment: {
      problemSetId,
      timeWindow: `${timeWindowHours}h`,
      focusArea: focusArea ?? 'general',
      generatedAt: new Date().toISOString(),
      keyDevelopments,
      intelligenceGaps,
      recommendedActions,
      eventCount: recentEvents.length,
      activePIRCount: activePIRs.length,
    },
  };
};

const autonomousLogActivity: ActionHandler = async (payload, userDid) => {
  const problemSetId = (payload.problem_set_id ?? payload.problemSetId) as string;
  const activityType = (payload.activity_type ?? payload.activityType) as string;
  const severity = payload.severity as string;
  const summary = payload.summary as string;
  if (!problemSetId || !activityType || !severity || !summary) {
    return { success: false, error: 'problem_set_id, activity_type, severity, and summary are required' };
  }

  const { autonomousActivityStore } = await import('./autonomous-activity-store.js');
  const entry = await autonomousActivityStore.log({
    problemSetId,
    activityType,
    severity: severity as 'critical' | 'urgent' | 'routine' | 'informational',
    summary,
    detail: (payload.detail as Record<string, unknown>) ?? {},
  });

  // Push to WebSocket via message bus
  try {
    const { getMessageBus } = await import('../messaging/message-bus.js');
    const bus = getMessageBus();
    await bus.publish({
      sourceDid: 'did:bastion:ironclaw',
      sourceType: 'system',
      destinationType: 'channel',
      destinationTarget: `ironclaw.${problemSetId}`,
      messageType: 'ironclaw.autonomous-activity',
      payload: { entry },
    });
  } catch { /* notification is non-fatal */ }

  await emitDataUpdated(problemSetId, userDid, 'intel', 'activity');
  return { success: true, entryId: entry.id, entry };
};

const autonomousSendAlert: ActionHandler = async (payload, userDid) => {
  const problemSetId = (payload.problem_set_id ?? payload.problemSetId) as string;
  const message = payload.message as string;
  const severity = payload.severity as string;
  if (!problemSetId || !message || !severity) {
    return { success: false, error: 'problem_set_id, message, and severity are required' };
  }

  // Always push to WebSocket
  try {
    const { getMessageBus } = await import('../messaging/message-bus.js');
    const bus = getMessageBus();
    await bus.publish({
      sourceDid: 'did:bastion:ironclaw',
      sourceType: 'system',
      destinationType: 'channel',
      destinationTarget: `ironclaw.${problemSetId}`,
      messageType: 'ironclaw.alert',
      payload: { message, severity, problemSetId, sentAt: new Date().toISOString() },
    });
  } catch { /* WebSocket push is non-fatal */ }

  // Telegram for critical/urgent — send directly to all paired chat IDs
  let telegramSent = false;
  if (severity === 'critical' || severity === 'urgent') {
    try {
      const { telegramBotService } = await import('./telegram-bot-service.js');
      const { getPool } = await import('../lib/database.js');
      const pool = getPool();

      const notificationFilter = severity === 'critical'
        ? "telegram_enabled = true AND telegram_chat_id IS NOT NULL"
        : "telegram_enabled = true AND telegram_chat_id IS NOT NULL AND telegram_notification_level IN ('Critical', 'Urgent', 'Routine')";

      const result = await pool.query(
        `SELECT telegram_chat_id FROM agent_config WHERE ${notificationFilter}`,
      );

      const severityEmoji = severity === 'critical' ? '\u{1F6A8}' : '\u26a0\ufe0f';
      const title = (payload.title as string) ?? 'Ironclaw Alert';

      for (const row of result.rows) {
        const chatId = row.telegram_chat_id as string;
        await telegramBotService.sendNotification(
          chatId,
          `${severityEmoji} *${severity.toUpperCase()} ALERT*\n\n${title}\n\n${message.slice(0, 1000)}\n\nReview in BASTION.`,
        );
      }
      telegramSent = result.rows.length > 0;
    } catch (err) {
      console.warn('[autonomousSendAlert] Telegram delivery failed:', err);
    }
  }

  await emitDataUpdated(problemSetId, userDid, 'intel', 'alert');
  return { success: true, severity, telegramSent };
};

// ---------------------------------------------------------------------------
// Brain Curation Handlers (Phase 65 Plan 02)
// ---------------------------------------------------------------------------

const brainEvaluateRelevance: ActionHandler = async (payload, _userDid) => {
  const problemSetId = (payload.problem_set_id ?? payload.problemSetId) as string;
  if (!problemSetId) return { success: false, error: 'problem_set_id is required' };

  const maxCandidates = (payload.max_candidates as number | undefined) ?? 20;
  const { executeReadQuery } = await import('../graph/neo4j-client.js');

  // Find actors NOT in this PS's slice but connected to actors that ARE
  const candidatesQuery = `
    MATCH (sliceActor:Actor)
    WHERE $psId IN sliceActor.containerIds
    WITH collect(sliceActor.id) AS sliceIds, collect(sliceActor.name) AS sliceNames

    MATCH (candidate:Actor)
    WHERE NOT $psId IN coalesce(candidate.containerIds, [])

    OPTIONAL MATCH (candidate)-[r:RELATES_TO]-(connected:Actor)
    WHERE connected.id IN sliceIds

    WITH candidate, count(r) AS connectionCount, sliceNames
    WHERE connectionCount > 0

    RETURN
      candidate.id AS id,
      candidate.name AS name,
      candidate.type AS type,
      connectionCount,
      coalesce(candidate.updatedAt, '') AS updatedAt
    ORDER BY connectionCount DESC
    LIMIT $limit
  `;

  const result = await executeReadQuery(candidatesQuery, {
    psId: problemSetId,
    limit: maxCandidates,
  });

  const candidates = result.records.map((rec) => ({
    actorId: rec.get('id') as string,
    actorName: rec.get('name') as string,
    actorType: rec.get('type') as string,
    connectionCount: (rec.get('connectionCount') as { toNumber?: () => number }).toNumber?.() ?? rec.get('connectionCount') as number,
    reason: `Connected to ${(rec.get('connectionCount') as { toNumber?: () => number }).toNumber?.() ?? rec.get('connectionCount')} actors already in this problem set's brain slice`,
    updatedAt: rec.get('updatedAt') as string,
  }));

  return { success: true, candidates, count: candidates.length };
};

const brainAugmentSlice: ActionHandler = async (payload, userDid) => {
  const problemSetId = (payload.problem_set_id ?? payload.problemSetId) as string;
  const actorIds = payload.actor_ids as string[];
  const reason = payload.reason as string;
  if (!problemSetId || !actorIds || !Array.isArray(actorIds) || !reason) {
    return { success: false, error: 'problem_set_id, actor_ids (array), and reason are required' };
  }

  const { executeWriteQuery } = await import('../graph/neo4j-client.js');

  // Add problemSetId to containerIds for each actor (no duplicates)
  const augmentQuery = `
    UNWIND $actorIds AS actorId
    MATCH (a:Actor {id: actorId})
    SET a.containerIds = CASE
      WHEN $psId IN coalesce(a.containerIds, [])
      THEN a.containerIds
      ELSE coalesce(a.containerIds, []) + [$psId]
    END
    RETURN a.id AS id, a.name AS name
  `;

  const result = await executeWriteQuery(augmentQuery, {
    actorIds,
    psId: problemSetId,
  });

  const augmented = result.records.map((rec) => ({
    actorId: rec.get('id') as string,
    actorName: rec.get('name') as string,
  }));

  // Log the augmentation
  try {
    const { autonomousActivityStore } = await import('./autonomous-activity-store.js');
    await autonomousActivityStore.log({
      problemSetId,
      activityType: 'brain_augmentation',
      severity: 'informational',
      summary: `Added ${augmented.length} actor(s) to brain slice: ${reason}`,
      detail: { actorIds, reason, augmented },
    });
  } catch { /* logging is non-fatal */ }

  await emitDataUpdated(problemSetId, userDid, 'brain');
  return { success: true, augmented, count: augmented.length, reason };
};

const brainPruneSlice: ActionHandler = async (payload, userDid) => {
  const problemSetId = (payload.problem_set_id ?? payload.problemSetId) as string;
  const actorIds = payload.actor_ids as string[];
  const reason = payload.reason as string;
  if (!problemSetId || !actorIds || !Array.isArray(actorIds) || !reason) {
    return { success: false, error: 'problem_set_id, actor_ids (array), and reason are required' };
  }

  const { executeWriteQuery } = await import('../graph/neo4j-client.js');

  // Remove problemSetId from containerIds — does NOT delete the actor globally
  const pruneQuery = `
    UNWIND $actorIds AS actorId
    MATCH (a:Actor {id: actorId})
    SET a.containerIds = [x IN coalesce(a.containerIds, []) WHERE x <> $psId]
    RETURN a.id AS id, a.name AS name
  `;

  const result = await executeWriteQuery(pruneQuery, {
    actorIds,
    psId: problemSetId,
  });

  const pruned = result.records.map((rec) => ({
    actorId: rec.get('id') as string,
    actorName: rec.get('name') as string,
  }));

  // Log the pruning
  try {
    const { autonomousActivityStore } = await import('./autonomous-activity-store.js');
    await autonomousActivityStore.log({
      problemSetId,
      activityType: 'brain_pruning',
      severity: 'informational',
      summary: `Removed ${pruned.length} actor(s) from brain slice: ${reason}`,
      detail: { actorIds, reason, pruned },
    });
  } catch { /* logging is non-fatal */ }

  await emitDataUpdated(problemSetId, userDid, 'brain');
  return { success: true, pruned, count: pruned.length, reason };
};

const brainGetSliceStats: ActionHandler = async (payload, _userDid) => {
  const problemSetId = (payload.problem_set_id ?? payload.problemSetId) as string;
  if (!problemSetId) return { success: false, error: 'problem_set_id is required' };

  const { executeReadQuery } = await import('../graph/neo4j-client.js');

  // Count actors in this slice
  const sliceCountResult = await executeReadQuery(
    `MATCH (a:Actor) WHERE $psId IN coalesce(a.containerIds, []) RETURN count(a) AS cnt`,
    { psId: problemSetId },
  );
  const sliceActorCount = (sliceCountResult.records[0]?.get('cnt') as { toNumber?: () => number })?.toNumber?.() ?? 0;

  // Count global actors
  const globalCountResult = await executeReadQuery(
    `MATCH (a:Actor) RETURN count(a) AS cnt`,
    {},
  );
  const globalActorCount = (globalCountResult.records[0]?.get('cnt') as { toNumber?: () => number })?.toNumber?.() ?? 0;

  // Count relationships in slice
  const relCountResult = await executeReadQuery(
    `MATCH (a:Actor)-[r:RELATES_TO]->(b:Actor)
     WHERE $psId IN coalesce(a.containerIds, []) AND $psId IN coalesce(b.containerIds, [])
     RETURN count(r) AS cnt`,
    { psId: problemSetId },
  );
  const sliceRelCount = (relCountResult.records[0]?.get('cnt') as { toNumber?: () => number })?.toNumber?.() ?? 0;

  // Oldest updatedAt in slice (staleness)
  const stalenessResult = await executeReadQuery(
    `MATCH (a:Actor) WHERE $psId IN coalesce(a.containerIds, [])
     RETURN min(a.updatedAt) AS oldest`,
    { psId: problemSetId },
  );
  const oldestUpdatedAt = stalenessResult.records[0]?.get('oldest') as string | null;

  // Orphans (actors in slice with no relationships to other slice actors)
  const orphanResult = await executeReadQuery(
    `MATCH (a:Actor) WHERE $psId IN coalesce(a.containerIds, [])
     OPTIONAL MATCH (a)-[r:RELATES_TO]-(b:Actor)
     WHERE $psId IN coalesce(b.containerIds, [])
     WITH a, count(r) AS rels
     WHERE rels = 0
     RETURN count(a) AS cnt`,
    { psId: problemSetId },
  );
  const orphanCount = (orphanResult.records[0]?.get('cnt') as { toNumber?: () => number })?.toNumber?.() ?? 0;

  return {
    success: true,
    stats: {
      problemSetId,
      sliceActorCount,
      globalActorCount,
      sliceRelationshipCount: sliceRelCount,
      oldestUpdatedAt,
      orphanCount,
      coveragePercent: globalActorCount > 0
        ? Math.round((sliceActorCount / globalActorCount) * 100 * 10) / 10
        : 0,
    },
  };
};

// ---------------------------------------------------------------------------
// Handler registry
// ---------------------------------------------------------------------------

/**
 * Maps action type strings to their handler functions.
 */
export const BUILDER_HANDLERS: Record<string, ActionHandler> = {
  // Agent CRUD (5) — both short and bastion-prefixed names for MCP compatibility
  'agent.create': agentCreate,
  'agent.update': agentUpdate,
  'agent.delete': agentDelete,
  'agent.activate': agentActivate,
  'agent.deactivate': agentDeactivate,
  'bastion_agent_create': agentCreate,
  'bastion_agent_list': agentList,
  // Tool CRUD (4)
  'tool.create': toolCreate,
  'tool.update': toolUpdate,
  'tool.delete': toolDelete,
  'tool.assign_to_agent': toolAssignToAgent,
  // Team CRUD (5) — both short and bastion-prefixed names for MCP compatibility
  'team.create': teamCreate,
  'team.update': teamUpdate,
  'team.delete': teamDelete,
  'team.add_member': teamAddMember,
  'team.remove_member': teamRemoveMember,
  'bastion_team_create': teamCreate,
  'bastion_team_add_member': teamAddMember,
  'bastion_team_assign_task': teamAssignTask,
  // Design interview (1)
  'design.update_section': designUpdateSection,
  // Map overlay (6)
  'design.map.add_symbol': designMapAddSymbol,
  'design.map.move_symbol': designMapMoveSymbol,
  'design.map.remove_symbol': designMapRemoveSymbol,
  'design.map.update_symbol': designMapUpdateSymbol,
  'design.map.add_control_measure': designMapAddControlMeasure,
  'design.map.add_overlay_graphic': designMapAddOverlayGraphic,
  // Skill CRUD (5) — both short and bastion-prefixed names for MCP compatibility
  'skill.create': skillCreate,
  'skill.update': skillUpdate,
  'skill.delete': skillDelete,
  'skill.assign': skillAssign,
  'skill.unassign': skillUnassign,
  'bastion_skill_create': skillCreate,
  // Design synthesis
  'bastion_design_synthesize_current_state': designSynthesizeCurrentState,
  // Knowledge graph (4)
  'bastion_graph_search_actors': graphSearchActors,
  'bastion_graph_get_actor': graphGetActor,
  'bastion_graph_query': graphQuery,
  'bastion_graph_stats': graphStats,
  // Intelligence gap monitoring (4)
  'bastion_intel_get_intelligence_gaps': intelGetGaps,
  'bastion_intel_get_gap_filler_status': intelGetGapFillerStatus,
  'bastion_intel_prioritize_gap_research': intelPrioritizeGap,
  'bastion_intel_request_targeted_research': intelRequestTargetedResearch,
  // PIR/CCIR management (4)
  'bastion_intel_get_priority_intel_requirements': intelGetPIRs,
  'bastion_intel_create_pir_from_assumption': intelCreatePIRFromAssumption,
  'bastion_intel_answer_pir': intelAnswerPIR,
  'bastion_intel_derive_pirs_from_design': intelDerivePIRsFromDesign,
  // PIR Alert tools (2)
  'bastion_intel_create_pir_alert': intelCreatePIRAlert,
  'bastion_intel_get_pir_alert_history': intelGetPIRAlertHistory,
  // Autonomous intelligence tools (Phase 65 Plan 02)
  'bastion_intel_web_search': intelWebSearch,
  'bastion_intel_create_research_event': intelCreateResearchEvent,
  'bastion_intel_process_osint_event': intelProcessOsintEvent,
  'bastion_intel_detect_conflicts': intelDetectConflicts,
  'bastion_intel_draft_situation_assessment': intelDraftSituationAssessment,
  'bastion_autonomous_log_activity': autonomousLogActivity,
  'bastion_autonomous_send_alert': autonomousSendAlert,
  // Brain curation tools (Phase 65 Plan 02)
  'bastion_brain_evaluate_relevance': brainEvaluateRelevance,
  'bastion_brain_augment_slice': brainAugmentSlice,
  'bastion_brain_prune_slice': brainPruneSlice,
  'bastion_brain_get_slice_stats': brainGetSliceStats,
  // Knowledge domain tools (Phase 60 Plan 02 MCP tools)
  'bastion_knowledge_search': knowledgeSearch,
  'bastion_knowledge_get_entity': knowledgeGetEntity,
  'bastion_knowledge_get_relationships': knowledgeGetRelationships,
  'bastion_knowledge_search_documents': knowledgeSearchDocuments,
  // Problem set CRUD (BASTION_TOOLS)
  'bastion_problem_set_read': problemSetRead,
  'bastion_problem_set_list_children': problemSetListChildren,
  'bastion_problem_set_update_field': problemSetUpdateField,
  'bastion_problem_set_create_child': problemSetCreateChild,
  'bastion_problem_set_configure_agents': problemSetConfigureAgents,
  // Resource tools (BASTION_TOOLS + MCP resources domain)
  'bastion_resource_create': resourceCreate,
  'bastion_resource_delete': resourceDelete,
  'bastion_resources_list': resourcesList,
  'bastion_resources_get_status': resourcesGetStatus,
  'bastion_resources_search_capabilities': resourcesSearchCapabilities,
  // Gate tools (BASTION_TOOLS)
  'bastion_gate_create': gateCreate,
  // Code / GitHub PR (BASTION_TOOLS)
  'bastion_code_create_pr': codeCreatePR,
  // Design section update (BASTION_TOOLS)
  'bastion_design_update_section': designUpdateSection,
  // System config (BASTION_TOOLS)
  'bastion_system_update_config': systemUpdateConfig,
  // Operations domain (MCP operations tools)
  'bastion_ops_get_problem_set': opsGetProblemSet,
  'bastion_ops_list_problem_sets': opsListProblemSets,
  'bastion_ops_get_operational_design': opsGetOperationalDesign,
  'bastion_ops_get_campaign_plan': opsGetCampaignPlan,
  'bastion_ops_get_coa': opsGetCOA,
  // Calendar domain (MCP calendar tools)
  'bastion_calendar_get_schedule': calendarGetSchedule,
  'bastion_calendar_get_events': calendarGetEvents,
  // Personnel domain (MCP personnel tools — clearance-gated)
  'bastion_personnel_list_staff': personnelListStaff,
  'bastion_personnel_get_member': personnelGetMember,
  'bastion_personnel_get_clearances': personnelGetClearances,
  // Cross-scope graph & objective hierarchy (5)
  'bastion_graph_get_objective_hierarchy': graphGetObjectiveHierarchy,
  'bastion_graph_adopt_objective': graphAdoptObjective,
  'bastion_graph_assess_objectives': graphAssessObjectives,
  'bastion_graph_query_global': graphQueryGlobal,
  'bastion_graph_query_parent': graphQueryParent,
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

// ---------------------------------------------------------------------------
// Startup Validation: Verify all MCP tools have handlers
// ---------------------------------------------------------------------------
// CONVENTION: Every tool in BASTION_TOOLS and MCP domain tools MUST have a
// corresponding entry in BUILDER_HANDLERS. This check runs at import time
// and logs warnings for any missing handlers so they're caught immediately.
// ---------------------------------------------------------------------------

export async function validateToolHandlerCoverage(): Promise<string[]> {
  const { BASTION_TOOLS } = await import('./tool-bridge.js');
  const { knowledgeTools } = await import('../mcp/tools/knowledge.js');
  const { operationsTools } = await import('../mcp/tools/operations.js');
  const { calendarTools } = await import('../mcp/tools/calendar.js');
  const { resourcesTools } = await import('../mcp/tools/resources.js');
  const { personnelTools } = await import('../mcp/tools/personnel.js');
  const { intelligenceTools } = await import('../mcp/tools/intelligence.js');

  const allTools = [
    ...BASTION_TOOLS, ...knowledgeTools, ...operationsTools,
    ...calendarTools, ...resourcesTools, ...personnelTools, ...intelligenceTools,
  ];

  const seen = new Set<string>();
  const missing: string[] = [];
  for (const tool of allTools) {
    if (seen.has(tool.name)) continue; // skip duplicates across groups
    seen.add(tool.name);
    if (!BUILDER_HANDLERS[tool.name]) {
      missing.push(tool.name);
    }
  }

  if (missing.length > 0) {
    console.warn(
      `[builder-handlers] WARNING: ${missing.length} MCP tool(s) have no handler in BUILDER_HANDLERS:\n` +
      missing.map((n) => `  - ${n}`).join('\n') +
      '\nIronclaw will get "No builder handler registered" errors for these tools.',
    );
  } else {
    console.log(`[builder-handlers] All ${seen.size} MCP tools have handler implementations.`);
  }

  return missing;
}
