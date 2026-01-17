/**
 * DAO Governance Module
 *
 * Mission-focused DAO governance for BASTION with:
 * - Configurable autonomy levels (autonomous, semi-autonomous, not autonomous)
 * - Strike authorization forced to human-in-loop
 * - Multi-DAO registry for hierarchical governance
 * - Proposal lifecycle with state machine
 * - Role-based access control with clearance integration
 * - AI agent trust tiers for bounded participation
 * - Permission checking with wildcard patterns
 * - Hierarchical DAO relationships with inherited membership
 * - Cross-DAO approval requirements
 * - Coalition voting for multi-party approvals
 *
 * Module structure:
 * - types: Core types (AutonomyLevel, DAOConfig, Proposal, etc.)
 * - registry: Multi-DAO registry management
 * - proposals: Proposal management and state machine
 * - roles: Role management with clearance and agent tier integration
 * - permissions: Permission evaluation with wildcards and clearance verification
 * - linkages: Hierarchical DAOs, cross-DAO approvals, coalition voting
 */

pub mod execution;
pub mod linkages;
pub mod permissions;
pub mod proposals;
pub mod registry;
pub mod roles;
pub mod types;
pub mod voting;

// Re-export core types for convenient access
pub use permissions::PermissionChecker;
pub use proposals::ProposalManager;
pub use registry::DAORegistry;
pub use roles::{Action, AgentTier, Permission, Role, RoleKind, RoleManager};
pub use types::{
    AutonomyLevel, DAOConfig, DAOMetadata, Proposal, ProposalKind, ProposalStatus,
};
pub use voting::{
    ThresholdKind, Vote, VotePolicy, VoteType, VotingEngine, VotingResult, WeightKind,
};
pub use execution::{ExecutionConfig, ExecutionState, ProposalExecutor};
pub use linkages::{
    CoalitionApproval, CoalitionProposal, CrossDAORequirement, DAOLinkageManager,
    DAORelationship, RequirementType,
};
