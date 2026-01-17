/**
 * Proposal Manager
 *
 * Manages proposal lifecycle for DAO governance.
 * Stub implementation - will be expanded in Task 2.
 */

use near_sdk::store::LookupMap;
use near_sdk::{near, BorshStorageKey};

use super::types::Proposal;

/// Storage keys for proposal collections
#[derive(BorshStorageKey)]
#[near]
pub enum ProposalStorageKey {
    /// Primary storage: (dao_id, proposal_id) -> Proposal
    Proposals,
    /// Proposal counts per DAO
    ProposalCounts,
    /// Proposal IDs list per DAO
    DAOProposals,
}

/// Proposal Manager for DAO governance
#[near(serializers = [borsh])]
pub struct ProposalManager {
    /// Primary storage: (dao_id, proposal_id) encoded as string -> Proposal
    proposals: LookupMap<String, Proposal>,

    /// Proposal counts per DAO: dao_id -> next_proposal_id
    proposal_counts: LookupMap<String, u64>,

    /// Proposal IDs per DAO: dao_id -> Vec<proposal_ids>
    dao_proposals: LookupMap<String, Vec<u64>>,
}

impl ProposalManager {
    /// Initialize new proposal manager
    pub fn new() -> Self {
        Self {
            proposals: LookupMap::new(ProposalStorageKey::Proposals),
            proposal_counts: LookupMap::new(ProposalStorageKey::ProposalCounts),
            dao_proposals: LookupMap::new(ProposalStorageKey::DAOProposals),
        }
    }
}
