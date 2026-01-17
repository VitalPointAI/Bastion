/**
 * Agent Executor
 *
 * Executes agent capabilities with proper permission checking and audit logging.
 * Capability handlers are stubs for now - AI integration comes in later phases.
 */

import {
  AgentAction,
  AgentActionType,
  AgentCapability,
  AgentDelegation,
  AgentManifest,
  AutonomyLevel,
  ProposalKind,
} from './types.js';
import { AgentRegistry, getAgentRegistry } from './registry.js';
import { DAOMetadata, Proposal } from '../dao/types.js';
import { DAOService, getDAOService } from '../dao/dao-service.js';

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
  [AgentCapability.PreferenceModeling]: AgentActionType.RecommendVote,
  [AgentCapability.DelegatedVoting]: AgentActionType.CastDelegatedVote,
  [AgentCapability.ConsensusBuilding]: AgentActionType.SummarizeActivity,
  [AgentCapability.CommitteeCoordination]: AgentActionType.SummarizeActivity,
};

/**
 * Agent Executor - executes agent capabilities with permission checks.
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
    if (!agent.active) {
      return this.errorResult(`Agent ${agentId} is not active`);
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

    // 8. Execute capability handler
    let output: Record<string, unknown>;
    try {
      output = await this.executeHandler(capability, context, input);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return this.errorResult(`Capability execution failed: ${message}`);
    }

    // 9. Determine if human approval is needed
    const requiresHumanApproval = effectiveAutonomy === AutonomyLevel.NotAutonomous;

    // 10. Log action
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

    // 11. Return result
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
  // Capability Handlers (stubs for now)
  // ==========================================================================

  /**
   * Execute the appropriate handler for a capability.
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
      default:
        throw new Error(`Capability ${capability} not implemented`);
    }
  }

  /**
   * Handle ProposalSummary capability.
   * Stub: extracts key information from proposal description.
   */
  private async handleProposalSummary(context: AgentContext): Promise<Record<string, unknown>> {
    const { proposal } = context;
    if (!proposal) {
      throw new Error('Proposal required for ProposalSummary');
    }

    // Stub implementation - in production this would use AI
    const description = proposal.description || '';
    const sentences = description.split(/[.!?]+/).filter((s) => s.trim());
    const summary = sentences.slice(0, 2).join('. ') + (sentences.length > 2 ? '...' : '');

    return {
      summary: summary || 'No description provided',
      keyPoints: sentences.slice(0, 5),
      proposalKind: proposal.kind,
      classification: proposal.classification,
      recommendation: 'Review this proposal carefully before voting.',
    };
  }

  /**
   * Handle ProposalScreening capability.
   * Stub: basic validation checks.
   */
  private async handleProposalScreening(context: AgentContext): Promise<Record<string, unknown>> {
    const { proposal } = context;
    if (!proposal) {
      throw new Error('Proposal required for ProposalScreening');
    }

    const issues: string[] = [];
    const suggestions: string[] = [];

    // Basic checks
    if (!proposal.description || proposal.description.length < 10) {
      issues.push('Description is too short or missing');
      suggestions.push('Add a detailed description explaining the proposal');
    }

    if (proposal.description && proposal.description.length > 5000) {
      issues.push('Description is very long');
      suggestions.push('Consider summarizing the key points');
    }

    // Check for spam patterns (simplified)
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
   * Stub: queries recent proposals in the same DAO.
   */
  private async handleContextAnalysis(context: AgentContext): Promise<Record<string, unknown>> {
    const { dao, proposal } = context;

    // Get recent proposals for context
    const recentProposals = await this.daoService.listProposals(dao.dao_id, 0, 10);

    // Find potentially related proposals (same kind)
    const proposalKind = proposal
      ? typeof proposal.kind === 'string'
        ? proposal.kind
        : 'Custom'
      : null;

    const relatedProposals = proposalKind
      ? recentProposals.filter((p) => {
          const kind = typeof p.kind === 'string' ? p.kind : 'Custom';
          return kind === proposalKind && p.id !== proposal?.id;
        })
      : [];

    const contextGaps: string[] = [];

    // Identify context gaps (stub logic)
    if (!proposal?.description?.includes('budget') && proposalKind === 'Transfer') {
      contextGaps.push('No budget justification provided');
    }
    if (!proposal?.description?.includes('timeline')) {
      contextGaps.push('No timeline specified');
    }
    if (relatedProposals.length > 0) {
      contextGaps.push(`${relatedProposals.length} similar proposals exist - review for conflicts`);
    }

    return {
      relatedProposals: relatedProposals.map((p) => ({
        id: p.id,
        kind: p.kind,
        status: p.status,
        description: p.description?.slice(0, 100),
      })),
      contextGaps,
      daoMemberCount: dao.member_count,
      activeProposalCount: dao.active_proposal_count,
    };
  }

  /**
   * Handle FeasibilityAssessment capability.
   * Stub: basic risk keyword detection.
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

    // Risk keywords
    const riskKeywords = ['risk', 'dangerous', 'uncertain', 'experimental', 'untested', 'complex'];
    for (const keyword of riskKeywords) {
      if (description.includes(keyword)) {
        risks.push(`Contains risk indicator: "${keyword}"`);
      }
    }

    // Benefit keywords
    const benefitKeywords = [
      'improve',
      'benefit',
      'efficiency',
      'savings',
      'growth',
      'opportunity',
    ];
    for (const keyword of benefitKeywords) {
      if (description.includes(keyword)) {
        benefits.push(`Contains benefit indicator: "${keyword}"`);
      }
    }

    // Default assessments if none found
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
   * Stub: basic security checks.
   */
  private async handleSecurityMonitoring(context: AgentContext): Promise<Record<string, unknown>> {
    const { proposal, dao } = context;

    const alerts: string[] = [];
    const recommendations: string[] = [];

    if (proposal) {
      // Check for security-sensitive proposal types
      if (proposal.kind === ProposalKind.FunctionCall) {
        alerts.push('FunctionCall proposal detected - verify target contract');
        recommendations.push('Review the function being called and its parameters');
      }

      if (proposal.kind === ProposalKind.Transfer) {
        alerts.push('Transfer proposal detected - verify recipient and amount');
        recommendations.push('Confirm the transfer amount and destination');
      }

      // High classification
      if (proposal.classification === 'TopSecret') {
        alerts.push('TopSecret classification - restricted access required');
      }
    }

    // DAO-level checks
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
