---
phase: 57-ironclaw-persistent-memory-and-adaptive-relationship
plan: "01"
subsystem: ironclaw-memory
tags: [memory, persistence, tdd, postgresql, ironclaw]
dependency_graph:
  requires: []
  provides:
    - ironclawUserMemoryStore
    - ironclawContextMemoryStore
    - ironclawOutcomeStore
    - UserMemoryEntry
    - ContextMemoryEntry
    - InteractionOutcome
    - AdaptivePreferences
    - MEMORY_KEYS
    - OUTCOME_TYPES
  affects:
    - backend/src/ironclaw/ironclaw-memory-store.ts
    - backend/src/ironclaw/ironclaw-memory-types.ts
tech_stack:
  added: []
  patterns:
    - IronclawStore singleton pattern (class + singleton export)
    - TDD red-green-refactor with vitest
    - PostgreSQL JSONB for memory_value storage
    - ON CONFLICT DO UPDATE for upsert semantics
    - expires_at TTL filtering in all active memory queries
key_files:
  created:
    - backend/src/ironclaw/ironclaw-memory-types.ts
    - backend/src/ironclaw/ironclaw-memory-store.ts
    - backend/src/ironclaw/ironclaw-memory-store.test.ts
    - backend/src/db/migrations/044-ironclaw-user-memory.sql
    - backend/src/db/migrations/045-ironclaw-context-memory.sql
  modified: []
decisions:
  - "Migration numbers shifted from 043/044 to 044/045 — 043 was already used by design-map-overlay migration from phase 56"
  - "User memory methods take only userDid (no problemSetId) — enforces cross-user isolation by API design"
  - "IronclawOutcomeStore.getOutcomeCounts returns Record<string,number> — numeric values from PostgreSQL COUNT cast via Number()"
metrics:
  duration: "3 min"
  completed_date: "2026-03-25"
  tasks_completed: 1
  files_changed: 5
---

# Phase 57 Plan 01: Ironclaw Memory Data Layer Summary

**One-liner:** PostgreSQL dual-scope memory system (user + context) with upsert semantics, TTL filtering, cross-user isolation, and interaction outcome tracking — foundational data layer for adaptive Ironclaw behavior.

## What Was Built

Three singleton PostgreSQL stores for Ironclaw's persistent memory system:

1. **IronclawUserMemoryStore** — user-scoped key/value memory with 90-day TTL, ON CONFLICT upsert, strict user_did scoping, and delete operations
2. **IronclawContextMemoryStore** — problem-set-scoped memory with 180-day TTL, session_count increment on each update, and delete operations
3. **IronclawOutcomeStore** — interaction outcome recording with optional problem_set_id (nullable for global outcomes), aggregated counts by outcome_type

Plus supporting files:

- **ironclaw-memory-types.ts** — all type definitions: `UserMemoryEntry`, `ContextMemoryEntry`, `InteractionOutcome`, `AdaptivePreferences`, `MEMORY_KEYS`, `OUTCOME_TYPES`, TTL constants
- **044-ironclaw-user-memory.sql** — idempotent migration for `ironclaw_user_memory` table
- **045-ironclaw-context-memory.sql** — idempotent migration for `ironclaw_context_memory` and `ironclaw_interaction_outcomes` tables

## Test Coverage

19 unit tests across 3 describe blocks:

- MEM-01: User memory creation and retrieval
- MEM-02: Upsert semantics — ON CONFLICT DO UPDATE, no duplicates
- MEM-03: Expired memories filtered by `expires_at > NOW()`
- MEM-04: Context memory creation, retrieval, upsert with session_count increment
- MEM-07: Interaction outcome recording with user_did, problem_set_id, outcome_type, context
- MEM-10: Cross-user isolation verified — each getActiveMemories call scoped to its userDid parameter
- Deletion: deleteUserMemory and deleteAllUserMemories issue correct DELETE statements

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Migration numbers shifted from 043/044 to 044/045**
- **Found during:** Task 1 (GREEN phase, before writing migrations)
- **Issue:** Plan specified migrations 043 and 044, but `043-design-map-overlay.sql` already existed from Phase 56 plan 56-04
- **Fix:** Used 044 for ironclaw-user-memory and 045 for ironclaw-context-memory
- **Files modified:** Naming only — content unchanged
- **Commit:** 8be9390c

## Self-Check

- [x] backend/src/ironclaw/ironclaw-memory-types.ts — exists
- [x] backend/src/ironclaw/ironclaw-memory-store.ts — exists
- [x] backend/src/ironclaw/ironclaw-memory-store.test.ts — exists
- [x] backend/src/db/migrations/044-ironclaw-user-memory.sql — exists
- [x] backend/src/db/migrations/045-ironclaw-context-memory.sql — exists
- [x] 19/19 tests pass
- [x] TypeScript: no errors
- [x] ESLint: no errors
- [x] RED commit: c9697719
- [x] GREEN commit: 8be9390c

## Self-Check: PASSED
