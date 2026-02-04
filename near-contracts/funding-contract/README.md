# NEAR Funding Contract

A smart contract for funding NEAR implicit accounts during user registration.

## Purpose

This contract holds NEAR balance and transfers a small amount (default 0.1 NEAR) to new implicit accounts when called by the authorized backend. This activates implicit accounts on-chain, enabling them to participate in transactions.

## Security

- Only `authorized_caller` can invoke the `fund()` method
- Admin can withdraw remaining balance
- Double-funding prevention via `funded_accounts` map
- All funding operations logged with timestamps

## Building

```bash
# Build WASM for release
cargo build --target wasm32-unknown-unknown --release
```

The WASM file will be at:
`target/wasm32-unknown-unknown/release/funding_contract.wasm`

## Testing

```bash
cargo test
```

## Deployment

### 1. Create a subaccount for the funding contract

```bash
near account create-account fund-for funding.YOUR_TESTNET_ACCOUNT.testnet autogenerate-new-keypair save-to-keychain sign-as YOUR_TESTNET_ACCOUNT.testnet network-config testnet sign-with-keychain send
```

Or using legacy CLI:
```bash
near create-account funding.YOUR_TESTNET_ACCOUNT.testnet --masterAccount YOUR_TESTNET_ACCOUNT.testnet --initialBalance 5
```

### 2. Deploy the contract

```bash
near contract deploy funding.YOUR_TESTNET_ACCOUNT.testnet use-file target/wasm32-unknown-unknown/release/funding_contract.wasm without-init-call network-config testnet sign-with-keychain send
```

Or using legacy CLI:
```bash
near deploy funding.YOUR_TESTNET_ACCOUNT.testnet target/wasm32-unknown-unknown/release/funding_contract.wasm
```

### 3. Initialize the contract

```bash
near contract call-function as-transaction funding.YOUR_TESTNET_ACCOUNT.testnet new json-args '{"admin": "YOUR_TESTNET_ACCOUNT.testnet", "authorized_caller": "YOUR_BACKEND_ACCOUNT.testnet"}' prepaid-gas '30 Tgas' attached-deposit '0 NEAR' sign-as YOUR_TESTNET_ACCOUNT.testnet network-config testnet sign-with-keychain send
```

Or using legacy CLI:
```bash
near call funding.YOUR_TESTNET_ACCOUNT.testnet new '{"admin": "YOUR_TESTNET_ACCOUNT.testnet", "authorized_caller": "YOUR_BACKEND_ACCOUNT.testnet"}' --accountId YOUR_TESTNET_ACCOUNT.testnet
```

### 4. Deposit NEAR for funding operations

```bash
near tokens YOUR_TESTNET_ACCOUNT.testnet send-near funding.YOUR_TESTNET_ACCOUNT.testnet '10 NEAR' network-config testnet sign-with-keychain send
```

Or using legacy CLI:
```bash
near send YOUR_TESTNET_ACCOUNT.testnet funding.YOUR_TESTNET_ACCOUNT.testnet 10
```

### 5. Configure environment

Add to your `.env`:
```
NEAR_FUNDING_CONTRACT_ID=funding.YOUR_TESTNET_ACCOUNT.testnet
```

## Contract Methods

### Change Methods (require signing)

| Method | Description | Access |
|--------|-------------|--------|
| `new(admin, authorized_caller)` | Initialize contract | Once only |
| `fund(account_id)` | Fund an implicit account | authorized_caller only |
| `withdraw(amount?)` | Withdraw NEAR balance | admin only |
| `set_authorized_caller(new_caller)` | Change authorized caller | admin only |
| `set_funding_amount(amount_millinear)` | Change funding amount | admin only |
| `set_admin(new_admin)` | Transfer admin role | admin only |

### View Methods (no signing required)

| Method | Description |
|--------|-------------|
| `get_balance()` | Get contract balance |
| `get_available_balance()` | Get balance minus storage reserve |
| `get_funding_amount()` | Get funding amount per account |
| `get_total_funded()` | Get total accounts funded |
| `is_funded(account_id)` | Check if account was funded |
| `get_funding_history(from_index, limit)` | Get funding history |
| `get_admin()` | Get admin account |
| `get_authorized_caller()` | Get authorized caller |

## Example Usage

### Check balance
```bash
near contract call-function as-read-only funding.YOUR_TESTNET_ACCOUNT.testnet get_balance json-args '{}' network-config testnet now
```

### Fund an implicit account (from authorized backend)
```bash
near contract call-function as-transaction funding.YOUR_TESTNET_ACCOUNT.testnet fund json-args '{"account_id": "abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234"}' prepaid-gas '30 Tgas' attached-deposit '0 NEAR' sign-as YOUR_BACKEND_ACCOUNT.testnet network-config testnet sign-with-keychain send
```

### Check funding history
```bash
near contract call-function as-read-only funding.YOUR_TESTNET_ACCOUNT.testnet get_funding_history json-args '{"from_index": 0, "limit": 10}' network-config testnet now
```
