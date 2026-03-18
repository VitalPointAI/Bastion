# Codebase Concerns

**Analysis Date:** 2026-03-18

---

## CRITICAL

### Encryption Keys Returned in API Response
- **Issue:** `/api/documents/upload` returns all encryption keys (`file_key`, `cid_key`, `classification_key`, `metadata_key`) in plaintext JSON to the client. Comment in code acknowledges this: "in production, these would be managed via TEE/key service."
- **File:** `backend/src/api/documents.ts` lines 70–75
- **Impact:** Any caller (or MITM) receives plaintext decryption keys. Classified content is therefore unprotected at rest on the client. This completely defeats the encryption scheme.
- **Fix approach:** Keys must never leave the server. Implement a TEE or server-side key registry (`backend/src/auth/prf-did-integration.ts` exists as a starting point). Return only the `document_id` and let the key service mediate decryption.

### Large Groups of API Routes With No Authentication
- **Issue:** Many high-sensitivity backend API routers are mounted without `requireAuth` at the index level and have zero per-route auth guards. Anyone on the network can call them.
- **Files (0 auth guards):**
  - `backend/src/api/brain.ts` — brain annotations, snapshots, NL search
  - `backend/src/api/graph.ts` — full RAFT actor/tension/OSINT graph, workspace CRUD
  - `backend/src/api/exercise.ts` — exercise/scenario/order CRUD (2197 lines)
  - `backend/src/api/command.ts` — command/unit relationships
  - `backend/src/api/orchestration.ts` — multi-agent task execution, human checkpoints
  - `backend/src/api/resources.ts` — resource registry CRUD (1052 lines)
  - `backend/src/api/sensors.ts` — sensor data writes
  - `backend/src/api/robot-routes.ts` — robot mission trigger/control (716 lines)
  - `backend/src/api/assessment-routes.ts` — MOE/MOP/METL assessment data
  - `backend/src/api/ingest.ts` — universal ingest pipeline
  - `backend/src/api/documents.ts` — document upload/list (with TODO: Verify authentication)
  - `backend/src/api/edge-sync.ts` — edge device sync (TODO: Authenticate edge device)
  - `backend/src/api/accounts.ts` — NEAR account creation (TODO: Verify Privy JWT)
  - `backend/src/api/agents.ts`, `backend/src/api/messaging.ts`, `backend/src/api/design.ts`, `backend/src/api/strategic-context.ts`, `backend/src/api/dao.ts` (uses `zeroTrustAuth()` per-route but only on write endpoints)
- **Impact:** Any unauthenticated request can read/write exercise data, trigger robot missions, ingest documents, manipulate OSINT graph, and access AI orchestration. Critical for a military platform.
- **Fix approach:** Apply `router.use(requireAuth)` at the top of each router file. Routes already in `index.ts` with `requireAuth` at mount point (e.g., `/api/ironclaw`, `/api/ai-staff`) are covered; expand that pattern to all other routers.

### Ironclaw HMAC Auth Bypassed When Secret Not Set
- **Issue:** `verifyRequest()` returns `true` when `IRONCLAW_SHARED_SECRET` env var is not set. In production, code emits a `console.warn` but still allows all requests. Ironclaw can trigger robot missions and execute agentic actions.
- **File:** `backend/src/ironclaw/hmac-auth.ts` lines 64–75
- **Impact:** If the env var is accidentally missing from production deployment, the entire robot/agent execution surface is open to any process on the Docker network.
- **Fix approach:** Add a startup assertion: if `NODE_ENV === 'production'` and `IRONCLAW_SHARED_SECRET` is null, crash the server. Use `backend/src/index.ts` startup sequence.

### OSINT Webhook Accepts Unsigned Requests in Dev
- **Issue:** POST `/api/osint/webhook/argus` skips HMAC signature verification entirely when `ARGUS_WEBHOOK_SECRET` is not configured. Mounting is at `app.use('/api/osint', osintWebhookRouter)` with no auth middleware.
- **File:** `backend/src/api/osint-webhook.ts` lines 31–50
- **Impact:** Any caller can inject fabricated OSINT events into the intelligence graph in dev, and potentially in production if env var is absent.
- **Fix approach:** Block requests without a signature header in all environments, not just when the secret is set. Require secret presence at startup validation.

---

## HIGH

### Hardcoded Role Bypasses in Frontend
- **Issue:** Multiple places pass `isCommander={true}` hardcoded rather than checking actual role from mission/membership context. One case combines real value with `|| true` making it always true.
- **Files:**
  - `frontend/src/components/dao/DAODashboard.tsx` line 278: `isCommander={isCommander || true}` — always renders as commander
  - `frontend/src/components/planning/PlanningDashboard.tsx` lines 281, 291, 307: `isCommander={true} // TODO: Check actual role from mission context`
- **Impact:** All users see commander-level UI controls regardless of their actual role. This bypasses role-gating for decision approval flows.
- **Fix approach:** Thread role from `DecisionGateContext` or the problem set membership data to these components. `DecisionGateContext` already resolves `canApprove: isCommanderRole` correctly in `frontend/src/context/DecisionGateContext.tsx` line 246.

### Default Dev Secrets Used at Runtime
- **Issue:** Multiple backend files fall back to hardcoded insecure default values when env vars are absent. These defaults could silently be used in production if env vars are missed.
- **Files:**
  - `backend/src/near/user-secret.ts` line 18: `DID_SECRET_SEED || 'dev-seed'`
  - `backend/src/agents/tool-did.ts` lines 36, 56: `ENCRYPTION_KEY || 'dev-secret-key'`
  - `backend/src/agents/agent-did.ts` line 25: `ENCRYPTION_KEY || 'dev-secret-key'`
  - `backend/src/resources/resource-did.ts` line 25: `ENCRYPTION_KEY || 'dev-secret-key'`
  - `backend/src/discovery/challenge-auth.ts` line 197: `ENCRYPTION_KEY || 'dev-secret-key'`
- **Impact:** DIDs and encrypted data derived using `'dev-secret-key'` are trivially decryptable if this default ever reaches production. Any DID created with `'dev-seed'` is derivable by anyone who reads the source code.
- **Fix approach:** Remove all fallback defaults for security-critical secrets. Throw at startup if not set. Add to startup env validation in `backend/src/index.ts`.

### Blockchain Integration Is Entirely Simulated
- **Issue:** All NEAR blockchain writes are stubs that generate fake `near:${Date.now()}` transaction hashes. This affects audit log integrity, ROE audit chain, MDMP workflow state, outbox sync, and ROE verification.
- **Files:**
  - `backend/src/lib/blockchain-sync.ts` line 40: `blockchainTxHash = 'near:${Date.now()}'`
  - `backend/src/planning/roe/audit.ts` line 140: `hash = 'near:roe-${Date.now()}-${Math.random()...'`
  - `backend/src/planning/roe/audit.ts` line 167: `verifyBlockchainRecord()` returns true for any string starting with `'near:'`
  - `backend/src/mdmp/workflow-service.ts` lines 119, 135, 168, 200, 248, 268, 303, 340: 10 blockchain call TODOs
- **Impact:** Any audit trail presented as "blockchain-verified" is actually unverifiable. The entire immutability and non-repudiation claim of the platform is non-functional.
- **Fix approach:** Implement real NEAR contract calls using `@near-js/providers`. Tracked in original plan 1-01. Gate blockchain-dependent features behind a `BLOCKCHAIN_ENABLED` flag that fails loudly rather than silently faking records.

### Runtime DDL: 51 Stores Run Their Own Schema Migrations
- **Issue:** 51 store classes run `CREATE TABLE IF NOT EXISTS` and `ALTER TABLE ADD COLUMN IF NOT EXISTS` on every server start, mixed with application logic. This runs in the same transaction/connection as normal queries.
- **Representative files:** `backend/src/inheritance/inheritance-store.ts` lines 42–215, `backend/src/resources/resource-store.ts` lines 35–65, `backend/src/design/design-store.ts` line 45, `backend/src/problem-set/problem-set-store.ts` line 61 — and 47 more with `ensureInitialized` pattern.
- **Impact:** Startup time grows proportionally. Concurrent server restarts can race on DDL. Schema changes are invisible to DBA tooling and to the formal migrations in `backend/src/db/migrations/`. Only 11 formal migration files exist but the real schema is spread across 51 `ensureInitialized` methods.
- **Fix approach:** Consolidate all DDL into numbered migration SQL files in `backend/src/db/migrations/`. Run migrations once via a startup migration runner, not on every request path.

### Wargaming Service Has No HTTP Routes and Stores State In-Memory Only
- **Issue:** `backend/src/wargaming/` has a full `WargamingService` and `WargamingEngine` but no route file and is never imported into `backend/src/index.ts`. Data is in-memory only (`private sessions: Map<string, WargamingSession>`).
- **Files:** `backend/src/wargaming/wargaming-service.ts` lines 29–32, `backend/src/wargaming/wargaming-engine.ts` lines 43–52
- **Impact:** Wargaming is completely unreachable from the frontend. All session state is lost on server restart. The TODO on line 29 states "migrate to PostgreSQL persistence for production."
- **Fix approach:** Add a wargaming router and mount it, or explicitly document this as Phase-gated. The in-memory state issue is tracked in the existing TODO at line 29.

### services/email.ts Is a Dead Module With No Callers
- **Issue:** `backend/src/services/email.ts` is a full AWS SES email service (imports, config, template usage) with zero import references in the rest of the backend. It is never called.
- **File:** `backend/src/services/email.ts`
- **Impact:** Dead code with AWS credential handling. Risk if someone begins using it without noticing the "TODO: Verify authentication" pattern prevalent in this codebase.
- **Fix approach:** Delete the file or wire it into a real auth email flow (magic links appear to be handled by `@vitalpoint/near-phantom-auth`).

---

## MEDIUM

### Dead Frontend Hooks: useAgentRouting and useInlineAnnotations
- **Issue:** Two hooks in `frontend/src/hooks/` have zero usages outside their own definition files. They are fully implemented but never called.
- **Files:**
  - `frontend/src/hooks/useAgentRouting.ts` — 0 usages
  - `frontend/src/hooks/useInlineAnnotations.ts` — 0 usages (uses dead `AIStaffContext` path)
- **Impact:** Dead code maintained for no purpose. `useInlineAnnotations` imports `AIStaffContext` which is being deprecated in favor of `IronclawContext`.
- **Fix approach:** Delete both files. `AIStaffContext` is transitioning out; any inline annotation feature should be rebuilt on `IronclawContext`.

### Dead Frontend Lib Files: ipfs.ts, encryption.ts, aiContext.ts, teeClient.ts, intents.ts, mpcRecovery.ts
- **Issue:** Six frontend library files have zero callers from application code. They contain placeholder/mock implementations.
- **Files:**
  - `frontend/src/lib/ipfs.ts` — 0 imports from app code; would need `VITE_PINATA_GATEWAY` set
  - `frontend/src/lib/encryption.ts` — only imported by `aiContext.ts` (also dead)
  - `frontend/src/lib/aiContext.ts` — only imported by `teeClient.ts` (also dead)
  - `frontend/src/lib/teeClient.ts` — 0 imports from app code; `clearTEESession` is a no-op stub with commented-out contract call
  - `frontend/src/lib/intents.ts` — 0 imports from app code; `createIntent`/`executeIntent` are fully mocked with `setTimeout`
  - `frontend/src/lib/mpcRecovery.ts` — 0 imports from app code
- **Impact:** ~500 lines of code giving a false impression of implemented features (TEE, NEAR Intents, IPFS frontend upload, MPC recovery). All are mock stubs.
- **Fix approach:** Delete all six. If features are needed later, implement from scratch against actual contracts/services.

### Duplicated STAFF_PRESET_TEMPLATES Constant
- **Issue:** `STAFF_PRESET_TEMPLATES` is defined identically in both `backend/src/exercise/types.ts` line 866 and `frontend/src/types/exercise.ts` line 276. The frontend copy explicitly notes it "Mirrors backend."
- **Impact:** If staff roles are updated, both files must be changed simultaneously. They will drift over time.
- **Fix approach:** Expose the template values via a lightweight API endpoint (`GET /api/exercise/presets`) so the frontend fetches them. Alternatively, generate a shared types package. Cannot directly import backend into frontend.

### Duplicate `getQueryString` Helper Defined 6 Times
- **Issue:** An identical 4-line utility function `getQueryString(value: unknown): string | undefined` is copy-pasted into 6 separate API route files.
- **Files:** `backend/src/api/brain.ts:20`, `backend/src/api/brain-subspaces.ts:35`, `backend/src/api/graph.ts:38`, `backend/src/api/command.ts:13`, `backend/src/api/sensors.ts:10`, `backend/src/api/resources.ts:23`
- **Fix approach:** Extract to `backend/src/api/utils.ts` and import from there.

### Duplicate `getConfidenceTier` Logic
- **Issue:** `getConfidenceTierForValue()` in `backend/src/api/graph.ts` line 29 is a local reimplementation of `getConfidenceTier()` from `backend/src/graph/provenance-types.ts` line 137. The comment in graph.ts says "Mirrors frontend getConfidenceTier()" — three separate implementations exist.
- **Files:** `backend/src/api/graph.ts:29`, `backend/src/graph/provenance-types.ts:137`, and frontend usage via the same function
- **Fix approach:** In `backend/src/api/graph.ts`, import from `../graph/provenance-types.js` directly.

### Duplicate PDF Generator Modules
- **Issue:** Two separate PDF generation modules exist with overlapping responsibilities.
- **Files:**
  - `backend/src/planning/document-generator.ts` (344 lines) — used by `backend/src/planning/routes/document-routes.ts`
  - `backend/src/planning/documents/generators/pdf-generator.ts` (174 lines) — used by `backend/src/planning/documents/generators/opord.ts`
  - Both use the same `(PDFKit as any).default || PDFKit` hack
- **Fix approach:** Consolidate into `backend/src/planning/documents/generators/pdf-generator.ts`. Remove `backend/src/planning/document-generator.ts` after migrating `document-routes.ts`.

### All Agent Execution Framework TODOs (Large Surface Area)
- **Issue:** 9+ agent files have `TODO: Implement using agent execution framework from executor.ts` for their core execution paths. These agents are registered and appear functional but their execution falls through to placeholder returns.
- **Files (representative):**
  - `backend/src/agents/escalation-modeler.ts` lines 255, 271, 301, 317
  - `backend/src/agents/deescalation-manager.ts` line 265
  - `backend/src/agents/adversary-modeler.ts` lines 245, 261, 289, 303
  - `backend/src/agents/deception-detector.ts` lines 243, 259, 283, 295
  - `backend/src/agents/assumption-auditor.ts` lines 198, 214, 229, 243
  - `backend/src/agents/effect-cascader.ts` lines 249, 265, 282, 297
  - `backend/src/agents/deception-planner.ts` line 218
  - `backend/src/agents/exploitation-analyst.ts` line 224
- **Impact:** These agents are visible in the admin panel and may be assigned to problem sets, but they silently do nothing when invoked.
- **Fix approach:** Either wire to `backend/src/agents/executor.ts` (which exists) or mark as `DISABLED` in the agent registry until implemented.

### Large Files With Mixed Responsibilities
- **Issue:** Several files far exceed reasonable single-file limits and mix multiple concerns.
- **Files:**
  - `backend/src/mdmp/activity-registry.ts` — 3249 lines, contains all MDMP activity definitions as a massive data blob
  - `backend/src/api/strategic.ts` — 2713 lines, 60 route handlers in a single file
  - `backend/src/api/problem-sets.ts` — 2514 lines
  - `backend/src/api/admin.ts` — 2311 lines
  - `backend/src/api/exercise.ts` — 2197 lines
  - `backend/src/robot/robot-mission-service.ts` — 1812 lines, manages WebSockets + business logic + persistence
- **Impact:** Hard to navigate, hard to test, difficult to review for security issues. High likelihood of mixed auth guard coverage within a single file.
- **Fix approach:** Split `strategic.ts` by domain (objectives, guidance, documents, review). Move `activity-registry.ts` data into a JSON file loaded at startup. Extract robot WebSocket handling from business logic.

### In-Memory State Lost on Restart (Multiple Services)
- **Issue:** Several production services store critical operational state only in process memory.
- **Files:**
  - `backend/src/agents/registry.ts` — agent manifest store (Map)
  - `backend/src/agents/team-registry.ts` — team assignments (Map)
  - `backend/src/agents/tool-registry.ts` — tool assignments (Map)
  - `backend/src/robot/robot-mission-service.ts` — active robot connections, swarm states, seenMessageIds (multiple Maps)
  - `backend/src/robot/mission-sequence-orchestrator.ts` — sequence state (Map)
  - `backend/src/wargaming/wargaming-service.ts` — all wargaming sessions (Map)
- **Impact:** Server restart loses all active robot connections, ongoing missions, and agent registrations. In an operational environment this causes mission disruption.
- **Fix approach:** Persist to PostgreSQL. Agent/tool registrations already have DB schemas (they call `ensureInitialized`); ensure writes go to DB on registration and reads load from DB on startup.

### MDMP Workflow Service Has 10 Blockchain Call Stubs
- **Issue:** All smart contract calls in `backend/src/mdmp/workflow-service.ts` are commented-out TODOs that do nothing. The MDMP workflow appears functional but has no on-chain state.
- **File:** `backend/src/mdmp/workflow-service.ts` lines 119, 135, 168, 200, 248, 268, 303, 340 (labeled `TODO (5.1-14)`)
- **Impact:** MDMP gate enforcement and assumption tracking are stored in PostgreSQL only, not on-chain as designed. The DAO governance layer has no visibility into MDMP state.
- **Fix approach:** Implement via `backend/src/near/tx-signer.ts` which already has the NEAR RPC and contract configuration.

### routes/mdmp.ts and api/mdmp (routes dir) — Parallel MDMP Routers
- **Issue:** Two separate MDMP routers exist. `backend/src/routes/mdmp.ts` (491 lines, mounted at `/api/mdmp`) and an `api/mdmp` reference. Both registered in `backend/src/index.ts` line 249 pointing to `routes/mdmp.ts`. The `backend/src/api/` directory has no `mdmp.ts` but the `mdmp` directory has its own `workflow-service.ts`, `activity-registry.ts`, etc.
- **Impact:** Confusing structure; unclear which router owns which endpoints. `backend/src/routes/` is a non-standard directory for this project (everything else is under `api/`).
- **Fix approach:** Move `backend/src/routes/mdmp.ts` to `backend/src/api/mdmp.ts` to match the project convention.

### Committed Compiled .js Files in Backend Source
- **Issue:** 16 pre-compiled `.js` files (old CommonJS format with `__awaiter`/`__generator` shims) exist alongside `.ts` source in `backend/src/`.
- **Files:** `backend/src/lib/database.js`, `backend/src/lib/blockchain-sync.js`, `backend/src/lib/encryption.js`, `backend/src/lib/ipfs.js`, `backend/src/lib/mpc-accounts.js`, `backend/src/lib/edge-sync.js`, `backend/src/api/accounts.js`, `backend/src/api/documents.js`, `backend/src/api/encryption.js`, `backend/src/api/edge-sync.js`, `backend/src/api/identity.js`, `backend/src/index.js`, and others in `backend/src/identity/`.
- **Impact:** These are stale artifacts from before the project adopted TypeScript with `moduleResolution: 'bundler'`. They may shadow newer `.ts` implementations if Node resolves `.js` before `.ts`. `.gitignore` does not exclude `src/**/*.js` (only `dist/`).
- **Fix approach:** Delete all `.js` files under `backend/src/`. Add `backend/src/**/*.js` to `.gitignore`.

---

## LOW

### 1964 `console.log/warn/debug` Calls — No Structured Logger
- **Issue:** The entire codebase uses raw `console.*` calls instead of a structured logger. 1964 total across frontend and backend.
- **Impact:** No log levels, no correlation IDs, no ability to filter by problem set or agent. Hard to use in production log aggregation.
- **Fix approach:** Add `pino` or `winston` to backend. Replace console calls with structured logger. Frontend can remain console-based but should gate on `NODE_ENV !== 'production'`.

### `@deprecated` Backend Route Not Removed
- **Issue:** `POST /api/design` (backend `backend/src/api/design.ts` line 222) is marked `@deprecated Phase 49`. It remains registered and returns data. The frontend `design-service.ts` line 167 has a matching `@deprecated` tag.
- **Files:** `backend/src/api/design.ts:222`, `frontend/src/lib/design-service.ts:167`
- **Impact:** Dead API surface. Minor maintenance debt.
- **Fix approach:** Verify no callers remain, then remove the POST route and the `subscribeDesign` wrapper.

### AIStaffContext Transitioning Out But Not Removed
- **Issue:** `frontend/src/context/AIStaffContext.tsx` is being replaced by `IronclawContext`. Comment in `frontend/src/App.tsx` line 147 says "kept for backward compatibility during Ironclaw transition." Still actively used in `ProblemSetTabContainer.tsx` and `DesignAIPanel.tsx`. Dead hooks `useAgentRouting` and `useInlineAnnotations` import from it.
- **Impact:** Two AI chat systems coexist. Unclear which is authoritative for new feature development.
- **Fix approach:** Complete the migration. Move `DesignAIPanel.tsx` AI dispatch to `IronclawContext`. Remove `AIStaffContext` and both dead hooks.

### TypeScript `any` Usage (173 backend, 23 frontend)
- **Issue:** 173 uses of `: any`, `as any`, or `<any>` in backend source; 23 in frontend. Many are in provenance/revert-service (5 instances) and orchestration supervisor (LangGraph graph casting).
- **Representative files:**
  - `backend/src/doc-intelligence/provenance/revert-service.ts` lines 242, 271, 327, 351, 371: `client: any` in SQL transaction helpers
  - `backend/src/orchestration/supervisor.ts` line 184: `(graph as any).addConditionalEdges` — LangGraph typing gap
  - `backend/src/planning/document-generator.ts` line 10: `(PDFKit as any).default || PDFKit` — module interop hack
- **Fix approach:** For LangGraph: use the typed `StateGraph` API. For PDFKit: use explicit `import type` and a type assertion helper. For revert-service: define a `PoolClient` type from `pg`.

### Missing Auth on MDMP Governance Endpoints (Frontend TODO)
- **Issue:** Two backend operations have no implementation: reject and invalidate MDMP gate.
- **File:** `frontend/src/components/governance/MDMPGovernancePanel.tsx` lines 118, 129
- **Impact:** Governance panel shows reject/invalidate buttons that silently do nothing when clicked (the handler fires the TODO comment, not a real API call).
- **Fix approach:** Implement `POST /api/mdmp/workflows/:id/gates/:gateId/reject` and `/invalidate` in `backend/src/routes/mdmp.ts`.

### Multi-Hat Detection Not Implemented
- **Issue:** `frontend/src/components/mission/command/CommandTreeView.tsx` line 50: `const multiHatted = false; // TODO: Implement multi-hat detection`. A military C2 system should flag officers holding multiple command positions.
- **Impact:** Multi-hat situations are silently ignored in the command tree visualization and likely in role-based access checks.

### Test Coverage: 24 Test Files for 966 Source Files
- **Issue:** Only 24 test files exist across 966 source files (~2.5% coverage by file count). The tested areas are concentrated in COP layers, graph resolution, security ABAC, ingest classifiers, and robot coalition logic.
- **Untested areas (high risk):**
  - Entire `backend/src/api/` directory (all 25+ route files)
  - `backend/src/inheritance/inheritance-store.ts` (1319 lines)
  - `backend/src/orchestration/` (observability, supervisor, human-checkpoints)
  - `backend/src/agents/` (all 20+ agent implementations)
  - `frontend/src/lib/` services (design-service, problem-set-service, inheritance-service)
- **Fix approach:** Prioritize tests for security-critical paths: auth middleware, API input validation, gate approval logic, and agent execution. The 51 `ensureInitialized` store methods are particularly fragile and completely untested.

### No Code Splitting in Frontend (Three.js, Leaflet, react-force-graph-3d Always Loaded)
- **Issue:** `frontend/src/App.tsx` imports all major components eagerly with no `React.lazy()` or dynamic imports. The dependency list includes `three` (3D rendering), `react-force-graph-3d`, `leaflet`, `react-force-graph-2d`, and `react-d3-tree` — all loaded at startup regardless of which tab the user is on.
- **Impact:** Initial bundle is very large. Users on the home/login screen download 3D graph rendering libraries they may never use.
- **Fix approach:** Wrap tab-specific heavy components (`BrainVisualization`, `ValidityMap`, `MissionMap`, `SwarmCOPLayer`) in `React.lazy()` with `Suspense` boundaries in `ProblemSetTabContainer.tsx`.

---

*Concerns audit: 2026-03-18*
