/**
 * Agent Registry
 *
 * Manages AI governance agents, delegations, and action audit trails.
 * Implements trust tier management and permission checking for agent actions.
 *
 * Phase 51: Backed by AgentStore (PostgreSQL) with a write-through in-memory cache
 * so that synchronous callers (api/agents.ts, executor.ts, etc.) continue to work
 * without code changes. Writes go to both cache and DB; reads hit cache after
 * initialization.
 */

import { randomUUID } from 'crypto';
import {
  AgentAction,
  AgentCapability,
  AgentCharacter,
  AgentDelegation,
  AgentManifest,
  AgentPhase,
  AutonomyLevel,
  ProposalKind,
} from './types.js';
import { CharacterSchema } from './character-schema.js';
import { Proposal } from '../dao/types.js';
import { createAgentDID } from './agent-did.js';
import { canActivateAgent } from '../validation/activation-gate.js';
import { getAgentStore } from './agent-store.js';
import { toStandardAgent } from './standard-agent.js';
import type { StandardAgent } from './standard-agent.js';

/**
 * Agent Registry - manages agent lifecycle, delegations, and audit trail.
 *
 * Storage: write-through cache (Map) + AgentStore (PostgreSQL).
 * On startup the registry loads all agents from the DB into the cache so that
 * synchronous reads work without breaking existing callers.
 */
export class AgentRegistry {
  // Write-through cache: agentId -> StandardAgent (superset of AgentManifest)
  private agents: Map<string, StandardAgent> = new Map();
  private delegations: Map<string, AgentDelegation[]> = new Map();
  private messengers: Map<string, unknown> = new Map(); // AgentMessenger instances
  private initialized: boolean = false;
  private initPromise: Promise<void> | null = null;

  constructor() {
    // Start async initialization
    this.initPromise = this.initialize();
  }

  /**
   * Initialize the registry asynchronously.
   * Loads existing agents from the DB, then registers default agents.
   */
  private async initialize(): Promise<void> {
    if (this.initialized) return;
    try {
      // Load existing agents from DB into cache
      const store = getAgentStore();
      const existing = await store.listAgents();
      for (const agent of existing) {
        this.agents.set(agent.agentId, agent);
      }
      // Register defaults (idempotent — skips if already in cache/DB)
      await this.registerDefaultAgents();
    } catch (err) {
      console.warn('[AgentRegistry] init warning (DB may not be ready yet):', err instanceof Error ? err.message : err);
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
  // Agent Registration
  // ==========================================================================

  /**
   * Register a new agent.
   * Automatically generates DID if not provided.
   * Returns the registered manifest with DID fields populated.
   * Upserts to DB (idempotent — safe to call multiple times for same agent).
   */
  async registerAgent(manifest: AgentManifest): Promise<AgentManifest> {
    // Generate DID if not provided
    if (!manifest.agentDID) {
      const didResult = await createAgentDID(manifest.agentId);
      manifest.agentDID = didResult.did;
      manifest.agentBlindedKey = didResult.blindedKey;
      manifest.agentPublicKey = didResult.publicKey;
    }

    // Activation gate: check test fixture requirements before allowing active status.
    if (manifest.active) {
      try {
        const gate = await canActivateAgent(manifest.agentId, manifest.agentId);
        if (!gate.allowed) {
          console.warn(
            `[AgentRegistry] Activation gate: agent ${manifest.agentId} set inactive — ${gate.reason}`,
          );
          manifest.active = false;
        }
      } catch (err) {
        // Gate check failure should not prevent registration
        console.warn(
          `[AgentRegistry] Activation gate check failed for ${manifest.agentId}:`,
          err instanceof Error ? err.message : err,
        );
      }
    }

    // Convert to StandardAgent and persist
    const existing = this.agents.get(manifest.agentId);
    const sa = toStandardAgent(manifest, existing ? {
      // Preserve existing health metrics and StandardAgent extras
      systemPrompt: existing.systemPrompt,
      clearance: existing.clearance,
      skills: existing.skills,
      status: manifest.active ? 'active' : 'inactive',
      lastInvocation: existing.lastInvocation,
      successRate: existing.successRate,
      avgResponseTimeMs: existing.avgResponseTimeMs,
      validationScore: existing.validationScore,
    } : undefined);

    // Write-through: update cache
    this.agents.set(manifest.agentId, sa);

    // Persist to DB (upsert)
    try {
      const store = getAgentStore();
      await store.registerAgent(sa);
    } catch (err) {
      console.warn(`[AgentRegistry] DB persist failed for ${manifest.agentId}:`, err instanceof Error ? err.message : err);
    }

    return sa;
  }

  /**
   * Get an agent by ID.
   * Returns from cache (populated at startup from DB).
   */
  getAgent(agentId: string): StandardAgent | undefined {
    return this.agents.get(agentId);
  }

  /**
   * Get an agent by DID.
   */
  getAgentByDID(did: string): AgentManifest | undefined {
    for (const agent of this.agents.values()) {
      if (agent.agentDID === did) {
        return agent;
      }
    }
    return undefined;
  }

  /**
   * List all agents, optionally filtered by phase.
   */
  listAgents(phase?: AgentPhase): AgentManifest[] {
    const agents = Array.from(this.agents.values());
    if (phase) {
      return agents.filter((a) => a.phase === phase);
    }
    return agents;
  }

  /**
   * Activate an agent, subject to activation gate requirements.
   * Updates status in cache and DB.
   */
  async activateAgent(
    agentId: string,
  ): Promise<{ allowed: boolean; reason?: string }> {
    const agent = this.agents.get(agentId);
    if (!agent) {
      throw new Error(`Agent ${agentId} not found`);
    }

    const gate = await canActivateAgent(agentId, agentId);
    if (!gate.allowed) {
      return gate;
    }

    agent.active = true;
    agent.status = 'active';
    agent.activatedAt = new Date();
    this.agents.set(agentId, agent);

    // Persist to DB
    try {
      const store = getAgentStore();
      await store.updateAgent(agentId, { active: true, status: 'active', activatedAt: new Date() });
    } catch (err) {
      console.warn(`[AgentRegistry] DB update failed for ${agentId}:`, err instanceof Error ? err.message : err);
    }

    return { allowed: true };
  }

  /**
   * Deactivate an agent.
   * Updates status in cache and DB.
   */
  deactivateAgent(agentId: string): void {
    const agent = this.agents.get(agentId);
    if (!agent) {
      throw new Error(`Agent ${agentId} not found`);
    }
    agent.active = false;
    agent.status = 'inactive';
    agent.deactivatedAt = new Date();
    this.agents.set(agentId, agent);

    // Cleanup messenger if exists
    this.cleanupMessenger(agentId);

    // Persist to DB (fire-and-forget)
    const store = getAgentStore();
    store.updateAgent(agentId, { active: false, status: 'inactive', deactivatedAt: new Date() }).catch((err) => {
      console.warn(`[AgentRegistry] DB update failed for ${agentId}:`, err instanceof Error ? err.message : err);
    });
  }

  // ==========================================================================
  // Messenger Management
  // ==========================================================================

  /**
   * Register a messenger for an agent.
   */
  registerMessenger(agentId: string, messenger: unknown): void {
    this.messengers.set(agentId, messenger);
  }

  /**
   * Get a registered messenger for an agent.
   */
  getMessenger(agentId: string): unknown | undefined {
    return this.messengers.get(agentId);
  }

  /**
   * Check if an agent has a messenger registered.
   */
  hasMessenger(agentId: string): boolean {
    return this.messengers.has(agentId);
  }

  /**
   * Cleanup messenger for an agent.
   */
  private cleanupMessenger(agentId: string): void {
    const messenger = this.messengers.get(agentId);
    const messengerObj = messenger as Record<string, unknown>;
    if (messenger && typeof messengerObj.cleanup === 'function') {
      (messengerObj.cleanup as () => Promise<void>)().catch((err: Error) => {
        console.error(`[AgentRegistry] Error cleaning up messenger for ${agentId}:`, err);
      });
    }
    this.messengers.delete(agentId);
  }

  // ==========================================================================
  // Character Management
  // ==========================================================================

  /**
   * Update an agent's character definition.
   * Validates the character against the CharacterSchema.
   * Persists the character to DB.
   */
  updateAgentCharacter(agentId: string, character: AgentCharacter): AgentManifest {
    const agent = this.agents.get(agentId);
    if (!agent) {
      throw new Error(`Agent ${agentId} not found`);
    }

    // Validate character
    const parseResult = CharacterSchema.safeParse(character);
    if (!parseResult.success) {
      throw new Error(`Invalid character: ${parseResult.error.message}`);
    }

    agent.character = parseResult.data as AgentCharacter;
    this.agents.set(agentId, agent);

    // Persist to DB (fire-and-forget)
    const store = getAgentStore();
    store.updateAgent(agentId, { character: parseResult.data as AgentCharacter }).catch((err) => {
      console.warn(`[AgentRegistry] DB character update failed for ${agentId}:`, err instanceof Error ? err.message : err);
    });

    return agent;
  }

  /**
   * Get an agent's character definition.
   */
  getAgentCharacter(agentId: string): AgentCharacter | undefined {
    const agent = this.agents.get(agentId);
    if (!agent) {
      throw new Error(`Agent ${agentId} not found`);
    }
    return agent.character;
  }

  /**
   * Remove an agent's character definition.
   */
  removeAgentCharacter(agentId: string): AgentManifest {
    const agent = this.agents.get(agentId);
    if (!agent) {
      throw new Error(`Agent ${agentId} not found`);
    }

    delete agent.character;
    this.agents.set(agentId, agent);

    // Persist to DB (fire-and-forget)
    const store = getAgentStore();
    store.updateAgent(agentId, { character: undefined }).catch((err) => {
      console.warn(`[AgentRegistry] DB character remove failed for ${agentId}:`, err instanceof Error ? err.message : err);
    });

    return agent;
  }

  /**
   * Check if an agent has a character definition.
   */
  hasCharacter(agentId: string): boolean {
    const agent = this.agents.get(agentId);
    return agent ? !!agent.character : false;
  }

  // ==========================================================================
  // Delegation Management
  // ==========================================================================

  /**
   * Create a new delegation for an agent.
   * Returns the delegation ID.
   * Delegations are kept in-memory (not persisted to DB — DAO governance concern).
   */
  createDelegation(
    delegation: Omit<AgentDelegation, 'delegationId' | 'createdAt' | 'revoked'>
  ): string {
    const agent = this.agents.get(delegation.agentId);
    if (!agent) {
      throw new Error(`Agent ${delegation.agentId} not found`);
    }
    if (!agent.active) {
      throw new Error(`Agent ${delegation.agentId} is not active`);
    }

    // Ensure strike auth is always excluded
    if (!delegation.scope.excludeStrikeAuth) {
      throw new Error('Delegations must exclude strike authorization');
    }

    // Ensure scope doesn't include strike authorization proposal kind
    if (delegation.scope.proposalKinds.includes(ProposalKind.StrikeAuthorization)) {
      throw new Error('Cannot delegate for strike authorization proposals');
    }

    const delegationId = randomUUID();
    const fullDelegation: AgentDelegation = {
      ...delegation,
      delegationId,
      createdAt: new Date(),
      revoked: false,
    };

    const existing = this.delegations.get(delegation.agentId) || [];
    existing.push(fullDelegation);
    this.delegations.set(delegation.agentId, existing);

    return delegationId;
  }

  /**
   * Get delegations for a specific agent.
   */
  getDelegationsForAgent(agentId: string): AgentDelegation[] {
    return (this.delegations.get(agentId) || []).filter((d) => !d.revoked);
  }

  /**
   * Get delegations created by a specific delegator.
   */
  getDelegationsForDelegator(delegatorDID: string): AgentDelegation[] {
    const allDelegations: AgentDelegation[] = [];
    for (const delegations of this.delegations.values()) {
      allDelegations.push(...delegations.filter((d) => d.delegatorDID === delegatorDID && !d.revoked));
    }
    return allDelegations;
  }

  /**
   * Get delegations for a specific DAO.
   */
  getDelegationsForDAO(daoId: string): AgentDelegation[] {
    const allDelegations: AgentDelegation[] = [];
    for (const delegations of this.delegations.values()) {
      allDelegations.push(...delegations.filter((d) => d.daoId === daoId && !d.revoked));
    }
    return allDelegations;
  }

  /**
   * Revoke a delegation.
   */
  revokeDelegation(delegationId: string): void {
    for (const [agentId, delegations] of this.delegations) {
      const delegation = delegations.find((d) => d.delegationId === delegationId);
      if (delegation) {
        delegation.revoked = true;
        this.delegations.set(agentId, delegations);
        return;
      }
    }
    throw new Error(`Delegation ${delegationId} not found`);
  }

  /**
   * Get a specific delegation by ID.
   */
  getDelegation(delegationId: string): AgentDelegation | undefined {
    for (const delegations of this.delegations.values()) {
      const delegation = delegations.find((d) => d.delegationId === delegationId);
      if (delegation) {
        return delegation;
      }
    }
    return undefined;
  }

  // ==========================================================================
  // Permission Checks
  // ==========================================================================

  /**
   * Check if an agent can act on a specific proposal.
   */
  canAgentActOnProposal(agentId: string, daoId: string, proposal: Proposal): boolean {
    const agent = this.agents.get(agentId);
    if (!agent || !agent.active) {
      return false;
    }

    // Strike authorization always blocked for agents
    if (proposal.kind === ProposalKind.StrikeAuthorization) {
      return false;
    }

    // Check if agent has a valid delegation for this DAO
    const delegations = this.getDelegationsForAgent(agentId);
    const validDelegation = delegations.find((d) => {
      if (d.daoId !== daoId) return false;
      if (d.revoked) return false;
      if (d.expiresAt && d.expiresAt < new Date()) return false;

      // Check proposal kind is in scope
      const proposalKind = typeof proposal.kind === 'string'
        ? proposal.kind as ProposalKind
        : ProposalKind.Custom;

      if (!d.scope.proposalKinds.includes(proposalKind)) return false;

      // Check classification is within scope
      const classificationOrder = ['Public', 'Secret', 'TopSecret'];
      const proposalClassIdx = classificationOrder.indexOf(proposal.classification);
      const maxClassIdx = classificationOrder.indexOf(d.scope.maxClassification);
      if (proposalClassIdx > maxClassIdx) return false;

      return true;
    });

    return !!validDelegation;
  }

  /**
   * Get the effective autonomy level for an agent acting on a proposal kind.
   */
  getEffectiveAutonomy(
    agentId: string,
    daoId: string,
    proposalKind: ProposalKind,
    daoDefaultAutonomy: AutonomyLevel = AutonomyLevel.NotAutonomous
  ): AutonomyLevel {
    // Strike auth ALWAYS returns NotAutonomous
    if (proposalKind === ProposalKind.StrikeAuthorization) {
      return AutonomyLevel.NotAutonomous;
    }

    const agent = this.agents.get(agentId);
    if (!agent) {
      return AutonomyLevel.NotAutonomous;
    }

    // Agent requires human approval for this proposal kind
    if (agent.requiresHumanApproval.includes(proposalKind)) {
      return AutonomyLevel.NotAutonomous;
    }

    // Find valid delegation
    const delegations = this.getDelegationsForAgent(agentId);
    const delegation = delegations.find(
      (d) => d.daoId === daoId && !d.revoked && d.scope.proposalKinds.includes(proposalKind)
    );

    if (!delegation) {
      return AutonomyLevel.NotAutonomous;
    }

    // Return minimum autonomy level
    const autonomyOrder: AutonomyLevel[] = [
      AutonomyLevel.NotAutonomous,
      AutonomyLevel.SemiAutonomous,
      AutonomyLevel.Autonomous,
    ];

    const agentIdx = autonomyOrder.indexOf(agent.maxAutonomy);
    const delegationIdx = autonomyOrder.indexOf(delegation.maxAutonomy);
    const daoIdx = autonomyOrder.indexOf(daoDefaultAutonomy);

    const minIdx = Math.min(agentIdx, delegationIdx, daoIdx);
    return autonomyOrder[minIdx];
  }

  // ==========================================================================
  // Action Logging (Audit Trail)
  // ==========================================================================

  /**
   * Log an agent action for audit purposes.
   * Writes to agent_action_log via AgentStore and returns a generated actionId.
   */
  logAction(action: Omit<AgentAction, 'actionId' | 'timestamp'>): string {
    const actionId = randomUUID();

    // Persist to DB via AgentStore (fire-and-forget)
    const store = getAgentStore();
    store.logAction(action.agentId, action.actionType, {
      actionId,
      ...action,
      timestamp: new Date(),
    }).catch((err) => {
      console.warn(`[AgentRegistry] DB action log failed for ${action.agentId}:`, err instanceof Error ? err.message : err);
    });

    return actionId;
  }

  /**
   * Get actions for a specific agent.
   * Note: now persisted in DB — returns empty array (callers should query DB directly).
   * Kept for API compatibility.
   */
  getActionsForAgent(_agentId: string, _limit: number = 100): AgentAction[] {
    // Actions are now stored in agent_action_log table via AgentStore.
    // Legacy in-memory log removed. Callers needing full history should query DB.
    return [];
  }

  /**
   * Get actions for a specific proposal.
   * Kept for API compatibility — returns empty array (use DB query for full history).
   */
  getActionsForProposal(_daoId: string, _proposalId: number): AgentAction[] {
    return [];
  }

  // ==========================================================================
  // Default Agents
  // ==========================================================================

  /**
   * Register default Support-phase agents with DIDs.
   * Idempotent — skips agents already present in cache (loaded from DB at init).
   */
  private async registerDefaultAgents(): Promise<void> {
    const now = new Date();
    const systemUser = 'system';

    // All proposal kinds except strike authorization
    const safeProposalKinds = [
      ProposalKind.ConfigChange,
      ProposalKind.AddMember,
      ProposalKind.RemoveMember,
      ProposalKind.Transfer,
      ProposalKind.FunctionCall,
      ProposalKind.MissionOrder,
      ProposalKind.Custom,
    ];

    const defaultAgents: AgentManifest[] = [
      {
        agentId: 'governance-copilot',
        name: 'Governance Copilot',
        description:
          'AI assistant that summarizes proposals, provides context analysis, and guides voting decisions to reduce cognitive load on governance participants.',
        phase: AgentPhase.Support,
        capabilities: [AgentCapability.ProposalSummary, AgentCapability.ContextAnalysis, AgentCapability.VotingGuidance],
        maxAutonomy: AutonomyLevel.SemiAutonomous,
        allowedProposalKinds: safeProposalKinds,
        requiresHumanApproval: [ProposalKind.StrikeAuthorization],
        createdAt: now,
        createdBy: systemUser,
        active: true,
      },
      {
        agentId: 'proposal-screener',
        name: 'Proposal Screener',
        description:
          'AI agent that screens proposals for potential issues, spam, or policy violations before human review.',
        phase: AgentPhase.Support,
        capabilities: [AgentCapability.ProposalScreening],
        maxAutonomy: AutonomyLevel.SemiAutonomous,
        allowedProposalKinds: safeProposalKinds,
        requiresHumanApproval: [ProposalKind.StrikeAuthorization],
        createdAt: now,
        createdBy: systemUser,
        active: true,
      },
      {
        agentId: 'context-analyzer',
        name: 'Context Analyzer',
        description:
          'AI agent that analyzes proposal context and identifies information gaps that need to be addressed.',
        phase: AgentPhase.Support,
        capabilities: [AgentCapability.ContextAnalysis],
        maxAutonomy: AutonomyLevel.SemiAutonomous,
        allowedProposalKinds: safeProposalKinds,
        requiresHumanApproval: [ProposalKind.StrikeAuthorization],
        createdAt: now,
        createdBy: systemUser,
        active: true,
      },
      {
        agentId: 'feasibility-assessor',
        name: 'Feasibility Assessor',
        description:
          'AI agent that assesses the feasibility of proposals, identifying risks and potential benefits.',
        phase: AgentPhase.Support,
        capabilities: [AgentCapability.FeasibilityAssessment],
        maxAutonomy: AutonomyLevel.SemiAutonomous,
        allowedProposalKinds: safeProposalKinds,
        requiresHumanApproval: [ProposalKind.StrikeAuthorization],
        createdAt: now,
        createdBy: systemUser,
        active: true,
      },
    ];

    for (const manifest of defaultAgents) {
      // Skip if already in cache (loaded from DB)
      if (this.agents.has(manifest.agentId)) {
        continue;
      }
      try {
        await this.registerAgent(manifest);
      } catch (err) {
        console.warn(`[AgentRegistry] Failed to register default agent ${manifest.agentId}:`, err instanceof Error ? err.message : err);
      }
    }
  }
}

// ==========================================================================
// Singleton Instance
// ==========================================================================

let registryInstance: AgentRegistry | null = null;

/**
 * Get or create the agent registry singleton.
 */
export function getAgentRegistry(): AgentRegistry {
  if (!registryInstance) {
    registryInstance = new AgentRegistry();
  }
  return registryInstance;
}
