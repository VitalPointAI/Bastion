---
phase: 63-unified-osint-agent-ingestion
plan: "02"
subsystem: osint
tags: [osint, agent-bridge, feed-poller, gap-filler, cutover, deprecation]
dependency_graph:
  requires: [63-01]
  provides: [OSINT-63-03, OSINT-63-06]
  affects: [backend/src/osint/feed-poller.ts, backend/src/ironclaw/gap-filler-service.ts, backend/src/osint/osint-entity-extractor.ts]
tech_stack:
  added: []
  patterns: [agent-bridge-cutover, synthetic-feed-config, deprecation-annotation]
key_files:
  created: []
  modified:
    - backend/src/osint/feed-poller.ts
    - backend/src/ironclaw/gap-filler-service.ts
    - backend/src/osint/osint-entity-extractor.ts
    - backend/src/scripts/reextract-osint-actors.ts
decisions:
  - "tensionsCreated normalized to 0 in gap-filler because agent bridge handles tensions internally via specialist agents, not as a separate return value"
  - "Synthetic OSINTFeedConfig cast as unknown as OSINTFeedConfig to satisfy TypeScript without forcing full object construction"
metrics:
  duration: 208s
  completed_date: "2026-03-29"
  tasks_completed: 2
  files_modified: 4
---

# Phase 63 Plan 02: Caller Cutover to Agent Bridge Summary

Cut over all runtime OSINT callers from standalone extractAndSyncToGraph to the new processOSINTEventThroughAgents agent bridge, routing feed-poller and gap-filler events through the full 12-specialist doc-intelligence pipeline.

## What Was Built

### Task 1: Migrate feed-poller and gap-filler to use agent bridge

**feed-poller.ts:**
- Replaced `import { extractAndSyncToGraph } from './osint-entity-extractor.js'` with `import { processOSINTEventThroughAgents } from './osint-agent-bridge.js'`
- Updated the `enqueueLLMTask` callback to call `processOSINTEventThroughAgents(storedEvent, feed)` with the live feed config in scope
- Added meaningful error logging: `[FeedPoller] Agent pipeline failed for "..."` instead of silently swallowing errors
- All other code unchanged: `syncOSINTEventToGraph`, `updateOSINTCOPLayer`, `notifyCOPChange`, `runPostSyncResolution` retained as-is

**gap-filler-service.ts:**
- Replaced `import { extractAndSyncToGraph } from '../osint/osint-entity-extractor.js'` with `import { processOSINTEventThroughAgents } from '../osint/osint-agent-bridge.js'`
- Added `import type { OSINTFeedConfig } from '../jpp/osint-feed-store.js'`
- Constructs a synthetic `OSINTFeedConfig` with `problemSetId`, `sourceName: 'Ironclaw Gap Filler'`, `sourceType: 'research'`, `id: 'gap-filler-{problemSetId}'`
- Calls `processOSINTEventThroughAgents(event, syntheticFeed)` with the constructed config
- Normalizes `tensionsCreated: 0` since the agent bridge handles tensions internally via specialist agents

### Task 2: Deprecate osint-entity-extractor and update reextract script

**osint-entity-extractor.ts:**
- Added module-level deprecation banner after header comment referencing Phase 63 and osint-agent-bridge.ts as the replacement
- Added `@deprecated` JSDoc tag to the `extractAndSyncToGraph` function signature
- File retained — one-off admin reextract script still depends on it

**reextract-osint-actors.ts:**
- Added comment above the import explaining deprecation and pointing to `processOSINTEventThroughAgents` for future re-extraction

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] TypeScript errors in gap-filler synthetic feed cast and tensionsCreated**
- **Found during:** Task 1 verification (tsc --noEmit)
- **Issue 1:** `Partial<OSINTFeedConfig> as OSINTFeedConfig` cast rejected by TypeScript because neither type sufficiently overlaps — required `as unknown as OSINTFeedConfig`
- **Issue 2:** `processOSINTEventThroughAgents` returns `{ actorsCreated, relationshipsCreated }` but `GapFillResult` interface and message bus payload both reference `tensionsCreated`
- **Fix:** Changed cast to `as unknown as OSINTFeedConfig`. Destructured bridge result and added `tensionsCreated: 0` to normalize the shape — agent bridge processes tensions via ThreatAnalyst/ConflictMapper specialist agents internally, not exposed in return value
- **Files modified:** `backend/src/ironclaw/gap-filler-service.ts`
- **Commit:** 94195112

## Verification Results

1. `npx tsc --noEmit` — exit 0, no errors
2. `grep -r "from.*osint-entity-extractor" backend/src/ | grep -v test | grep -v scripts | grep -v "osint-entity-extractor.ts"` — returns empty (no runtime callers)
3. Both `feed-poller.ts` and `gap-filler-service.ts` contain `processOSINTEventThroughAgents` in import and callsite

## Self-Check: PASSED

Files verified to exist:
- backend/src/osint/feed-poller.ts — FOUND
- backend/src/ironclaw/gap-filler-service.ts — FOUND
- backend/src/osint/osint-entity-extractor.ts — FOUND
- backend/src/scripts/reextract-osint-actors.ts — FOUND

Commits verified:
- 94195112 — feat(63-02): migrate feed-poller and gap-filler to use agent bridge
- b4918875 — chore(63-02): deprecate osint-entity-extractor and annotate reextract script
