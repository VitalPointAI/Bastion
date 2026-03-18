# Backend Dead Code Audit

**Analysis Date:** 2026-03-18
**Scope:** `backend/src/` — TypeScript files only (`.js` stale files excluded per prior audit)
**Method:** Cross-referenced all 591 `.ts` files against `index.ts` route mounts and import chains

---

## 1. Completely Orphaned Directories (Zero External Imports)

### `backend/src/operational-planning/` — 4 files
All four files export types/functions with zero consumers anywhere in the codebase.

| File | Exports | Any Importer? |
|------|---------|---------------|
| `operational-planning/branch-sequel.ts` | `BranchPlan`, `SequelPlan`, `DecisionPoint` types | None |
| `operational-planning/coa-sketch.ts` | `COASketch`, `SymbolAffiliation` types | None |
| `operational-planning/force-ratio.ts` | Force ratio calculation functions | None |
| `operational-planning/sustainment-model.ts` | `SustainmentModel` types | None |

**Recommendation: DELETE.** These are Phase 25 placeholder stubs never wired to any route or service.

---

### `backend/src/raft/templates/` — 6 files
The barrel (`index.ts`) documents the import pattern but no file in the codebase ever imports from it.

| File | Exports | Any Importer? |
|------|---------|---------------|
| `raft/templates/index.ts` | Re-exports all 5 templates | None — zero `from.*raft/templates` imports found |
| `raft/templates/mdmp-task-extraction.ts` | `TASK_EXTRACTION_TEMPLATE` | Only self (via index) |
| `raft/templates/mdmp-ipb-analysis.ts` | `IPB_ANALYSIS_TEMPLATE` | Only self |
| `raft/templates/mdmp-opord-generation.ts` | `OPORD_GENERATION_TEMPLATE` | Only self |
| `raft/templates/mdmp-wargame-extraction.ts` | `WARGAME_EXTRACTION_TEMPLATE` | Only self |
| `raft/templates/mdmp-ccir-generation.ts` | `CCIR_GENERATION_TEMPLATE` | Only self |

Each file imports `MDMPPhase` from `../../mdmp/types.js` (type-only) — that's the only cross-reference. The templates themselves are never consumed.

**Recommendation: DELETE or integrate.** Templates were built for Phase 5 RAFT extraction but never wired into any agent or route handler.

---

### `backend/src/crypto/` — 5 files
Entire directory is self-contained with zero imports from outside the directory.

| File | Exports | Any Importer? |
|------|---------|---------------|
| `crypto/index.ts` | Re-exports pq-kem + pq-signatures | None |
| `crypto/pq-kem.ts` | Post-quantum KEM functions | Only `crypto/index.ts` and `crypto/test-pq-crypto.ts` |
| `crypto/pq-signatures.ts` | Post-quantum signature functions | Only `crypto/index.ts` and `crypto/test-pq-crypto.ts` |
| `crypto/test-pq-crypto.ts` | CLI test harness (`npx tsx src/crypto/test-pq-crypto.ts`) | Only self-referencing |
| `crypto/types.ts` | PQ crypto types | No external import found |

**Recommendation: KEEP but classify as dormant.** Post-quantum crypto is a stated roadmap feature (Phase 33+). However, `crypto/test-pq-crypto.ts` is a dev-run CLI script, not application code — it should not live in `src/`. Move to `scripts/` or `test/`.

---

## 2. Orphaned Files in Active Directories

### `backend/src/planning/document-generator.ts`
- **Exports:** Full `DocumentGenerationEngine` class with PDF/DOCX output (uses `pdfkit`, `docx`)
- **Any importer?** Zero — no file in the codebase imports from `planning/document-generator.ts`
- **Context:** Superseded by `planning/documents/generators/` (opord.ts, pdf-generator.ts, docx-generator.ts). The newer generators are wired through `planning/documents/index.ts` and consumed by `api/planning.ts` and `planning/routes/document-routes.ts`.
- **Recommendation: DELETE.** Stale predecessor to the current document generation pipeline.

---

### `backend/src/planning/documents/generators/briefing.ts`
- **Exports:** `generateBriefingSlides(planId, options)` — Phase 05 Plan 10 stub
- **Any importer?** Zero — `planning/documents/index.ts` re-exports `generateBriefingSlides` from `pptx-generator.ts`, not from this file
- **Context:** Duplicate/predecessor of `planning/documents/generators/pptx-generator.ts`. Both export a function named `generateBriefingSlides` with the same signature, but only `pptx-generator.ts` is on the export path.
- **Recommendation: DELETE.** The pptx-generator is the live version.

---

### `backend/src/lib/near-events.ts`
- **Exports:** `BlockchainEventStore` class, NEAR event processing utilities
- **Any importer?** Zero — no file imports from `lib/near-events.ts`
- **Context:** Pre-Phase-18 NEAR blockchain event handling. The current auth architecture uses `@vitalpoint/near-phantom-auth` and `lib/blockchain-sync.ts` instead.
- **Recommendation: DELETE.** Replaced by `lib/blockchain-sync.ts` which is actively imported.

---

### `backend/src/mdmp/decision-brief-generator.ts`
- **Exports:** `DecisionBriefGenerator` class, `getDecisionBriefGenerator()` factory
- **Any importer?** Zero — only self-referencing definitions; `routes/mdmp.ts` imports `workflow-service`, `activity-registry`, `types`, and `safety-enforcement` but NOT `decision-brief-generator`
- **Context:** Phase 5.3 capability stub. The `routes/mdmp.ts` route handler has no endpoint that calls decision brief generation.
- **Recommendation: DELETE or wire up.** 650+ lines of unexecuted code. If the capability is needed, wire it to an endpoint in `routes/mdmp.ts`.

---

### `backend/src/mdmp/integration.ts`
- **Exports:** MDMP integration functions (hooks into other modules)
- **Any importer?** Zero — confirmed no imports from any other file
- **Recommendation: DELETE.** Orphaned integration shim.

---

### `backend/src/auth/mpc-account.ts`
- **Exports:** MPC-based NEAR account creation utilities
- **Any importer?** Zero — no file imports from `auth/mpc-account.ts`
- **Context:** The auth architecture comment notes this exists alongside `auth/funding-service.ts`. The index.ts startup calls `getFundingService()` from `funding-service.ts` (which is used). `mpc-account.ts` is a separate, unconnected module.
- **Recommendation: DELETE or integrate.** The MPC account derivation logic may be intentional future work, but currently dead.

---

### `backend/src/auth/deployment-types.ts`
- **Exports:** `DeploymentConfig` interface
- **Any importer?** Only `auth/platform-settings-store.ts` (which is active)
- **Status:** LIVE — this is a type-only module used by an active store. Keep.

---

### `backend/src/validation/fixture-generator.ts`
- **Exports:** `generateFixturesForRole()`, `generateAllFixtures()` functions
- **Any importer?** Zero — no file imports from `validation/fixture-generator.ts`
- **Context:** Phase 31 Plan 04 — a CLI-style utility to generate test fixtures from agent definitions. The `validation/fixture-loader.ts` (which IS used by `validation/activation-gate.ts`) loads from disk; the generator creates those files. But the generator is never called programmatically.
- **Recommendation: MOVE to `scripts/`.** This is a one-time setup tool, not application code. It should not live in `src/`.

---

### `backend/src/validation/scoring/score-determinism.ts`
- **Exports:** `scoreDeterminism()` function
- **Any importer?** Zero — `validation/validation-runner.ts` imports `scoreDeterminism` from `./scoring/determinism-scorer.js`, NOT from `score-determinism.ts`
- **Context:** Duplicate stub. `determinism-scorer.ts` is the live version (200+ lines with embeddings). `score-determinism.ts` is an early placeholder (~30 lines stub) with the same exported function name.
- **Recommendation: DELETE.** `determinism-scorer.ts` is the canonical implementation.

---

### `backend/src/cop/svg/svg-spec-builder.ts`
- **Exports:** `buildCOPSymbolSpecs()`, `buildControlMeasureSpecs()`, conversion utilities
- **Any importer?** Zero — no file in the codebase imports from `cop/svg/svg-spec-builder.ts`
- **Context:** Converts `COPLayerSpec` symbols for frontend milsymbol rendering. The actual frontend rendering path goes through `cop/api/cop-handlers.ts` which returns raw layer data; the spec-builder transformation is never called.
- **Recommendation: DELETE or wire up.** If the frontend needs the transformed data format, wire it into `cop-handlers.ts`. Otherwise delete.

---

### `backend/src/cop/svg/svg-fragment-generator.ts`
- **Exports:** `generateSVGAnnotation()` — LLM-generated SVG for custom annotations
- **Any importer?** Zero — no file imports from `cop/svg/svg-fragment-generator.ts`
- **Context:** Uses LLM to generate custom SVG overlays. Never called from any handler or service.
- **Recommendation: DELETE or wire up.** Expensive LLM capability that is never invoked.

---

### `backend/src/agents/narrative-synthesis.ts`
- **Exports:** `synthesizeNarrative()`, `NarrativeSynthesisOutput`, `NarrativeSynthesisContext`
- **Any importer?** Zero — no file imports from `agents/narrative-synthesis.ts`
- **Context:** Phase 5 narrative synthesis capability. The agent-seeder does NOT seed a narrative synthesis agent. No API endpoint calls it.
- **Recommendation: DELETE.** 440+ lines of unreachable code.

---

### `backend/src/agents/loe-gap-analysis.ts`
- **Exports:** `LOEGapAnalysisAgent` manifest and analysis functions
- **Any importer?** Zero — no file imports from `agents/loe-gap-analysis.ts`
- **Context:** Phase 25 Plan 06 — LOE gap identification for operational design. Never seeded, never called.
- **Recommendation: DELETE.** Placeholder agent with no consumers.

---

### `backend/src/agents/message-handlers.ts`
- **Exports:** `registerTaskHandlers()`, `registerDataHandlers()`, `registerAllHandlers()` — standard message handler utilities
- **Any importer?** Zero — no file imports from `agents/message-handlers.ts`
- **Context:** Utility module for wiring `AgentMessenger` handlers. `AgentMessenger` itself IS used, but `message-handlers.ts` (the convenience wrappers) is not.
- **Recommendation: DELETE.** The agent messaging pattern uses direct `messenger.on()` registration rather than these convenience functions.

---

### `backend/src/ironclaw/self-update-service.ts`
- **Exports:** `SelfUpdateService` class, `selfUpdateService` singleton
- **Any importer (outside ironclaw/)?** Zero — re-exported from `ironclaw/index.ts` via `export *`, but `index.ts` only imports `ironclawRouter` and `ironclawStore` in `backend/src/index.ts`
- **Context:** The self-update service polls GitHub for new Ironclaw versions and triggers Docker restarts. The service is instantiated on module load (via `export const selfUpdateService = new SelfUpdateService()`) but `index.ts` never calls `.start()` on it and it's not wired to any route.
- **Recommendation: INVESTIGATE.** Module construction side-effects may cause a polling loop even without explicit `.start()` call. Confirm whether the constructor starts polling. If no route or startup hook calls `.start()`, this is dead code that still instantiates.

---

### `backend/src/ironclaw/audit-anchor-service.ts`
- **Exports:** `AuditAnchorService` class, `auditAnchorService` singleton
- **Any importer (outside ironclaw/)?** Zero — same pattern as self-update-service: re-exported from index but never consumed by `backend/src/index.ts`
- **Context:** Anchors Ironclaw audit logs to NEAR blockchain. `ironclawStore` and `ironclawRouter` ARE used, but the anchor service is never called.
- **Recommendation: INVESTIGATE.** Same instantiation concern as self-update-service. Wire to a startup hook in `index.ts` if needed, or delete.

---

### `backend/src/doc-intelligence/specialists/researcher.ts`
- **Exports:** `ResearcherSpecialist` class — performs web search + stores research results
- **Any importer?** Zero — `doc-intelligence/team-setup.ts` registers `doc-researcher` by agent ID string (metadata registration), but no TypeScript code imports the `ResearcherSpecialist` class for execution
- **Context:** The `orchestrator-wiring.ts` registers specialists by instantiating their classes. The researcher is listed in `team-setup.ts` as an agent definition but never wired into the LangGraph orchestrator in `orchestrator-wiring.ts`.
- **Recommendation: WIRE UP or DELETE.** Check `orchestrator-wiring.ts` to confirm the researcher node is missing. If the team-setup registers it, the orchestrator should instantiate `new ResearcherSpecialist()` and add it as a node.

---

## 3. Services Instantiated but Methods Never Called

### `backend/src/ironclaw/self-update-service.ts` — `selfUpdateService`
- Exported from `ironclaw/index.ts` but never imported by consumers
- `SelfUpdateService` constructor starts a version check immediately
- **Impact:** May silently poll GitHub on every server startup
- **Fix:** Either call `selfUpdateService.start()` from `index.ts` startup block, or delete

### `backend/src/ironclaw/audit-anchor-service.ts` — `auditAnchorService`
- Exported but never called; anchoring never runs
- **Impact:** Audit logs accumulate without blockchain anchoring
- **Fix:** Wire `auditAnchorService.start()` to startup block in `index.ts`

---

## 4. Duplicate Implementations (Shadow Dead Code)

| Dead Version | Live Version | Notes |
|---|---|---|
| `planning/document-generator.ts` | `planning/documents/generators/` | Generator replaced by full pipeline |
| `planning/documents/generators/briefing.ts` | `planning/documents/generators/pptx-generator.ts` | Same export name, newer version is wired |
| `validation/scoring/score-determinism.ts` | `validation/scoring/determinism-scorer.ts` | Stub vs. full implementation |

---

## 5. CLI / Dev Scripts in Wrong Location

These files should live in `scripts/` or `tests/`, not in `src/`:

| File | Purpose | Issue |
|---|---|---|
| `crypto/test-pq-crypto.ts` | Manual PQ crypto verification CLI | Dev tool in application source tree |
| `validation/fixture-generator.ts` | One-time fixture generation CLI | Not application code; belongs in scripts |
| `graph/migration/migration-runner.ts` | Neo4j migration CLI (`npx tsx ...`) | One-time migration script in `src/` |
| `graph/migration/migrate-to-jsonld.ts` | Migration batch functions for CLI above | Same concern |

Note: `db/migration-runner.ts` IS imported by `index.ts` (it runs SQL migrations on startup) — that one stays.

---

## 6. Summary Table

| File(s) | Action | Risk |
|---|---|---|
| `operational-planning/` (4 files) | DELETE | Low — zero consumers |
| `raft/templates/` (6 files) | DELETE | Low — zero consumers |
| `crypto/` (5 files) | KEEP (future), move `test-pq-crypto.ts` to scripts | Low |
| `planning/document-generator.ts` | DELETE | Low — superseded |
| `planning/documents/generators/briefing.ts` | DELETE | Low — superseded by pptx-generator |
| `lib/near-events.ts` | DELETE | Low — superseded by blockchain-sync |
| `mdmp/decision-brief-generator.ts` | Wire or DELETE | Medium — 650+ lines unexecuted |
| `mdmp/integration.ts` | DELETE | Low |
| `auth/mpc-account.ts` | Investigate and DELETE or wire | Medium — may be intended |
| `validation/fixture-generator.ts` | MOVE to `scripts/` | Low |
| `validation/scoring/score-determinism.ts` | DELETE | Low — stub duplicate |
| `cop/svg/svg-spec-builder.ts` | Wire or DELETE | Medium — useful capability |
| `cop/svg/svg-fragment-generator.ts` | Wire or DELETE | Medium — expensive LLM |
| `agents/narrative-synthesis.ts` | DELETE | Low — 440+ dead lines |
| `agents/loe-gap-analysis.ts` | DELETE | Low |
| `agents/message-handlers.ts` | DELETE | Low |
| `ironclaw/self-update-service.ts` | INVESTIGATE startup side-effects | High — may silently poll |
| `ironclaw/audit-anchor-service.ts` | Wire startup or DELETE | Medium |
| `doc-intelligence/specialists/researcher.ts` | Wire to orchestrator or DELETE | Medium |
| `graph/migration/*.ts` (2 files) | MOVE to `scripts/` | Low |

---

## 7. Already-Known Dead Code (Not Re-Reported)

Per audit brief, the following were identified in prior scans and excluded:
- `backend/src/services/email.ts`
- `backend/src/wargaming/` directory
- 16 stale `.js` files alongside `.ts` versions

---

*Dead code audit: 2026-03-18*
