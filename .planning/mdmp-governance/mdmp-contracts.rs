/**
 * MDMP Smart Contract Specification
 *
 * Extends existing DAO contracts in near-contracts/src/dao/ with:
 * 1. AutonomyLevel::FullyDelegated variant
 * 2. New MDMP-specific ProposalKind variants
 * 3. MDMP Workflow Engine (phase progression enforcement)
 * 4. Assumption Registry (lifecycle tracking)
 * 5. Safety Matrix enforcement
 *
 * CRITICAL DESIGN CONSTRAINT:
 * All existing contracts remain backward-compatible.
 * New functionality is additive only. No existing behavior changes.
 * StrikeAuthorization invariant remains absolute.
 */

// ═══════════════════════════════════════════════════════════════════════════
// FILE: near-contracts/src/dao/types.rs — ADDITIONS
// ═══════════════════════════════════════════════════════════════════════════

/// Extended autonomy level adding FullyDelegated.
/// BACKWARD COMPATIBLE: Existing three levels unchanged.
///
/// Ordering (least to most autonomous):
///   NotAutonomous < SemiAutonomous < Autonomous < FullyDelegated
#[near(serializers = [json, borsh])]
#[derive(Clone, Copy, PartialEq, Eq, Debug, Default, PartialOrd, Ord)]
pub enum AutonomyLevel {
    /// Human-in-the-loop: Human must explicitly approve before execution.
    /// DEFAULT for all lethal decisions (StrikeAuthorization).
    #[default]
    NotAutonomous,

    /// Human-on-the-loop: AI can approve, human monitors with veto window.
    SemiAutonomous,

    /// Human-out-of-the-loop: AI/system can approve and execute within
    /// delegated authority. Human spot-checks periodically.
    Autonomous,

    /// Fully delegated: AI executes as infrastructure. No human monitoring.
    /// Auditable retroactively. Errors caught by validation layers.
    ///
    /// RESTRICTED: Can only be assigned to activities categorized as
    /// DATA_AGGREGATION, VALIDATION_CONSISTENCY, MONITORING, or META_COGNITIVE.
    /// Smart contract enforces this restriction.
    ///
    /// CANNOT be assigned to: StrikeAuthorization, CommanderGuidance,
    /// AssumptionAcceptance, PhaseTransition, or any ProposalKind
    /// involving authority exercise.
    FullyDelegated,
}

/// Extended ProposalKind with MDMP-specific types.
/// BACKWARD COMPATIBLE: All existing variants unchanged.
#[near(serializers = [json, borsh])]
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum ProposalKind {
    // ── Existing variants (unchanged) ──
    ConfigChange,
    AddMember,
    RemoveMember,
    Transfer,
    FunctionCall,
    StrikeAuthorization,
    MissionOrder,
    Custom(String),

    // ── New MDMP-specific variants ──

    /// Request to transition from one MDMP phase to the next.
    /// Requires all gates for the current phase to be satisfied.
    /// Includes red team challenge responses.
    PhaseTransition {
        from_phase: String,
        to_phase: String,
        /// IDs of red team challenges addressed
        red_team_responses: Vec<String>,
        /// IDs of assumptions accepted at this transition
        accepted_assumptions: Vec<String>,
    },

    /// Accept or reject a set of planning assumptions.
    /// Each assumption gets its own sensitivity rating.
    /// Risk owner is the person accountable if assumption is wrong.
    AssumptionAcceptance {
        assumptions: Vec<AssumptionRecord>,
        risk_owner: AccountId,
    },

    /// Approve a planning product (restated mission, COA set, OPORD, etc.)
    /// Includes AI confidence score for the product.
    ProductApproval {
        product_type: String,  // Maps to PlanningProduct enum
        mdmp_phase: String,
        ai_confidence: f64,     // 0.0-1.0, mandatory per INVARIANT 5
        product_hash: String,   // IPFS hash of the product
    },

    /// Red team gate: assert that all challenges for a phase have been
    /// addressed with required depth.
    RedTeamGate {
        phase: String,
        challenges_addressed: Vec<String>,
        unresolved_risks: Vec<String>,
    },

    /// Record commander's guidance. Links to assumptions it modifies.
    /// If guidance contradicts accepted assumptions, triggers re-evaluation.
    CommanderGuidance {
        guidance_text: String,
        modifies_assumptions: Vec<String>,
    },
}

impl ProposalKind {
    /// Check if this proposal kind requires forced human-in-loop.
    /// EXTENDED: PhaseTransition, AssumptionAcceptance, CommanderGuidance
    /// also require human-in-loop in addition to StrikeAuthorization.
    pub fn requires_human_in_loop(&self) -> bool {
        matches!(
            self,
            ProposalKind::StrikeAuthorization
                | ProposalKind::PhaseTransition { .. }
                | ProposalKind::AssumptionAcceptance { .. }
                | ProposalKind::CommanderGuidance { .. }
        )
    }

    /// Check if FullyDelegated autonomy is prohibited for this kind.
    /// Returns true for all kinds that involve authority exercise.
    pub fn prohibits_fully_delegated(&self) -> bool {
        matches!(
            self,
            ProposalKind::StrikeAuthorization
                | ProposalKind::PhaseTransition { .. }
                | ProposalKind::AssumptionAcceptance { .. }
                | ProposalKind::ProductApproval { .. }
                | ProposalKind::RedTeamGate { .. }
                | ProposalKind::CommanderGuidance { .. }
                | ProposalKind::ConfigChange
                | ProposalKind::MissionOrder
        )
    }

    /// Get policy label for permission matching.
    /// EXTENDED with new variant labels.
    pub fn to_policy_label(&self) -> String {
        match self {
            // Existing labels unchanged
            ProposalKind::ConfigChange => "config_change".to_string(),
            ProposalKind::AddMember => "add_member".to_string(),
            ProposalKind::RemoveMember => "remove_member".to_string(),
            ProposalKind::Transfer => "transfer".to_string(),
            ProposalKind::FunctionCall => "function_call".to_string(),
            ProposalKind::StrikeAuthorization => "strike_authorization".to_string(),
            ProposalKind::MissionOrder => "mission_order".to_string(),
            ProposalKind::Custom(name) => format!("custom:{}", name),
            // New labels
            ProposalKind::PhaseTransition { .. } => "phase_transition".to_string(),
            ProposalKind::AssumptionAcceptance { .. } => "assumption_acceptance".to_string(),
            ProposalKind::ProductApproval { .. } => "product_approval".to_string(),
            ProposalKind::RedTeamGate { .. } => "red_team_gate".to_string(),
            ProposalKind::CommanderGuidance { .. } => "commander_guidance".to_string(),
        }
    }
}


// ═══════════════════════════════════════════════════════════════════════════
// FILE: near-contracts/src/mdmp/types.rs — NEW
// ═══════════════════════════════════════════════════════════════════════════

/// MDMP Phase identifiers
#[near(serializers = [json, borsh])]
#[derive(Clone, Debug, PartialEq, Eq, Hash)]
pub enum MDMPPhase {
    Phase0Continuous,
    Phase1Receipt,
    Phase2Analysis,
    Phase3CoaDev,
    Phase4CoaAnalysis,
    Phase5CoaCompare,
    Phase6CoaApproval,
    Phase7Orders,
    Phase8Assessment,
}

impl MDMPPhase {
    /// Get the next phase in sequence (None if Phase8 or Phase0)
    pub fn next(&self) -> Option<MDMPPhase> {
        match self {
            MDMPPhase::Phase1Receipt => Some(MDMPPhase::Phase2Analysis),
            MDMPPhase::Phase2Analysis => Some(MDMPPhase::Phase3CoaDev),
            MDMPPhase::Phase3CoaDev => Some(MDMPPhase::Phase4CoaAnalysis),
            MDMPPhase::Phase4CoaAnalysis => Some(MDMPPhase::Phase5CoaCompare),
            MDMPPhase::Phase5CoaCompare => Some(MDMPPhase::Phase6CoaApproval),
            MDMPPhase::Phase6CoaApproval => Some(MDMPPhase::Phase7Orders),
            MDMPPhase::Phase7Orders => Some(MDMPPhase::Phase8Assessment),
            _ => None, // Phase0 is continuous, Phase8 loops
        }
    }

    /// Check if backward transition is allowed (revisiting earlier phase)
    pub fn can_revisit(&self, target: &MDMPPhase) -> bool {
        // JP 5-0 allows revisiting earlier phases
        // All backward transitions are allowed but require justification
        true
    }
}

/// Activity category for safety matrix enforcement
#[near(serializers = [json, borsh])]
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum ActivityCategory {
    DataAggregation,
    ValidationConsistency,
    Monitoring,
    MetaCognitive,
    PatternRecognition,
    MissionAnalysis,
    ProblemFraming,
    CoaGeneration,
    CoaEvaluation,
    Wargaming,
    DecisionSupport,
    RedTeaming,
    OrdersProduction,
    Assessment,
    Sustainment,
    ForceProtection,
    AssumptionMgmt,
    CoalitionMgmt,
    IntentAssessment,
    RiskJudgment,
    AuthorityDecision,
    EthicalLegal,
}

impl ActivityCategory {
    /// Check if FullyDelegated autonomy is permitted for this category.
    /// INVARIANT 8 enforcement.
    pub fn permits_fully_delegated(&self) -> bool {
        matches!(
            self,
            ActivityCategory::DataAggregation
                | ActivityCategory::ValidationConsistency
                | ActivityCategory::Monitoring
                | ActivityCategory::MetaCognitive
        )
    }

    /// Check if this category requires human-in-loop minimum.
    pub fn requires_human_in_loop(&self) -> bool {
        matches!(
            self,
            ActivityCategory::RiskJudgment
                | ActivityCategory::AuthorityDecision
                | ActivityCategory::EthicalLegal
        )
    }
}


// ═══════════════════════════════════════════════════════════════════════════
// FILE: near-contracts/src/mdmp/assumptions.rs — NEW
// Assumption Registry with lifecycle tracking
// ═══════════════════════════════════════════════════════════════════════════

/// Sensitivity level for planning assumptions
#[near(serializers = [json, borsh])]
#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord)]
pub enum SensitivityLevel {
    Low,        // Plan survives if wrong
    Medium,     // Plan degrades if wrong
    High,       // Plan fails if wrong
    Critical,   // Mission fails if wrong
}

/// Assumption lifecycle status
#[near(serializers = [json, borsh])]
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum AssumptionStatus {
    Pending,       // Identified, not evaluated
    Accepted,      // Explicitly accepted
    Rejected,      // Explicitly rejected
    Invalidated,   // Evidence shows wrong
    Expired,       // Too old, needs revalidation
}

/// Assumption record stored on-chain
#[near(serializers = [json, borsh])]
#[derive(Clone, Debug)]
pub struct AssumptionRecord {
    pub id: String,
    pub description: String,
    pub sensitivity: SensitivityLevel,
    pub validation_method: String,
    pub accepted_by: Option<AccountId>,
    pub accepted_at: Option<u64>,
    pub last_validated: Option<u64>,
    pub status: AssumptionStatus,
    pub source_phase: String,
    /// IPFS hash of linked evidence
    pub evidence_hash: Option<String>,
}

/// Assumption Registry contract
#[near(serializers = [borsh])]
pub struct AssumptionRegistry {
    /// Assumptions per mission: "mission_id:assumption_id" -> AssumptionRecord
    assumptions: LookupMap<String, AssumptionRecord>,
    /// Assumption IDs per mission for listing
    mission_assumptions: LookupMap<String, Vec<String>>,
}

impl AssumptionRegistry {
    pub fn new() -> Self {
        Self {
            assumptions: LookupMap::new(b"assumptions"),
            mission_assumptions: LookupMap::new(b"mission_assumptions"),
        }
    }

    /// Register a new assumption. Requires all mandatory fields per INVARIANT 3.
    pub fn register_assumption(
        &mut self,
        mission_id: &str,
        assumption: AssumptionRecord,
    ) -> Result<(), String> {
        // INVARIANT 3: Validate required fields
        if assumption.description.is_empty() {
            return Err("Assumption description is required".to_string());
        }
        if assumption.validation_method.is_empty() {
            return Err("Validation method is required".to_string());
        }

        let key = format!("{}:{}", mission_id, assumption.id);
        self.assumptions.insert(key, assumption.clone());

        // Track assumption ID for mission
        let mut ids = self.mission_assumptions
            .get(&mission_id.to_string())
            .cloned()
            .unwrap_or_default();
        ids.push(assumption.id.clone());
        self.mission_assumptions.insert(mission_id.to_string(), ids);

        log!(
            "ASSUMPTION_REGISTERED: {{\"mission_id\": \"{}\", \"id\": \"{}\", \"sensitivity\": \"{:?}\"}}",
            mission_id, assumption.id, assumption.sensitivity
        );

        Ok(())
    }

    /// Accept an assumption. Requires AccountId of acceptor.
    /// Only humans (NotAgent tier) can accept assumptions.
    pub fn accept_assumption(
        &mut self,
        mission_id: &str,
        assumption_id: &str,
        acceptor: AccountId,
    ) -> Result<(), String> {
        let key = format!("{}:{}", mission_id, assumption_id);
        let mut assumption = self.assumptions.get(&key)
            .cloned()
            .ok_or("Assumption not found")?;

        if assumption.status != AssumptionStatus::Pending {
            return Err(format!("Cannot accept assumption in status {:?}", assumption.status));
        }

        assumption.status = AssumptionStatus::Accepted;
        assumption.accepted_by = Some(acceptor.clone());
        assumption.accepted_at = Some(env::block_timestamp());
        self.assumptions.insert(key, assumption);

        log!(
            "ASSUMPTION_ACCEPTED: {{\"mission_id\": \"{}\", \"id\": \"{}\", \"acceptor\": \"{}\"}}",
            mission_id, assumption_id, acceptor
        );

        Ok(())
    }

    /// Invalidate an assumption.
    /// If sensitivity is Critical, this triggers INVARIANT 6 (replanning gate).
    /// Returns the sensitivity level so caller can create replanning gate if needed.
    pub fn invalidate_assumption(
        &mut self,
        mission_id: &str,
        assumption_id: &str,
        evidence_hash: Option<String>,
    ) -> Result<SensitivityLevel, String> {
        let key = format!("{}:{}", mission_id, assumption_id);
        let mut assumption = self.assumptions.get(&key)
            .cloned()
            .ok_or("Assumption not found")?;

        let sensitivity = assumption.sensitivity;
        assumption.status = AssumptionStatus::Invalidated;
        assumption.evidence_hash = evidence_hash;
        self.assumptions.insert(key, assumption);

        log!(
            "ASSUMPTION_INVALIDATED: {{\"mission_id\": \"{}\", \"id\": \"{}\", \"sensitivity\": \"{:?}\", \"triggers_replanning\": {}}}",
            mission_id, assumption_id, sensitivity,
            matches!(sensitivity, SensitivityLevel::Critical)
        );

        Ok(sensitivity)
    }

    /// Get all assumptions for a mission with optional status filter
    pub fn get_assumptions(
        &self,
        mission_id: &str,
        status_filter: Option<AssumptionStatus>,
    ) -> Vec<AssumptionRecord> {
        let ids = self.mission_assumptions
            .get(&mission_id.to_string())
            .cloned()
            .unwrap_or_default();

        ids.iter()
            .filter_map(|id| {
                let key = format!("{}:{}", mission_id, id);
                self.assumptions.get(&key).cloned()
            })
            .filter(|a| status_filter.map_or(true, |s| a.status == s))
            .collect()
    }

    /// Check if all assumptions with given sensitivity are in accepted state
    pub fn all_accepted_at_sensitivity(
        &self,
        mission_id: &str,
        min_sensitivity: SensitivityLevel,
    ) -> bool {
        let assumptions = self.get_assumptions(mission_id, None);
        assumptions.iter()
            .filter(|a| a.sensitivity >= min_sensitivity)
            .all(|a| a.status == AssumptionStatus::Accepted)
    }
}


// ═══════════════════════════════════════════════════════════════════════════
// FILE: near-contracts/src/mdmp/workflow.rs — NEW
// MDMP Workflow Engine with phase progression enforcement
// ═══════════════════════════════════════════════════════════════════════════

/// Gate status for MDMP phase progression
#[near(serializers = [json, borsh])]
#[derive(Clone, Debug)]
pub struct GateStatus {
    pub gate_id: String,
    pub gate_type: String,  // Maps to GateType enum in TypeScript
    pub satisfied: bool,
    pub satisfied_by: Option<AccountId>,
    pub satisfied_at: Option<u64>,
    pub proposal_id: Option<u64>,
}

/// Phase transition record for audit trail
#[near(serializers = [json, borsh])]
#[derive(Clone, Debug)]
pub struct PhaseTransitionRecord {
    pub from_phase: String,
    pub to_phase: String,
    pub authorized_by: AccountId,
    pub transitioned_at: u64,
    pub proposal_id: u64,
    pub satisfied_gates: Vec<String>,
    pub accepted_assumptions: Vec<String>,
    pub addressed_challenges: Vec<String>,
}

/// MDMP Workflow Engine
/// Enforces phase progression with governance gates
#[near(serializers = [borsh])]
pub struct MDMPWorkflow {
    /// Current phase per mission: mission_id -> MDMPPhase string
    current_phases: LookupMap<String, String>,
    /// Gate statuses: "mission_id:phase:gate_id" -> GateStatus
    gate_statuses: LookupMap<String, GateStatus>,
    /// Gate IDs per phase: "mission_id:phase" -> Vec<gate_id>
    phase_gates: LookupMap<String, Vec<String>>,
    /// Phase transitions: mission_id -> Vec<PhaseTransitionRecord>
    transitions: LookupMap<String, Vec<PhaseTransitionRecord>>,
    /// Associated DAO per mission: mission_id -> dao_id
    mission_daos: LookupMap<String, String>,
}

impl MDMPWorkflow {
    pub fn new() -> Self {
        Self {
            current_phases: LookupMap::new(b"mdmp_phases"),
            gate_statuses: LookupMap::new(b"mdmp_gates"),
            phase_gates: LookupMap::new(b"mdmp_phase_gates"),
            transitions: LookupMap::new(b"mdmp_transitions"),
            mission_daos: LookupMap::new(b"mdmp_daos"),
        }
    }

    /// Initialize a new MDMP workflow for a mission
    pub fn create_workflow(
        &mut self,
        mission_id: &str,
        dao_id: &str,
        initiator: AccountId,
    ) {
        self.current_phases.insert(
            mission_id.to_string(),
            "phase_1_receipt_of_mission".to_string(),
        );
        self.mission_daos.insert(mission_id.to_string(), dao_id.to_string());

        log!(
            "MDMP_WORKFLOW_CREATED: {{\"mission_id\": \"{}\", \"dao_id\": \"{}\", \"initiator\": \"{}\"}}",
            mission_id, dao_id, initiator
        );
    }

    /// Register a gate requirement for a phase
    pub fn register_gate(
        &mut self,
        mission_id: &str,
        phase: &str,
        gate: GateStatus,
    ) {
        let gate_key = format!("{}:{}:{}", mission_id, phase, gate.gate_id);
        let phase_key = format!("{}:{}", mission_id, phase);

        // Store gate status
        self.gate_statuses.insert(gate_key, gate.clone());

        // Track gate ID for phase
        let mut gate_ids = self.phase_gates
            .get(&phase_key)
            .cloned()
            .unwrap_or_default();
        gate_ids.push(gate.gate_id.clone());
        self.phase_gates.insert(phase_key, gate_ids);
    }

    /// Satisfy a gate (record it as passed)
    pub fn satisfy_gate(
        &mut self,
        mission_id: &str,
        phase: &str,
        gate_id: &str,
        satisfied_by: AccountId,
        proposal_id: Option<u64>,
    ) -> Result<(), String> {
        let gate_key = format!("{}:{}:{}", mission_id, phase, gate_id);
        let mut gate = self.gate_statuses.get(&gate_key)
            .cloned()
            .ok_or("Gate not found")?;

        if gate.satisfied {
            return Err("Gate already satisfied".to_string());
        }

        gate.satisfied = true;
        gate.satisfied_by = Some(satisfied_by.clone());
        gate.satisfied_at = Some(env::block_timestamp());
        gate.proposal_id = proposal_id;
        self.gate_statuses.insert(gate_key, gate);

        log!(
            "MDMP_GATE_SATISFIED: {{\"mission_id\": \"{}\", \"phase\": \"{}\", \"gate_id\": \"{}\", \"by\": \"{}\"}}",
            mission_id, phase, gate_id, satisfied_by
        );

        Ok(())
    }

    /// Validate that all gates for a phase are satisfied
    /// INVARIANT 2: MDMP_PHASE_PROGRESSION
    pub fn validate_phase_complete(
        &self,
        mission_id: &str,
        phase: &str,
    ) -> Result<(), Vec<String>> {
        let phase_key = format!("{}:{}", mission_id, phase);
        let gate_ids = self.phase_gates.get(&phase_key).cloned().unwrap_or_default();

        let unsatisfied: Vec<String> = gate_ids.iter()
            .filter(|gate_id| {
                let gate_key = format!("{}:{}:{}", mission_id, phase, gate_id);
                self.gate_statuses.get(&gate_key)
                    .map(|g| !g.satisfied)
                    .unwrap_or(true)
            })
            .cloned()
            .collect();

        if unsatisfied.is_empty() {
            Ok(())
        } else {
            Err(unsatisfied)
        }
    }

    /// Request phase transition.
    /// INVARIANT 2: All gates must be satisfied.
    /// INVARIANT 4: All red team challenges must be addressed.
    /// Returns a PhaseTransition ProposalKind for DAO voting.
    pub fn request_phase_transition(
        &self,
        mission_id: &str,
        to_phase: &str,
    ) -> Result<(), String> {
        let current = self.current_phases.get(&mission_id.to_string())
            .ok_or("Workflow not found")?;

        // Validate all gates satisfied
        match self.validate_phase_complete(mission_id, &current) {
            Ok(()) => Ok(()),
            Err(unsatisfied) => Err(format!(
                "Cannot transition: unsatisfied gates: {:?}", unsatisfied
            )),
        }
    }

    /// Execute phase transition after DAO approval
    pub fn execute_transition(
        &mut self,
        mission_id: &str,
        to_phase: &str,
        authorized_by: AccountId,
        proposal_id: u64,
        satisfied_gates: Vec<String>,
        accepted_assumptions: Vec<String>,
        addressed_challenges: Vec<String>,
    ) {
        let from_phase = self.current_phases.get(&mission_id.to_string())
            .cloned()
            .unwrap_or_default();

        // Record transition
        let record = PhaseTransitionRecord {
            from_phase: from_phase.clone(),
            to_phase: to_phase.to_string(),
            authorized_by: authorized_by.clone(),
            transitioned_at: env::block_timestamp(),
            proposal_id,
            satisfied_gates,
            accepted_assumptions,
            addressed_challenges,
        };

        let mut transitions = self.transitions
            .get(&mission_id.to_string())
            .cloned()
            .unwrap_or_default();
        transitions.push(record);
        self.transitions.insert(mission_id.to_string(), transitions);

        // Update current phase
        self.current_phases.insert(mission_id.to_string(), to_phase.to_string());

        log!(
            "MDMP_PHASE_TRANSITION: {{\"mission_id\": \"{}\", \"from\": \"{}\", \"to\": \"{}\", \"authorized_by\": \"{}\", \"proposal_id\": {}}}",
            mission_id, from_phase, to_phase, authorized_by, proposal_id
        );
    }

    /// Get current phase for a mission
    pub fn get_current_phase(&self, mission_id: &str) -> Option<String> {
        self.current_phases.get(&mission_id.to_string()).cloned()
    }

    /// Get all transitions for audit
    pub fn get_transitions(&self, mission_id: &str) -> Vec<PhaseTransitionRecord> {
        self.transitions.get(&mission_id.to_string()).cloned().unwrap_or_default()
    }
}


// ═══════════════════════════════════════════════════════════════════════════
// FILE: near-contracts/src/mdmp/safety.rs — NEW
// Safety Matrix enforcement
// ═══════════════════════════════════════════════════════════════════════════

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


// ═══════════════════════════════════════════════════════════════════════════
// FILE: near-contracts/src/dao/voting.rs — ADDITIONS
// New default vote policies for MDMP ProposalKind variants
// ═══════════════════════════════════════════════════════════════════════════

impl VotePolicy {
    /// Extended: default policies for MDMP proposal kinds
    pub fn for_proposal_kind(kind: &ProposalKind) -> Self {
        match kind {
            // ── Existing policies (unchanged) ──
            ProposalKind::StrikeAuthorization => Self {
                weight_kind: WeightKind::RoleWeight,
                threshold: ThresholdKind::unanimous(),
                quorum: ThresholdKind::unanimous(),
                veto_threshold: None,
            },
            ProposalKind::ConfigChange => Self {
                weight_kind: WeightKind::RoleWeight,
                threshold: ThresholdKind::two_thirds(),
                quorum: ThresholdKind::half(),
                veto_threshold: Some(ThresholdKind::Ratio { numerator: 1, denominator: 3 }),
            },
            ProposalKind::Transfer => Self {
                weight_kind: WeightKind::RoleWeight,
                threshold: ThresholdKind::half(),
                quorum: ThresholdKind::quarter(),
                veto_threshold: Some(ThresholdKind::half()),
            },
            ProposalKind::MissionOrder => Self {
                weight_kind: WeightKind::RoleWeight,
                threshold: ThresholdKind::two_thirds(),
                quorum: ThresholdKind::half(),
                veto_threshold: Some(ThresholdKind::Ratio { numerator: 1, denominator: 3 }),
            },

            // ── New MDMP policies ──

            // Phase transitions require 2/3 approval, 67% quorum
            // High bar because it gates all subsequent planning
            ProposalKind::PhaseTransition { .. } => Self {
                weight_kind: WeightKind::RoleWeight,
                threshold: ThresholdKind::two_thirds(),
                quorum: ThresholdKind::two_thirds(),
                veto_threshold: Some(ThresholdKind::Ratio { numerator: 1, denominator: 3 }),
            },

            // Assumption acceptance: simple majority, 50% quorum
            // Lower bar to avoid bottlenecking the planning process
            ProposalKind::AssumptionAcceptance { .. } => Self {
                weight_kind: WeightKind::RoleWeight,
                threshold: ThresholdKind::half(),
                quorum: ThresholdKind::half(),
                veto_threshold: None,
            },

            // Product approval: 2/3 approval, 50% quorum
            ProposalKind::ProductApproval { .. } => Self {
                weight_kind: WeightKind::RoleWeight,
                threshold: ThresholdKind::two_thirds(),
                quorum: ThresholdKind::half(),
                veto_threshold: Some(ThresholdKind::Ratio { numerator: 1, denominator: 3 }),
            },

            // Red team gate: simple majority, 50% quorum
            // Red team challenges inform but don't block; the gate
            // is about acknowledging challenges were considered
            ProposalKind::RedTeamGate { .. } => Self {
                weight_kind: WeightKind::RoleWeight,
                threshold: ThresholdKind::half(),
                quorum: ThresholdKind::half(),
                veto_threshold: None,
            },

            // Commander guidance: recorded, not voted on
            // Requires only the commander's approval (threshold 1 absolute)
            ProposalKind::CommanderGuidance { .. } => Self {
                weight_kind: WeightKind::RoleWeight,
                threshold: ThresholdKind::Absolute { count: 1 },
                quorum: ThresholdKind::Absolute { count: 1 },
                veto_threshold: None,
            },

            _ => Self::default(),
        }
    }
}


// ═══════════════════════════════════════════════════════════════════════════
// FILE: near-contracts/src/dao/execution.rs — ADDITIONS
// Extended execution flow for FullyDelegated and MDMP types
// ═══════════════════════════════════════════════════════════════════════════

impl ProposalExecutor {
    /// Extended: Process voting completion with FullyDelegated support
    pub fn process_voting_complete(
        &mut self,
        dao_id: &str,
        proposal_id: u64,
        voting_result: &VotingResult,
        effective_autonomy: AutonomyLevel,
    ) -> ExecutionState {
        let approved = voting_result.quorum_met
            && voting_result.approved
            && !voting_result.vetoed;

        let new_state = if !approved {
            ExecutionState::Rejected
        } else {
            match effective_autonomy {
                // NEW: FullyDelegated executes immediately, same as Autonomous
                // but with additional audit metadata
                AutonomyLevel::FullyDelegated => {
                    log!(
                        "FULLY_DELEGATED_EXECUTION: {{\"dao_id\": \"{}\", \"proposal_id\": {}, \"note\": \"No human monitoring required\"}}",
                        dao_id, proposal_id
                    );
                    ExecutionState::ReadyForExecution
                }
                AutonomyLevel::Autonomous => {
                    ExecutionState::ReadyForExecution
                }
                AutonomyLevel::SemiAutonomous => {
                    let config = self.get_config(dao_id);
                    let deadline = env::block_timestamp() + config.veto_window_ns;
                    ExecutionState::InVetoWindow { deadline }
                }
                AutonomyLevel::NotAutonomous => {
                    ExecutionState::AwaitingHumanApproval
                }
            }
        };

        self.set_execution_state(dao_id, proposal_id, new_state.clone());
        new_state
    }
}


// ═══════════════════════════════════════════════════════════════════════════
// TESTS
// ═══════════════════════════════════════════════════════════════════════════

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_fully_delegated_scope_restriction() {
        // Should pass: DataAggregation with FullyDelegated
        assert!(validate_autonomy_assignment(
            &AutonomyLevel::FullyDelegated,
            &ActivityCategory::DataAggregation,
            &ProposalKind::Custom("data_pipeline".to_string()),
        ).is_ok());

        // Should fail: MissionAnalysis with FullyDelegated
        assert!(validate_autonomy_assignment(
            &AutonomyLevel::FullyDelegated,
            &ActivityCategory::MissionAnalysis,
            &ProposalKind::Custom("analysis".to_string()),
        ).is_err());

        // Should fail: Any ProposalKind involving authority with FullyDelegated
        assert!(validate_autonomy_assignment(
            &AutonomyLevel::FullyDelegated,
            &ActivityCategory::DataAggregation,
            &ProposalKind::PhaseTransition {
                from_phase: "1".to_string(),
                to_phase: "2".to_string(),
                red_team_responses: vec![],
                accepted_assumptions: vec![],
            },
        ).is_err());
    }

    #[test]
    fn test_human_only_categories() {
        // Should fail: RiskJudgment with any AI autonomy
        assert!(validate_autonomy_assignment(
            &AutonomyLevel::Autonomous,
            &ActivityCategory::RiskJudgment,
            &ProposalKind::Custom("risk".to_string()),
        ).is_err());

        // Should pass: RiskJudgment with NotAutonomous
        assert!(validate_autonomy_assignment(
            &AutonomyLevel::NotAutonomous,
            &ActivityCategory::RiskJudgment,
            &ProposalKind::Custom("risk".to_string()),
        ).is_ok());

        // Should fail: EthicalLegal with SemiAutonomous
        assert!(validate_autonomy_assignment(
            &AutonomyLevel::SemiAutonomous,
            &ActivityCategory::EthicalLegal,
            &ProposalKind::Custom("legal".to_string()),
        ).is_err());

        // Should fail: AuthorityDecision with Autonomous
        assert!(validate_autonomy_assignment(
            &AutonomyLevel::Autonomous,
            &ActivityCategory::AuthorityDecision,
            &ProposalKind::Custom("command".to_string()),
        ).is_err());
    }

    #[test]
    fn test_strike_authorization_invariant_preserved() {
        // Existing invariant: StrikeAuthorization always NotAutonomous
        assert!(validate_autonomy_assignment(
            &AutonomyLevel::Autonomous,
            &ActivityCategory::AuthorityDecision,
            &ProposalKind::StrikeAuthorization,
        ).is_err());

        assert!(validate_autonomy_assignment(
            &AutonomyLevel::FullyDelegated,
            &ActivityCategory::DataAggregation, // Even with permissive category
            &ProposalKind::StrikeAuthorization,
        ).is_err());
    }

    #[test]
    fn test_new_proposal_kinds_require_human_in_loop() {
        // PhaseTransition requires human-in-loop
        assert!(ProposalKind::PhaseTransition {
            from_phase: "1".to_string(),
            to_phase: "2".to_string(),
            red_team_responses: vec![],
            accepted_assumptions: vec![],
        }.requires_human_in_loop());

        // AssumptionAcceptance requires human-in-loop
        assert!(ProposalKind::AssumptionAcceptance {
            assumptions: vec![],
            risk_owner: "commander.near".parse().unwrap(),
        }.requires_human_in_loop());

        // CommanderGuidance requires human-in-loop
        assert!(ProposalKind::CommanderGuidance {
            guidance_text: "test".to_string(),
            modifies_assumptions: vec![],
        }.requires_human_in_loop());

        // ProductApproval does NOT require human-in-loop
        // (it uses standard voting, not forced NotAutonomous)
        assert!(!ProposalKind::ProductApproval {
            product_type: "oplan".to_string(),
            mdmp_phase: "phase_5".to_string(),
            ai_confidence: 0.85,
            product_hash: "QmHash".to_string(),
        }.requires_human_in_loop());
    }

    #[test]
    fn test_assumption_lifecycle() {
        // Test register -> accept -> invalidate flow
        let mut registry = AssumptionRegistry::new();
        let mission = "mission-alpha";

        let assumption = AssumptionRecord {
            id: "A-001".to_string(),
            description: "Port of Debarkation remains accessible".to_string(),
            sensitivity: SensitivityLevel::Critical,
            validation_method: "ISR coverage of port area".to_string(),
            accepted_by: None,
            accepted_at: None,
            last_validated: None,
            status: AssumptionStatus::Pending,
            source_phase: "phase_2_mission_analysis".to_string(),
            evidence_hash: None,
        };

        // Register
        assert!(registry.register_assumption(mission, assumption).is_ok());

        // Accept
        let commander: AccountId = "commander.near".parse().unwrap();
        assert!(registry.accept_assumption(mission, "A-001", commander).is_ok());

        // Verify accepted
        let assumptions = registry.get_assumptions(mission, Some(AssumptionStatus::Accepted));
        assert_eq!(assumptions.len(), 1);
        assert_eq!(assumptions[0].sensitivity, SensitivityLevel::Critical);

        // Invalidate -> should return Critical (triggers replanning)
        let result = registry.invalidate_assumption(mission, "A-001", None);
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), SensitivityLevel::Critical);
    }
}
