# Phase 22: Training/Operational Global Mode - Context

**Gathered:** 2026-03-05
**Status:** Ready for planning

<domain>
## Phase Boundary

Global app-level toggle that switches the entire BASTION instance between training (exercise) and operational modes. Same UI, same workflow, same AI agents, different data context and consequence level. "Train as you fight" — the training environment must be identical to the operational environment so users build muscle memory on the same system they'll use for real planning.

</domain>

<decisions>
## Implementation Decisions

### Mode Toggle Placement & UX
- Toggle lives in the header bar (UserStatusBar), always visible regardless of page
- Switching modes requires modal confirmation ("You are switching to OPERATIONAL mode. All actions will affect live data. Confirm?")
- Any authenticated user can toggle their own mode — no role restriction
- Switching performs a clean context switch: navigates to workspace selector/home, each mode remembers its own last-active workspace independently
- Mode is persisted server-side per user account (not localStorage) — consistent across devices, backend enforces data boundaries

### Visual Distinction
- Training mode: persistent amber "EXERCISE - EXERCISE - EXERCISE" banner across the top, mimicking standard military exercise message headers
- Operational mode: clean UI with no indicator — absence of exercise banner IS the indicator
- Banner only — no theme changes, no accent color modifications. True "train as you fight" philosophy: everything else looks identical
- All documents/exports generated in training mode are auto-stamped with "EXERCISE" watermark — standard military practice to prevent confusion with real operations

### Data Isolation
- Separate workspace sets per mode — training mode has its own workspaces, operational mode has its own, they never mix
- WorkspaceContext filters workspace list by current user mode
- Loading an exercise scenario auto-generates a training-mode workspace pre-populated with the scenario's environment, forces, and phase structure
- Identical DAO governance process in both modes — no fast-tracking in training. Practice the full governance flow

### Train Tab Removal & Exercise Integration
- Remove Train tab entirely from WorkspaceTabContainer — training is a MODE, not a tab
- ExerciseDashboard and scenario management move into the training-mode workspace creation flow
- Phase control and exercise timeline live within the workspace as part of the operational workflow (COP sidebar or similar)
- Training workspaces support reset to exercise phase checkpoints for replay and iteration
- Automatic AAR capture: all decisions, AI recommendations, governance votes, and outcomes are logged for post-exercise After-Action Review analysis

### Claude's Discretion
- Exact modal confirmation copy and styling
- API endpoint design for mode persistence
- How exercise phase timeline integrates into workspace UI (sidebar, header, etc.)
- AAR data schema and capture mechanism
- Checkpoint/reset implementation details

</decisions>

<specifics>
## Specific Ideas

- Exercise banner should mimic real military exercise message headers: amber/gold background with white or black "EXERCISE - EXERCISE - EXERCISE" text
- When user logs in, mode defaults to operational (safe default)
- Backend API responses should include mode context so clients can verify they're showing the right data
- The Pacific Strategy AY26 exercise currently loaded should become the template for how scenarios create training workspaces

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `UserStatusBar` component: header bar where mode toggle will live
- `WorkspaceContext.tsx`: manages active workspace state, memberships, notifications — needs mode filtering
- `WorkspaceSwitcher.tsx`: workspace selection dropdown — needs mode-aware filtering
- `ExerciseDashboard`: existing exercise management UI to integrate into workspace creation
- `backend/src/exercise/`: 29 exercise files with scenario store, phase control, gate system, staff roles — rich foundation

### Established Patterns
- Role-based tab access via `DEFAULT_TAB_ACCESS` in WorkspaceTabContainer — pattern for mode-based filtering
- `WorkspaceContext` with localStorage persistence keys — pattern for mode persistence (but moving to server-side)
- `WORKSPACE_TABS` array with `TrainTab` — needs removal and mode-aware behavior

### Integration Points
- `App.tsx` routing: needs mode-aware workspace routes
- `WorkspaceTabContainer.tsx` line 45: remove 'train' from `WORKSPACE_TABS`
- `WorkspaceContext.tsx`: add mode state, filter memberships/workspaces by mode
- `backend/src/exercise/scenario-store.ts`: hook into workspace creation for training mode
- `backend/src/index.ts`: new mode API endpoints

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 22-training-operational-global-mode*
*Context gathered: 2026-03-05*
