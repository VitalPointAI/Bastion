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

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

/**
 * GovernanceService class for DAO operations.
 */
export class GovernanceService {
  private token: string | null = null;
  private userDID: string | null = null;

  /**
   * Set authentication token for API requests.
   */
  setAuthToken(token: string): void {
    this.token = token;
  }

  /**
   * Set user DID for action-required detection.
   */
  setUserDID(did: string): void {
    this.userDID = did;
  }

  /**
   * Make authenticated API request.
   */
  private async fetch<T>(path: string, options: RequestInit = {}): Promise<T> {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (this.token) {
      (headers as Record<string, string>)['Authorization'] = `Bearer ${this.token}`;
    }

    if (this.userDID) {
      (headers as Record<string, string>)['X-DID'] = this.userDID;
    }

    const response = await fetch(`${API_BASE}${path}`, {
      ...options,
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
    const rawDAOs = await this.fetch<any[]>(`/api/dao?offset=${offset}&limit=${limit}`);
    return rawDAOs.map(this.transformDAO);
  }

  /**
   * Get DAO by ID.
   */
  async getDAO(daoId: string): Promise<DAOMetadata> {
    const rawDAO = await this.fetch<any>(`/api/dao/${encodeURIComponent(daoId)}`);
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
    let path = `/api/dao/${encodeURIComponent(daoId)}/proposals?offset=${offset}&limit=${limit}`;
    if (status) {
      path += `&status=${status}`;
    }
    const rawProposals = await this.fetch<any[]>(path);
    return rawProposals.map((p) => this.transformProposal(p, daoId));
  }

  /**
   * Get proposal by ID.
   */
  async getProposal(daoId: string, proposalId: number): Promise<Proposal> {
    const rawProposal = await this.fetch<any>(`/api/dao/${encodeURIComponent(daoId)}/proposals/${proposalId}`);
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
    const rawVotes = await this.fetch<any[]>(
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
        headers: {
          'Content-Type': 'application/json',
          ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
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
        headers: {
          'Content-Type': 'application/json',
          ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
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
        headers: {
          'Content-Type': 'application/json',
          ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
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
    try {
      const raw = await this.fetch<any>(
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
        headers: {
          'Content-Type': 'application/json',
          ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
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

  private transformDAO(raw: any): DAOMetadata {
    return {
      daoId: raw.dao_id,
      name: raw.config?.name || raw.name || '',
      description: raw.config?.description || raw.description || '',
      classification: raw.config?.classification || Classification.Public,
      defaultAutonomy: raw.config?.default_autonomy_level || AutonomyLevel.NotAutonomous,
      memberCount: raw.member_count || 0,
      activeProposalCount: raw.active_proposal_count || 0,
      parentDaoId: raw.config?.parent_dao_id || undefined,
      createdAt: parseInt(raw.created_at) || 0,
      createdBy: raw.created_by || '',
    };
  }

  private transformProposal(raw: any, daoId: string): Proposal {
    const deadlineNs = parseInt(raw.voting_deadline) || 0;
    const autonomyOverride = raw.autonomy_override || undefined;
    const effectiveAutonomy = autonomyOverride || AutonomyLevel.NotAutonomous;

    // Parse kind - could be string or { Custom: string }
    let kind: ProposalKind | string = raw.kind;
    if (typeof raw.kind === 'object' && raw.kind.Custom) {
      kind = `Custom:${raw.kind.Custom}`;
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
      createdAt: parseInt(raw.created_at) || 0,
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

  private transformVote(raw: any): Vote {
    return {
      voter: raw.voter,
      voteType: raw.vote_type,
      weight: raw.weight || 1,
      timestamp: parseInt(raw.timestamp) || 0,
    };
  }

  private transformCoalitionStatus(raw: any): CoalitionStatus {
    const approvals: Record<string, { approved: boolean; approvedBy?: string; approvedAt?: number }> = {};
    const pendingParties: string[] = [];

    for (const party of raw.required_parties || []) {
      const approval = raw.party_approvals?.[party];
      if (approval) {
        approvals[party] = {
          approved: approval.approved,
          approvedBy: approval.approved_by,
          approvedAt: parseInt(approval.approved_at) || undefined,
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
