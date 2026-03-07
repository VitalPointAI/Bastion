---
phase: 30-ironclaw-agent-integration
plan: 01
subsystem: database, infra
tags: [ironclaw, postgresql, docker, sidecar, trust, audit, near-ai]

requires:
  - phase: 29-contextual-ai-staff-integration
    provides: AI staff store pattern (singleton + getPool)
provides:
  - Ironclaw type system (chat, action, trust, audit types)
  - IronclawStore with 5 PostgreSQL tables and full CRUD
  - Docker sidecar configuration for Ironclaw agent
affects: [30-ironclaw-agent-integration]

tech-stack:
  added: [ironclaw-sidecar]
  patterns: [action-risk-classification, trust-preference-system, audit-anchoring]

key-files:
  created:
    - backend/src/ironclaw/ironclaw-types.ts
    - backend/src/ironclaw/ironclaw-store.ts
    - backend/src/ironclaw/index.ts
  modified:
    - docker-compose.prod.yml
    - docker-compose.yml

key-decisions:
  - "Used const objects for ActionRiskLevel and ACTION_RISK (erasableSyntaxOnly convention)"
  - "Structured rate limits as max/window_seconds objects for flexibility"
  - "ON CONFLICT DO NOTHING for trust grants with fallback fetch for idempotency"

patterns-established:
  - "Action risk classification: low/medium/high mapped to specific action types"
  - "Trust preference: per-user, per-problem-set, per-action-type granularity"
  - "Ironclaw sidecar: internal network only in prod, port 3333 in dev"

requirements-completed: [IC-01, IC-02]

duration: 3min
completed: 2026-03-07
---

# Phase 30 Plan 01: Ironclaw Foundation Summary

**Ironclaw type system with action risk classification, PostgreSQL store for 5 tables (sessions, chat, trust, action log, audit anchors), and Docker sidecar configuration**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-07T13:19:44Z
- **Completed:** 2026-03-07T13:22:44Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Complete Ironclaw type system with 12 exported types/interfaces and 3 const objects
- IronclawStore with 5 PostgreSQL tables, proper indexes, and full CRUD operations
- Docker sidecar service configured for both production (internal only) and development (port 3333)

## Task Commits

Each task was committed atomically:

1. **Task 1: Ironclaw type system and action risk classification** - `97e37f7` (feat)
2. **Task 2: Ironclaw PostgreSQL store and Docker sidecar config** - `29f4bd1` (feat)

## Files Created/Modified
- `backend/src/ironclaw/ironclaw-types.ts` - All type definitions: chat messages, actions, risk levels, trust, audit anchors, sessions, rate limits
- `backend/src/ironclaw/ironclaw-store.ts` - PostgreSQL CRUD store with ensureTable() for 5 tables
- `backend/src/ironclaw/index.ts` - Barrel exports for types and store
- `docker-compose.prod.yml` - Added ironclaw sidecar service (internal network), IRONCLAW_URL/GITHUB_TOKEN to backend
- `docker-compose.yml` - Added ironclaw sidecar service with port 3333 for local debugging

## Decisions Made
- Used const objects for ActionRiskLevel and ACTION_RISK per project erasableSyntaxOnly convention (no enums)
- Structured RATE_LIMITS as objects with max and window_seconds fields for future configurability
- Trust grant uses ON CONFLICT DO NOTHING with a fallback SELECT for idempotent behavior
- Ironclaw sidecar uses separate database (ironclaw) with its own credentials

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Type system and store ready for Plan 02 (REST API routes and WebSocket bridge)
- Docker infrastructure ready for Ironclaw sidecar deployment
- All types exported via barrel for consumption by route handlers

---
*Phase: 30-ironclaw-agent-integration*
*Completed: 2026-03-07*
