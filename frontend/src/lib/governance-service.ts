/**
 * Governance Service
 *
 * Client for DAO governance API endpoints.
 * Provides typed methods for DAOs, proposals, voting, and coalition operations.
 */

import type {
  DAOMetadata,
  DAOResponse,
  Proposal,
  ProposalContext,
  Vote,
  CoalitionStatus,
  TransactionArgs,
} from '../types/dao';

import {
  ProposalStatus,
  VoteType,
  AutonomyLevel,
  ProposalKind,
  ExecutionState,
  Classification,
} from '../types/dao';

// Use environment variable or empty string for relative URLs (Vite proxy)
const API_BASE = import.meta.env.VITE_BACKEND_API_URL || '';

/** Raw DAO data from the backend API */
interface RawDAO {
  dao_id: string;
  config?: {
    name?: string;
    description?: string;
    classification?: Classification;
    default_autonomy_level?: AutonomyLevel;
    parent_dao_id?: string;
  };
  name?: string;
  description?: string;
  member_count?: number;
  active_proposal_count?: number;
  created_at?: string;
  created_by?: string;
}

/** Raw proposal data from the backend API */
interface RawProposal {
  id: number;
  kind: ProposalKind | string | { Custom: string };
  proposer: string;
  description: string;
  classification?: Classification;
  autonomy_override?: AutonomyLevel;
  status: ProposalStatus;
  votes_approve?: number;
  votes_reject?: number;
  created_at?: string;
  voting_deadline?: string;
  execution_result?: string;
}

/** Raw vote data from the backend API */
interface RawVote {
  voter: string;
  vote_type: VoteType;
  weight?: number;
  timestamp?: string;
}

/** Raw coalition status data from the backend API */
interface RawCoalitionStatus {
  required_parties?: string[];
  party_approvals?: Record<string, {
    approved: boolean;
    approved_by?: string;
    approved_at?: string;
  }>;
  all_parties_required?: boolean;
}

// ============================================================================
// Copilot Analysis Types
// ============================================================================

/**
 * Summary output from proposal analysis.
 */
export interface ProposalSummaryOutput {
  summary: string;
  keyPoints: string[];
  impactAssessment: string;
  recommendation?: string;
  warnings: string[];
}

/**
 * Context analysis output.
 */
export interface ContextAnalysisOutput {
  relatedProposals: Array<{
    daoId: string;
    proposalId: number;
    summary: string;
    relationship: 'parent' | 'related' | 'dependent';
  }>;
  strategicAlignment: string;
  precedents: string[];
  contextGaps: string[];
}

/**
 * Voting guidance output.
 */
export interface VotingGuidanceOutput {
  eligibility: {
    canVote: boolean;
    reason?: string;
  };
  autonomyExplanation: string;
  coalitionRequirements?: {
    requiredParties: string[];
    myParty?: string;
    explanation: string;
  };
  nextSteps: string[];
  deadlineWarning?: string;
}

/**
 * Combined copilot analysis output.
 */
export interface CopilotAnalysis {
  summary: ProposalSummaryOutput;
  context: ContextAnalysisOutput;
  guidance: VotingGuidanceOutput;
}

// Mock data mode - enable for UI testing without backend data
const USE_MOCK_DATA = import.meta.env.VITE_USE_MOCK_DATA === 'true';

// Mock data for testing — generic coalition command structure (scenario-agnostic)
const MOCK_DAOS: DAOMetadata[] = [
  {
    daoId: 'coalition-cmd.bastion.near',
    name: 'Coalition Command Authority',
    description: 'Coalition command authority for the active operation — weighted by contributor nation',
    classification: Classification.Secret,
    defaultAutonomy: AutonomyLevel.NotAutonomous,
    memberCount: 6,
    activeProposalCount: 3,
    createdAt: Date.now() * 1_000_000,
    createdBy: 'coalition-cmd.near',
  },
  {
    daoId: 'intel-cell.bastion.near',
    name: 'Coalition Intel Cell',
    description: 'Coalition intelligence sharing and coordination for the operational theater',
    classification: Classification.TopSecret,
    defaultAutonomy: AutonomyLevel.NotAutonomous,
    memberCount: 5,
    activeProposalCount: 2,
    createdAt: Date.now() * 1_000_000,
    createdBy: 'intel-coord.near',
  },
  {
    daoId: 'jtf-logistics.bastion.near',
    name: 'JTF Logistics',
    description: 'Supply chain and resource allocation for the active operation',
    classification: Classification.Secret,
    defaultAutonomy: AutonomyLevel.SemiAutonomous,
    memberCount: 8,
    activeProposalCount: 1,
    createdAt: Date.now() * 1_000_000,
    createdBy: 'logistics.near',
  },
];

const nowNs = Date.now() * 1_000_000;
const hourNs = 60 * 60 * 1_000_000_000;
const dayNs = 24 * hourNs;

const MOCK_PROPOSALS: Record<string, Proposal[]> = {
  'coalition-cmd.bastion.near': [
    {
      id: 0,
      daoId: 'coalition-cmd.bastion.near',
      kind: ProposalKind.Transfer,
      proposer: 'radm-chen.near',
      description: 'Resource allocation: Deploy ISR assets and air support to the area of operations for 90-day rotation',
      classification: Classification.Secret,
      status: ProposalStatus.Approved,
      votesApprove: 6,
      votesReject: 0,
      createdAt: nowNs - 3 * dayNs,
      votingDeadline: nowNs - dayNs,
      executionState: ExecutionState.Executed,
      effectiveAutonomy: AutonomyLevel.NotAutonomous,
      timeRemaining: 'Executed',
      requiresMyAction: false,
      isUrgent: false,
    },
    {
      id: 1,
      daoId: 'coalition-cmd.bastion.near',
      kind: ProposalKind.MissionOrder,
      proposer: 'ops-planner.near',
      description: 'Mission Order: Modify patrol route for ISR orbit — extend coverage to northern chokepoint',
      classification: Classification.Secret,
      autonomyOverride: AutonomyLevel.SemiAutonomous,
      status: ProposalStatus.InProgress,
      votesApprove: 3,
      votesReject: 0,
      createdAt: nowNs - 2 * hourNs,
      votingDeadline: nowNs + 4 * hourNs,
      executionState: ExecutionState.Pending,
      effectiveAutonomy: AutonomyLevel.SemiAutonomous,
      timeRemaining: '4h',
      requiresMyAction: true,
      isUrgent: false,
    },
    {
      id: 2,
      daoId: 'coalition-cmd.bastion.near',
      kind: ProposalKind.StrikeAuthorization,
      proposer: 'intel-officer.near',
      description: 'URGENT: Strike authorization for confirmed hostile vessel harassing coalition resupply convoy in the area of operations',
      classification: Classification.Secret,
      autonomyOverride: AutonomyLevel.NotAutonomous,
      status: ProposalStatus.InProgress,
      votesApprove: 2,
      votesReject: 0,
      createdAt: nowNs - hourNs,
      votingDeadline: nowNs + (30 * 60 * 1_000_000_000),
      executionState: ExecutionState.AwaitingHumanApproval,
      effectiveAutonomy: AutonomyLevel.NotAutonomous,
      timeRemaining: '30m',
      requiresMyAction: true,
      isUrgent: true,
    },
  ],
  'intel-cell.bastion.near': [
    {
      id: 0,
      daoId: 'intel-cell.bastion.near',
      kind: ProposalKind.FunctionCall,
      proposer: 'gchq.near',
      description: 'Cross-coalition intelligence share request: SIGINT data for Operation Northern Shield',
      classification: Classification.TopSecret,
      autonomyOverride: AutonomyLevel.NotAutonomous,
      status: ProposalStatus.InProgress,
      votesApprove: 2,
      votesReject: 0,
      createdAt: nowNs - 6 * hourNs,
      votingDeadline: nowNs + 18 * hourNs,
      executionState: ExecutionState.Pending,
      effectiveAutonomy: AutonomyLevel.NotAutonomous,
      timeRemaining: '18h',
      requiresMyAction: true,
      isUrgent: false,
    },
    {
      id: 1,
      daoId: 'intel-cell.bastion.near',
      kind: ProposalKind.Transfer,
      proposer: 'csis.near',
      description: 'Budget allocation for joint surveillance operation',
      classification: Classification.Secret,
      status: ProposalStatus.InProgress,
      votesApprove: 3,
      votesReject: 1,
      createdAt: nowNs - 2 * dayNs,
      votingDeadline: nowNs + dayNs,
      executionState: ExecutionState.Pending,
      effectiveAutonomy: AutonomyLevel.SemiAutonomous,
      timeRemaining: '1d',
      requiresMyAction: false,
      isUrgent: false,
    },
  ],
  'jtf-logistics.bastion.near': [
    {
      id: 0,
      daoId: 'jtf-logistics.bastion.near',
      kind: ProposalKind.Transfer,
      proposer: 'supply-officer.near',
      description: 'JP-5 fuel allocation increase for extended patrol rotation in the area of operations',
      classification: Classification.Secret,
      status: ProposalStatus.Approved,
      votesApprove: 6,
      votesReject: 0,
      createdAt: nowNs - dayNs,
      votingDeadline: nowNs - 2 * hourNs,
      executionState: ExecutionState.ReadyForExecution,
      effectiveAutonomy: AutonomyLevel.SemiAutonomous,
      timeRemaining: 'Expired',
      requiresMyAction: false,
      isUrgent: false,
    },
  ],
};

const MOCK_COALITION_STATUS: CoalitionStatus = {
  requiredParties: ['USA', 'GBR', 'CAN'],
  approvals: {
    'USA': { approved: true, approvedBy: 'radm-chen.near', approvedAt: nowNs - hourNs },
    'GBR': { approved: true, approvedBy: 'cdre-thompson.near', approvedAt: nowNs - 2 * hourNs },
    'CAN': { approved: false },
  },
  allPartiesRequired: true,
  isApproved: false,
  pendingParties: ['CAN'],
};

/**
 * GovernanceService class for DAO operations.
 */
export class GovernanceService {
  private userDID: string | null = null;

  /**
   * Set user DID for action-required detection.
   */
  setUserDID(did: string): void {
    this.userDID = did;
  }

  /**
   * Make authenticated API request.
   * Authentication is via HttpOnly cookie sent automatically with credentials: 'include'.
   */
  private async fetch<T>(path: string, options: RequestInit = {}): Promise<T> {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (this.userDID) {
      (headers as Record<string, string>)['X-DID'] = this.userDID;
    }

    const response = await fetch(`${API_BASE}${path}`, {
      ...options,
      credentials: 'include',
      headers,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(error.error || `HTTP ${response.status}`);
    }

    const result: DAOResponse<T> = await response.json();
    if (!result.success) {
      throw new Error(result.error || 'API request failed');
    }

    return result.data as T;
  }

  // ============================================================================
  // DAO Operations
  // ============================================================================

  /**
   * List all accessible DAOs.
   */
  async listDAOs(offset = 0, limit = 50): Promise<DAOMetadata[]> {
    if (USE_MOCK_DATA) {
      return MOCK_DAOS.slice(offset, offset + limit);
    }
    const rawDAOs = await this.fetch<RawDAO[]>(`/api/dao?offset=${offset}&limit=${limit}`);
    return rawDAOs.map(this.transformDAO);
  }

  /**
   * Get DAO by ID.
   */
  async getDAO(daoId: string): Promise<DAOMetadata> {
    if (USE_MOCK_DATA) {
      const dao = MOCK_DAOS.find((d) => d.daoId === daoId);
      if (!dao) throw new Error(`DAO ${daoId} not found`);
      return dao;
    }
    const rawDAO = await this.fetch<RawDAO>(`/api/dao/${encodeURIComponent(daoId)}`);
    return this.transformDAO(rawDAO);
  }

  /**
   * Get DAOs where user is a member.
   */
  async getMyDAOs(): Promise<DAOMetadata[]> {
    // Backend doesn't have a specific endpoint for this yet
    // For now, return all accessible DAOs
    return this.listDAOs();
  }

  // ============================================================================
  // Proposal Operations
  // ============================================================================

  /**
   * List proposals for a DAO.
   */
  async listProposals(daoId: string, status?: ProposalStatus, offset = 0, limit = 50): Promise<Proposal[]> {
    if (USE_MOCK_DATA) {
      let proposals = MOCK_PROPOSALS[daoId] || [];
      if (status) {
        proposals = proposals.filter((p) => p.status === status);
      }
      return proposals.slice(offset, offset + limit);
    }
    let path = `/api/dao/${encodeURIComponent(daoId)}/proposals?offset=${offset}&limit=${limit}`;
    if (status) {
      path += `&status=${status}`;
    }
    const rawProposals = await this.fetch<RawProposal[]>(path);
    return rawProposals.map((p) => this.transformProposal(p, daoId));
  }

  /**
   * Get proposal by ID.
   */
  async getProposal(daoId: string, proposalId: number): Promise<Proposal> {
    if (USE_MOCK_DATA) {
      const proposals = MOCK_PROPOSALS[daoId] || [];
      const proposal = proposals.find((p) => p.id === proposalId);
      if (!proposal) throw new Error(`Proposal ${proposalId} not found`);
      return proposal;
    }
    const rawProposal = await this.fetch<RawProposal>(`/api/dao/${encodeURIComponent(daoId)}/proposals/${proposalId}`);
    return this.transformProposal(rawProposal, daoId);
  }

  /**
   * Get proposal context (parent, related, strategic objective).
   */
  async getProposalContext(_daoId: string, _proposalId: number): Promise<ProposalContext> {
    // Backend doesn't have a dedicated context endpoint yet
    // Return empty context for now
    return {
      parentProposals: [],
      relatedProposals: [],
      strategicObjective: undefined,
    };
  }

  /**
   * Get all proposals requiring user action across all DAOs.
   */
  async getMyActionRequired(): Promise<Proposal[]> {
    if (USE_MOCK_DATA) {
      const allProposals = Object.values(MOCK_PROPOSALS).flat();
      return allProposals
        .filter((p) => p.requiresMyAction && p.status === ProposalStatus.InProgress)
        .sort((a, b) => a.votingDeadline - b.votingDeadline);
    }

    const daos = await this.listDAOs();
    const actionRequired: Proposal[] = [];

    for (const dao of daos) {
      try {
        const proposals = await this.listProposals(dao.daoId, ProposalStatus.InProgress);
        const requiresAction = proposals.filter((p) => p.requiresMyAction);
        actionRequired.push(...requiresAction);
      } catch {
        // Skip DAOs we can't access
      }
    }

    // Sort by deadline (soonest first)
    return actionRequired.sort((a, b) => a.votingDeadline - b.votingDeadline);
  }

  // ============================================================================
  // Voting Operations
  // ============================================================================

  /**
   * Get votes for a proposal.
   */
  async getVotes(daoId: string, proposalId: number): Promise<Vote[]> {
    if (USE_MOCK_DATA) {
      // Generate mock votes based on proposal vote counts
      const proposals = MOCK_PROPOSALS[daoId] || [];
      const proposal = proposals.find((p) => p.id === proposalId);
      if (!proposal) return [];

      const votes: Vote[] = [];
      const voters = ['commander.near', 'intel-officer.near', 'ops-planner.near', 'council-member.near', 'advisor.near'];
      for (let i = 0; i < proposal.votesApprove; i++) {
        votes.push({
          voter: voters[i % voters.length],
          voteType: VoteType.Approve,
          weight: 1,
          timestamp: nowNs - (i * hourNs),
        });
      }
      for (let i = 0; i < proposal.votesReject; i++) {
        votes.push({
          voter: `reviewer-${i + 1}.near`,
          voteType: VoteType.Reject,
          weight: 1,
          timestamp: nowNs - (i * hourNs),
        });
      }
      return votes;
    }
    const rawVotes = await this.fetch<RawVote[]>(
      `/api/dao/${encodeURIComponent(daoId)}/proposals/${proposalId}/votes`
    );
    return rawVotes.map(this.transformVote);
  }

  /**
   * Build vote transaction for wallet signing.
   */
  async buildVoteTx(daoId: string, proposalId: number, voteType: VoteType): Promise<TransactionArgs> {
    const response = await fetch(
      `${API_BASE}/api/dao/${encodeURIComponent(daoId)}/proposals/${proposalId}/vote`,
      {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...(this.userDID ? { 'X-DID': this.userDID } : {}),
        },
        body: JSON.stringify({ vote_type: voteType }),
      }
    );

    const result: DAOResponse<never> = await response.json();
    if (!result.success || !result.transaction) {
      throw new Error(result.error || 'Failed to build vote transaction');
    }
    return result.transaction;
  }

  /**
   * Build veto transaction for wallet signing.
   */
  async buildVetoTx(daoId: string, proposalId: number): Promise<TransactionArgs> {
    const response = await fetch(
      `${API_BASE}/api/dao/${encodeURIComponent(daoId)}/proposals/${proposalId}/veto`,
      {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...(this.userDID ? { 'X-DID': this.userDID } : {}),
        },
      }
    );

    const result: DAOResponse<never> = await response.json();
    if (!result.success || !result.transaction) {
      throw new Error(result.error || 'Failed to build veto transaction');
    }
    return result.transaction;
  }

  /**
   * Build human approval transaction for wallet signing.
   */
  async buildHumanApprovalTx(daoId: string, proposalId: number): Promise<TransactionArgs> {
    const response = await fetch(
      `${API_BASE}/api/dao/${encodeURIComponent(daoId)}/proposals/${proposalId}/approve`,
      {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...(this.userDID ? { 'X-DID': this.userDID } : {}),
        },
      }
    );

    const result: DAOResponse<never> = await response.json();
    if (!result.success || !result.transaction) {
      throw new Error(result.error || 'Failed to build approval transaction');
    }
    return result.transaction;
  }

  // ============================================================================
  // Coalition Operations
  // ============================================================================

  /**
   * Get coalition status for a proposal.
   */
  async getCoalitionStatus(daoId: string, proposalId: number): Promise<CoalitionStatus | null> {
    if (USE_MOCK_DATA) {
      // Return coalition status for coalition DAOs
      if (daoId === 'intel-cell.bastion.near' || daoId === 'coalition-cmd.bastion.near') {
        return MOCK_COALITION_STATUS;
      }
      return null;
    }
    try {
      const raw = await this.fetch<RawCoalitionStatus>(
        `/api/dao/${encodeURIComponent(daoId)}/proposals/${proposalId}/coalition`
      );
      return this.transformCoalitionStatus(raw);
    } catch {
      // No coalition for this proposal
      return null;
    }
  }

  /**
   * Build coalition approval transaction for wallet signing.
   */
  async buildCoalitionApprovalTx(daoId: string, proposalId: number, party: string): Promise<TransactionArgs> {
    const response = await fetch(
      `${API_BASE}/api/dao/${encodeURIComponent(daoId)}/proposals/${proposalId}/coalition/approve`,
      {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...(this.userDID ? { 'X-DID': this.userDID } : {}),
        },
        body: JSON.stringify({ party }),
      }
    );

    const result: DAOResponse<never> = await response.json();
    if (!result.success || !result.transaction) {
      throw new Error(result.error || 'Failed to build coalition approval transaction');
    }
    return result.transaction;
  }

  // ============================================================================
  // AI Copilot Operations
  // ============================================================================

  /**
   * Get copilot analysis for a proposal.
   * Returns summary, context analysis, and voting guidance.
   */
  async getCopilotAnalysis(
    daoId: string,
    proposalId: number,
    userRoles: string[] = [],
    userParty?: string
  ): Promise<CopilotAnalysis> {
    if (USE_MOCK_DATA) {
      // Return mock copilot analysis
      return this.getMockCopilotAnalysis(daoId, proposalId);
    }

    let path = `/api/agents/governance-copilot/analyze?daoId=${encodeURIComponent(daoId)}&proposalId=${proposalId}`;
    if (userRoles.length > 0) {
      path += `&userRoles=${encodeURIComponent(userRoles.join(','))}`;
    }
    if (userParty) {
      path += `&userParty=${encodeURIComponent(userParty)}`;
    }

    return this.fetch<CopilotAnalysis>(path);
  }

  /**
   * Generate mock copilot analysis for testing.
   */
  private getMockCopilotAnalysis(daoId: string, proposalId: number): CopilotAnalysis {
    const proposals = MOCK_PROPOSALS[daoId] || [];
    const proposal = proposals.find((p) => p.id === proposalId);
    const isStrike = proposal?.kind === ProposalKind.StrikeAuthorization;

    return {
      summary: {
        summary: proposal?.description || 'No description available for this proposal.',
        keyPoints: [
          'Requires review before voting',
          isStrike ? 'Cannot be delegated to AI agents' : 'Standard approval workflow',
          'Voting deadline is approaching',
        ],
        impactAssessment: isStrike
          ? 'If APPROVED: Authorizes lethal action. If REJECTED: No action authorized. This decision has irreversible consequences.'
          : 'If APPROVED: Action will be executed according to autonomy level. If REJECTED: No action taken.',
        recommendation: isStrike
          ? undefined
          : 'Consider: Review the proposal details carefully and consult with relevant stakeholders before voting.',
        warnings: isStrike
          ? [
              'CRITICAL: Strike authorization cannot be delegated to AI agents',
              'This decision requires human judgment and cannot be automated',
              'Verify all intelligence and authorization chains before voting',
            ]
          : [],
      },
      context: {
        relatedProposals: [],
        strategicAlignment: `Review how this proposal supports ${daoId.split('.')[0]}'s mission and strategic objectives.`,
        precedents: [],
        contextGaps: proposal?.description && proposal.description.length < 100
          ? ['Description is brief - consider requesting more detail']
          : [],
      },
      guidance: {
        eligibility: {
          canVote: true,
        },
        autonomyExplanation: isStrike
          ? 'HUMAN-IN-THE-LOOP: This proposal requires explicit human approval before execution, even after votes pass. Strike authorization cannot be automated.'
          : 'SEMI-AUTONOMOUS: If approved, there will be a veto window before execution. Council members can veto during this period.',
        nextSteps: [
          '1. Review proposal details and context',
          '2. Cast your vote (Approve, Reject, or Abstain)',
          isStrike
            ? '3. If approved, awaits explicit human authorization'
            : '3. If approved, enters veto window for council review',
        ],
        deadlineWarning: proposal?.isUrgent ? 'URGENT: Less than 1 hour to vote' : undefined,
      },
    };
  }

  // ============================================================================
  // Helper Functions
  // ============================================================================

  /**
   * Format time remaining until deadline.
   */
  formatTimeRemaining(deadlineNs: number): string {
    const now = Date.now() * 1_000_000; // Convert to nanoseconds
    const remaining = deadlineNs - now;

    if (remaining <= 0) {
      return 'Expired';
    }

    const seconds = Math.floor(remaining / 1_000_000_000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) {
      return `${days}d ${hours % 24}h`;
    }
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    }
    if (minutes > 0) {
      return `${minutes}m`;
    }
    return `${seconds}s`;
  }

  /**
   * Check if deadline is urgent (< 1 hour).
   */
  isUrgent(deadlineNs: number): boolean {
    const now = Date.now() * 1_000_000;
    const remaining = deadlineNs - now;
    const oneHourNs = 60 * 60 * 1_000_000_000;
    return remaining > 0 && remaining < oneHourNs;
  }

  /**
   * Get human-readable autonomy label.
   */
  getAutonomyLabel(level: AutonomyLevel): string {
    switch (level) {
      case AutonomyLevel.Autonomous:
        return 'Autonomous';
      case AutonomyLevel.SemiAutonomous:
        return 'Semi-Autonomous';
      case AutonomyLevel.NotAutonomous:
        return 'Human Approval Required';
      default:
        return level;
    }
  }

  /**
   * Get human-readable status label.
   */
  getStatusLabel(status: ProposalStatus): string {
    switch (status) {
      case ProposalStatus.InProgress:
        return 'Voting';
      case ProposalStatus.Approved:
        return 'Approved';
      case ProposalStatus.Rejected:
        return 'Rejected';
      case ProposalStatus.Removed:
        return 'Removed';
      case ProposalStatus.Expired:
        return 'Expired';
      case ProposalStatus.Failed:
        return 'Failed';
      default:
        return status;
    }
  }

  /**
   * Get human-readable proposal kind label.
   */
  getKindLabel(kind: ProposalKind | string): string {
    if (typeof kind === 'string' && kind.startsWith('Custom:')) {
      return kind.substring(7);
    }
    switch (kind) {
      case ProposalKind.ConfigChange:
        return 'Configuration Change';
      case ProposalKind.AddMember:
        return 'Add Member';
      case ProposalKind.RemoveMember:
        return 'Remove Member';
      case ProposalKind.Transfer:
        return 'Transfer';
      case ProposalKind.FunctionCall:
        return 'Function Call';
      case ProposalKind.StrikeAuthorization:
        return 'STRIKE AUTHORIZATION';
      case ProposalKind.MissionOrder:
        return 'Mission Order';
      case ProposalKind.Custom:
        return 'Custom';
      default:
        return String(kind);
    }
  }

  /**
   * Get execution state label.
   */
  getExecutionStateLabel(state: ExecutionState): string {
    switch (state) {
      case ExecutionState.Pending:
        return 'Pending';
      case ExecutionState.ReadyForExecution:
        return 'Ready for Execution';
      case ExecutionState.InVetoWindow:
        return 'In Veto Window';
      case ExecutionState.AwaitingHumanApproval:
        return 'Awaiting Human Approval';
      case ExecutionState.Executed:
        return 'Executed';
      case ExecutionState.Vetoed:
        return 'Vetoed';
      case ExecutionState.Rejected:
        return 'Rejected';
      default:
        return state;
    }
  }

  /**
   * Get classification label.
   */
  getClassificationLabel(classification: Classification): string {
    switch (classification) {
      case Classification.Public:
        return 'UNCLASSIFIED';
      case Classification.Secret:
        return 'SECRET';
      case Classification.TopSecret:
        return 'TOP SECRET';
      default:
        return classification;
    }
  }

  // ============================================================================
  // Transform Functions (Backend → Frontend)
  // ============================================================================

  private transformDAO(raw: RawDAO): DAOMetadata {
    return {
      daoId: raw.dao_id,
      name: raw.config?.name || raw.name || '',
      description: raw.config?.description || raw.description || '',
      classification: raw.config?.classification || Classification.Public,
      defaultAutonomy: raw.config?.default_autonomy_level || AutonomyLevel.NotAutonomous,
      memberCount: raw.member_count || 0,
      activeProposalCount: raw.active_proposal_count || 0,
      parentDaoId: raw.config?.parent_dao_id || undefined,
      createdAt: parseInt(raw.created_at ?? '0') || 0,
      createdBy: raw.created_by || '',
    };
  }

  private transformProposal(raw: RawProposal, daoId: string): Proposal {
    const deadlineNs = parseInt(raw.voting_deadline ?? '0') || 0;
    const autonomyOverride = raw.autonomy_override || undefined;
    const effectiveAutonomy = autonomyOverride || AutonomyLevel.NotAutonomous;

    // Parse kind - could be string or { Custom: string }
    let kind: ProposalKind | string;
    if (typeof raw.kind === 'object' && raw.kind !== null && 'Custom' in raw.kind) {
      kind = `Custom:${(raw.kind as { Custom: string }).Custom}`;
    } else {
      kind = raw.kind as ProposalKind | string;
    }

    // Determine execution state
    let executionState: ExecutionState = ExecutionState.Pending;
    if (raw.status === ProposalStatus.Approved) {
      if (effectiveAutonomy === AutonomyLevel.Autonomous) {
        executionState = ExecutionState.ReadyForExecution;
      } else if (effectiveAutonomy === AutonomyLevel.SemiAutonomous) {
        executionState = ExecutionState.InVetoWindow;
      } else {
        executionState = ExecutionState.AwaitingHumanApproval;
      }
    } else if (raw.status === ProposalStatus.Rejected) {
      executionState = ExecutionState.Rejected;
    }

    // Check if user needs to take action
    const requiresMyAction =
      raw.status === ProposalStatus.InProgress ||
      executionState === ExecutionState.AwaitingHumanApproval;

    return {
      id: raw.id,
      daoId,
      kind,
      proposer: raw.proposer,
      description: raw.description,
      classification: raw.classification || Classification.Public,
      autonomyOverride,
      status: raw.status,
      votesApprove: raw.votes_approve || 0,
      votesReject: raw.votes_reject || 0,
      createdAt: parseInt(raw.created_at ?? '0') || 0,
      votingDeadline: deadlineNs,
      executionState,
      executionResult: raw.execution_result,
      effectiveAutonomy,
      timeRemaining: this.formatTimeRemaining(deadlineNs),
      requiresMyAction,
      myVote: undefined, // Would need to check votes list
      isUrgent: this.isUrgent(deadlineNs),
    };
  }

  private transformVote(raw: RawVote): Vote {
    return {
      voter: raw.voter,
      voteType: raw.vote_type,
      weight: raw.weight || 1,
      timestamp: parseInt(raw.timestamp ?? '0') || 0,
    };
  }

  private transformCoalitionStatus(raw: RawCoalitionStatus): CoalitionStatus {
    const approvals: Record<string, { approved: boolean; approvedBy?: string; approvedAt?: number }> = {};
    const pendingParties: string[] = [];

    for (const party of raw.required_parties || []) {
      const approval = raw.party_approvals?.[party];
      if (approval) {
        approvals[party] = {
          approved: approval.approved,
          approvedBy: approval.approved_by,
          approvedAt: approval.approved_at ? parseInt(approval.approved_at) : undefined,
        };
        if (!approval.approved) {
          pendingParties.push(party);
        }
      } else {
        approvals[party] = { approved: false };
        pendingParties.push(party);
      }
    }

    // Check if all required approvals are met
    const isApproved = raw.all_parties_required
      ? pendingParties.length === 0
      : Object.values(approvals).filter((a) => a.approved).length > (raw.required_parties?.length || 0) / 2;

    return {
      requiredParties: raw.required_parties || [],
      approvals,
      allPartiesRequired: raw.all_parties_required ?? true,
      isApproved,
      pendingParties,
    };
  }
}

// Export singleton instance
export const governanceService = new GovernanceService();
