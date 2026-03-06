---
phase: 25-operational-design-workspace-inserted
verified: 2026-03-06T09:15:00Z
status: human_needed
score: 8/8 must-haves verified
re_verification:
  previous_status: human_needed
  previous_score: 7/8
  gaps_closed:
    - "AI-assisted design recommendations work for CoG and LOE sections"
  gaps_remaining: []
  regressions: []
human_verification:
  - test: "Navigate to a problem set, click Design tab, verify sidebar with 5 items and status badges"
    expected: "Overview + 4 section items, all showing 'Not Started' status badges initially"
    why_human: "Visual layout and rendering quality cannot be verified programmatically"
  - test: "Fill out Problem Framing form fields and verify auto-save"
    expected: "Saving.../Saved indicators appear, data persists on page refresh"
    why_human: "Requires real browser interaction and page refresh to verify persistence"
  - test: "Open AI panel in Problem Framing, click Analyze, test Adopt/Merge/Dismiss"
    expected: "Framing cards appear with confidence badges, Adopt replaces form, Merge opens modal"
    why_human: "Requires running AI backend agent and visual interaction verification"
  - test: "Open AI panel in CoG Analysis, click Analyze, verify CoG suggestion cards"
    expected: "Completeness score bar renders, validation issues appear with warning/error badges, CoG suggestion cards show type-colored CG/CC/CR/CV badges, side badges (Friendly/Adversary), confidence indicators, and Apply/Dismiss buttons"
    why_human: "Requires running backend and visual verification of card rendering"
  - test: "Click Apply on a CoG suggestion and verify node insertion"
    expected: "New node appears in the correct tree (friendly/adversary) at the correct hierarchy level, tree re-renders with the new node"
    why_human: "SVG tree re-rendering and node insertion need visual confirmation"
  - test: "Open AI panel in LOE Timeline, click Analyze, verify LOE gap cards"
    expected: "CV Coverage score bar renders with appropriate color, gap cards show priority badges (High/Medium/Low), type labels, description, recommendation callout box, confidence indicators, and Dismiss buttons (no Apply button)"
    why_human: "Requires running backend and visual verification of advisory card rendering"
  - test: "Create CoG trees for friendly and adversary, click nodes to edit"
    expected: "SVG trees render correctly with color-coded nodes, editor popover opens on click"
    why_human: "SVG rendering and interactive diagram behavior needs visual confirmation"
  - test: "Create LOEs with decisive points and link to CoG vulnerabilities"
    expected: "Timeline renders with phase columns, diamond markers appear, green indicator on CV link"
    why_human: "Complex SVG timeline rendering needs visual verification"
  - test: "Verify Operational Approach summary cards show live data from prior sections"
    expected: "Problem Statement, CoG Summary, LOE Summary cards display real data"
    why_human: "Cross-section data flow needs end-to-end verification"
  - test: "Click Push to Plan Tab and verify handoff persistence"
    expected: "Success message shown, button changes to 'Pushed' state, data persists in DB"
    why_human: "Database persistence and state transitions need runtime verification"
---

# Phase 25: Operational Design Workspace Verification Report

**Phase Goal:** Build the Design tab with problem framing, center of gravity analysis, lines of effort/operation, operational approach development, and AI-assisted design recommendations.
**Verified:** 2026-03-06T09:15:00Z
**Status:** human_needed
**Re-verification:** Yes -- after gap closure (Plan 25-06)

## Goal Achievement

### Observable Truths

| #   | Truth | Status | Evidence |
| --- | ----- | ------ | -------- |
| 1   | Design tab exists with sidebar navigation | VERIFIED | `DesignTab.tsx` uses `TabLayout` with 5 `SidebarItem` entries (overview, problem-framing, cog-analysis, lines-of-effort, operational-approach). Sidebar items include optional status badges. |
| 2   | Problem framing section with JP 5-0 fields | VERIFIED | `ProblemFramingSection.tsx` (393 lines) has all 8 JP 5-0 field groups: Current State, Desired End State, Problem Statement (auto-generated), Key Tensions, Obstacles, Opportunities, Assumptions, Constraints. DynamicList component enables add/remove. Auto-save with 2s debounce. |
| 3   | Center of gravity analysis with interactive diagrams | VERIFIED | `CoGTree.tsx` (411 lines) renders SVG tree with computed positions, cubic bezier edges, color-coded nodes (CG red, CC amber, CR blue, CV green). `CoGNodeEditor.tsx` provides click-to-edit popover. `CoGAnalysisSection.tsx` has side-by-side friendly/adversary layout with legend and AI panel integration. |
| 4   | Lines of effort/operation timeline visualization | VERIFIED | `LOETimelineSection.tsx` (490 lines) renders SVG timeline with phase columns (default Shape/Deter/Dominate), horizontal LOE lanes, and `DecisivePointNode.tsx` (397 lines) diamond markers with CoG vulnerability linking. Phase management (add/edit/delete) and LOE management (add/edit/delete/reorder) included. |
| 5   | Operational approach synthesis with narrative editor | VERIFIED | `OperationalApproachSection.tsx` (563 lines) has synthesis summary cards (Problem Statement, CoG Summary, LOE Summary), phase transition editor with dropdowns/conditions, decision point editor with criteria, narrative textarea with auto-save, and Design-to-Plan handoff button. |
| 6   | AI-assisted design recommendations | VERIFIED | AI panel (`DesignAIPanel.tsx`, 524 lines) works for all three applicable sections: (1) problem-framing calls `generateFramings` agent, returns framing cards with Adopt/Merge/Dismiss; (2) cog-analysis calls `analyzeCenterOfGravity` agent (375 lines), returns validation issues, completeness score, and CoG suggestion cards with type-colored CG/CC/CR/CV badges, side badges, confidence indicators, and Apply/Dismiss actions; (3) lines-of-effort calls `analyzeLOEGaps` agent (303 lines), returns coverage score and gap suggestion cards with priority badges, type labels, recommendation callouts, and Dismiss actions. No "coming soon" stubs remain. |
| 7   | Design-to-Plan handoff capability | VERIFIED | `designStore.pushHandoff()` packages payload and persists to `handoff_payload` JSONB column with `handoff_pushed_at` timestamp. Frontend calls `designService.pushHandoff()` via POST endpoint. Button shows packaging/pushed states with success message. |
| 8   | Auto-save and data persistence | VERIFIED | All sections implement 2-second debounced auto-save. Backend uses PostgreSQL with JSONB columns per section. `designStore.updateSection()` auto-derives section status from data presence. Auto-create on first GET per problem set. CoG suggestion Apply uses immediate save (no debounce). |

**Score:** 8/8 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `backend/src/agents/cog-analysis.ts` | CoG analysis AI agent with Strange's CG-CC-CR-CV suggestions | VERIFIED (375 lines) | Exports `CoGSuggestion`, `CoGValidationIssue`, `CoGAnalysisOutput` interfaces. Exports `COG_ANALYSIS_AGENT` manifest (AgentPhase.Support, NotAutonomous). Exports `analyzeCenterOfGravity()` with tree structure validation, missing level suggestions, orphaned node detection, completeness scoring. Conservative confidence bounds (0.3-0.7). |
| `backend/src/agents/loe-gap-analysis.ts` | LOE gap analysis AI agent identifying unaddressed vulnerabilities and missing linkages | VERIFIED (303 lines) | Exports `LOEGapSuggestion`, `LOEGapAnalysisOutput` interfaces. Exports `LOE_GAP_ANALYSIS_AGENT` manifest. Exports `analyzeLOEGaps()` with CV coverage analysis, unaddressed vulnerability detection, phase gap identification, missing linkage checks, coverage score calculation. |
| `backend/src/api/design.ts` | Updated analyze endpoint calling real agents | VERIFIED (153 lines) | Line 132-136: cog-analysis dynamically imports and calls `analyzeCenterOfGravity`. Lines 137-142: lines-of-effort dynamically imports and calls `analyzeLOEGaps`. No `{ suggestions: [] }` stubs remain. Imports `CoGAnalysis` and `LineOfEffort` types. |
| `frontend/src/components/design/DesignAIPanel.tsx` | Section-specific result rendering for CoG and LOE | VERIFIED (524 lines) | `renderCogAnalysisResults()` renders ScoreBar, ValidationIssueCards, CogSuggestionCards with type badges, side badges, Apply/Dismiss. `renderLoeGapResults()` renders ScoreBar, LoeGapCards with priority badges, type labels, recommendation callout, Dismiss. Props include `onApplyCogSuggestion`. |
| `frontend/src/components/design/CoGAnalysisSection.tsx` | AI panel integration with Apply handler | VERIFIED (225 lines) | Imports and renders `DesignAIPanel` with `activeSection="cog-analysis"`. Has `aiPanelOpen` state. `handleApplyCogSuggestion` creates new CoGNode from suggestion, uses `addNodeToTree` helper for correct hierarchy insertion, triggers immediate save via `onUpdate`. |
| `backend/src/design/types.ts` | TypeScript interfaces for operational design | VERIFIED (regression) | Types intact for CoGNode, CoGTree, CoGAnalysis, LineOfEffort, DecisivePoint, LOECoGLink. |
| `backend/src/design/design-store.ts` | PostgreSQL CRUD with auto-create and status derivation | VERIFIED (regression) | Store intact with full CRUD. |
| `frontend/src/lib/design-service.ts` | API client | VERIFIED (regression) | Service intact with analyzeSection method. |
| `frontend/src/components/tabs/DesignTab.tsx` | Design tab with TabLayout | VERIFIED (regression) | Tab intact with 5 sections. |
| `frontend/src/components/design/DesignOverview.tsx` | Dashboard with progress | VERIFIED (regression) | Overview intact. |
| `frontend/src/components/design/ProblemFramingSection.tsx` | JP 5-0 form | VERIFIED (regression) | Form intact with AI panel. |
| `frontend/src/components/design/AIFramingCard.tsx` | AI framing card | VERIFIED (regression) | Card intact. |
| `frontend/src/components/design/CoGTree.tsx` | SVG tree diagram | VERIFIED (regression) | Tree intact. |
| `frontend/src/components/design/CoGNodeEditor.tsx` | Node editor popover | VERIFIED (regression) | Editor intact. |
| `frontend/src/components/design/LOETimelineSection.tsx` | LOE timeline container | VERIFIED (regression) | Timeline intact with AI panel. |
| `frontend/src/components/design/LOELane.tsx` | LOE lane component | VERIFIED (regression) | Lane intact. |
| `frontend/src/components/design/DecisivePointNode.tsx` | Decisive point marker | VERIFIED (regression) | Node intact. |
| `frontend/src/components/design/DesignStatusBadge.tsx` | Status badge | VERIFIED (regression) | Badge intact. |
| `frontend/src/components/design/OperationalApproachSection.tsx` | Synthesis section | VERIFIED (regression) | Section intact. |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | -- | --- | ------ | ------- |
| backend/src/api/design.ts | backend/src/agents/cog-analysis.ts | Dynamic import `../agents/cog-analysis.js` | WIRED | Line 133: `const { analyzeCenterOfGravity } = await import(...)`, called with CoGAnalysis data, result sent via `res.json(output)` |
| backend/src/api/design.ts | backend/src/agents/loe-gap-analysis.ts | Dynamic import `../agents/loe-gap-analysis.js` | WIRED | Line 138: `const { analyzeLOEGaps } = await import(...)`, called with LOE and CoG data, result sent via `res.json(output)` |
| DesignAIPanel.tsx | CoG suggestion cards | Conditional rendering `activeSection === 'cog-analysis'` | WIRED | Line 507: renders `renderCogAnalysisResults()` which maps suggestions to `CogSuggestionCard` components |
| DesignAIPanel.tsx | LOE gap cards | Conditional rendering `activeSection === 'lines-of-effort'` | WIRED | Line 510: renders `renderLoeGapResults()` which maps suggestions to `LoeGapCard` components |
| CoGAnalysisSection.tsx | DesignAIPanel.tsx | Child component with props | WIRED | Line 214-221: Renders `<DesignAIPanel>` with `activeSection="cog-analysis"`, `sectionData={cogAnalysis}`, and `onApplyCogSuggestion={handleApplyCogSuggestion}` |
| CogSuggestionCard Apply | CoGAnalysisSection handleApplyCogSuggestion | onApplyCogSuggestion callback chain | WIRED | DesignAIPanel line 386 calls `onApplyCogSuggestion(suggestion)`, CoGAnalysisSection line 114-138 creates CoGNode, inserts into tree via `addNodeToTree`, calls `onUpdate` for immediate save |
| DesignTab.tsx | design-service.ts | `designService.getDesign`, `designService.updateSection` | WIRED (regression) | Intact |
| DesignTab.tsx | All 5 section components | Conditional rendering with props | WIRED (regression) | Intact |
| backend/index.ts | api/design.ts | `app.use('/api/design', designRouter)` | WIRED (regression) | Intact |
| api/design.ts | design-store.ts | `designStore.*` calls | WIRED (regression) | Intact |
| design-store.ts | PostgreSQL | `pool.query` | WIRED (regression) | Intact |
| ProblemFramingSection | DesignAIPanel | Child component | WIRED (regression) | Intact |
| DesignAIPanel | design-service.ts | `designService.analyzeSection` | WIRED (regression) | Intact |
| LOETimelineSection | DesignAIPanel | Child component | WIRED (regression) | Intact |
| OperationalApproachSection | design-service.ts | `designService.pushHandoff` | WIRED (regression) | Intact |

### Requirements Coverage

No explicit requirement IDs were defined in ROADMAP.md for this phase. Coverage assessed against the phase goal statement. All five goal components are fully implemented: problem framing, center of gravity analysis, lines of effort/operation, operational approach development, and AI-assisted design recommendations.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| (none) | - | - | - | Previous anti-patterns (empty stubs, "coming soon" text) have been resolved |

### Human Verification Required

### 1. Design Tab Layout and Navigation

**Test:** Navigate to a problem set, click the Design tab
**Expected:** Sidebar shows 5 items (Overview, Problem Framing, CoG Analysis, Lines of Effort, Operational Approach) with status badges showing "Not Started"
**Why human:** Visual layout quality and rendering require browser

### 2. Problem Framing with Auto-Save

**Test:** Fill out Current State and Desired End State, add tensions/obstacles/assumptions
**Expected:** Problem Statement auto-generates, "Saving..." / "Saved" indicators appear, data persists on page refresh
**Why human:** Auto-save timing and persistence require real browser interaction

### 3. AI Panel in Problem Framing

**Test:** Open AI panel, click Analyze, test Adopt/Merge/Dismiss on framing cards
**Expected:** Cards with confidence badges appear, Adopt replaces form, Merge opens checkbox modal
**Why human:** Requires running AI backend agent and visual verification

### 4. AI Panel in CoG Analysis

**Test:** Open AI panel in CoG Analysis section, click Analyze
**Expected:** Completeness score bar renders with appropriate color, validation issues appear as warning/error cards with colored left borders, CoG suggestion cards show type-colored badges (CG red, CC amber, CR blue, CV green), side badges (Friendly blue, Adversary red), confidence indicators, and Apply/Dismiss buttons
**Why human:** Requires running backend agent and visual verification of card rendering

### 5. CoG Suggestion Apply

**Test:** Click Apply on a CoG suggestion card
**Expected:** New node appears in the correct tree (friendly or adversary) at the correct hierarchy level (CG/CC/CR/CV), tree SVG re-renders immediately
**Why human:** SVG tree re-rendering and node insertion need visual confirmation

### 6. AI Panel in LOE Timeline

**Test:** Open AI panel in LOE Timeline section, click Analyze
**Expected:** CV Coverage score bar with appropriate color (green > 70%, yellow 40-70%, red < 40%), gap cards with priority badges (High red, Medium amber, Low blue), type labels, description, recommendation callout box, confidence indicators, Dismiss buttons only (no Apply)
**Why human:** Requires running backend agent and visual verification of advisory cards

### 7. CoG Analysis Interactive Trees

**Test:** Create root CG nodes for friendly/adversary, add CC/CR/CV children, click to edit
**Expected:** SVG trees render with correct colors, editor popover opens, nodes can be renamed/deleted
**Why human:** SVG rendering and interactive behavior need visual confirmation

### 8. LOE Timeline

**Test:** Add LOEs, add decisive points in different phases, link to CoG vulnerabilities
**Expected:** Timeline SVG renders with phase columns, diamond markers, green indicator appears on CV link
**Why human:** Complex SVG timeline visualization needs visual inspection

### 9. Operational Approach Synthesis

**Test:** Navigate to Operational Approach, verify summary cards show data from prior sections
**Expected:** Problem Statement, CoG Summary, LOE Summary cards display real cross-section data
**Why human:** Cross-section data flow needs end-to-end verification

### 10. Design-to-Plan Handoff

**Test:** Click "Push to Plan Tab" button
**Expected:** Button shows "Packaging..." then "Pushed to Plan Tab" with success message and timestamp
**Why human:** Database persistence and UI state transitions need runtime verification

### Gaps Summary

All gaps from the initial verification have been closed. Plan 25-06 successfully implemented:

1. **CoG analysis agent** (`backend/src/agents/cog-analysis.ts`, 375 lines) -- rule-based v1 that validates tree structure per Strange's CG-CC-CR-CV framework, suggests missing levels, detects orphaned nodes, checks for empty descriptions, and calculates completeness score. Uses conservative confidence bounds (0.3-0.7) per INVARIANT 5.

2. **LOE gap analysis agent** (`backend/src/agents/loe-gap-analysis.ts`, 303 lines) -- rule-based v1 that collects all CVs from CoG trees, identifies unaddressed vulnerabilities, detects LOEs with no decisive points, finds phase coverage gaps, checks for missing CoG linkages, and calculates CV coverage score.

3. **Backend endpoint updated** (`backend/src/api/design.ts`) -- removed `{ suggestions: [] }` stubs for cog-analysis and lines-of-effort sections, replaced with dynamic imports calling real agent functions.

4. **Frontend AI panel updated** (`frontend/src/components/design/DesignAIPanel.tsx`, 524 lines) -- added section-specific rendering with ScoreBar, ValidationIssueCard, CogSuggestionCard (with Apply/Dismiss), and LoeGapCard (advisory with Dismiss only). No "AI analysis coming soon" text remains.

5. **CoG section AI panel integration** (`frontend/src/components/design/CoGAnalysisSection.tsx`, 225 lines) -- added DesignAIPanel as child with Apply handler that creates new CoGNode from suggestion data, inserts at correct tree hierarchy position via `addNodeToTree` helper, and triggers immediate save.

The phase is now fully complete with all 8 observable truths verified. All remaining items require human verification (visual rendering, interactive behavior, runtime data flow).

---

_Verified: 2026-03-06T09:15:00Z_
_Verifier: Claude (gsd-verifier)_
