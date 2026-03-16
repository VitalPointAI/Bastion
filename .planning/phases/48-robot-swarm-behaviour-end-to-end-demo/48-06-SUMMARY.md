---
phase: 48-robot-swarm-behaviour-end-to-end-demo
plan: "06"
subsystem: frontend
tags: [coalition, caveat, pre-flight, bounding-overwatch, detection-attribution, leaflet, react, typescript]

# Dependency graph
requires:
  - phase: 48-03
    provides: coalition-caveat-service.ts with checkSwarmCaveat, CoalitionProfile, CaveatCheckResult
  - phase: 48-04
    provides: DAO authorization gateway wiring
  - phase: 48-05
    provides: SwarmCOPLayer with formation polygon, member markers, telemetry panel

provides:
  - CoalitionCaveatDashboard: pre-flight robot/mission caveat matrix (green/amber/red badges)
  - RobotMissionTrigger: caveat enforcement blocks swarm mission dispatch on DID policy violation
  - SwarmCOPLayer: detection attribution toggle (dashed lines, off by default) + bounding overwatch animation

affects:
  - Direct tab: mission dispatch flow now enforces coalition caveats
  - COP tab: SwarmCOPLayer shows detection provenance and bounding/overwatch roles

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Client-side caveat evaluation: mirror of backend logic so dashboard renders without round-trip"
    - "Attribution lines on L.layerGroup for clean show/hide without recreating markers"
    - "BoundingOverwatchLayer: even-slot=bounding (pulse CSS + heading arrow), odd-slot=overwatch (SVG sector arc)"
    - "CSS keyframe animation injected once via module-level guard (_pulseCssInjected)"

key-files:
  created:
    - frontend/src/components/direct/CoalitionCaveatDashboard.tsx
  modified:
    - frontend/src/components/direct/RobotMissionTrigger.tsx
    - frontend/src/components/cop/SwarmCOPLayer.tsx
    - backend/src/api/robot-routes.ts

key-decisions:
  - "Client-side caveat evaluation mirrors backend: avoids round-trip latency for pre-flight display; backend still enforces on dispatch"
  - "Attribution toggle default OFF: COP stays clean; operator explicitly enables provenance lines when needed"
  - "Even/odd slot index for bounding role: deterministic, reversible, no additional state needed"
  - "SVGOverlay for overwatch sector: native Leaflet API, no external libs needed"

# Metrics
duration: 6min
completed: 2026-03-16
---

# Phase 48 Plan 06: Coalition Caveat Dashboard + COP Bounding Animation Summary

**Pre-flight coalition caveat dashboard with robot/mission-type matrix (TW/US/AU DID policies), mission dispatch blocked on caveat violation, detection attribution toggle (default off), and bounding overwatch animation with CSS pulse + SVG sector arc**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-16T16:10:41Z
- **Completed:** 2026-03-16T16:17:27Z
- **Tasks:** 2
- **Files modified:** 4 (1 created, 3 updated)

## Accomplishments

- `CoalitionCaveatDashboard` component: shows robot x mission-type grid with status badges — green circle (allowed), amber `~` (area-specific restriction), red X (blocked). Tooltip on blocked/partial badge shows the exact restriction reason from the national DID profile.
- Alternative asset suggestion: "Suggest Alternative Asset" button calls a local evaluation (matching the backend `suggestAlternativeAsset` logic) and shows the first unblocked swarm member who can perform the mission.
- `RobotMissionTrigger` integration: caveat dashboard renders before dispatch for all swarm missions and `find_engage`. Launch button disabled + labeled "Blocked — Caveat Violation" when any member's DID caveat forbids the mission.
- `GET /api/robot/coalition-profiles` endpoint added to `robot-routes.ts` — serves the profiles JSON that the dashboard fetches on mount.
- Detection attribution toggle in `SwarmCOPLayer`: `DetectionAttributionLayer` draws dashed polylines from detecting robot position to detected entity position, colored by nation DID (TW=green, US=blue, AU=gold). Toggle button in `SwarmTelemetryPanel`, default OFF.
- Bounding overwatch animation: `BoundingOverwatchLayer` renders for `bounding_overwatch`/`successive_bounds` technique. Even-slot members (bounding): pulsing CSS-animated amber divIcon + short heading arrow polyline. Odd-slot members (overwatch): static blue divIcon + translucent SVG fan-sector arc (~60° spread in swarm heading direction).

## Task Commits

1. **Task 1: coalition caveat dashboard + RobotMissionTrigger integration** — `2f4385e4` (feat)
2. **Task 2: detection attribution toggle + bounding overwatch animation** — `e97069fb` (feat)

## Files Created/Modified

- `frontend/src/components/direct/CoalitionCaveatDashboard.tsx` (created, 404 lines) — Pre-flight caveat matrix component with status badges, blocked-robot summary, and alternative asset suggestion
- `frontend/src/components/direct/RobotMissionTrigger.tsx` (updated) — Import + render `CoalitionCaveatDashboard`; `caveatBlocked` gates dispatch button
- `frontend/src/components/cop/SwarmCOPLayer.tsx` (updated, +355 lines) — `DetectionAttributionLayer`, `BoundingOverwatchLayer`, updated `SwarmTelemetryPanel` with toggle
- `backend/src/api/robot-routes.ts` (updated) — `GET /coalition-profiles` route + import of `loadCoalitionProfiles`

## Decisions Made

- **Client-side caveat evaluation:** The dashboard mirrors the backend `checkSwarmCaveat` logic in TypeScript. This means immediate visual feedback without waiting for an API round-trip. The backend still enforces independently on dispatch — the frontend check is advisory/visual only.

- **Attribution default OFF:** The COP should be clean for situational awareness. Detection provenance lines are operator-activated. This follows the "progressive disclosure" pattern used elsewhere in the COP layer.

- **Even/odd slot for bounding roles:** Slot index is always available from `SwarmMemberSpec.slotIndex` (position in formation). Using `idx % 2 === 0` (array index, not slot index) ensures visual variety without needing a separate "role" field for bounding specifically. Easy to change if formation software assigns explicit bounding/overwatch labels.

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

- Node.js system version (v12) incompatible with pnpm — used nvm v20 for all TypeScript operations. Standard project practice per MEMORY.md.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Plan 48-07: DAO governance + lethal escalation integration — caveat enforcement wired into dispatch. Caveat dashboard is visible in the Direct tab pre-flight.
- Coalition caveat dashboard is demo-ready: shows Taiwan (full authority), US (no urban offensive, no find_engage), Australia (recon only) with clear visual differentiation.

---
*Phase: 48-robot-swarm-behaviour-end-to-end-demo*
*Completed: 2026-03-16*

## Self-Check: PASSED

All artifacts verified:
- FOUND: frontend/src/components/direct/CoalitionCaveatDashboard.tsx
- FOUND: frontend/src/components/direct/RobotMissionTrigger.tsx
- FOUND: frontend/src/components/cop/SwarmCOPLayer.tsx
- FOUND: backend/src/api/robot-routes.ts
- FOUND: 48-06-SUMMARY.md
- FOUND: 2f4385e4 (Task 1 — coalition caveat dashboard + RobotMissionTrigger)
- FOUND: e97069fb (Task 2 — detection attribution + bounding overwatch animation)
