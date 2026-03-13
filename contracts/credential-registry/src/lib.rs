use near_sdk::borsh::{BorshDeserialize, BorshSerialize};
use near_sdk::store::LookupMap;
use near_sdk::serde::{Deserialize, Serialize};
use near_sdk::{env, near, AccountId, BorshStorageKey, PanicOnDefault};
use schemars::JsonSchema;

#[derive(BorshStorageKey, BorshDeserialize, BorshSerialize)]
enum StorageKey {
    Credentials,
    RevocationKeys,
}

/// On-chain anchored credential entry
#[derive(BorshDeserialize, BorshSerialize, Serialize, Deserialize, Clone, JsonSchema)]
#[serde(crate = "near_sdk::serde")]
#[borsh(crate = "near_sdk::borsh")]
pub struct CredentialEntry {
    pub credential_hash: Vec<u8>,
    pub encrypted_metadata: Vec<u8>,
    pub nonce: Vec<u8>,
    #[schemars(with = "String")]
    pub owner: AccountId,
    pub created_at: u64,
    pub expiration_date: Option<u64>,
    pub revoked: bool,
    pub revoked_at: Option<u64>,
}

#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct CredentialRegistry {
    credentials: LookupMap<String, CredentialEntry>,
    /// Maps revocation key → credential ID for revocation-by-key
    revocation_keys: LookupMap<String, String>,
    admin: AccountId,
    paused: bool,
}

#[near]
impl CredentialRegistry {
    #[init]
    pub fn new(admin: AccountId) -> Self {
        assert!(!env::state_exists(), "Already initialized");
        Self {
            credentials: LookupMap::new(StorageKey::Credentials),
            revocation_keys: LookupMap::new(StorageKey::RevocationKeys),
            admin,
            paused: false,
        }
    }

    // ========================================================================
    // Write methods
    // ========================================================================

    /// Anchor an encrypted credential on-chain.
    #[payable]
    pub fn anchor_credential(
        &mut self,
        blinded_credential_id: Vec<u8>,
        blinded_revocation_key: Vec<u8>,
        credential_hash: Vec<u8>,
        encrypted_metadata: Vec<u8>,
        nonce: Vec<u8>,
        expiration_date: Option<u64>,
    ) {
        self.assert_not_paused();

        assert!(blinded_credential_id.len() == 32, "blinded_credential_id must be 32 bytes");
        assert!(blinded_revocation_key.len() == 32, "blinded_revocation_key must be 32 bytes");
        assert!(blinded_credential_id != blinded_revocation_key, "credential ID and revocation key must be different");
        assert!(credential_hash.len() == 32, "credential_hash must be 32 bytes (SHA256)");
        assert!(nonce.len() == 12, "nonce must be 12 bytes");
        assert!(!encrypted_metadata.is_empty(), "encrypted_metadata cannot be empty");

        let cred_id_hex = hex_encode(&blinded_credential_id);
        let revoke_key_hex = hex_encode(&blinded_revocation_key);
        let caller = env::predecessor_account_id();

        assert!(self.credentials.get(&cred_id_hex).is_none(), "Credential already anchored with this ID");
        assert!(self.revocation_keys.get(&revoke_key_hex).is_none(), "Revocation key already in use");

        let storage_before = env::storage_usage();

        let entry = CredentialEntry {
            credential_hash,
            encrypted_metadata,
            nonce,
            owner: caller,
            created_at: env::block_timestamp(),
            expiration_date,
            revoked: false,
            revoked_at: None,
        };

        self.credentials.insert(cred_id_hex.clone(), entry);
        self.revocation_keys.insert(revoke_key_hex, cred_id_hex);

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

    /// Revoke a credential using its revocation key. Owner or admin only.
    pub fn revoke_credential(&mut self, blinded_revocation_key: Vec<u8>) {
        self.assert_not_paused();
        let revoke_key_hex = hex_encode(&blinded_revocation_key);
        let caller = env::predecessor_account_id();

        let cred_id_hex = self.revocation_keys.get(&revoke_key_hex)
            .unwrap_or_else(|| env::panic_str("Revocation key not found"))
            .clone();

        let mut entry = self.credentials.get(&cred_id_hex)
            .unwrap_or_else(|| env::panic_str("Credential not found"))
            .clone();

        assert!(
            entry.owner == caller || caller == self.admin,
            "Only the credential owner or admin can revoke"
        );
        assert!(!entry.revoked, "Credential already revoked");

        entry.revoked = true;
        entry.revoked_at = Some(env::block_timestamp());
        self.credentials.insert(cred_id_hex, entry);
    }

    // ========================================================================
    // View methods
    // ========================================================================

    pub fn get_credential(&self, blinded_credential_id: Vec<u8>) -> Option<CredentialEntry> {
        let cred_id_hex = hex_encode(&blinded_credential_id);
        self.credentials.get(&cred_id_hex).cloned()
    }

    /// Check if credential is valid (exists, not revoked, not expired).
    pub fn is_credential_valid(&self, blinded_credential_id: Vec<u8>) -> bool {
        let cred_id_hex = hex_encode(&blinded_credential_id);
        match self.credentials.get(&cred_id_hex) {
            None => false,
            Some(entry) => {
                if entry.revoked { return false; }
                if let Some(exp) = entry.expiration_date {
                    let now_ms = env::block_timestamp() / 1_000_000;
                    if now_ms > exp { return false; }
                }
                true
            }
        }
    }

    pub fn is_credential_revoked(&self, blinded_credential_id: Vec<u8>) -> bool {
        let cred_id_hex = hex_encode(&blinded_credential_id);
        self.credentials.get(&cred_id_hex).map(|e| e.revoked).unwrap_or(false)
    }

    pub fn get_admin(&self) -> AccountId { self.admin.clone() }
    pub fn is_paused(&self) -> bool { self.paused }

    // ========================================================================
    // Admin methods
    // ========================================================================

    pub fn pause(&mut self) { self.assert_admin(); self.paused = true; }
    pub fn unpause(&mut self) { self.assert_admin(); self.paused = false; }

    pub fn set_admin(&mut self, new_admin: AccountId) {
        self.assert_admin();
        self.admin = new_admin;
    }

    pub fn admin_revoke_credential(&mut self, blinded_credential_id: Vec<u8>) {
        self.assert_admin();
        let cred_id_hex = hex_encode(&blinded_credential_id);

        let mut entry = self.credentials.get(&cred_id_hex)
            .unwrap_or_else(|| env::panic_str("Credential not found"))
            .clone();

        entry.revoked = true;
        entry.revoked_at = Some(env::block_timestamp());
        self.credentials.insert(cred_id_hex, entry);
    }

    // ========================================================================
    // Internal
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

    #[test]
    fn test_anchor_and_get() {
        let ctx = setup_context("alice.testnet");
        testing_env!(ctx.build());

        let mut contract = CredentialRegistry::new("admin.testnet".parse().unwrap());
        contract.anchor_credential(
            vec![1u8; 32], vec![2u8; 32], vec![3u8; 32],
            vec![4u8; 64], vec![5u8; 12], Some(1700000000000),
        );

        let entry = contract.get_credential(vec![1u8; 32]).unwrap();
        assert_eq!(entry.credential_hash, vec![3u8; 32]);
        assert!(!entry.revoked);
    }

    #[test]
    fn test_revoke_by_key() {
        let ctx = setup_context("alice.testnet");
        testing_env!(ctx.build());

        let mut contract = CredentialRegistry::new("admin.testnet".parse().unwrap());
        contract.anchor_credential(
            vec![10u8; 32], vec![11u8; 32], vec![12u8; 32],
            vec![13u8; 64], vec![14u8; 12], None,
        );

        assert!(contract.is_credential_valid(vec![10u8; 32]));
        contract.revoke_credential(vec![11u8; 32]);
        assert!(contract.is_credential_revoked(vec![10u8; 32]));
    }

    #[test]
    #[should_panic(expected = "credential ID and revocation key must be different")]
    fn test_same_id_and_revocation_key_rejected() {
        let ctx = setup_context("alice.testnet");
        testing_env!(ctx.build());

        let mut contract = CredentialRegistry::new("admin.testnet".parse().unwrap());
        let same = vec![20u8; 32];
        contract.anchor_credential(same.clone(), same, vec![21u8; 32], vec![22u8; 64], vec![23u8; 12], None);
    }

    #[test]
    #[should_panic(expected = "Credential already anchored")]
    fn test_cannot_overwrite() {
        let ctx = setup_context("alice.testnet");
        testing_env!(ctx.build());

        let mut contract = CredentialRegistry::new("admin.testnet".parse().unwrap());
        contract.anchor_credential(vec![30u8; 32], vec![31u8; 32], vec![32u8; 32], vec![33u8; 64], vec![34u8; 12], None);
        contract.anchor_credential(vec![30u8; 32], vec![35u8; 32], vec![36u8; 32], vec![37u8; 64], vec![38u8; 12], None);
    }
}
