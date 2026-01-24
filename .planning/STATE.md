# Project State

## Project Reference

See: [.planning/PROJECT.md](.planning/PROJECT.md) (updated 2026-01-11)

**Core value:** End-to-end AI-enabled automation of the complete planning cycle that leads to physical demonstration of strategy-to-autonomous-execution with verifiable human control over lethal decisions.

**Current focus:** Phase 4.4 (Mission Context & Force Onboarding) — Workspace setup, participant invitation, command relationships, resource inventories, sensor registration

## Current Position

Phase: 4.4 of 13+ (Mission Context & Force Onboarding) — IN PROGRESS
Plan: 7 of 8 in current phase (IN PROGRESS)
Status: In Progress
Last activity: 2026-01-24 — Completed 4.4-03-PLAN.md (Mission Creation Wizard)

Progress: ████████░░ 87.5% (7/8 plans complete in phase 4.4)

## Performance Metrics

**Velocity:**
- Total plans completed: 65
- Average duration: 12 min
- Total execution time: 12.6+ hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 1 (Foundation & Infrastructure) | 8 | 226 min | 28 min |
| 2 (Identity & Security) | 8 | 57 min | 7 min |
| 3 (DAO Governance) | 8 | 108 min | 14 min |
| 4 (Strategic Planning) | 10 | 95 min | 10 min |
| 4.1 (Admin UI) | 2 | 14 min | 7 min |
| 4.2 (AI Agent Teams) | 6 | 78 min | 13 min |
| 4.3 (Strategic Intelligence Fusion) | 11 | 71 min | 6 min |
| 4.4 (Mission Context & Force Onboarding) | 7 | 41 min | 6 min |
| 13 (Research Whitepaper) | 9 | 59 min | 7 min |

**Recent Trend:**
- Last 5 plans: 11 min, 12 min, 4 min, 4 min, 6 min
- Trend: Phase 4.4 nearing completion - Mission wizard with map-based AO drawing ready

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

**Phase 4 Plan 2 (Strategic Planning Data Model):**
- All Zod fields use .describe() for LLM extraction hints with Instructor-JS
- 5x5 risk matrix implemented as lookup table with calculateRiskLevel helper
- Commander's intent includes Klein's 7 facets for robust intent communication
- DIMEFIL extends DIME with Financial, Intelligence, Law Enforcement
- Doctrine-driven data model: schemas map directly to JP 5-0 and CJCSM 3105.01

**Phase 4 Plan 3 (LLM Objective Extraction):**
- Native Anthropic tool_use instead of Instructor-JS due to Zod 4.x compatibility issues
- Manual JSON Schema definition for extraction tool (zod-to-json-schema incompatible with Zod 4.x)
- Sequential chunk processing with 500ms delay to respect API rate limits
- Jaccard similarity deduplication with 80% word overlap threshold for duplicate objectives

**Phase 4 Plan 3-FIX (LLM Provider Abstraction):**
- LLMProvider interface with provider-agnostic complete() method
- Single OpenAI-compatible provider covers OpenAI, NEAR AI, Ollama, LocalAI, vLLM
- createProvider() factory with DEFAULT_CONFIGS for 8 providers
- ExtractionService backward compatible (defaults to Anthropic)

**Phase 4 Plan 4 (Approval Workflow Engine):**
- XState v5 setup() API for type-safe machine definition
- Auto-persistence via actor subscription for every state transition
- workflow_states table for snapshot storage, workflow_events for audit trail
- XState actor pattern: createActor with optional snapshot restoration

**Phase 4 Plan 5 (Risk Assessment Framework):**
- Risk matrix as 2D array indexed by LIKELIHOOD_ORDER/IMPACT_ORDER
- Decision authority mapped per military doctrine (Staff officer → Commander)
- Auto-flags: HIGH_RISK, LOW_CONFIDENCE, MULTIPLE_UNCERTAINTIES, NO_MITIGATIONS, CATASTROPHIC_IMPACT
- Lazy singleton via getRiskAssessmentService() for runtime API key configuration

**Phase 4 Plan 6 (Strategic Planning API):**
- ObjectiveStore uses batch insert for LLM extraction results
- IntentStore implements Klein's 7 facets of intent communication
- Operationalization requires APPROVED status, reviewed risk, and drafted intent
- Planning directive JSON output for Phase 5 handoff

### Roadmap Evolution

- Phase 4.1 inserted after Phase 4: Admin UI (URGENT) - Create administrative interface for system configuration and management
- Phase 4.2 inserted after Phase 4.1: AI Agent Teams - Per-agent model assignment, dynamic agent creation, agent DIDs
- Phase 1.1 inserted after Phase 1: Calimero Self-Sovereign App Integration (URGENT) - Research Calimero for DAO compartmentalization, replace Privy with NEAR accounts + MPC
- Phase 13 added: Research Whitepaper - Comprehensive documentation for master's research requirement (advisor deliverable)
- Phase 4.4 inserted after Phase 4.3: Mission Context & Force Onboarding - Workspace setup, participant invitation, command relationships, resource inventories, sensor registration with map overlays
- Phase 4.5 inserted after Phase 4.4: ATAK/CoT Tactical Interoperability - CoT message protocol, TAK Server integration, real-time position sharing, data package export

### Deferred Issues

See `.planning/ISSUES.md` for full issue log:
- **ISS-001:** Interactive AI Chat Assistant Sidebar (Phase 3-08 enhancement)
- **ISS-002:** Pinata API 403 Error (from 1-04)

### Blockers/Concerns

None.

**Phase 4 Plan 6-FIX (Strategic API Table Init Fix):**
- Unified lazy init: all strategic API tables initialized from single ensureTableExists()
- Added initRiskAssessmentTable() and workflowEngine.initialize() calls
- Risk and workflow endpoints now work without manual table creation

**Phase 4 Plan 7 (Admin Configuration System):**
- ADMIN_DIDS env var for simple system admin access control (DID whitelist)
- 5-minute cache TTL for config reads with selective invalidation
- Automatic encryption for sensitive fields (apiKey, secret, password, token, webhook)
- API key masking shows last 4 chars only in responses
- Config audit trail logs previous/new values with reason

**Phase 4 Plan 7-FIX (UAT Issue Fix):**
- Fixed DELETE OSINT endpoint to handle missing request body
- Use optional chaining for reason extraction: `req.body?.reason`

**Phase 4 Plan 8 (Strategic Planning AI Agents):**
- AgentOutput wrapper with quality metadata (confidence, source diversity, contradictions, uncertainty flags)
- Human checkpoints for all analysis outputs with PENDING/IN_REVIEW/APPROVED/REJECTED workflow
- PMESII-PT framework for operational environment analysis
- Three-tier agent architecture: Collection (OSINT, Threat), Analysis (Fusion), Orchestration
- questionsForReviewer field for human-in-the-loop guidance

**Phase 4.1 Plan 1 (Admin UI Foundation):**
- Orange accent color for admin UI to differentiate from blue operational interface
- Admin button always visible; access denial handled gracefully inside AdminDashboard
- react-tabs for tab navigation (simpler than custom implementation)

**Phase 4.1 Plan 1-FIX (Admin UI UAT Fixes):**
- UserContext pattern for propagating user identity across app
- AuthWrapper restructured to wrap entire app (header + main) for context access
- UserStatusBar in header with compact display and dropdown for details
- AdminDashboard consumes userDID from context before checking admin access

**Phase 4.2 Plan 1 (Backend Schema for Per-Agent Model Config):**
- Per-agent configs use key pattern `agents.{agentId}.model`
- AgentModelConfig includes useGlobalDefault flag for fallback behavior
- DID fields (agentDID, agentBlindedKey, agentPublicKey) added to AgentManifest

**Phase 4.2 Plan 2 (Agent DID and API Endpoints):**
- Agent DID format: did:near:agent-{agentId}
- Deterministic keys via HKDF with 64-byte derivation (32 blinded + 32 public)
- AgentRegistry uses ensureInitialized() for async DID generation
- Admin CRUD endpoints at /api/admin/agents for agent management

**Phase 4.2 Plan 3 (Frontend Per-Agent Config UI):**
- Expandable card pattern for per-agent configuration in Agents tab
- "Use Global Default" toggle controls custom vs inherited LLM config
- Separate tabs in AgentManagementPanel: Create Agent form and JSON file upload
- JSON upload with drag-drop, validation preview before submission

**Phase 4.2 Plan 4 (Agent Builder, MCP Tools & Team Composition):**
- Eliza-compatible character definitions (bio, lore, knowledge, style, examples)
- MCP Tool Registry with JSON Schema input/output and DID generation
- Agent Team Registry with workflow types (sequential, parallel, consensus, hierarchical)
- Team roles: coordinator, specialist, validator, executor with escalation policies
- DID formats: did:near:tool-{toolId}, did:near:team-{teamId}
- System prompt generation from character traits via character-builder.ts

**Phase 4.2 Plan 5 (Secure Message Bus with ABAC Enforcement):**
- Messages are immutable - only delivery status appended, never content modified
- ABAC enforcement at delivery time (lazy evaluation) not publish time
- pg-boss for reliable delivery with dead letter queue support
- Default 24-hour TTL for messages, 1MB max payload size
- MessageEnvelope: Standard structure for all inter-component messages
- Per-agent AgentMessenger instances for typed communication
- System channels for lifecycle/workflow/security events

**Phase 4.2 Plan 6 (LangGraph Orchestration Layer):**
- LangGraph checkpoints use isolated `langgraph_checkpoints` PostgreSQL schema
- Classification filtering at delivery time (lazy evaluation) not publish time
- Pre-handoff filtering: every agent handoff goes through classification filter
- Human checkpoints publish to system.human-checkpoints channel via message bus
- LangChain ecosystem for orchestration (@langchain/langgraph, @langchain/core)

**Phase 4 Plan 9 (End-to-End Strategic Flow):**
- Document detail navigation to/from dashboard
- Extraction trigger with streaming progress via SSE
- Objective list displays in dashboard when document selected
- Extraction completion refreshes document with objective count

**Phase 4 Plan 10 (Objective Detail View & MIDLIFE Categorization):**
- ObjectiveDetail component with tabbed navigation (Overview, DIME/MIDLIFE, EWM, Risks)
- MIDLIFE category selector with visual legend
- Commander's EWM editing via ObjectiveDetail
- Risk extraction via LLM with auto-flagging

**Phase 4 Plan 11 (Strategic Analysis MCP Tools & Review Agent):**
- Rule-based MIDLIFE categorizer and domain prioritizer tools
- Strategy Document Review Agent (definition, executor, API)
- Document-agent assignment system with database schema
- Auto-review hook triggered on extraction completion
- Review UI components (ReviewReport, ReviewPanel, AgentBadges)
- Note: Tools are rule-based, not AI-powered (addressed in 4-12)

**Phase 4 Plan 12 (LangGraph Agent Framework Integration):**
- LLM Factory with dynamic instantiation per agent configuration
- Supports Anthropic, OpenAI, Azure OpenAI, NEAR AI, local (Ollama)
- LangChain tool wrappers for existing rule-based MIDLIFE/prioritize tools
- Strategy Reviewer LangGraph with load → analyze → prioritize → report flow
- Human-in-the-loop checkpointing with PostgreSQL storage
- Agent seeder auto-registers strategy-document-reviewer on startup
- SSE streaming endpoint for real-time agent reasoning progress
- System prompt generation from character definitions
- Agent Builder wizard for creating agents with personality/tools/LLM config

**Phase 4.3 Plan 1 (Neo4j Infrastructure):**
- Neo4j 2025 Community in Docker with health checks and memory limits
- neo4j-driver v6 TypeScript client with lazy singleton pattern
- Query helpers: executeGraphQuery, executeReadQuery, executeWriteQuery
- Graceful shutdown hooks integrated in backend/src/index.ts

**Phase 4.3 Plan 2 (RAFT Graph Schema):**
- UUID prefixes for entity types: ACT-, REL-, TEN-, FUN-
- Full-text index on actor name only (Neo4j doesn't support arrays in full-text)
- Graph store pattern: classes with static methods for CRUD operations
- Entity merge pattern for actor resolution workflows

**Phase 4.3 Plan 4 (Graph Construction Pipeline):**
- Sequential LLM extraction: actors first, then relationships and tensions with actor context
- Error accumulation: collect errors without stopping pipeline to maximize data extraction
- Actor resolution: case-insensitive matching with partial match fallback
- Entity deduplication: optional resolution run at end of document processing

**Phase 4.3 Plan 5 (Strategic Fusion Agents):**
- EndsWaysMeans follows full JP 5-0 doctrine structure (nested objects, not simple strings)
- Agent character knowledge arrays contain domain-specific abbreviations and resolution rules
- MCP tools registered before agents in seeder to ensure availability during assignment
- Entity resolution agent conservative by design: 0.85 confidence threshold for auto-match

**Phase 4.3 Plan 6 (OSINT Integration):**
- Validity base score 70 when no evidence exists (moderate confidence baseline)
- Recency decay over 90 days (min 20% weight) for evidence weighting
- Alert thresholds: ±20 points = medium, ±30 points = high, <30 score = critical
- Evidence linking uses upsert with unique constraint on (objective_id, event_id)

**Phase 4.3 Plan 7 (Intelligence Analysis Agents):**
- Conflict Detection Agent is NOT_AUTONOMOUS - all assessments require human review
- OSINT Monitor uses conservative relevance scoring to avoid false positives
- Source reliability A-F scale for OSINT evaluation
- Three single-responsibility agents: OSINT Monitor, Validity Assessment, Conflict Detection

**Phase 4.3 Plan 8 (RAFT Graph Agents & Tools):**
- Graph algorithms as Cypher approximations (no Neo4j GDS dependency required)
- Conservative extraction approach: default weight 0 unless evidence supports stronger value
- 8 RAFT tools: create_actor, create_relationship, create_tension, update_edge_weight, query_graph, run_graph_algorithm, get_actor_profile, export_graph_visualization
- RAFT Extraction Agent with PMESII domain knowledge for entity identification
- RAFT Reasoning Agent with network science expertise for strategic insights

**Phase 4.3 Plan 9 (Workspace Isolation & Graph REST API):**
- Workspace types: country, adversary, region, topic, coalition, custom
- Hierarchical workspaces via parentWorkspaceId with cross-references via linkedWorkspaceIds
- Master view aggregates across all accessible workspaces by classification
- 25+ REST API endpoints for workspaces, actors, tensions, OSINT, validity, resolution, graph construction

**Phase 4.3 Plan 10 (Validity Dashboard UI - Graph Components):**
- react-force-graph-2d for force-directed layout with D3 simulation
- Custom canvas rendering for nodes with type-based color coding
- GraphExplorer with filtering by actor type and relationship type
- NodeDetailPanel with tabbed interface (Overview, Relationships, Tensions)

**Phase 4.3 Plan 11 (End-to-End Fusion Flow):**
- Fullscreen layout: map/graph takes entire viewport minus floating header
- Floating info panel as toggleable overlay (not permanent sidebar)
- react-leaflet with Stadia dark tiles (no API key required)
- Safe JSON fetching helper to handle 404 HTML responses gracefully
- View mode toggle: Map, Graph, Split views for flexibility

**Phase 4.4 Plan 1 (Mission Data Foundation):**
- Mission state machine enforces valid transitions: planning → active → complete → archived
- Invite tokens use SHA256 hashing for secure storage and lookup (72-hour default expiration)
- Command relationships prevent cycles using depth-first search validation
- Resource status follows military readiness reporting (FMC/PMC/NMC)
- All stores follow singleton pattern with lazy initialization via ensureInitialized()
- UUID-prefixed IDs for entity types: MSN-, INV-, UNIT-, REL-, RES-, PER-, CON-, SEN-
- GeoJSON Polygon custom interface for area of operations (avoiding @types/geojson dependency)

**Phase 4.4 Plan 3 (Mission Creation Wizard):**
- Step navigation pattern from AgentBuilderWizard reused for consistency across admin interfaces
- Map integration follows ValidityMap patterns (Stadia dark tiles, Leaflet icon defaults)
- Pending invites stored locally in wizard state, sent after mission creation
- GeoJSON Polygon custom interface maintained for dependency consistency
- Multi-step wizard: progress indicator, step validation, back/next navigation
- Map-based input: react-leaflet-draw with single polygon constraint for AO
- Role badge styling: commander (gold), staff (blue), observer (gray)

**Phase 13 Plan 1 (Whitepaper Foundation):**
- Stanford five-point introduction framework for academic problem framing
- Three human authority levels: in-the-loop, on-the-loop, out-of-the-loop
- [CITATION NEEDED] placeholder pattern for later sourcing
- Whitepaper directory at docs/whitepaper/ with numbered markdown files

**Phase 13 Plan 2 (Background - DAOs and Web3):**
- Blockchain explained conceptually without implementation details
- All technical terms defined on first use for general academic audience
- Gap analysis positioning BASTION's novel contribution
- Citation placeholders with specific source hints for easier filling

**Phase 13 Plan 3 (Background - Military & AI):**
- Levels of warfare (strategic/operational/tactical) with decision horizons
- C2, JADC2, DDIL challenges explained for general audience
- Coalition coordination challenges: caveats, release authority, information sharing
- Human authority positions: HITL, HOTL, HOOTL with military context
- Gap analysis table positioning BASTION against JADC2, NATO FMN, Military AI, Commercial DAOs
- Cross-references between background sections for document coherence

**Phase 13 Plan 4 (Methodology):**
- Four design principles: decentralization, transparency, AI augmentation, policy compliance
- Three-tier DAO architecture: Strategic, Operational, Tactical levels
- Design decisions table with alternatives and rationale for each major choice
- AI agent architecture: single-responsibility, graduated trust, Support/Represent/Organize phases
- Security architecture: zero trust, ABAC for coalitions, post-quantum considerations
- Human authority integration with strike authorization as hardcoded HITL special case
- System architecture Mermaid diagram with human authority positions indicated

**Phase 13 Plan 5 (Results):**
- E2E flow: strategic-operational-tactical with human authority positions at each stage
- Physical demonstration: Jetson Orin Nano + Sphero RVR+ in tabletop AO
- 4-act demo scenario: resource allocation, mission planning, tactical execution, cross-level coordination
- Strike authorization invariant: always requires human approval (100% threshold)
- Screenshot specifications for 4 workflow screenshots + physical demo photo
- Thesis validation: explicit mapping of demo outcomes to research question components

**Phase 13 Plan 6 (Discussion, Conclusion & Appendices):**
- Discussion: limitations (demo scope, tech maturity, operational realism), risks (technical, security, operational), ethics (autonomous weapons, AI transparency), future work
- Conclusion: directly answers research question, summarizes four contributions, emphasizes human authority preservation
- Appendix A SITREP: 55 completed plans across phases 1-4.3, MVP readiness assessment, remaining phase scope
- Appendix B Demo Script: 20-minute timestamped presentation with all three authority positions (HITL, HOTL, HOOTL)
- Strike authorization emphasized as inviolable human-in-the-loop requirement throughout

**Phase 13 Plan 7 (Abstract & Final Assembly):**
- Abstract: 279 words, standalone format (written last per academic convention), covers problem-approach-innovation-results-conclusion
- References: Zotero setup with Chicago Manual of Style 18th edition (note) format for bibliography population
- Assembly: Complete checklist for document order, pre-assembly verification, and Pandoc-based markdown-to-Word conversion
- Version control: Whitepaper v0.1 established as initial draft for advisor review cycle
- Documentation: ASSEMBLY.md provides clear instructions for citation replacement, figure insertion, and advisor feedback loop

**Phase 13 Plan 8 (GitBook Configuration & Deployment):**
- Publishing Platform: GitBook chosen for academic documentation with automatic GitHub integration
- Configuration: .gitbook.yaml at repository root pointing to docs/whitepaper/ with SUMMARY.md for navigation
- Deployment: Configuration pushed to GitHub master branch for automatic GitBooks detection
- User Setup: Documented 4-step process to link GitHub repository to GitBooks account
- Navigation: Hierarchical SUMMARY.md with front matter, main content, appendices, and meta sections

**Phase 13 Plan 9 (Export Scripts):**
- xelatex as PDF engine with pdflatex fallback for environments without XeTeX
- Version tag (v0.1) in export filename for release tracking
- exports/ directory gitignored to keep generated files out of version control
- Pandoc defaults file for consistent export settings across team

## Session Continuity

Last session: 2026-01-24 18:07:22Z
Stopped at: Completed 4.4-03-PLAN.md (Mission Creation Wizard)
Resume file: None
Next action: Continue Phase 4.4 with remaining plans - Mission wizard ready for app integration, command relationships and sensor registration next.
