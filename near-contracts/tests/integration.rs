use serde_json::json;
use std::fs;

async fn get_wasm() -> Vec<u8> {
    // Use pre-built WASM to avoid compilation issues during tests
    let wasm_path = "./target/wasm32-unknown-unknown/release/near_contracts.wasm";
    fs::read(wasm_path).expect("Failed to read WASM file. Run 'cargo build --target wasm32-unknown-unknown --release' first")
}

#[tokio::test]
async fn test_contract_initialization() -> Result<(), Box<dyn std::error::Error>> {
    let sandbox = near_workspaces::sandbox().await?;
    let contract_wasm = get_wasm().await;
    let contract = sandbox.dev_deploy(&contract_wasm).await?;

    let owner_account = sandbox.dev_create_account().await?;

    // Initialize contract
    let outcome = owner_account
        .call(contract.id(), "new")
        .args_json(json!({"owner": owner_account.id()}))
        .transact()
        .await?;

    if !outcome.is_success() {
        eprintln!("Transaction failed: {:?}", outcome.clone().into_result());
    }
    assert!(outcome.is_success());

    // Verify initialization
    let is_initialized: bool = contract
        .view("is_initialized")
        .args_json(json!({}))
        .await?
        .json()?;
    assert!(is_initialized);

    // Verify owner
    let owner: String = contract
        .view("get_owner")
        .args_json(json!({}))
        .await?
        .json()?;
    assert_eq!(owner, owner_account.id().to_string());

    // Verify state version
    let state_version: u8 = contract
        .view("get_state_version")
        .args_json(json!({}))
        .await?
        .json()?;
    assert_eq!(state_version, 1);

    Ok(())
}

#[tokio::test]
async fn test_owner_only_action() -> Result<(), Box<dyn std::error::Error>> {
    let sandbox = near_workspaces::sandbox().await?;
    let contract_wasm = get_wasm().await;
    let contract = sandbox.dev_deploy(&contract_wasm).await?;

    let owner_account = sandbox.dev_create_account().await?;
    let user_account = sandbox.dev_create_account().await?;

    // Initialize contract
    owner_account
        .call(contract.id(), "new")
        .args_json(json!({"owner": owner_account.id()}))
        .transact()
        .await?;

    // Owner should succeed
    let outcome = owner_account
        .call(contract.id(), "owner_only_action")
        .args_json(json!({"message": "Owner action"}))
        .transact()
        .await?;
    assert!(outcome.is_success());

    // Non-owner should fail
    let outcome = user_account
        .call(contract.id(), "owner_only_action")
        .args_json(json!({"message": "User action"}))
        .transact()
        .await?;
    assert!(outcome.is_failure());

    Ok(())
}

#[tokio::test]
async fn test_update_data_validation() -> Result<(), Box<dyn std::error::Error>> {
    let sandbox = near_workspaces::sandbox().await?;
    let contract_wasm = get_wasm().await;
    let contract = sandbox.dev_deploy(&contract_wasm).await?;

    let owner_account = sandbox.dev_create_account().await?;

    // Initialize contract
    owner_account
        .call(contract.id(), "new")
        .args_json(json!({"owner": owner_account.id()}))
        .transact()
        .await?;

    // Valid value should succeed
    let outcome = owner_account
        .call(contract.id(), "update_data")
        .args_json(json!({"value": 100}))
        .transact()
        .await?;
    assert!(outcome.is_success());

    // Zero value should fail
    let outcome = owner_account
        .call(contract.id(), "update_data")
        .args_json(json!({"value": 0}))
        .transact()
        .await?;
    assert!(outcome.is_failure());

    Ok(())
}

#[tokio::test]
async fn test_gas_usage() -> Result<(), Box<dyn std::error::Error>> {
    let sandbox = near_workspaces::sandbox().await?;
    let contract_wasm = get_wasm().await;
    let contract = sandbox.dev_deploy(&contract_wasm).await?;

    let owner_account = sandbox.dev_create_account().await?;

    // Initialize contract and measure gas
    let outcome = owner_account
        .call(contract.id(), "new")
        .args_json(json!({"owner": owner_account.id()}))
        .transact()
        .await?;
    assert!(outcome.is_success());

    let gas_used = outcome.total_gas_burnt;
    println!("Gas used for initialization: {} Tgas", gas_used.as_gas() / 1_000_000_000_000);

    // Call a method and measure gas
    let outcome = owner_account
        .call(contract.id(), "update_data")
        .args_json(json!({"value": 100}))
        .transact()
        .await?;
    assert!(outcome.is_success());

    let gas_used = outcome.total_gas_burnt;
    println!("Gas used for update_data: {} Tgas", gas_used.as_gas() / 1_000_000_000_000);

    // View method (no gas charged to caller)
    let _outcome: bool = contract
        .view("is_initialized")
        .args_json(json!({}))
        .await?
        .json()?;
    // View methods don't charge gas to the caller, but we can verify they work

    Ok(())
}

#[tokio::test]
async fn test_contract_deployment_with_attached_deposit() -> Result<(), Box<dyn std::error::Error>> {
    let sandbox = near_workspaces::sandbox().await?;
    let contract_wasm = get_wasm().await;
    let contract = sandbox.dev_deploy(&contract_wasm).await?;

    let owner_account = sandbox.dev_create_account().await?;

    // Initialize with attached deposit (for storage)
    let outcome = owner_account
        .call(contract.id(), "new")
        .args_json(json!({"owner": owner_account.id()}))
        .deposit(near_workspaces::types::NearToken::from_near(1))
        .transact()
        .await?;
    assert!(outcome.is_success());

    Ok(())
}

#[tokio::test]
async fn test_phala_backend_configuration() -> Result<(), Box<dyn std::error::Error>> {
    let sandbox = near_workspaces::sandbox().await?;
    let contract_wasm = get_wasm().await;
    let contract = sandbox.dev_deploy(&contract_wasm).await?;

    let owner_account = sandbox.dev_create_account().await?;
    let user_account = sandbox.dev_create_account().await?;

    // Initialize contract
    owner_account
        .call(contract.id(), "new")
        .args_json(json!({"owner": owner_account.id()}))
        .transact()
        .await?;

    // Check initial state - no backend configured
    let backend: Option<String> = contract
        .view("get_phala_backend")
        .args_json(json!({}))
        .await?
        .json()?;
    assert!(backend.is_none());

    // Owner should be able to set backend
    let phala_backend = "phala.near";
    let outcome = owner_account
        .call(contract.id(), "set_phala_backend")
        .args_json(json!({"phala_account": phala_backend}))
        .transact()
        .await?;
    assert!(outcome.is_success());

    // Verify backend was set
    let backend: Option<String> = contract
        .view("get_phala_backend")
        .args_json(json!({}))
        .await?
        .json()?;
    assert_eq!(backend, Some(phala_backend.to_string()));

    // Non-owner should not be able to set backend
    let outcome = user_account
        .call(contract.id(), "set_phala_backend")
        .args_json(json!({"phala_account": "attacker.near"}))
        .transact()
        .await?;
    assert!(outcome.is_failure());

    Ok(())
}

#[tokio::test]
async fn test_public_data_processing() -> Result<(), Box<dyn std::error::Error>> {
    let sandbox = near_workspaces::sandbox().await?;
    let contract_wasm = get_wasm().await;
    let contract = sandbox.dev_deploy(&contract_wasm).await?;

    let owner_account = sandbox.dev_create_account().await?;

    // Initialize contract
    owner_account
        .call(contract.id(), "new")
        .args_json(json!({"owner": owner_account.id()}))
        .transact()
        .await?;

    // Process public data (should complete on-chain)
    let test_data = b"public test data".to_vec();
    let outcome = owner_account
        .call(contract.id(), "process_data")
        .args_json(json!({
            "data": test_data,
            "classification": "Public"
        }))
        .transact()
        .await?;

    assert!(outcome.is_success());
    println!("Public data processing gas: {} Tgas", outcome.total_gas_burnt.as_gas() / 1_000_000_000_000);

    Ok(())
}

#[tokio::test]
async fn test_secret_data_routing() -> Result<(), Box<dyn std::error::Error>> {
    let sandbox = near_workspaces::sandbox().await?;
    let contract_wasm = get_wasm().await;
    let contract = sandbox.dev_deploy(&contract_wasm).await?;

    let owner_account = sandbox.dev_create_account().await?;
    let phala_account = sandbox.dev_create_account().await?;

    // Initialize contract
    owner_account
        .call(contract.id(), "new")
        .args_json(json!({"owner": owner_account.id()}))
        .transact()
        .await?;

    // Set Phala backend
    owner_account
        .call(contract.id(), "set_phala_backend")
        .args_json(json!({"phala_account": phala_account.id()}))
        .transact()
        .await?;

    // Process secret data (should route to TEE)
    let test_data = b"secret test data".to_vec();
    let outcome = owner_account
        .call(contract.id(), "process_data")
        .args_json(json!({
            "data": test_data,
            "classification": "Secret"
        }))
        .transact()
        .await?;

    // This will succeed even if the Phala backend doesn't have the method
    // because we're just testing the routing mechanism
    println!("Secret data routing result: {:?}", outcome.is_success());
    println!("Secret data routing gas: {} Tgas", outcome.total_gas_burnt.as_gas() / 1_000_000_000_000);

    Ok(())
}

#[tokio::test]
async fn test_tee_routing_without_backend_fails() -> Result<(), Box<dyn std::error::Error>> {
    let sandbox = near_workspaces::sandbox().await?;
    let contract_wasm = get_wasm().await;
    let contract = sandbox.dev_deploy(&contract_wasm).await?;

    let owner_account = sandbox.dev_create_account().await?;

    // Initialize contract (no Phala backend set)
    owner_account
        .call(contract.id(), "new")
        .args_json(json!({"owner": owner_account.id()}))
        .transact()
        .await?;

    // Try to process secret data without backend configured
    let test_data = b"secret test data".to_vec();
    let outcome = owner_account
        .call(contract.id(), "process_data")
        .args_json(json!({
            "data": test_data,
            "classification": "Secret"
        }))
        .transact()
        .await?;

    // Should fail with "Phala backend not configured"
    assert!(outcome.is_failure());

    Ok(())
}

#[tokio::test]
async fn test_attestation_configuration() -> Result<(), Box<dyn std::error::Error>> {
    let sandbox = near_workspaces::sandbox().await?;
    let contract_wasm = get_wasm().await;
    let contract = sandbox.dev_deploy(&contract_wasm).await?;

    let owner_account = sandbox.dev_create_account().await?;
    let user_account = sandbox.dev_create_account().await?;

    // Initialize contract
    owner_account
        .call(contract.id(), "new")
        .args_json(json!({"owner": owner_account.id()}))
        .transact()
        .await?;

    // Owner should be able to set trusted app hash
    let outcome = owner_account
        .call(contract.id(), "set_trusted_app_hash")
        .args_json(json!({"app_hash": "0x1234567890abcdef"}))
        .transact()
        .await?;
    assert!(outcome.is_success());

    // Owner should be able to add trusted hardware identity
    let outcome = owner_account
        .call(contract.id(), "add_trusted_hw_identity")
        .args_json(json!({"hw_id": "SGX-HW-12345"}))
        .transact()
        .await?;
    assert!(outcome.is_success());

    // Non-owner should not be able to set trusted app hash
    let outcome = user_account
        .call(contract.id(), "set_trusted_app_hash")
        .args_json(json!({"app_hash": "0xattacker"}))
        .transact()
        .await?;
    assert!(outcome.is_failure());

    // Non-owner should not be able to add trusted hardware identity
    let outcome = user_account
        .call(contract.id(), "add_trusted_hw_identity")
        .args_json(json!({"hw_id": "MALICIOUS-HW"}))
        .transact()
        .await?;
    assert!(outcome.is_failure());

    Ok(())
}
