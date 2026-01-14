# Phase 2: Identity & Security Framework - Context

**Gathered:** 2026-01-14 (updated from 2026-01-11)
**Status:** Ready for research

<vision>
## How This Should Work

Security should feel invisible until the moment you need to prove something. The system handles heavy cryptography behind the scenes — DIDs, signatures, attestations — but users don't think about it during normal operation. When proof is required (accessing classified content, authorizing actions, sharing across organizations), verification is there, rock-solid and immediate.

**Universal Identity** is the core architectural principle. Everything in the system gets an identity — not just humans, but AI agents, vehicles, weapons, disposables, and resources. The identity layer treats all entities the same, enabling:
- Unified tracking across the platform
- Dynamic inclusion/exclusion from operations
- Real-time analytics on any entity type
- Fine-grained ABAC that works identically whether it's a human approving an order or an AI agent requesting sensor data

**Event-Driven Onboarding** — Entity management must be intuitive. When a new vehicle comes online or an AI agent spins up, the system notices and proposes registration. Automatic discovery is the primary UX — the system watches for presence changes and triggers workflows. API-first for programmatic automation, simple UI for manual cases when needed. Adding and removing identities should be as natural as the entities entering and leaving the operational space.

DIDs form the foundation that feeds into attribute-based access control. When a commander accesses intelligence data, when an AI agent processes classified information, when a coalition partner requests mission status - the system transparently checks their DID attributes (clearance level, nationality, role, mission assignment) against the data's access policy and either grants or denies access invisibly.

Military users authenticate with their CAC/PIV cards, coalition partners use their national identity systems, and everyone ends up with a blockchain DID that enables cross-organizational verification without requiring trust in any central authority. The security is mathematically provable, not policy-based.

</vision>

<essential>
## What Must Be Nailed

All of these are foundational pillars - can't compromise on any:

- **Universal W3C DID Identity** - Every single entity type gets a DID: humans, AI agents, assets, missions, data objects, organizations, resources, vehicles, weapons, disposables. Complete auditability with cryptographic proof of identity for everything. The identity layer must treat all entity types uniformly — no special cases for humans vs machines vs resources.

- **ABAC with Comprehensive Attributes** - Access control based on classification level (UNCLASS through TS/SCI), nationality and coalition caveats (REL TO, NOFORN), role and organization, and dynamic mission context. Rich attribute model from day one.

- **Verifiable Zero Trust (All 5 Layers)** - Complete implementation: Layer 1 (execution environment/TEE), Layer 2 (code/agent logic), Layer 3 (models/weights), Layer 4 (user data/interfaces), Layer 5 (runtime behavior/outputs). Trust terminates at cryptographic proof, not policies or institutions.

- **Post-Quantum Cryptography Throughout** - Not future-proofing, not designing for it - actually implementing PQ crypto (CRYSTALS-Kyber, CRYSTALS-Dilithium) at every layer in Phase 2. Long-term classified data protection requires it from the foundation.

- **On-Chain Verification** - All credential verification happens on NEAR blockchain via smart contracts. Cryptographic proof on-chain, transparent and auditable. No off-chain verification dependencies.

- **Flexible Authentication** - Support CAC/PIV cards for US military users AND coalition partner identity systems. Parallel authentication paths that all map to blockchain DIDs.

- **Invisible Security** - Users shouldn't think about security policies or access controls. System automatically enforces based on their DID attributes and data classification. Security works transparently in the background.

</essential>

<boundaries>
## What's Out of Scope

- **Production Security Accreditation** - Implement proper patterns, controls, and architecture for multi-level security, but formal ATO (Authority to Operate) certification process is post-v1. Phase 2 demonstrates security architecture with proper controls using unclassified data.

- **Advanced Identity Features** - Biometric enrollment systems, complex federated SSO beyond Privy integration, advanced credential lifecycle management. Core identity working correctly is the goal; sophisticated identity features can wait.

- **Context Graph Implementation** - DIDs become the foundation nodes for the context graph architecture, but building the actual graph relationships and accumulated intelligence system is a future phase.

- **Enterprise-Scale Deployment** - Focus on functional security architecture in dev/testnet environments. Production hardening, high availability, disaster recovery for identity/security systems deferred.

- **Full Coalition Classification Schemes** - Implement core ABAC patterns and demonstrate with US classification levels. Comprehensive NATO, Five Eyes, bilateral marking systems expanded in Phase 12 (Coalition & Multi-Tenancy).

</boundaries>

<specifics>
## Specific Ideas

- **Event-Driven Entity Discovery** - System watches for presence changes and proposes registration automatically. When something enters the operational space (vehicle powers on, AI agent spins up, new resource created), the system detects it and handles identity creation. Three onboarding paths: automatic discovery (primary), API-first for programmatic automation, simple UI for manual cases. Removal is equally intuitive — entities leaving the system trigger cleanup workflows.

- **Automatic DID Creation** - System handles DID creation transparently. Create a mission → it gets a DID. Deploy an AI agent → it gets a DID. Register a vehicle → it gets a DID. Users never manually "create identities."

- **DIDs Feed ABAC** - Identity system is the foundation for the security layer. Every access decision queries the DID registry for attributes, then evaluates ABAC policies. Identity and security are tightly integrated, not separate systems.

- **Modular @near-js Packages** - Use current NEAR JavaScript SDK with split modules (@near-js/accounts, @near-js/crypto, @near-js/providers, etc.), not deprecated near-api-js monolith.

- **Smart Contract Registry** - NEAR Rust smart contract manages universal DID registry with entity type indexing, verifiable credential issuance/verification, and revocation support.

- **W3C DID Standard** - Follow W3C DID specification using did:near method. Enables coalition partners to verify identities cryptographically without trusting central authority. Critical for multi-national operations.

- **Invisible Experience** - Security indicators hidden unless user explicitly requests them. No constant reminders about classification levels or access policies. System just works or gracefully denies with simple explanation.

</specifics>

<notes>
## Additional Context

This phase creates the complete security foundation that every subsequent phase builds upon. Phase 3 (DAO Governance) depends on Phase 2's identity system for membership and voting. Phase 4+ reference DIDs for all entities they create. Phase 7 (Tactical Execution) relies on ABAC for mission authorization. Phase 12 (Coalition) extends the classification schemes but doesn't rebuild the foundation.

The comprehensive scope (universal DIDs, full ABAC, complete verifiable zero trust, PQ crypto) reflects that security cannot be retrofitted. It must be foundational. Getting this right in Phase 2 enables every subsequent phase to build securely on top.

The integration of identity and security as a unified system (DIDs feeding ABAC, verifiable zero trust spanning execution through runtime) creates a coherent foundation rather than separate identity and security systems bolted together later.

</notes>

---

*Phase: 02-identity-security-framework*
*Context gathered: 2026-01-14 (updated from 2026-01-11)*
