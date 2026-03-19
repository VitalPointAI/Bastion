---
phase: 52-agent-skills-mcp
plan: "04"
subsystem: api
tags: [ironclaw, suggestions, field-write-back, postgresql, express, react]

requires:
  - phase: 52-agent-skills-mcp
    provides: Ironclaw chat infrastructure (ironclaw-store, ironclaw-service, ironclaw-router) from plans 01-03

provides:
  - Suggestion payload parsing in processResponse (detects parsed.suggestion from Ironclaw JSON)
  - SuggestionPayload interface and SENSITIVE_FIELDS constant in ironclaw-types.ts
  - suggestion JSONB column on ironclaw_chat table (migration 039)
  - ironclaw_tasks table for Plan 05 orchestration loop (migration 039)
  - POST /api/ironclaw/suggestions/:id/accept endpoint with role permissions and Decision Gate enforcement
  - Frontend IronclawContext.acceptSuggestion calls backend persist endpoint

affects: [52-05-orchestration-loop, ironclaw-router, ironclaw-service, ironclaw-store]

tech-stack:
  added: []
  patterns:
    - "ROLE_FIELD_PERMISSIONS map for per-field role access control in suggestion accept"
    - "dispatchFieldWrite routing design.* to designStore, top-level fields to problemSetStore"
    - "SENSITIVE_FIELDS set for Decision Gate gate-keeping of commander-intent fields"

key-files:
  created:
    - backend/src/db/migrations/039-ironclaw-tasks.sql
  modified:
    - backend/src/ironclaw/ironclaw-types.ts
    - backend/src/ironclaw/ironclaw-store.ts
    - backend/src/ironclaw/ironclaw-service.ts
    - backend/src/ironclaw/ironclaw-router.ts
    - backend/src/ironclaw/self-update-service.ts
    - frontend/src/context/IronclawContext.tsx

key-decisions:
  - "suggestion detection placed after messageContent derivation so fallback content is available"
  - "ROLE_FIELD_PERMISSIONS uses simple prefix matching rather than exact field enumeration for flexibility"
  - "dispatchFieldWrite falls back to a console warning for unknown fields rather than hard error"
  - "ironclaw_tasks table created in migration 039 alongside suggestion column to avoid a separate migration for Plan 05"

patterns-established:
  - "Suggestion accept pipeline: parse in processResponse → persist in addMessage → accept via POST /suggestions/:id/accept → dispatch to PS API"
  - "SENSITIVE_FIELDS requires Decision Gate row with matching suggestion_id before write proceeds"

requirements-completed: [REQ-52-04]

duration: 8min
completed: 2026-03-19
---

# Phase 52 Plan 04: Ironclaw Suggestion Field Write-Back Pipeline Summary

**Ironclaw suggestion parsing, persistence, and accept endpoint with role-based field write-back to problem set and design APIs**

## Performance

- **Duration:** 8 min
- **Started:** 2026-03-19T13:23:48Z
- **Completed:** 2026-03-19T13:31:59Z
- **Tasks:** 2
- **Files modified:** 6 modified, 1 created

## Accomplishments
- Added `SuggestionPayload` type and `SENSITIVE_FIELDS` constant to `ironclaw-types.ts`; added `suggestion` field to `IronclawChatMessage`
- `processResponse` now detects `parsed.suggestion`, generates a UUID-prefixed ID, flags sensitive fields with `risk: 'high'`, and persists via `addMessage`
- Migration 039 adds the `suggestion JSONB` column to `ironclaw_chat` and creates the `ironclaw_tasks` table for the Plan 05 orchestration loop
- `POST /api/ironclaw/suggestions/:id/accept` validates membership, checks `ROLE_FIELD_PERMISSIONS`, enforces Decision Gate for sensitive fields, and routes field writes to `designStore` or `problemSetStore`
- `IronclawContext.acceptSuggestion` now calls the backend accept endpoint alongside the existing local event bus dispatch

## Task Commits

1. **Task 1: DB migration, ironclaw-store suggestion column, and processResponse suggestion parsing** - `23f8e3e6` (feat)
2. **Task 2: Suggestion accept API endpoint and frontend wiring** - `09503840` (feat)

## Files Created/Modified
- `backend/src/db/migrations/039-ironclaw-tasks.sql` - Adds suggestion JSONB to ironclaw_chat; creates ironclaw_tasks table with indexes
- `backend/src/ironclaw/ironclaw-types.ts` - SuggestionPayload interface, SENSITIVE_FIELDS set, suggestion field on IronclawChatMessage
- `backend/src/ironclaw/ironclaw-store.ts` - addMessage includes suggestion param; rowToChatMessage maps row.suggestion
- `backend/src/ironclaw/ironclaw-service.ts` - processResponse parses suggestion from Ironclaw JSON response; all addMessage callsites pass suggestion: null
- `backend/src/ironclaw/ironclaw-router.ts` - POST /suggestions/:id/accept endpoint with role permissions, Decision Gate check, field dispatch
- `backend/src/ironclaw/self-update-service.ts` - Added suggestion: null to addMessage call
- `frontend/src/context/IronclawContext.tsx` - acceptSuggestion calls backend accept endpoint; TODO replaced with fetch

## Decisions Made
- Placed suggestion parsing block after `messageContent` derivation so the `content` fallback is available
- Used prefix-based role field permissions (`design.*` covers all design sub-fields) rather than enumerating every field
- `dispatchFieldWrite` silently warns and no-ops for unknown fields rather than returning a 500, keeping the pipeline resilient
- Created `ironclaw_tasks` in migration 039 (not a new 040) to avoid a separate deploy step when Plan 05 is executed

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed messageContent used before declaration**
- **Found during:** Task 1 (suggestion parsing block placed before messageContent const)
- **Issue:** suggestion parsing block used `messageContent` as a fallback but `messageContent` was declared after the block
- **Fix:** Moved `messageContent` declaration before the suggestion parsing block
- **Files modified:** `backend/src/ironclaw/ironclaw-service.ts`
- **Verification:** `npx tsc --noEmit` exits 0
- **Committed in:** `23f8e3e6` (Task 1 commit)

**2. [Rule 2 - Missing Critical] Added suggestion: null to self-update-service.ts**
- **Found during:** Task 1 (TypeScript error on addMessage call without suggestion field)
- **Issue:** `self-update-service.ts` called `addMessage` without the required `suggestion` field after `IronclawChatMessage` was updated
- **Fix:** Added `suggestion: null` to the call site
- **Files modified:** `backend/src/ironclaw/self-update-service.ts`
- **Verification:** `npx tsc --noEmit` exits 0
- **Committed in:** `23f8e3e6` (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (1 bug, 1 missing required field)
**Impact on plan:** Both fixes required for TypeScript correctness. No scope creep.

## Issues Encountered
None beyond the auto-fixed deviations above.

## User Setup Required
None — migration 039 must be run on the production database after deploy (per project convention: migrations are committed but executed on production DB).

## Next Phase Readiness
- Plan 05 (orchestration loop) can now use the `ironclaw_tasks` table already created in migration 039
- Frontend `IronclawSuggestion` component will render when `message.suggestion` is present (existing component, wired through WebSocket already)
- Decision Gate table (`decision_gates`) must exist in DB for sensitive field approval — verify before using missionStatement/commandersIntent write-back

---
*Phase: 52-agent-skills-mcp*
*Completed: 2026-03-19*
