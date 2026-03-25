---
phase: 57-ironclaw-persistent-memory-and-adaptive-relationship
plan: "02"
subsystem: ironclaw-memory
tags: [memory, ai, ironclaw, tdd, behavioral-adaptation]
dependency_graph:
  requires: ["57-01"]
  provides: ["57-03", "57-04"]
  affects: ["ironclaw-service", "ironclaw-router"]
tech_stack:
  added: []
  patterns: ["Promise.race timeout protection", "fire-and-forget outcome recording", "content preamble injection"]
key_files:
  created:
    - backend/src/ironclaw/ironclaw-memory-service.ts
    - backend/src/ironclaw/ironclaw-memory-service.test.ts
  modified:
    - backend/src/ironclaw/ironclaw-service.ts
    - backend/src/ironclaw/ironclaw-router.ts
decisions:
  - "Memory injection via content preamble (not system prompt) to match existing [Context: ...] pattern"
  - "Promise.race timeout at 200ms ensures memory assembly never blocks message flow"
  - "Behavioral Adaptation section conditionally included only when outcome history > 0 (avoids noise for new users)"
  - "Outcome recording in router confirm endpoint (not service) — router already has decision/result context"
metrics:
  duration: "164 seconds"
  completed: "2026-03-25"
  tasks_completed: 2
  files_modified: 4
---

# Phase 57 Plan 02: Memory Retrieval Service and AI Injection Summary

**One-liner:** MemoryRetrievalService assembles personalized memory blocks with 200ms timeout, 1300-char cap, and conditional behavioral adaptation, injected as content preamble into every Ironclaw AI message.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | MemoryRetrievalService with tests (TDD) | 6fd4a221 | ironclaw-memory-service.ts, ironclaw-memory-service.test.ts |
| 2 | Wire memory injection into IronclawService | 83c2ab08 | ironclaw-service.ts, ironclaw-router.ts |

## What Was Built

### Task 1: MemoryRetrievalService (TDD)

**RED phase:** Wrote 13 failing tests covering all MEM-05, MEM-06, MEM-08, MEM-08b behaviors before implementation.

**GREEN phase:** Implemented `MemoryRetrievalService` class with three public methods:

- `assembleMemoryBlock(userDid, problemSetId, timeoutMs=200)` — fetches user memories (top 8) and context memories (top 8) in parallel, formats as markdown sections, computes adaptive preferences if outcome history exists, applies 1300-char hard cap with '...' suffix, uses `Promise.race` for 200ms timeout protection.

- `deriveAdaptivePreferences(userDid)` — reads 30-day outcome counts, computes proactivityLevel (low/medium/high based on rejection rate), critiqueFrequency (high/medium/low based on edit-post-critique incorporation rate), and prefersDraftFirst flag.

- `recordOutcome(userDid, problemSetId, outcomeType, context)` — pass-through delegation to `ironclawOutcomeStore.recordOutcome`.

All 13 unit tests pass. Service exported as singleton `memoryRetrievalService`.

### Task 2: Memory Injection into IronclawService

Modified `handleMessage()` to restructure the AI message construction:
- Memory block assembled first (timeout-protected)
- Context prefix built separately
- Preamble = `[memoryBlock, contextPrefix].filter(Boolean).join('\n')`
- Final `messageForAi = preamble ? preamble + '\n' + content : content`

Modified `handleGlobalMessage()` to prepend memory block before sending to Ironclaw webhook (null problemSetId for global scope).

Updated `ironclaw-router.ts` confirm endpoint to fire-and-forget outcome recording:
- `result.status === 'executed'` → records `suggestion_accepted`
- `decision === 'no'` → records `suggestion_rejected`

## Decisions Made

1. **Memory injection via content preamble, not system prompt** — `buildSystemPrompt()` is never called (system prompt lives in NEAR AI sidecar). Memory injection must follow the existing `[Context: ...]` pattern in message content.

2. **Promise.race for timeout protection** — resolves empty string after 200ms, ensuring memory assembly never blocks the message flow even if the DB is slow.

3. **Behavioral Adaptation conditionally included** — section only appears when `totalOutcomes > 0`. New users with no history don't see an empty or misleading adaptation section.

4. **Outcome recording in router, not service** — the router's confirm endpoint already has the `decision` value and `result.status`, making it the natural place to record accept/reject outcomes.

## Verification

- `npx vitest run src/ironclaw/` — 32 tests pass (19 store + 13 service)
- `npx tsc --noEmit` — no TypeScript errors
- `grep assembleMemoryBlock ironclaw-service.ts` — confirms injection in both handleMessage (line 239) and handleGlobalMessage (line 488)

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check

- [x] `backend/src/ironclaw/ironclaw-memory-service.ts` — created
- [x] `backend/src/ironclaw/ironclaw-memory-service.test.ts` — created
- [x] `backend/src/ironclaw/ironclaw-service.ts` — modified
- [x] `backend/src/ironclaw/ironclaw-router.ts` — modified
- [x] Commit 6fd4a221 — TDD implementation
- [x] Commit 83c2ab08 — memory injection wiring
