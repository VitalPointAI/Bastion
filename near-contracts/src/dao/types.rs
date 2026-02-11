/**
 * DAO Core Types
 *
 * Defines foundational types for BASTION's mission-focused DAO governance:
 * - AutonomyLevel: Configurable human control for different decision types
 * - DAOConfig/DAOMetadata: DAO configuration and runtime state
 * - ProposalKind/ProposalStatus/Proposal: Proposal lifecycle management
 *
 * Key design decisions:
 * - Three autonomy levels match military decision-making patterns
 * - StrikeAuthorization proposals ALWAYS default to NotAutonomous (human-in-loop)
 * - Proposals support classification integration from privacy.rs
 */

use near_sdk::{near, AccountId};

use crate::privacy::Classification;

/// Autonomy level for proposal execution
///
/// Determines the degree of human oversight required for decisions.
/// Matches military command authority patterns.
/// Ordered: NotAutonomous < SemiAutonomous < Autonomous < FullyDelegated
#[near(serializers = [json, borsh])]
#[derive(Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Debug, Default)]
pub enum AutonomyLevel {
    /// Human-in-the-loop: Human must explicitly approve before execution
    /// DEFAULT for all lethal decisions (StrikeAuthorization)
    #[default]
    NotAutonomous,

    /// Human-on-the-loop: AI can approve, human monitors with veto window
    /// Use for moderate-consequence decisions requiring oversight but not blocking approval
    SemiAutonomous,

    /// Human-out-of-the-loop: AI/system can approve and execute within delegated authority
    /// Use for routine, low-consequence decisions where speed is critical
    Autonomous,

    /// Fully delegated to AI with no human oversight required
    /// RESTRICTED to: DataAggregation, ValidationConsistency, Monitoring, MetaCognitive activities
    /// Prohibited for: RiskJudgment, AuthorityDecision, EthicalLegal activities
    FullyDelegated,
}

/// DAO configuration - immutable settings defined at creation
#[near(serializers = [json, borsh])]
#[derive(Clone, Debug)]
pub struct DAOConfig {
    /// Human-readable name for the DAO
    pub name: String,

    /// Description of the DAO's purpose
    pub description: String,

    /// Classification level for the DAO (affects proposal visibility)
    pub classification: Classification,

    /// Default autonomy level for proposals (can be overridden per proposal)
    /// Note: StrikeAuthorization always uses NotAutonomous regardless
    pub default_autonomy_level: AutonomyLevel,

    /// Bond required to submit a proposal (in yoctoNEAR)
    pub proposal_bond: u128,

    /// Voting period duration in nanoseconds
    pub voting_period_ns: u64,

    /// Optional parent DAO ID for hierarchical governance
    pub parent_dao_id: Option<String>,
}

/// DAO metadata - runtime state including computed fields
#[near(serializers = [json, borsh])]
#[derive(Clone, Debug)]
pub struct DAOMetadata {
    /// Unique identifier for this DAO
    pub dao_id: String,

    /// DAO configuration
    pub config: DAOConfig,

    /// Creation timestamp (nanoseconds since epoch)
    pub created_at: u64,

    /// Account that created this DAO
    pub created_by: AccountId,

    /// Number of members in this DAO
    pub member_count: u32,

    /// Number of proposals currently in InProgress status
    pub active_proposal_count: u32,
}

/// Types of proposals that can be submitted
///
/// Extends SputnikDAO v2 patterns with military-specific types:
/// - StrikeAuthorization: Lethal decisions (always human-in-loop)
/// - MissionOrder: Operational directives
/// - MDMP-specific: Phase transitions, assumptions, products, gates, guidance
#[near(serializers = [json, borsh])]
#[derive(Clone, Debug, PartialEq)]
pub enum ProposalKind {
    /// Change DAO configuration
    ConfigChange,

    /// Add a member to the DAO
    AddMember,

    /// Remove a member from the DAO
    RemoveMember,

    /// Transfer funds from DAO treasury
    Transfer,

    /// Execute a function call on another contract
    FunctionCall,

    /// Authorize a strike/lethal action
    /// CRITICAL: Always uses NotAutonomous (human-in-loop) regardless of DAO config
    StrikeAuthorization,

    /// Issue a mission order
    MissionOrder,

    /// Custom proposal type with identifier
    Custom(String),

    /// MDMP: Transition between planning phases
    /// Requires human-in-loop and red team challenge responses
    PhaseTransition {
        from_phase: String,
        to_phase: String,
        red_team_responses: Vec<String>,
        accepted_assumptions: Vec<String>,
    },

    /// MDMP: Accept planning assumptions with designated risk owner
    /// Requires human-in-loop for authority decision
    AssumptionAcceptance {
        assumptions: Vec<String>,
        risk_owner: AccountId,
    },

    /// MDMP: Approve AI-generated planning product
    /// Uses standard voting (not forced human-in-loop)
    ProductApproval {
        product_type: String,
        mdmp_phase: String,
        ai_confidence: f64,
        product_hash: String,
    },

    /// MDMP: Red team gate passage for phase progression
    /// Uses standard voting (not forced human-in-loop)
    RedTeamGate {
        phase: String,
        challenges_addressed: Vec<String>,
        unresolved_risks: Vec<String>,
    },

    /// MDMP: Commander's planning guidance
    /// Requires human-in-loop for authority decision
    CommanderGuidance {
        guidance_text: String,
        modifies_assumptions: Vec<String>,
    },
}

impl ProposalKind {
    /// Check if this proposal kind requires forced human-in-loop
    pub fn requires_human_in_loop(&self) -> bool {
        matches!(
            self,
            ProposalKind::StrikeAuthorization
                | ProposalKind::PhaseTransition { .. }
                | ProposalKind::AssumptionAcceptance { .. }
                | ProposalKind::CommanderGuidance { .. }
        )
    }

    /// Check if this proposal kind prohibits FullyDelegated autonomy
    /// Returns true for all kinds involving authority exercise
    pub fn prohibits_fully_delegated(&self) -> bool {
        matches!(
            self,
            ProposalKind::StrikeAuthorization
                | ProposalKind::ConfigChange
                | ProposalKind::MissionOrder
                | ProposalKind::PhaseTransition { .. }
                | ProposalKind::AssumptionAcceptance { .. }
                | ProposalKind::ProductApproval { .. }
                | ProposalKind::RedTeamGate { .. }
                | ProposalKind::CommanderGuidance { .. }
        )
    }

    /// Get policy label for permission matching (SputnikDAO pattern)
    pub fn to_policy_label(&self) -> String {
        match self {
            ProposalKind::ConfigChange => "config_change".to_string(),
            ProposalKind::AddMember => "add_member".to_string(),
            ProposalKind::RemoveMember => "remove_member".to_string(),
            ProposalKind::Transfer => "transfer".to_string(),
            ProposalKind::FunctionCall => "function_call".to_string(),
            ProposalKind::StrikeAuthorization => "strike_authorization".to_string(),
            ProposalKind::MissionOrder => "mission_order".to_string(),
            ProposalKind::Custom(name) => format!("custom:{}", name),
            ProposalKind::PhaseTransition { .. } => "phase_transition".to_string(),
            ProposalKind::AssumptionAcceptance { .. } => "assumption_acceptance".to_string(),
            ProposalKind::ProductApproval { .. } => "product_approval".to_string(),
            ProposalKind::RedTeamGate { .. } => "red_team_gate".to_string(),
            ProposalKind::CommanderGuidance { .. } => "commander_guidance".to_string(),
        }
    }
}

/// Proposal status following SputnikDAO v2 state machine
///
/// State transitions:
/// - InProgress can transition to: Approved, Rejected, Removed, Expired, Failed
/// - All other states are terminal (no further transitions)
#[near(serializers = [json, borsh])]
#[derive(Clone, Copy, PartialEq, Eq, Debug, Default)]
pub enum ProposalStatus {
    /// Actively being voted on
    #[default]
    InProgress,

    /// Voting passed, proposal approved for execution
    Approved,

    /// Voting failed, proposal rejected
    Rejected,

    /// Removed (spam/invalid), bond may be forfeited
    Removed,

    /// Voting period elapsed without resolution
    Expired,

    /// Execution failed after approval
    Failed,
}

impl ProposalStatus {
    /// Check if this status is terminal (no further transitions allowed)
    pub fn is_terminal(&self) -> bool {
        !matches!(self, ProposalStatus::InProgress)
    }
}

/// Proposal record with full lifecycle tracking
#[near(serializers = [json, borsh])]
#[derive(Clone, Debug)]
pub struct Proposal {
    /// Unique proposal ID within the DAO
    pub id: u64,

    /// Type of proposal
    pub kind: ProposalKind,

    /// Account that created the proposal
    pub proposer: AccountId,

    /// Human-readable description of the proposal
    pub description: String,

    /// Classification level for this proposal
    pub classification: Classification,

    /// Override for autonomy level (None = use DAO default)
    /// IGNORED for StrikeAuthorization (always NotAutonomous)
    pub autonomy_override: Option<AutonomyLevel>,

    /// Current status
    pub status: ProposalStatus,

    /// Number of approval votes
    pub votes_approve: u32,

    /// Number of rejection votes
    pub votes_reject: u32,

    /// Creation timestamp (nanoseconds)
    pub created_at: u64,

    /// Deadline for voting (nanoseconds since epoch)
    pub voting_deadline: u64,

    /// Result of execution attempt (if any)
    pub execution_result: Option<String>,
}

impl Proposal {
    /// Get effective autonomy level considering kind and override
    ///
    /// StrikeAuthorization ALWAYS returns NotAutonomous regardless of config or override.
    pub fn get_effective_autonomy(&self, dao_default: AutonomyLevel) -> AutonomyLevel {
        // Critical: Strike authorization is always human-in-loop
        if self.kind.requires_human_in_loop() {
            return AutonomyLevel::NotAutonomous;
        }

        // Use override if present, otherwise DAO default
        self.autonomy_override.unwrap_or(dao_default)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_autonomy_level_default() {
        let level: AutonomyLevel = Default::default();
        assert_eq!(level, AutonomyLevel::NotAutonomous);
    }

    #[test]
    fn test_proposal_status_terminal() {
        assert!(!ProposalStatus::InProgress.is_terminal());
        assert!(ProposalStatus::Approved.is_terminal());
        assert!(ProposalStatus::Rejected.is_terminal());
        assert!(ProposalStatus::Removed.is_terminal());
        assert!(ProposalStatus::Expired.is_terminal());
        assert!(ProposalStatus::Failed.is_terminal());
    }

    #[test]
    fn test_autonomy_level_ordering() {
        assert!(AutonomyLevel::NotAutonomous < AutonomyLevel::SemiAutonomous);
        assert!(AutonomyLevel::SemiAutonomous < AutonomyLevel::Autonomous);
        assert!(AutonomyLevel::Autonomous < AutonomyLevel::FullyDelegated);
    }

    #[test]
    fn test_proposal_kind_human_in_loop() {
        assert!(ProposalKind::StrikeAuthorization.requires_human_in_loop());
        assert!(!ProposalKind::Transfer.requires_human_in_loop());
        assert!(!ProposalKind::MissionOrder.requires_human_in_loop());
        assert!(!ProposalKind::ConfigChange.requires_human_in_loop());

        // MDMP kinds
        assert!(ProposalKind::PhaseTransition {
            from_phase: "phase_1".to_string(),
            to_phase: "phase_2".to_string(),
            red_team_responses: vec![],
            accepted_assumptions: vec![],
        }
        .requires_human_in_loop());

        assert!(ProposalKind::AssumptionAcceptance {
            assumptions: vec![],
            risk_owner: "commander.near".parse().unwrap(),
        }
        .requires_human_in_loop());

        assert!(ProposalKind::CommanderGuidance {
            guidance_text: "test".to_string(),
            modifies_assumptions: vec![],
        }
        .requires_human_in_loop());

        assert!(!ProposalKind::ProductApproval {
            product_type: "coa".to_string(),
            mdmp_phase: "phase_3".to_string(),
            ai_confidence: 0.95,
            product_hash: "hash".to_string(),
        }
        .requires_human_in_loop());

        assert!(!ProposalKind::RedTeamGate {
            phase: "phase_2".to_string(),
            challenges_addressed: vec![],
            unresolved_risks: vec![],
        }
        .requires_human_in_loop());
    }

    #[test]
    fn test_proposal_kind_prohibits_fully_delegated() {
        assert!(ProposalKind::StrikeAuthorization.prohibits_fully_delegated());
        assert!(ProposalKind::ConfigChange.prohibits_fully_delegated());
        assert!(ProposalKind::MissionOrder.prohibits_fully_delegated());

        // MDMP kinds all prohibit FullyDelegated
        assert!(ProposalKind::PhaseTransition {
            from_phase: "phase_1".to_string(),
            to_phase: "phase_2".to_string(),
            red_team_responses: vec![],
            accepted_assumptions: vec![],
        }
        .prohibits_fully_delegated());

        assert!(ProposalKind::ProductApproval {
            product_type: "coa".to_string(),
            mdmp_phase: "phase_3".to_string(),
            ai_confidence: 0.95,
            product_hash: "hash".to_string(),
        }
        .prohibits_fully_delegated());

        // Non-authority kinds don't prohibit
        assert!(!ProposalKind::Transfer.prohibits_fully_delegated());
        assert!(!ProposalKind::AddMember.prohibits_fully_delegated());
    }

    #[test]
    fn test_proposal_kind_policy_labels() {
        assert_eq!(ProposalKind::ConfigChange.to_policy_label(), "config_change");
        assert_eq!(ProposalKind::StrikeAuthorization.to_policy_label(), "strike_authorization");
        assert_eq!(
            ProposalKind::Custom("test".to_string()).to_policy_label(),
            "custom:test"
        );

        // MDMP policy labels
        assert_eq!(
            ProposalKind::PhaseTransition {
                from_phase: "phase_1".to_string(),
                to_phase: "phase_2".to_string(),
                red_team_responses: vec![],
                accepted_assumptions: vec![],
            }
            .to_policy_label(),
            "phase_transition"
        );

        assert_eq!(
            ProposalKind::AssumptionAcceptance {
                assumptions: vec![],
                risk_owner: "commander.near".parse().unwrap(),
            }
            .to_policy_label(),
            "assumption_acceptance"
        );

        assert_eq!(
            ProposalKind::ProductApproval {
                product_type: "coa".to_string(),
                mdmp_phase: "phase_3".to_string(),
                ai_confidence: 0.95,
                product_hash: "hash".to_string(),
            }
            .to_policy_label(),
            "product_approval"
        );

        assert_eq!(
            ProposalKind::RedTeamGate {
                phase: "phase_2".to_string(),
                challenges_addressed: vec![],
                unresolved_risks: vec![],
            }
            .to_policy_label(),
            "red_team_gate"
        );

        assert_eq!(
            ProposalKind::CommanderGuidance {
                guidance_text: "test".to_string(),
                modifies_assumptions: vec![],
            }
            .to_policy_label(),
            "commander_guidance"
        );
    }

    #[test]
    fn test_strike_authorization_always_not_autonomous() {
        let proposal = Proposal {
            id: 1,
            kind: ProposalKind::StrikeAuthorization,
            proposer: "alice.near".parse().unwrap(),
            description: "Authorize strike".to_string(),
            classification: Classification::Secret,
            autonomy_override: Some(AutonomyLevel::Autonomous), // Try to override
            status: ProposalStatus::InProgress,
            votes_approve: 0,
            votes_reject: 0,
            created_at: 0,
            voting_deadline: 0,
            execution_result: None,
        };

        // Even with Autonomous override, StrikeAuthorization is NotAutonomous
        assert_eq!(
            proposal.get_effective_autonomy(AutonomyLevel::Autonomous),
            AutonomyLevel::NotAutonomous
        );
    }

    #[test]
    fn test_normal_proposal_uses_override() {
        let proposal = Proposal {
            id: 1,
            kind: ProposalKind::Transfer,
            proposer: "alice.near".parse().unwrap(),
            description: "Transfer funds".to_string(),
            classification: Classification::Public,
            autonomy_override: Some(AutonomyLevel::Autonomous),
            status: ProposalStatus::InProgress,
            votes_approve: 0,
            votes_reject: 0,
            created_at: 0,
            voting_deadline: 0,
            execution_result: None,
        };

        // Transfer with override uses the override
        assert_eq!(
            proposal.get_effective_autonomy(AutonomyLevel::NotAutonomous),
            AutonomyLevel::Autonomous
        );
    }

    #[test]
    fn test_normal_proposal_uses_default() {
        let proposal = Proposal {
            id: 1,
            kind: ProposalKind::MissionOrder,
            proposer: "alice.near".parse().unwrap(),
            description: "Issue order".to_string(),
            classification: Classification::Secret,
            autonomy_override: None,
            status: ProposalStatus::InProgress,
            votes_approve: 0,
            votes_reject: 0,
            created_at: 0,
            voting_deadline: 0,
            execution_result: None,
        };

        // No override = use DAO default
        assert_eq!(
            proposal.get_effective_autonomy(AutonomyLevel::SemiAutonomous),
            AutonomyLevel::SemiAutonomous
        );
    }
}
