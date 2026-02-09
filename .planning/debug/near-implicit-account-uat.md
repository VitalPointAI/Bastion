---
status: resolved
trigger: "User sees named account (bastion-a9ba0024.testnet) instead of NEAR implicit account"
created: 2026-02-01T00:00:00Z
updated: 2026-02-01T00:15:00Z
goal: find_root_cause_only
---

## Current Focus

hypothesis: Account ID generation uses named format (bastion-{uuid}.testnet) instead of implicit account format (64-char hex from public key)
test: Read mpc-account.ts lines 142-147 to confirm account format generation
expecting: Confirmation that named format is hardcoded
next_action: Confirmed - document root cause

## Symptoms

expected: NEAR implicit account ID (64-character hex string like abc123...def456)
actual: Named account in format bastion-a9ba0024.testnet
errors: None - system working as currently designed, but not per Phase 1.2 spec
reproduction: Register passkey, check returned nearAccountId
started: Likely since initial MPC implementation (Phase 1.2 not yet completed)

## Eliminated

None - first investigation, no hypotheses eliminated

## Evidence

1. timestamp: 2026-02-01T00:05:00Z
   checked: /backend/src/auth/mpc-account.ts createMPCAccount function
   found: Line 142-147 generates named account ID using UUID slice
   implication: Account ID generation is hardcoded to use named format, not implicit format

2. timestamp: 2026-02-01T00:08:00Z
   checked: MPC derivation path (line 140-143)
   found: Derivation path uses `bastion,{uuid}` format for MPC signing
   implication: Derivation path and account ID are separate - account ID choice is independent

3. timestamp: 2026-02-01T00:10:00Z
   checked: NEAR documentation reference https://docs.near.org/integrations/implicit-accounts
   found: Implicit accounts are 64-character hex strings derived from public key via SHA256
   implication: Current implementation creates named accounts, not implicit accounts

4. timestamp: 2026-02-01T00:12:00Z
   checked: Backend code flow - passkey-service.ts line 176
   found: createMPCAccount returns accountId which is passed to user store
   implication: The wrong format propagates through the system to frontend/user

## Resolution

root_cause: mpc-account.ts createMPCAccount() function (lines 142-147) generates named accounts (bastion-{uuid}.testnet) instead of implicit accounts (64-character hex from MPC public key SHA256 hash). NEAR implicit accounts derive from the public key, not from a human-readable prefix. The current implementation conflates the derivation PATH (bastion,{uuid}) with the account ID, when they are separate concepts.

fix: Account ID must be derived from MPC public key using SHA256 hash to produce 64-character hex string, not from UUID. The derivation path (bastion,{uuid}) remains correct - it's used by the MPC signer to sign under the right user. The account ID is what goes on-chain and must be the implicit account format.

files_changed: []
verification: "Requires Phase 1.2 completion - architecture decision needed on whether to migrate existing named accounts to implicit accounts or create new implicit account infrastructure"

