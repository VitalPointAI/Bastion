---
phase: 25-operational-design-workspace-inserted
verified: 2026-03-06T08:00:00Z
status: human_needed
score: 7/8 must-haves verified
gaps:
  - truth: "AI-assisted design recommendations work for CoG and LOE sections"
    status: partial
    reason: "AI analyze endpoint returns empty array for cog-analysis and lines-of-effort sections (stub). Only problem-framing has real AI integration."
    artifacts:
      - path: "backend/src/api/design.ts"
        issue: "Lines 131-133: cog-analysis and lines-of-effort sections return { suggestions: [] } stub"
      - path: "frontend/src/components/design/DesignAIPanel.tsx"
        issue: "Line 166: Shows 'AI analysis coming soon' for non-problem-framing sections"
    missing:
      - "AI analysis handlers for cog-analysis section"
      - "AI analysis handlers for lines-of-effort section"
human_verification:
  - test: "Navigate to a problem set, click Design tab, verify sidebar with 5 items and status badges"
    expected: "Overview + 4 section items, all showing 'Not Started' status badges initially"
    why_human: "Visual layout and rendering quality cannot be verified programmatically"
  - test: "Fill out Problem Framing form fields and verify auto-save"
    expected: "Saving.../Saved indicators appear, data persists on page refresh"
    why_human: "Requires real browser interaction and page refresh to verify persistence"
  - test: "Open AI panel in Problem Framing, click Analyze, test Adopt/Merge/Dismiss"
    expected: "Framing cards appear with confidence badges, Adopt replaces form, Merge opens modal"
    why_human: "Requires running AI backend and visual interaction verification"
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
**Verified:** 2026-03-06T08:00:00Z
**Status:** human_needed
**Re-verification:** No -- initial verification

## Goal Achievement

### Observable Truths

| #   | Truth | Status | Evidence |
| --- | ----- | ------ | -------- |
| 1   | Design tab exists with sidebar navigation | VERIFIED | `DesignTab.tsx` uses `TabLayout` with 5 `SidebarItem` entries (overview, problem-framing, cog-analysis, lines-of-effort, operational-approach). Sidebar items include optional status badges. |
| 2   | Problem framing section with JP 5-0 fields | VERIFIED | `ProblemFramingSection.tsx` (393 lines) has all 8 JP 5-0 field groups: Current State, Desired End State, Problem Statement (auto-generated), Key Tensions, Obstacles, Opportunities, Assumptions, Constraints. DynamicList component enables add/remove. Auto-save with 2s debounce. |
| 3   | Center of gravity analysis with interactive diagrams | VERIFIED | `CoGTree.tsx` (411 lines) renders SVG tree with computed positions, cubic bezier edges, color-coded nodes (CG red, CC amber, CR blue, CV green). `CoGNodeEditor.tsx` provides click-to-edit popover. `CoGAnalysisSection.tsx` has side-by-side friendly/adversary layout with legend. |
| 4   | Lines of effort/operation timeline visualization | VERIFIED | `LOETimelineSection.tsx` (490 lines) renders SVG timeline with phase columns (default Shape/Deter/Dominate), horizontal LOE lanes, and `DecisivePointNode.tsx` (397 lines) diamond markers with CoG vulnerability linking. Phase management (add/edit/delete) and LOE management (add/edit/delete/reorder) included. |
| 5   | Operational approach synthesis with narrative editor | VERIFIED | `OperationalApproachSection.tsx` (563 lines) has synthesis summary cards (Problem Statement, CoG Summary, LOE Summary), phase transition editor with dropdowns/conditions, decision point editor with criteria, narrative textarea with auto-save, and Design-to-Plan handoff button. |
| 6   | AI-assisted design recommendations | PARTIAL | AI panel (`DesignAIPanel.tsx`, 172 lines) works for problem-framing section -- calls backend analyze endpoint which invokes `generateFramings` agent, returns framing cards with confidence badges and Adopt/Merge/Dismiss actions. However, cog-analysis and lines-of-effort sections return empty stubs (`{ suggestions: [] }`) from backend. |
| 7   | Design-to-Plan handoff capability | VERIFIED | `designStore.pushHandoff()` packages payload and persists to `handoff_payload` JSONB column with `handoff_pushed_at` timestamp. Frontend calls `designService.pushHandoff()` via POST endpoint. Button shows packaging/pushed states with success message. |
| 8   | Auto-save and data persistence | VERIFIED | All sections implement 2-second debounced auto-save. Backend uses PostgreSQL with JSONB columns per section. `designStore.updateSection()` auto-derives section status from data presence. Auto-create on first GET per problem set. |

**Score:** 7/8 truths verified (1 partial)

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `backend/src/design/types.ts` | TypeScript interfaces for operational design | VERIFIED (112 lines) | Complete type system: SectionStatus, DesignStatus, ProblemFramingData, CoGNode/Tree/Analysis, LOE types, OperationalApproach, DesignHandoffPayload, OperationalDesign |
| `backend/src/design/design-store.ts` | PostgreSQL CRUD with auto-create and status derivation | VERIFIED (333 lines) | Full store: initDesignTable, defaults, status derivation per section, getByProblemSetId (auto-create), updateSection, getStatus, getHandoffPayload, pushHandoff |
| `backend/src/api/design.ts` | Express API routes | VERIFIED (144 lines) | GET /:id, GET /:id/status, PATCH /:id/:section, GET /:id/handoff, POST /:id/push-handoff, POST /:id/analyze |
| `frontend/src/lib/design-service.ts` | API client | VERIFIED (171 lines) | getDesign, getStatus, updateSection, analyzeSection, getHandoff, pushHandoff |
| `frontend/src/components/tabs/DesignTab.tsx` | Design tab with TabLayout | VERIFIED (151 lines) | Loads design data, builds sidebar items with status, renders all 5 sections conditionally |
| `frontend/src/components/design/DesignOverview.tsx` | Dashboard with progress | VERIFIED (281 lines) | Progress bar with colored segments, section cards with live summaries, navigation buttons |
| `frontend/src/components/design/ProblemFramingSection.tsx` | JP 5-0 form | VERIFIED (393 lines) | All fields, auto-save, AI panel integration, merge modal |
| `frontend/src/components/design/DesignAIPanel.tsx` | Collapsible AI panel | VERIFIED (172 lines) | Section-aware caching, explicit trigger, framing card rendering |
| `frontend/src/components/design/AIFramingCard.tsx` | AI framing card | VERIFIED (163 lines) | Confidence badges, collapsible details, Adopt/Merge/Dismiss actions |
| `frontend/src/components/design/CoGTree.tsx` | SVG tree diagram | VERIFIED (411 lines) | Layout computation, node rendering, edge paths, add/edit/delete interactions |
| `frontend/src/components/design/CoGNodeEditor.tsx` | Node editor popover | VERIFIED (145 lines) | Label/description editing, type badge, delete confirmation |
| `frontend/src/components/design/CoGAnalysisSection.tsx` | Side-by-side CoG container | VERIFIED (137 lines) | Friendly/adversary trees, auto-save debounce, legend |
| `frontend/src/components/design/LOETimelineSection.tsx` | LOE timeline container | VERIFIED (490 lines) | Phase management, SVG timeline, LOE lanes, AI panel |
| `frontend/src/components/design/LOELane.tsx` | LOE lane component | VERIFIED (264 lines) | Inline editing, decisive point positioning, delete/edit controls |
| `frontend/src/components/design/DecisivePointNode.tsx` | Decisive point marker | VERIFIED (397 lines) | Diamond shape, CoG link indicator, edit/link popovers |
| `frontend/src/components/design/DesignStatusBadge.tsx` | Status badge | VERIFIED (33 lines) | Colored dot + text for not-started/in-progress/complete |
| `frontend/src/components/design/OperationalApproachSection.tsx` | Synthesis section | VERIFIED (563 lines) | Summary cards, transitions, decision points, narrative, handoff |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | -- | --- | ------ | ------- |
| DesignTab.tsx | design-service.ts | `designService.getDesign`, `designService.updateSection` | WIRED | Lines 55, 72 -- fetches design on mount, updates sections on change |
| DesignTab.tsx | All 5 section components | Conditional rendering with props | WIRED | Lines 109-148 -- each section receives problemSetId, initialData, onUpdate |
| backend/index.ts | api/design.ts | `app.use('/api/design', designRouter)` | WIRED | Line 179 |
| api/design.ts | design-store.ts | `designStore.*` calls | WIRED | GET/PATCH/status/handoff/push-handoff/analyze all call store methods |
| design-store.ts | PostgreSQL | `pool.query` with operational_designs table | WIRED | Full CRUD with parameterized queries |
| ProblemFramingSection | DesignAIPanel | Renders as child, passes sectionData/callbacks | WIRED | Lines 372-380 |
| DesignAIPanel | design-service.ts | `designService.analyzeSection` | WIRED | Line 47 |
| LOETimelineSection | DesignAIPanel | Renders as child | WIRED | Lines 480-486 |
| OperationalApproachSection | design-service.ts | `designService.pushHandoff` | WIRED | Line 256 |
| DesignOverview | DesignStatusBadge | Renders per section card | WIRED | Line 254 |
| TabLayout | DesignStatusBadge | Renders when `item.status` defined | WIRED | Line 44 of TabLayout.tsx |

### Requirements Coverage

No explicit requirement IDs were defined in ROADMAP.md for this phase. Coverage assessed against the phase goal statement.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| backend/src/api/design.ts | 131-133 | AI analyze stub for cog-analysis and lines-of-effort (`{ suggestions: [] }`) | Warning | AI recommendations only work for problem-framing; other sections show "coming soon" |
| frontend/src/components/design/DesignAIPanel.tsx | 166 | "AI analysis coming soon" message for non-problem-framing sections | Warning | Users will see placeholder text for CoG/LOE AI analysis |

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

### 4. CoG Analysis Interactive Trees

**Test:** Create root CG nodes for friendly/adversary, add CC/CR/CV children, click to edit
**Expected:** SVG trees render with correct colors, editor popover opens, nodes can be renamed/deleted
**Why human:** SVG rendering and interactive behavior need visual confirmation

### 5. LOE Timeline

**Test:** Add LOEs, add decisive points in different phases, link to CoG vulnerabilities
**Expected:** Timeline SVG renders with phase columns, diamond markers, green indicator appears on CV link
**Why human:** Complex SVG timeline visualization needs visual inspection

### 6. Operational Approach Synthesis

**Test:** Navigate to Operational Approach, verify summary cards show data from prior sections
**Expected:** Problem Statement, CoG Summary, LOE Summary cards display real cross-section data
**Why human:** Cross-section data flow needs end-to-end verification

### 7. Design-to-Plan Handoff

**Test:** Click "Push to Plan Tab" button
**Expected:** Button shows "Packaging..." then "Pushed to Plan Tab" with success message and timestamp
**Why human:** Database persistence and UI state transitions need runtime verification

### Gaps Summary

The phase is substantially complete with all 16 key artifacts implemented as substantive, non-stub components, fully wired together from frontend through API to database.

One partial gap exists: **AI-assisted design recommendations** work fully for the Problem Framing section (calls the existing `generateFramings` agent, returns framing cards with confidence badges and Adopt/Merge/Dismiss actions). However, the CoG Analysis and Lines of Effort sections have stub AI handlers on the backend that return empty arrays, and the frontend shows "AI analysis coming soon" for these sections. This is a minor gap since the AI panel infrastructure is complete and functional -- only the section-specific agent implementations are missing for two of the four sections.

The Operational Approach section intentionally does not have an AI panel (it is a synthesis/handoff section), so that is not a gap.

All other truths are fully verified: the Design tab with sidebar navigation, all four content sections with meaningful interactive UIs, auto-save with debounce across all sections, status derivation, progress tracking, and the Design-to-Plan handoff with database persistence.

---

_Verified: 2026-03-06T08:00:00Z_
_Verifier: Claude (gsd-verifier)_
