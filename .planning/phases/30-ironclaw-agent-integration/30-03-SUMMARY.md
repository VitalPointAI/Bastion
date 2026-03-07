---
phase: 30-ironclaw-agent-integration
plan: 03
subsystem: api, infra
tags: [ironclaw, action-registry, risk-classification, rate-limiting, confirmation-pipeline, decision-gates]

requires:
  - phase: 30-ironclaw-agent-integration
    provides: Ironclaw type system (types, store, barrel exports)
  - phase: 28
    provides: Decision Gate service (gateService.createGate)
provides:
  - Action registry with risk classification and dynamic registration
  - Two-tier confirmation pipeline (inline + Decision Gate)
  - Per-user per-risk-level rate limiting
affects: [30-ironclaw-agent-integration]

tech-stack:
  added: []
  patterns: [two-tier-confirmation, sliding-window-rate-limiting, trust-bypass]

key-files:
  created:
    - backend/src/ironclaw/action-registry.ts
    - backend/src/ironclaw/action-pipeline.ts
  modified:
    - backend/src/ironclaw/index.ts

key-decisions:
  - "Unknown action types default to high risk (safe default for always-confirm pattern)"
  - "Cast gate_type as never for agent_action since GateType enum will be extended in future plan"
  - "Rate limit sliding window uses in-memory Map (no external dependency like Redis)"

patterns-established:
  - "Two-tier confirmation: inline yes/no/always for low/medium, Decision Gate for high"
  - "Trust bypass: auto-approve non-high actions when user has granted trust"
  - "Emergency action: bypass all checks with justification audit trail"

requirements-completed: [IC-06, IC-07, IC-08]

duration: 3min
completed: 2026-03-07
---

# Phase 30 Plan 03: Action Registry & Confirmation Pipeline Summary

**Action registry with risk classification and two-tier confirmation pipeline routing low/medium actions through inline confirms and high-risk actions through Decision Gates**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-07T13:24:56Z
- **Completed:** 2026-03-07T13:27:56Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- ActionRegistry with risk classification lookup, dynamic registration for MCP tools, and sliding-window rate limiting
- ActionPipeline implementing yes/no/always confirmation pattern with trust preference bypass for non-high-risk actions
- High-risk actions always routed to Decision Gates (Phase 28) regardless of trust preferences

## Task Commits

Each task was committed atomically:

1. **Task 1: Action registry with risk classification and rate limiting** - `f722454` (feat)
2. **Task 2: Two-tier action confirmation pipeline** - `58e812e` (feat)

## Files Created/Modified
- `backend/src/ironclaw/action-registry.ts` - ActionRegistry class with risk lookup, dynamic registration, and sliding-window rate limiting
- `backend/src/ironclaw/action-pipeline.ts` - ActionPipeline with processAction, handleConfirmation, and handleEmergencyAction
- `backend/src/ironclaw/index.ts` - Updated barrel to re-export action-registry and action-pipeline

## Decisions Made
- Unknown action types default to 'high' risk per the "always confirm by default" locked decision
- Used `as never` cast for gate_type 'agent_action' since GateType const object will be extended in a subsequent plan
- Rate limiting uses in-memory sliding window Map (no Redis dependency) appropriate for single-server deployment
- Emergency action method leaves role verification to caller/router layer (documented with TODO)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Action registry and pipeline ready for Plan 04 (REST API routes and WebSocket integration)
- Pipeline integrates with existing Decision Gate system for high-risk action approval
- Rate limiting operational for all risk levels including dedicated code_pr bucket

---
*Phase: 30-ironclaw-agent-integration*
*Completed: 2026-03-07*
