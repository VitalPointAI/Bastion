# Project State

## Project Reference

See: [.planning/PROJECT.md](.planning/PROJECT.md) (updated 2026-01-11)

**Core value:** End-to-end AI-enabled automation of the complete planning cycle that leads to physical demonstration of strategy-to-autonomous-execution with verifiable human control over lethal decisions.

**Current focus:** Phase 4 — Strategic Planning Module

## Current Position

Phase: 4 of 12 (Strategic Planning Module)
Plan: 1 of TBD in current phase
Status: In progress
Last activity: 2026-01-17 — Completed 4-01-PLAN.md (Document Ingestion Pipeline)

Progress: ███░░░░░░░ ~28% (Phase 4 started)

## Performance Metrics

**Velocity:**
- Total plans completed: 24
- Average duration: 16 min
- Total execution time: 6.6 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 1 (Foundation & Infrastructure) | 8 | 226 min | 28 min |
| 2 (Identity & Security) | 8 | 57 min | 7 min |
| 3 (DAO Governance) | 8 | 108 min | 14 min |
| 4 (Strategic Planning) | 1 | 5 min | 5 min |

**Recent Trend:**
- Last 5 plans: 8 min, 9 min, 12 min, 47 min, 5 min
- Trend: Phase 4 started with document ingestion pipeline

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

**Phase 1 Plan 1 (NEAR Contract Foundation):**
- State versioning: Inline state_version field instead of enum-based approach (borsh macro compatibility)
- Rust toolchain: Pinned to 1.88.0 for WASM compatibility with NEAR runtime
- Testing: Unit tests provide coverage while workspaces sandbox has WASM compatibility issues

**Phase 1 Plan 2 (Frontend & Authentication):**
- Application naming: BASTION (Blockchain Autonomous Strategy & Tactical Intelligence Operational Network)
- Authentication provider: Privy.io for Web2-style login with blockchain abstraction
- Frontend stack: Vite + React 19 + TypeScript 5.9 + pnpm

**Phase 1 Plan 3 (IPFS & Encrypted Storage):**
- IPFS provider: Pinata for managed pinning and reliable gateways
- Encryption: ChaCha20-Poly1305 AEAD cipher from @noble/ciphers (audited, fast)
- Architecture: Large files → IPFS (off-chain), encrypted CIDs → NEAR (on-chain provenance)

**Phase 1 Plan 4 (Backend Security Migration):**
- Security fix: Moved all sensitive operations from frontend to secure backend API
- Backend stack: Node.js/Express with TypeScript, sealed secrets in .env
- Verifiable Zero Trust architecture restored

**Phase 1 Plan 3A (PostgreSQL Hybrid Storage):**
- Hybrid storage architecture: PostgreSQL (fast queries) + NEAR (verification) + IPFS (large files)
- Dual-write pattern with transactional outbox (pg-boss background worker)
- Offline-first edge sync for DDIL environments

**Phase 1 Plan 5 (NEAR-Phala Integration):**
- Transparent privacy routing: Public → on-chain, Secret/TopSecret → Phala TEE
- Attestation verification framework with 4-step validation
- AI context security with ephemeral storage for classified data

**Phase 1 Plan 6 (Chain Signatures & Intents):**
- MPC contract: v2.multichain-mpc.testnet (active Chain Signatures network)
- Intent types: transfer, mission_order, document_verification
- MPC recovery: deterministic key derivation from Privy user ID
- Complete blockchain abstraction achieved (zero crypto terminology in UI)

**Phase 1 Plan 6-FIX (UAT Issue Fixes):**
- Chain Signatures uses root key + path-at-signing derivation pattern (not per-user keys upfront)
- MPC root key stored per user to track key version at registration time
- On-chain AddKey requires Phase 2 key management implementation

**Phase 1 Plan 7 (Containerization & Dev Environment):**
- Multi-stage Dockerfiles for backend (Node.js 20-slim) and frontend (dev/prod targets)
- docker-compose with healthcheck-based dependencies
- Comprehensive DEVELOPMENT.md with architecture diagrams and troubleshooting
- Component-specific READMEs for frontend, backend, near-contracts

**Phase 1 Plan 7-FIX (UAT Issue Fixes):**
- Added Vision section to root README explaining project purpose
- Added "Role in the System" statements to all component READMEs
- Fixed docker-compose env override issue during UAT
- Fixed accounts.ts to use shared database pool (was breaking docker networking)
- Fixed MPC contract ID from v1.signer-dev.testnet to v1.signer-prod.testnet

**Phase 2 Plan 1 (Encrypted DID Registry):**
- Blinded keys (32-byte HKDF output) prevent DID correlation attacks
- No entity type index to prevent organizational structure inference
- Only owner, timestamps, and active status public (minimal leakage)
- 24-byte nonce for ChaCha20-Poly1305 / XChaCha20 compatibility

**Phase 2 Plan 2 (Encrypted Credential Registry):**
- Dual-key system: blinded_credential_id for lookup, blinded_revocation_key for status checks
- Status codes as u8 (0=Active, 1=Revoked, 2=Suspended) for gas efficiency
- No subject/issuer/type indexes to prevent relationship inference
- Revocation irreversible; suspension is reversible

**Phase 2 Plan 3 (Backend DID Resolution):**
- HKDF with SHA256 for blinded key derivation using @noble/hashes
- ChaCha20-Poly1305 for DID document encryption (consistent with Phase 1 IPFS encryption)
- Separate encryption key from blinded lookup key for security separation
- utf8ToBytes for converting context strings to Uint8Array in HKDF

**Phase 2 Plan 4 (ABAC Core Implementation):**
- TypeScript implementation for type-safe policy evaluation instead of pure Casbin rules
- Classification hierarchy as numeric levels (UNCLASS=1 through TOPSECRET=5)
- FVEY expansion: automatically includes USA, GBR, CAN, AUS, NZL when REL TO FVEY
- Exported CLASSIFICATION_LEVELS and FVEY_NATIONS constants for reuse

**Phase 2 Plan 5 (PQC Utilities):**
- Hybrid mode (PQ + classical) for defense in depth until @noble/post-quantum audit completes
- XOR + HKDF for combining PQ and classical shared secrets
- Canonical JSON serialization (sorted keys) for deterministic credential signatures

**Phase 2 Plan 6 (W3C Verifiable Credentials):**
- Five credential types: SecurityClearance, EntityAttribute, RoleAssignment, CoalitionMembership, DerivativeData
- DerivativeDataCredential for tracking provenance of redacted/sanitized data objects
- SHA256 hashing with @noble/hashes (consistent with rest of codebase vs crypto-js)
- Canonical JSON serialization (sorted keys) for deterministic hashes

**Phase 2 Plan 7 (Zero Trust Middleware):**
- Support DID in Authorization header, X-DID header, and query param for flexibility
- 1-minute TTL cache for subject attributes balancing performance vs credential revocation
- Deny by default: missing attributes returns null, blocking access
- Audit log access denials without revealing denial reason to client

**Phase 2 Plan 8 (Frontend Identity Integration):**
- Deterministic user secret derivation from account ID via HKDF for automatic DID creation
- ESM module resolution requires explicit `.js` extensions in TypeScript imports
- Graceful degradation: DID creation failure doesn't block login flow
- Migrated from deprecated near-api-js to modern @near-js/providers package
- Dynamic imports for @noble/hashes need `.js` suffix (e.g., `@noble/hashes/hkdf.js`)

**Phase 3 Plan 1 (DAO Core Module):**
- StrikeAuthorization proposals always NotAutonomous regardless of config or override
- AutonomyLevel defaults to NotAutonomous (human-in-loop) for maximum safety
- Composite string keys (dao_id:proposal_id) for efficient multi-DAO storage
- State machine: InProgress → Approved/Rejected/Removed/Expired/Failed (terminal states)

**Phase 3 Plan 2 (Role & Permission System):**
- Stateless PermissionChecker operates on references to RoleManager and CredentialRegistry
- Agent tier ordering: NotAgent < SupportAgent < RepresentAgent < OrganizeAgent
- Default roles on DAO creation: council (full perms, humans only), member (basic voting), agent (limited)
- Permission format: {ProposalKind}:{Action} with wildcard support (*:*, Kind:*, *:Action)

**Phase 3 Plan 3 (Voting Engine):**
- VotingEngine with pluggable policies per (dao_id, proposal_kind)
- WeightKind: TokenWeight, RoleWeight (default), Equal
- ThresholdKind: Absolute count or Ratio-based thresholds
- Default policies: StrikeAuth=100%/100%, ConfigChange=67%/50%, Transfer=50%/25%
- Three autonomy flows: Autonomous (immediate), SemiAutonomous (veto window), NotAutonomous (human approval)
- STRIKE_AUTHORIZED special audit event for lethal decision tracking

**Phase 3 Plan 4 (DAO Linkages & Integration):**
- DAOLinkageManager with hierarchical parent-child relationships
- CrossDAORequirement with AllRequired, MajorityRequired, AnyOne types
- CoalitionProposal for multi-party approvals (Five Eyes, NATO patterns)
- Inherited membership: account is member if member of any parent DAO
- Full contract integration: 30+ public methods, 258 tests passing
- Proposal IDs 0-indexed, coalition membership verification deferred to production

**Phase 3 Plan 5 (Backend DAO API):**
- DAOService with view methods and transaction builders for NEAR contract
- REST API endpoints for DAO, proposals, voting, coalition, roles
- Classification filtering maps Public/Secret/TopSecret to UNCLASS/SECRET/TOPSECRET
- Express 5.x route params require explicit `as string` type assertions
- Unsigned transaction return pattern for frontend wallet signing

**Phase 3 Plan 6 (Agent Infrastructure):**
- StrikeAuthorization always in requiresHumanApproval for ALL agents (safety invariant)
- Four default Support-phase agents: governance-copilot, proposal-screener, context-analyzer, feasibility-assessor
- Capability handlers are stubs - real AI integration deferred to Governance Copilot (3-08)
- Effective autonomy = min(agent.maxAutonomy, delegation.maxAutonomy, DAO default)
- NEAR AI Governance Framework phases: Support → Represent → Organize

**Phase 3 Plan 7 (Frontend DAO Components):**
- TypeScript erasableSyntaxOnly: use const objects with type aliases instead of enums
- TypeScript verbatimModuleSyntax: split imports into type-only and value imports
- Navigation without react-router: useState-based view switching in App.tsx
- Commander-focused UX: action required badges, urgency indicators, classification badges
- Autonomy level color coding: green (autonomous), yellow (semi), red (human-required)

**Phase 3 Plan 7-FIX (UI Visual Polish):**
- CSS custom properties (variables) for consistent theming across all components
- Full-viewport layout: removed centering constraints that cramped content
- Command-center grade dashboard with grid overlay, corner brackets, pulse animations
- Premium styling: gradients, glows, hover effects, shine animations
- Strike authorization styling with pulsing red glow for lethal decision emphasis
- Classification badges: UNCLASS (green), SECRET (amber), TOPSECRET (red with glow)
- Responsive design with mobile breakpoints at 768px and 480px

**Phase 3 Plan 8 (Governance Copilot Integration):**
- Rule-based analysis for v1, LLM integration in later phases
- GovernanceCopilot class with summarizeProposal, analyzeContext, generateVotingGuidance
- Never provide recommendations for StrikeAuthorization proposals (safety invariant)
- CopilotPanel with 5-minute cache TTL for analysis results
- VotingGuidance capability added to agent capabilities enum

**Phase 4 Plan 1 (Document Ingestion Pipeline):**
- Use unpdf for PDF extraction (not custom parser)
- Use officeParser for DOCX/Office formats
- 8000 character default chunk size for LLM context limits
- 50MB max upload size limit
- Strategic document hierarchy levels: NSS, NDS, NMS, GEF, JSCP, CAMPAIGN_PLAN, OTHER

### Deferred Issues

See `.planning/ISSUES.md` for full issue log:
- **ISS-001:** Interactive AI Chat Assistant Sidebar (Phase 3-08 enhancement)
- **ISS-002:** Pinata API 403 Error (from 1-04)

### Blockers/Concerns

None.

## Session Continuity

Last session: 2026-01-17
Stopped at: Completed 4-01-PLAN.md (Document Ingestion Pipeline)
Resume file: None
Next action: Execute 4-02-PLAN.md or next plan in Phase 4
