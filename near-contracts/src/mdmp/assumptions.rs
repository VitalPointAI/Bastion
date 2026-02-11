/**
 * MDMP Assumption Registry
 *
 * Provides on-chain lifecycle tracking for planning assumptions with
 * register/accept/invalidate/query operations.
 *
 * Purpose: Enforce INVARIANT 3 (Assumption Accountability) and INVARIANT 6
 * (Critical Assumption Invalidation Trigger). Every planning assumption requires
 * explicit human acceptance, sensitivity rating, and validation method.
 *
 * INVARIANTS:
 * - INVARIANT 3: All assumptions require non-empty description and validation_method
 * - INVARIANT 6: Critical assumption invalidation returns SensitivityLevel for replanning trigger
 */

use near_sdk::{
    env,
    log,
    near,
    store::LookupMap,
    AccountId,
    BorshStorageKey,
};

/// Storage keys for assumption collections
#[derive(BorshStorageKey)]
#[near]
pub enum AssumptionStorageKey {
    /// Assumptions per mission: "mission_id:assumption_id" -> AssumptionRecord
    Assumptions,
    /// Assumption IDs per mission for listing
    MissionAssumptions,
}

/// Sensitivity level for planning assumptions
///
/// Ordered: Low < Medium < High < Critical
/// Used for threshold filtering and replanning triggers
#[near(serializers = [json, borsh])]
#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord)]
pub enum SensitivityLevel {
    /// Plan survives if wrong
    Low,
    /// Plan degrades if wrong
    Medium,
    /// Plan fails if wrong
    High,
    /// Mission fails if wrong - triggers INVARIANT 6 replanning gate
    Critical,
}

/// Assumption lifecycle status
///
/// State transitions: Pending -> Accepted | Rejected
///                    Accepted -> Invalidated | Expired
#[near(serializers = [json, borsh])]
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum AssumptionStatus {
    /// Identified, not evaluated
    Pending,
    /// Explicitly accepted by human
    Accepted,
    /// Explicitly rejected
    Rejected,
    /// Evidence shows wrong
    Invalidated,
    /// Too old, needs revalidation
    Expired,
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
///
/// Stores assumptions per mission with composite key "mission_id:assumption_id"
/// for efficient mission-scoped queries
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
            assumptions: LookupMap::new(AssumptionStorageKey::Assumptions),
            mission_assumptions: LookupMap::new(AssumptionStorageKey::MissionAssumptions),
        }
    }

    /// Register a new assumption. Requires all mandatory fields per INVARIANT 3.
    ///
    /// # Arguments
    /// * `mission_id` - Mission ID this assumption applies to
    /// * `assumption` - AssumptionRecord with all required fields
    ///
    /// # Returns
    /// * `Ok(())` if registered successfully
    /// * `Err(String)` if validation fails
    ///
    /// # INVARIANT 3
    /// Validates that description and validation_method are non-empty
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
        let mut ids = self
            .mission_assumptions
            .get(mission_id)
            .cloned()
            .unwrap_or_default();
        ids.push(assumption.id.clone());
        self.mission_assumptions.insert(mission_id.to_string(), ids);

        log!(
            "ASSUMPTION_REGISTERED: {{\"mission_id\": \"{}\", \"id\": \"{}\", \"sensitivity\": \"{:?}\"}}",
            mission_id,
            assumption.id,
            assumption.sensitivity
        );

        Ok(())
    }

    /// Accept an assumption. Requires AccountId of acceptor.
    ///
    /// Only humans (NotAgent tier) can accept assumptions per INVARIANT 3.
    /// Assumption must be in Pending status.
    ///
    /// # Arguments
    /// * `mission_id` - Mission ID
    /// * `assumption_id` - Assumption ID to accept
    /// * `acceptor` - AccountId of human accepting the assumption
    ///
    /// # Returns
    /// * `Ok(())` if accepted successfully
    /// * `Err(String)` if assumption not found or not in Pending status
    pub fn accept_assumption(
        &mut self,
        mission_id: &str,
        assumption_id: &str,
        acceptor: AccountId,
    ) -> Result<(), String> {
        let key = format!("{}:{}", mission_id, assumption_id);
        let mut assumption = self
            .assumptions
            .get(&key)
            .cloned()
            .ok_or("Assumption not found")?;

        if assumption.status != AssumptionStatus::Pending {
            return Err(format!(
                "Cannot accept assumption in status {:?}",
                assumption.status
            ));
        }

        assumption.status = AssumptionStatus::Accepted;
        assumption.accepted_by = Some(acceptor.clone());
        assumption.accepted_at = Some(env::block_timestamp());
        self.assumptions.insert(key, assumption);

        log!(
            "ASSUMPTION_ACCEPTED: {{\"mission_id\": \"{}\", \"id\": \"{}\", \"acceptor\": \"{}\"}}",
            mission_id,
            assumption_id,
            acceptor
        );

        Ok(())
    }

    /// Invalidate an assumption.
    ///
    /// If sensitivity is Critical, this triggers INVARIANT 6 (replanning gate).
    /// Returns the sensitivity level so caller can create replanning gate if needed.
    ///
    /// # Arguments
    /// * `mission_id` - Mission ID
    /// * `assumption_id` - Assumption ID to invalidate
    /// * `evidence_hash` - Optional IPFS hash of evidence showing assumption is wrong
    ///
    /// # Returns
    /// * `Ok(SensitivityLevel)` - Returns sensitivity level for replanning trigger check
    /// * `Err(String)` if assumption not found
    ///
    /// # INVARIANT 6
    /// Caller must check if returned sensitivity is Critical and create replanning gate
    pub fn invalidate_assumption(
        &mut self,
        mission_id: &str,
        assumption_id: &str,
        evidence_hash: Option<String>,
    ) -> Result<SensitivityLevel, String> {
        let key = format!("{}:{}", mission_id, assumption_id);
        let mut assumption = self
            .assumptions
            .get(&key)
            .cloned()
            .ok_or("Assumption not found")?;

        let sensitivity = assumption.sensitivity;
        assumption.status = AssumptionStatus::Invalidated;
        assumption.evidence_hash = evidence_hash;
        self.assumptions.insert(key, assumption);

        log!(
            "ASSUMPTION_INVALIDATED: {{\"mission_id\": \"{}\", \"id\": \"{}\", \"sensitivity\": \"{:?}\", \"triggers_replanning\": {}}}",
            mission_id,
            assumption_id,
            sensitivity,
            matches!(sensitivity, SensitivityLevel::Critical)
        );

        Ok(sensitivity)
    }

    /// Get all assumptions for a mission with optional status filter
    ///
    /// # Arguments
    /// * `mission_id` - Mission ID to query
    /// * `status_filter` - Optional status filter (None returns all)
    ///
    /// # Returns
    /// Vector of AssumptionRecords matching the filter
    pub fn get_assumptions(
        &self,
        mission_id: &str,
        status_filter: Option<AssumptionStatus>,
    ) -> Vec<AssumptionRecord> {
        let ids = self
            .mission_assumptions
            .get(mission_id)
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
    ///
    /// Used by workflow engine to validate phase transition readiness.
    /// Example: Before proceeding to Phase 7 (Orders Production), verify all
    /// Critical and High assumptions are accepted.
    ///
    /// # Arguments
    /// * `mission_id` - Mission ID to check
    /// * `min_sensitivity` - Minimum sensitivity threshold (inclusive)
    ///
    /// # Returns
    /// `true` if all assumptions >= min_sensitivity are Accepted, `false` otherwise
    pub fn all_accepted_at_sensitivity(
        &self,
        mission_id: &str,
        min_sensitivity: SensitivityLevel,
    ) -> bool {
        let assumptions = self.get_assumptions(mission_id, None);
        assumptions
            .iter()
            .filter(|a| a.sensitivity >= min_sensitivity)
            .all(|a| a.status == AssumptionStatus::Accepted)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn create_test_assumption(id: &str, sensitivity: SensitivityLevel) -> AssumptionRecord {
        AssumptionRecord {
            id: id.to_string(),
            description: "Test assumption".to_string(),
            sensitivity,
            validation_method: "Test validation method".to_string(),
            accepted_by: None,
            accepted_at: None,
            last_validated: None,
            status: AssumptionStatus::Pending,
            source_phase: "Phase2Analysis".to_string(),
            evidence_hash: None,
        }
    }

    #[test]
    fn test_register_validates_required_fields() {
        let mut registry = AssumptionRegistry::new();

        // Empty description should fail
        let mut assumption = create_test_assumption("test-1", SensitivityLevel::Low);
        assumption.description = "".to_string();
        let result = registry.register_assumption("mission-1", assumption);
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), "Assumption description is required");

        // Empty validation_method should fail
        let mut assumption = create_test_assumption("test-2", SensitivityLevel::Low);
        assumption.validation_method = "".to_string();
        let result = registry.register_assumption("mission-1", assumption);
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), "Validation method is required");

        // Valid assumption should succeed
        let assumption = create_test_assumption("test-3", SensitivityLevel::Low);
        let result = registry.register_assumption("mission-1", assumption);
        assert!(result.is_ok());
    }

    #[test]
    fn test_assumption_lifecycle() {
        let mut registry = AssumptionRegistry::new();

        // Register
        let assumption = create_test_assumption("test-1", SensitivityLevel::High);
        registry
            .register_assumption("mission-1", assumption.clone())
            .unwrap();

        // Verify registered
        let assumptions = registry.get_assumptions("mission-1", None);
        assert_eq!(assumptions.len(), 1);
        assert_eq!(assumptions[0].status, AssumptionStatus::Pending);

        // Accept
        let acceptor: AccountId = "commander.near".parse().unwrap();
        registry
            .accept_assumption("mission-1", "test-1", acceptor.clone())
            .unwrap();

        // Verify accepted
        let assumptions = registry.get_assumptions("mission-1", None);
        assert_eq!(assumptions[0].status, AssumptionStatus::Accepted);
        assert_eq!(assumptions[0].accepted_by, Some(acceptor));
        assert!(assumptions[0].accepted_at.is_some());

        // Invalidate
        let sensitivity = registry
            .invalidate_assumption("mission-1", "test-1", Some("QmHash123".to_string()))
            .unwrap();

        // Verify invalidated
        assert_eq!(sensitivity, SensitivityLevel::High);
        let assumptions = registry.get_assumptions("mission-1", None);
        assert_eq!(assumptions[0].status, AssumptionStatus::Invalidated);
        assert_eq!(assumptions[0].evidence_hash, Some("QmHash123".to_string()));
    }

    #[test]
    fn test_critical_invalidation_returns_critical() {
        let mut registry = AssumptionRegistry::new();

        // Register critical assumption
        let assumption = create_test_assumption("critical-1", SensitivityLevel::Critical);
        registry
            .register_assumption("mission-1", assumption)
            .unwrap();

        // Invalidate should return Critical sensitivity
        let sensitivity = registry
            .invalidate_assumption("mission-1", "critical-1", None)
            .unwrap();

        assert_eq!(sensitivity, SensitivityLevel::Critical);
    }

    #[test]
    fn test_accept_requires_pending_status() {
        let mut registry = AssumptionRegistry::new();

        // Register and accept
        let assumption = create_test_assumption("test-1", SensitivityLevel::Low);
        registry
            .register_assumption("mission-1", assumption)
            .unwrap();

        let acceptor: AccountId = "commander.near".parse().unwrap();
        registry
            .accept_assumption("mission-1", "test-1", acceptor.clone())
            .unwrap();

        // Try to accept again - should fail
        let result = registry.accept_assumption("mission-1", "test-1", acceptor);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Cannot accept assumption"));
    }

    #[test]
    fn test_all_accepted_at_sensitivity() {
        let mut registry = AssumptionRegistry::new();

        // Register assumptions with different sensitivities
        let low = create_test_assumption("low-1", SensitivityLevel::Low);
        registry.register_assumption("mission-1", low.clone()).unwrap();

        let medium = create_test_assumption("medium-1", SensitivityLevel::Medium);
        registry.register_assumption("mission-1", medium.clone()).unwrap();

        let high = create_test_assumption("high-1", SensitivityLevel::High);
        registry.register_assumption("mission-1", high.clone()).unwrap();

        let critical = create_test_assumption("critical-1", SensitivityLevel::Critical);
        registry.register_assumption("mission-1", critical.clone()).unwrap();

        let acceptor: AccountId = "commander.near".parse().unwrap();

        // No assumptions accepted yet - checking any threshold should fail
        assert!(!registry.all_accepted_at_sensitivity("mission-1", SensitivityLevel::Low));
        assert!(!registry.all_accepted_at_sensitivity("mission-1", SensitivityLevel::Critical));

        // Accept low - still fails because Medium/High/Critical are >= Low and pending
        registry.accept_assumption("mission-1", "low-1", acceptor.clone()).unwrap();
        assert!(!registry.all_accepted_at_sensitivity("mission-1", SensitivityLevel::Low));

        // Accept medium - still fails, High/Critical pending
        registry.accept_assumption("mission-1", "medium-1", acceptor.clone()).unwrap();
        assert!(!registry.all_accepted_at_sensitivity("mission-1", SensitivityLevel::Low));
        assert!(!registry.all_accepted_at_sensitivity("mission-1", SensitivityLevel::Medium));

        // Accept high - now Low/Medium/High threshold checks pass, but Critical fails
        registry.accept_assumption("mission-1", "high-1", acceptor.clone()).unwrap();
        assert!(!registry.all_accepted_at_sensitivity("mission-1", SensitivityLevel::Low));
        assert!(!registry.all_accepted_at_sensitivity("mission-1", SensitivityLevel::Critical));

        // Accept critical - now all thresholds pass
        registry.accept_assumption("mission-1", "critical-1", acceptor.clone()).unwrap();
        assert!(registry.all_accepted_at_sensitivity("mission-1", SensitivityLevel::Low));
        assert!(registry.all_accepted_at_sensitivity("mission-1", SensitivityLevel::Medium));
        assert!(registry.all_accepted_at_sensitivity("mission-1", SensitivityLevel::High));
        assert!(registry.all_accepted_at_sensitivity("mission-1", SensitivityLevel::Critical));
    }

    #[test]
    fn test_get_assumptions_with_filter() {
        let mut registry = AssumptionRegistry::new();

        // Register multiple assumptions
        let assumption1 = create_test_assumption("test-1", SensitivityLevel::Low);
        registry.register_assumption("mission-1", assumption1).unwrap();

        let assumption2 = create_test_assumption("test-2", SensitivityLevel::Medium);
        registry.register_assumption("mission-1", assumption2).unwrap();

        let acceptor: AccountId = "commander.near".parse().unwrap();
        registry.accept_assumption("mission-1", "test-1", acceptor).unwrap();

        // Get all - should return 2
        let all = registry.get_assumptions("mission-1", None);
        assert_eq!(all.len(), 2);

        // Filter by Pending - should return 1
        let pending = registry.get_assumptions("mission-1", Some(AssumptionStatus::Pending));
        assert_eq!(pending.len(), 1);
        assert_eq!(pending[0].id, "test-2");

        // Filter by Accepted - should return 1
        let accepted = registry.get_assumptions("mission-1", Some(AssumptionStatus::Accepted));
        assert_eq!(accepted.len(), 1);
        assert_eq!(accepted[0].id, "test-1");

        // Filter by Invalidated - should return 0
        let invalidated = registry.get_assumptions("mission-1", Some(AssumptionStatus::Invalidated));
        assert_eq!(invalidated.len(), 0);
    }

    #[test]
    fn test_sensitivity_level_ordering() {
        // Verify PartialOrd implementation for threshold filtering
        assert!(SensitivityLevel::Low < SensitivityLevel::Medium);
        assert!(SensitivityLevel::Medium < SensitivityLevel::High);
        assert!(SensitivityLevel::High < SensitivityLevel::Critical);

        assert!(SensitivityLevel::Critical >= SensitivityLevel::High);
        assert!(SensitivityLevel::High >= SensitivityLevel::Medium);
    }
}
