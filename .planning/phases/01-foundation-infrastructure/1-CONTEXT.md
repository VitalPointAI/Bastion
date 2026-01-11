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

<notes>
## Additional Context

The transparent privacy layer is key to the developer experience - the system should "just work" with security handled automatically based on data classification. This abstraction is what enables rapid development of coalition features without every developer needing to understand TEE internals.

The emphasis on all three foundational elements being equally important reflects the reality that this is a defense system - partial security or incomplete integration isn't acceptable even in v1.

</notes>

---

*Phase: 01-foundation-infrastructure*
*Context gathered: 2026-01-11*
