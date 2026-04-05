---
phase: 66-ironclaw-memory-evolution-and-concept-learning
plan: 07
status: complete
started: 2026-04-05
completed: 2026-04-05
---

## Summary

Built bidirectional sidecar sync: pushes consolidated concepts to Ironclaw sidecar via REPL /memory commands and triggers memory forget on thread deletion. All operations are best-effort with graceful degradation.

## What was built

### Task 1: Sidecar Sync Service
- `sidecar-sync.ts` — Service with pushConceptToSidecar, forgetThread, pushBulkConcepts
- Lazy memory support detection: sends `/memory list` on first call, caches result
- 100ms delay between bulk pushes (T-66-17 mitigation)
- All operations wrapped in try/catch — sidecar unavailability never blocks primary operations

### Task 2: Wiring into Thread Deletion and Consolidation
- `ironclaw-store.ts` deleteThread: fire-and-forget sidecarSyncService.forgetThread() after concept retraction
- `concept-consolidation.ts`: pushConceptToSidecar() after each successful consolidation upsert

## Key files

### Created
- `backend/src/ironclaw/sidecar-sync.ts`

### Modified
- `backend/src/ironclaw/ironclaw-store.ts`
- `backend/src/ironclaw/concept-consolidation.ts`

## Deviations

None.

## Self-Check: PASSED
- [x] sidecar-sync.ts exports sidecarSyncService
- [x] Contains /memory update REPL command
- [x] Contains /memory forget REPL command
- [x] Contains checkSidecarMemorySupport
- [x] Contains pushBulkConcepts with 100ms delay
- [x] All functions wrapped in try/catch
- [x] ironclaw-store.ts imports sidecarSyncService
- [x] ironclaw-store.ts deleteThread calls forgetThread
- [x] concept-consolidation.ts calls pushConceptToSidecar
- [x] tsc --noEmit passes
