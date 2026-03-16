---
phase: 48-robot-swarm-behaviour-end-to-end-demo
plan: "08"
subsystem: cop-visualization-and-swarm-wiring
tags:
  - corroboration
  - confidence-visual-encoding
  - swarm-brain-graph
  - cop-map
  - end-to-end

dependency_graph:
  requires:
    - 48-05
    - 48-06
    - 48-07
  provides:
    - corroboration-visual-encoding
    - confidence-badge-overlay
    - swarm-formed-brain-graph-event
    - formation-changed-brain-graph-event
    - source-count-corroboration-badge
  affects:
    - backend/src/robot/robot-mission-service.ts
    - frontend/src/components/cop/SwarmCOPLayer.tsx
    - frontend/src/components/cop/COPMapView.tsx

tech_stack:
  added: []
  patterns:
    - L.divIcon wrapping SVG with positioned badge overlay for confidence pills
    - Ghost ring via absolute-positioned dotted border div overlay
    - Per-entity source count aggregation in attribution layer
    - writeSwarmEventToGraph with non-blocking catch for swarm lifecycle events

key_files:
  created: []
  modified:
    - backend/src/robot/robot-mission-service.ts
    - frontend/src/components/cop/SwarmCOPLayer.tsx
    - frontend/src/components/cop/COPMapView.tsx

decisions:
  - "createMilSymbolIconWithBadge wraps existing divIcon HTML rather than re-creating symbol — preserves milsymbol fidelity while adding badge overlay"
  - "swarm_formed and formation_changed use 'did:near:bastion.testnet' and 'default' workspaceId since SwarmTelemetryMsg carries no workspace context"
  - "Source count badges only shown when showAttribution is ON — avoids cluttering base COP view"

metrics:
  duration_minutes: 12
  completed_date: "2026-03-16"
  tasks_completed: 1
  tasks_total: 2
  files_modified: 3
---

# Phase 48 Plan 08: End-to-End Wiring + Corroboration Visual Encoding Summary

Map-level confidence badge pills (ghosted/amber/green) on hostile COP symbols, "2x"/"3x" corroboration source count badges on multi-robot detections, and swarm_formed/formation_changed brain graph event writes in robot-mission-service.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Corroboration visual encoding + end-to-end wiring | a2e81f7a | robot-mission-service.ts, COPMapView.tsx, SwarmCOPLayer.tsx |

## What Was Built

### COPMapView.tsx — createMilSymbolIconWithBadge

New local function wrapping the existing `createMilSymbolIcon` to add map-level confidence visual encoding:

- **Ghosted (low tier, <0.5 confidence)**: 40% opacity + red dotted border ring (absolute-positioned div overlay on the divIcon HTML)
- **Amber (medium tier, 0.5–0.85)**: 70% opacity + amber `%` confidence pill badge above the symbol
- **Solid (high tier, >0.85)**: 100% opacity + green `%` confidence pill badge above the symbol

Badge is a small rounded pill (`border-radius: 9px`) positioned 14px above the symbol anchor using `top: -14px` and `transform: translateX(-50%)`. The existing opacity-only approach remains as the primary differentiator; the badge adds a numeric confidence label.

### SwarmCOPLayer.tsx — Corroboration Source Count Badges

`DetectionAttributionLayer` now:
1. Aggregates a `Map<entityId, Set<robotId>>` (corroboration count per entity)
2. For entities with 2+ detecting robots: renders an `L.marker` with `L.divIcon` showing "2x", "3x" etc. offset above-right of the entity position
3. Tooltip shows which robot IDs corroborated: "Corroborated by 2 robots: robot-tw-1, robot-us-1"
4. Badges only shown when `showAttribution` toggle is ON — no base COP clutter
5. Injected `ensureCorrobCss()` for the `.swarm-corroboration-badge` class (green pill, Fira Code font)

Attribution lines remain colored per nation (TW=green, US=blue, AU=amber) with distinct colors per robot.

### robot-mission-service.ts — Brain Graph Lifecycle Events

`handleSwarmTelemetry()` now writes two new lifecycle events:

**swarm_formed**: Written when a `swarm_id` appears in `swarmStates` for the first time (no previous state). Includes leader_id, formation, state, member_count in payload. Members array contains all robot_ids.

**formation_changed**: Written when `prevState.formation !== incoming.formation`. Includes previous_formation and new_formation in payload, enabling timeline playback to show formation transitions.

Both use `'did:near:bastion.testnet'` as nationalDid and `'default'` as workspaceId (SwarmTelemetryMsg carries no workspace context). Both are non-blocking (`.catch()` with warn log).

### Verification of End-to-End Chain

Confirmed all wiring connections are present:
- `handleSwarmTelemetry()` calls `bridgeSwarmTelemetryToCOP()` (Plan 02) — YES, line 1178
- `dispatchMission()` calls `writeMissionDispatchedEvent()` (Plan 07) — YES, line 575
- `handleVisionMsg()` calls `processVisionDetections()` which calls `fuseDetectionConfidence()` internally (Plan 04) — YES, line 1100
- Escalation creates gates and writes events (Plan 07) — YES, in `createLethalEscalationGate` and `handleEscalationDecision`

## Deviations from Plan

### Auto-added Missing Functionality

**[Rule 2 - Missing Functionality] createMilSymbolIconWithBadge added to COPMapView directly**
- **Found during:** Task 1
- **Issue:** Plan called for confidence badge "positioned above the symbol" — existing implementation only had opacity changes and badges in the popup (not visible on map without clicking)
- **Fix:** Added local `createMilSymbolIconWithBadge` helper in COPMapView.tsx wrapping the divIcon HTML with a relative-positioned container + badge overlay. `L` import added.
- **Files modified:** COPMapView.tsx
- **Commit:** a2e81f7a

## Checkpoint Pending

**Task 2 (human-verify checkpoint)** — Awaiting human verification of the complete Phase 48 demo pipeline.

## Self-Check: PASSED

- `backend/src/robot/robot-mission-service.ts` — FOUND
- `frontend/src/components/cop/SwarmCOPLayer.tsx` — FOUND
- `frontend/src/components/cop/COPMapView.tsx` — FOUND
- Commit `a2e81f7a` — FOUND
- `npx tsc --noEmit` — PASSED (no errors)
- `python3 -m pytest robot/tests/ -x -q` — PASSED (166 tests)
