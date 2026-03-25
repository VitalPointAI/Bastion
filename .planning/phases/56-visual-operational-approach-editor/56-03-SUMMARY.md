---
phase: 56-visual-operational-approach-editor
plan: 03
subsystem: ai-agents
tags: [ironclaw, mcp, map-overlay, mil-std-2525, mgrs, websocket]

requires:
  - phase: 56-01
    provides: designStore map overlay methods (addMapSymbol, moveMapSymbol, removeMapSymbol, updateMapSymbol, addControlMeasure), MapSymbol/ControlMeasure types, map_overlay DB column

provides:
  - 6 bastion.design.map.* MCP tool definitions in BASTION_TOOLS with full input schemas
  - 6 design.map.* ACTION_RISK entries (all medium) enabling Ironclaw trust/approval pipeline
  - 6 canonical descriptions in CANONICAL_DESCRIPTIONS for social-engineering-resistant action cards
  - 6 handler functions dispatched via BUILDER_HANDLERS for all map operations
  - MGRS-to-lat/lng conversion using mgrs.toPoint() in all position-accepting handlers
  - SIDC affiliation parsing (char 2 -> friendly/enemy/neutral/unknown) for auto-classification
  - Real-time WebSocket push via design.map_updated message-bus events on every map mutation

affects: [ironclaw-chat, design-tab, operational-approach-map, action-pipeline, trust-approval]

tech-stack:
  added: [mgrs npm package (already in deps) for MGRS coordinate conversion]
  patterns:
    - "Map tool handlers use dynamic imports matching existing builder-handlers.ts pattern"
    - "MGRS conversion is best-effort: falls back gracefully if mgrs string is invalid"
    - "Geometry type inferred from coordinate count and measure type (1=point, 2+=line, engagement_area/objective=polygon)"
    - "Overlay graphic stored as ControlMeasure type=other with [graphicType] label prefix"

key-files:
  created: []
  modified:
    - backend/src/ironclaw/tool-bridge.ts
    - backend/src/ironclaw/ironclaw-types.ts
    - backend/src/ironclaw/action-registry.ts
    - backend/src/ironclaw/builder-handlers.ts

key-decisions:
  - "MGRS conversion uses mgrs.toPoint() which returns [lng, lat] — handlers swap order to {lat, lng}"
  - "Overlay graphics reuse ControlMeasure storage with type=other and [graphicType] label prefix to avoid new DB schema"
  - "Geometry type for control measures inferred automatically: engagement_area/objective=polygon, multi-coord=line, single=point"
  - "All map tools classified as medium risk — map changes are significant but reversible, warrant confirmation not gate"

patterns-established:
  - "Map tool handlers follow same dynamic import pattern as designUpdateSection handler"
  - "WebSocket publish is non-blocking — wrapped in try/catch to not fail the action on bus errors"

requirements-completed: [MAP-04]

duration: 6min
completed: 2026-03-25
---

# Phase 56 Plan 03: Ironclaw Map Tool Integration Summary

**6 Ironclaw MCP tools for operational approach map editing: add/move/remove/update symbols and add control measures/overlay graphics, all with MGRS conversion, SIDC affiliation parsing, and real-time WebSocket push**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-25T13:16:00Z
- **Completed:** 2026-03-25T13:22:48Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- Registered 6 `bastion.design.map.*` MCP tool definitions with full JSON Schema input validation in BASTION_TOOLS
- Added 6 ACTION_RISK entries (all medium) and 6 canonical descriptions for the Ironclaw trust/approval pipeline
- Implemented 6 handler functions with MGRS-to-lat/lng conversion, SIDC affiliation parsing, designStore calls, and WebSocket push

## Task Commits

Each task was committed atomically:

1. **Task 1: Register map tool definitions, risk levels, and canonical descriptions** - `d3063cc0` (feat)
2. **Task 2: Implement builder handler functions for all 6 map tools** - `293984c9` (feat)

## Files Created/Modified

- `backend/src/ironclaw/tool-bridge.ts` - 6 new bastion.design.map.* MCPToolDefinition entries in BASTION_TOOLS array
- `backend/src/ironclaw/ironclaw-types.ts` - 6 design.map.* ACTION_RISK entries (all ActionRiskLevel.medium)
- `backend/src/ironclaw/action-registry.ts` - 6 bastion.design.map.* canonical descriptions in CANONICAL_DESCRIPTIONS
- `backend/src/ironclaw/builder-handlers.ts` - getSIDCAffiliation helper, mgrsToLatLng helper, 6 handler functions, 6 BUILDER_HANDLERS registrations

## Decisions Made

- MGRS conversion uses `mgrs.toPoint()` which returns `[lng, lat]` — handlers correctly swap to `{lat, lng}`
- Overlay graphics reuse ControlMeasure storage (type=other, `[graphicType] label` prefix) to avoid new DB schema — clean solution within existing data model
- Geometry type for control measures is inferred automatically from coordinate count and measure type (engagement_area/objective become polygons, multi-point others become lines, single-point becomes point)
- All 6 map tool actions classified as medium risk — map changes are operationally significant but reversible, warranting user confirmation without requiring a formal decision gate

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Ironclaw can now add/move/remove/update military symbols and control measures via natural language chat commands
- Frontend map component (Plan 56-02) will receive real-time `design.map_updated` WebSocket events from Ironclaw actions
- The dual-mode editing experience is complete: direct map manipulation and Ironclaw AI staff officer commands both feed the same overlay state

---
*Phase: 56-visual-operational-approach-editor*
*Completed: 2026-03-25*
