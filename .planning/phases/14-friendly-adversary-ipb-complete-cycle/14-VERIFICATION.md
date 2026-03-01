---
phase: 14-friendly-adversary-ipb-complete-cycle
verified: 2026-03-01T03:20:13Z
status: human_needed
score: 22/22 must-haves verified
re_verification:
  previous_status: gaps_found
  previous_score: 21/22
  gaps_closed:
    - "Selecting a SITREP for update shows a delta preview with affected COAs before committing changes (EX-15)"
  gaps_remaining: []
  regressions: []
human_verification:
  - test: "Upload a scenario package with DOCX/PPTX/PDF files from the scenario/ directory"
    expected: "Files are tagged with correct team/phase/type and appear in document list after extraction"
    why_human: "Requires real file upload interaction, browser folder picker, and live LLM extraction to verify end-to-end"
  - test: "Navigate to /exercise, switch to Blue perspective, then Red perspective"
    expected: "Dashboard border accent changes (blue vs red), watermark text changes ('BLUE FORCE' vs 'RED FORCE'), all tab content reflects new perspective"
    why_human: "Visual CSS indicator behavior requires browser rendering"
  - test: "Click 'Assemble IPB' for Blue team and then switch to Red mode 'Red as Blue sees them'"
    expected: "Map shows different force dispositions, milsymbol icons render with correct affiliation colors"
    why_human: "milsymbol rendering and GeoJSON layer display require browser/map rendering"
  - test: "Score a COA and review the decision matrix"
    expected: "5 FASDC criteria show color-coded scores (green/yellow/orange/red gradient), combined score calculates as average"
    why_human: "Visual matrix rendering and LLM-generated score quality require human review"
  - test: "Generate a WARNORD for Blue team, publish it, verify tasks appear on Planning Board"
    expected: "Published order creates planning tasks visible as Kanban cards in Pending column"
    why_human: "End-to-end order publication flow requires live backend and database"
  - test: "Select a SITREP document from the 'Update from SITREP' dropdown in IPBPanel"
    expected: "Delta preview modal opens showing changedFields table (color-coded added/modified/removed), affectedCOAs list, sitrepSummary excerpt; 'Confirm Update' and 'Cancel' buttons; clicking Confirm triggers updateIPBFromSITREP creating a new version; clicking Cancel discards the preview"
    why_human: "Staff workflow confirmation UI and delta content quality require human evaluation against live LLM output; this was the previously-blocked EX-15 path"
  - test: "Record a commander decision (accept a COA) from CommanderDecisionPanel"
    expected: "SHA-256 hash displays after submission (16 chars + '...'), 'Blockchain anchoring pending' indicator shows; decision appears in history timeline"
    why_human: "SHA-256 hash display and blockchain outbox status require live backend"
---

# Phase 14: Friendly & Adversary IPB Complete Cycle — Verification Report

**Phase Goal:** Build exercise scenario from provided documents with dual-perspective IPB, COA development with probability scoring, concurrent operation support, and commander decision-forcing workflows
**Verified:** 2026-03-01T03:20:13Z
**Status:** human_needed
**Re-verification:** Yes — after gap closure (Plan 14-11)

## Re-verification Summary

**Previous status:** gaps_found (21/22, 2026-02-28T22:00:00Z)
**Current status:** human_needed (22/22)

The single gap from initial verification — EX-15 SITREP delta preview backend endpoint — has been fully implemented and verified. All 22 automated checks now pass. Remaining items are human-only (visual/UX/live-LLM).

### What Changed

Plan 14-11 added two artifacts to close EX-15:

1. `IPBService.previewIPBFromSITREP()` method in `backend/src/exercise/ipb-service.ts` (lines 465-662, ~200 lines): runs the same LLM delta extraction as `updateIPBFromSITREP` but stops before calling `ipbStore.createNewVersion()`, returning a `SITREPDeltaPreview` object containing `changedFields`, `affectedCOAs`, and `sitrepSummary`.
2. `POST /api/exercise/ipb/:assessmentId/sitrep-preview` route in `backend/src/api/exercise.ts` (lines 463-489): placed before `update-from-sitrep` to ensure correct path matching; validates `sitrepDocId` body param; calls `ipbService.previewIPBFromSITREP()`.

**No regressions detected.** All previously-verified items retain their line counts and wiring.

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Exercise scenario data model supports dual-team (blue/red) with controller visibility | VERIFIED | `backend/src/exercise/types.ts` (414 lines): ExerciseScenario, ScenarioDocument, IPBAssessment, IPBLayer, ScenarioCOA, ExerciseOrder, PlanningTask, ExerciseGate all defined with team fields |
| 2 | All 7 database tables exist with correct foreign keys and team column filtering | VERIFIED | `backend/database/014-exercise-tables.sql` (213 lines): exercise_scenarios, scenario_documents, ipb_assessments, scenario_coas, exercise_orders, planning_tasks, exercise_gates — all with FK cascades, JSONB columns, composite (scenario_id, team) indexes |
| 3 | Information barrier function correctly limits visibility by exercise role | VERIFIED | `backend/src/exercise/information-barrier.ts`: getVisibleTeams(exercise_control)=['blue','red','controller'], getVisibleTeams(blue_staff)=['blue','controller'], getVisibleTeams(red_cell)=['red','controller']; withExerciseBarrier middleware sets req.visibleTeams; 21 occurrences of AND team = ANY($N) across 5 team-filtered stores |
| 4 | Zod schemas validate all exercise entity types at runtime | VERIFIED | `backend/src/exercise/schemas.ts` (241 lines): Zod v4 schemas covering all create/update variants |
| 5 | Directory structure parsing correctly infers team/phase/type from folder names | VERIFIED | `backend/src/exercise/package-parser.ts` (197 lines): TEAM_HEURISTICS, PHASE_HEURISTICS, TYPE_HEURISTICS regex arrays; inferTagsFromPath() correctly tags scenario/ directory sample paths |
| 6 | Exercise extraction service sends team-specific system prompts and stores structured results | VERIFIED | `backend/src/exercise/extraction-service.ts` (506 lines): ExerciseExtractionService wraps DocumentParser.chunkDocument() with team-isolated system prompts |
| 7 | IPB service assembles dual-perspective assessments (Blue own, Blue assessment of Red, Red own, Red assessment of Blue) | VERIFIED | `backend/src/exercise/ipb-service.ts` (894 lines): assembleIPB(team, perspective) with 'own' and 'enemy_assessment' perspectives, LLM-generated OAKOC+NAI+forceDispositions; SIDC affiliation F=own/H=enemy |
| 8 | IPB service generates overlay layers with GeoJSON geometries and SIDC codes | VERIFIED | ipb-service.ts: generateOverlayLayers() produces IPBLayer[] with type=unit(Point)/area(Polygon)/line(LineString)/point(NAI); SIDC codes with affiliation character |
| 9 | COA scoring service combines 5 FASDC doctrinal criteria with wargame evidence into combined score | VERIFIED | `backend/src/exercise/coa-scoring-service.ts` (504 lines): scoreCOA() extracts feasibility/acceptability/suitability/distinguishability/completeness (0-100 each); combinedScore = (F+A+S+D+C)/5 equal-weight; wargame evidence augments criterion rationales |
| 10 | COA scoring generates AI narrative with staff-editable output | VERIFIED | coa-scoring-service.ts: generates 2-3 paragraph narrative; updateNarrative() method; compareCOAs() returns matrix+rankings+narrative+recommendation |
| 11 | Commander decision recording with blockchain anchoring | VERIFIED | coa-scoring-service.ts: recordCommanderDecision() computes SHA-256 hash, writes to outbox (aggregate_type='commander_decision') for NEAR blockchain sync |
| 12 | WARNORD/OPORD/FRAGO generation with team-isolated content | VERIFIED | `backend/src/exercise/order-generator.ts` (720 lines): generateWARNORD/generateOPORD/generateFRAGO with team-specific LLM prompts; Blue=CJTF WestPAC, Red=PRC/TCC |
| 13 | Publishing an order automatically creates planning tasks | VERIFIED | `backend/src/exercise/planning-board-service.ts` (403 lines): publishOrder() extracts tasks; creates PlanningTask records; emits exercise.order.published MessageBus event |
| 14 | All exercise CRUD operations exposed via REST API with information barrier enforcement | VERIFIED | `backend/src/api/exercise.ts` (1084 lines): 30+ endpoints; withExerciseBarrier at router level (line 122); every store call passes req.visibleTeams |
| 15 | Exercise module accessible from main application navigation | VERIFIED | `frontend/src/App.tsx`: 'exercise' in MAIN_TABS, /exercise route, ExerciseDashboard rendered under isExercise flag |
| 16 | User can create scenario and upload multi-file package with tag preview | VERIFIED | `frontend/src/components/exercise/ScenarioPackageUpload.tsx` (508 lines): drag-and-drop, webkitdirectory, client-side tag inference table, manual override dropdowns |
| 17 | Exercise dashboard provides perspective toggle and phase timeline | VERIFIED | `frontend/src/components/exercise/ExerciseDashboard.tsx` (591 lines): perspective toggle Blue/Red with CJTF WestPAC / PRC/TCC labels; 7-tab routing; controller view toggle |
| 18 | IPB panel shows dual-perspective view with milsymbol icons and layer controls | VERIFIED | `frontend/src/components/exercise/IPBPanel.tsx` (658 lines): Blue own + Red enemy_assessment + Red self modes; `frontend/src/components/validity/ValidityMap.tsx` (843 lines): milsymbol ms.Symbol SIDC icons, Polygon areas, Polyline avenues, Circle NAIs via IPBLayerRenderer; IPBLayerControls (169 lines) |
| 19 | Selecting a SITREP for update shows a delta preview with affected COAs before committing changes | VERIFIED | `backend/src/exercise/ipb-service.ts`: previewIPBFromSITREP() method at line 465 returns SITREPDeltaPreview {changedFields, affectedCOAs, sitrepSummary} without calling createNewVersion(); `backend/src/api/exercise.ts`: POST /ipb/:assessmentId/sitrep-preview at line 469; IPBPanel.tsx line 420 calls exerciseService.previewIPBFromSITREP(); exercise-service.ts line 240-242 targets /api/exercise/ipb/:assessmentId/sitrep-preview |
| 20 | COA comparison matrix with editable narrative and commander decision workflow | VERIFIED | `frontend/src/components/exercise/COAScoringPanel.tsx` (677 lines) + `CommanderDecisionPanel.tsx` (741 lines): FASDC matrix with color-coded cells; AI Generated/Edited badge; all 5 decision types; SHA-256 hash display; blockchain anchoring indicator |
| 21 | Order editor supports AI generation and manual authoring for all 3 order types | VERIFIED | `frontend/src/components/exercise/OrderEditor.tsx` (1279 lines): generate WARNORD/OPORD/FRAGO buttons; blank draft creation; 5-paragraph OPORD; publish confirmation |
| 22 | Planning board shows Kanban task tracking with team/role filtering | VERIFIED | `frontend/src/components/exercise/PlanningBoard.tsx` (480 lines): Pending/In Progress/Complete columns; team left-border colors; role filter; completion progress bar |

**Score:** 22/22 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `backend/src/exercise/types.ts` | All exercise TS types | VERIFIED | 414 lines |
| `backend/src/exercise/schemas.ts` | Zod validation schemas | VERIFIED | 241 lines |
| `backend/src/exercise/information-barrier.ts` | getVisibleTeams + withExerciseBarrier | VERIFIED | 73 lines |
| `backend/database/014-exercise-tables.sql` | 7 tables migration | VERIFIED | 213 lines |
| `backend/src/exercise/scenario-store.ts` | ScenarioStore CRUD | VERIFIED | 137 lines |
| `backend/src/exercise/document-store.ts` | ScenarioDocumentStore with team filter | VERIFIED | 145 lines |
| `backend/src/exercise/ipb-store.ts` | IPBStore with version history | VERIFIED | 198 lines |
| `backend/src/exercise/coa-store.ts` | COAStore | VERIFIED | 199 lines |
| `backend/src/exercise/order-store.ts` | OrderStore | VERIFIED | 142 lines |
| `backend/src/exercise/task-store.ts` | TaskStore | VERIFIED | 161 lines |
| `backend/src/exercise/gate-store.ts` | GateStore | VERIFIED | 126 lines |
| `backend/src/exercise/index.ts` | Barrel export | VERIFIED | 119 lines |
| `backend/src/exercise/package-parser.ts` | inferTagsFromPath + heuristics | VERIFIED | 197 lines |
| `backend/src/exercise/extraction-service.ts` | ExerciseExtractionService | VERIFIED | 506 lines |
| `backend/src/exercise/ipb-service.ts` | IPBService with previewIPBFromSITREP | VERIFIED | 894 lines — includes new previewIPBFromSITREP() method and SITREPDeltaPreview interface |
| `backend/src/exercise/coa-scoring-service.ts` | COAScoringService | VERIFIED | 504 lines |
| `backend/src/exercise/order-generator.ts` | ExerciseOrderGenerator | VERIFIED | 720 lines |
| `backend/src/exercise/planning-board-service.ts` | PlanningBoardService | VERIFIED | 403 lines |
| `backend/src/api/exercise.ts` | Express router with sitrep-preview route | VERIFIED | 1084 lines — POST /ipb/:assessmentId/sitrep-preview at line 469, before update-from-sitrep at line 495 |
| `frontend/src/services/exercise-service.ts` | Typed API client | VERIFIED | 540 lines — previewIPBFromSITREP() at line 240 |
| `frontend/src/types/exercise.ts` | Frontend type interfaces | VERIFIED | 353 lines |
| `frontend/src/components/exercise/ExerciseDashboard.tsx` | Dashboard with all tabs | VERIFIED | 591 lines |
| `frontend/src/components/exercise/ScenarioPackageUpload.tsx` | Multi-file upload | VERIFIED | 508 lines |
| `frontend/src/components/exercise/IPBPanel.tsx` | IPB panel with delta preview | VERIFIED | 658 lines — calls previewIPBFromSITREP() at line 420 (route now exists) |
| `frontend/src/components/exercise/IPBLayerControls.tsx` | Layer toggle panel | VERIFIED | 169 lines |
| `frontend/src/components/validity/ValidityMap.tsx` | Extended with IPB layers | VERIFIED | 843 lines |
| `frontend/src/components/exercise/COAScoringPanel.tsx` | Decision matrix + narrative | VERIFIED | 677 lines |
| `frontend/src/components/exercise/CommanderDecisionPanel.tsx` | Commander decision workflow | VERIFIED | 741 lines |
| `frontend/src/components/exercise/OrderEditor.tsx` | WARNORD/OPORD/FRAGO editor | VERIFIED | 1279 lines |
| `frontend/src/components/exercise/PlanningBoard.tsx` | Kanban task board | VERIFIED | 480 lines |
| `frontend/src/components/exercise/ExerciseTimeline.tsx` | Phase timeline | VERIFIED | 231 lines |
| `frontend/src/components/exercise/GateControl.tsx` | Gate management | VERIFIED | 581 lines |
| `frontend/src/components/exercise/index.ts` | Barrel file | VERIFIED | 20 lines |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `information-barrier.ts` | all stores | `AND team = ANY($N)` | VERIFIED | document-store: 4, ipb-store: 5, coa-store: 3, order-store: 4, task-store: 5 occurrences |
| `package-parser.ts` | scenario/ dir structure | regex heuristics match folder names | VERIFIED | TEAM/PHASE/TYPE_HEURISTICS pattern arrays |
| `extraction-service.ts` | strategic extractor | wraps DocumentParser.chunkDocument() + LLM | VERIFIED | team-isolated system prompts |
| `ipb-service.ts` | `document-store.ts` | documentStore.findByScenarioAndPhase | VERIFIED | line 176 |
| `ipb-service.ts` | `ipb-store.ts` | ipbStore.create, ipbStore.createNewVersion | VERIFIED | updateIPBFromSITREP path only |
| `order-generator.ts` | `document-store.ts` | documentStore.findByScenario | VERIFIED | reads team-visible documents |
| `planning-board-service.ts` | `message-bus.ts` | bus.publish('exercise.order.published') | VERIFIED | MessageBus event emissions |
| `api/exercise.ts` | `information-barrier.ts` | withExerciseBarrier at router level | VERIFIED | line 122 |
| `backend/src/index.ts` | `api/exercise.ts` | app.use('/api/exercise', exerciseRouter) | VERIFIED | line 103 |
| `exercise-service.ts` | `api/exercise.ts` | fetch('/api/exercise/*') | VERIFIED | API_BASE='/api/exercise', 30+ typed fetch calls |
| **`IPBPanel.tsx`** | **`exercise-service.ts`** | **exerciseService.previewIPBFromSITREP()** | **VERIFIED** | **line 420 in IPBPanel.tsx — was BROKEN before Plan 14-11** |
| **`exercise-service.ts`** | **`api/exercise.ts`** | **POST /api/exercise/ipb/:assessmentId/sitrep-preview** | **VERIFIED** | **line 242 in exercise-service.ts, route at line 469 in exercise.ts** |
| **`api/exercise.ts`** | **`ipb-service.ts`** | **ipbService.previewIPBFromSITREP()** | **VERIFIED** | **route at line 479 calls method at line 465 in ipb-service.ts** |
| `IPBPanel.tsx` | `exercise-service.ts` | exerciseService.updateIPBFromSITREP | VERIFIED | line 435 (commit path, no regression) |
| `ValidityMap.tsx` | milsymbol | ms.Symbol SIDC icons via L.divIcon | VERIFIED | import ms from 'milsymbol'; createMilsymbolIcon() |
| `COAScoringPanel.tsx` | `exercise-service.ts` | exerciseService.getCOAs, scoreCOA, compareCOAs | VERIFIED | lines 239, 266, 281 |
| `CommanderDecisionPanel.tsx` | `exercise-service.ts` | exerciseService.recordDecision | VERIFIED | line 522 |
| `OrderEditor.tsx` | `exercise-service.ts` | exerciseService.generateOrder, publishOrder | VERIFIED | lines 942, 923 |
| `PlanningBoard.tsx` | `exercise-service.ts` | exerciseService.getTasks, updateTaskStatus | VERIFIED | lines 286, 307 |
| `GateControl.tsx` | `exercise-service.ts` | exerciseService.getGates, openGate, createGate | VERIFIED | lines 333, 357, 379 |
| `ExerciseDashboard.tsx` | all components | tab routing renders all 7 panels | VERIFIED | lines 501, 514, 519, 534, 546, 558, 570 |
| `App.tsx` | `ExerciseDashboard.tsx` | /exercise route + Exercise nav button | VERIFIED | MAIN_TABS includes 'exercise' |

### Requirements Coverage

| Requirement | Source Plan | Description | Status |
|-------------|------------|-------------|--------|
| EX-01 | 14-01 | Exercise scenario data model — ExerciseScenario entity | SATISFIED |
| EX-02 | 14-01 | Information barrier — role-based team visibility (getVisibleTeams) | SATISFIED |
| EX-03 | 14-01 | Database migration — 7 tables with FK constraints, JSONB, indexes | SATISFIED |
| EX-04 | 14-02 | Scenario package parser — directory path heuristic tag inference | SATISFIED |
| EX-05 | 14-02 | Exercise extraction service — team-isolated LLM prompts, structured extraction | SATISFIED |
| EX-06 | 14-03 | IPB assembly service — dual-perspective from extracted documents | SATISFIED |
| EX-07 | 14-03 | COA scoring service — FASDC criteria + wargame evidence + blockchain anchoring | SATISFIED |
| EX-08 | 14-04 | WARNORD generation with team-specific initial tasks | SATISFIED |
| EX-09 | 14-04 | OPORD generation with full 5-paragraph format from selected COA | SATISFIED |
| EX-10 | 14-04 | Planning board service — task lifecycle, MessageBus notifications | SATISFIED |
| EX-11 | 14-05 | REST API — 30+ endpoints with information barrier middleware | SATISFIED |
| EX-12 | 14-06 | Frontend exercise API service client — typed methods for all endpoints | SATISFIED |
| EX-13 | 14-06 | Exercise dashboard shell — perspective toggle, phase navigation, 7 tabs, upload | SATISFIED |
| EX-14 | 14-07 | IPB panel — dual-perspective display, layer controls, assessment details | SATISFIED |
| EX-15 | 14-07 / 14-11 | SITREP delta preview — staff reviews changes before committing (locked decision) | SATISFIED — gap closed by Plan 14-11 |
| EX-16 | 14-08 | COA scoring panel — FASDC decision matrix, color-coded cells, staff narrative edit | SATISFIED |
| EX-17 | 14-08 | Commander decision workflow — accept/reject/modify/combine/return, blockchain hash | SATISFIED |
| EX-18 | 14-09 | Order editor — AI generation + manual authoring for WARNORD/OPORD/FRAGO | SATISFIED |
| EX-19 | 14-09 | Planning board — Kanban task tracking, role filter, completion stats | SATISFIED |
| EX-20 | 14-10 | Exercise timeline — phase visualization with current phase highlighting | SATISFIED |
| EX-21 | 14-10 | Gate control — explicit controller-driven phase transitions | SATISFIED |
| EX-22 | 14-10 | Fully wired dashboard — all tabs with info barrier visual indicators | SATISFIED |

**Requirements satisfied:** 22/22
**Requirements blocked:** 0

### Anti-Patterns Found

No anti-patterns detected in re-verification. The Plan 14-11 additions contain no TODO/FIXME comments, no placeholder returns, and no stub patterns. The `previewIPBFromSITREP()` method is substantive (~200 lines with real LLM integration, delta mapping, COA query, and structured return).

### Human Verification Required

#### 1. File Upload and Extraction Pipeline

**Test:** Navigate to /exercise, create a new scenario, drag a folder from the scenario/ directory into the upload zone (or use the folder picker)
**Expected:** Files appear in the pre-upload table with correct Team/Phase/Type inferred from their directory paths; after clicking Upload+Extract, documents appear in the document list with extraction status progressing from pending to extracted
**Why human:** Requires real file system, browser folder picker, and live LLM API call for extraction

#### 2. IPB Map Rendering with milsymbol Icons

**Test:** After uploading documents and assembling IPB for Blue team, navigate to the IPB tab
**Expected:** Map centers on Western Pacific theater (lat=20, lng=125, zoom=4); force disposition units render as MIL-STD-2525D milsymbol icons (or colored circles if no SIDC); IPBLayerControls panel shows grouped layers with toggles
**Why human:** milsymbol SVG rendering via L.divIcon and Leaflet layer group visibility require browser/map evaluation

#### 3. Perspective Toggle Visual Indicators

**Test:** Switch between Blue and Red perspectives on the ExerciseDashboard
**Expected:** Dashboard left border changes color (blue accent vs red accent); background watermark text changes between "BLUE FORCE" and "RED FORCE"; all tab content refreshes to show perspective-appropriate data
**Why human:** CSS watermark and border styling require visual inspection

#### 4. SITREP Delta Preview End-to-End (EX-15 — now unblocked)

**Test:** Select a SITREP document from the "Update from SITREP" dropdown in IPBPanel
**Expected:** Delta preview modal opens showing: SITREP summary excerpt (first 500 chars), color-coded changed fields table (green=added, yellow=modified, red=removed), affected COAs list with impact reason; "Confirm Update" and "Cancel" buttons present; clicking Cancel discards the preview without creating a new IPB version; clicking Confirm Update calls updateIPBFromSITREP and creates a new version
**Why human:** Staff workflow confirmation UI and delta content quality from live LLM call require human evaluation; two-step no-persist guarantee cannot be verified without a real database transaction

#### 5. Commander Decision Blockchain Confirmation

**Test:** Record a commander decision (accept a COA) from CommanderDecisionPanel
**Expected:** SHA-256 hash displays after submission (16 chars + "..."), "Blockchain anchoring pending" indicator shows; decision appears in history timeline
**Why human:** SHA-256 hash display and blockchain outbox status require live backend

#### 6. COA Scoring and Decision Matrix

**Test:** Score a COA using the AI scoring feature, then open the comparison matrix
**Expected:** 5 FASDC criteria show color-coded scores (green/yellow/orange/red gradient), combined score calculates as average, AI-generated narrative is editable with "AI Generated" / "Edited" badge
**Why human:** Visual matrix rendering and LLM-generated score quality require human review

---

_Verified: 2026-03-01T03:20:13Z_
_Verifier: Claude (gsd-verifier)_
_Re-verification: Yes — after Plan 14-11 gap closure_
