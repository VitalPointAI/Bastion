---
phase: 66-ironclaw-memory-evolution-and-concept-learning
verified: 2026-04-05T22:00:00Z
status: human_needed
score: 9/9 must-haves verified
re_verification: false
human_verification:
  - test: "Sidecar REPL memory commands work end-to-end"
    expected: "After thread deletion, /memory forget is sent to sidecar and acknowledged. After consolidation, /memory update pushes a concept."
    why_human: "Requires running Ironclaw sidecar process. sidecarSyncService.checkSidecarMemorySupport() lazily detects capability — cannot test without live sidecar."
  - test: "Post-conversation extraction produces accurate concept drafts"
    expected: "After a multi-message conversation, idle/close trigger fires extraction. Concepts in the Knowledge tab reflect actual conversation content with reasonable confidence and correct type classification."
    why_human: "Embedding quality and LLM extraction accuracy require subjective evaluation. Automated verification only confirms the code path executes, not that extracted concepts are meaningful."
  - test: "Knowledge tab concepts render correctly with version history"
    expected: "Opening IronclawDrawer Knowledge tab shows concept cards with type-color badges. Clicking a concept expands it. Clicking 'View history' shows the version timeline with border-l-2 border-amber-400 on the current version."
    why_human: "Visual rendering and UI interaction require browser testing. TypeScript compiles clean but component rendering cannot be confirmed without a running browser."
  - test: "Semantic retrieval injects relevant learned context into Ironclaw responses"
    expected: "After extracting a concept (e.g., Russia naval posture), a new message asking about the same topic should include a [LEARNED CONTEXT] block visible in the Ironclaw system context log."
    why_human: "Requires full runtime stack: OPENAI_API_KEY for embeddings, running ironclaw-postgres with pgvector, and a conversation session to inject into."
---

# Phase 66: Ironclaw Memory Evolution, Concept Learning & Reinforcement — Verification Report

**Phase Goal:** Ironclaw Memory Evolution, Concept Learning & Reinforcement — versioned concept store, post-conversation extraction, semantic retrieval with prompt injection, Knowledge UI panel, cross-thread consolidation, decision path memory, sidecar sync.
**Verified:** 2026-04-05T22:00:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| #  | Truth                                                                              | Status     | Evidence                                                                                |
|----|------------------------------------------------------------------------------------|------------|-----------------------------------------------------------------------------------------|
| 1  | Versioned concept store exists with pgvector schema and CRUD+semantic search       | VERIFIED   | concept-store.ts (467 lines): upsertConcept, semanticSearch, retractByThread, getConsolidationCandidates all implemented; migration 052-ironclaw-concepts.sql creates HNSW index |
| 2  | Post-conversation extraction fires on idle timeout, thread switch, drawer close    | VERIFIED   | useIronclaw.ts: idleTimerRef + 5*60*1000 timeout in sendMessage; selectThread() fires triggerExtraction(currentThreadIdRef.current); closeDrawer() fires triggerExtraction |
| 3  | LLM extraction produces structured concept drafts and upserts them                 | VERIFIED   | concept-extraction.ts (175 lines): claude-haiku-4-5-20251001, conceptStore.upsertConcept with generateConceptEmbedding per draft |
| 4  | Semantic retrieval injects [LEARNED CONTEXT] block per message                    | VERIFIED   | concept-retrieval.ts: getLearnedContextBlock with Promise.race 400ms timeout, similarity > 0.3 filter; ironclaw-service.ts extends Promise.all with conceptBlock in preamble |
| 5  | Knowledge tab in IronclawDrawer shows concept cards with filter/history/retract    | VERIFIED   | IronclawConceptsPanel.tsx (590 lines): TYPE_COLORS map, filter pills with role="group"/aria-pressed, version history accordion, bg-red-900/20 retract confirmation; IronclawDrawer.tsx extends drawerTab to include 'knowledge' with border-amber-500 active state |
| 6  | Commander can rate autonomous activity with thumbs up/down, persisted to DB        | VERIFIED   | autonomous-activity-store.ts: outcome_status, commander_rating, commander_notes columns + updateOutcome() + getRatedActivities(); PATCH /:problemSetId/activity/:activityId/rate endpoint validates rating as exactly 1 or -1; IronclawActivityFeed.tsx renders rating row with 30-second delay guard |
| 7  | Cross-thread consolidation job runs every 6 hours merging multi-version concepts   | VERIFIED   | concept-consolidation.ts (255 lines): CONSOLIDATION_INTERVAL_MS = 6*60*60*1000, runConsolidation with claude-haiku-4-5-20251001, contradiction detection, sourceThreadId: 'consolidation'; startConsolidationJob called in index.ts initIronclawMemory() |
| 8  | Decision path memory records autonomous action outcomes as lesson concepts          | VERIFIED   | decision-path-store.ts (161 lines): recordDecisionPath upserts conceptType: 'lesson' with sourceThreadId: 'autonomous'; confidence derived from commanderRating (positive=0.8, negative=0.3, unrated=0.5); buildDecisionPathsFromRatedActivities scans last 24h |
| 9  | Sidecar sync pushes concepts and forgets threads via REPL commands                 | VERIFIED   | sidecar-sync.ts (127 lines): pushConceptToSidecar sends /memory update, forgetThread sends /memory forget, checkSidecarMemorySupport lazy-caches capability; ironclaw-store.ts deleteThread fires sidecarSyncService.forgetThread (fire-and-forget); concept-consolidation.ts calls pushConceptToSidecar after each upsert |

**Score:** 9/9 truths verified (code-level). 4 items require human/runtime verification.

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `backend/src/db/migrations/052-ironclaw-concepts.sql` | ironclaw_concepts table with pgvector | VERIFIED | Creates ironclaw_concept_type ENUM, vector(1536) column, HNSW index, composite lookup index |
| `backend/src/ironclaw/concept-types.ts` | ConceptType, ConceptEntry, ConceptUpsertInput, ConceptDraft | VERIFIED | 72 lines, exports all 4 types |
| `backend/src/ironclaw/concept-store.ts` | ConceptStore class with full CRUD + semantic search | VERIFIED | 467 lines; upsertConcept, getActive, getVersionChain, semanticSearch, retractByThread, retractById, getConsolidationCandidates, generateConceptEmbedding |
| `backend/src/ironclaw/concept-router.ts` | REST API (5 endpoints) mounted in ironclaw-router | VERIFIED | 159 lines; GET global/concepts, GET :problemSetId/concepts, GET :conceptKey/history, POST :conceptId/retract, POST :problemSetId/concepts |
| `backend/src/ironclaw/autonomous-activity-store.ts` | Extended with outcome tracking + updateOutcome + getRatedActivities | VERIFIED | outcome_status/commander_rating/commander_notes in both CREATE and ALTER TABLE; updateOutcome and getRatedActivities methods confirmed |
| `backend/src/ironclaw/concept-extraction.ts` | extractFromThread, LLM pass, upsert | VERIFIED | 175 lines; extractFromThread with Haiku, conceptStore.upsertConcept, generateConceptEmbedding, in-memory Set deduplication |
| `frontend/src/hooks/useIronclaw.ts` | triggerExtraction, idleTimerRef, 3 trigger sites | VERIFIED | triggerExtraction useCallback, idleTimerRef, 5*60*1000, fires on sendMessage/selectThread/closeDrawer |
| `backend/src/ironclaw/concept-retrieval.ts` | getLearnedContextBlock with timeout + similarity filter | VERIFIED | 141 lines; Promise.race 400ms, semanticSearch, SIMILARITY_THRESHOLD=0.3, [LEARNED CONTEXT] block assembly, exports conceptRetrievalService |
| `backend/src/ironclaw/ironclaw-service.ts` | conceptBlock injected into preamble | VERIFIED | imports conceptRetrievalService, extends Promise.all to 4-element, conceptBlock in preamble array between memoryBlock and kgContextBlock |
| `frontend/src/components/ironclaw/IronclawConceptsPanel.tsx` | Knowledge panel with filter, cards, history, retract | VERIFIED | 590 lines; TYPE_COLORS (8 types), filter pills role="group"/aria-pressed, expand/collapse, version history accordion, bg-red-900/20 retract banner, empty/error states |
| `frontend/src/components/ironclaw/IronclawDirectivesPanel.tsx` | Commander priorities input/list with undo | VERIFIED | 297 lines; "No priorities set" empty state, Prioritize Baltic placeholder, 3000ms undo, fetch to /concepts POST |
| `frontend/src/components/ironclaw/IronclawDrawer.tsx` | Knowledge tab added | VERIFIED | drawerTab type includes 'knowledge', border-amber-500 active state, renders IronclawConceptsPanel + IronclawDirectivesPanel |
| `backend/src/ironclaw/concept-consolidation.ts` | 6h scheduled job, LLM merge, contradiction detection | VERIFIED | 255 lines; CONSOLIDATION_INTERVAL_MS=6*60*60*1000, runConsolidation, startConsolidationJob, sourceThreadId: 'consolidation', contradicted handling |
| `backend/src/ironclaw/decision-path-store.ts` | recordDecisionPath, buildDecisionPathsFromRatedActivities | VERIFIED | 161 lines; conceptType: 'lesson', sourceThreadId: 'autonomous', confidence from commanderRating |
| `backend/src/ironclaw/index.ts` | startConsolidationJob called | VERIFIED | imports and calls startConsolidationJob in initIronclawMemory |
| `backend/src/ironclaw/sidecar-sync.ts` | pushConceptToSidecar, forgetThread, pushBulkConcepts | VERIFIED | 127 lines; /memory update and /memory forget REPL commands, checkSidecarMemorySupport, 100ms delay in pushBulkConcepts |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `IronclawActivityFeed.tsx` | `/api/ironclaw/:problemSetId/activity/:activityId/rate` | fetch PATCH | WIRED | fetch call at lines 373 and 397 with /rate suffix |
| `concept-extraction.ts` | `concept-store.ts` | conceptStore.upsertConcept() | WIRED | line 144: conceptStore.upsertConcept({...}) with embedding |
| `useIronclaw.ts` | `/api/ironclaw/:problemSetId/extract` | fetch POST on idle/close/switch | WIRED | triggerExtraction useCallback fires fetch to /extract on all 3 trigger sites |
| `ironclaw-store.ts deleteThread` | `concept-store.ts retractByThread` | retraction hook | WIRED | line 372: conceptStore.retractByThread(threadId) |
| `ironclaw-service.ts` | `concept-retrieval.ts` | Promise.all + getLearnedContextBlock | WIRED | line 365: conceptRetrievalService.getLearnedContextBlock(userDid, problemSetId, content, 400) |
| `IronclawDrawer.tsx` | `IronclawConceptsPanel.tsx` | drawerTab === 'knowledge' | WIRED | line 491: {drawerTab === 'knowledge' && ...IronclawConceptsPanel} |
| `IronclawConceptsPanel.tsx` | `/api/ironclaw/:problemSetId/concepts` | fetch GET | WIRED | fetchConcepts() at line 376-377 |
| `concept-consolidation.ts` | `concept-store.ts` | conceptStore.getConsolidationCandidates() + upsertConcept() | WIRED | lines 88 and ~201: both methods invoked in runConsolidation |
| `decision-path-store.ts` | `concept-store.ts` | conceptStore.upsertConcept (lesson concepts) | WIRED | recordDecisionPath calls conceptStore.upsertConcept with conceptType: 'lesson' |
| `sidecar-sync.ts` | `ironclaw-client.ts` | sendMessage for REPL commands | WIRED | sendMessage called with '/memory update' and '/memory forget' |
| `ironclaw-store.ts` | `sidecar-sync.ts` | sidecarSyncService.forgetThread | WIRED | line 379: sidecarSyncService.forgetThread(threadId).catch(...) |
| `concept-consolidation.ts` | `sidecar-sync.ts` | sidecarSyncService.pushConceptToSidecar | WIRED | line 209: sidecarSyncService.pushConceptToSidecar(consolidatedConcept) |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|-------------------|--------|
| `IronclawConceptsPanel.tsx` | `concepts` state | `fetch /api/ironclaw/:problemSetId/concepts` → concept-router.ts → `conceptStore.getActive(userDid, problemSetId)` → SQL SELECT WHERE user_did AND status='active' | Yes — parameterized DB query | FLOWING |
| `IronclawDirectivesPanel.tsx` | `directives` state | `fetch /api/ironclaw/:problemSetId/concepts` filtered by concept_type='directive' → same concept-router.ts path | Yes — same real DB query | FLOWING |
| `ironclaw-service.ts preamble` | `conceptBlock` | `conceptRetrievalService.getLearnedContextBlock` → `conceptStore.semanticSearch` → pgvector cosine similarity query | Yes — real DB query with HNSW index; degrades to '' when OPENAI_API_KEY absent | FLOWING |
| `concept-extraction.ts` | `messages` | `getPool().query('SELECT sender, content FROM ironclaw_chat WHERE thread_id = $1')` | Yes — real conversation messages from DB | FLOWING |

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Backend TypeScript compiles clean | `cd backend && npx tsc --noEmit` | No output (exit 0) | PASS |
| Frontend TypeScript compiles clean | `cd frontend && npx tsc --noEmit` | No output (exit 0) | PASS |
| concept-store.ts exports all required methods | grep for method signatures | upsertConcept, semanticSearch, retractByThread, getConsolidationCandidates all found | PASS |
| All 7 new backend files exist | ls check | concept-store.ts, concept-types.ts, concept-router.ts, concept-extraction.ts, concept-retrieval.ts, concept-consolidation.ts, decision-path-store.ts, sidecar-sync.ts | PASS |
| DB migration file present | ls 052-ironclaw-concepts.sql | EXISTS | PASS |
| Sidecar sync wired in thread deletion and consolidation | grep for sidecarSyncService in ironclaw-store.ts and concept-consolidation.ts | Both files import and call sidecarSyncService | PASS |

---

### Requirements Coverage

The SC IDs referenced in plan frontmatter are phase-internal success criteria (no global REQUIREMENTS.md exists in this project). Mapping derived from VALIDATION.md task-to-SC assignments and plan objectives:

| Requirement | Source Plan | Description (derived) | Status | Evidence |
|-------------|------------|----------------------|--------|---------|
| SC-01 | Plans 03, 04 | Post-conversation extraction + semantic retrieval + versioned concept store (core learning loop) | SATISFIED | concept-extraction.ts + concept-retrieval.ts + concept-store.ts all implemented and wired; ironclaw-service.ts injects conceptBlock |
| SC-02 | Plan 05 | Knowledge UI panel showing learned concepts with filter/history/retract | SATISFIED | IronclawConceptsPanel.tsx 590 lines; Knowledge tab in IronclawDrawer wired |
| SC-03 | Plan 07 | Sidecar sync — push consolidated concepts, forget on thread deletion | SATISFIED (code-level) | sidecar-sync.ts wired in ironclaw-store.ts and concept-consolidation.ts; runtime behavior requires human verification |
| SC-04 | Plan 06 | Cross-thread consolidation job (6h interval, LLM merge, contradiction detection) | SATISFIED | concept-consolidation.ts 255 lines; started in index.ts |
| SC-06 | Plan 04 | Semantic retrieval injects [LEARNED CONTEXT] block into every Ironclaw message | SATISFIED (code-level) | ironclaw-service.ts wired; embedding quality requires human evaluation |
| SC-07 | Plan 02 | Commander feedback on autonomous activities (thumbs up/down, outcome tracking) | SATISFIED | activity store extended, PATCH rate endpoint, UI rating controls in IronclawActivityFeed |
| SC-08 | Plan 06 | Decision path memory — autonomous actions → lesson concepts for reinforcement | SATISFIED | decision-path-store.ts records lessons from rated activities; buildDecisionPathsFromRatedActivities in consolidation job |
| SC-09 | Plan 05 | Commander Priorities / Directives panel | SATISFIED | IronclawDirectivesPanel.tsx 297 lines; add/remove with 3s undo; rendered in Knowledge tab |

**SC-05 Status:** Not referenced in any plan frontmatter or VALIDATION.md task mapping. No deliverable was planned or executed for SC-05. This appears to be an intentionally skipped or non-existent requirement ID within this phase numbering scheme.

**Note on REQUIREMENTS.md:** The `.planning/REQUIREMENTS.md` file does not exist in this project. The SC-xx identifiers are phase-internal success criteria defined within the phase context. No cross-project requirements traceability file exists to verify against.

---

### Anti-Patterns Found

| File | Pattern | Severity | Impact |
|------|---------|----------|--------|
| None found | — | — | All new files are substantive implementations with no TODO/FIXME/placeholder patterns |

Scan performed on all 8 new backend files and 2 new frontend components. No empty returns, stub implementations, or placeholder comments found.

---

### Human Verification Required

#### 1. Sidecar REPL Memory Commands

**Test:** Start the Ironclaw sidecar, delete a thread via the BASTION UI, then inspect the sidecar logs.
**Expected:** Log shows `/memory forget {threadId}` was received and acknowledged by the sidecar. Then trigger a consolidation run (or call `runConsolidation()` directly) and verify `/memory update {conceptKey} {value}` appears in sidecar logs.
**Why human:** Requires a running Ironclaw sidecar process. `checkSidecarMemorySupport()` may return `false` if the sidecar doesn't implement `/memory list`, causing the sync to silently skip. Graceful degradation code is correct but the happy path requires a live sidecar.

#### 2. Extraction Accuracy

**Test:** Open a problem set, have a 5+ message conversation with Ironclaw about a specific topic (e.g., Baltic naval posture). Close the drawer. Wait ~10 seconds, then reopen the Knowledge tab.
**Expected:** At least one concept card appears reflecting the conversation content (e.g., concept_key contains "naval" or "baltic", conceptType is actor/situation/assessment, confidence > 0.5). The concept value text accurately summarizes what was discussed.
**Why human:** LLM extraction quality (Haiku pass producing meaningful ConceptDraft JSON) cannot be verified without a live Anthropic API key and a real conversation. Code path is correct; output quality is subjective.

#### 3. Knowledge Tab Visual Rendering

**Test:** Open IronclawDrawer in a browser with at least one extracted concept in the database. Navigate to the Knowledge tab. Click a concept card to expand it. Click "View history" on a multi-version concept.
**Expected:** Concept cards render with colored type badges, version number, confidence %, relative time. Expanded view shows full value text. Version history shows timeline with `border-l-2 border-amber-400` on the current version and line-through text on superseded versions.
**Why human:** CSS transition animations (`max-h-0` → `max-h-96`, chevron rotation) and visual styling require browser rendering. TypeScript compiles clean but visual correctness requires visual inspection.

#### 4. Semantic Retrieval in Live Conversation

**Test:** After extracting a concept via step 2, start a new conversation thread and ask Ironclaw about the same topic. Inspect the system prompt/preamble sent to Ironclaw (via server logs with DEBUG enabled).
**Expected:** The preamble includes a `[LEARNED CONTEXT]` block listing the extracted concept with similarity > 0.3 and the concept's value text. Ironclaw's response references the learned concept naturally.
**Why human:** Requires OPENAI_API_KEY for embedding generation, a populated ironclaw_concepts table, and a live conversation flow to confirm end-to-end injection works at runtime.

---

## Gaps Summary

No structural gaps found. All 9 observable truths are verified at the code level (artifacts exist, are substantive, are wired, and data flows through real DB queries). TypeScript compiles clean for both backend and frontend.

The 4 human verification items are runtime/quality checks that require a live deployment environment, not indicators of missing or incomplete code.

**Notable observation:** The 66-01-PLAN.md file is absent from the phase directory (deleted in commit a61701a5, the first plan 01 commit). This is unusual but not a gap — the plan's must_haves are fully captured in 66-01-SUMMARY.md and the dependent plans' interface sections. The code deliverables from Plan 01 are present and verified.

---

_Verified: 2026-04-05T22:00:00Z_
_Verifier: Claude (gsd-verifier)_
