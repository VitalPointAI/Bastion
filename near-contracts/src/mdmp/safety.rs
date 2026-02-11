/**
 * MDMP Safety Matrix Enforcement
 *
 * Validates autonomy level assignments against safety constraints.
 * Implements INVARIANT 8 (FullyDelegated scope restriction) and
 * INVARIANT 9 (Safety matrix enforcement).
 *
 * Safety rules:
 * - FullyDelegated only for 4 deterministic categories
 * - Human-only categories (risk/authority/ethics) require NotAutonomous
 * - StrikeAuthorization always requires NotAutonomous
 */

use crate::dao::types::{AutonomyLevel, ProposalKind};
use super::types::ActivityCategory;

/// Validates autonomy level assignment against safety matrix.
/// Called before any activity configuration change.
///
/// INVARIANT 8: FullyDelegated scope restriction
/// INVARIANT 9: Safety matrix enforcement
pub fn validate_autonomy_assignment(
    autonomy: &AutonomyLevel,
    category: &ActivityCategory,
    proposal_kind: &ProposalKind,
) -> Result<(), String> {
    // INVARIANT 8: FullyDelegated only for permitted categories
    if *autonomy == AutonomyLevel::FullyDelegated {
        if !category.permits_fully_delegated() {
            return Err(format!(
                "FullyDelegated autonomy not permitted for category {:?}. \
                 Only DataAggregation, ValidationConsistency, Monitoring, \
                 and MetaCognitive categories allow FullyDelegated.",
                category
            ));
        }
        if proposal_kind.prohibits_fully_delegated() {
            return Err(format!(
                "FullyDelegated autonomy not permitted for proposal kind {:?}",
                proposal_kind.to_policy_label()
            ));
        }
    }

    // INVARIANT 9: Human-only categories cannot have any AI autonomy
    if category.requires_human_in_loop() {
        if *autonomy != AutonomyLevel::NotAutonomous {
            return Err(format!(
                "Category {:?} requires NotAutonomous (human-in-loop). \
                 Cannot assign {:?}.",
                category, autonomy
            ));
        }
    }

    // Existing INVARIANT 1: StrikeAuthorization always NotAutonomous
    if proposal_kind.requires_human_in_loop() {
        if *autonomy != AutonomyLevel::NotAutonomous {
            return Err(format!(
                "ProposalKind {:?} requires NotAutonomous (human-in-loop). \
                 Cannot assign {:?}.",
                proposal_kind.to_policy_label(), autonomy
            ));
        }
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use near_sdk::AccountId;

    #[test]
    fn test_fully_delegated_scope_restriction() {
        // DataAggregation permits FullyDelegated
        let result = validate_autonomy_assignment(
            &AutonomyLevel::FullyDelegated,
            &ActivityCategory::DataAggregation,
            &ProposalKind::Custom("test".to_string()),
        );
        assert!(result.is_ok());

        // MissionAnalysis does not permit FullyDelegated
        let result = validate_autonomy_assignment(
            &AutonomyLevel::FullyDelegated,
            &ActivityCategory::MissionAnalysis,
            &ProposalKind::Custom("test".to_string()),
        );
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("not permitted for category"));
    }

    #[test]
    fn test_fully_delegated_with_authority_proposal_fails() {
        // FullyDelegated + PhaseTransition should fail
        let result = validate_autonomy_assignment(
            &AutonomyLevel::FullyDelegated,
            &ActivityCategory::DataAggregation,
            &ProposalKind::PhaseTransition {
                from_phase: "phase_1".to_string(),
                to_phase: "phase_2".to_string(),
                red_team_responses: vec![],
                accepted_assumptions: vec![],
            },
        );
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("not permitted for proposal kind"));
    }

    #[test]
    fn test_human_only_categories() {
        // RiskJudgment requires NotAutonomous
        let result = validate_autonomy_assignment(
            &AutonomyLevel::SemiAutonomous,
            &ActivityCategory::RiskJudgment,
            &ProposalKind::Custom("test".to_string()),
        );
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("requires NotAutonomous"));

        // AuthorityDecision requires NotAutonomous
        let result = validate_autonomy_assignment(
            &AutonomyLevel::Autonomous,
            &ActivityCategory::AuthorityDecision,
            &ProposalKind::Custom("test".to_string()),
        );
        assert!(result.is_err());

        // EthicalLegal requires NotAutonomous
        let result = validate_autonomy_assignment(
            &AutonomyLevel::FullyDelegated,
            &ActivityCategory::EthicalLegal,
            &ProposalKind::Custom("test".to_string()),
        );
        assert!(result.is_err());

        // All three work with NotAutonomous
        assert!(validate_autonomy_assignment(
            &AutonomyLevel::NotAutonomous,
            &ActivityCategory::RiskJudgment,
            &ProposalKind::Custom("test".to_string()),
        ).is_ok());
        assert!(validate_autonomy_assignment(
            &AutonomyLevel::NotAutonomous,
            &ActivityCategory::AuthorityDecision,
            &ProposalKind::Custom("test".to_string()),
        ).is_ok());
        assert!(validate_autonomy_assignment(
            &AutonomyLevel::NotAutonomous,
            &ActivityCategory::EthicalLegal,
            &ProposalKind::Custom("test".to_string()),
        ).is_ok());
    }

    #[test]
    fn test_strike_authorization_invariant_preserved() {
        // StrikeAuthorization always requires NotAutonomous regardless of category
        let result = validate_autonomy_assignment(
            &AutonomyLevel::SemiAutonomous,
            &ActivityCategory::DataAggregation,
            &ProposalKind::StrikeAuthorization,
        );
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("requires NotAutonomous"));

        let result = validate_autonomy_assignment(
            &AutonomyLevel::Autonomous,
            &ActivityCategory::DataAggregation,
            &ProposalKind::StrikeAuthorization,
        );
        assert!(result.is_err());

        let result = validate_autonomy_assignment(
            &AutonomyLevel::FullyDelegated,
            &ActivityCategory::DataAggregation,
            &ProposalKind::StrikeAuthorization,
        );
        assert!(result.is_err());

        // Only NotAutonomous works
        let result = validate_autonomy_assignment(
            &AutonomyLevel::NotAutonomous,
            &ActivityCategory::DataAggregation,
            &ProposalKind::StrikeAuthorization,
        );
        assert!(result.is_ok());
    }

    #[test]
    fn test_valid_hybrid_assignments() {
        // SemiAutonomous with COAGeneration should work
        let result = validate_autonomy_assignment(
            &AutonomyLevel::SemiAutonomous,
            &ActivityCategory::CoaGeneration,
            &ProposalKind::Custom("test".to_string()),
        );
        assert!(result.is_ok());

        // Autonomous with PatternRecognition should work
        let result = validate_autonomy_assignment(
            &AutonomyLevel::Autonomous,
            &ActivityCategory::PatternRecognition,
            &ProposalKind::Custom("test".to_string()),
        );
        assert!(result.is_ok());

        // NotAutonomous always works
        let result = validate_autonomy_assignment(
            &AutonomyLevel::NotAutonomous,
            &ActivityCategory::MissionAnalysis,
            &ProposalKind::Custom("test".to_string()),
        );
        assert!(result.is_ok());
    }

    #[test]
    fn test_assumption_acceptance_requires_human() {
        let alice: AccountId = "alice.near".parse().unwrap();

        // AssumptionAcceptance requires NotAutonomous
        let result = validate_autonomy_assignment(
            &AutonomyLevel::SemiAutonomous,
            &ActivityCategory::AssumptionMgmt,
            &ProposalKind::AssumptionAcceptance {
                assumptions: vec!["test".to_string()],
                risk_owner: alice.clone(),
            },
        );
        assert!(result.is_err());

        // Works with NotAutonomous
        let result = validate_autonomy_assignment(
            &AutonomyLevel::NotAutonomous,
            &ActivityCategory::AssumptionMgmt,
            &ProposalKind::AssumptionAcceptance {
                assumptions: vec!["test".to_string()],
                risk_owner: alice,
            },
        );
        assert!(result.is_ok());
    }

    #[test]
    fn test_commander_guidance_requires_human() {
        // CommanderGuidance requires NotAutonomous
        let result = validate_autonomy_assignment(
            &AutonomyLevel::Autonomous,
            &ActivityCategory::AuthorityDecision,
            &ProposalKind::CommanderGuidance {
                guidance_text: "test".to_string(),
                modifies_assumptions: vec![],
            },
        );
        assert!(result.is_err());

        // Works with NotAutonomous
        let result = validate_autonomy_assignment(
            &AutonomyLevel::NotAutonomous,
            &ActivityCategory::AuthorityDecision,
            &ProposalKind::CommanderGuidance {
                guidance_text: "test".to_string(),
                modifies_assumptions: vec![],
            },
        );
        assert!(result.is_ok());
    }
}
