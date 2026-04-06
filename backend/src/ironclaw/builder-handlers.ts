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
    return { skillId: skill.skillId, status: 'created_db_only' };
  }
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
// Design Interview Handlers
// ---------------------------------------------------------------------------

const designUpdateSection: ActionHandler = async (payload, _userDid) => {
  const problemSetId = requireField<string>(payload, 'problem_set_id');
  const section = requireField<string>(payload, 'section');
  const data = requireField<Record<string, unknown>>(payload, 'data');

  const { designStore } = await import('../design/design-store.js');
  const result = await designStore.updateSection(problemSetId, section, data);

  // Publish WebSocket event for real-time frontend updates
  try {
    const { getMessageBus } = await import('../messaging/message-bus.js');
    const bus = getMessageBus();
    await bus.publish({
      sourceDid: 'system:ironclaw',
      sourceType: 'system',
      destinationType: 'channel',
      destinationTarget: `ironclaw.${problemSetId}`,
      messageType: 'design.section_updated',
      payload: { section, data, source: 'interview' },
    });
  } catch (err) {
    // Non-blocking: log but don't fail the action
    console.warn('[builder-handlers] Failed to publish design.section_updated WS event:', err);
  }

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

const designMapAddSymbol: ActionHandler = async (payload, _userDid) => {
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

  return { success: true, symbolId: symbol.id };
};

const designMapMoveSymbol: ActionHandler = async (payload, _userDid) => {
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

  return { success: true };
};

const designMapRemoveSymbol: ActionHandler = async (payload, _userDid) => {
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

  return { success: true };
};

const designMapUpdateSymbol: ActionHandler = async (payload, _userDid) => {
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

  return { success: true };
};

const designMapAddControlMeasure: ActionHandler = async (payload, _userDid) => {
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

  return { success: true, measureId: measure.id };
};

const designMapAddOverlayGraphic: ActionHandler = async (payload, _userDid) => {
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

  return { success: true, measureId: measure.id };
};

// ---------------------------------------------------------------------------
// Dispatch Map
// ---------------------------------------------------------------------------
// Design Synthesis Handler
// ---------------------------------------------------------------------------

const designSynthesizeCurrentState: ActionHandler = async (payload) => {
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
  cypher += ` RETURN a, size((a)--()) AS relCount ORDER BY relCount DESC LIMIT $limit`;

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
    return { success: false, error: `Actor "${name}" not found` };
  }

  const rec = result.records[0];
  const actor = rec.get('a').properties;
  const rels = rec.get('relationships');
  return { success: true, result: { ...actor, relationships: rels } };
}

const graphQuery: ActionHandler = async (payload) => {
  const { executeReadQuery } = await import('../graph/neo4j-client.js');
  const cypher = (payload.cypher as string) ?? '';

  // Safety: block any write operations
  const normalized = cypher.toUpperCase().replace(/\s+/g, ' ');
  if (/\b(CREATE|DELETE|SET|REMOVE|MERGE|DROP|DETACH)\b/.test(normalized)) {
    return { success: false, error: 'Write operations are not allowed. Use MATCH/RETURN only.' };
  }

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
}

const graphStats: ActionHandler = async () => {
  const { executeReadQuery } = await import('../graph/neo4j-client.js');

  const [totalNodes, totalRels, types, topActors] = await Promise.all([
    executeReadQuery('MATCH (n) RETURN count(n) AS count', {}),
    executeReadQuery('MATCH ()-[r]-() RETURN count(r) AS count', {}),
    executeReadQuery('MATCH (n) RETURN DISTINCT labels(n) AS labels, count(n) AS count ORDER BY count DESC', {}),
    executeReadQuery('MATCH (a:Actor) RETURN a.name AS name, a.type AS type, size((a)--()) AS rels ORDER BY rels DESC LIMIT 15', {}),
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
  cypher += ` RETURN a, size((a)--()) AS relCount ORDER BY relCount DESC LIMIT $limit`;

  const result = await executeReadQuery(cypher, { query, entityType: entityType ?? '', limit });
  const entities = result.records.map((rec) => {
    const a = rec.get('a').properties as Record<string, unknown>;
    return { id: a.id, name: a.name, type: a.type, description: a.description, relationshipCount: rec.get('relCount').toInt() };
  });
  return { success: true, result: entities };
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

  const result = await executeReadQuery(cypher, { entityId });
  if (result.records.length === 0) {
    return { success: false, error: `Entity "${entityId}" not found` };
  }
  const rec = result.records[0];
  const actor = rec.get('a').properties;
  const rels = includeRelationships ? rec.get('relationships') : [];
  return { success: true, result: { ...actor, relationships: rels } };
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

  const result = await executeReadQuery(cypher, { entityId, relType: relType ?? '', limit });
  const rels = result.records.map((rec) => ({
    type: rec.get('relType'),
    target: rec.get('target'),
    targetType: rec.get('targetType'),
    properties: rec.get('props'),
  }));
  return { success: true, result: rels };
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

  const result = await pool.query(sql, params);
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

const graphAdoptObjective: ActionHandler = async (payload) => {
  const { objectiveStore } = await import('../strategic/objectives/store.js');
  const sourceObjectiveId = (payload.source_objective_id ?? payload.sourceObjectiveId) as string;
  const targetWorkspaceId = (payload.target_workspace_id ?? payload.targetWorkspaceId) as string;
  if (!sourceObjectiveId || !targetWorkspaceId) {
    return { success: false, error: 'source_objective_id and target_workspace_id are required' };
  }

  const objective = await objectiveStore.adoptObjective(sourceObjectiveId, targetWorkspaceId);
  return { success: true, result: objective };
};

const graphAssessObjectives: ActionHandler = async (payload) => {
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

  cypher += ' RETURN a, size((a)--()) AS relCount ORDER BY relCount DESC LIMIT $limit';

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
    RETURN a, size((a)--()) AS relCount
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

const intelPrioritizeGap: ActionHandler = async (payload) => {
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

const intelRequestTargetedResearch: ActionHandler = async (payload) => {
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

const intelCreatePIRFromAssumption: ActionHandler = async (payload) => {
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

  return { success: true, pir };
};

const intelAnswerPIR: ActionHandler = async (payload) => {
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
  return { success: true, pir };
};

const intelDerivePIRsFromDesign: ActionHandler = async (payload) => {
  const problemSetId = (payload.problem_set_id ?? payload.problemSetId) as string;
  if (!problemSetId) return { success: false, error: 'problem_set_id is required' };

  const { pirToolHandlers } = await import('../graph/tools/intelligence-gap-tools.js');
  return await pirToolHandlers.derive_pirs_from_design({ problemSetId });
};

// ---------------------------------------------------------------------------
// PIR Alert Handlers
// ---------------------------------------------------------------------------

const intelCreatePIRAlert: ActionHandler = async (payload, _userDid) => {
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

const intelCreateResearchEvent: ActionHandler = async (payload, _userDid) => {
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

  return { success: true, eventId: event.id, event };
};

const intelProcessOsintEvent: ActionHandler = async (payload, _userDid) => {
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

const autonomousLogActivity: ActionHandler = async (payload, _userDid) => {
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

  return { success: true, entryId: entry.id, entry };
};

const autonomousSendAlert: ActionHandler = async (payload, _userDid) => {
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

const brainAugmentSlice: ActionHandler = async (payload, _userDid) => {
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

  return { success: true, augmented, count: augmented.length, reason };
};

const brainPruneSlice: ActionHandler = async (payload, _userDid) => {
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
