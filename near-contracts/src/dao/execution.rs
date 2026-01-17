/**
 * DAO Proposal Execution Engine
 *
 * Provides autonomy-aware proposal execution for BASTION DAO governance:
 * - Three execution flows: Autonomous, SemiAutonomous, NotAutonomous (human-in-loop)
 * - Veto mechanism for semi-autonomous proposals
 * - Human approval flow for critical decisions
 * - Special audit events for strike authorization
 *
 * Key features:
 * - ExecutionState enum with full state machine
 * - Configurable veto windows and execution delays
 * - Audit trail via JSON-formatted events
 * - StrikeAuthorized event for lethal decision tracking
 */

use near_sdk::store::LookupMap;
use near_sdk::{env, log, near, AccountId, BorshStorageKey};

use super::types::{AutonomyLevel, ProposalKind};
use super::voting::VotingResult;

/// Storage keys for execution collections
#[derive(BorshStorageKey)]
#[near]
pub enum ExecutionStorageKey {
    /// Execution states: (dao_id, proposal_id) -> ExecutionState
    ExecutionStates,
    /// Execution configs: dao_id -> ExecutionConfig
    ExecutionConfigs,
}

/// Execution state for a proposal
///
/// State machine:
/// - Pending -> ReadyForExecution (Autonomous approved)
/// - Pending -> InVetoWindow (SemiAutonomous approved)
/// - Pending -> AwaitingHumanApproval (NotAutonomous approved)
/// - Pending -> Rejected (vote failed)
/// - InVetoWindow -> ReadyForExecution (window passed, no veto)
/// - InVetoWindow -> Vetoed (council member vetoed)
/// - AwaitingHumanApproval -> ReadyForExecution (human approved)
/// - ReadyForExecution -> Executed (execution complete)
#[near(serializers = [json, borsh])]
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum ExecutionState {
    /// Waiting for voting to complete
    Pending,

    /// Voting passed, ready for immediate execution
    ReadyForExecution,

    /// Semi-autonomous: in veto window, council can veto
    InVetoWindow {
        /// Deadline timestamp (nanoseconds) for veto window
        deadline: u64,
    },

    /// Human-in-loop: waiting for explicit human approval
    AwaitingHumanApproval,

    /// Successfully executed
    Executed {
        /// Result/description of execution
        result: String,
    },

    /// Vetoed during veto window
    Vetoed {
        /// Account that submitted the veto
        by: AccountId,
    },

    /// Voting rejected the proposal
    Rejected,
}

impl Default for ExecutionState {
    fn default() -> Self {
        ExecutionState::Pending
    }
}

impl ExecutionState {
    /// Check if this state allows execution
    pub fn can_execute(&self) -> bool {
        matches!(self, ExecutionState::ReadyForExecution)
    }

    /// Check if this state is terminal (no further transitions)
    pub fn is_terminal(&self) -> bool {
        matches!(
            self,
            ExecutionState::Executed { .. }
                | ExecutionState::Vetoed { .. }
                | ExecutionState::Rejected
        )
    }

    /// Check if this state allows veto
    pub fn can_veto(&self) -> bool {
        matches!(self, ExecutionState::InVetoWindow { .. })
    }

    /// Check if this state allows human approval
    pub fn can_approve(&self) -> bool {
        matches!(self, ExecutionState::AwaitingHumanApproval)
    }
}

/// Execution configuration for a DAO
#[near(serializers = [json, borsh])]
#[derive(Clone, Debug)]
pub struct ExecutionConfig {
    /// Duration of veto window for semi-autonomous proposals (nanoseconds)
    /// Default: 1 hour (3_600_000_000_000 ns)
    pub veto_window_ns: u64,

    /// Delay before execution for safety (nanoseconds)
    /// Default: 0 for autonomous proposals
    pub execution_delay_ns: u64,
}

impl Default for ExecutionConfig {
    fn default() -> Self {
        Self {
            veto_window_ns: 3_600_000_000_000, // 1 hour
            execution_delay_ns: 0,
        }
    }
}

impl ExecutionConfig {
    /// Create config with custom veto window
    pub fn with_veto_window(veto_window_ns: u64) -> Self {
        Self {
            veto_window_ns,
            execution_delay_ns: 0,
        }
    }

    /// Create config with both custom values
    pub fn new(veto_window_ns: u64, execution_delay_ns: u64) -> Self {
        Self {
            veto_window_ns,
            execution_delay_ns,
        }
    }
}

/// Proposal executor with autonomy-aware execution flows
#[near(serializers = [borsh])]
pub struct ProposalExecutor {
    /// Execution states: composite key "dao_id:proposal_id" -> ExecutionState
    execution_states: LookupMap<String, ExecutionState>,

    /// Execution configs per DAO: dao_id -> ExecutionConfig
    execution_configs: LookupMap<String, ExecutionConfig>,
}

impl ProposalExecutor {
    /// Initialize new proposal executor
    pub fn new() -> Self {
        Self {
            execution_states: LookupMap::new(ExecutionStorageKey::ExecutionStates),
            execution_configs: LookupMap::new(ExecutionStorageKey::ExecutionConfigs),
        }
    }

    /// Create composite key for execution state storage
    fn state_key(dao_id: &str, proposal_id: u64) -> String {
        format!("{}:{}", dao_id, proposal_id)
    }

    /// Get execution config for a DAO (or default)
    pub fn get_config(&self, dao_id: &str) -> ExecutionConfig {
        self.execution_configs
            .get(dao_id)
            .cloned()
            .unwrap_or_default()
    }

    /// Set execution config for a DAO
    pub fn set_config(&mut self, dao_id: &str, config: ExecutionConfig) {
        self.execution_configs.insert(dao_id.to_string(), config.clone());

        log!(
            "EXECUTION_CONFIG_SET: {{\"dao_id\": \"{}\", \"veto_window_ns\": {}, \"execution_delay_ns\": {}}}",
            dao_id,
            config.veto_window_ns,
            config.execution_delay_ns
        );
    }

    /// Get execution state for a proposal
    pub fn get_execution_state(&self, dao_id: &str, proposal_id: u64) -> ExecutionState {
        let key = Self::state_key(dao_id, proposal_id);
        self.execution_states
            .get(&key)
            .cloned()
            .unwrap_or_default()
    }

    /// Set execution state for a proposal (internal)
    fn set_execution_state(&mut self, dao_id: &str, proposal_id: u64, state: ExecutionState) {
        let key = Self::state_key(dao_id, proposal_id);
        self.execution_states.insert(key, state);
    }

    /// Process voting completion and determine next state
    ///
    /// Based on effective_autonomy:
    /// - Autonomous: If approved -> ReadyForExecution
    /// - SemiAutonomous: If approved -> InVetoWindow with deadline
    /// - NotAutonomous: If approved -> AwaitingHumanApproval
    /// - If rejected -> Rejected
    ///
    /// # Arguments
    /// * `dao_id` - DAO identifier
    /// * `proposal_id` - Proposal identifier
    /// * `voting_result` - Result of vote calculation
    /// * `effective_autonomy` - Effective autonomy level for this proposal
    ///
    /// # Returns
    /// New execution state
    pub fn process_voting_complete(
        &mut self,
        dao_id: &str,
        proposal_id: u64,
        voting_result: &VotingResult,
        effective_autonomy: AutonomyLevel,
    ) -> ExecutionState {
        // Check if approved
        let approved = voting_result.quorum_met && voting_result.approved && !voting_result.vetoed;

        let new_state = if !approved {
            ExecutionState::Rejected
        } else {
            // Determine state based on autonomy level
            match effective_autonomy {
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

        // Emit appropriate event
        match &new_state {
            ExecutionState::Rejected => {
                log!(
                    "PROPOSAL_REJECTED: {{\"dao_id\": \"{}\", \"proposal_id\": {}, \"quorum_met\": {}, \"approved\": {}, \"vetoed\": {}}}",
                    dao_id,
                    proposal_id,
                    voting_result.quorum_met,
                    voting_result.approved,
                    voting_result.vetoed
                );
            }
            ExecutionState::ReadyForExecution => {
                log!(
                    "PROPOSAL_APPROVED: {{\"dao_id\": \"{}\", \"proposal_id\": {}, \"autonomy_level\": \"Autonomous\"}}",
                    dao_id,
                    proposal_id
                );
            }
            ExecutionState::InVetoWindow { deadline } => {
                log!(
                    "VETO_WINDOW_STARTED: {{\"dao_id\": \"{}\", \"proposal_id\": {}, \"deadline\": {}}}",
                    dao_id,
                    proposal_id,
                    deadline
                );
            }
            ExecutionState::AwaitingHumanApproval => {
                log!(
                    "PROPOSAL_APPROVED: {{\"dao_id\": \"{}\", \"proposal_id\": {}, \"autonomy_level\": \"NotAutonomous\", \"awaiting_human_approval\": true}}",
                    dao_id,
                    proposal_id
                );
            }
            _ => {}
        }

        new_state
    }

    /// Check veto window and potentially advance state
    ///
    /// If current time > deadline and no veto, transitions to ReadyForExecution
    ///
    /// # Returns
    /// Current execution state (possibly updated)
    pub fn check_veto_window(&mut self, dao_id: &str, proposal_id: u64) -> ExecutionState {
        let state = self.get_execution_state(dao_id, proposal_id);

        if let ExecutionState::InVetoWindow { deadline } = state {
            let now = env::block_timestamp();
            if now >= deadline {
                // Veto window passed without veto - ready for execution
                let new_state = ExecutionState::ReadyForExecution;
                self.set_execution_state(dao_id, proposal_id, new_state.clone());

                log!(
                    "VETO_WINDOW_PASSED: {{\"dao_id\": \"{}\", \"proposal_id\": {}, \"deadline\": {}, \"current_time\": {}}}",
                    dao_id,
                    proposal_id,
                    deadline,
                    now
                );

                return new_state;
            }
        }

        state
    }

    /// Submit a veto during the veto window
    ///
    /// # Arguments
    /// * `dao_id` - DAO identifier
    /// * `proposal_id` - Proposal identifier
    /// * `vetoer` - Account submitting the veto
    ///
    /// # Returns
    /// * `Ok(ExecutionState)` on success
    /// * `Err(String)` if not in veto window or veto not allowed
    ///
    /// # Note
    /// The caller should verify the vetoer has veto permission (council role)
    pub fn submit_veto(
        &mut self,
        dao_id: &str,
        proposal_id: u64,
        vetoer: AccountId,
    ) -> Result<ExecutionState, String> {
        let state = self.get_execution_state(dao_id, proposal_id);

        match state {
            ExecutionState::InVetoWindow { deadline } => {
                let now = env::block_timestamp();
                if now >= deadline {
                    return Err("Veto window has expired".to_string());
                }

                let new_state = ExecutionState::Vetoed { by: vetoer.clone() };
                self.set_execution_state(dao_id, proposal_id, new_state.clone());

                log!(
                    "PROPOSAL_VETOED: {{\"dao_id\": \"{}\", \"proposal_id\": {}, \"vetoer\": \"{}\"}}",
                    dao_id,
                    proposal_id,
                    vetoer
                );

                Ok(new_state)
            }
            _ => Err(format!(
                "Cannot veto proposal in state {:?}",
                state
            )),
        }
    }

    /// Submit human approval for a proposal awaiting approval
    ///
    /// # Arguments
    /// * `dao_id` - DAO identifier
    /// * `proposal_id` - Proposal identifier
    /// * `approver` - Account providing approval
    ///
    /// # Returns
    /// * `Ok(ExecutionState)` on success
    /// * `Err(String)` if not awaiting approval
    ///
    /// # Note
    /// The caller should verify the approver has Execute permission for this proposal kind
    pub fn submit_human_approval(
        &mut self,
        dao_id: &str,
        proposal_id: u64,
        approver: AccountId,
    ) -> Result<ExecutionState, String> {
        let state = self.get_execution_state(dao_id, proposal_id);

        match state {
            ExecutionState::AwaitingHumanApproval => {
                let new_state = ExecutionState::ReadyForExecution;
                self.set_execution_state(dao_id, proposal_id, new_state.clone());

                log!(
                    "HUMAN_APPROVAL_RECEIVED: {{\"dao_id\": \"{}\", \"proposal_id\": {}, \"approver\": \"{}\"}}",
                    dao_id,
                    proposal_id,
                    approver
                );

                Ok(new_state)
            }
            _ => Err(format!(
                "Cannot approve proposal in state {:?}",
                state
            )),
        }
    }

    /// Execute a proposal that is ready for execution
    ///
    /// # Arguments
    /// * `dao_id` - DAO identifier
    /// * `proposal_id` - Proposal identifier
    /// * `proposal_kind` - Type of proposal to execute
    /// * `executor` - Account executing the proposal
    /// * `target` - Optional target for strike authorization (for audit)
    ///
    /// # Returns
    /// * `Ok(String)` with execution result on success
    /// * `Err(String)` if not ready for execution
    pub fn execute_proposal(
        &mut self,
        dao_id: &str,
        proposal_id: u64,
        proposal_kind: &ProposalKind,
        executor: AccountId,
        target: Option<String>,
    ) -> Result<String, String> {
        let state = self.get_execution_state(dao_id, proposal_id);

        if !state.can_execute() {
            return Err(format!(
                "Cannot execute proposal in state {:?}",
                state
            ));
        }

        // Execute based on proposal kind
        let result = self.execute_by_kind(dao_id, proposal_id, proposal_kind, &executor, target.clone());

        // Update state to Executed
        let new_state = ExecutionState::Executed {
            result: result.clone(),
        };
        self.set_execution_state(dao_id, proposal_id, new_state);

        log!(
            "PROPOSAL_EXECUTED: {{\"dao_id\": \"{}\", \"proposal_id\": {}, \"executor\": \"{}\", \"result\": \"{}\"}}",
            dao_id,
            proposal_id,
            executor,
            result
        );

        Ok(result)
    }

    /// Execute proposal based on its kind
    ///
    /// Returns a result string describing the execution
    fn execute_by_kind(
        &self,
        dao_id: &str,
        proposal_id: u64,
        proposal_kind: &ProposalKind,
        executor: &AccountId,
        target: Option<String>,
    ) -> String {
        match proposal_kind {
            ProposalKind::ConfigChange => {
                // In production: Update DAO config
                format!("Config change applied for DAO {}", dao_id)
            }
            ProposalKind::AddMember => {
                // In production: Add member via RoleManager
                format!("Member added to DAO {}", dao_id)
            }
            ProposalKind::RemoveMember => {
                // In production: Remove member via RoleManager
                format!("Member removed from DAO {}", dao_id)
            }
            ProposalKind::Transfer => {
                // In production: Create Promise for transfer
                format!("Transfer executed for DAO {}", dao_id)
            }
            ProposalKind::FunctionCall => {
                // In production: Create cross-contract call Promise
                format!("Function call executed for DAO {}", dao_id)
            }
            ProposalKind::StrikeAuthorization => {
                // CRITICAL: Emit special audit event for lethal decisions
                let target_str = target.unwrap_or_else(|| "unspecified".to_string());

                log!(
                    "STRIKE_AUTHORIZED: {{\"dao_id\": \"{}\", \"proposal_id\": {}, \"approver\": \"{}\", \"target\": \"{}\", \"timestamp\": {}}}",
                    dao_id,
                    proposal_id,
                    executor,
                    target_str,
                    env::block_timestamp()
                );

                format!(
                    "Strike authorization recorded: target={}, approver={}",
                    target_str, executor
                )
            }
            ProposalKind::MissionOrder => {
                // Emit mission order event
                log!(
                    "MISSION_ORDER_ISSUED: {{\"dao_id\": \"{}\", \"proposal_id\": {}, \"issuer\": \"{}\", \"timestamp\": {}}}",
                    dao_id,
                    proposal_id,
                    executor,
                    env::block_timestamp()
                );

                format!("Mission order issued for DAO {}", dao_id)
            }
            ProposalKind::Custom(name) => {
                // Custom proposals just emit event
                log!(
                    "CUSTOM_PROPOSAL_EXECUTED: {{\"dao_id\": \"{}\", \"proposal_id\": {}, \"kind\": \"{}\", \"executor\": \"{}\"}}",
                    dao_id,
                    proposal_id,
                    name,
                    executor
                );

                format!("Custom proposal '{}' executed for DAO {}", name, dao_id)
            }
        }
    }

    /// Check if a proposal is ready for execution (convenience method)
    pub fn is_ready_for_execution(&self, dao_id: &str, proposal_id: u64) -> bool {
        self.get_execution_state(dao_id, proposal_id).can_execute()
    }

    /// Check if a proposal is in veto window (convenience method)
    pub fn is_in_veto_window(&self, dao_id: &str, proposal_id: u64) -> bool {
        matches!(
            self.get_execution_state(dao_id, proposal_id),
            ExecutionState::InVetoWindow { .. }
        )
    }

    /// Check if a proposal is awaiting human approval (convenience method)
    pub fn is_awaiting_approval(&self, dao_id: &str, proposal_id: u64) -> bool {
        matches!(
            self.get_execution_state(dao_id, proposal_id),
            ExecutionState::AwaitingHumanApproval
        )
    }

    /// Get remaining veto time in nanoseconds (0 if not in veto window)
    pub fn get_remaining_veto_time(&self, dao_id: &str, proposal_id: u64) -> u64 {
        if let ExecutionState::InVetoWindow { deadline } = self.get_execution_state(dao_id, proposal_id) {
            let now = env::block_timestamp();
            if now < deadline {
                return deadline - now;
            }
        }
        0
    }
}

impl Default for ProposalExecutor {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use near_sdk::test_utils::VMContextBuilder;
    use near_sdk::testing_env;

    fn get_context(predecessor: AccountId) -> VMContextBuilder {
        let mut builder = VMContextBuilder::new();
        builder.predecessor_account_id(predecessor);
        builder.block_timestamp(1_000_000_000); // 1 second in ns
        builder
    }

    fn create_approved_result() -> VotingResult {
        VotingResult {
            total_weight: 10,
            approve_weight: 8,
            reject_weight: 2,
            abstain_weight: 0,
            quorum_met: true,
            approved: true,
            vetoed: false,
        }
    }

    fn create_rejected_result() -> VotingResult {
        VotingResult {
            total_weight: 10,
            approve_weight: 3,
            reject_weight: 7,
            abstain_weight: 0,
            quorum_met: true,
            approved: false,
            vetoed: false,
        }
    }

    fn create_vetoed_result() -> VotingResult {
        VotingResult {
            total_weight: 10,
            approve_weight: 6,
            reject_weight: 4,
            abstain_weight: 0,
            quorum_met: true,
            approved: true,
            vetoed: true,
        }
    }

    // === ExecutionState Tests ===

    #[test]
    fn test_execution_state_default() {
        let state: ExecutionState = Default::default();
        assert!(matches!(state, ExecutionState::Pending));
    }

    #[test]
    fn test_execution_state_can_execute() {
        assert!(!ExecutionState::Pending.can_execute());
        assert!(ExecutionState::ReadyForExecution.can_execute());
        assert!(!ExecutionState::InVetoWindow { deadline: 0 }.can_execute());
        assert!(!ExecutionState::AwaitingHumanApproval.can_execute());
        assert!(!ExecutionState::Executed {
            result: "".to_string()
        }
        .can_execute());
        assert!(!ExecutionState::Vetoed {
            by: "a.near".parse().unwrap()
        }
        .can_execute());
        assert!(!ExecutionState::Rejected.can_execute());
    }

    #[test]
    fn test_execution_state_is_terminal() {
        assert!(!ExecutionState::Pending.is_terminal());
        assert!(!ExecutionState::ReadyForExecution.is_terminal());
        assert!(!ExecutionState::InVetoWindow { deadline: 0 }.is_terminal());
        assert!(!ExecutionState::AwaitingHumanApproval.is_terminal());
        assert!(ExecutionState::Executed {
            result: "".to_string()
        }
        .is_terminal());
        assert!(ExecutionState::Vetoed {
            by: "a.near".parse().unwrap()
        }
        .is_terminal());
        assert!(ExecutionState::Rejected.is_terminal());
    }

    #[test]
    fn test_execution_state_can_veto() {
        assert!(!ExecutionState::Pending.can_veto());
        assert!(!ExecutionState::ReadyForExecution.can_veto());
        assert!(ExecutionState::InVetoWindow { deadline: 0 }.can_veto());
        assert!(!ExecutionState::AwaitingHumanApproval.can_veto());
    }

    #[test]
    fn test_execution_state_can_approve() {
        assert!(!ExecutionState::Pending.can_approve());
        assert!(!ExecutionState::ReadyForExecution.can_approve());
        assert!(!ExecutionState::InVetoWindow { deadline: 0 }.can_approve());
        assert!(ExecutionState::AwaitingHumanApproval.can_approve());
    }

    // === ExecutionConfig Tests ===

    #[test]
    fn test_execution_config_default() {
        let config: ExecutionConfig = Default::default();
        assert_eq!(config.veto_window_ns, 3_600_000_000_000); // 1 hour
        assert_eq!(config.execution_delay_ns, 0);
    }

    #[test]
    fn test_execution_config_with_veto_window() {
        let config = ExecutionConfig::with_veto_window(7_200_000_000_000); // 2 hours
        assert_eq!(config.veto_window_ns, 7_200_000_000_000);
        assert_eq!(config.execution_delay_ns, 0);
    }

    #[test]
    fn test_execution_config_new() {
        let config = ExecutionConfig::new(3600, 1000);
        assert_eq!(config.veto_window_ns, 3600);
        assert_eq!(config.execution_delay_ns, 1000);
    }

    // === Autonomous Flow Tests ===

    #[test]
    fn test_autonomous_flow_approved() {
        let owner: AccountId = "alice.near".parse().unwrap();
        let context = get_context(owner.clone());
        testing_env!(context.build());

        let mut executor = ProposalExecutor::new();
        let dao_id = "test-dao";
        let proposal_id = 1;

        let result = create_approved_result();
        let state = executor.process_voting_complete(
            dao_id,
            proposal_id,
            &result,
            AutonomyLevel::Autonomous,
        );

        // Should go directly to ReadyForExecution
        assert!(matches!(state, ExecutionState::ReadyForExecution));
        assert!(executor.is_ready_for_execution(dao_id, proposal_id));
    }

    #[test]
    fn test_autonomous_flow_rejected() {
        let owner: AccountId = "alice.near".parse().unwrap();
        let context = get_context(owner.clone());
        testing_env!(context.build());

        let mut executor = ProposalExecutor::new();
        let dao_id = "test-dao";
        let proposal_id = 1;

        let result = create_rejected_result();
        let state = executor.process_voting_complete(
            dao_id,
            proposal_id,
            &result,
            AutonomyLevel::Autonomous,
        );

        assert!(matches!(state, ExecutionState::Rejected));
    }

    #[test]
    fn test_autonomous_execute() {
        let owner: AccountId = "alice.near".parse().unwrap();
        let context = get_context(owner.clone());
        testing_env!(context.build());

        let mut executor = ProposalExecutor::new();
        let dao_id = "test-dao";
        let proposal_id = 1;

        // Set to ready for execution
        let result = create_approved_result();
        executor.process_voting_complete(dao_id, proposal_id, &result, AutonomyLevel::Autonomous);

        // Execute
        let exec_result = executor.execute_proposal(
            dao_id,
            proposal_id,
            &ProposalKind::Transfer,
            owner,
            None,
        );

        assert!(exec_result.is_ok());
        assert!(exec_result.unwrap().contains("Transfer executed"));

        // Should now be Executed
        let state = executor.get_execution_state(dao_id, proposal_id);
        assert!(matches!(state, ExecutionState::Executed { .. }));
    }

    // === SemiAutonomous Flow Tests ===

    #[test]
    fn test_semi_autonomous_flow_enters_veto_window() {
        let owner: AccountId = "alice.near".parse().unwrap();
        let context = get_context(owner.clone());
        testing_env!(context.build());

        let mut executor = ProposalExecutor::new();
        let dao_id = "test-dao";
        let proposal_id = 1;

        let result = create_approved_result();
        let state = executor.process_voting_complete(
            dao_id,
            proposal_id,
            &result,
            AutonomyLevel::SemiAutonomous,
        );

        // Should be in veto window
        assert!(matches!(state, ExecutionState::InVetoWindow { .. }));
        assert!(executor.is_in_veto_window(dao_id, proposal_id));
        assert!(!executor.is_ready_for_execution(dao_id, proposal_id));
    }

    #[test]
    fn test_semi_autonomous_veto_window_passes() {
        let owner: AccountId = "alice.near".parse().unwrap();

        // Create at time 1 second
        let mut context = get_context(owner.clone());
        context.block_timestamp(1_000_000_000);
        testing_env!(context.build());

        let mut executor = ProposalExecutor::new();
        let dao_id = "test-dao";
        let proposal_id = 1;

        // Set veto window to 1 second
        executor.set_config(dao_id, ExecutionConfig::with_veto_window(1_000_000_000));

        let result = create_approved_result();
        executor.process_voting_complete(dao_id, proposal_id, &result, AutonomyLevel::SemiAutonomous);

        // Check before window passes - still in veto window
        let state = executor.check_veto_window(dao_id, proposal_id);
        assert!(matches!(state, ExecutionState::InVetoWindow { .. }));

        // Advance time past veto window
        let mut context = get_context(owner.clone());
        context.block_timestamp(3_000_000_000); // 3 seconds
        testing_env!(context.build());

        // Check again - should transition to ReadyForExecution
        let state = executor.check_veto_window(dao_id, proposal_id);
        assert!(matches!(state, ExecutionState::ReadyForExecution));
        assert!(executor.is_ready_for_execution(dao_id, proposal_id));
    }

    #[test]
    fn test_semi_autonomous_veto_succeeds() {
        let owner: AccountId = "alice.near".parse().unwrap();
        let council: AccountId = "council.near".parse().unwrap();

        let mut context = get_context(owner.clone());
        context.block_timestamp(1_000_000_000);
        testing_env!(context.build());

        let mut executor = ProposalExecutor::new();
        let dao_id = "test-dao";
        let proposal_id = 1;

        // Set veto window to 1 hour
        executor.set_config(dao_id, ExecutionConfig::with_veto_window(3_600_000_000_000));

        let result = create_approved_result();
        executor.process_voting_complete(dao_id, proposal_id, &result, AutonomyLevel::SemiAutonomous);

        // Submit veto
        let veto_result = executor.submit_veto(dao_id, proposal_id, council.clone());

        assert!(veto_result.is_ok());
        let state = veto_result.unwrap();
        assert!(matches!(state, ExecutionState::Vetoed { by } if by == council));
    }

    #[test]
    fn test_semi_autonomous_veto_after_window_fails() {
        let owner: AccountId = "alice.near".parse().unwrap();
        let council: AccountId = "council.near".parse().unwrap();

        let mut context = get_context(owner.clone());
        context.block_timestamp(1_000_000_000);
        testing_env!(context.build());

        let mut executor = ProposalExecutor::new();
        let dao_id = "test-dao";
        let proposal_id = 1;

        // Set veto window to 1 second
        executor.set_config(dao_id, ExecutionConfig::with_veto_window(1_000_000_000));

        let result = create_approved_result();
        executor.process_voting_complete(dao_id, proposal_id, &result, AutonomyLevel::SemiAutonomous);

        // Advance past veto window
        let mut context = get_context(owner.clone());
        context.block_timestamp(3_000_000_000);
        testing_env!(context.build());

        // Veto should fail
        let veto_result = executor.submit_veto(dao_id, proposal_id, council);
        assert!(veto_result.is_err());
        assert!(veto_result.unwrap_err().contains("expired"));
    }

    #[test]
    fn test_semi_autonomous_remaining_veto_time() {
        let owner: AccountId = "alice.near".parse().unwrap();

        let mut context = get_context(owner.clone());
        context.block_timestamp(1_000_000_000);
        testing_env!(context.build());

        let mut executor = ProposalExecutor::new();
        let dao_id = "test-dao";
        let proposal_id = 1;

        // Set veto window to 2 seconds
        executor.set_config(dao_id, ExecutionConfig::with_veto_window(2_000_000_000));

        let result = create_approved_result();
        executor.process_voting_complete(dao_id, proposal_id, &result, AutonomyLevel::SemiAutonomous);

        // Remaining time should be ~2 seconds
        let remaining = executor.get_remaining_veto_time(dao_id, proposal_id);
        assert!(remaining > 1_900_000_000 && remaining <= 2_000_000_000);

        // Not in veto window - should be 0
        assert_eq!(executor.get_remaining_veto_time(dao_id, 999), 0);
    }

    // === NotAutonomous (Human-in-Loop) Flow Tests ===

    #[test]
    fn test_human_in_loop_flow_awaits_approval() {
        let owner: AccountId = "alice.near".parse().unwrap();
        let context = get_context(owner.clone());
        testing_env!(context.build());

        let mut executor = ProposalExecutor::new();
        let dao_id = "test-dao";
        let proposal_id = 1;

        let result = create_approved_result();
        let state = executor.process_voting_complete(
            dao_id,
            proposal_id,
            &result,
            AutonomyLevel::NotAutonomous,
        );

        assert!(matches!(state, ExecutionState::AwaitingHumanApproval));
        assert!(executor.is_awaiting_approval(dao_id, proposal_id));
        assert!(!executor.is_ready_for_execution(dao_id, proposal_id));
    }

    #[test]
    fn test_human_in_loop_approval_succeeds() {
        let owner: AccountId = "alice.near".parse().unwrap();
        let commander: AccountId = "commander.near".parse().unwrap();
        let context = get_context(owner.clone());
        testing_env!(context.build());

        let mut executor = ProposalExecutor::new();
        let dao_id = "test-dao";
        let proposal_id = 1;

        let result = create_approved_result();
        executor.process_voting_complete(
            dao_id,
            proposal_id,
            &result,
            AutonomyLevel::NotAutonomous,
        );

        // Submit human approval
        let approval_result = executor.submit_human_approval(dao_id, proposal_id, commander);

        assert!(approval_result.is_ok());
        assert!(matches!(
            approval_result.unwrap(),
            ExecutionState::ReadyForExecution
        ));
        assert!(executor.is_ready_for_execution(dao_id, proposal_id));
    }

    #[test]
    fn test_human_in_loop_approval_wrong_state_fails() {
        let owner: AccountId = "alice.near".parse().unwrap();
        let commander: AccountId = "commander.near".parse().unwrap();
        let context = get_context(owner.clone());
        testing_env!(context.build());

        let mut executor = ProposalExecutor::new();
        let dao_id = "test-dao";
        let proposal_id = 1;

        // Set to ReadyForExecution directly
        let result = create_approved_result();
        executor.process_voting_complete(dao_id, proposal_id, &result, AutonomyLevel::Autonomous);

        // Try to approve - should fail
        let approval_result = executor.submit_human_approval(dao_id, proposal_id, commander);
        assert!(approval_result.is_err());
    }

    // === Strike Authorization Tests ===

    #[test]
    fn test_strike_authorization_execution() {
        let owner: AccountId = "alice.near".parse().unwrap();
        let commander: AccountId = "commander.near".parse().unwrap();
        let context = get_context(owner.clone());
        testing_env!(context.build());

        let mut executor = ProposalExecutor::new();
        let dao_id = "test-dao";
        let proposal_id = 1;

        // StrikeAuthorization should be NotAutonomous
        let result = create_approved_result();
        executor.process_voting_complete(
            dao_id,
            proposal_id,
            &result,
            AutonomyLevel::NotAutonomous,
        );

        // Human approval
        executor.submit_human_approval(dao_id, proposal_id, commander.clone()).unwrap();

        // Execute with target
        let exec_result = executor.execute_proposal(
            dao_id,
            proposal_id,
            &ProposalKind::StrikeAuthorization,
            commander.clone(),
            Some("target-coordinates-xyz".to_string()),
        );

        assert!(exec_result.is_ok());
        let result_str = exec_result.unwrap();
        assert!(result_str.contains("Strike authorization"));
        assert!(result_str.contains("target-coordinates-xyz"));
        assert!(result_str.contains(&commander.to_string()));
    }

    // === Execution Tests ===

    #[test]
    fn test_execute_not_ready_fails() {
        let owner: AccountId = "alice.near".parse().unwrap();
        let context = get_context(owner.clone());
        testing_env!(context.build());

        let mut executor = ProposalExecutor::new();
        let dao_id = "test-dao";
        let proposal_id = 1;

        // Try to execute without processing voting
        let result = executor.execute_proposal(
            dao_id,
            proposal_id,
            &ProposalKind::Transfer,
            owner,
            None,
        );

        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Pending"));
    }

    #[test]
    fn test_execute_various_proposal_kinds() {
        let owner: AccountId = "alice.near".parse().unwrap();
        let context = get_context(owner.clone());
        testing_env!(context.build());

        let mut executor = ProposalExecutor::new();
        let dao_id = "test-dao";
        let voting_result = create_approved_result();

        let kinds = vec![
            (1, ProposalKind::ConfigChange, "Config change"),
            (2, ProposalKind::AddMember, "Member added"),
            (3, ProposalKind::RemoveMember, "Member removed"),
            (4, ProposalKind::Transfer, "Transfer executed"),
            (5, ProposalKind::FunctionCall, "Function call"),
            (6, ProposalKind::MissionOrder, "Mission order"),
            (7, ProposalKind::Custom("test".to_string()), "Custom proposal"),
        ];

        for (proposal_id, kind, expected_substr) in kinds {
            executor.process_voting_complete(
                dao_id,
                proposal_id,
                &voting_result,
                AutonomyLevel::Autonomous,
            );

            let result = executor.execute_proposal(
                dao_id,
                proposal_id,
                &kind,
                owner.clone(),
                None,
            );

            assert!(result.is_ok(), "Failed for kind {:?}", kind);
            assert!(
                result.unwrap().contains(expected_substr),
                "Missing expected text for kind {:?}",
                kind
            );
        }
    }

    // === Voting Result Processing Tests ===

    #[test]
    fn test_voting_vetoed_result_rejected() {
        let owner: AccountId = "alice.near".parse().unwrap();
        let context = get_context(owner.clone());
        testing_env!(context.build());

        let mut executor = ProposalExecutor::new();
        let dao_id = "test-dao";
        let proposal_id = 1;

        let result = create_vetoed_result();
        let state = executor.process_voting_complete(
            dao_id,
            proposal_id,
            &result,
            AutonomyLevel::Autonomous,
        );

        // Vetoed in voting should result in Rejected
        assert!(matches!(state, ExecutionState::Rejected));
    }

    #[test]
    fn test_quorum_not_met_rejected() {
        let owner: AccountId = "alice.near".parse().unwrap();
        let context = get_context(owner.clone());
        testing_env!(context.build());

        let mut executor = ProposalExecutor::new();
        let dao_id = "test-dao";
        let proposal_id = 1;

        let result = VotingResult {
            total_weight: 2,
            approve_weight: 2,
            reject_weight: 0,
            abstain_weight: 0,
            quorum_met: false,
            approved: true,
            vetoed: false,
        };

        let state = executor.process_voting_complete(
            dao_id,
            proposal_id,
            &result,
            AutonomyLevel::Autonomous,
        );

        assert!(matches!(state, ExecutionState::Rejected));
    }

    // === Config Tests ===

    #[test]
    fn test_config_management() {
        let owner: AccountId = "alice.near".parse().unwrap();
        let context = get_context(owner.clone());
        testing_env!(context.build());

        let mut executor = ProposalExecutor::new();
        let dao_id = "test-dao";

        // Default config
        let config = executor.get_config(dao_id);
        assert_eq!(config.veto_window_ns, 3_600_000_000_000);

        // Custom config
        let custom = ExecutionConfig::new(100, 200);
        executor.set_config(dao_id, custom);

        let config = executor.get_config(dao_id);
        assert_eq!(config.veto_window_ns, 100);
        assert_eq!(config.execution_delay_ns, 200);
    }

    #[test]
    fn test_executor_default() {
        let executor1 = ProposalExecutor::new();
        let executor2 = ProposalExecutor::default();

        // Both should work identically
        assert!(matches!(
            executor1.get_execution_state("dao", 1),
            ExecutionState::Pending
        ));
        assert!(matches!(
            executor2.get_execution_state("dao", 1),
            ExecutionState::Pending
        ));
    }

    // === Multiple Proposals Tests ===

    #[test]
    fn test_multiple_proposals_isolated() {
        let owner: AccountId = "alice.near".parse().unwrap();
        let context = get_context(owner.clone());
        testing_env!(context.build());

        let mut executor = ProposalExecutor::new();
        let dao_id = "test-dao";
        let voting_result = create_approved_result();

        // Process 3 proposals with different autonomy levels
        executor.process_voting_complete(dao_id, 1, &voting_result, AutonomyLevel::Autonomous);
        executor.process_voting_complete(dao_id, 2, &voting_result, AutonomyLevel::SemiAutonomous);
        executor.process_voting_complete(dao_id, 3, &voting_result, AutonomyLevel::NotAutonomous);

        // Verify isolation
        assert!(matches!(
            executor.get_execution_state(dao_id, 1),
            ExecutionState::ReadyForExecution
        ));
        assert!(matches!(
            executor.get_execution_state(dao_id, 2),
            ExecutionState::InVetoWindow { .. }
        ));
        assert!(matches!(
            executor.get_execution_state(dao_id, 3),
            ExecutionState::AwaitingHumanApproval
        ));
    }

    #[test]
    fn test_different_daos_isolated() {
        let owner: AccountId = "alice.near".parse().unwrap();
        let context = get_context(owner.clone());
        testing_env!(context.build());

        let mut executor = ProposalExecutor::new();
        let voting_result = create_approved_result();

        executor.process_voting_complete("dao-a", 1, &voting_result, AutonomyLevel::Autonomous);
        executor.process_voting_complete("dao-b", 1, &voting_result, AutonomyLevel::NotAutonomous);

        // Same proposal_id, different DAOs
        assert!(matches!(
            executor.get_execution_state("dao-a", 1),
            ExecutionState::ReadyForExecution
        ));
        assert!(matches!(
            executor.get_execution_state("dao-b", 1),
            ExecutionState::AwaitingHumanApproval
        ));
    }
}
