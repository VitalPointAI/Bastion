---
phase: 55
plan: 05
status: complete
started: 2026-03-23
completed: 2026-03-23
---

# Plan 55-05 Summary: Design Tab Integration + COP Overlay

## What was built

Wired the design interview into the existing Design tab UI and COP map.

### Task 1: Design Tab Section Integration
- Added "Guide Me" buttons and proactive suggestion cards to all 4 sections:
  - `ProblemFramingSection.tsx` — Interview trigger + suggestion cards
  - `CoGAnalysisSection.tsx` — Guide Me + suggestion integration
  - `LOETimelineSection.tsx` — Guide Me + suggestion integration
  - `OperationalApproachSection.tsx` — Guide Me + suggestion integration
- Added `generateDesignSuggestions` to `ironclaw-service.ts` for proactive prompts
- Wired suggestion card accept actions in `IronclawDrawer.tsx`

### Task 2: COP Overlay
- Wired overlay producer SVG output into `COPMapView.tsx`
- Renders phase overlays and campaign placemat on the map during interviews

## Key files

### Modified
- `frontend/src/components/design/ProblemFramingSection.tsx`
- `frontend/src/components/design/CoGAnalysisSection.tsx`
- `frontend/src/components/design/LOETimelineSection.tsx`
- `frontend/src/components/design/OperationalApproachSection.tsx`
- `frontend/src/components/ironclaw/IronclawDrawer.tsx`
- `frontend/src/components/cop/COPMapView.tsx`
- `backend/src/ironclaw/ironclaw-service.ts`

## Commits
- `5b4e3728` — feat(55-05): wire design interview into Design tab sections and IronclawDrawer
- `38f90320` — feat(55-05): wire overlay producer SVG output into COP map view

## Deviations
None.

## Self-Check: PASSED
