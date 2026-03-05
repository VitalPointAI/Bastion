---
phase: 21-ai-cop-layer-agent-team
plan: 08
subsystem: ui, cop, map
tags: [cop-map, leaflet, milsymbol, layer-controls, perspective-toggle, shadow-dom, svg-sandbox, workspace-tab]

# Dependency graph
requires:
  - phase: 21-07
    provides: COP REST API endpoints (layers, versions, agents, linkages, conflicts)
  - phase: 21-01
    provides: COP type definitions (COPLayer, COPLayerSpec, Perspective, etc.)
provides:
  - Typed COP API client (copService) covering all 20+ endpoints
  - COPMapView with stacked layer rendering on Leaflet using milsymbol
  - COPLayerControls with grouped visibility/opacity management
  - COPPerspectiveToggle for Friendly/Adversary/Combined view switching
  - SandboxedSVG component for safe LLM-generated SVG rendering via shadow DOM
  - COPTab wrapper composing map + controls for workspace integration
  - COP tab registered in WorkspaceTabContainer for authorized roles
affects: [21-09, 21-10]

# Tech tracking
tech-stack:
  added: []
  patterns: [shadow-dom-svg-sandbox, perspective-filtered-symbol-rendering, layer-opacity-controls]

key-files:
  created:
    - frontend/src/lib/cop-service.ts
    - frontend/src/components/cop/COPMapView.tsx
    - frontend/src/components/cop/COPMapView.css
    - frontend/src/components/cop/COPLayerControls.tsx
    - frontend/src/components/cop/COPLayerControls.css
    - frontend/src/components/cop/COPPerspectiveToggle.tsx
    - frontend/src/components/cop/SandboxedSVG.tsx
    - frontend/src/components/cop/COPTab.tsx
  modified:
    - frontend/src/components/workspace/WorkspaceTabContainer.tsx

key-decisions:
  - "COP API client replaces prior stub with full endpoint coverage following StrategicService fetch pattern"
  - "Shadow DOM with closed mode for SVG sandboxing plus allowlist-based sanitization (belt and suspenders)"
  - "Annotations rendered as Marker + Popup rather than L.svgOverlay for simplicity; full overlay positioning deferred to Plan 10"
  - "COP tab access granted to commander, xo, s2, s3, team_lead; other roles excluded"

patterns-established:
  - "SandboxedSVG pattern: shadow DOM + SVG element/attribute allowlist for LLM-generated content"
  - "Perspective filtering: matchesPerspective() filters symbols by affiliation based on Perspective type"
  - "COPTab composition: map as main area, controls as sidebar overlay, perspective toggle top-left"

requirements-completed: [COP-MAP-VIEW, LAYER-CONTROLS, PERSPECTIVE-TOGGLE, COP-WORKSPACE-INTEGRATION]

# Metrics
duration: 6min
completed: 2026-03-05
---

# Phase 21 Plan 08: COP Frontend Map & Controls Summary

**Interactive COP map with milsymbol rendering, layer visibility/opacity controls, Friendly/Adversary/Combined perspective toggle, shadow DOM SVG sandbox, and workspace tab integration for authorized roles**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-05T20:26:37Z
- **Completed:** 2026-03-05T20:32:52Z
- **Tasks:** 3
- **Files modified:** 9

## Accomplishments
- Full COP API client covering all backend endpoints (layers, versions, agents, linkages, conflicts) with typed responses
- COPMapView renders stacked COP layers on Leaflet with milsymbol markers, polyline/polygon control measures, and sandboxed SVG annotations
- Perspective toggle instantly filters symbols by affiliation (Friendly shows friendly only, Adversary shows enemy only, Combined shows all)
- Layer controls panel groups layers by type with individual visibility toggles, opacity sliders, state badges, and bulk show/hide
- SandboxedSVG component uses closed shadow DOM plus element/attribute allowlist for military-grade SVG sanitization
- COP tab accessible in workspace navigation for commander, xo, s2, s3, team_lead roles

## Task Commits

Each task was committed atomically:

1. **Task 1: COP API service client** - `832a957` (feat)
2. **Task 2: COP map view with layer controls and perspective toggle** - `427fe18` (feat)
3. **Task 3: COP tab wrapper and workspace navigation integration** - `44d4624` (feat)

## Files Created/Modified
- `frontend/src/lib/cop-service.ts` - Full typed API client for all COP REST endpoints
- `frontend/src/components/cop/COPMapView.tsx` - Main COP map with stacked layer rendering
- `frontend/src/components/cop/COPMapView.css` - Map container and loading state styles
- `frontend/src/components/cop/COPLayerControls.tsx` - GIS-style layer toggle panel with opacity
- `frontend/src/components/cop/COPLayerControls.css` - Layer controls panel styles
- `frontend/src/components/cop/COPPerspectiveToggle.tsx` - Three-way segmented perspective control
- `frontend/src/components/cop/SandboxedSVG.tsx` - Shadow DOM SVG sandbox with sanitization
- `frontend/src/components/cop/COPTab.tsx` - COP tab wrapper composing map + controls
- `frontend/src/components/workspace/WorkspaceTabContainer.tsx` - Added 'cop' tab, label, role access, rendering

## Decisions Made
- **Full API client replacement**: Replaced the prior stub cop-service.ts with complete endpoint coverage following the StrategicService authenticated fetch pattern with singleton export.
- **Shadow DOM + allowlist sanitization**: Used closed shadow DOM mode to isolate LLM-generated SVG from the main document, combined with a strict element/attribute allowlist that strips event handlers and non-standard content.
- **Annotation rendering via Marker**: Custom annotations use Marker + Popup pattern rather than L.svgOverlay for initial simplicity. Full positional overlay rendering deferred to Plan 10 phase slider work.
- **Role access scope**: COP tab granted to commander, xo, s2, s3, team_lead. Intel (s2) and operations (s3) need COP access for operational awareness. Other staff roles (s4-s9) and observer/member excluded.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- COP map and controls fully functional for Plans 09 (review/feedback UI) and 10 (phase slider/animation)
- All COP components exported and composable
- WorkspaceTabContainer updated with COP integration

## Self-Check: PASSED

All 8 created files verified present. All 3 task commits verified in git log.

---
*Phase: 21-ai-cop-layer-agent-team*
*Completed: 2026-03-05*
