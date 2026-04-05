---
phase: 66-ironclaw-memory-evolution-and-concept-learning
plan: "05"
subsystem: ironclaw
tags: [knowledge-panel, concept-ui, commander-priorities, ironclaw-drawer, react]
dependency_graph:
  requires:
    - Plan 66-01 (concept-router.ts REST API at /api/ironclaw/:problemSetId/concepts)
  provides:
    - IronclawConceptsPanel.tsx — Knowledge dashboard with filter, concept cards, version history, retract
    - IronclawDirectivesPanel.tsx — Commander priorities with add/remove + undo toast
    - IronclawDrawer.tsx — Knowledge tab wired between Memory and Config
  affects:
    - IronclawDrawer.tsx — new 'knowledge' tab, two new imports
tech_stack:
  added: []
  patterns:
    - React useState/useEffect/useCallback pattern matching IronclawMemoryPanel
    - Optimistic UI updates with revert on API error
    - 3-second undo toast pattern for directive deletion
    - Inline accordion for version history (max-h-0 to max-h-96 CSS transition)
key_files:
  created:
    - frontend/src/components/ironclaw/IronclawConceptsPanel.tsx
    - frontend/src/components/ironclaw/IronclawDirectivesPanel.tsx
  modified:
    - frontend/src/components/ironclaw/IronclawDrawer.tsx
decisions:
  - Used concept_type filter client-side to avoid extra API round-trips per UI-SPEC
  - Knowledge tab uses amber-500 accent (distinct from blue-500 used by Chat/Memory/Config)
  - DirectivesPanel fetches all concepts and filters by type='directive' on client side
metrics:
  duration: ~20 minutes
  completed: 2026-04-05
  tasks_completed: 2
  tasks_total: 2
  files_created: 2
  files_modified: 1
---

# Phase 66 Plan 05: Knowledge Panel UI — IronclawConceptsPanel and DirectivesPanel Summary

**One-liner:** Knowledge tab added to IronclawDrawer rendering concept cards with type-color badges, inline version history accordion, retract confirmation, and a Commander Priorities section with 3-second undo delete.

## What Was Built

### Task 1: IronclawConceptsPanel.tsx

Knowledge dashboard panel with:

- **Filter pills bar** — 9 concept types (all, actor, situation, assessment, preference, lesson, intent, relationship, directive) with `role="group"` and `aria-pressed`. Client-side filtering, no extra API calls.
- **TYPE_COLORS map** — all 8 semantic concept type colors per UI-SPEC (blue/indigo/violet/slate/emerald/amber/cyan/orange).
- **Concept cards** — `bg-slate-800/60 border border-slate-700/60 rounded-lg px-3 py-2.5`. Header row: concept_key `text-sm font-semibold text-slate-200`, type badge `text-[9px] uppercase tracking-wider font-semibold`, version `font-mono`, confidence %, relative time.
- **Expand/collapse** — chevron rotates 180deg via `transition-transform duration-200`. Click on entire header row toggles expand. Value preview (120 chars) shown collapsed; full value shown expanded.
- **Version history inline accordion** — `max-h-0 overflow-hidden` to `max-h-96` with `transition-all duration-200`. Timeline entries show version, status badge, relative time, value text. Current version has `border-l-2 border-amber-400`. Superseded entries have `line-through`. Retracted entries have red text. Accordion: only one history open at a time per panel.
- **Retract confirmation** — `bg-red-900/20 border border-red-700/40 rounded-lg px-3 py-2.5` inline banner per UI-SPEC. Optimistic removal, revert on API error.
- **Contradicted badge** — amber badge with "Resolve" link when `status === 'contradicted'`.
- **Consolidated badge** — emerald badge when `source_thread_id === 'consolidation'`.
- **Empty state** — lightbulb SVG, "No concepts learned yet" heading, body text.
- **Error state** — "Failed to load concepts." with underlined [Retry] link.
- All icon buttons carry `aria-label`. History toggle has `aria-expanded`.

### Task 2: IronclawDirectivesPanel.tsx + IronclawDrawer.tsx

**IronclawDirectivesPanel:**
- Section label: "Commander Priorities" (`text-[10px] uppercase tracking-wider`)
- Directive list: `text-xs text-slate-300 leading-snug flex-1` text + trash icon `text-slate-600 hover:text-red-400`
- Add Priority input: full UI-SPEC styling with placeholder "e.g. Prioritize Baltic naval movements over economic data"
- Submit button: `px-3 py-1 text-[10px] font-semibold rounded bg-slate-700 hover:bg-slate-600 text-slate-200`
- Optimistic add with revert on error; shows "Priority could not be saved." error message
- 3-second undo toast: optimistic remove → `setTimeout(3000)` → fire retract API; "Priority removed. [Undo]" snackbar
- Empty state: "No priorities set. Add a priority to guide Ironclaw's focus between monitoring cycles." in `text-xs text-slate-500 italic`

**IronclawDrawer.tsx changes:**
- `drawerTab` type extended: `'chat' | 'activity' | 'memory' | 'knowledge' | 'config'`
- Knowledge tab button inserted between Memory and Config with `border-amber-500 text-amber-300` active state
- Book/open-book SVG icon for Knowledge tab
- Imports added: `IronclawConceptsPanel`, `IronclawDirectivesPanel`
- Knowledge tab content: `IronclawConceptsPanel` above, `IronclawDirectivesPanel` below with `border-t border-slate-700/60 mt-4` separator

## Verification

- `npx tsc --noEmit` passes with zero errors for both tasks.

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None. ConceptsPanel fetches live data from `/api/ironclaw/:problemSetId/concepts` (Plan 66-01 backend). DirectivesPanel fetches same endpoint filtered by concept_type. All data paths are wired.

## Threat Surface Scan

No new network endpoints introduced. Frontend consumes existing Plan 66-01 REST API endpoints (GET concepts, GET history, POST retract, POST create). Scoping by user_did is enforced server-side (T-66-12 mitigated in Plan 66-01). Directive POST uses existing `/:problemSetId/concepts` endpoint with server-side type validation (T-66-13 mitigated in Plan 66-01).

## Self-Check: PASSED

Files exist:
- frontend/src/components/ironclaw/IronclawConceptsPanel.tsx — FOUND
- frontend/src/components/ironclaw/IronclawDirectivesPanel.tsx — FOUND
- frontend/src/components/ironclaw/IronclawDrawer.tsx (modified) — FOUND

Commits:
- ecae50a1 — feat(66-05): create IronclawConceptsPanel with filter, history, retract
- 135b29cb — feat(66-05): add IronclawDirectivesPanel and Knowledge tab to drawer
