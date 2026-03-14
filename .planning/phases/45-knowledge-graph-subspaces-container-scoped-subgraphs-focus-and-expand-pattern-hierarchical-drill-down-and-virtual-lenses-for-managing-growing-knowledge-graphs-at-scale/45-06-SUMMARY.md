---
phase: 45-knowledge-graph-subspaces
plan: 06
subsystem: ui
tags: [brain, n-hop, focus-and-expand, abortcontroller, react, hooks, progressive-loading]
dependency_graph:
  requires:
    - phase: 45-01
      provides: BrainNode, BrainEdge, BrainGraphData types
    - phase: 45-02
      provides: GET /api/brain/nhop endpoint
  provides:
    - useBrainNHop hook — progressive N-hop expansion with AbortController race protection
  affects: [Phase 45 Plans 07+ (controller integrates useBrainNHop for expand UI)]
tech_stack:
  added: []
  patterns: [AbortController for request cancellation, hop-count tag for stale-response guard, useCallback with expandedHops dep for stable expand reference]
key_files:
  created:
    - frontend/src/components/brain/hooks/useBrainNHop.ts
  modified: []
key_decisions:
  - "showWarning threshold set at 3 hops matching plan spec (WARNING_THRESHOLD = 3)"
  - "On fetch error, expandedHops rolls back to committedHopsRef.current so the caller can retry without hop count drift"
  - "setFocusNode does not auto-trigger a fetch — caller must call expand() after changing focus node"
  - "mapRawNode defaults type to entity and confidence to 0.3 (same conservative default as useBrainData for unknown nodes)"
patterns-established:
  - "AbortController ref pattern: abort previous request on each new expand() call via abortRef.current?.abort()"
  - "Stale-response guard via committedHopsRef: only apply response if requestedHops >= committedHopsRef.current"
requirements-completed: [NHOP-HOOK, NHOP-EXPAND, NHOP-WARNING]
duration: 1min
completed: "2026-03-14"
---

# Phase 45 Plan 06: N-Hop Progressive Expansion Hook Summary

**useBrainNHop React hook with AbortController cancellation and hop-count stale-response guard for concentric ring focus-and-expand loading from /api/brain/nhop**

## Performance

- **Duration:** ~1 min
- **Started:** 2026-03-14T10:38:28Z
- **Completed:** 2026-03-14T10:39:22Z
- **Tasks:** 1
- **Files modified:** 1 (created)

## Accomplishments
- useBrainNHop hook exposes expandedHops, expandedData, loading, showWarning, expand, reset, setFocusNode
- AbortController aborts any in-flight request when expand() is called again (prevents response pile-up)
- Hop-count tag (requestedHops vs committedHopsRef.current) prevents stale earlier responses from overwriting newer state
- showWarning = expandedHops >= 3 surfaces performance warning to controller without coupling logic to UI
- Error path rolls expandedHops back to last committed depth so caller can safely retry via expand()

## Task Commits

Each task was committed atomically:

1. **Task 1: Create useBrainNHop hook for progressive neighbor loading** - `123fd67` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified
- `frontend/src/components/brain/hooks/useBrainNHop.ts` - Progressive N-hop hook with AbortController and race condition protection

## Decisions Made
- `showWarning` is exposed as a boolean at the hook boundary — the controller decides when and how to render the warning (modal, inline prompt, etc.). This keeps the hook pure data.
- On error, rolling back `expandedHops` to `committedHopsRef.current` prevents silent hop-count drift where the UI would show "3 hops" but the displayed data is actually only 2 hops deep.
- `setFocusNode` does not fire a fetch automatically; it only resets state. This gives the controller full control over when expansion begins after a focus change.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## Next Phase Readiness
- useBrainNHop is ready for integration into the BrainController / FocusExpandController (Plan 07+)
- Hook signature matches spec exactly: expand(focusNodeId), reset(), setFocusNode(nodeId | null)
- TypeScript compiles cleanly with no errors

---
*Phase: 45-knowledge-graph-subspaces*
*Completed: 2026-03-14*
