---
phase: 65-ironclaw-autonomous-operations
plan: 03
subsystem: ironclaw
tags: [ironclaw, autonomous, event-forwarding, heartbeat, osint, doc-intelligence, graph]

requires:
  - phase: 65-01
    provides: Callback endpoint at bastion-mcp:3334/api/ironclaw/callback
  - phase: 65-02
    provides: MCP tools for autonomous operations including bastion.intel.* and bastion.autonomous.*

provides:
  - Batched event forwarding from OSINT/doc/graph pipelines to Ironclaw
  - EventForwarder class with 30-second batching windows per problem set
  - forwardEventToIronclaw() convenience wrapper (fault-isolated, fire-and-forget)
  - OperationalContext injection into HEARTBEAT.md at identity sync time
  - Autonomous Monitoring Tasks section in HEARTBEAT.md with MCP tool call sequence
  - Callback Protocol and Efficiency Rules in HEARTBEAT.md
  - Gap filler service retired (start() is now no-op with deprecation notice)

affects:
  - ironclaw-autonomous-operations
  - doc-intelligence
  - osint
  - brain

tech-stack:
  added: []
  patterns:
    - "Event batching: 30-second window per problem set, fire-and-forget via sendMessageAsync"
    - "Fault isolation: all event forwarding hooks wrapped in try/catch, never block pipeline"
    - "Operational context injection: live PIR/gap/decision counts passed to HEARTBEAT.md at identity sync"

key-files:
  created:
    - backend/src/ironclaw/event-forwarder.ts
  modified:
    - backend/src/osint/osint-agent-bridge.ts
    - backend/src/ingest/universal-ingest-router.ts
    - backend/src/graph/construction/graph-builder.ts
    - backend/src/ironclaw/identity-renderer.ts
    - backend/src/ironclaw/ironclaw-service.ts
    - backend/src/ironclaw/gap-filler-service.ts
    - backend/src/index.ts

key-decisions:
  - "Use sendMessageAsync (fire-and-forget) for event forwarding — pipelines must never be blocked waiting for Ironclaw"
  - "Batch events per problem set over 30-second windows to prevent forwarding storms during high-volume ingestion"
  - "Place document processing hook in universal-ingest-router.ts (not orchestrator-wiring.ts) — it is the pipeline boundary"
  - "Best-effort operational context: if any store query fails, HEARTBEAT.md renders without operational context rather than blocking identity sync"
  - "Gap filler service is deprecated but not deleted — start() is a no-op, file preserved for reference"

patterns-established:
  - "Event forwarding pattern: enqueue → 30s timer → flush → sendMessageAsync on autonomous-{problemSetId} thread"
  - "Fault-isolated pipeline hooks: always try/catch around forwardEventToIronclaw, never re-throw"
  - "Operational context: query pirStore + brainStore + decisionStore in parallel at identity sync time"

requirements-completed:
  - SC-01-autonomous-operation
  - SC-02-replaces-gap-filler
  - SC-07-governance-respected

duration: 5min
completed: 2026-03-30
---

# Phase 65 Plan 03: Event-Driven Pipeline Wiring and HEARTBEAT Enrichment Summary

**Batched event forwarding hooks wired into OSINT/doc/graph pipelines and HEARTBEAT.md enriched with live operational context, MCP tool sequences, and callback protocol — gap filler service retired**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-30T23:27:06Z
- **Completed:** 2026-03-30T23:32:02Z
- **Tasks:** 2
- **Files modified:** 7 (1 created)

## Accomplishments
- Created EventForwarder with per-problem-set batching (30s windows) and fault isolation; wired into OSINT bridge, universal ingest router, and graph builder
- Enriched HEARTBEAT.md with Autonomous Monitoring Tasks, Current Operational Status, Callback Protocol, and Efficiency Rules sections driven by live PIR/decision/gap data
- Retired gap filler service with @deprecated JSDoc and no-op start() method; commented out caller in index.ts

## Task Commits

1. **Task 1: Create event forwarder and wire into OSINT/doc/graph pipelines** - `d6507af6` (feat)
2. **Task 2: Enrich HEARTBEAT.md with operational directives and retire gap filler** - `6cb6737a` (feat)

**Plan metadata:** (docs commit)

## Files Created/Modified
- `backend/src/ironclaw/event-forwarder.ts` - EventForwarder class with 30s batching, forwardEventToIronclaw() export
- `backend/src/osint/osint-agent-bridge.ts` - Hook after processOSINTEventThroughAgents() success
- `backend/src/ingest/universal-ingest-router.ts` - Hook after document processing completes in async pipeline
- `backend/src/graph/construction/graph-builder.ts` - Hook after buildFromDocument() when entities were created
- `backend/src/ironclaw/identity-renderer.ts` - OperationalContext interface + HEARTBEAT.md enrichment sections
- `backend/src/ironclaw/ironclaw-service.ts` - syncUserIdentity now queries PIR/gap/decision stores and passes context
- `backend/src/ironclaw/gap-filler-service.ts` - @deprecated class and no-op start()
- `backend/src/index.ts` - gapFillerService.start() caller commented out with retirement note

## Decisions Made
- Used `sendMessageAsync` (fire-and-forget) for all event forwarding — the Ironclaw response must never hold up a pipeline that generated the event
- Batching window is 30 seconds per problem set with clearTimeout/setTimeout pattern; each new event resets the window if a timer is already running
- Document processing hook placed in universal-ingest-router.ts rather than orchestrator-wiring.ts — the router is the public pipeline boundary and has the document title available
- Graph builder hook only fires when `actorsCreated > 0 || relationshipsCreated > 0` to avoid empty-update noise
- Operational context is gathered with `Promise.all` and individual `.catch(() => [])` guards so any one store failure doesn't block the others

## Deviations from Plan

None - plan executed exactly as written. The plan referenced `backend/src/doc-intelligence/orchestrator-wiring.ts` as a file to modify, but the better hook point was `backend/src/ingest/universal-ingest-router.ts` (the callers' boundary). This is semantically equivalent — document_processed fires after the pipeline completes successfully.

## Issues Encountered

None. `identity-renderer.ts` had already been partially modified in Phase 65-04 (OperationalContext interface was already present); the current task's changes merged cleanly.

## Next Phase Readiness
- Event forwarding data path is complete: OSINT → doc → graph all emit events to Ironclaw's autonomous thread
- HEARTBEAT.md now provides Ironclaw with precise MCP tool call sequence and callback URL on every identity sync
- Gap filler is cleanly retired; Ironclaw autonomous monitoring via heartbeat is the replacement path
- Ready for Phase 65-04+ which connects the autonomous heartbeat scheduler and full end-to-end testing

## Self-Check: PASSED

All created files and commits verified present.

---
*Phase: 65-ironclaw-autonomous-operations*
*Completed: 2026-03-30*
