# NEAR Blockchain Integration

BASTION uses NEAR Protocol (testnet) as its trust and coordination layer, providing cryptographic identity, on-chain governance, and verifiable document attestation.

## Smart Contracts

The contract suite is written in Rust and deployed as a single contract with 12 modules:

| Module | Purpose |
|--------|---------|
| `document` | On-chain document hashes and metadata |
| `privacy` | Encrypted field storage and access control |
| `attestation` | Cryptographic attestation of planning artifacts |
| `chain_signatures` | Multi-chain MPC signature coordination |
| `intents` | Intent-based transaction declarations |
| `did_registry` | Decentralized identifier management |
| `credential_registry` | Verifiable credential issuance and lookup |
| `dao` | DAO governance (9 sub-modules: proposals, voting, membership, roles, treasury, execution, delegation, quorum, hooks) |
| `mdmp` | Military Decision-Making Process (4 sub-modules: steps, artifacts, transitions, validation) |

## Account Model

BASTION uses implicit NEAR accounts derived from passkey public keys:

1. User registers a passkey (WebAuthn) during onboarding.
2. The public key is hashed via **SHA3-256** to produce a 64-character hex string.
3. This hex string serves as the implicit NEAR account ID (no on-chain account creation needed).
4. The passkey signs NEAR transactions directly from the browser.

This eliminates seed phrases and wallet extensions while maintaining full custody.

## Chain Signatures

Chain signatures enable multi-chain MPC (Multi-Party Computation) operations:

- BASTION nodes participate as MPC signers for cross-chain asset or message verification.
- Key shares are distributed so no single node holds a complete private key.
- Useful for coalition environments where trust is distributed across participants.

## Intent-Based Transactions

Rather than constructing raw transactions, BASTION uses an intent pattern:

- **Transfer intent** — move tokens or assets between accounts.
- **Mission order intent** — publish a signed mission order on-chain.
- **Document verification intent** — attest to a document hash with metadata.

Intents are declared as structured objects, validated against schemas, and then resolved into NEAR transactions for signing.

## Dual-Write Pattern

All blockchain-relevant state changes follow a **transactional outbox** pattern:

1. The backend writes to PostgreSQL within a transaction.
2. An outbox record is inserted in the same transaction.
3. A background worker reads the outbox and submits the corresponding NEAR transaction.
4. On confirmation, the outbox record is marked complete.

This ensures the database and blockchain remain consistent even if the NEAR RPC is temporarily unavailable.

## Unsigned Transaction Pattern

For operations requiring user authorization, the backend constructs an **unsigned NEAR transaction** and returns it to the frontend:

1. Backend builds the transaction (actions, receiver, nonce, block hash).
2. Frontend receives the serialized unsigned transaction.
3. The user's passkey signs the transaction in-browser.
4. Frontend submits the signed transaction to the NEAR RPC.

This keeps private keys entirely client-side while letting the backend handle transaction construction logic.
