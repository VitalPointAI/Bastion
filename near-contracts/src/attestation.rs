use near_sdk::{env, log, near};

/// Attestation report from Phala TEE
/// This structure validates that code running in TEE is authentic and trusted
#[near(serializers = [borsh, json])]
#[derive(Clone, Debug)]
pub struct AttestationReport {
    /// Hardware identity fingerprint (SGX/SEV specific)
    pub hw_identity: String,
    /// Application code hash (expected Phat Contract hash)
    pub app_hash: String,
    /// Hash of the TEE result data
    pub report_data: String,
    /// Cryptographic signature over the attestation
    pub signature: Vec<u8>,
    /// Timestamp when attestation was generated
    pub timestamp: u64,
}

/// Errors that can occur during attestation verification
#[derive(Debug)]
pub enum AttestationError {
    InvalidSignature,
    AppHashMismatch,
    UntrustedHardware,
    ReportDataMismatch,
    Expired,
}

impl std::fmt::Display for AttestationError {
    fn fmt(&self, f: &mut std::fmt::Formatter) -> std::fmt::Result {
        match self {
            AttestationError::InvalidSignature => write!(f, "Invalid attestation signature"),
            AttestationError::AppHashMismatch => write!(f, "Application hash does not match expected"),
            AttestationError::UntrustedHardware => write!(f, "Hardware identity not trusted"),
            AttestationError::ReportDataMismatch => write!(f, "Report data does not match result"),
            AttestationError::Expired => write!(f, "Attestation expired"),
        }
    }
}

/// Attestation verifier configuration and logic
#[near(serializers = [borsh])]
pub struct AttestationVerifier {
    /// Expected Phat Contract code hash (whitelisted)
    pub expected_app_hash: Option<String>,
    /// Trusted hardware identities (whitelisted TEE fingerprints)
    pub trusted_hw_identities: Vec<String>,
    /// Maximum attestation age in nanoseconds (default: 5 minutes)
    pub max_attestation_age: u64,
}

impl Default for AttestationVerifier {
    fn default() -> Self {
        Self {
            expected_app_hash: None,
            trusted_hw_identities: Vec::new(),
            max_attestation_age: 5 * 60 * 1_000_000_000, // 5 minutes in nanoseconds
        }
    }
}

impl AttestationVerifier {
    /// Create new attestation verifier
    pub fn new() -> Self {
        Self::default()
    }

    /// Set expected application hash (Phat Contract code hash)
    pub fn set_expected_app_hash(&mut self, app_hash: String) {
        log!("Setting expected app hash: {}", app_hash);
        self.expected_app_hash = Some(app_hash);
    }

    /// Add trusted hardware identity
    pub fn add_trusted_hw_identity(&mut self, hw_id: String) {
        log!("Adding trusted hardware identity: {}", hw_id);
        if !self.trusted_hw_identities.contains(&hw_id) {
            self.trusted_hw_identities.push(hw_id);
        }
    }

    /// Verify attestation report
    ///
    /// This is a foundational implementation with placeholder for full cryptographic verification.
    /// Production requires:
    /// - Full Intel SGX/AMD SEV signature verification
    /// - Certificate chain validation
    /// - Hardware-specific attestation protocol
    ///
    /// For v1, we verify:
    /// - App hash matches expected
    /// - Hardware identity is trusted
    /// - Report data matches result hash
    /// - Attestation is not expired
    pub fn verify_attestation(
        &self,
        attestation: &AttestationReport,
        result: &[u8],
    ) -> Result<(), AttestationError> {
        // 1. Verify app hash matches expected
        if let Some(expected_hash) = &self.expected_app_hash {
            if &attestation.app_hash != expected_hash {
                log!("App hash mismatch: expected {}, got {}", expected_hash, attestation.app_hash);
                return Err(AttestationError::AppHashMismatch);
            }
        }

        // 2. Verify hardware identity is trusted
        if !self.trusted_hw_identities.is_empty()
            && !self.trusted_hw_identities.contains(&attestation.hw_identity) {
            log!("Untrusted hardware identity: {}", attestation.hw_identity);
            return Err(AttestationError::UntrustedHardware);
        }

        // 3. Verify report data matches result hash
        let result_hash = hex::encode(&env::sha256(result));
        if attestation.report_data != result_hash {
            log!("Report data mismatch: expected {}, got {}", result_hash, attestation.report_data);
            return Err(AttestationError::ReportDataMismatch);
        }

        // 4. Verify attestation is not expired
        let current_time = env::block_timestamp();
        if current_time > attestation.timestamp + self.max_attestation_age {
            log!("Attestation expired: age {} ns", current_time - attestation.timestamp);
            return Err(AttestationError::Expired);
        }

        // 5. Verify signature (PLACEHOLDER - requires crypto library for production)
        // Production would verify: signature over (hw_identity, app_hash, report_data, timestamp)
        // using TEE's public key from attestation service (Intel IAS, AMD SEV-SNP, etc.)
        if !self.verify_signature_placeholder(&attestation) {
            log!("Invalid signature (placeholder check)");
            return Err(AttestationError::InvalidSignature);
        }

        log!("Attestation verified successfully");
        Ok(())
    }

    /// Placeholder signature verification
    ///
    /// PRODUCTION REQUIREMENTS:
    /// - Use proper cryptographic library (e.g., ed25519-dalek, ring)
    /// - Verify against TEE attestation service public keys
    /// - Implement full certificate chain validation
    /// - Follow Intel SGX IAS or AMD SEV-SNP attestation protocols
    fn verify_signature_placeholder(&self, _attestation: &AttestationReport) -> bool {
        // For v1 foundational structure, accept non-empty signatures
        // Production would do: verify_ed25519(attestation.signature, data, public_key)
        !_attestation.signature.is_empty()
    }
}

// Helper module for hex encoding
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
    use near_sdk::test_utils::VMContextBuilder;
    use near_sdk::testing_env;

    fn get_context() -> VMContextBuilder {
        let mut builder = VMContextBuilder::new();
        builder.block_timestamp(1_000_000_000);
        builder
    }

    #[test]
    fn test_app_hash_verification() {
        let context = get_context();
        testing_env!(context.build());

        let mut verifier = AttestationVerifier::new();
        verifier.set_expected_app_hash("expected_hash".to_string());

        let result = b"test result";
        let result_hash = hex::encode(&env::sha256(result));

        // Valid attestation
        let valid_attestation = AttestationReport {
            hw_identity: "trusted_hw".to_string(),
            app_hash: "expected_hash".to_string(),
            report_data: result_hash.clone(),
            signature: vec![1, 2, 3, 4], // Non-empty placeholder
            timestamp: 900_000_000, // Within 5 minutes
        };

        assert!(verifier.verify_attestation(&valid_attestation, result).is_ok());

        // Invalid app hash
        let invalid_attestation = AttestationReport {
            hw_identity: "trusted_hw".to_string(),
            app_hash: "wrong_hash".to_string(),
            report_data: result_hash,
            signature: vec![1, 2, 3, 4],
            timestamp: 900_000_000,
        };

        assert!(matches!(
            verifier.verify_attestation(&invalid_attestation, result),
            Err(AttestationError::AppHashMismatch)
        ));
    }

    #[test]
    fn test_hardware_identity_verification() {
        let context = get_context();
        testing_env!(context.build());

        let mut verifier = AttestationVerifier::new();
        verifier.add_trusted_hw_identity("trusted_hw_1".to_string());

        let result = b"test result";
        let result_hash = hex::encode(&env::sha256(result));

        // Trusted hardware
        let valid_attestation = AttestationReport {
            hw_identity: "trusted_hw_1".to_string(),
            app_hash: "any_hash".to_string(),
            report_data: result_hash.clone(),
            signature: vec![1, 2, 3, 4],
            timestamp: 900_000_000,
        };

        assert!(verifier.verify_attestation(&valid_attestation, result).is_ok());

        // Untrusted hardware
        let invalid_attestation = AttestationReport {
            hw_identity: "untrusted_hw".to_string(),
            app_hash: "any_hash".to_string(),
            report_data: result_hash,
            signature: vec![1, 2, 3, 4],
            timestamp: 900_000_000,
        };

        assert!(matches!(
            verifier.verify_attestation(&invalid_attestation, result),
            Err(AttestationError::UntrustedHardware)
        ));
    }

    #[test]
    fn test_report_data_verification() {
        let context = get_context();
        testing_env!(context.build());

        let verifier = AttestationVerifier::new();
        let result = b"test result";
        let result_hash = hex::encode(&env::sha256(result));

        // Valid report data
        let valid_attestation = AttestationReport {
            hw_identity: "any_hw".to_string(),
            app_hash: "any_hash".to_string(),
            report_data: result_hash.clone(),
            signature: vec![1, 2, 3, 4],
            timestamp: 900_000_000,
        };

        assert!(verifier.verify_attestation(&valid_attestation, result).is_ok());

        // Invalid report data
        let invalid_attestation = AttestationReport {
            hw_identity: "any_hw".to_string(),
            app_hash: "any_hash".to_string(),
            report_data: "wrong_hash".to_string(),
            signature: vec![1, 2, 3, 4],
            timestamp: 900_000_000,
        };

        assert!(matches!(
            verifier.verify_attestation(&invalid_attestation, result),
            Err(AttestationError::ReportDataMismatch)
        ));
    }

    #[test]
    fn test_attestation_expiry() {
        // Set block timestamp to a time far enough in the future to test expiry
        let mut context = get_context();
        context.block_timestamp(10_000_000_000_000); // Large timestamp
        testing_env!(context.build());

        let verifier = AttestationVerifier::new();
        let result = b"test result";
        let result_hash = hex::encode(&env::sha256(result));

        // Expired attestation (10 minutes before current block time)
        let current_time = 10_000_000_000_000u64;
        let ten_minutes_ns = 10 * 60 * 1_000_000_000u64;
        let expired_attestation = AttestationReport {
            hw_identity: "any_hw".to_string(),
            app_hash: "any_hash".to_string(),
            report_data: result_hash,
            signature: vec![1, 2, 3, 4],
            timestamp: current_time - ten_minutes_ns,
        };

        assert!(matches!(
            verifier.verify_attestation(&expired_attestation, result),
            Err(AttestationError::Expired)
        ));
    }
}
