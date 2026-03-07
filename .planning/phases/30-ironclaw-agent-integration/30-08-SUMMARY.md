---
phase: 30-ironclaw-agent-integration
plan: 08
subsystem: api, infra
tags: [ironclaw, self-update, audit-trail, merkle-tree, blockchain, near, docker]

requires:
  - phase: 30-ironclaw-agent-integration
    provides: Ironclaw store with action log and audit anchor tables (Plan 01)
provides:
  - SelfUpdateService with GitHub release polling, session draining, Docker restart, and rollback
  - AuditAnchorService with Merkle root computation and emergency action anchoring
affects: [30-ironclaw-agent-integration]

tech-stack:
  added: []
  patterns: [merkle-tree-anchoring, self-update-polling, docker-compose-restart]

key-files:
  created:
    - backend/src/ironclaw/self-update-service.ts
    - backend/src/ironclaw/audit-anchor-service.ts
  modified:
    - backend/src/ironclaw/index.ts

key-decisions:
  - "Simple string comparison for version check instead of semver library (avoid dependency)"
  - "Admin notifications via most-recent Ironclaw session lookup rather than dedicated admin channel"
  - "Canonical JSON with sorted keys for deterministic Merkle leaf hashing"
  - "NEAR contract submission deferred as TODO (requires contract method for audit anchoring)"

patterns-established:
  - "Merkle tree anchoring: binary tree from SHA-256 hashes of canonical JSON action entries"
  - "Self-update lifecycle: notify -> drain -> restart -> verify -> report/rollback"
  - "Emergency anchoring: bypass batch threshold for immediate single-action anchor"

requirements-completed: [IC-22, IC-23, IC-24]

duration: 3min
completed: 2026-03-07
---

# Phase 30 Plan 08: Self-Update and Audit Anchor Services Summary

**Self-update service polling GitHub releases every 6 hours with session draining and rollback, plus Merkle tree audit anchoring of action trail in batches of 100**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-07T13:33:31Z
- **Completed:** 2026-03-07T13:36:38Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- SelfUpdateService with 6-hour GitHub release polling, Docker compose restart, health check verification, and automatic rollback on failure
- AuditAnchorService with binary Merkle tree computation from SHA-256 hashed action entries, batch anchoring every 100 actions or 1 hour
- Emergency action immediate anchoring bypasses batch threshold per discretion recommendation
- Both services exported from ironclaw barrel for downstream consumption

## Task Commits

Each task was committed atomically:

1. **Task 1: Self-update service with release polling and session draining** - `28db6f4` (feat)
2. **Task 2: Audit trail blockchain anchoring service** - `73e5a2d` (feat)

## Files Created/Modified
- `backend/src/ironclaw/self-update-service.ts` - Release detection, session draining, Docker restart with rollback
- `backend/src/ironclaw/audit-anchor-service.ts` - Batch Merkle root computation and blockchain anchoring
- `backend/src/ironclaw/index.ts` - Updated barrel exports with self-update and audit anchor services

## Decisions Made
- Used simple string comparison for version comparison instead of adding a semver library dependency
- Admin notifications sent to the most recent Ironclaw session's problem_set_id as a system message
- Canonical JSON with alphabetically sorted keys ensures deterministic Merkle leaf hashing across environments
- NEAR contract submission left as TODO -- requires a dedicated contract method for storing audit Merkle roots

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Self-update and audit anchoring services ready for integration with Ironclaw startup lifecycle
- NEAR contract method for Merkle root submission needed before blockchain anchoring is fully operational
- Both services follow singleton pattern consistent with other Ironclaw services

---
*Phase: 30-ironclaw-agent-integration*
*Completed: 2026-03-07*
