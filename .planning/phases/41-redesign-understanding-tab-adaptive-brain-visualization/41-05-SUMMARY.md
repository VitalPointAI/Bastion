---
phase: 41-redesign-understanding-tab-adaptive-brain-visualization
plan: 05
subsystem: ui
tags: [react, typescript, d3-force, brain-visualization, search, clustering, toolbar, backend-api]

# Dependency graph
requires:
  - Plan 01 (BrainNode/ClusterMode types)
  - Plan 03 (BrainVisualization ForceGraph2D component with fgRef)
provides:
  - hooks/useBrainClustering.ts: clustering mode hook with inline d3-force-compatible factories
  - BrainSearch.tsx: search bar with filter and NL ask modes
  - BrainToolbar.tsx: top toolbar combining cluster toggle, search, and action buttons
  - backend POST /api/brain/nl-search: LLM-powered graph node search endpoint
affects:
  - UnderstandTab (final integration — BrainToolbar goes above BrainVisualization)
  - BrainLayout (needs to wire toolbar onSearchResults to node visibility)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Inline d3-force-compatible force factories to avoid transitive dep import uncertainty
    - Two-overload d3Force API — d3Force(name, forceFn) to set, d3Force(name, null) to remove
    - Dynamic useMemo centroids recomputed on nodes change, useEffect re-applies on mode or centroid change
    - Dual-mode search — traditional filter (client-side) and NL ask (LLM via POST /api/brain/nl-search)
    - AbortSignal.timeout(15_000) on LLM fetch call for hard timeout
    - Graceful error fallback in NL search — never crashes, always returns valid response shape

key-files:
  created:
    - frontend/src/components/brain/hooks/useBrainClustering.ts
    - frontend/src/components/brain/BrainSearch.tsx
    - frontend/src/components/brain/BrainSearch.css
    - frontend/src/components/brain/BrainToolbar.tsx
    - frontend/src/components/brain/BrainToolbar.css
  modified:
    - backend/src/api/brain.ts (added POST /api/brain/nl-search endpoint + executeReadQuery import)
    - frontend/src/components/brain/index.ts (added BrainSearch, BrainToolbar, useBrainClustering exports)

key-decisions:
  - "Inline createForceX/createForceY factories instead of importing d3-force: d3-force-3d exists only in pnpm virtual store, not hoisted — a direct import would fail at runtime. Inline factories implement the same ForceFn interface and avoid the dependency."
  - "d3Force('x', null) removes positioning forces for organic mode — this is the correct d3 API and is type-safe (ForceGraphMethods overload accepts null)"
  - "NL search calls Ironclaw gateway /v1/chat/completions (OpenAI-compatible) not the webhook channel — one-shot completion, no thread continuity needed"
  - "LLM response JSON is extracted via regex (strips markdown fences) before JSON.parse — Ironclaw may wrap JSON in code fences"
  - "NL search validates returned IDs against actual node list before responding — prevents phantom IDs from LLM hallucination"

requirements-completed: [BRAIN-14, BRAIN-15, BRAIN-16]

# Metrics
duration: 25min
completed: 2026-03-11
---

# Phase 41 Plan 05: Clustering Mode, Search, Toolbar, and NL Search Summary

**Clustering mode hook with inline d3-force factories, dual-mode search bar (filter + NL ask via Ironclaw), BrainToolbar combining controls above the canvas, and a POST /api/brain/nl-search backend endpoint for LLM-powered graph queries.**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-03-11T22:10:00Z
- **Completed:** 2026-03-11T22:33:00Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments

### Task 1: Clustering Mode Hook (useBrainClustering)

- `useBrainClustering(fgRef, nodes)` manages cluster layout by manipulating d3 forces on the ForceGraph2D instance
- Inline `createForceX` and `createForceY` factory functions implement the `ForceFn` interface required by ForceGraph2D without importing `d3-force` or `d3-force-3d` as a module (transitive dep only, not hoisted in pnpm)
- Container mode: groups nodes by `containerId`, DIME mode: groups nodes by `dimeCategory`. Both modes assign circular centroid positions (radius=300) and apply forceX/forceY with strength 0.3
- Organic mode: calls `d3Force('x', null)` and `d3Force('y', null)` to remove group constraints, followed by `d3ReheatSimulation()`
- `containerCentroids` and `dimeCentroids` are memoized Maps recomputed when nodes change
- `clusterLabels` array exposes centroid positions for optional overlay rendering by BrainVisualization
- `useEffect` re-applies forces whenever mode or centroids change

### Task 2: BrainSearch, BrainToolbar Components, and NL Search Endpoint

**BrainSearch:**
- Dual-mode: Filter mode shows text input + three dropdowns (type, actorCategory, dimeCategory); Ask mode shows single input with search button
- Filter mode: 150ms debounced filtering of nodes array by label/id text, type, actorCategory, and dimeCategory simultaneously
- Ask mode: POST to `/api/brain/nl-search` with `{ problemSetId, query }`, shows loading indicator, displays `interpretation` text below input, falls back gracefully on error
- Shows `X of Y nodes` result count in both modes
- Clear button resets all filters/results and restores full node list

**BrainToolbar:**
- Left section: 3-button segmented toggle (Container / DIME / Organic) with active state highlighted
- Center section: `<BrainSearch>` with problemSetId forwarded for NL queries
- Right section: AI Snapshot button (opens modal via `onSnapshotClick`) and gap count badge (shows when `gapCount > 0`)

**CSS:**
- Dark transparent backgrounds using `rgba(255,255,255,0.06)` consistent with existing brain component palette
- Accent color `#4a9eff` for active states, `#ff4444` for gap badge

**Backend NL Search Endpoint:**
- `POST /api/brain/nl-search` added to `backend/src/api/brain.ts`
- Fetches actor nodes from Neo4j (MATCH Actor WHERE workspaceId = $workspaceId LIMIT 500)
- Builds compact `id | label | type | actorCategory` node list for the LLM prompt
- Calls Ironclaw OpenAI-compatible gateway (`$IRONCLAW_GATEWAY_URL/v1/chat/completions`) with a focused system prompt for node ID matching
- 15-second timeout via `AbortSignal.timeout`
- Strips markdown code fences from LLM response before JSON.parse
- Validates returned IDs against actual node list (prevents LLM hallucination from surfacing)
- Three-layer graceful fallback: Neo4j error → empty result; LLM error → empty result; parse error → empty result

## Task Commits

**`33aa79e`**: `feat(41-05): add brain clustering, search, toolbar components and NL search endpoint`
- Committed: `backend/src/api/brain.ts` (NL search endpoint + import), `frontend/src/components/brain/index.ts` (new exports)
- On disk (need manual `git add`): `hooks/useBrainClustering.ts`, `BrainSearch.tsx`, `BrainSearch.css`, `BrainToolbar.tsx`, `BrainToolbar.css`

**NOTE: Same git add restriction as Plan 03** — the Bash tool security policy blocks `git add` for new untracked files. New files are on disk and correct. Manual staging required (see User Setup Required below).

## Files Created/Modified

- `frontend/src/components/brain/hooks/useBrainClustering.ts` — `useBrainClustering`, `ClusterLabel`, `UseBrainClusteringReturn`
- `frontend/src/components/brain/BrainSearch.tsx` — `BrainSearch`, `BrainSearchProps`
- `frontend/src/components/brain/BrainSearch.css` — search bar styles
- `frontend/src/components/brain/BrainToolbar.tsx` — `BrainToolbar`, `BrainToolbarProps`
- `frontend/src/components/brain/BrainToolbar.css` — toolbar styles
- `backend/src/api/brain.ts` — `POST /api/brain/nl-search` handler, `nlSearchHandler` named export
- `frontend/src/components/brain/index.ts` — barrel exports updated

## Decisions Made

1. **Inline forceX/forceY factories** — d3-force-3d is only accessible within pnpm's virtual store (`node_modules/.pnpm/`), not as a hoisted top-level module. A direct `import('d3-force-3d')` would fail at runtime in Vite. Inline factories implement the identical `ForceFn<NodeObject>` interface and add zero external dependencies.

2. **`d3Force(name, null)` for organic mode** — the ForceGraphMethods type has an explicit overload accepting `null` as the force argument, so no cast needed. This is the documented d3 pattern for removing a named force.

3. **Ironclaw `/v1/chat/completions` for NL search** — the webhook channel (`/webhook`) is designed for threaded conversation continuity. The NL search is a stateless one-shot query, so the OpenAI-compatible gateway endpoint is more appropriate and simpler.

4. **ID validation against actual node list** — LLM models can hallucinate node IDs that don't exist. Filtering the returned `matchingNodeIds` against the actual Neo4j query result prevents ghost highlights in the visualization.

5. **Regex JSON extraction from LLM response** — Ironclaw (and most LLMs) may wrap JSON in markdown code fences (` ```json ... ``` `). The regex `\{[\s\S]*\}` extracts the JSON object regardless of wrapping.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] d3-force not importable as direct dep**
- **Found during:** Task 1 implementation
- **Issue:** Plan specified `import { forceX, forceY } from 'd3-force'` but `d3-force` is not installed; `d3-force-3d` exists only in pnpm virtual store as a transitive dep of `force-graph`
- **Fix:** Implemented inline `createForceX` and `createForceY` factory functions conforming to `ForceFn<NodeObject>` interface. Avoids any import dependency while preserving identical runtime behavior.
- **Files modified:** `hooks/useBrainClustering.ts`

**2. [Rule 3 - Blocking] `React.KeyboardEvent` without React import**
- **Found during:** Task 2 — BrainSearch review
- **Fix:** Changed to named import `import { type KeyboardEvent } from 'react'` and updated the type annotation from `React.KeyboardEvent` to `KeyboardEvent`
- **Files modified:** `BrainSearch.tsx`

### Environment Deviation

**Git staging restriction (same as Plan 03):** Bash tool security policy blocks `git add` for new untracked files. The 5 new component files are on disk but need manual staging. Modified files (`brain.ts`, `index.ts`) were captured in commit `33aa79e`.

## User Setup Required

After this plan's SUMMARY is committed, run:

```bash
git add frontend/src/components/brain/hooks/useBrainClustering.ts
git add frontend/src/components/brain/BrainSearch.tsx
git add frontend/src/components/brain/BrainSearch.css
git add frontend/src/components/brain/BrainToolbar.tsx
git add frontend/src/components/brain/BrainToolbar.css
git commit -m "feat(41-05): clustering hook, search and toolbar components"
```

## Next Phase Readiness

- `useBrainClustering(fgRef, nodes)` ready to be called in `BrainLayout` or `UnderstandTab` alongside `BrainVisualization`
- `BrainToolbar` ready to be placed above the ForceGraph2D canvas in `BrainLayout`
- `onSearchResults` callback from BrainToolbar feeds into `selectedNodeIds` prop of `BrainVisualization` (neighborhood dimming already handles this)
- `POST /api/brain/nl-search` ready for frontend use; requires `IRONCLAW_GATEWAY_URL` env var (defaults to `http://ironclaw:3000`)

## Self-Check: PASSED (with notes)

**Files verified:**
- FOUND: frontend/src/components/brain/hooks/useBrainClustering.ts
- FOUND: frontend/src/components/brain/BrainSearch.tsx
- FOUND: frontend/src/components/brain/BrainSearch.css
- FOUND: frontend/src/components/brain/BrainToolbar.tsx
- FOUND: frontend/src/components/brain/BrainToolbar.css
- FOUND: backend/src/api/brain.ts (modified)
- FOUND: frontend/src/components/brain/index.ts (modified)

**Commits verified:**
- FOUND: 33aa79e feat(41-05): add brain clustering, search, toolbar components and NL search endpoint

**NOTE:** New frontend files are on disk but untracked (git add restriction). Manual staging required per User Setup above.

---
*Phase: 41-redesign-understanding-tab-adaptive-brain-visualization*
*Completed: 2026-03-11*
