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
 *
 * Module structure:
 * - types: Core types (AutonomyLevel, DAOConfig, Proposal, etc.)
 * - registry: Multi-DAO registry management
 * - proposals: Proposal management and state machine
 * - roles: Role management with clearance and agent tier integration
 */

pub mod proposals;
pub mod registry;
pub mod roles;
pub mod types;

// Re-export core types for convenient access
pub use proposals::ProposalManager;
pub use registry::DAORegistry;
pub use roles::{Action, AgentTier, Permission, Role, RoleKind, RoleManager};
pub use types::{
    AutonomyLevel, DAOConfig, DAOMetadata, Proposal, ProposalKind, ProposalStatus,
};
