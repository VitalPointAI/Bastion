---
phase: 48-robot-swarm-behaviour-end-to-end-demo
plan: "05"
subsystem: cop-swarm-frontend
tags: [swarm, cop, leaflet, frontend, visualization, websocket, interpolation]
dependency_graph:
  requires:
    - 48-02 (SwarmFormationSpec type + swarm-cop-bridge)
  provides:
    - SwarmCOPLayer component in frontend/src/components/cop/SwarmCOPLayer.tsx
    - SwarmFormationPolygon sub-component
    - SwarmMemberMarker sub-component with smooth interpolation
    - SwarmTelemetryPanel sub-component
    - SwarmCOPLayer wired into COPMapView
  affects:
    - frontend/src/components/cop/COPMapView.tsx
tech_stack:
  added: []
  patterns:
    - Imperative Leaflet pattern (L.polygon, L.circleMarker via useMap hook)
    - requestAnimationFrame ease-out interpolation (mirrors SmoothRobotMarker)
    - WebSocket subscribe pattern (/ws/messages channel subscription)
    - Convex hull ordering by angle from centroid (prevents bowtie polygons)
key_files:
  created:
    - frontend/src/components/cop/SwarmCOPLayer.tsx
  modified:
    - frontend/src/components/cop/COPMapView.tsx
decisions:
  - WebSocket channel 'swarm:cop_update' on /ws/messages (same as AI staff feed pattern) — messageType 'swarm.cop.update'
  - Convex hull ordering by atan2 angle from centroid prevents self-intersecting polygons for 3 members
  - No roomToLatLng transform in frontend — positions are geo-coordinates from swarm-cop-bridge.ts
  - SwarmCOPLayer always rendered (no prop-gated visibility) — handles empty state internally with zero renders
  - SwarmCOPLayer placed after COPRobotLayer so formation polygons sit behind individual robot dots
metrics:
  duration: "~8 min"
  completed_date: "2026-03-16"
  tasks_completed: 2
  files_modified: 2
---

# Phase 48 Plan 05: SwarmCOPLayer Frontend Visualization Summary

Swarm formations rendered as translucent state-colored polygons on the COP map with leader icons, smooth position interpolation, and a live telemetry detail panel.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Create SwarmCOPLayer with formation polygon, member markers, telemetry panel | 8561015f | frontend/src/components/cop/SwarmCOPLayer.tsx |
| 2 | Wire SwarmCOPLayer into COPMapView | a1b3390b | frontend/src/components/cop/COPMapView.tsx |

## What Was Built

**SwarmCOPLayer.tsx** (492 lines) — React component with four sub-components:

- **SwarmFormationPolygon**: Creates `L.polygon()` imperatively via `useMap()`. Member positions are sorted by angle from centroid (atan2 convex hull ordering) to prevent self-intersecting polygons. Color is driven by `FORMATION_STATE_COLORS` dict; `forming` state gets dashed border (`dashArray: '6 4'`). `fillOpacity: 0.15` gives translucency. Tooltip shows `swarmId — formation (state)`. Click handler sets `selectedSwarmId` to open the telemetry panel.

- **SwarmMemberMarker**: Creates `L.circleMarker()` per member. Leader gets gold border (`#f59e0b`), radius 10, filled gold. Followers get state-color border, radius 6. Smooth position interpolation uses `requestAnimationFrame` with ease-out quadratic `t * (2 - t)` over 1 second, identical to the `SmoothRobotMarker` pattern from `COPRobotLayer.tsx`. Previous and target positions are stored in refs.

- **SwarmTelemetryPanel**: Fixed-position panel (bottom-right, z-index 1000). Shows swarm ID, state badge with color, formation, technique, member count, heading, leader ID, mission ID (when present), and per-member battery % (red when < 20%). Close button dismisses panel. Updates in real time as swarm telemetry arrives.

- **SwarmCOPLayer (main)**: Subscribes to `/ws/messages` WebSocket on channel `swarm:cop_update`. Receives `{ type: 'message', data: { messageType: 'swarm.cop.update', payload: SwarmFormationSpec } }`. Upserts into `Map<string, SwarmFormationSpec>` by swarmId. Auto-reconnects on close (5s delay). Renders `SwarmFormationPolygon` + `SwarmMemberMarker` set per swarm, and `SwarmTelemetryPanel` when a swarm is selected.

**COPMapView.tsx** — Added `import { SwarmCOPLayer }` and `<SwarmCOPLayer />` after `COPRobotLayer` inside `MapContainer`. Swarm polygons render behind individual robot markers because they are added to the Leaflet map earlier in the render order.

## Decisions Made

1. **WebSocket pattern**: Used `/ws/messages` subscribe-to-channel pattern (same as `useAIStaffFeed`). The backend publishes swarm COP updates with `destinationTarget: 'swarm:cop_update'` and `messageType: 'swarm.cop.update'` via `getMessageBus().publish()`. Frontend subscribes to `'swarm:cop_update'` channel.

2. **Convex hull ordering**: `Math.atan2(lat - center, lng - center)` angle sort from centroid — prevents self-intersecting "bowtie" polygon for 3-member swarms while preserving the correct visual hull for larger formations.

3. **No roomToLatLng**: Positions in `SwarmFormationSpec` are already geo-coordinates (lat/lng) — the `swarm-cop-bridge.ts` does the room-to-geo conversion in Plan 02. Zero transform applied in the frontend layer.

4. **No prop-gated visibility**: `SwarmCOPLayer` has no `visible` prop — it simply renders nothing when `swarms` map is empty. This keeps the API simple and matches the plan spec.

## Deviations from Plan

None — plan executed exactly as written. The WebSocket channel subscription pattern (`/ws/messages` with channel-based subscribe) was confirmed from `useAIStaffFeed.ts` and `resource-registry-service.ts` and applied consistently.

## Verification

- `npx tsc --noEmit` passes cleanly (exit 0, no errors)
- `SwarmCOPLayer.tsx` exists at 492 lines (above min 150)
- Exports: `SwarmCOPLayer` (main), internal sub-components `SwarmFormationPolygon`, `SwarmMemberMarker`, `SwarmTelemetryPanel`
- `COPMapView.tsx` imports `SwarmCOPLayer` and renders `<SwarmCOPLayer />` inside `MapContainer`
- No changes to `COPRobotLayer.tsx` — existing robot dots unaffected

## Self-Check: PASSED

- [x] frontend/src/components/cop/SwarmCOPLayer.tsx exists (492 lines)
- [x] frontend/src/components/cop/COPMapView.tsx imports and renders SwarmCOPLayer
- [x] Commit 8561015f exists (Task 1)
- [x] Commit a1b3390b exists (Task 2)
- [x] TypeScript compiles cleanly
