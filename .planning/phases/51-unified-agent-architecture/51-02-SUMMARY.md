---
phase: 51-unified-agent-architecture
plan: 02
subsystem: agents
tags: [dead-code, cleanup, backend, frontend]

# Dependency graph
requires: []

provides:
  - Cleaned backend/src/agents/ directory with only live agent files
  - Cleaned frontend AI staff and hooks directories

affects:
  - 51-03 (registry rewrite — cleaner import surface)
  - 51-07 (AI staff removal — fewer files to deal with)

# Tech tracking
tech-stack:
  added: []
  patterns: []

key-files:
  created: []
  modified:
    - backend/src/agents/langgraph/agent-seeder.ts
    - backend/src/wargaming/wargaming-engine.ts
    - frontend/src/components/ai-staff/index.ts
    - frontend/src/components/brain/index.ts

key-decisions:
  - "Kept narrative-synthesis.ts, loe-gap-analysis.ts, problem-framing.ts — they ARE live via dynamic imports in design.ts"
  - "Replaced wargaming-engine.ts type imports from deleted stubs with inline type stubs"
  - "Removed 17 stub imports and 13 seed function bodies from agent-seeder.ts"

patterns-established: []

requirements-completed: [REQ-51-06]

# Metrics
duration: 6min
completed: 2026-03-18
---

# Phase 51 Plan 02: Dead Code Removal Summary

**Removed 13 dead backend agent stubs, 6 dead frontend files, and cleaned all broken imports/barrel exports**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-18
- **Completed:** 2026-03-18
- **Tasks:** 2
- **Files deleted:** 19

## Accomplishments

- Deleted 13 dead backend agent stub files: adversary-modeler, assumption-auditor, data-bias-detector, deception-detector, deception-planner, deescalation-manager, effect-cascader, escalation-modeler, exploitation-analyst, message-handlers, orders-validator, roe-compliance, uncertainty-quantifier
- Deleted 6 dead frontend files: AIShowContributions.tsx, InlineAnnotation.tsx, AgentRoutingConfig.ts, useAgentRouting.ts, useInlineAnnotations.ts, IngestionSidebar.tsx
- Cleaned agent-seeder.ts (removed 17 stub imports + 13 seed function bodies + 13 seed calls)
- Fixed wargaming-engine.ts type imports (replaced with inline stubs)
- Cleaned ai-staff/index.ts and brain/index.ts barrel exports

## Task Commits

Each task was committed atomically:

1. **Task 1: Delete dead backend agent files** - `abe02639` (chore)
2. **Task 2: Delete dead frontend AI staff files** - `7cfa62fa` (chore)

## Files Deleted

### Backend (13 files)
- `backend/src/agents/adversary-modeler.ts`
- `backend/src/agents/assumption-auditor.ts`
- `backend/src/agents/data-bias-detector.ts`
- `backend/src/agents/deception-detector.ts`
- `backend/src/agents/deception-planner.ts`
- `backend/src/agents/deescalation-manager.ts`
- `backend/src/agents/effect-cascader.ts`
- `backend/src/agents/escalation-modeler.ts`
- `backend/src/agents/exploitation-analyst.ts`
- `backend/src/agents/message-handlers.ts`
- `backend/src/agents/orders-validator.ts`
- `backend/src/agents/roe-compliance.ts`
- `backend/src/agents/uncertainty-quantifier.ts`

### Frontend (6 files)
- `frontend/src/components/ai-staff/AIShowContributions.tsx`
- `frontend/src/components/ai-staff/InlineAnnotation.tsx`
- `frontend/src/components/ai-staff/AgentRoutingConfig.ts`
- `frontend/src/hooks/useAgentRouting.ts`
- `frontend/src/hooks/useInlineAnnotations.ts`
- `frontend/src/components/brain/IngestionSidebar.tsx`

## Deviations from Plan

- **3 files kept alive:** narrative-synthesis.ts, loe-gap-analysis.ts, problem-framing.ts are live via dynamic imports in design.ts — plan assumed they were dead but they aren't
- **agent-seeder.ts DID import stubs:** Plan assumed seeder used string-only registration but it actually imported from stub files — removed all 17 imports
- **wargaming-engine.ts type fix:** Imported types from deleted stubs — replaced with inline type stubs

## Issues Encountered

None — both backend tsc and frontend build pass cleanly after all deletions.

---
*Phase: 51-unified-agent-architecture*
*Completed: 2026-03-18*
