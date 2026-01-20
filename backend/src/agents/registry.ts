/**
 * Agent Registry
 *
 * Manages AI governance agents, delegations, and action audit trails.
 * Implements trust tier management and permission checking for agent actions.
 */

import { randomUUID } from 'crypto';
import {
  AgentAction,
  AgentCapability,
  AgentDelegation,
  AgentManifest,
  AgentPhase,
  AutonomyLevel,
  DelegationScope,
  ProposalKind,
} from './types.js';
import { Proposal } from '../dao/types.js';
import { createAgentDID } from './agent-did.js';

/**
 * Agent Registry - manages agent lifecycle, delegations, and audit trail.
 */
export class AgentRegistry {
  private agents: Map<string, AgentManifest> = new Map();
  private delegations: Map<string, AgentDelegation[]> = new Map();
  private actionLog: AgentAction[] = [];
  private initialized: boolean = false;
  private initPromise: Promise<void> | null = null;

  constructor() {
    // Start async initialization
    this.initPromise = this.initialize();
  }

  /**
   * Initialize the registry asynchronously.
   * Registers default agents with DIDs.
   */
  private async initialize(): Promise<void> {
    if (this.initialized) return;
    await this.registerDefaultAgents();
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
   */
  async registerAgent(manifest: AgentManifest): Promise<AgentManifest> {
    if (this.agents.has(manifest.agentId)) {
      throw new Error(`Agent ${manifest.agentId} already registered`);
    }

    // Generate DID if not provided
    if (!manifest.agentDID) {
      const didResult = await createAgentDID(manifest.agentId);
      manifest.agentDID = didResult.did;
      manifest.agentBlindedKey = didResult.blindedKey;
      manifest.agentPublicKey = didResult.publicKey;
    }

    this.agents.set(manifest.agentId, manifest);
    return manifest;
  }

  /**
   * Get an agent by ID.
   */
  getAgent(agentId: string): AgentManifest | undefined {
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
   * Deactivate an agent.
   */
  deactivateAgent(agentId: string): void {
    const agent = this.agents.get(agentId);
    if (!agent) {
      throw new Error(`Agent ${agentId} not found`);
    }
    agent.active = false;
    this.agents.set(agentId, agent);
  }

  // ==========================================================================
  // Delegation Management
  // ==========================================================================

  /**
   * Create a new delegation for an agent.
   * Returns the delegation ID.
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
   * Returns the minimum of: agent's maxAutonomy, delegation's maxAutonomy, and DAO default.
   * Strike authorization always returns NotAutonomous.
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
   * Returns the action ID.
   */
  logAction(action: Omit<AgentAction, 'actionId' | 'timestamp'>): string {
    const actionId = randomUUID();
    const fullAction: AgentAction = {
      ...action,
      actionId,
      timestamp: new Date(),
    };
    this.actionLog.push(fullAction);
    return actionId;
  }

  /**
   * Get actions for a specific agent.
   */
  getActionsForAgent(agentId: string, limit: number = 100): AgentAction[] {
    return this.actionLog
      .filter((a) => a.agentId === agentId)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  /**
   * Get actions for a specific proposal.
   */
  getActionsForProposal(daoId: string, proposalId: number): AgentAction[] {
    return this.actionLog
      .filter((a) => a.daoId === daoId && a.proposalId === proposalId)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  // ==========================================================================
  // Default Agents
  // ==========================================================================

  /**
   * Register default Support-phase agents with DIDs.
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

    // Governance Copilot - summarizes proposals, analyzes context, and provides voting guidance
    await this.registerAgent({
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
    });

    // Proposal Screener - screens proposals for issues
    await this.registerAgent({
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
    });

    // Context Analyzer - identifies context gaps
    await this.registerAgent({
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
    });

    // Feasibility Assessor - assesses proposal feasibility
    await this.registerAgent({
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
    });
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
