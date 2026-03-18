/**
 * Agent Executor
 *
 * Executes agent capabilities with proper permission checking and audit logging.
 * Uses GovernanceCopilot for rule-based analysis. For skill execution, routes
 * all agents through LangGraphAgentWrapper (generalized, not governance-only).
 *
 * Phase 51: Generalized to use LangGraphAgentWrapper for all agents.
 * Health metrics updated after each execution via AgentStore.
 * Inactive agents are rejected with a clear error message.
 */

import {
  AgentActionType,
  AgentCapability,
  AgentDelegation,
  AgentManifest,
  AutonomyLevel,
  ProposalKind,
} from './types.js';
import { AgentRegistry, getAgentRegistry } from './registry.js';
import { DAOMetadata, Proposal } from '../dao/types.js';
import { governanceCopilot } from './copilot.js';
import { DAOService, getDAOService } from '../dao/dao-service.js';
import { getAgentStore } from './agent-store.js';
import { LangGraphAgentWrapper } from '../orchestration/agent-wrapper.js';
import type { ClassificationLevel, BastionState } from '../orchestration/state.js';

/**
 * Context available to agent during capability execution.
 */
export interface AgentContext {
  /** Agent manifest */
  agent: AgentManifest;
  /** Active delegation for this action */
  delegation: AgentDelegation;
  /** DAO metadata */
  dao: DAOMetadata;
  /** Proposal being acted on (if applicable) */
  proposal?: Proposal;
  /** DID of the user who triggered the action */
  userDID: string;
}

/**
 * Result from agent capability execution.
 */
export interface AgentResult {
  /** Whether execution was successful */
  success: boolean;
  /** ID of the logged action */
  actionId: string;
  /** Output data from the capability */
  output: Record<string, unknown>;
  /** Whether this action requires human approval before taking effect */
  requiresHumanApproval: boolean;
  /** Suggested next action for the user */
  suggestedAction?: string;
  /** Error message if not successful */
  error?: string;
}

/**
 * Maps capabilities to action types for logging.
 */
const capabilityToActionType: Record<AgentCapability, AgentActionType> = {
  [AgentCapability.ProposalSummary]: AgentActionType.AnalyzeProposal,
  [AgentCapability.ProposalScreening]: AgentActionType.ScreenProposal,
  [AgentCapability.ContextAnalysis]: AgentActionType.IdentifyContextGaps,
  [AgentCapability.FeasibilityAssessment]: AgentActionType.AssessFeasibility,
  [AgentCapability.SecurityMonitoring]: AgentActionType.AnalyzeProposal,
  [AgentCapability.VotingGuidance]: AgentActionType.RecommendVote,
  [AgentCapability.PreferenceModeling]: AgentActionType.RecommendVote,
  [AgentCapability.DelegatedVoting]: AgentActionType.CastDelegatedVote,
  [AgentCapability.ConsensusBuilding]: AgentActionType.SummarizeActivity,
  [AgentCapability.CommitteeCoordination]: AgentActionType.SummarizeActivity,
  // MDMP Agent Capabilities (Phase 5.1)
  [AgentCapability.AssumptionAuditing]: AgentActionType.AnalyzeProposal,
  [AgentCapability.DataBiasDetection]: AgentActionType.AnalyzeProposal,
  [AgentCapability.OrdersValidation]: AgentActionType.AnalyzeProposal,
  [AgentCapability.ProblemFraming]: AgentActionType.AnalyzeProposal,
  [AgentCapability.ROECompliance]: AgentActionType.AnalyzeProposal,
  [AgentCapability.UncertaintyQuantification]: AgentActionType.AssessFeasibility,
  // Phase 5.2 Agent Capabilities (Escalation & Competition Modeling)
  [AgentCapability.AdversaryModeling]: AgentActionType.AnalyzeProposal,
  [AgentCapability.EffectCascading]: AgentActionType.AnalyzeProposal,
  [AgentCapability.EscalationModeling]: AgentActionType.AnalyzeProposal,
  [AgentCapability.DeceptionDetection]: AgentActionType.AnalyzeProposal,
  // New Agent Capabilities (Deception, Exploitation, De-escalation)
  [AgentCapability.DeceptionPlanning]: AgentActionType.AnalyzeProposal,
  [AgentCapability.ExploitationAnalysis]: AgentActionType.AnalyzeProposal,
  [AgentCapability.DeescalationManagement]: AgentActionType.AnalyzeProposal,
};

/**
 * Agent Executor - executes agent capabilities with permission checks.
 *
 * Phase 51: Routes all skill execution through LangGraphAgentWrapper.
 * Updates health metrics in AgentStore after each invocation.
 */
export class AgentExecutor {
  constructor(
    private registry: AgentRegistry,
    private daoService: DAOService
  ) {}

  /**
   * Execute an agent capability.
   */
  async executeCapability(
    agentId: string,
    capability: AgentCapability,
    daoId: string,
    proposalId: number | null,
    input: Record<string, unknown>,
    userDID: string
  ): Promise<AgentResult> {
    // 1. Validate agent exists and has this capability
    const agent = this.registry.getAgent(agentId);
    if (!agent) {
      return this.errorResult(`Agent ${agentId} not found`);
    }

    // Reject inactive agents with clear error (Phase 51 requirement)
    if (!agent.active) {
      const agentStatus = (agent as unknown as { status?: string }).status || 'inactive';
      return this.errorResult(`Agent ${agentId} is ${agentStatus} — cannot execute`);
    }

    if (!agent.capabilities.includes(capability)) {
      return this.errorResult(`Agent ${agentId} does not have capability ${capability}`);
    }

    // 2. Get DAO
    const dao = await this.daoService.getDAO(daoId);
    if (!dao) {
      return this.errorResult(`DAO ${daoId} not found`);
    }

    // 3. Get proposal if specified
    let proposal: Proposal | undefined;
    if (proposalId !== null) {
      const fetchedProposal = await this.daoService.getProposal(daoId, proposalId);
      if (!fetchedProposal) {
        return this.errorResult(`Proposal ${proposalId} not found in DAO ${daoId}`);
      }
      proposal = fetchedProposal;

      // 4. Check agent can act on this proposal
      if (!this.registry.canAgentActOnProposal(agentId, daoId, proposal)) {
        return this.errorResult(`Agent ${agentId} cannot act on this proposal`);
      }
    }

    // 5. Find valid delegation
    const delegations = this.registry.getDelegationsForAgent(agentId);
    const delegation = delegations.find(
      (d) => d.daoId === daoId && !d.revoked && d.delegatorDID === userDID
    );
    if (!delegation) {
      return this.errorResult(`No valid delegation found for agent ${agentId} in DAO ${daoId}`);
    }

    // 6. Get effective autonomy
    const proposalKind = proposal
      ? typeof proposal.kind === 'string'
        ? (proposal.kind as ProposalKind)
        : ProposalKind.Custom
      : ProposalKind.Custom;

    const effectiveAutonomy = this.registry.getEffectiveAutonomy(
      agentId,
      daoId,
      proposalKind,
      dao.config.default_autonomy_level
    );

    // 7. Build context
    const context: AgentContext = {
      agent,
      delegation,
      dao,
      proposal,
      userDID,
    };

    // 8. Execute capability handler via LangGraph wrapper
    const startTime = Date.now();
    let output: Record<string, unknown>;
    let execSuccess = false;

    try {
      output = await this.executeHandler(capability, context, input);
      execSuccess = true;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return this.errorResult(`Capability execution failed: ${message}`);
    }

    const duration = Date.now() - startTime;

    // 9. Update health metrics in AgentStore (fire-and-forget)
    this.updateHealthMetrics(agentId, execSuccess, duration);

    // 10. Determine if human approval is needed
    const requiresHumanApproval = effectiveAutonomy === AutonomyLevel.NotAutonomous;

    // 11. Log action via registry (persists to agent_action_log via AgentStore)
    const actionType = capabilityToActionType[capability];
    const actionId = this.registry.logAction({
      agentId,
      daoId,
      proposalId: proposalId ?? undefined,
      actionType,
      input,
      output,
      autonomyUsed: effectiveAutonomy,
      humanApproved: !requiresHumanApproval,
    });

    // Also log skill execution detail to AgentStore
    const store = getAgentStore();
    store.logAction(agentId, 'execute', {
      capability,
      skill: capability,
      input,
      duration,
      success: execSuccess,
    }).catch((err) => {
      console.warn(`[AgentExecutor] DB action log failed for ${agentId}:`, err instanceof Error ? err.message : err);
    });

    // 12. Return result
    return {
      success: true,
      actionId,
      output,
      requiresHumanApproval,
      suggestedAction: this.getSuggestedAction(capability, output),
    };
  }

  /**
   * Analyze all active proposals in a DAO.
   */
  async analyzeAllActiveProposals(
    agentId: string,
    daoId: string,
    userDID: string
  ): Promise<AgentResult[]> {
    const proposals = await this.daoService.listProposals(daoId, 0, 100);
    const activeProposals = proposals.filter((p) => p.status === 'InProgress');

    const results: AgentResult[] = [];
    for (const proposal of activeProposals) {
      const result = await this.executeCapability(
        agentId,
        AgentCapability.ProposalSummary,
        daoId,
        proposal.id,
        {},
        userDID
      );
      results.push(result);
    }

    return results;
  }

  // ==========================================================================
  // Capability Handlers — route through LangGraph wrapper or GovernanceCopilot
  // ==========================================================================

  /**
   * Execute the appropriate handler for a capability.
   * Governance capabilities that have GovernanceCopilot implementations use
   * those directly. All other capabilities route through the LangGraph wrapper.
   */
  private async executeHandler(
    capability: AgentCapability,
    context: AgentContext,
    input: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    switch (capability) {
      case AgentCapability.ProposalSummary:
        return this.handleProposalSummary(context);
      case AgentCapability.ProposalScreening:
        return this.handleProposalScreening(context);
      case AgentCapability.ContextAnalysis:
        return this.handleContextAnalysis(context);
      case AgentCapability.FeasibilityAssessment:
        return this.handleFeasibilityAssessment(context);
      case AgentCapability.SecurityMonitoring:
        return this.handleSecurityMonitoring(context);
      case AgentCapability.VotingGuidance:
        return this.handleVotingGuidance(context, input);
      default:
        // Generalized path: route through LangGraph wrapper
        return this.handleViaLangGraph(capability, context, input);
    }
  }

  /**
   * Execute a capability via the LangGraph agent wrapper.
   * Used for all non-governance capabilities.
   */
  private async handleViaLangGraph(
    capability: AgentCapability,
    context: AgentContext,
    input: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    const { agent } = context;

    // Map StandardAgent clearance to BastionState ClassificationLevel
    // StandardAgent: 'Unclassified' | 'CUI' | 'Secret' | 'TopSecret'
    // BastionState:  'UNCLASS' | 'CUI' | 'CONFIDENTIAL' | 'SECRET' | 'TOPSECRET'
    const agentClearanceRaw = 'clearance' in agent
      ? (agent as { clearance: string }).clearance
      : 'Unclassified';

    const clearanceMap: Record<string, ClassificationLevel> = {
      'Unclassified': 'UNCLASS',
      'CUI': 'CUI',
      'Secret': 'SECRET',
      'TopSecret': 'TOPSECRET',
    };
    const clearance: ClassificationLevel = (clearanceMap[agentClearanceRaw] ?? 'UNCLASS') as ClassificationLevel;

    // Create LangGraph wrapper for this agent
    const wrapper = new LangGraphAgentWrapper({
      manifest: agent,
      clearance,
      applyClassificationFilter: false, // Disable for direct execution
    });

    // Build a minimal BastionState for the wrapper
    const { HumanMessage } = await import('@langchain/core/messages');
    const { createTaskState } = await import('../orchestration/state.js');
    const promptText = `Execute capability: ${capability}\n\nInput: ${JSON.stringify(input, null, 2)}`;

    const partialState = createTaskState({
      threadId: `exec-${agent.agentId}-${Date.now()}`,
      taskId: `${agent.agentId}-${capability}-${Date.now()}`,
      taskType: capability,
      objectives: [promptText],
      classification: clearance,
      input,
    });

    // Cast to BastionState (createTaskState returns Partial<BastionState>,
    // wrapper.createNode() accepts BastionState — we satisfy all required fields via spread)
    const state = {
      ...partialState,
      messages: [new HumanMessage(promptText)],
    } as BastionState;

    const nodeFunction = wrapper.createNode();
    const result = await nodeFunction(state);

    // Extract text response from messages
    const newMessages = result.messages || [];
    const lastMessage = newMessages[newMessages.length - 1];
    const responseText = lastMessage
      ? typeof lastMessage.content === 'string'
        ? lastMessage.content
        : JSON.stringify(lastMessage.content)
      : 'No response generated';

    return {
      capability,
      response: responseText,
      agentId: agent.agentId,
      executedAt: new Date().toISOString(),
    };
  }

  /**
   * Update health metrics in AgentStore after execution.
   * Fire-and-forget — never blocks execution flow.
   */
  private updateHealthMetrics(agentId: string, success: boolean, durationMs: number): void {
    const store = getAgentStore();

    // Compute rolling success rate update:
    // We don't have the prior successRate easily here without a DB read,
    // so we use a simple approach: update lastInvocation and avgResponseTimeMs.
    // A more sophisticated rolling average would require reading current value first.
    store.updateHealth(agentId, {
      lastInvocation: new Date(),
      successRate: success ? 1.0 : 0.0,
      avgResponseTimeMs: durationMs,
    }).catch((err) => {
      console.warn(`[AgentExecutor] Health update failed for ${agentId}:`, err instanceof Error ? err.message : err);
    });
  }

  /**
   * Handle ProposalSummary capability.
   * Uses GovernanceCopilot for rule-based summarization.
   */
  private async handleProposalSummary(context: AgentContext): Promise<Record<string, unknown>> {
    const { proposal, dao } = context;
    if (!proposal) {
      throw new Error('Proposal required for ProposalSummary');
    }

    const summaryOutput = await governanceCopilot.summarizeProposal(proposal, dao);

    return {
      summary: summaryOutput.summary,
      keyPoints: summaryOutput.keyPoints,
      impactAssessment: summaryOutput.impactAssessment,
      recommendation: summaryOutput.recommendation,
      warnings: summaryOutput.warnings,
      proposalKind: proposal.kind,
      classification: proposal.classification,
    };
  }

  /**
   * Handle ProposalScreening capability.
   */
  private async handleProposalScreening(context: AgentContext): Promise<Record<string, unknown>> {
    const { proposal } = context;
    if (!proposal) {
      throw new Error('Proposal required for ProposalScreening');
    }

    const issues: string[] = [];
    const suggestions: string[] = [];

    if (!proposal.description || proposal.description.length < 10) {
      issues.push('Description is too short or missing');
      suggestions.push('Add a detailed description explaining the proposal');
    }

    if (proposal.description && proposal.description.length > 5000) {
      issues.push('Description is very long');
      suggestions.push('Consider summarizing the key points');
    }

    const spamPatterns = ['buy now', 'free money', 'guaranteed returns'];
    const lowerDesc = proposal.description?.toLowerCase() || '';
    for (const pattern of spamPatterns) {
      if (lowerDesc.includes(pattern)) {
        issues.push(`Potential spam detected: "${pattern}"`);
      }
    }

    return {
      passed: issues.length === 0,
      issues,
      suggestions,
      screenedAt: new Date().toISOString(),
    };
  }

  /**
   * Handle ContextAnalysis capability.
   * Uses GovernanceCopilot for context analysis.
   */
  private async handleContextAnalysis(context: AgentContext): Promise<Record<string, unknown>> {
    const { dao, proposal } = context;

    const recentProposals = await this.daoService.listProposals(dao.dao_id, 0, 10);
    const relatedProposals = proposal
      ? recentProposals.filter((p) => p.id !== proposal.id)
      : recentProposals;

    if (proposal) {
      const contextOutput = await governanceCopilot.analyzeContext(proposal, dao, relatedProposals);

      return {
        relatedProposals: contextOutput.relatedProposals,
        strategicAlignment: contextOutput.strategicAlignment,
        precedents: contextOutput.precedents,
        contextGaps: contextOutput.contextGaps,
        daoMemberCount: dao.member_count,
        activeProposalCount: dao.active_proposal_count,
      };
    }

    return {
      relatedProposals: relatedProposals.map((p) => ({
        daoId: dao.dao_id,
        proposalId: p.id,
        summary: p.description?.slice(0, 100) || 'No description',
        relationship: 'related' as const,
      })),
      strategicAlignment: 'Unable to assess without specific proposal',
      precedents: [],
      contextGaps: ['Provide a specific proposal for detailed context analysis'],
      daoMemberCount: dao.member_count,
      activeProposalCount: dao.active_proposal_count,
    };
  }

  /**
   * Handle FeasibilityAssessment capability.
   */
  private async handleFeasibilityAssessment(
    context: AgentContext
  ): Promise<Record<string, unknown>> {
    const { proposal } = context;
    if (!proposal) {
      throw new Error('Proposal required for FeasibilityAssessment');
    }

    const description = proposal.description?.toLowerCase() || '';
    const risks: string[] = [];
    const benefits: string[] = [];

    const riskKeywords = ['risk', 'dangerous', 'uncertain', 'experimental', 'untested', 'complex'];
    for (const keyword of riskKeywords) {
      if (description.includes(keyword)) {
        risks.push(`Contains risk indicator: "${keyword}"`);
      }
    }

    const benefitKeywords = ['improve', 'benefit', 'efficiency', 'savings', 'growth', 'opportunity'];
    for (const keyword of benefitKeywords) {
      if (description.includes(keyword)) {
        benefits.push(`Contains benefit indicator: "${keyword}"`);
      }
    }

    if (risks.length === 0) {
      risks.push('No obvious risks detected - manual review recommended');
    }
    if (benefits.length === 0) {
      benefits.push('No obvious benefits stated - request clarification');
    }

    const feasible = risks.length <= 2 && benefits.length >= 1;

    return {
      feasible,
      risks,
      benefits,
      assessedAt: new Date().toISOString(),
      note: 'This is a preliminary assessment. AI-powered analysis will be available in a future release.',
    };
  }

  /**
   * Handle SecurityMonitoring capability.
   */
  private async handleSecurityMonitoring(context: AgentContext): Promise<Record<string, unknown>> {
    const { proposal, dao } = context;

    const alerts: string[] = [];
    const recommendations: string[] = [];

    if (proposal) {
      if (proposal.kind === ProposalKind.FunctionCall) {
        alerts.push('FunctionCall proposal detected - verify target contract');
        recommendations.push('Review the function being called and its parameters');
      }

      if (proposal.kind === ProposalKind.Transfer) {
        alerts.push('Transfer proposal detected - verify recipient and amount');
        recommendations.push('Confirm the transfer amount and destination');
      }

      if (proposal.classification === 'TopSecret') {
        alerts.push('TopSecret classification - restricted access required');
      }
    }

    if (dao.active_proposal_count > 10) {
      alerts.push(`High proposal activity: ${dao.active_proposal_count} active proposals`);
      recommendations.push('Review for potential coordinated activity');
    }

    return {
      alerts,
      recommendations,
      securityLevel: alerts.length > 2 ? 'High' : alerts.length > 0 ? 'Medium' : 'Low',
      checkedAt: new Date().toISOString(),
    };
  }

  /**
   * Handle VotingGuidance capability.
   * Uses GovernanceCopilot for voting guidance generation.
   */
  private async handleVotingGuidance(
    context: AgentContext,
    input: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    const { proposal, dao } = context;
    if (!proposal) {
      throw new Error('Proposal required for VotingGuidance');
    }

    const userRoles = (input.userRoles as string[]) || [];
    const userParty = input.userParty as string | undefined;

    const guidanceOutput = await governanceCopilot.generateVotingGuidance(
      proposal,
      dao,
      userRoles,
      userParty
    );

    return {
      eligibility: guidanceOutput.eligibility,
      autonomyExplanation: guidanceOutput.autonomyExplanation,
      coalitionRequirements: guidanceOutput.coalitionRequirements,
      nextSteps: guidanceOutput.nextSteps,
      deadlineWarning: guidanceOutput.deadlineWarning,
      proposalId: proposal.id,
      daoId: dao.dao_id,
    };
  }

  // ==========================================================================
  // Helpers
  // ==========================================================================

  /**
   * Create an error result.
   */
  private errorResult(error: string): AgentResult {
    return {
      success: false,
      actionId: '',
      output: {},
      requiresHumanApproval: true,
      error,
    };
  }

  /**
   * Get suggested action based on capability output.
   */
  private getSuggestedAction(
    capability: AgentCapability,
    output: Record<string, unknown>
  ): string | undefined {
    switch (capability) {
      case AgentCapability.ProposalScreening:
        return (output.passed as boolean)
          ? 'Proposal passed screening - proceed to review'
          : 'Review flagged issues before proceeding';
      case AgentCapability.FeasibilityAssessment:
        return (output.feasible as boolean)
          ? 'Proposal appears feasible - review details'
          : 'Address feasibility concerns before voting';
      case AgentCapability.ContextAnalysis:
        return (output.contextGaps as string[])?.length > 0
          ? 'Address context gaps before voting'
          : 'Context analysis complete';
      default:
        return undefined;
    }
  }
}

// ==========================================================================
// Singleton Instance
// ==========================================================================

let executorInstance: AgentExecutor | null = null;

/**
 * Get or create the agent executor singleton.
 */
export function getAgentExecutor(): AgentExecutor {
  if (!executorInstance) {
    executorInstance = new AgentExecutor(getAgentRegistry(), getDAOService());
  }
  return executorInstance;
}
