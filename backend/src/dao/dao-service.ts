/**
 * DAO Service
 *
 * Backend service for interacting with the NEAR DAO contract.
 * Provides view methods for querying state and transaction builders
 * for write operations (to be signed by frontend).
 */

import { JsonRpcProvider } from '@near-js/providers';
import {
  AutonomyLevel,
  Classification,
  CoalitionProposal,
  DAOConfig,
  DAOMetadata,
  ExecutionState,
  Proposal,
  ProposalKind,
  TransactionArgs,
  Vote,
  VoteType,
} from './types.js';

/** Default gas for view calls (not used but kept for documentation) */
const _VIEW_GAS = '30000000000000'; // 30 TGas

/** Default gas for change calls */
const CHANGE_GAS = '100000000000000'; // 100 TGas

/** No deposit for most operations */
const NO_DEPOSIT = '0';

/** Default proposal bond (1 NEAR) */
const DEFAULT_PROPOSAL_BOND = '1000000000000000000000000';

/**
 * DAO Service for contract interactions.
 * Uses JsonRpcProvider from @near-js/providers (consistent with 2-08 migration).
 */
export class DAOService {
  private provider: JsonRpcProvider;
  private contractId: string;

  constructor(rpcUrl: string, contractId: string) {
    this.provider = new JsonRpcProvider({ url: rpcUrl });
    this.contractId = contractId;
  }

  // ==========================================================================
  // View Methods (no auth required, but results should be filtered by clearance)
  // ==========================================================================

  /**
   * Get a single DAO by ID.
   */
  async getDAO(daoId: string): Promise<DAOMetadata | null> {
    try {
      const result = await this.viewMethod('get_dao', { dao_id: daoId });
      return result as DAOMetadata | null;
    } catch (error) {
      console.error(`Error getting DAO ${daoId}:`, error);
      return null;
    }
  }

  /**
   * List all DAOs with pagination.
   */
  async listDAOs(offset: number = 0, limit: number = 50): Promise<DAOMetadata[]> {
    try {
      const result = await this.viewMethod('list_daos', {
        from_index: offset,
        limit,
      });
      return (result as DAOMetadata[]) || [];
    } catch (error) {
      console.error('Error listing DAOs:', error);
      return [];
    }
  }

  /**
   * Get a single proposal by DAO ID and proposal ID.
   */
  async getProposal(daoId: string, proposalId: number): Promise<Proposal | null> {
    try {
      const result = await this.viewMethod('get_proposal', {
        dao_id: daoId,
        proposal_id: proposalId,
      });
      return result as Proposal | null;
    } catch (error) {
      console.error(`Error getting proposal ${daoId}:${proposalId}:`, error);
      return null;
    }
  }

  /**
   * List proposals for a DAO with pagination.
   */
  async listProposals(
    daoId: string,
    offset: number = 0,
    limit: number = 50
  ): Promise<Proposal[]> {
    try {
      const result = await this.viewMethod('list_proposals', {
        dao_id: daoId,
        from_index: offset,
        limit,
      });
      return (result as Proposal[]) || [];
    } catch (error) {
      console.error(`Error listing proposals for DAO ${daoId}:`, error);
      return [];
    }
  }

  /**
   * Get votes for a proposal.
   */
  async getVotes(daoId: string, proposalId: number): Promise<Vote[]> {
    try {
      const result = await this.viewMethod('get_votes', {
        dao_id: daoId,
        proposal_id: proposalId,
      });
      return (result as Vote[]) || [];
    } catch (error) {
      console.error(`Error getting votes for ${daoId}:${proposalId}:`, error);
      return [];
    }
  }

  /**
   * Get execution state for a proposal.
   */
  async getExecutionState(daoId: string, proposalId: number): Promise<ExecutionState> {
    try {
      const result = await this.viewMethod('get_execution_state', {
        dao_id: daoId,
        proposal_id: proposalId,
      });
      return (result as ExecutionState) || ExecutionState.Pending;
    } catch (error) {
      console.error(`Error getting execution state for ${daoId}:${proposalId}:`, error);
      return ExecutionState.Pending;
    }
  }

  /**
   * Get roles for a member in a DAO.
   */
  async getMemberRoles(daoId: string, account: string): Promise<string[]> {
    try {
      const result = await this.viewMethod('get_member_roles', {
        dao_id: daoId,
        account_id: account,
      });
      return (result as string[]) || [];
    } catch (error) {
      console.error(`Error getting roles for ${account} in ${daoId}:`, error);
      return [];
    }
  }

  /**
   * Check if an account is a member of a DAO.
   */
  async isMember(daoId: string, account: string): Promise<boolean> {
    try {
      const result = await this.viewMethod('is_member', {
        dao_id: daoId,
        account_id: account,
      });
      return result as boolean;
    } catch (error) {
      console.error(`Error checking membership for ${account} in ${daoId}:`, error);
      return false;
    }
  }

  /**
   * Get coalition status for a proposal.
   */
  async getCoalitionStatus(
    daoId: string,
    proposalId: number
  ): Promise<CoalitionProposal | null> {
    try {
      const result = await this.viewMethod('get_coalition_status', {
        dao_id: daoId,
        proposal_id: proposalId,
      });
      return result as CoalitionProposal | null;
    } catch (error) {
      console.error(`Error getting coalition status for ${daoId}:${proposalId}:`, error);
      return null;
    }
  }

  /**
   * Get DAO count.
   */
  async getDAOCount(): Promise<number> {
    try {
      const result = await this.viewMethod('get_dao_count', {});
      return (result as number) || 0;
    } catch (error) {
      console.error('Error getting DAO count:', error);
      return 0;
    }
  }

  /**
   * Get proposal count for a DAO.
   */
  async getProposalCount(daoId: string): Promise<number> {
    try {
      const result = await this.viewMethod('get_proposal_count', {
        dao_id: daoId,
      });
      return (result as number) || 0;
    } catch (error) {
      console.error(`Error getting proposal count for ${daoId}:`, error);
      return 0;
    }
  }

  // ==========================================================================
  // Helper View Methods
  // ==========================================================================

  /**
   * Get active proposals (InProgress) for an account that they can vote on.
   */
  async getActiveProposalsForAccount(
    daoId: string,
    account: string
  ): Promise<Proposal[]> {
    try {
      // Get all proposals
      const proposals = await this.listProposals(daoId, 0, 100);

      // Filter to in-progress proposals where user hasn't voted yet
      const activeProposals: Proposal[] = [];
      for (const proposal of proposals) {
        if (proposal.status === 'InProgress') {
          const votes = await this.getVotes(daoId, proposal.id);
          const hasVoted = votes.some((v) => v.voter === account);
          if (!hasVoted) {
            activeProposals.push(proposal);
          }
        }
      }

      return activeProposals;
    } catch (error) {
      console.error(`Error getting active proposals for ${account} in ${daoId}:`, error);
      return [];
    }
  }

  /**
   * Get proposals awaiting human approval.
   */
  async getProposalsAwaitingApproval(daoId: string): Promise<Proposal[]> {
    try {
      const proposals = await this.listProposals(daoId, 0, 100);
      const awaitingApproval: Proposal[] = [];

      for (const proposal of proposals) {
        const state = await this.getExecutionState(daoId, proposal.id);
        if (state === ExecutionState.AwaitingHumanApproval) {
          awaitingApproval.push(proposal);
        }
      }

      return awaitingApproval;
    } catch (error) {
      console.error(`Error getting proposals awaiting approval in ${daoId}:`, error);
      return [];
    }
  }

  /**
   * Get proposals in veto window.
   */
  async getProposalsInVetoWindow(daoId: string): Promise<Proposal[]> {
    try {
      const proposals = await this.listProposals(daoId, 0, 100);
      const inVetoWindow: Proposal[] = [];

      for (const proposal of proposals) {
        const state = await this.getExecutionState(daoId, proposal.id);
        if (state === ExecutionState.InVetoWindow) {
          inVetoWindow.push(proposal);
        }
      }

      return inVetoWindow;
    } catch (error) {
      console.error(`Error getting proposals in veto window in ${daoId}:`, error);
      return [];
    }
  }

  // ==========================================================================
  // Transaction Builders (return args for frontend to sign)
  // ==========================================================================

  /**
   * Build transaction for creating a new DAO.
   */
  buildCreateDAOTx(config: DAOConfig): TransactionArgs {
    return {
      contractId: this.contractId,
      methodName: 'create_dao',
      args: { config },
      gas: CHANGE_GAS,
      deposit: NO_DEPOSIT,
    };
  }

  /**
   * Build transaction for creating a proposal.
   */
  buildCreateProposalTx(
    daoId: string,
    kind: ProposalKind | { Custom: string },
    description: string,
    classification: Classification,
    autonomyOverride?: AutonomyLevel
  ): TransactionArgs {
    return {
      contractId: this.contractId,
      methodName: 'create_proposal',
      args: {
        dao_id: daoId,
        kind,
        description,
        classification,
        autonomy_override: autonomyOverride || null,
      },
      gas: CHANGE_GAS,
      deposit: DEFAULT_PROPOSAL_BOND,
    };
  }

  /**
   * Build transaction for casting a vote.
   */
  buildCastVoteTx(
    daoId: string,
    proposalId: number,
    voteType: VoteType
  ): TransactionArgs {
    return {
      contractId: this.contractId,
      methodName: 'cast_vote',
      args: {
        dao_id: daoId,
        proposal_id: proposalId,
        vote_type: voteType,
      },
      gas: CHANGE_GAS,
      deposit: NO_DEPOSIT,
    };
  }

  /**
   * Build transaction for submitting a veto.
   */
  buildSubmitVetoTx(daoId: string, proposalId: number): TransactionArgs {
    return {
      contractId: this.contractId,
      methodName: 'submit_veto',
      args: {
        dao_id: daoId,
        proposal_id: proposalId,
      },
      gas: CHANGE_GAS,
      deposit: NO_DEPOSIT,
    };
  }

  /**
   * Build transaction for submitting human approval.
   */
  buildSubmitHumanApprovalTx(daoId: string, proposalId: number): TransactionArgs {
    return {
      contractId: this.contractId,
      methodName: 'submit_human_approval',
      args: {
        dao_id: daoId,
        proposal_id: proposalId,
      },
      gas: CHANGE_GAS,
      deposit: NO_DEPOSIT,
    };
  }

  /**
   * Build transaction for recording coalition party approval.
   */
  buildRecordCoalitionApprovalTx(
    daoId: string,
    proposalId: number,
    party: string
  ): TransactionArgs {
    return {
      contractId: this.contractId,
      methodName: 'record_party_approval',
      args: {
        dao_id: daoId,
        proposal_id: proposalId,
        party,
      },
      gas: CHANGE_GAS,
      deposit: NO_DEPOSIT,
    };
  }

  /**
   * Build transaction for adding a member to a DAO.
   */
  buildAddMemberTx(
    daoId: string,
    account: string,
    roles: string[]
  ): TransactionArgs {
    return {
      contractId: this.contractId,
      methodName: 'add_member',
      args: {
        dao_id: daoId,
        account_id: account,
        roles,
      },
      gas: CHANGE_GAS,
      deposit: NO_DEPOSIT,
    };
  }

  /**
   * Build transaction for removing a member from a DAO.
   */
  buildRemoveMemberTx(daoId: string, account: string): TransactionArgs {
    return {
      contractId: this.contractId,
      methodName: 'remove_member',
      args: {
        dao_id: daoId,
        account_id: account,
      },
      gas: CHANGE_GAS,
      deposit: NO_DEPOSIT,
    };
  }

  /**
   * Build transaction for assigning a role to a member.
   */
  buildAssignRoleTx(
    daoId: string,
    account: string,
    role: string
  ): TransactionArgs {
    return {
      contractId: this.contractId,
      methodName: 'assign_role',
      args: {
        dao_id: daoId,
        account_id: account,
        role,
      },
      gas: CHANGE_GAS,
      deposit: NO_DEPOSIT,
    };
  }

  /**
   * Build transaction for executing a proposal.
   */
  buildExecuteProposalTx(
    daoId: string,
    proposalId: number,
    target?: string
  ): TransactionArgs {
    return {
      contractId: this.contractId,
      methodName: 'execute_proposal',
      args: {
        dao_id: daoId,
        proposal_id: proposalId,
        target: target || null,
      },
      gas: CHANGE_GAS,
      deposit: NO_DEPOSIT,
    };
  }

  /**
   * Build transaction for updating DAO config.
   */
  buildUpdateConfigTx(daoId: string, config: Partial<DAOConfig>): TransactionArgs {
    return {
      contractId: this.contractId,
      methodName: 'update_config',
      args: {
        dao_id: daoId,
        config,
      },
      gas: CHANGE_GAS,
      deposit: NO_DEPOSIT,
    };
  }

  // ==========================================================================
  // Private Helpers
  // ==========================================================================

  /**
   * Call a view method on the contract.
   */
  private async viewMethod(methodName: string, args: Record<string, unknown>): Promise<unknown> {
    const response = await this.provider.query({
      request_type: 'call_function',
      account_id: this.contractId,
      method_name: methodName,
      args_base64: Buffer.from(JSON.stringify(args)).toString('base64'),
      finality: 'final',
    });

    // Parse the result from the response
    if ('result' in response) {
      const result = response.result as number[];
      const resultStr = Buffer.from(result).toString('utf-8');
      try {
        return JSON.parse(resultStr);
      } catch {
        return resultStr;
      }
    }

    return null;
  }
}

// ==========================================================================
// Singleton Instance
// ==========================================================================

let daoServiceInstance: DAOService | null = null;

/**
 * Get or create the DAO service singleton.
 */
export function getDAOService(): DAOService {
  if (!daoServiceInstance) {
    const rpcUrl = process.env.NEAR_RPC_URL || 'https://rpc.testnet.fastnear.com';
    const contractId = process.env.DAO_CONTRACT_ID || process.env.NEAR_CONTRACT_ID || 'bastion.testnet';
    daoServiceInstance = new DAOService(rpcUrl, contractId);
  }
  return daoServiceInstance;
}
