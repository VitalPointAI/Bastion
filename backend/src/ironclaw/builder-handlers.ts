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
  cypher += ` OPTIONAL MATCH (a)-[r]-(related) RETURN a, count(r) AS relCount ORDER BY relCount DESC LIMIT $limit`;

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
    executeReadQuery('MATCH (a:Actor) OPTIONAL MATCH (a)-[r]-() RETURN a.name AS name, a.type AS type, count(r) AS rels ORDER BY rels DESC LIMIT 15', {}),
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
// Handler registry
// ---------------------------------------------------------------------------

/**
 * Maps action type strings to their handler functions.
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
  // Design interview (1)
  'design.update_section': designUpdateSection,
  // Map overlay (6)
  'design.map.add_symbol': designMapAddSymbol,
  'design.map.move_symbol': designMapMoveSymbol,
  'design.map.remove_symbol': designMapRemoveSymbol,
  'design.map.update_symbol': designMapUpdateSymbol,
  'design.map.add_control_measure': designMapAddControlMeasure,
  'design.map.add_overlay_graphic': designMapAddOverlayGraphic,
  // Skill CRUD (5)
  'skill.create': skillCreate,
  'skill.update': skillUpdate,
  'skill.delete': skillDelete,
  'skill.assign': skillAssign,
  'skill.unassign': skillUnassign,
  // Design synthesis
  'bastion.design.synthesize_current_state': designSynthesizeCurrentState,
  // Knowledge graph (4)
  'bastion.graph.search_actors': graphSearchActors,
  'bastion.graph.get_actor': graphGetActor,
  'bastion.graph.query': graphQuery,
  'bastion.graph.stats': graphStats,
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
