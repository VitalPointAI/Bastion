---
phase: 39-operational-demonstration-data-package
plan: 07
subsystem: documentation, scripts
tags: [demo, briefing, walkthrough, presentation, military, documentation]

requires:
  - phase: 39-operational-demonstration-data-package
    plan: 01
    provides: problem set hierarchy (11 problem sets), command units (13), seed-demo.sh orchestrator
  - phase: 39-operational-demonstration-data-package
    plan: 02
    provides: RAFT graph (17 actors, 27 relationships, 8 tensions), OSINT events (29)
  - phase: 39-operational-demonstration-data-package
    plan: 03
    provides: document manifest (10 docs), operational design (theater + component)
  - phase: 39-operational-demonstration-data-package
    plan: 04
    provides: JPP instance and step products (9), AI agent outputs (9 across 4 roles)
  - phase: 39-operational-demonstration-data-package
    plan: 05
    provides: decision gates (10), AARs (3 with 16 observations), METL tasks (12)
  - phase: 39-operational-demonstration-data-package
    plan: 06
    provides: inheritance artifacts (FRAGOs, status reports, overrides)

provides:
  - "Presenter-facing briefing script with 5-act narrative arc covering 100% BASTION capabilities"
  - "Operator-facing walkthrough with 13 demo stations, click sequences, and expected screen states"
  - "Audience adaptation notes for military vs academic audiences"
  - "Quick reference card for live demo use"
  - "Troubleshooting guide with SQL/Cypher verification queries"

affects: []

tech-stack:
  added: []
  patterns:
    - "Briefing script structure: pre-brief checklist, narrative acts, per-beat talking points/clicks/engagement"
    - "Walkthrough station pattern: URL, expected state, click sequence, data highlights, fallbacks"

key-files:
  created:
    - scripts/demo-data/BRIEFING-SCRIPT.md
    - scripts/demo-data/DEMO-WALKTHROUGH.md
  modified: []

key-decisions:
  - "5-act narrative structure following scenario progression (operational picture -> understanding -> design -> planning -> governance)"
  - "13 demo stations mapping 1:1 to briefing beats for seamless presenter/operator coordination"
  - "Military vs academic audience adaptation at each beat rather than separate scripts"
  - "Quick reference card designed for printable single-page use during live demos"

patterns-established:
  - "Cross-reference pattern: briefing script references walkthrough stations, walkthrough references briefing acts"
  - "Troubleshooting table pattern: symptom -> cause -> fix for rapid diagnosis"

requirements-completed: [DEMO-11]

duration: 6min
completed: 2026-03-09
---

# Phase 39 Plan 07: Briefing Script & Demo Walkthrough Summary

**Presenter briefing script (25-35 min, 5 acts) and operator walkthrough (13 stations) covering 100% of BASTION capabilities with audience adaptation for military and academic audiences**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-09T02:53:09Z
- **Completed:** 2026-03-09T02:59:09Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Created comprehensive briefing script covering all 21 BASTION features with talking points, timing, navigation hints, and fallbacks
- Created 13-station demo walkthrough with exact click sequences, expected screen states, and troubleshooting
- Both documents cross-reference each other for seamless presenter/operator coordination
- Quick reference card and troubleshooting guide for live demo reliability

## Task Commits

Each task was committed atomically:

1. **Task 1: Create presenter-facing briefing script** - `ba4fcb2` (docs)
2. **Task 2: Create operator-facing demo walkthrough** - `61bb286` (docs)

## Files Created/Modified
- `scripts/demo-data/BRIEFING-SCRIPT.md` - Presenter-facing briefing script with 5-act narrative arc, timing, talking points, audience adaptation
- `scripts/demo-data/DEMO-WALKTHROUGH.md` - Operator-facing walkthrough with 13 stations, click sequences, troubleshooting, quick reference card

## Decisions Made
- Structured briefing as 5 acts following scenario progression (operational picture -> understanding -> design -> planning/directing -> governance/assessment) for natural narrative flow
- Created 13 stations (not 12 or fewer) to give each major feature its own dedicated demo beat
- Included audience adaptation notes inline at each beat rather than as separate scripts, reducing duplication
- Added fallback instructions at every station in case data or UI does not render as expected

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Phase 39 demo data package is now complete (plans 01-07)
- All seed scripts, fixture data, and presentation materials ready for operational demonstration
- Single command (`bash scripts/seed-demo.sh --reset`) populates entire platform with realistic data
- Briefing script and walkthrough enable rehearsable, repeatable demonstrations

---
*Phase: 39-operational-demonstration-data-package*
*Completed: 2026-03-09*
