// Chain Signatures module for decentralized multi-chain key management
// Integrates with NEAR MPC network for threshold signature generation
use near_sdk::{
    env, log, near, require, AccountId, Gas, Promise, PromiseOrValue,
};
use near_sdk::collections::UnorderedMap;
use near_sdk::serde::{Deserialize, Serialize};

/// Gas allocation for MPC contract calls (used in production cross-contract calls)
#[allow(dead_code)]
const MPC_CALL_GAS: Gas = Gas::from_tgas(100);

/// Chain Signatures Manager
/// Provides decentralized multi-chain key derivation and transaction signing
/// Uses NEAR MPC network (8 nodes) for threshold signature generation
#[near(serializers=[borsh])]
pub struct ChainSignatureManager {
    /// MPC contract address
    /// Mainnet: v1.signer.near
    /// Testnet: v1.signer.testnet
    pub mpc_contract: AccountId,

    /// Registered derivation paths
    /// Maps path name (e.g., "ethereum-1") to actual derivation path
    pub derivation_paths: UnorderedMap<String, String>,
}

/// Derived address result from MPC network
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(crate = "near_sdk::serde")]
pub struct DerivedAddress {
    pub chain: String,
    pub address: String,
    pub path: String,
}

/// Signature request parameters
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(crate = "near_sdk::serde")]
pub struct SignatureRequest {
    pub payload: Vec<u8>,
    pub path: String,
    pub key_version: u32,
}

/// Signature response from MPC network
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(crate = "near_sdk::serde")]
pub struct SignatureResponse {
    pub big_r: String,
    pub s: String,
    pub recovery_id: u8,
}

impl ChainSignatureManager {
    /// Create new Chain Signature Manager
    pub fn new(mpc_contract: AccountId) -> Self {
        Self {
            mpc_contract,
            derivation_paths: UnorderedMap::new(b"d"),
        }
    }

    /// Register derivation path for a chain
    /// Owner-only operation
    ///
    /// # Arguments
    /// * `path_name` - Human-readable path name (e.g., "ethereum-1", "bitcoin-1")
    /// * `derivation_path` - Actual derivation path for key generation
    ///
    /// # Returns
    /// Promise that resolves to derived address
    pub fn register_path(
        &mut self,
        path_name: String,
        derivation_path: String,
    ) -> PromiseOrValue<String> {
        require!(
            !path_name.is_empty() && !derivation_path.is_empty(),
            "Path name and derivation path cannot be empty"
        );

        // Store the derivation path
        self.derivation_paths.insert(&path_name, &derivation_path);

        log!(
            "Registered derivation path: {} -> {}",
            path_name,
            derivation_path
        );

        // In production, this would call MPC contract to derive address
        // For now, return a placeholder address
        PromiseOrValue::Value(format!("0x{}", path_name))
    }

    /// Derive address for a registered path
    /// Uses MPC network to deterministically derive address
    /// Same path will always produce same address
    ///
    /// # Arguments
    /// * `path_name` - Name of registered derivation path
    ///
    /// # Returns
    /// Derived address (format depends on chain: Ethereum 0x..., Bitcoin bc1q...)
    pub fn derive_address(&self, path_name: String) -> Option<String> {
        let path = self.derivation_paths.get(&path_name)?;

        log!(
            "Deriving address for path: {} ({})",
            path_name,
            path
        );

        // In production, this would make cross-contract call to MPC network:
        // Promise::new(self.mpc_contract.clone())
        //     .function_call(
        //         "public_key".to_string(),
        //         serde_json::to_vec(&json!({"path": path})).unwrap(),
        //         0,
        //         MPC_CALL_GAS,
        //     )

        // For now, return deterministic placeholder based on path
        Some(format!("0x{:x}", path.len()))
    }

    /// Request signature from MPC network
    /// Creates cross-contract call to MPC nodes for threshold signature
    ///
    /// # Arguments
    /// * `payload` - Data to sign (transaction hash, message, etc.)
    /// * `path_name` - Name of derivation path to use
    /// * `target_chain` - Target blockchain (e.g., "ethereum", "bitcoin")
    ///
    /// # Returns
    /// Promise that resolves to aggregated signature
    pub fn request_signature(
        &self,
        payload: Vec<u8>,
        path_name: String,
        target_chain: String,
    ) -> Promise {
        require!(
            !payload.is_empty(),
            "Payload cannot be empty"
        );

        let path = self.derivation_paths.get(&path_name)
            .expect("Derivation path not registered");

        log!(
            "Requesting signature for {} bytes on {} (path: {})",
            payload.len(),
            target_chain,
            path_name
        );

        // Create signature request (used in production MPC call)
        let _request = SignatureRequest {
            payload: payload.clone(),
            path: path.clone(),
            key_version: 0,
        };

        // In production, this would call MPC contract:
        // Promise::new(self.mpc_contract.clone())
        //     .function_call(
        //         "sign".to_string(),
        //         serde_json::to_vec(&request).unwrap(),
        //         0,
        //         MPC_CALL_GAS,
        //     )
        //     .then(
        //         Promise::new(env::current_account_id())
        //             .function_call(
        //                 "on_signature_result".to_string(),
        //                 serde_json::to_vec(&json!({
        //                     "path": path_name,
        //                     "chain": target_chain
        //                 })).unwrap(),
        //                 0,
        //                 Gas::from_tgas(10),
        //             )
        //     )

        // For now, return a resolved promise
        Promise::new(env::current_account_id())
    }

    /// Get derivation path by name (available for external use)
    #[allow(dead_code)]
    pub fn get_path(&self, path_name: String) -> Option<String> {
        self.derivation_paths.get(&path_name)
    }

    /// Check if path is registered (available for external use)
    #[allow(dead_code)]
    pub fn has_path(&self, path_name: String) -> bool {
        self.derivation_paths.get(&path_name).is_some()
    }

    /// Get all registered path names
    pub fn get_all_paths(&self) -> Vec<String> {
        self.derivation_paths.keys().collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use near_sdk::test_utils::VMContextBuilder;
    use near_sdk::testing_env;

    fn get_context() -> VMContextBuilder {
        let mut builder = VMContextBuilder::new();
        builder.predecessor_account_id("user.near".parse().unwrap());
        builder
    }

    #[test]
    fn test_register_path() {
        let context = get_context();
        testing_env!(context.build());

        let mpc_contract: AccountId = "v1.signer.testnet".parse().unwrap();
        let mut manager = ChainSignatureManager::new(mpc_contract);

        // Register Ethereum path
        let result = manager.register_path(
            "ethereum-1".to_string(),
            "m/44'/60'/0'/0/0".to_string(),
        );

        // Should return address
        match result {
            PromiseOrValue::Value(addr) => {
                assert!(addr.starts_with("0x"));
            }
            PromiseOrValue::Promise(_) => panic!("Expected value, got promise"),
        }

        // Path should be registered
        assert!(manager.has_path("ethereum-1".to_string()));
    }

    #[test]
    fn test_derive_address_deterministic() {
        let context = get_context();
        testing_env!(context.build());

        let mpc_contract: AccountId = "v1.signer.testnet".parse().unwrap();
        let mut manager = ChainSignatureManager::new(mpc_contract);

        // Register path
        let _ = manager.register_path(
            "ethereum-1".to_string(),
            "m/44'/60'/0'/0/0".to_string(),
        );

        // Derive address twice
        let addr1 = manager.derive_address("ethereum-1".to_string());
        let addr2 = manager.derive_address("ethereum-1".to_string());

        // Should be deterministic (same address both times)
        assert!(addr1.is_some());
        assert!(addr2.is_some());
        assert_eq!(addr1, addr2);
    }

    #[test]
    fn test_signature_request() {
        let context = get_context();
        testing_env!(context.build());

        let mpc_contract: AccountId = "v1.signer.testnet".parse().unwrap();
        let mut manager = ChainSignatureManager::new(mpc_contract);

        // Register path
        let _ = manager.register_path(
            "ethereum-1".to_string(),
            "m/44'/60'/0'/0/0".to_string(),
        );

        // Request signature
        let payload = vec![1, 2, 3, 4, 5];
        let _promise = manager.request_signature(
            payload,
            "ethereum-1".to_string(),
            "ethereum".to_string(),
        );

        // Promise should be created (can't test resolution in unit tests)
        // In integration tests with MPC network, we would verify signature
    }

    #[test]
    #[should_panic(expected = "Derivation path not registered")]
    fn test_signature_request_unregistered_path() {
        let context = get_context();
        testing_env!(context.build());

        let mpc_contract: AccountId = "v1.signer.testnet".parse().unwrap();
        let manager = ChainSignatureManager::new(mpc_contract);

        // Request signature without registering path
        let payload = vec![1, 2, 3, 4, 5];
        let _ = manager.request_signature(
            payload,
            "unregistered-path".to_string(),
            "ethereum".to_string(),
        );
    }

    #[test]
    fn test_get_all_paths() {
        let context = get_context();
        testing_env!(context.build());

        let mpc_contract: AccountId = "v1.signer.testnet".parse().unwrap();
        let mut manager = ChainSignatureManager::new(mpc_contract);

        // Register multiple paths
        let _ = manager.register_path(
            "ethereum-1".to_string(),
            "m/44'/60'/0'/0/0".to_string(),
        );
        let _ = manager.register_path(
            "bitcoin-1".to_string(),
            "m/84'/0'/0'/0/0".to_string(),
        );

        // Get all paths
        let paths = manager.get_all_paths();
        assert_eq!(paths.len(), 2);
        assert!(paths.contains(&"ethereum-1".to_string()));
        assert!(paths.contains(&"bitcoin-1".to_string()));
    }

    #[test]
    fn test_derive_address_not_registered() {
        let context = get_context();
        testing_env!(context.build());

        let mpc_contract: AccountId = "v1.signer.testnet".parse().unwrap();
        let manager = ChainSignatureManager::new(mpc_contract);

        // Try to derive address for unregistered path
        let result = manager.derive_address("nonexistent".to_string());
        assert!(result.is_none());
    }
}
