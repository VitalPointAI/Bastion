# Phase 1: Foundation & Infrastructure - Context

**Gathered:** 2026-01-11
**Status:** Ready for research

<vision>
## How This Should Work

A fully integrated blockchain + TEE stack working seamlessly from day one. NEAR and Phala operate together as a unified foundation, with smart contracts deployed and the confidential backend running in the TEE environment. Everything is ready for building features on top.

The integration is transparent - developers interact with the system without explicitly managing the privacy layer. When sensitive operations occur, they automatically route to Phala TEE for confidential computing. The complexity is abstracted away, handled based on data classification policies.

This creates a complete foundation where the blockchain and privacy layers work together invisibly, providing a clean development surface for building the coalition operations platform.

</vision>

<essential>
## What Must Be Nailed

All three foundational elements are equally critical and non-negotiable:

- **Blockchain smart contract foundation** - NEAR smart contracts must be working correctly with proper state management, gas handling, and upgrade patterns
- **Privacy-preserving backend execution** - Phala TEE must actually protect sensitive data in a confidential computing environment, proving classified workloads can run securely
- **End-to-end communication flow** - Data must flow smoothly from frontend through blockchain to TEE backend and back, with proper encryption and verification at each layer

These are foundational pillars - compromising on any of them undermines the entire system's viability for defense applications.

</essential>

<boundaries>
## What's Out of Scope

- **Production deployment patterns** - This phase focuses on getting the core stack working in local/dev environments; production hardening, high availability, and disaster recovery are deferred to later phases
- **Advanced smart contract features** - Only basic contract infrastructure needed to support identity and DAO functionality; full feature implementation happens in subsequent phases
- **Performance optimization** - Focus is on correctness and integration; optimization and scaling are deferred
- **Complete containerization strategy** - While components may be containerized, comprehensive orchestration and deployment architecture comes later

</boundaries>

<specifics>
## Specific Ideas

- Follow NEAR and Phala ecosystem standards - use recommended patterns, libraries, and starter templates from both ecosystems
- Don't reinvent solutions - leverage proven patterns from the NEAR and Phala communities
- Idiomatic development following each platform's best practices
- Use ecosystem tooling and development workflows as intended
- **Use NEAR Shade agents where appropriate** - leverage NEAR's autonomous AI agents running in Phala TEE for verifiable, decentralized automation with Chain Signatures for multi-chain key management

</specifics>

<shade_agents>
## NEAR Shade Agents Integration

**What they are:** Multichain AI-powered smart contracts that combine NEAR Protocol contracts with Phala TEE worker agents, using Chain Signatures for decentralized key management. They enable fully autonomous, verifiable AI agents that can sign transactions across any blockchain.

**Key capabilities:**
- **Autonomous decision-making** - Worker agents in TEE can access LLMs, APIs, off-chain data and execute based on AI reasoning
- **Multi-chain control** - Chain Signatures (threshold MPC) enable multiple TEE instances to collectively control keys across Bitcoin, Ethereum, Solana, etc.
- **Verifiable execution** - On-chain contracts verify worker agent authenticity via TEE attestation and code hash validation
- **No single point of failure** - Decentralized architecture with multiple worker agents using MPC (8 nodes currently)
- **Privacy-preserving** - All sensitive operations run in TEE with hardware-backed attestation

**Architecture:**
- **Worker Agent (off-chain)**: NextJS app in Phala TEE that proposes transactions, queries data/AI, accesses external APIs
- **Smart Contract (on-chain)**: NEAR contract that verifies worker TEE attestation against stored code hash before authorizing operations
- **Chain Signatures**: NEAR's MPC network enables threshold signatures (Secp256k1, Ed25519) for any blockchain

**Use cases for this project:**
- **Autonomous tactical planning** - AI agents that can analyze sensor data, propose tactical decisions, submit for human approval
- **Cross-chain asset management** - Agents managing coalition resources across multiple chains with verifiable execution
- **Intelligence fusion** - Autonomous agents processing classified data in TEE, producing verified intelligence products
- **Decentralized solvers** - Agents optimizing resource allocation, mission planning, logistics across coalition forces
- **Prediction markets / decision support** - Agents querying data sources, running analysis, providing recommendations with full audit trail

**Deployment model:**
- Local development: `ac-proxy.[NEAR_ACCOUNT_ID]` on NEAR testnet
- Production: `ac-sandbox.[NEAR_ACCOUNT_ID]` in Phala Cloud TEE on NEAR testnet
- DAO governance: Smart contracts store expected code hash, enable systematic upgrades to AI models

**Critical for defense use:**
- Hardware-backed attestation proves code runs unmodified in genuine TEE
- Decentralized key management eliminates custodial risk
- On-chain verification provides full audit trail
- Human oversight maintained through smart contract governance
- Multi-agent consensus prevents single TEE compromise

**Status:** Production-ready (Feb 2025), actively supported by NEAR Foundation ($20M AI Agent Fund), templates available on Phala Cloud

**Decision:** Use Shade agents for autonomous decision-making components throughout the platform where verifiable AI automation is needed, particularly for intelligence fusion (Phase 8), tactical execution (Phase 7), and operational planning (Phase 5).

</shade_agents>

<chain_abstraction>
## NEAR Intents & Chain Abstraction

**Core principle:** Complete blockchain abstraction - users and operators never see wallets, gas fees, bridging, or blockchain terminology. The system must be as intuitive as any modern web or mobile application.

**What they are:**

**Chain Abstraction** - NEAR's framework enabling applications that work seamlessly across multiple blockchains while abstracting underlying complexity. Three core technologies:
- **Multi-Chain Accounts (Chain Signatures)** - Single NEAR account signs transactions for all chains (Bitcoin, Ethereum, Solana, etc.)
- **NEAR Intents** - Users express desired outcomes ("transfer funds", "execute mission order"), solvers compete to fulfill optimally
- **FastAuth** - Email + biometric login (FaceID, fingerprint) with automatic account recovery, no seed phrases or wallet apps required

**NEAR Intents** - Multichain transaction protocol where users/agents specify WHAT they want (intent), not HOW to do it:
1. **Intent Creation** - Express desired outcome ("pay coalition partner", "authorize equipment purchase")
2. **Solver Competition** - Off-chain network of market makers compete for best solution (routing, pricing, execution)
3. **Verification** - On-chain verifier contract validates and settles transaction

**Key capabilities:**

**Zero blockchain knowledge required:**
- Users never see: gas fees, transaction hashes, wallet addresses, seed phrases, bridging, network selection
- Login with email + biometric (FastAuth passkeys)
- Intents expressed in natural language or simple UI actions
- System handles all blockchain complexity invisibly in background

**Seamless multi-chain operations:**
- Single account works across 25+ chains (Bitcoin, Ethereum, Solana, Polygon, Arbitrum, etc.)
- Assets accessible from any chain without manual bridging/wrapping
- Best pricing through solver competition (DeFi + CeFi + off-chain liquidity)
- Near-instant settlement despite cross-chain complexity

**Account abstraction features:**
- Meta transactions - third party pays gas fees (users never see them)
- Zero balance accounts - users can transact before acquiring crypto
- Email-based account recovery (no seed phrase backup needed)
- Biometric authentication instead of passwords/private keys

**Architecture for coalition operations:**

**Operator experience:**
- Commander logs in with email + FaceID
- Issues mission order → system creates intent
- Solver network finds optimal execution path
- Transaction verified on-chain, fully auditable
- No blockchain training required

**Financial transactions:**
- "Transfer 10,000 USDC to coalition partner Alpha" → Intent created
- Solvers compete to find best route (may cross multiple chains invisibly)
- Commander approves quote, transaction executes
- Full audit trail on NEAR blockchain
- Partners receive funds on their preferred chain

**Agent transactions:**
- Shade agents express intents ("optimize logistics budget allocation")
- Solver network evaluates options across all available chains/protocols
- Intent submitted to DAO for approval
- Executed with best pricing/routing
- Human operators never see blockchain mechanics

**Integration architecture:**

```
User Interface Layer
├── FastAuth (email + biometric login)
├── Intent Expression (natural language / simple UI)
└── No blockchain terminology exposed

↓

NEAR Intents Layer
├── Intent Creation API
├── Solver Network (off-chain competition)
├── Quote Presentation (user approves outcome, not transaction details)
└── Verifier Contract (on-chain settlement)

↓

Chain Signatures Layer
├── Single NEAR account
├── Multi-chain transaction signing (Bitcoin, ETH, Solana, etc.)
├── MPC threshold signatures (8 nodes)
└── Deterministic key derivation

↓

Execution Layer
├── Any blockchain (transparently selected by solver)
├── Optimal routing/pricing
├── Cross-chain settlement
└── Audit trail
```

**Concrete use cases:**

**Phase 4 - Strategic Planning:**
- Planners never create wallets or buy crypto
- System issues intents for document verification on-chain
- All blockchain operations invisible

**Phase 7 - Tactical Execution:**
- Commanders issue mission orders via intuitive interface
- Orders become intents executed on optimal chain
- Vehicle control payments/authorizations abstracted completely
- Operators focus on tactics, not transactions

**Phase 9 - Assessment & Dashboard:**
- Financial dashboards show "USD" not "ETH on Arbitrum"
- Cross-chain asset visibility unified in single view
- No chain-specific sections or complexity

**Phase 12 - Coalition Operations:**
- Coalition partners from different nations, different chains
- Universal account system (everyone uses email + biometric)
- Assets flow between partners transparently
- Information sharing via intents (solver finds optimal path)
- No training on crypto/blockchain for any participant

**Performance metrics:**
- $5 billion all-time transaction volume (Nov 2025)
- 25+ chains supported
- Near-instant settlement (seconds)
- Solver competition ensures best pricing
- NEAR 2026 roadmap: expand to 200+ assets, leading venue for on-chain transactions

**Developer integration:**
- 1Click API for intent creation
- FastAuth SDK for authentication
- Verifier contracts for custom intent types
- Solver network automatically available
- Documentation: docs.near.org/chain-abstraction

**Critical requirements for defense:**
- Complete abstraction maintained across ALL phases
- No blockchain training materials for end users
- Intuitive UI/UX matching commercial applications (think: Gmail, not MetaMask)
- Audit trail preserved despite abstraction (commanders can review if needed)
- Works on NEAR testnet (soldiers not handling real crypto in demo)

**Status:**
- Production-ready (2024-2025)
- Active ecosystem ($5B volume)
- NEAR 2026 strategy prioritizes Intents expansion
- FastAuth being revamped with MPC + Auth0

**Decision:** Use NEAR Intents + Chain Abstraction + FastAuth as the universal UX layer for ALL user interactions. Zero blockchain exposure for operators. Complete abstraction from Phase 1 through Phase 12.

</chain_abstraction>

<notes>
## Additional Context

The transparent privacy layer is key to the developer experience - the system should "just work" with security handled automatically based on data classification. This abstraction is what enables rapid development of coalition features without every developer needing to understand TEE internals.

The emphasis on all three foundational elements being equally important reflects the reality that this is a defense system - partial security or incomplete integration isn't acceptable even in v1.

</notes>

---

*Phase: 01-foundation-infrastructure*
*Context gathered: 2026-01-11*
