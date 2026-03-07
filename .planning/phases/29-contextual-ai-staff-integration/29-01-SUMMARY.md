---
phase: 29-contextual-ai-staff-integration
plan: 01
subsystem: ui
tags: [react, typescript, context-api, ai-agents, doctrinal-confidence]

# Dependency graph
requires:
  - phase: 24-tab-restructure
    provides: Six doctrinal tabs (Understand/Design/Plan/Direct/COP/Assess)
  - phase: 4.2-ai-agent-teams
    provides: Agent registry with 19 AI agent roles
provides:
  - AI staff type system (AIFeedItem, AIAnnotation, DoctrinalConfidence, ChatMessage, AIStaffState, TabAgentConfig)
  - AIStaffContext provider with split state/dispatch pattern
  - Agent-to-tab routing config mapping 6 doctrinal tabs to default agents
  - PROCESS_TABS/WATCH_TABS constants for panel mode switching
affects: [29-02, 29-03, 29-04, 29-05]

# Tech tracking
tech-stack:
  added: []
  patterns: [split-context-state-dispatch, doctrinal-confidence-mapping, agent-tab-routing]

key-files:
  created:
    - frontend/src/types/ai-staff.ts
    - frontend/src/context/AIStaffContext.tsx
    - frontend/src/components/ai-staff/AgentRoutingConfig.ts
    - frontend/src/components/ai-staff/index.ts
  modified: []

key-decisions:
  - "Split state/dispatch context pattern prevents excessive re-renders"
  - "Doctrinal confidence thresholds: >=0.85 confirmed, >=0.60 probable, >=0.30 possible, else doubtful"
  - "Process tabs (understand/design/plan) auto-open panel; watch tabs (cop/assess/direct) auto-close"
  - "Feed items sorted by priority then timestamp descending"

patterns-established:
  - "Split context pattern: separate state and dispatch contexts for render optimization"
  - "Doctrinal confidence mapping: numeric scores to military terminology"
  - "Tab classification: PROCESS_TABS vs WATCH_TABS determines panel behavior"

requirements-completed: [AI-PANEL-TYPES, SHARED-STATE, AGENT-ROUTING]

# Metrics
duration: 3min
completed: 2026-03-07
---

# Phase 29 Plan 01: AI Staff Types, Context, and Routing Summary

**Complete AI staff type system with split state/dispatch context and doctrinal agent-to-tab routing for all 6 tabs**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-07T12:18:04Z
- **Completed:** 2026-03-07T12:21:03Z
- **Tasks:** 2
- **Files created:** 4

## Accomplishments
- Defined complete type system covering priority-ranked feed, urgency colors, doctrinal confidence, agent attribution, team detail, and inline annotations
- Built AIStaffContext with split state/dispatch pattern per RESEARCH.md pitfall 2 guidance
- Mapped all 6 doctrinal tabs to default agents with PROCESS_TABS/WATCH_TABS classification

## Task Commits

Each task was committed atomically:

1. **Task 1: AI Staff type system and agent routing config** - `2f6bc2d` (feat)
2. **Task 2: AIStaffContext with split state/dispatch pattern** - `369c62b` (feat)

## Files Created/Modified
- `frontend/src/types/ai-staff.ts` - Complete AI staff type system: AIFeedItem, AIAnnotation, DoctrinalConfidence, ChatMessage, AIStaffState, TabAgentConfig, urgency/confidence style mappings
- `frontend/src/context/AIStaffContext.tsx` - Split state/dispatch React context with useReducer, priority-sorted feed, auto panel open/close by tab type
- `frontend/src/components/ai-staff/AgentRoutingConfig.ts` - Default agent-to-tab mapping for all 6 tabs, PROCESS_TABS/WATCH_TABS constants, type guards
- `frontend/src/components/ai-staff/index.ts` - Barrel export for ai-staff components

## Decisions Made
- Split state/dispatch context pattern (two separate React contexts) prevents components reading only dispatch from re-rendering on state changes
- Doctrinal confidence thresholds set at 0.85/0.60/0.30 boundaries mapping to Confirmed/Probable/Possible/Doubtful
- Process tabs auto-open the AI panel (docked sidebar mode); watch tabs auto-close (floating overlay mode)
- Feed items sorted first by priority (critical > high > medium > low), then by timestamp descending within same priority

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Type contracts established for all downstream plans (panel UI, backend, hooks)
- AIStaffContext ready to wrap ProblemSetTabContainer in Plan 02/03
- Agent routing config ready for dynamic routing hooks in Plan 04

---
*Phase: 29-contextual-ai-staff-integration*
*Completed: 2026-03-07*
