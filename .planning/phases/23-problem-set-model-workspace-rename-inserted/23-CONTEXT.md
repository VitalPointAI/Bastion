# Phase 23: Problem Set Model & Workspace Rename - Context

**Gathered:** 2026-03-05
**Status:** Ready for planning

<domain>
## Phase Boundary

Rename "workspace" to "problem set" throughout the entire application (UI, routes, API, types, DB columns, IDs) to align with JP 5-0 doctrinal terminology. Add echelon classification (strategic/operational/tactical) as a required field replacing the old WorkspaceType hierarchy. Update the problem set selector landing page with echelon indicators and redesigned detail card.

</domain>

<decisions>
## Implementation Decisions

### Terminology mapping
- **Full rename everywhere** — workspace -> problem set in all code, types, DB columns, API endpoints, routes, and UI labels. No dual terminology.
- **Drop WorkspaceType hierarchy** — Organization/Unit/Team is removed. Echelon (strategic/operational/tactical) replaces it entirely as the classification.
- **DAO ID format** — New problem sets use `ps-{uuid}` prefix. Existing DAOs keep old IDs (no on-chain rename possible).
- **ID prefixes** — `WS-{uuid}` -> `PS-{uuid}` for problem sets, `WM-{uuid}` -> `PM-{uuid}` for problem set members. Other prefixes (WI-, WA-, etc.) follow the same pattern.

### Echelon model
- **Required field** — Echelon (strategic/operational/tactical) is required when creating a problem set. No default.
- **Strict hierarchy** — Strategic can only contain operational, operational can only contain tactical. No skipping levels, no same-level nesting.
- **Tag only for now** — Echelon is stored and displayed but doesn't change available tools, tabs, or behavior. Phases 24-26 will activate echelon-based behavior.
- **Echelon-specific role templates** — Role templates differ by echelon level (replaces the Organization/Unit/Team role templates). Claude designs appropriate doctrinal roles per echelon based on JP 5-0 staff structures.

### Selector & landing UX
- **Military echelon icons** — Use doctrinal military unit symbols (XX, III, etc.) as echelon indicators on tree nodes, not color badges.
- **Keep parent-child tree** — OrgTree retains its hierarchical tree structure. Echelon icons appear on each node but hierarchy is the organizing principle.
- **Redesigned detail card** — Detail card redesigned to emphasize the problem set concept: show problem statement, echelon, child count, active staff. "Enter Workspace" becomes "Enter Problem Set".
- **Page title** — Claude's discretion on landing page title.

### Migration & routing
- **Redirect old routes** — `/workspace/*` redirects to `/problem-set/*` for backward compatibility with bookmarks.
- **Full API rename** — `/api/workspaces` -> `/api/problem-sets`. Frontend is the only client, no external compat needed.
- **Full DB column rename** — Tables and columns renamed via migration (e.g., `workspace_id` -> `problem_set_id`). Clean slate.
- **localStorage migration** — Rename keys (`workspace-*` -> `problem-set-*`) with one-time migration code to copy old keys on first load.

### Claude's Discretion
- Landing page title (e.g., "Select Problem Set" vs "Problem Set Overview")
- Echelon-specific role template design per JP 5-0 doctrinal staff structures
- DB migration ordering and strategy
- Component/file renaming approach (batch vs incremental)

</decisions>

<specifics>
## Specific Ideas

- Echelon indicators should use military unit size symbols (XX for division-level, III for regiment, etc.) — authentic doctrinal feel, not generic badges
- Detail card should show the "problem statement" — what operational problem this set addresses — reinforcing JP 5-0 concept
- The rename is a clean break: no code-level aliases, no old terminology persisting anywhere

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `OrgTree` component (frontend/src/components/workspace/OrgTree.tsx): Hierarchical tree display, needs icon additions for echelon
- `WorkspaceSelector` (frontend/src/components/workspace/WorkspaceSelector.tsx): Two-column layout with detail card, base for redesign
- `CreateWorkspaceWizard` (frontend/src/components/workspace/CreateWorkspaceWizard.tsx): Creation flow, needs echelon step
- `classificationColor()` and badge helpers: Pattern for visual indicators, can model echelon icons similarly

### Established Patterns
- Context provider pattern: `WorkspaceContext.tsx` manages state, polling, localStorage — must be fully renamed
- Type definitions centralized: `backend/src/workspace/types.ts` defines all workspace types, role templates
- Store pattern: `workspace-store.ts`, `workspace-member-store.ts`, etc. — each needs rename
- Mode-specific localStorage keys: `workspace-active-id-{mode}` pattern

### Integration Points
- 57 frontend files reference "workspace" — comprehensive rename needed
- 73 backend files reference "workspace" — includes stores, API routes, types, COP agents
- Routes in `App.tsx`: `/workspace/*` route definition
- `MILITARY_ROLE_TEMPLATES` in types.ts: Keyed by WorkspaceType (Organization/Unit/Team) — must be rekeyed by echelon
- Cross-workspace features (subscriptions, escalation, activity) all reference workspace terminology

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 23-problem-set-model-workspace-rename-inserted*
*Context gathered: 2026-03-05*
