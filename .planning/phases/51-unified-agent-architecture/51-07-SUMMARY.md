---
phase: 51-unified-agent-architecture
plan: 07
subsystem: frontend
tags: [ironclaw, ai-staff-removal, consolidation]

# Dependency graph
requires:
  - phase: 51-06
    provides: Ironclaw context-awareness and delegation commands

provides:
  - Ironclaw as sole AI interface (AIStaffContext removed)
  - Design sections dispatch to Ironclaw instead of AIStaff
  - ~2000 lines of dead AI panel code removed

affects: []

# Tech tracking
tech-stack:
  added: []
  patterns: []

key-files:
  created: []
  modified:
    - frontend/src/components/design/CoGAnalysisSection.tsx
    - frontend/src/components/design/LOETimelineSection.tsx
    - frontend/src/components/design/ProblemFramingSection.tsx
    - frontend/src/components/design/OperationalApproachSection.tsx
    - frontend/src/components/tabs/DesignTab.tsx
    - frontend/src/components/problem-set/ProblemSetTabContainer.tsx
    - frontend/src/components/ai-staff/index.ts
    - frontend/src/App.tsx

key-decisions:
  - "Direct deletion rather than feature flag — old panels non-functional without AIStaffContext"
  - "Kept AIStaffFeedItem, AIStaffTeamBadge, AIStaffConfidence, AIStaffTeamDetail — still used by other views"
  - "Deleted useAIStaffFeed hook — only consumer was removed AIStaffFeedConnector"

requirements-completed: [REQ-51-05, REQ-51-06]

# Metrics
duration: 10min
completed: 2026-03-18
---

# Phase 51 Plan 07: AI Staff Removal Summary

**Removed AIStaffContext and all per-tab AI panels — Ironclaw is now the sole AI interface**

## Performance

- **Duration:** 10 min
- **Tasks:** 2 (+ 1 checkpoint pending)
- **Files deleted:** 7, modified: 8
- **Lines removed:** ~2000

## Accomplishments

- 4 design sections (CoG, LOE, ProblemFraming, OperationalApproach) now use useIronclaw() for AI dispatch
- DesignAIPanel render removed from DesignTab
- AIStaffContext.tsx deleted
- 5 AI staff component files deleted (Panel, Docked, Floating, ChatInput, DesignAIPanel)
- useAIStaffFeed hook deleted (orphaned after AIStaffFeedConnector removal)
- AIStaffProvider wrapper removed from ProblemSetTabContainer
- Barrel exports cleaned in ai-staff/index.ts

## Task Commits

1. **Task 1: Design sections → Ironclaw** - `3471de79` (feat)
2. **Task 2: Delete AI staff components** - `377d46b9` (feat)

## Deviations from Plan

- Deleted 7 files instead of 6 (added useAIStaffFeed.ts — orphaned after removing its only consumer)
- Feature flag skipped — direct deletion as planned

## Issues Encountered

None — frontend builds cleanly with 10 fewer modules.

---
*Phase: 51-unified-agent-architecture*
*Completed: 2026-03-18*
