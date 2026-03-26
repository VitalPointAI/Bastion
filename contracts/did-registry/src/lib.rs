use near_sdk::borsh::{BorshDeserialize, BorshSerialize};
use near_sdk::store::LookupMap;
use near_sdk::serde::{Deserialize, Serialize};
use near_sdk::{env, near, AccountId, BorshStorageKey, PanicOnDefault};
use schemars::JsonSchema;

/// Storage keys for collections
#[derive(BorshStorageKey, BorshDeserialize, BorshSerialize)]
enum StorageKey {
    Dids,
}

/// On-chain encrypted DID entry
#[derive(BorshDeserialize, BorshSerialize, Serialize, Deserialize, Clone, JsonSchema)]
#[serde(crate = "near_sdk::serde")]
#[borsh(crate = "near_sdk::borsh")]
pub struct DIDEntry {
    pub encrypted_document: Vec<u8>,
    pub encrypted_entity_type: Vec<u8>,
    pub nonce: Vec<u8>,
    pub entity_type_nonce: Vec<u8>,
    #[schemars(with = "String")]
    pub owner: AccountId,
    pub created_at: u64,
    pub updated_at: u64,
    pub active: bool,
}

#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct DIDRegistry {
    dids: LookupMap<String, DIDEntry>,
    admin: AccountId,
    paused: bool,
}

#[near]
impl DIDRegistry {
    #[init]
    pub fn new(admin: AccountId) -> Self {
        assert!(!env::state_exists(), "Already initialized");
        Self {
            dids: LookupMap::new(StorageKey::Dids),
            admin,
            paused: false,
        }
    }

    // ========================================================================
    // Write methods
    // ========================================================================

    /// Store a new encrypted DID document. Only callable by the DID owner.
    #[payable]
    pub fn store_did(
        &mut self,
        blinded_key: Vec<u8>,
        encrypted_document: Vec<u8>,
        encrypted_entity_type: Vec<u8>,
        nonce: Vec<u8>,
        entity_type_nonce: Option<Vec<u8>>,
    ) {
        self.assert_not_paused();
        assert!(blinded_key.len() == 32, "Blinded key must be 32 bytes");
        assert!(!encrypted_document.is_empty(), "encrypted_document cannot be empty");
        assert!(nonce.len() == 12, "nonce must be 12 bytes");

        let key_hex = hex_encode(&blinded_key);
        let caller = env::predecessor_account_id();
        let now = env::block_timestamp();

        // Only the original owner can update an existing DID
        if let Some(existing) = self.dids.get(&key_hex) {
            assert_eq!(existing.owner, caller, "Only the DID owner can update this entry");
        }

        let et_nonce = entity_type_nonce.unwrap_or_else(|| nonce.clone());
        assert!(et_nonce.len() == 12, "entity_type_nonce must be 12 bytes");

        let created_at = self.dids.get(&key_hex).map(|e| e.created_at).unwrap_or(now);

        let storage_before = env::storage_usage();

        let entry = DIDEntry {
            encrypted_document,
            encrypted_entity_type,
            nonce,
            entity_type_nonce: et_nonce,
            owner: caller,
            created_at,
            updated_at: now,
            active: true,
        };

        self.dids.insert(key_hex, entry);

        // Refund excess deposit or panic if insufficient
        let storage_after = env::storage_usage();
        if storage_after > storage_before {
            let storage_cost = (storage_after - storage_before) as u128
                * env::storage_byte_cost().as_yoctonear();
            let deposit = env::attached_deposit().as_yoctonear();
            assert!(
                deposit >= storage_cost,
                "Insufficient storage deposit. Need {} yoctoNEAR, got {}",
                storage_cost, deposit
            );
        }
    }

    /// Deactivate a DID. Only callable by the DID owner or admin.
    pub fn deactivate_did(&mut self, blinded_key: Vec<u8>) {
        self.assert_not_paused();
        let key_hex = hex_encode(&blinded_key);
        let caller = env::predecessor_account_id();

        let mut entry = self.dids.get(&key_hex)
            .unwrap_or_else(|| env::panic_str("DID not found"))
            .clone();

        assert!(
            entry.owner == caller || caller == self.admin,
            "Only the DID owner or admin can deactivate"
        );

        entry.active = false;
        entry.updated_at = env::block_timestamp();
        self.dids.insert(key_hex, entry);
    }

    // ========================================================================
    // View methods
    // ========================================================================

    pub fn get_did(&self, blinded_key: Vec<u8>) -> Option<DIDEntry> {
        let key_hex = hex_encode(&blinded_key);
        self.dids.get(&key_hex).cloned()
    }

    pub fn is_did_active(&self, blinded_key: Vec<u8>) -> bool {
        let key_hex = hex_encode(&blinded_key);
        self.dids.get(&key_hex).map(|e| e.active).unwrap_or(false)
    }

    pub fn get_admin(&self) -> AccountId {
        self.admin.clone()
    }

    pub fn is_paused(&self) -> bool {
        self.paused
    }

    // ========================================================================
    // Admin methods
    // ========================================================================

    pub fn pause(&mut self) {
        self.assert_admin();
        self.paused = true;
    }

    pub fn unpause(&mut self) {
        self.assert_admin();
        self.paused = false;
    }

    pub fn set_admin(&mut self, new_admin: AccountId) {
        self.assert_admin();
        self.admin = new_admin;
    }

    pub fn admin_deactivate_did(&mut self, blinded_key: Vec<u8>) {
        self.assert_admin();
        let key_hex = hex_encode(&blinded_key);

        let mut entry = self.dids.get(&key_hex)
            .unwrap_or_else(|| env::panic_str("DID not found"))
            .clone();

        entry.active = false;
        entry.updated_at = env::block_timestamp();
        self.dids.insert(key_hex, entry);
    }

    // ========================================================================
    // Internal helpers
    // ========================================================================

    fn assert_admin(&self) {
        assert_eq!(env::predecessor_account_id(), self.admin, "Only admin can call this method");
    }

    fn assert_not_paused(&self) {
        assert!(!self.paused, "Contract is paused");
    }
}

fn hex_encode(bytes: &[u8]) -> String {
    bytes.iter().map(|b| format!("{:02x}", b)).collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use near_sdk::test_utils::VMContextBuilder;
    use near_sdk::testing_env;
    use near_sdk::NearToken;

    fn setup_context(predecessor: &str) -> VMContextBuilder {
        let mut builder = VMContextBuilder::new();
        builder.predecessor_account_id(predecessor.parse().unwrap());
        builder.attached_deposit(NearToken::from_millinear(50));
        builder
    }

    fn make_blinded_key(seed: u8) -> Vec<u8> {
        vec![seed; 32]
    }

    fn store_did_for(contract: &mut DIDRegistry, key: Vec<u8>) {
        contract.store_did(
            key,
            vec![10u8; 100],
            vec![20u8; 16],
            vec![30u8; 12],
            Some(vec![40u8; 12]),
        );
    }

    fn make_caveats(caller: &str) -> ResourceCaveats {
        ResourceCaveats {
            classification: "SECRET".to_string(),
            releasability: vec!["USA".to_string(), "GBR".to_string()],
            geo_bounds: Some(GeoBounds {
                north: 40_000_000,
                south: 30_000_000,
                east: 120_000_000,
                west: 100_000_000,
            }),
            roe_tier: 2,
            time_windows: vec![TimeWindow {
                start_ms: 2_000_000_000_000,
                end_ms: 3_000_000_000_000,
            }],
            employment_constraints: vec!["CONSTRAINT_A".to_string()],
            updated_by: caller.parse().unwrap(),
            updated_at: 0,
        }
    }

    // ========================================================================
    // Existing tests
    // ========================================================================

    #[test]
    fn test_store_and_get_did() {
        let ctx = setup_context("alice.testnet");
        testing_env!(ctx.build());

        let mut contract = DIDRegistry::new("admin.testnet".parse().unwrap());

        let blinded_key = vec![1u8; 32];
        let doc = vec![10u8; 100];
        let entity = vec![20u8; 16];
        let nonce = vec![30u8; 12];
        let et_nonce = vec![40u8; 12];

        contract.store_did(blinded_key.clone(), doc.clone(), entity.clone(), nonce.clone(), Some(et_nonce.clone()));

        let entry = contract.get_did(blinded_key).unwrap();
        assert_eq!(entry.encrypted_document, doc);
        assert_eq!(entry.nonce, nonce);
        assert_eq!(entry.entity_type_nonce, et_nonce);
        assert!(entry.active);
    }

    #[test]
    fn test_deactivate_did() {
        let ctx = setup_context("alice.testnet");
        testing_env!(ctx.build());

        let mut contract = DIDRegistry::new("admin.testnet".parse().unwrap());
        let key = vec![3u8; 32];

        contract.store_did(key.clone(), vec![10u8; 50], vec![20u8; 10], vec![30u8; 12], None);
        contract.deactivate_did(key.clone());
        assert!(!contract.is_did_active(key));
    }

    #[test]
    #[should_panic(expected = "Only the DID owner can update")]
    fn test_cannot_update_others_did() {
        let mut ctx = setup_context("alice.testnet");
        testing_env!(ctx.build());

        let mut contract = DIDRegistry::new("admin.testnet".parse().unwrap());
        let key = vec![4u8; 32];
        contract.store_did(key.clone(), vec![10u8; 50], vec![20u8; 10], vec![30u8; 12], None);

        ctx.predecessor_account_id("bob.testnet".parse().unwrap());
        testing_env!(ctx.build());
        contract.store_did(key, vec![99u8; 50], vec![99u8; 10], vec![99u8; 12], None);
    }

    #[test]
    #[should_panic(expected = "Contract is paused")]
    fn test_paused_blocks_writes() {
        let mut ctx = setup_context("admin.testnet");
        testing_env!(ctx.build());

        let mut contract = DIDRegistry::new("admin.testnet".parse().unwrap());
        contract.pause();

        ctx.predecessor_account_id("alice.testnet".parse().unwrap());
        testing_env!(ctx.build());
        contract.store_did(vec![6u8; 32], vec![10u8; 50], vec![20u8; 10], vec![30u8; 12], None);
    }

    // ========================================================================
    // New caveat tests (RED phase -- will fail until implementation)
    // ========================================================================

    #[test]
    fn test_store_and_retrieve_caveats() {
        let ctx = setup_context("alice.testnet");
        testing_env!(ctx.build());

        let mut contract = DIDRegistry::new("admin.testnet".parse().unwrap());
        let key = make_blinded_key(0xA0);
        store_did_for(&mut contract, key.clone());

        let caveats = make_caveats("alice.testnet");
        contract.update_resource_caveats(key.clone(), caveats.clone());

        let retrieved = contract.get_caveats(key).unwrap();
        assert_eq!(retrieved.classification, "SECRET");
        assert_eq!(retrieved.roe_tier, 2);
        assert_eq!(retrieved.releasability, vec!["USA", "GBR"]);
    }

    #[test]
    fn test_check_employment_no_caveats() {
        let ctx = setup_context("alice.testnet");
        testing_env!(ctx.build());

        let mut contract = DIDRegistry::new("admin.testnet".parse().unwrap());
        let key = make_blinded_key(0xA1);
        store_did_for(&mut contract, key.clone());

        // No caveats stored -- should be authorized by default
        let context = EmploymentContext {
            requesting_account: "alice.testnet".to_string(),
            location: None,
            timestamp_ms: 1_000_000_000,
            roe_tier_required: 3,
            nation_code: Some("CHN".to_string()),
        };

        let result = contract.check_employment_authorized(key, context);
        assert!(result.authorized, "Should be authorized when no caveats exist");
        assert!(result.reasons.is_empty());
    }

    #[test]
    fn test_check_employment_roe_tier_exceeded() {
        let ctx = setup_context("alice.testnet");
        testing_env!(ctx.build());

        let mut contract = DIDRegistry::new("admin.testnet".parse().unwrap());
        let key = make_blinded_key(0xA2);
        store_did_for(&mut contract, key.clone());

        let mut caveats = make_caveats("alice.testnet");
        caveats.roe_tier = 2;
        caveats.time_windows = vec![]; // no time constraint
        caveats.releasability = vec![]; // no releasability constraint
        caveats.geo_bounds = None; // no geo constraint
        contract.update_resource_caveats(key.clone(), caveats);

        let context = EmploymentContext {
            requesting_account: "alice.testnet".to_string(),
            location: None,
            timestamp_ms: 1_000_000_000,
            roe_tier_required: 3, // exceeds roe_tier=2
            nation_code: None,
        };

        let result = contract.check_employment_authorized(key, context);
        assert!(!result.authorized, "Should be denied when ROE tier exceeded");
        assert!(!result.reasons.is_empty());
    }

    #[test]
    fn test_check_employment_time_window() {
        let ctx = setup_context("alice.testnet");
        testing_env!(ctx.build());

        let mut contract = DIDRegistry::new("admin.testnet".parse().unwrap());
        let key = make_blinded_key(0xA3);
        store_did_for(&mut contract, key.clone());

        let mut caveats = make_caveats("alice.testnet");
        // Future window: 2_000_000_000_000ms to 3_000_000_000_000ms
        caveats.time_windows = vec![TimeWindow {
            start_ms: 2_000_000_000_000,
            end_ms: 3_000_000_000_000,
        }];
        caveats.roe_tier = 5; // no ROE constraint
        caveats.releasability = vec![]; // no releasability constraint
        caveats.geo_bounds = None;
        contract.update_resource_caveats(key.clone(), caveats);

        let context = EmploymentContext {
            requesting_account: "alice.testnet".to_string(),
            location: None,
            timestamp_ms: 1_000_000_000, // before the window
            roe_tier_required: 1,
            nation_code: None,
        };

        let result = contract.check_employment_authorized(key, context);
        assert!(!result.authorized, "Should be denied when outside time window");
        assert!(!result.reasons.is_empty());
    }

    #[test]
    fn test_check_employment_releasability() {
        let ctx = setup_context("alice.testnet");
        testing_env!(ctx.build());

        let mut contract = DIDRegistry::new("admin.testnet".parse().unwrap());
        let key = make_blinded_key(0xA4);
        store_did_for(&mut contract, key.clone());

        let mut caveats = make_caveats("alice.testnet");
        caveats.releasability = vec!["USA".to_string(), "GBR".to_string()];
        caveats.roe_tier = 5;
        caveats.time_windows = vec![];
        caveats.geo_bounds = None;
        contract.update_resource_caveats(key.clone(), caveats);

        let context = EmploymentContext {
            requesting_account: "chn.user".to_string(),
            location: None,
            timestamp_ms: 1_000_000_000,
            roe_tier_required: 1,
            nation_code: Some("CHN".to_string()), // not in ["USA", "GBR"]
        };

        let result = contract.check_employment_authorized(key, context);
        assert!(!result.authorized, "Should be denied for wrong nation releasability");
        assert!(!result.reasons.is_empty());
    }

    #[test]
    fn test_check_employment_geo_bounds() {
        let ctx = setup_context("alice.testnet");
        testing_env!(ctx.build());

        let mut contract = DIDRegistry::new("admin.testnet".parse().unwrap());
        let key = make_blinded_key(0xA5);
        store_did_for(&mut contract, key.clone());

        let mut caveats = make_caveats("alice.testnet");
        caveats.geo_bounds = Some(GeoBounds {
            north: 40_000_000,
            south: 30_000_000,
            east: 120_000_000,
            west: 100_000_000,
        });
        caveats.roe_tier = 5;
        caveats.time_windows = vec![];
        caveats.releasability = vec![];
        contract.update_resource_caveats(key.clone(), caveats);

        let context = EmploymentContext {
            requesting_account: "alice.testnet".to_string(),
            location: Some(GeoBounds {
                north: 10_000_000, // outside the bounds
                south: 5_000_000,
                east: 50_000_000,
                west: 40_000_000,
            }),
            timestamp_ms: 1_000_000_000,
            roe_tier_required: 1,
            nation_code: None,
        };

        let result = contract.check_employment_authorized(key, context);
        assert!(!result.authorized, "Should be denied for out-of-bounds location");
        assert!(!result.reasons.is_empty());
    }

    #[test]
    fn test_check_employment_all_pass() {
        let ctx = setup_context("alice.testnet");
        testing_env!(ctx.build());

        let mut contract = DIDRegistry::new("admin.testnet".parse().unwrap());
        let key = make_blinded_key(0xA6);
        store_did_for(&mut contract, key.clone());

        let mut caveats = make_caveats("alice.testnet");
        caveats.roe_tier = 3;
        caveats.releasability = vec!["USA".to_string()];
        caveats.time_windows = vec![TimeWindow {
            start_ms: 1_000_000_000,
            end_ms: 9_000_000_000_000,
        }];
        caveats.geo_bounds = Some(GeoBounds {
            north: 50_000_000,
            south: 20_000_000,
            east: 130_000_000,
            west: 90_000_000,
        });
        contract.update_resource_caveats(key.clone(), caveats);

        let context = EmploymentContext {
            requesting_account: "alice.testnet".to_string(),
            location: Some(GeoBounds {
                // Location center point (both north and south same lat -- checking containment)
                north: 35_000_000, // inside bounds (20-50)
                south: 35_000_000,
                east: 115_000_000, // inside bounds (90-130)
                west: 115_000_000,
            }),
            timestamp_ms: 5_000_000_000, // inside window
            roe_tier_required: 2, // within roe_tier=3
            nation_code: Some("USA".to_string()), // in releasability list
        };

        let result = contract.check_employment_authorized(key, context);
        assert!(result.authorized, "Should be authorized when all constraints satisfied. Reasons: {:?}", result.reasons);
        assert!(result.reasons.is_empty());
    }

    #[test]
    #[should_panic(expected = "Only DID owner or admin can update caveats")]
    fn test_update_caveats_unauthorized() {
        let mut ctx = setup_context("alice.testnet");
        testing_env!(ctx.build());

        let mut contract = DIDRegistry::new("admin.testnet".parse().unwrap());
        let key = make_blinded_key(0xA7);
        store_did_for(&mut contract, key.clone());

        // Bob tries to update alice's DID caveats
        ctx.predecessor_account_id("bob.testnet".parse().unwrap());
        testing_env!(ctx.build());
        contract.update_resource_caveats(key, make_caveats("bob.testnet"));
    }

    #[test]
    fn test_update_caveats_admin() {
        let mut ctx = setup_context("alice.testnet");
        testing_env!(ctx.build());

        let mut contract = DIDRegistry::new("admin.testnet".parse().unwrap());
        let key = make_blinded_key(0xA8);
        store_did_for(&mut contract, key.clone());

        // Admin updates alice's DID caveats -- should succeed
        ctx.predecessor_account_id("admin.testnet".parse().unwrap());
        testing_env!(ctx.build());
        contract.update_resource_caveats(key.clone(), make_caveats("admin.testnet"));

        let retrieved = contract.get_caveats(key).unwrap();
        assert_eq!(retrieved.classification, "SECRET");
    }

    #[test]
    fn test_existing_did_unaffected() {
        let ctx = setup_context("alice.testnet");
        testing_env!(ctx.build());

        let mut contract = DIDRegistry::new("admin.testnet".parse().unwrap());
        let key = make_blinded_key(0xA9);

        let doc = vec![0xBBu8; 100];
        let entity = vec![0xCCu8; 16];
        let nonce = vec![0xDDu8; 12];
        let et_nonce = vec![0xEEu8; 12];

        contract.store_did(key.clone(), doc.clone(), entity.clone(), nonce.clone(), Some(et_nonce.clone()));

        // Verify original DID entry is intact (schema unaffected)
        let entry = contract.get_did(key.clone()).unwrap();
        assert_eq!(entry.encrypted_document, doc);
        assert_eq!(entry.encrypted_entity_type, entity);
        assert_eq!(entry.nonce, nonce);
        assert_eq!(entry.entity_type_nonce, et_nonce);
        assert_eq!(entry.owner, "alice.testnet".parse::<AccountId>().unwrap());
        assert!(entry.active);

        // No caveats stored yet
        assert!(contract.get_caveats(key).is_none());
    }
}
