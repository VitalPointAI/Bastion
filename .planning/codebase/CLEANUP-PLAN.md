# Codebase Cleanup Plan

**Date:** 2026-03-18
**Sources:** CONCERNS.md, AUDIT-FRONTEND-DEAD-CODE.md, AUDIT-BACKEND-DEAD-CODE.md, AUDIT-API-COVERAGE.md

---

## How to use this document

Each item has a checkbox. Mark `[x]` for items you approve, `[-]` for items to skip/defer. I'll only execute approved items.

---

## Wave 1: Safe Deletions (zero-risk dead code)

These files have **zero imports** from any live code path. Deleting them cannot break anything.

### 1A. Frontend — Orphaned Directory Trees (~41 files)

- [ ] **DELETE `frontend/src/components/mission/`** (~24 files, ~3,000 lines)
  - Entire tree orphaned — only referenced by a TODO comment
  - Contains: MissionDetail, MissionTimeline, MissionMap, command views

- [ ] **DELETE `frontend/src/components/planning/`** (~17 files, ~2,500 lines)
  - Only reachable through orphaned mission/ tree
  - Contains: PlanningDashboard, COAEditor, COAComparison, WargamingPanel

### 1B. Frontend — Orphaned Single Components (~13 files)

- [ ] **DELETE `components/tabs/DoctrinalPlaceholder.tsx`** — replaced
- [ ] **DELETE `components/tabs/TrainingPackagesView.tsx`** — zero imports
- [ ] **DELETE `components/tabs/CreateScenarioPanel.tsx`** — zero imports
- [ ] **DELETE `components/tabs/TrainingDocPreview.tsx`** — zero imports
- [ ] **DELETE `components/cop/COPPerspectiveToggle.tsx`** — moved into COPLayerControls
- [ ] **DELETE `components/cop/LegalConsentDialog.tsx`** — zero imports
- [ ] **DELETE `components/cop/EMSpectrumPanel.tsx`** — stale duplicate of resources/network version
- [ ] **DELETE `components/cop/NetworkTopologyView.tsx`** — stale duplicate of resources/network version
- [ ] **DELETE `components/cop/NetworkTargetsPage.tsx`** — zero imports
- [ ] **DELETE `components/inheritance/FRAGOReviewPanel.tsx`** — zero imports
- [ ] **DELETE `components/problem-set/ObserverPanel.tsx`** — zero imports
- [ ] **DELETE `components/problem-set/SubscriptionManager.tsx`** — zero imports
- [ ] **DELETE `components/problem-set/CompartmentManager.tsx`** — zero imports

### 1C. Frontend — Dead Lib/Hook/Context Files (~11 files)

- [ ] **DELETE `hooks/useAgentRouting.ts`** — zero imports
- [ ] **DELETE `hooks/useInlineAnnotations.ts`** — zero imports, depends on deprecated AIStaffContext
- [ ] **DELETE `lib/ipfs.ts`** — zero imports, mock stub
- [ ] **DELETE `lib/encryption.ts`** — only imported by dead aiContext.ts
- [ ] **DELETE `lib/aiContext.ts`** — only imported by dead teeClient.ts
- [ ] **DELETE `lib/teeClient.ts`** — zero imports, no-op stub
- [ ] **DELETE `lib/intents.ts`** — zero imports, fully mocked
- [ ] **DELETE `lib/mpcRecovery.ts`** — zero imports
- [ ] **DELETE `lib/yjs-hooks.ts`** — only imported by orphaned planning/COAEditor
- [ ] **DELETE `lib/types/command.ts`** — only imported by orphaned mission/ files
- [ ] **DELETE `components/brain/IngestionSidebar.tsx`** — replaced by IngestionDrawer.tsx; remove from barrel

### 1D. Frontend — Dead AI Staff Exports (3 files)

- [ ] **DELETE `ai-staff/AIShowContributions.tsx`** — no external consumers
- [ ] **DELETE `ai-staff/InlineAnnotation.tsx`** — depends on dead hook
- [ ] **DELETE `ai-staff/AgentRoutingConfig.ts`** — depends on dead hook

### 1E. Backend — Orphaned Directories (~15 files)

- [ ] **DELETE `backend/src/operational-planning/`** (4 files) — Phase 25 placeholder stubs, zero consumers
- [ ] **DELETE `backend/src/raft/templates/`** (6 files) — Phase 5 templates never wired to any agent
- [ ] **KEEP `backend/src/crypto/`** but MOVE `test-pq-crypto.ts` to `scripts/` — PQ crypto is roadmap, but test CLI doesn't belong in src

### 1F. Backend — Orphaned Single Files (~12 files)

- [ ] **DELETE `planning/document-generator.ts`** — superseded by planning/documents/generators/
- [ ] **DELETE `planning/documents/generators/briefing.ts`** — superseded by pptx-generator.ts
- [ ] **DELETE `lib/near-events.ts`** — replaced by blockchain-sync.ts
- [ ] **DELETE `mdmp/integration.ts`** — zero imports
- [ ] **DELETE `auth/mpc-account.ts`** — zero imports, pre-Phase-18
- [ ] **DELETE `validation/scoring/score-determinism.ts`** — stub duplicate of determinism-scorer.ts
- [ ] **DELETE `agents/narrative-synthesis.ts`** — 440+ lines, zero imports
- [ ] **DELETE `agents/loe-gap-analysis.ts`** — zero imports, never seeded
- [ ] **DELETE `agents/message-handlers.ts`** — zero imports
- [ ] **DELETE `services/email.ts`** — zero imports, dead AWS SES module

### 1G. Backend — Stale .js Files (16 files)

- [ ] **DELETE all `.js` files under `backend/src/`** and add `backend/src/**/*.js` to `.gitignore`
  - `lib/database.js`, `lib/blockchain-sync.js`, `lib/encryption.js`, `lib/ipfs.js`, `lib/mpc-accounts.js`, `lib/edge-sync.js`
  - `api/accounts.js`, `api/documents.js`, `api/encryption.js`, `api/edge-sync.js`, `api/identity.js`
  - `index.js`, and others in `identity/`

---

## Wave 2: Fix Broken References (runtime errors)

### 2A. Fix 3 Broken Frontend → Backend API Calls

- [ ] **Fix contradiction endpoint** — `frontend/src/components/assess/OperationalAssess.tsx:154` calls `GET /api/graph/contradictions` which doesn't exist. Create route or remove call.
- [ ] **Fix OSINT events endpoint** — `frontend/src/lib/osint-service.ts:144` calls `GET /api/osint/events/relevant` but route is `GET /api/graph/osint/events`. Fix path.
- [ ] **Fix admin agent config path** — `frontend/src/lib/admin-service.ts:317,334,345` calls `/api/admin/config/agents/:id/model` but backend is `/api/admin/agents/:id/model-config`. Align paths.

---

## Wave 3: Consolidation & Deduplication

### 3A. Extract Shared Utilities

- [ ] **Extract `getQueryString` helper** — identical 4-line function copy-pasted in 6 API files → extract to `backend/src/api/utils.ts`
- [ ] **Fix `getConfidenceTier` duplication** — `api/graph.ts` reimplements `provenance-types.ts` version → import from source
- [ ] **Consolidate PDF generators** — `planning/document-generator.ts` (dead, see Wave 1) and `planning/documents/generators/pdf-generator.ts` → only the latter should remain after Wave 1 deletion

### 3B. Remove Deprecated Code

- [ ] **Remove deprecated `POST /api/design` route** — marked `@deprecated Phase 49` in both backend and frontend
- [ ] **Complete AIStaffContext → IronclawContext migration** — remove `AIStaffContext.tsx`, update `DesignAIPanel.tsx` and `ProblemSetTabContainer.tsx` to use IronclawContext

---

## Wave 4: Structural Improvements (medium effort)

### 4A. Move Misplaced Files

- [ ] **Move CLI scripts out of `src/`:**
  - `crypto/test-pq-crypto.ts` → `scripts/test-pq-crypto.ts`
  - `validation/fixture-generator.ts` → `scripts/generate-fixtures.ts`
  - `graph/migration/migration-runner.ts` → `scripts/graph-migration-runner.ts`
  - `graph/migration/migrate-to-jsonld.ts` → `scripts/graph-migrate-to-jsonld.ts`

### 4B. Move Non-Standard Route File

- [ ] **Move `backend/src/routes/mdmp.ts` → `backend/src/api/mdmp.ts`** — only file in routes/ dir, everything else is in api/

### 4C. Wire or Remove Disconnected Services

- [ ] **INVESTIGATE `ironclaw/self-update-service.ts`** — may silently poll GitHub on startup via constructor. Wire `.start()` to index.ts or remove singleton instantiation.
- [ ] **Wire or DELETE `ironclaw/audit-anchor-service.ts`** — audit anchoring never runs
- [ ] **Wire or DELETE `doc-intelligence/specialists/researcher.ts`** — registered in team-setup but not instantiated in orchestrator-wiring
- [ ] **Wire or DELETE `cop/svg/svg-spec-builder.ts`** — useful COP capability but never called
- [ ] **Wire or DELETE `cop/svg/svg-fragment-generator.ts`** — LLM SVG generation never invoked
- [ ] **Wire or DELETE `mdmp/decision-brief-generator.ts`** — 650+ lines, no endpoint

---

## Wave 5: Larger Refactors (high effort, optional)

### 5A. Split Oversized Files

- [ ] **Split `api/strategic.ts`** (2713 lines, 60 handlers) → by domain: objectives, guidance, documents, review
- [ ] **Split `api/problem-sets.ts`** (2514 lines) → by subdomain
- [ ] **Split `api/admin.ts`** (2311 lines) → by resource type
- [ ] **Split `api/exercise.ts`** (2197 lines) → by entity type
- [ ] **Split `robot/robot-mission-service.ts`** (1812 lines) → separate WebSocket handling from business logic
- [ ] **Move `mdmp/activity-registry.ts`** (3249 lines) data to JSON file loaded at startup

### 5B. Frontend Bundle Optimization

- [ ] **Add React.lazy() code splitting** — wrap tab-specific heavy components (BrainVisualization, ValidityMap, MissionMap, SwarmCOPLayer) in lazy/Suspense to avoid loading Three.js, Leaflet, react-force-graph-3d on initial page load

### 5C. Consolidate Runtime DDL

- [ ] **Migrate 51 `ensureInitialized` store methods → formal SQL migration files** — currently 51 stores run CREATE TABLE / ALTER TABLE on every startup. Consolidate to `backend/src/db/migrations/` numbered files.

### 5D. Structured Logging

- [ ] **Replace 1964 `console.*` calls with structured logger** — add pino/winston to backend; gate frontend logs on NODE_ENV

---

## Wave 6: Security Hardening (separate from cleanup, listed for completeness)

*These are from CONCERNS.md critical/high findings. Flagging here but likely a separate phase.*

- [ ] Stop returning encryption keys in API responses (`api/documents.ts`)
- [ ] Add `requireAuth` to 15+ unprotected API routers
- [ ] Fix Ironclaw HMAC bypass when secret not set
- [ ] Fix OSINT webhook unsigned request acceptance
- [ ] Remove hardcoded `isCommander={true}` bypasses
- [ ] Remove all dev-secret fallback defaults (`'dev-seed'`, `'dev-secret-key'`)

---

## Impact Summary

| Wave | Files Affected | Lines Removed (est.) | Risk | Effort |
|------|---------------|---------------------|------|--------|
| 1: Safe Deletions | ~110 files | ~15,000+ | None | Low — just delete |
| 2: Fix Broken Refs | 3 files | ~20 (fixes) | Low | Low |
| 3: Consolidation | ~10 files | ~100 (refactor) | Low | Medium |
| 4: Structural | ~15 files | ~0 (moves) | Low-Med | Medium |
| 5: Large Refactors | ~10 files | ~0 (splits) | Medium | High |
| 6: Security | ~20 files | ~50 (fixes) | Low | High |

---

*Review this plan and mark items `[x]` to approve or `[-]` to skip. I'll execute only what you approve, wave by wave.*
