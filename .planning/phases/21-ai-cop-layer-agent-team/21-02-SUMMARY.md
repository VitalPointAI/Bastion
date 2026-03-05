---
phase: 21-ai-cop-layer-agent-team
plan: 02
subsystem: agents
tags: [event-bus, eventemitter, agent-pool, staff-agents, trigger-handler, cop, mil-std-2525]

# Dependency graph
requires:
  - phase: 14-exercise-planning
    provides: StaffAgentDef interface and exercise types
provides:
  - Typed COP event bus with 7 event types for agent coordination
  - Triple trigger handler (commit, manual, polling) for layer generation
  - Activity bridge with per-workspace ring buffer for workspace feed integration
  - 7 COP agent definitions (1 coordinator + 6 warfighting function sub-agents)
  - Pool-with-affinity agent manager for section-scoped agent assignment
affects: [21-ai-cop-layer-agent-team, cop-coordinator, cop-layer-generation, cop-api]

# Tech tracking
tech-stack:
  added: []
  patterns: [typed-event-bus, triple-trigger-model, pool-with-affinity, ring-buffer]

key-files:
  created:
    - backend/src/cop/messaging/event-bus.ts
    - backend/src/cop/messaging/trigger-handler.ts
    - backend/src/cop/messaging/activity-bridge.ts
    - backend/src/cop/messaging/event-bus.test.ts
    - backend/src/cop/agents/agent-definitions.ts
    - backend/src/cop/agents/agent-pool.ts
  modified: []

key-decisions:
  - "In-process EventEmitter for COP event bus (swappable to BullMQ later if horizontal scaling needed)"
  - "Ring buffer of 100 entries per workspace for activity bridge (persistence deferred to API plan)"
  - "Pool-with-affinity auto-assigns least-recently-active agent when no section affinity exists"

patterns-established:
  - "COPEventBus: typed EventEmitter wrapper with on/emit/off for all COP event types"
  - "TriggerHandler: triple trigger model (commit/manual/polling) emitting layer:generation:start"
  - "ActivityBridge: subscribes to event bus, buffers in per-workspace ring buffer"
  - "AgentPool: affinity-based agent selection with automatic assignment tracking"

requirements-completed: [AGENT-INFRA, EVENT-BUS, TRIPLE-TRIGGER]

# Metrics
duration: 5min
completed: 2026-03-05
---

# Phase 21 Plan 02: Agent Infrastructure Summary

**Typed event bus with 7 COP event types, triple trigger handler, activity bridge with ring buffer, 7 StaffAgentDef COP agents, and pool-with-affinity agent manager**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-05T19:38:49Z
- **Completed:** 2026-03-05T19:43:20Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Typed event bus delivers all 7 COP event types with full TypeScript type safety
- Triple trigger handler covers commit, manual, and polling triggers with configurable intervals
- Activity bridge buffers agent activity in per-workspace ring buffers (max 100 entries)
- 7 COP agent definitions (1 coordinator + 6 warfighting function sub-agents) following StaffAgentDef pattern
- Agent pool supports pool-with-affinity section assignment with automatic least-recently-active fallback

## Task Commits

Each task was committed atomically:

1. **Task 1: Typed event bus and trigger handler (TDD RED)** - `784ab8d` (test)
2. **Task 1: Typed event bus and trigger handler (TDD GREEN)** - `97ce711` (feat)
3. **Task 2: COP agent definitions and pool manager** - `a2b3c59` (feat)

_Note: Task 1 followed TDD pattern with separate RED (test) and GREEN (implementation) commits._

## Files Created/Modified
- `backend/src/cop/messaging/event-bus.ts` - Typed EventEmitter wrapper with COPEvents interface (7 event types) and singleton
- `backend/src/cop/messaging/trigger-handler.ts` - Triple trigger model: commit, manual, polling with configurable intervals
- `backend/src/cop/messaging/activity-bridge.ts` - Forwards agent:activity events to per-workspace ring buffer (100 max)
- `backend/src/cop/messaging/event-bus.test.ts` - 13 tests covering event delivery, triggers, and activity buffering
- `backend/src/cop/agents/agent-definitions.ts` - 7 COP agent definitions: coordinator (COL Martinez) + 6 sub-agents
- `backend/src/cop/agents/agent-pool.ts` - Pool-with-affinity manager with assign/release/recordActivity/getPreferredAgent

## Decisions Made
- Used in-process EventEmitter for COP event bus per RESEARCH.md recommendation (single-server deployment, swappable interface)
- Activity bridge uses in-memory ring buffer (100 per workspace) -- persistence integration deferred to API plan
- Pool-with-affinity auto-assigns least-recently-active agent when no section affinity exists
- Polling stub always triggers on first poll, then checks lastChecked timestamp (real change detection deferred)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Event bus ready for COP coordinator LangGraph StateGraph integration
- Agent definitions ready for database seeding
- Trigger handler ready for document commit webhook integration
- Activity bridge ready for API endpoint exposure

---
*Phase: 21-ai-cop-layer-agent-team*
*Completed: 2026-03-05*
