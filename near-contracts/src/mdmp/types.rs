/**
 * MDMP (Military Decision-Making Process) Types
 *
 * Defines types for AI-enabled military planning governance:
 * - MDMPPhase: 9-phase planning cycle with phase progression logic
 * - ActivityCategory: 22 categories with safety classification methods
 *
 * Safety model:
 * - 4 categories permit FullyDelegated autonomy (data/monitoring)
 * - 3 categories require human-in-loop (risk/authority/ethics)
 * - 15 categories support hybrid automation (AI-assisted, human-supervised)
 */

use near_sdk::near;

/// MDMP planning phases following JP 5-0 doctrine
///
/// Phase progression: Phase0 (continuous) and Phase1-7 linear, Phase8 terminal
/// All backward transitions allowed per doctrine (can_revisit)
#[near(serializers = [json, borsh])]
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub enum MDMPPhase {
    /// Phase 0: Continuous operations (IPB, running estimates)
    Phase0Continuous,
    /// Phase 1: Receipt of Mission
    Phase1Receipt,
    /// Phase 2: Mission Analysis
    Phase2Analysis,
    /// Phase 3: COA Development
    Phase3CoaDev,
    /// Phase 4: COA Analysis (Wargaming)
    Phase4CoaAnalysis,
    /// Phase 5: COA Comparison
    Phase5CoaCompare,
    /// Phase 6: COA Approval
    Phase6CoaApproval,
    /// Phase 7: Orders Production
    Phase7Orders,
    /// Phase 8: Assessment (post-execution)
    Phase8Assessment,
}

impl MDMPPhase {
    /// Get next phase in sequence
    /// Phase0 and Phase8 return None (Phase0 is continuous, Phase8 is terminal)
    pub fn next(&self) -> Option<MDMPPhase> {
        match self {
            MDMPPhase::Phase0Continuous => None, // Continuous phase has no "next"
            MDMPPhase::Phase1Receipt => Some(MDMPPhase::Phase2Analysis),
            MDMPPhase::Phase2Analysis => Some(MDMPPhase::Phase3CoaDev),
            MDMPPhase::Phase3CoaDev => Some(MDMPPhase::Phase4CoaAnalysis),
            MDMPPhase::Phase4CoaAnalysis => Some(MDMPPhase::Phase5CoaCompare),
            MDMPPhase::Phase5CoaCompare => Some(MDMPPhase::Phase6CoaApproval),
            MDMPPhase::Phase6CoaApproval => Some(MDMPPhase::Phase7Orders),
            MDMPPhase::Phase7Orders => Some(MDMPPhase::Phase8Assessment),
            MDMPPhase::Phase8Assessment => None, // Terminal phase
        }
    }

    /// Check if phase allows revisiting (always true per JP 5-0)
    /// Doctrine permits backward transitions for iterative refinement
    pub fn can_revisit(&self) -> bool {
        true
    }

    /// Get string label for this phase
    pub fn to_string_label(&self) -> String {
        match self {
            MDMPPhase::Phase0Continuous => "phase_0_continuous".to_string(),
            MDMPPhase::Phase1Receipt => "phase_1_receipt_of_mission".to_string(),
            MDMPPhase::Phase2Analysis => "phase_2_mission_analysis".to_string(),
            MDMPPhase::Phase3CoaDev => "phase_3_coa_development".to_string(),
            MDMPPhase::Phase4CoaAnalysis => "phase_4_coa_analysis".to_string(),
            MDMPPhase::Phase5CoaCompare => "phase_5_coa_comparison".to_string(),
            MDMPPhase::Phase6CoaApproval => "phase_6_coa_approval".to_string(),
            MDMPPhase::Phase7Orders => "phase_7_orders_production".to_string(),
            MDMPPhase::Phase8Assessment => "phase_8_assessment".to_string(),
        }
    }
}

/// Activity categories for MDMP governance with safety classification
///
/// Defines 22 activity types with varying autonomy levels:
/// - FullyDelegated (4): DataAggregation, ValidationConsistency, Monitoring, MetaCognitive
/// - Human-in-loop required (3): RiskJudgment, AuthorityDecision, EthicalLegal
/// - Hybrid (15): All others (AI-assisted, human-supervised)
#[near(serializers = [json, borsh])]
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub enum ActivityCategory {
    // Fully-delegated categories (no human oversight required)
    /// Data collection and aggregation
    DataAggregation,
    /// Validation and consistency checking
    ValidationConsistency,
    /// System and process monitoring
    Monitoring,
    /// Meta-cognitive AI self-assessment
    MetaCognitive,

    // Hybrid categories (AI-assisted, human-supervised)
    /// Pattern recognition in intelligence
    PatternRecognition,
    /// Mission analysis and problem framing
    MissionAnalysis,
    /// Problem framing and constraint identification
    ProblemFraming,
    /// Course of action generation
    CoaGeneration,
    /// Course of action evaluation
    CoaEvaluation,
    /// Wargaming and simulation
    Wargaming,
    /// Decision support and recommendation
    DecisionSupport,
    /// Red teaming and challenge
    RedTeaming,
    /// Orders production and formatting
    OrdersProduction,
    /// Post-execution assessment
    Assessment,
    /// Sustainment and logistics planning
    Sustainment,
    /// Force protection planning
    ForceProtection,
    /// Assumption identification and management
    AssumptionMgmt,
    /// Coalition coordination
    CoalitionMgmt,
    /// Commander's intent assessment
    IntentAssessment,

    // Human-in-loop required categories
    /// Risk judgment and acceptance
    RiskJudgment,
    /// Authority exercise and command decisions
    AuthorityDecision,
    /// Ethical and legal review
    EthicalLegal,
}

impl ActivityCategory {
    /// Check if this activity permits FullyDelegated autonomy
    /// Only 4 categories: DataAggregation, ValidationConsistency, Monitoring, MetaCognitive
    pub fn permits_fully_delegated(&self) -> bool {
        matches!(
            self,
            ActivityCategory::DataAggregation
                | ActivityCategory::ValidationConsistency
                | ActivityCategory::Monitoring
                | ActivityCategory::MetaCognitive
        )
    }

    /// Check if this activity requires human-in-loop
    /// Required for: RiskJudgment, AuthorityDecision, EthicalLegal
    pub fn requires_human_in_loop(&self) -> bool {
        matches!(
            self,
            ActivityCategory::RiskJudgment
                | ActivityCategory::AuthorityDecision
                | ActivityCategory::EthicalLegal
        )
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_mdmp_phase_next() {
        assert_eq!(MDMPPhase::Phase0Continuous.next(), None);
        assert_eq!(
            MDMPPhase::Phase1Receipt.next(),
            Some(MDMPPhase::Phase2Analysis)
        );
        assert_eq!(
            MDMPPhase::Phase2Analysis.next(),
            Some(MDMPPhase::Phase3CoaDev)
        );
        assert_eq!(
            MDMPPhase::Phase3CoaDev.next(),
            Some(MDMPPhase::Phase4CoaAnalysis)
        );
        assert_eq!(
            MDMPPhase::Phase4CoaAnalysis.next(),
            Some(MDMPPhase::Phase5CoaCompare)
        );
        assert_eq!(
            MDMPPhase::Phase5CoaCompare.next(),
            Some(MDMPPhase::Phase6CoaApproval)
        );
        assert_eq!(
            MDMPPhase::Phase6CoaApproval.next(),
            Some(MDMPPhase::Phase7Orders)
        );
        assert_eq!(
            MDMPPhase::Phase7Orders.next(),
            Some(MDMPPhase::Phase8Assessment)
        );
        assert_eq!(MDMPPhase::Phase8Assessment.next(), None);
    }

    #[test]
    fn test_mdmp_phase_can_revisit() {
        // All phases allow revisiting per JP 5-0
        assert!(MDMPPhase::Phase0Continuous.can_revisit());
        assert!(MDMPPhase::Phase1Receipt.can_revisit());
        assert!(MDMPPhase::Phase2Analysis.can_revisit());
        assert!(MDMPPhase::Phase3CoaDev.can_revisit());
        assert!(MDMPPhase::Phase4CoaAnalysis.can_revisit());
        assert!(MDMPPhase::Phase5CoaCompare.can_revisit());
        assert!(MDMPPhase::Phase6CoaApproval.can_revisit());
        assert!(MDMPPhase::Phase7Orders.can_revisit());
        assert!(MDMPPhase::Phase8Assessment.can_revisit());
    }

    #[test]
    fn test_mdmp_phase_to_string_label() {
        assert_eq!(
            MDMPPhase::Phase0Continuous.to_string_label(),
            "phase_0_continuous"
        );
        assert_eq!(
            MDMPPhase::Phase1Receipt.to_string_label(),
            "phase_1_receipt_of_mission"
        );
        assert_eq!(
            MDMPPhase::Phase2Analysis.to_string_label(),
            "phase_2_mission_analysis"
        );
        assert_eq!(
            MDMPPhase::Phase3CoaDev.to_string_label(),
            "phase_3_coa_development"
        );
        assert_eq!(
            MDMPPhase::Phase4CoaAnalysis.to_string_label(),
            "phase_4_coa_analysis"
        );
        assert_eq!(
            MDMPPhase::Phase5CoaCompare.to_string_label(),
            "phase_5_coa_comparison"
        );
        assert_eq!(
            MDMPPhase::Phase6CoaApproval.to_string_label(),
            "phase_6_coa_approval"
        );
        assert_eq!(
            MDMPPhase::Phase7Orders.to_string_label(),
            "phase_7_orders_production"
        );
        assert_eq!(
            MDMPPhase::Phase8Assessment.to_string_label(),
            "phase_8_assessment"
        );
    }

    #[test]
    fn test_activity_category_permits_fully_delegated() {
        // 4 categories permit FullyDelegated
        assert!(ActivityCategory::DataAggregation.permits_fully_delegated());
        assert!(ActivityCategory::ValidationConsistency.permits_fully_delegated());
        assert!(ActivityCategory::Monitoring.permits_fully_delegated());
        assert!(ActivityCategory::MetaCognitive.permits_fully_delegated());

        // Others do not
        assert!(!ActivityCategory::PatternRecognition.permits_fully_delegated());
        assert!(!ActivityCategory::RiskJudgment.permits_fully_delegated());
        assert!(!ActivityCategory::AuthorityDecision.permits_fully_delegated());
    }

    #[test]
    fn test_activity_category_requires_human_in_loop() {
        // 3 categories require human-in-loop
        assert!(ActivityCategory::RiskJudgment.requires_human_in_loop());
        assert!(ActivityCategory::AuthorityDecision.requires_human_in_loop());
        assert!(ActivityCategory::EthicalLegal.requires_human_in_loop());

        // Others do not
        assert!(!ActivityCategory::DataAggregation.requires_human_in_loop());
        assert!(!ActivityCategory::PatternRecognition.requires_human_in_loop());
        assert!(!ActivityCategory::CoaGeneration.requires_human_in_loop());
    }

    #[test]
    fn test_activity_category_safety_classification() {
        // Ensure no category is both fully-delegated AND human-in-loop
        let all_categories = [
            ActivityCategory::DataAggregation,
            ActivityCategory::ValidationConsistency,
            ActivityCategory::Monitoring,
            ActivityCategory::MetaCognitive,
            ActivityCategory::PatternRecognition,
            ActivityCategory::MissionAnalysis,
            ActivityCategory::ProblemFraming,
            ActivityCategory::CoaGeneration,
            ActivityCategory::CoaEvaluation,
            ActivityCategory::Wargaming,
            ActivityCategory::DecisionSupport,
            ActivityCategory::RedTeaming,
            ActivityCategory::OrdersProduction,
            ActivityCategory::Assessment,
            ActivityCategory::Sustainment,
            ActivityCategory::ForceProtection,
            ActivityCategory::AssumptionMgmt,
            ActivityCategory::CoalitionMgmt,
            ActivityCategory::IntentAssessment,
            ActivityCategory::RiskJudgment,
            ActivityCategory::AuthorityDecision,
            ActivityCategory::EthicalLegal,
        ];

        for category in &all_categories {
            let fully_delegated = category.permits_fully_delegated();
            let human_required = category.requires_human_in_loop();

            // No category should be both
            assert!(
                !(fully_delegated && human_required),
                "Category {:?} cannot be both FullyDelegated and Human-in-loop",
                category
            );
        }
    }
}
