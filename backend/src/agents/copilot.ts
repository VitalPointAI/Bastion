/**
 * Governance Copilot
 *
 * AI assistant for DAO governance that provides:
 * - Proposal summarization and key point extraction
 * - Context analysis (related proposals, strategic alignment)
 * - Voting guidance (eligibility, autonomy explanation, next steps)
 *
 * CRITICAL: Never provides recommendations for StrikeAuthorization proposals.
 * Strike authorization decisions require human judgment.
 */

import type { Proposal, DAOMetadata, CoalitionProposal } from '../dao/types.js';
import { ProposalKind, AutonomyLevel, ProposalStatus } from '../dao/types.js';

// ==========================================================================
// Output Interfaces
// ==========================================================================

/**
 * Summary output from proposal analysis.
 */
export interface ProposalSummaryOutput {
  /** 2-3 sentence summary of the proposal */
  summary: string;
  /** Bullet point key takeaways */
  keyPoints: string[];
  /** What happens if approved vs rejected */
  impactAssessment: string;
  /** Optional voting guidance (NEVER for StrikeAuth) */
  recommendation?: string;
  /** Risks or concerns identified */
  warnings: string[];
}

/**
 * Context analysis output.
 */
export interface ContextAnalysisOutput {
  /** Related proposals in the DAO */
  relatedProposals: Array<{
    daoId: string;
    proposalId: number;
    summary: string;
    relationship: 'parent' | 'related' | 'dependent';
  }>;
  /** How this relates to strategic objectives */
  strategicAlignment: string;
  /** Similar past decisions */
  precedents: string[];
  /** Information that might be missing */
  contextGaps: string[];
}

/**
 * Voting guidance output.
 */
export interface VotingGuidanceOutput {
  /** Whether user can vote */
  eligibility: {
    canVote: boolean;
    reason?: string;
  };
  /** Explanation of what the autonomy level means */
  autonomyExplanation: string;
  /** Coalition requirements if applicable */
  coalitionRequirements?: {
    requiredParties: string[];
    myParty?: string;
    explanation: string;
  };
  /** What happens after voting */
  nextSteps: string[];
  /** Warning if deadline is approaching */
  deadlineWarning?: string;
}

/**
 * Combined copilot analysis output.
 */
export interface CopilotAnalysisOutput {
  summary: ProposalSummaryOutput;
  context: ContextAnalysisOutput;
  guidance: VotingGuidanceOutput;
}

// ==========================================================================
// Governance Copilot Class
// ==========================================================================

/**
 * GovernanceCopilot - AI assistant for DAO governance.
 *
 * For v1, uses rule-based heuristics. Later phases will integrate LLM.
 */
export class GovernanceCopilot {
  // ==========================================================================
  // Public API
  // ==========================================================================

  /**
   * Generate a summary of a proposal.
   */
  async summarizeProposal(
    proposal: Proposal,
    dao: DAOMetadata
  ): Promise<ProposalSummaryOutput> {
    const summary = this.generateSummary(proposal);
    const keyPoints = this.extractKeyPoints(proposal);
    const impact = this.assessImpact(proposal, dao);
    const warnings = this.identifyWarnings(proposal, dao);

    // CRITICAL: Never provide recommendation for StrikeAuthorization
    let recommendation: string | undefined;
    const proposalKind = this.getProposalKind(proposal);
    if (proposalKind !== ProposalKind.StrikeAuthorization) {
      recommendation = this.generateRecommendation(proposal);
    }

    return {
      summary,
      keyPoints,
      impactAssessment: impact,
      recommendation,
      warnings,
    };
  }

  /**
   * Analyze context for a proposal.
   */
  async analyzeContext(
    proposal: Proposal,
    dao: DAOMetadata,
    relatedProposals: Proposal[]
  ): Promise<ContextAnalysisOutput> {
    const related = relatedProposals.map((p) => ({
      daoId: dao.dao_id,
      proposalId: p.id,
      summary: this.generateSummary(p),
      relationship: this.determineRelationship(proposal, p),
    }));

    return {
      relatedProposals: related,
      strategicAlignment: this.assessStrategicAlignment(proposal, dao),
      precedents: this.findPrecedents(proposal, relatedProposals),
      contextGaps: this.identifyContextGaps(proposal, dao),
    };
  }

  /**
   * Generate voting guidance for a user.
   */
  async generateVotingGuidance(
    proposal: Proposal,
    dao: DAOMetadata,
    userRoles: string[],
    userParty?: string,
    coalitionProposal?: CoalitionProposal
  ): Promise<VotingGuidanceOutput> {
    const canVote = userRoles.length > 0;
    const effectiveAutonomy = proposal.autonomy_override || dao.config.default_autonomy_level;
    const autonomyExplanation = this.explainAutonomy(effectiveAutonomy);

    const nextSteps = this.determineNextSteps(proposal, dao);

    // Calculate deadline warning
    let deadlineWarning: string | undefined;
    const deadline = typeof proposal.voting_deadline === 'string'
      ? parseInt(proposal.voting_deadline)
      : proposal.voting_deadline;
    const nowNs = Date.now() * 1_000_000;
    const timeLeftNs = deadline - nowNs;
    const oneHourNs = 60 * 60 * 1_000_000_000;
    const oneDayNs = 24 * oneHourNs;

    if (timeLeftNs < oneHourNs && timeLeftNs > 0) {
      deadlineWarning = 'URGENT: Less than 1 hour to vote';
    } else if (timeLeftNs < oneDayNs && timeLeftNs > 0) {
      const hoursLeft = Math.floor(timeLeftNs / oneHourNs);
      deadlineWarning = `Deadline approaching: ${hoursLeft} hours remaining`;
    }

    // Build coalition requirements if applicable
    let coalitionRequirements: VotingGuidanceOutput['coalitionRequirements'];
    if (coalitionProposal) {
      coalitionRequirements = {
        requiredParties: coalitionProposal.required_parties,
        myParty: userParty,
        explanation: this.explainCoalitionRequirements(coalitionProposal, userParty),
      };
    }

    return {
      eligibility: {
        canVote,
        reason: canVote ? undefined : 'No voting role in this DAO',
      },
      autonomyExplanation,
      coalitionRequirements,
      nextSteps,
      deadlineWarning,
    };
  }

  /**
   * Full copilot analysis - combines all three outputs.
   */
  async analyze(
    proposal: Proposal,
    dao: DAOMetadata,
    relatedProposals: Proposal[],
    userRoles: string[],
    userParty?: string,
    coalitionProposal?: CoalitionProposal
  ): Promise<CopilotAnalysisOutput> {
    const [summary, context, guidance] = await Promise.all([
      this.summarizeProposal(proposal, dao),
      this.analyzeContext(proposal, dao, relatedProposals),
      this.generateVotingGuidance(proposal, dao, userRoles, userParty, coalitionProposal),
    ]);

    return { summary, context, guidance };
  }

  // ==========================================================================
  // Helper Methods - Summary Generation
  // ==========================================================================

  private generateSummary(proposal: Proposal): string {
    const kind = this.getProposalKind(proposal);
    const description = proposal.description || '';

    // Extract first 2 sentences or use kind-based template
    const sentences = description.split(/[.!?]+/).filter((s) => s.trim());
    if (sentences.length >= 2) {
      return sentences.slice(0, 2).join('. ').trim() + '.';
    }

    // Fallback to template-based summary
    switch (kind) {
      case ProposalKind.StrikeAuthorization:
        return `Strike authorization request requiring human approval. ${description.slice(0, 100)}`;
      case ProposalKind.Transfer:
        return `Fund transfer proposal. ${description.slice(0, 100)}`;
      case ProposalKind.AddMember:
        return `Request to add a new member to the DAO. ${description.slice(0, 100)}`;
      case ProposalKind.RemoveMember:
        return `Request to remove a member from the DAO. ${description.slice(0, 100)}`;
      case ProposalKind.ConfigChange:
        return `Configuration change for DAO settings. ${description.slice(0, 100)}`;
      case ProposalKind.FunctionCall:
        return `Smart contract function call proposal. ${description.slice(0, 100)}`;
      case ProposalKind.MissionOrder:
        return `Mission order requiring coordination. ${description.slice(0, 100)}`;
      default:
        return description.slice(0, 200) || 'No description provided.';
    }
  }

  private extractKeyPoints(proposal: Proposal): string[] {
    const points: string[] = [];
    const description = (proposal.description || '').toLowerCase();
    const kind = this.getProposalKind(proposal);

    // Kind-specific key points
    switch (kind) {
      case ProposalKind.StrikeAuthorization:
        points.push('Requires explicit human approval - cannot be delegated to AI');
        points.push('Decision is irreversible once executed');
        break;
      case ProposalKind.Transfer:
        points.push('Involves movement of funds or assets');
        if (description.includes('urgent')) {
          points.push('Marked as urgent - expedited review needed');
        }
        break;
      case ProposalKind.AddMember:
        points.push('Will expand DAO membership');
        points.push('New member will have voting rights upon approval');
        break;
      case ProposalKind.ConfigChange:
        points.push('Changes DAO operating parameters');
        points.push('May affect future proposal handling');
        break;
      case ProposalKind.MissionOrder:
        points.push('Operational directive requiring coordination');
        break;
    }

    // Content-based key points
    if (description.includes('deadline')) {
      points.push('Time-sensitive action required');
    }
    if (description.includes('security') || description.includes('classified')) {
      points.push('Involves security-sensitive information');
    }
    if (description.includes('coalition') || description.includes('multi-party')) {
      points.push('Requires multi-party approval');
    }

    // Ensure we have at least 2 points
    if (points.length < 2) {
      points.push('Standard proposal requiring member review');
    }

    return points.slice(0, 5); // Max 5 key points
  }

  private assessImpact(proposal: Proposal, dao: DAOMetadata): string {
    const kind = this.getProposalKind(proposal);
    const daoName = dao.config.name || dao.dao_id;

    switch (kind) {
      case ProposalKind.StrikeAuthorization:
        return `If APPROVED: Authorizes lethal action. If REJECTED: No action authorized. This decision has irreversible consequences and cannot be delegated.`;
      case ProposalKind.Transfer:
        return `If APPROVED: Funds will be transferred as specified. If REJECTED: Funds remain in ${daoName} treasury.`;
      case ProposalKind.AddMember:
        return `If APPROVED: New member gains full voting rights in ${daoName}. If REJECTED: Candidate is not added.`;
      case ProposalKind.RemoveMember:
        return `If APPROVED: Member loses voting rights and access. If REJECTED: Member retains current status.`;
      case ProposalKind.ConfigChange:
        return `If APPROVED: DAO configuration will be updated. If REJECTED: Current settings remain unchanged.`;
      case ProposalKind.FunctionCall:
        return `If APPROVED: Smart contract call will be executed. If REJECTED: No contract interaction occurs.`;
      case ProposalKind.MissionOrder:
        return `If APPROVED: Mission order is authorized for execution. If REJECTED: Mission is not authorized.`;
      default:
        return `If APPROVED: Proposal action will be executed. If REJECTED: No action taken.`;
    }
  }

  private identifyWarnings(proposal: Proposal, dao: DAOMetadata): string[] {
    const warnings: string[] = [];
    const kind = this.getProposalKind(proposal);
    const description = (proposal.description || '').toLowerCase();

    // StrikeAuthorization always has warnings
    if (kind === ProposalKind.StrikeAuthorization) {
      warnings.push('CRITICAL: Strike authorization cannot be delegated to AI agents');
      warnings.push('This decision requires human judgment and cannot be automated');
      warnings.push('Verify all intelligence and authorization chains before voting');
    }

    // Classification warnings
    if (proposal.classification === 'TopSecret') {
      warnings.push('TOP SECRET: Handle according to security protocols');
    } else if (proposal.classification === 'Secret') {
      warnings.push('SECRET: Restricted distribution applies');
    }

    // Content-based warnings
    if (description.includes('urgent') || description.includes('immediate')) {
      warnings.push('Marked as urgent - verify urgency before expediting');
    }
    if (description.includes('irreversible')) {
      warnings.push('Action is marked as irreversible');
    }
    if (description.includes('experimental') || description.includes('untested')) {
      warnings.push('Involves experimental or untested elements');
    }

    // Deadline warning
    const deadline = typeof proposal.voting_deadline === 'string'
      ? parseInt(proposal.voting_deadline)
      : proposal.voting_deadline;
    const nowNs = Date.now() * 1_000_000;
    const timeLeftNs = deadline - nowNs;
    const oneHourNs = 60 * 60 * 1_000_000_000;

    if (timeLeftNs < oneHourNs && timeLeftNs > 0) {
      warnings.push('Less than 1 hour remaining to vote');
    }

    // High activity warning
    if (dao.active_proposal_count > 10) {
      warnings.push(`High activity: ${dao.active_proposal_count} active proposals in this DAO`);
    }

    return warnings;
  }

  private generateRecommendation(proposal: Proposal): string {
    const kind = this.getProposalKind(proposal);
    const description = (proposal.description || '').toLowerCase();

    // Generic recommendations based on proposal type
    switch (kind) {
      case ProposalKind.Transfer:
        return 'Consider: Verify recipient address and amount. Check if funds are available and allocation aligns with budget.';
      case ProposalKind.AddMember:
        return 'Consider: Review candidate qualifications and verify identity. Assess impact on voting dynamics.';
      case ProposalKind.RemoveMember:
        return 'Consider: Review the reasons for removal and ensure due process has been followed.';
      case ProposalKind.ConfigChange:
        return 'Consider: Analyze impact on existing workflows and member permissions. Test changes in staging if possible.';
      case ProposalKind.FunctionCall:
        return 'Consider: Review the target contract and function parameters. Verify the call is authorized and safe.';
      case ProposalKind.MissionOrder:
        return 'Consider: Verify strategic alignment and resource availability. Confirm command chain approval.';
      default:
        return 'Consider: Review the proposal details carefully and consult with relevant stakeholders before voting.';
    }
  }

  // ==========================================================================
  // Helper Methods - Context Analysis
  // ==========================================================================

  private determineRelationship(
    proposal: Proposal,
    other: Proposal
  ): 'parent' | 'related' | 'dependent' {
    const thisKind = this.getProposalKind(proposal);
    const otherKind = this.getProposalKind(other);
    const thisDesc = (proposal.description || '').toLowerCase();
    const otherDesc = (other.description || '').toLowerCase();

    // Same kind = related
    if (thisKind === otherKind) {
      return 'related';
    }

    // If this proposal references the other
    if (thisDesc.includes(`proposal ${other.id}`) || thisDesc.includes(`#${other.id}`)) {
      return 'dependent';
    }

    // If other is older and same topic, could be parent
    const thisCreated = typeof proposal.created_at === 'string'
      ? parseInt(proposal.created_at)
      : proposal.created_at;
    const otherCreated = typeof other.created_at === 'string'
      ? parseInt(other.created_at)
      : other.created_at;

    if (otherCreated < thisCreated) {
      // Check for keyword overlap
      const thisWords = new Set(thisDesc.split(/\s+/).filter((w) => w.length > 4));
      const otherWords = new Set(otherDesc.split(/\s+/).filter((w) => w.length > 4));
      let overlap = 0;
      for (const word of thisWords) {
        if (otherWords.has(word)) overlap++;
      }
      if (overlap > 3) {
        return 'parent';
      }
    }

    return 'related';
  }

  private assessStrategicAlignment(proposal: Proposal, dao: DAOMetadata): string {
    const kind = this.getProposalKind(proposal);
    const daoName = dao.config.name || dao.dao_id;
    const description = (proposal.description || '').toLowerCase();

    // Check for strategic keywords
    if (description.includes('strategic') || description.includes('objective')) {
      return `This proposal explicitly references strategic objectives for ${daoName}.`;
    }

    // Kind-based alignment
    switch (kind) {
      case ProposalKind.ConfigChange:
        return `Configuration changes affect the operational parameters of ${daoName}. Ensure alignment with long-term governance goals.`;
      case ProposalKind.Transfer:
        return `Resource allocation should align with ${daoName}'s budgetary priorities and strategic initiatives.`;
      case ProposalKind.MissionOrder:
        return `Mission orders should directly support ${daoName}'s operational objectives and command priorities.`;
      default:
        return `Review how this proposal supports ${daoName}'s mission and strategic objectives.`;
    }
  }

  private findPrecedents(proposal: Proposal, relatedProposals: Proposal[]): string[] {
    const precedents: string[] = [];
    const thisKind = this.getProposalKind(proposal);

    // Find completed proposals of same kind
    const sameKind = relatedProposals.filter((p) => {
      const pKind = this.getProposalKind(p);
      return pKind === thisKind && p.status !== ProposalStatus.InProgress;
    });

    if (sameKind.length > 0) {
      const approved = sameKind.filter((p) => p.status === ProposalStatus.Approved).length;
      const rejected = sameKind.filter((p) => p.status === ProposalStatus.Rejected).length;

      if (approved > 0 || rejected > 0) {
        precedents.push(
          `Similar proposals: ${approved} approved, ${rejected} rejected in recent history`
        );
      }
    }

    // Add kind-specific precedent notes
    switch (thisKind) {
      case ProposalKind.StrikeAuthorization:
        precedents.push('Strike authorizations require documented intelligence review');
        break;
      case ProposalKind.Transfer:
        precedents.push('Large transfers typically require multi-sig verification');
        break;
    }

    return precedents;
  }

  private identifyContextGaps(proposal: Proposal, dao: DAOMetadata): string[] {
    const gaps: string[] = [];
    const description = (proposal.description || '').toLowerCase();
    const kind = this.getProposalKind(proposal);

    // Check for missing information based on kind
    switch (kind) {
      case ProposalKind.Transfer:
        if (!description.includes('amount') && !description.match(/\d+/)) {
          gaps.push('Transfer amount not clearly specified');
        }
        if (!description.includes('recipient') && !description.includes('to')) {
          gaps.push('Recipient not clearly identified');
        }
        if (!description.includes('budget') && !description.includes('allocation')) {
          gaps.push('No budget justification provided');
        }
        break;
      case ProposalKind.AddMember:
        if (!description.includes('role') && !description.includes('position')) {
          gaps.push('Proposed role for new member not specified');
        }
        if (!description.includes('qualification') && !description.includes('experience')) {
          gaps.push('Candidate qualifications not detailed');
        }
        break;
      case ProposalKind.FunctionCall:
        if (!description.includes('contract') && !description.includes('address')) {
          gaps.push('Target contract not clearly identified');
        }
        if (!description.includes('parameter') && !description.includes('argument')) {
          gaps.push('Function parameters not documented');
        }
        break;
    }

    // General gaps
    if (!description.includes('timeline') && !description.includes('deadline') && !description.includes('when')) {
      gaps.push('No execution timeline specified');
    }
    if (!description.includes('risk') && kind !== ProposalKind.AddMember) {
      gaps.push('Risk assessment not included');
    }
    if (description.length < 50) {
      gaps.push('Description is brief - consider requesting more detail');
    }

    return gaps.slice(0, 5); // Max 5 gaps
  }

  // ==========================================================================
  // Helper Methods - Voting Guidance
  // ==========================================================================

  private explainAutonomy(level: AutonomyLevel): string {
    switch (level) {
      case AutonomyLevel.Autonomous:
        return 'AUTONOMOUS: If approved, this proposal will execute automatically without further human action. The system will carry out the action immediately upon vote threshold being met.';
      case AutonomyLevel.SemiAutonomous:
        return 'SEMI-AUTONOMOUS: If approved, there will be a veto window before execution. Council members can veto during this period. If no veto occurs, the action executes automatically.';
      case AutonomyLevel.NotAutonomous:
        return 'HUMAN-IN-THE-LOOP: This proposal requires explicit human approval before execution, even after votes pass. A designated authority must confirm execution.';
      default:
        return 'Autonomy level determines how the proposal executes after voting completes.';
    }
  }

  private explainCoalitionRequirements(
    coalition: CoalitionProposal,
    userParty?: string
  ): string {
    const required = coalition.required_parties;
    const approved = Object.entries(coalition.party_approvals)
      .filter(([_, a]) => a.approved)
      .map(([party]) => party);
    const pending = required.filter((p) => !approved.includes(p));

    let explanation = `This proposal requires approval from ${required.length} parties: ${required.join(', ')}. `;

    if (coalition.all_parties_required) {
      explanation += 'ALL parties must approve for this proposal to pass. ';
    } else {
      explanation += 'A MAJORITY of parties must approve for this proposal to pass. ';
    }

    if (approved.length > 0) {
      explanation += `Approved by: ${approved.join(', ')}. `;
    }
    if (pending.length > 0) {
      explanation += `Awaiting: ${pending.join(', ')}. `;
    }

    if (userParty) {
      if (approved.includes(userParty)) {
        explanation += `Your party (${userParty}) has already approved.`;
      } else if (pending.includes(userParty)) {
        explanation += `Your party (${userParty}) has not yet approved.`;
      }
    }

    return explanation;
  }

  private determineNextSteps(proposal: Proposal, dao: DAOMetadata): string[] {
    const steps: string[] = [];
    const kind = this.getProposalKind(proposal);
    const effectiveAutonomy = proposal.autonomy_override || dao.config.default_autonomy_level;

    // Voting phase
    if (proposal.status === ProposalStatus.InProgress) {
      steps.push('1. Review proposal details and context');
      steps.push('2. Cast your vote (Approve, Reject, or Abstain)');

      // What happens after voting
      switch (effectiveAutonomy) {
        case AutonomyLevel.Autonomous:
          steps.push('3. If approved, proposal executes automatically');
          break;
        case AutonomyLevel.SemiAutonomous:
          steps.push('3. If approved, enters veto window for council review');
          steps.push('4. If not vetoed, proposal executes automatically');
          break;
        case AutonomyLevel.NotAutonomous:
          steps.push('3. If approved, awaits explicit human authorization');
          steps.push('4. Designated authority must confirm execution');
          break;
      }
    } else if (proposal.status === ProposalStatus.Approved) {
      switch (effectiveAutonomy) {
        case AutonomyLevel.SemiAutonomous:
          steps.push('Proposal is approved and in veto window');
          steps.push('Council members may veto if concerns arise');
          break;
        case AutonomyLevel.NotAutonomous:
          steps.push('Proposal is approved and awaiting human authorization');
          steps.push('Designated authority must confirm execution');
          break;
        default:
          steps.push('Proposal is approved and ready for execution');
          break;
      }
    }

    return steps;
  }

  // ==========================================================================
  // Utility Methods
  // ==========================================================================

  private getProposalKind(proposal: Proposal): ProposalKind {
    if (typeof proposal.kind === 'string') {
      if (Object.values(ProposalKind).includes(proposal.kind as ProposalKind)) {
        return proposal.kind as ProposalKind;
      }
      return ProposalKind.Custom;
    }
    if (typeof proposal.kind === 'object' && 'Custom' in proposal.kind) {
      return ProposalKind.Custom;
    }
    return ProposalKind.Custom;
  }
}

// ==========================================================================
// Singleton Export
// ==========================================================================

export const governanceCopilot = new GovernanceCopilot();
