---
phase: 66-ironclaw-memory-evolution-and-concept-learning
plan: 06
status: complete
started: 2026-04-05
completed: 2026-04-05
---

## Summary

Built two feedback loops for continuous learning: cross-thread concept consolidation and decision path memory for reinforcement learning.

## What was built

### Task 1: Cross-Thread Consolidation Job
- `concept-consolidation.ts` — Scheduled job (6h interval, 5min startup delay) that finds concepts with 2+ active versions from different threads, uses Claude Haiku to synthesize merged understanding, and detects contradictions
- Contradicted concepts stored with `{ text, contradicted: true, perspectives: [...] }` for audit trail
- All consolidated versions tagged with `source_thread_id = 'consolidation'`
- Graceful degradation: skips if ANTHROPIC_API_KEY not set, handles LLM parse failures

### Task 2: Decision Path Memory & Startup Wiring
- `decision-path-store.ts` — Converts commander-rated autonomous activities into 'lesson' type concepts
- Confidence derived from commander feedback: positive=0.8, negative=0.3, unrated=0.5
- `buildDecisionPathsFromRatedActivities()` scans last 24h of rated activities
- `index.ts` updated to call `startConsolidationJob()` during `initIronclawMemory()`

## Key files

### Created
- `backend/src/ironclaw/concept-consolidation.ts`
- `backend/src/ironclaw/decision-path-store.ts`

### Modified
- `backend/src/ironclaw/index.ts`

## Deviations

None.

## Self-Check: PASSED
- [x] concept-consolidation.ts exports startConsolidationJob, runConsolidation
- [x] Contains CONSOLIDATION_INTERVAL_MS = 6h
- [x] Contains claude-haiku-4-5-20251001 model reference
- [x] Contains contradicted handling
- [x] Contains sourceThreadId: 'consolidation'
- [x] decision-path-store.ts exports decisionPathStore
- [x] Contains conceptType: 'lesson'
- [x] Contains sourceThreadId: 'autonomous'
- [x] index.ts calls startConsolidationJob
- [x] tsc --noEmit passes
