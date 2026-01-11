use near_sdk::{env, log, near, AccountId, Gas, NearToken, Promise};

/// Data classification levels
#[near(serializers = [borsh, json])]
#[derive(Clone, Copy, PartialEq, Eq, Hash, Debug)]
pub enum Classification {
    /// Public data - processed on-chain
    Public,
    /// Secret data - routed to TEE
    Secret,
    /// Top Secret data - routed to TEE
    TopSecret,
}

/// Processing policy for each classification level
#[near(serializers = [borsh, json])]
#[derive(Clone, Copy, Debug)]
pub enum ProcessingPolicy {
    /// Process directly on-chain
    OnChain,
    /// Route to off-chain TEE (Phala)
    OffChainTEE,
}

/// Privacy router for classification-based routing
/// Note: Policies are hardcoded for simplicity - Public = OnChain, Secret/TopSecret = OffChainTEE
#[near(serializers = [borsh])]
pub struct PrivacyRouter {
    /// Phala backend contract address for TEE routing
    pub phala_backend_account: Option<AccountId>,
}

impl Default for PrivacyRouter {
    fn default() -> Self {
        Self {
            phala_backend_account: None,
        }
    }
}

impl PrivacyRouter {
    /// Create new privacy router with default policies
    pub fn new() -> Self {
        Self::default()
    }

    /// Set the Phala backend account for TEE routing
    pub fn set_phala_backend(&mut self, account_id: AccountId) {
        log!("Setting Phala backend to: {}", account_id);
        self.phala_backend_account = Some(account_id);
    }

    /// Get the processing policy for a classification level
    /// Policies are hardcoded: Public = OnChain, Secret/TopSecret = OffChainTEE
    pub fn get_policy(&self, classification: Classification) -> ProcessingPolicy {
        match classification {
            Classification::Public => ProcessingPolicy::OnChain,
            Classification::Secret => ProcessingPolicy::OffChainTEE,
            Classification::TopSecret => ProcessingPolicy::OffChainTEE,
        }
    }

    /// Route data based on classification
    pub fn route_data(
        &self,
        data: Vec<u8>,
        classification: Classification,
    ) -> RoutingResult {
        let policy = self.get_policy(classification);

        match policy {
            ProcessingPolicy::OnChain => {
                log!("Processing data on-chain (classification: {:?})", classification);
                RoutingResult::OnChain(self.process_on_chain(data))
            }
            ProcessingPolicy::OffChainTEE => {
                log!("Routing data to TEE (classification: {:?})", classification);
                match &self.phala_backend_account {
                    Some(backend) => {
                        let promise = self.route_to_tee(backend.clone(), data, classification);
                        RoutingResult::OffChainTEE(promise)
                    }
                    None => {
                        env::panic_str("Phala backend not configured for TEE routing");
                    }
                }
            }
        }
    }

    /// Process data on-chain (for Public classification)
    fn process_on_chain(&self, data: Vec<u8>) -> Vec<u8> {
        log!("On-chain processing: {} bytes", data.len());
        // Simple processing: return data hash as result
        let hash = env::sha256(&data);
        hash
    }

    /// Route data to Phala TEE backend
    fn route_to_tee(
        &self,
        backend: AccountId,
        data: Vec<u8>,
        classification: Classification,
    ) -> Promise {
        log!("Creating cross-contract call to Phala backend: {}", backend);

        // Convert data and classification to JSON-compatible format
        let data_hex = hex::encode(&data);
        let class_str = match classification {
            Classification::Public => "Public",
            Classification::Secret => "Secret",
            Classification::TopSecret => "TopSecret",
        };

        // Create cross-contract call with sufficient gas (50 Tgas)
        let gas_amount = Gas::from_tgas(50);

        // External contract call pattern (simplified - actual implementation would use ext_contract)
        log!("Calling process_in_tee with {} bytes, classification: {}", data.len(), class_str);

        // Return promise with callback for verification
        // In production, this would be: ext_phala::process_in_tee(...).then(self.on_tee_result(...))
        // For now, we create a simple promise structure
        Promise::new(backend)
            .function_call(
                "process_in_tee".to_string(),
                format!(r#"{{"data":"{}","classification":"{}"}}"#, data_hex, class_str).into_bytes(),
                NearToken::from_yoctonear(0), // No deposit required
                gas_amount,
            )
    }
}

/// Result of privacy routing
pub enum RoutingResult {
    /// Data processed on-chain with immediate result
    OnChain(Vec<u8>),
    /// Data routed to TEE with Promise for async processing
    OffChainTEE(Promise),
}

// Helper module for hex encoding (simple implementation)
mod hex {
    pub fn encode(bytes: &[u8]) -> String {
        bytes.iter()
            .map(|b| format!("{:02x}", b))
            .collect::<String>()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_classification_routing() {
        let router = PrivacyRouter::new();

        // Test policy mapping
        assert!(matches!(
            router.get_policy(Classification::Public),
            ProcessingPolicy::OnChain
        ));
        assert!(matches!(
            router.get_policy(Classification::Secret),
            ProcessingPolicy::OffChainTEE
        ));
        assert!(matches!(
            router.get_policy(Classification::TopSecret),
            ProcessingPolicy::OffChainTEE
        ));
    }

    #[test]
    fn test_on_chain_processing() {
        let router = PrivacyRouter::new();
        let data = b"test data".to_vec();
        let result = router.process_on_chain(data);

        // Result should be a hash (32 bytes)
        assert_eq!(result.len(), 32);
    }

    #[test]
    fn test_phala_backend_configuration() {
        let mut router = PrivacyRouter::new();
        assert!(router.phala_backend_account.is_none());

        let backend: AccountId = "phala.near".parse().unwrap();
        router.set_phala_backend(backend.clone());
        assert_eq!(router.phala_backend_account, Some(backend));
    }
}
