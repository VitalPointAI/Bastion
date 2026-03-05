---
phase: 21-ai-cop-layer-agent-team
plan: 09
subsystem: ui, cop
tags: [cop-ui, entity-tooltip, detail-view, review-panel, lifecycle-controls, conflict-banner, react-components]

# Dependency graph
requires:
  - phase: 21-07
    provides: COP REST API endpoints for layers, feedback, transitions, recall, conflicts
  - phase: 21-08
    provides: copService typed API client with all COP endpoint methods
provides:
  - COPEntityTooltip for hover interaction showing entity summary with linked entities
  - COPEntityDetail for full entity data display with linkages, movement, audit trail
  - COPReviewPanel for staff spatial annotations and general comments during review
  - COPLayerLifecycle for state progression display and transition controls
  - COPConflictBanner for cross-section conflict alerts with source authority ranking
affects: [21-10]

# Tech tracking
tech-stack:
  added: []
  patterns: [entity-linkage-display, lifecycle-progress-indicator, conflict-severity-ranking, source-authority-comparison]

key-files:
  created:
    - frontend/src/components/cop/COPEntityTooltip.tsx
    - frontend/src/components/cop/COPEntityTooltip.css
    - frontend/src/components/cop/COPEntityDetail.tsx
    - frontend/src/components/cop/COPReviewPanel.tsx
    - frontend/src/components/cop/COPReviewPanel.css
    - frontend/src/components/cop/COPLayerLifecycle.tsx
    - frontend/src/components/cop/COPLayerLifecycle.css
    - frontend/src/components/cop/COPConflictBanner.tsx
  modified: []

key-decisions:
  - "EntityLinkage display adapted to plan 08 interface (entityId + confidence + discoveryMethod) rather than assumed name + relationshipType fields"
  - "Source authority extraction from conflict description via regex pattern matching with entity ID prefix fallback"
  - "Recall modal with required reason input ensures accountability per audit requirements"

patterns-established:
  - "Affiliation color mapping: friendly=blue, enemy=red, neutral=green, unknown=yellow across all COP components"
  - "Confidence color thresholds: green >= 0.85, yellow >= 0.70, red < 0.70 for consistent visual indicators"
  - "Lifecycle state progression display with horizontal step indicators and state-appropriate action buttons"
  - "Source authority ranking display: SIGINT > HUMINT > IMINT > OSINT with visual emphasis on preferred source"

requirements-completed: [ENTITY-INTERACTION, REVIEW-WORKFLOW, LIFECYCLE-UI, CONFLICT-DISPLAY]

# Metrics
duration: 7min
completed: 2026-03-05
---

# Phase 21 Plan 09: COP Entity Interaction & Review UI Summary

**Entity tooltip/detail views with linkage display, staff review panel with spatial annotations, layer lifecycle progression controls with recall modal, and cross-section conflict banner with source authority ranking**

## Performance

- **Duration:** 7 min
- **Started:** 2026-03-05T20:26:13Z
- **Completed:** 2026-03-05T20:33:34Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- Entity tooltip shows designation, affiliation badge, CCO class, SIDC code, confidence bar, and up to 5 linked entities on hover with smart edge-avoidance positioning
- Full detail panel with 7 sections: entity header, position, classification, movement path table, linkages with discovery method badges, source documents, and entity-filtered audit trail
- Review panel supports spatial annotation mode (map-click positioning + optional entity targeting) and general comment mode with existing feedback history display
- Lifecycle UI renders Draft->Review->Published->COP progress bar with state-appropriate transitions and recall modal requiring reason input
- Conflict banner shows prioritized list (affiliation=red > position=orange > designation=yellow) with source authority ranking legend

## Task Commits

Each task was committed atomically:

1. **Task 1: Entity tooltip and detail views** - `cf2d3db` (feat)
2. **Task 2: Review panel, lifecycle controls, and conflict banner** - `c0afdc5` (feat)

## Files Created/Modified
- `frontend/src/components/cop/COPEntityTooltip.tsx` - Hover tooltip with entity summary, linkages, confidence bar
- `frontend/src/components/cop/COPEntityTooltip.css` - Dark military-styled tooltip with shadow and high contrast
- `frontend/src/components/cop/COPEntityDetail.tsx` - Full detail slide-in panel with 7 data sections
- `frontend/src/components/cop/COPReviewPanel.tsx` - Staff review with spatial annotations + general comments + transition actions
- `frontend/src/components/cop/COPReviewPanel.css` - Side panel styling for review workflow
- `frontend/src/components/cop/COPLayerLifecycle.tsx` - Lifecycle progress indicator with state transitions and recall modal
- `frontend/src/components/cop/COPLayerLifecycle.css` - Horizontal progress bar and recall modal styling
- `frontend/src/components/cop/COPConflictBanner.tsx` - Dismissible conflict alert banner with severity ranking and authority display

## Decisions Made
- **EntityLinkage interface adaptation**: Plan 08's actual EntityLinkage interface uses entityId + confidence + discoveryMethod rather than name + relationshipType. Adapted tooltip and detail views to display available data with discovery method labels and confidence percentages.
- **Source authority extraction**: COPConflict type lacks direct authority fields. Implemented regex parsing of conflict descriptions plus entity ID prefix conventions as fallback for authority comparison.
- **Recall accountability**: Recall modal requires a reason (textarea, required) before confirming, supporting the audit trail accountability requirement from the COP lifecycle design.

## Deviations from Plan

None - plan executed exactly as written. The EntityLinkage interface adaptation was a data mapping adjustment, not a deviation from plan scope.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All 5 COP interaction components ready for integration into the COP map view (21-10)
- Components consume copService API client from plan 08
- Review workflow covers spatial + general feedback with layer state transition actions
- Lifecycle and conflict components provide complete layer management UI

## Self-Check: PASSED

All 8 files verified present. Both task commits (cf2d3db, c0afdc5) verified in git log.

---
*Phase: 21-ai-cop-layer-agent-team*
*Completed: 2026-03-05*
