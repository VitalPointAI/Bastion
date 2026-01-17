/**
 * DAO Governance Module
 *
 * Mission-focused DAO governance for BASTION with:
 * - Configurable autonomy levels (autonomous, semi-autonomous, not autonomous)
 * - Strike authorization forced to human-in-loop
 * - Multi-DAO registry for hierarchical governance
 * - Proposal lifecycle with state machine
 *
 * Module structure:
 * - types: Core types (AutonomyLevel, DAOConfig, Proposal, etc.)
 * - registry: Multi-DAO registry management
 * - proposals: Proposal management and state machine
 */

pub mod proposals;
pub mod registry;
pub mod types;

// Re-export core types for convenient access
pub use proposals::ProposalManager;
pub use registry::DAORegistry;
pub use types::{
    AutonomyLevel, DAOConfig, DAOMetadata, Proposal, ProposalKind, ProposalStatus,
};
