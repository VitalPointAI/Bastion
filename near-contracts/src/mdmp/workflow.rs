/**
 * MDMP Workflow Engine
 *
 * Enforces phase progression with governance gates following JP 5-0 doctrine.
 * Implements INVARIANT 2 (phase gates must be satisfied before transition).
 *
 * Key components:
 * - GateStatus: Tracks satisfaction state of governance gates
 * - PhaseTransitionRecord: Audit trail for phase transitions
 * - MDMPWorkflow: Core workflow engine with gate enforcement
 */

use near_sdk::{env, log, near, AccountId, BorshStorageKey};
use near_sdk::store::LookupMap;

/// Storage keys for MDMP workflow collections
#[derive(BorshStorageKey)]
#[near]
pub enum WorkflowStorageKey {
    CurrentPhases,
    GateStatuses,
    PhaseGates,
    Transitions,
    MissionDaos,
}

/// Gate status for MDMP phase progression
#[near(serializers = [json, borsh])]
#[derive(Clone, Debug)]
pub struct GateStatus {
    pub gate_id: String,
    /// Maps to GateType enum in TypeScript
    pub gate_type: String,
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
            current_phases: LookupMap::new(WorkflowStorageKey::CurrentPhases),
            gate_statuses: LookupMap::new(WorkflowStorageKey::GateStatuses),
            phase_gates: LookupMap::new(WorkflowStorageKey::PhaseGates),
            transitions: LookupMap::new(WorkflowStorageKey::Transitions),
            mission_daos: LookupMap::new(WorkflowStorageKey::MissionDaos),
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
    /// Returns a PhaseTransition ProposalKind for DAO voting.
    pub fn request_phase_transition(
        &self,
        mission_id: &str,
        _to_phase: &str,
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

#[cfg(test)]
mod tests {
    use super::*;

    fn alice() -> AccountId {
        "alice.near".parse().unwrap()
    }

    fn bob() -> AccountId {
        "bob.near".parse().unwrap()
    }

    #[test]
    fn test_workflow_creation_starts_at_phase_1() {
        let mut workflow = MDMPWorkflow::new();
        workflow.create_workflow("mission-1", "dao-1", alice());

        let phase = workflow.get_current_phase("mission-1");
        assert_eq!(phase, Some("phase_1_receipt_of_mission".to_string()));
    }

    #[test]
    fn test_gate_satisfaction_flow() {
        let mut workflow = MDMPWorkflow::new();
        workflow.create_workflow("mission-1", "dao-1", alice());

        let gate = GateStatus {
            gate_id: "gate-1".to_string(),
            gate_type: "red_team".to_string(),
            satisfied: false,
            satisfied_by: None,
            satisfied_at: None,
            proposal_id: None,
        };

        workflow.register_gate("mission-1", "phase_1_receipt_of_mission", gate);

        // Satisfy the gate
        let result = workflow.satisfy_gate(
            "mission-1",
            "phase_1_receipt_of_mission",
            "gate-1",
            bob(),
            Some(42),
        );
        assert!(result.is_ok());

        // Verify phase is now complete
        let validation = workflow.validate_phase_complete("mission-1", "phase_1_receipt_of_mission");
        assert!(validation.is_ok());
    }

    #[test]
    fn test_phase_complete_validation() {
        let mut workflow = MDMPWorkflow::new();
        workflow.create_workflow("mission-1", "dao-1", alice());

        // Register two gates
        let gate1 = GateStatus {
            gate_id: "gate-1".to_string(),
            gate_type: "red_team".to_string(),
            satisfied: false,
            satisfied_by: None,
            satisfied_at: None,
            proposal_id: None,
        };
        let gate2 = GateStatus {
            gate_id: "gate-2".to_string(),
            gate_type: "commander_approval".to_string(),
            satisfied: false,
            satisfied_by: None,
            satisfied_at: None,
            proposal_id: None,
        };

        workflow.register_gate("mission-1", "phase_1_receipt_of_mission", gate1);
        workflow.register_gate("mission-1", "phase_1_receipt_of_mission", gate2);

        // Phase incomplete - should return unsatisfied gates
        let validation = workflow.validate_phase_complete("mission-1", "phase_1_receipt_of_mission");
        assert!(validation.is_err());
        let unsatisfied = validation.unwrap_err();
        assert_eq!(unsatisfied.len(), 2);
        assert!(unsatisfied.contains(&"gate-1".to_string()));
        assert!(unsatisfied.contains(&"gate-2".to_string()));
    }

    #[test]
    fn test_phase_transition_requires_all_gates() {
        let mut workflow = MDMPWorkflow::new();
        workflow.create_workflow("mission-1", "dao-1", alice());

        let gate = GateStatus {
            gate_id: "gate-1".to_string(),
            gate_type: "red_team".to_string(),
            satisfied: false,
            satisfied_by: None,
            satisfied_at: None,
            proposal_id: None,
        };

        workflow.register_gate("mission-1", "phase_1_receipt_of_mission", gate);

        // Cannot transition with unsatisfied gates
        let result = workflow.request_phase_transition("mission-1", "phase_2_mission_analysis");
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("unsatisfied gates"));

        // Satisfy gate
        workflow.satisfy_gate(
            "mission-1",
            "phase_1_receipt_of_mission",
            "gate-1",
            alice(),
            None,
        ).unwrap();

        // Now can transition
        let result = workflow.request_phase_transition("mission-1", "phase_2_mission_analysis");
        assert!(result.is_ok());
    }

    #[test]
    fn test_execute_transition_records_audit_trail() {
        let mut workflow = MDMPWorkflow::new();
        workflow.create_workflow("mission-1", "dao-1", alice());

        workflow.execute_transition(
            "mission-1",
            "phase_2_mission_analysis",
            alice(),
            42,
            vec!["gate-1".to_string(), "gate-2".to_string()],
            vec!["assumption-1".to_string()],
            vec!["challenge-1".to_string()],
        );

        // Verify transition was recorded
        let transitions = workflow.get_transitions("mission-1");
        assert_eq!(transitions.len(), 1);
        assert_eq!(transitions[0].from_phase, "phase_1_receipt_of_mission");
        assert_eq!(transitions[0].to_phase, "phase_2_mission_analysis");
        assert_eq!(transitions[0].proposal_id, 42);
        assert_eq!(transitions[0].satisfied_gates.len(), 2);
        assert_eq!(transitions[0].accepted_assumptions.len(), 1);
        assert_eq!(transitions[0].addressed_challenges.len(), 1);

        // Verify current phase updated
        let phase = workflow.get_current_phase("mission-1");
        assert_eq!(phase, Some("phase_2_mission_analysis".to_string()));
    }

    #[test]
    fn test_satisfy_already_satisfied_gate_fails() {
        let mut workflow = MDMPWorkflow::new();
        workflow.create_workflow("mission-1", "dao-1", alice());

        let gate = GateStatus {
            gate_id: "gate-1".to_string(),
            gate_type: "red_team".to_string(),
            satisfied: false,
            satisfied_by: None,
            satisfied_at: None,
            proposal_id: None,
        };

        workflow.register_gate("mission-1", "phase_1_receipt_of_mission", gate);

        // Satisfy once
        let result = workflow.satisfy_gate(
            "mission-1",
            "phase_1_receipt_of_mission",
            "gate-1",
            alice(),
            None,
        );
        assert!(result.is_ok());

        // Try to satisfy again - should fail
        let result = workflow.satisfy_gate(
            "mission-1",
            "phase_1_receipt_of_mission",
            "gate-1",
            bob(),
            None,
        );
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("already satisfied"));
    }
}
