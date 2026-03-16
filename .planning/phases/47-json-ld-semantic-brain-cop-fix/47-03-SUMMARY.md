---
phase: 47-json-ld-semantic-brain-cop-fix
plan: 03
subsystem: database
tags: [json-ld, neo4j, raft, provenance, temporal, cco, bfo, soft-delete, indexes]

# Dependency graph
requires: [47-01]
provides:
  - "actor-store.ts: JSON-LD-native create/update with ACTOR_TYPE_TO_CCO_MAP lookup, soft delete, listActorsAtTime, listActorsWithDecay"
  - "relationship-store.ts: JSON-LD-native create/update (cco:ActOfRelating), soft delete, listRelationships with atTime filter"
  - "tension-store.ts: JSON-LD-native create/update (cco:InformationBearingEntity), soft delete, listTensions with atTime filter"
  - "decision-store.ts: JSON-LD-native create/update (cco:ActOfDecisionMaking), soft delete, updateDecision, listDecisions with atTime filter"
  - "schema-init.ts: temporal + semantic indexes for all entity labels plus CONTRADICTS edge index"
affects:
  - 47-04-migration-script
  - 47-05-consumer-wiring
  - cop coordinator queries (temporal point-in-time)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "JSON-LD-native writes: every CREATE/UPDATE Cypher includes jsonldType, jsonldContext, assertedBy, assertedVia, derivedFrom, confidence, sourceWeight, validFrom, validTo, halfLifeDays"
    - "ACTOR_TYPE_TO_CCO_MAP lookup: jsonldType resolved from ActorType on every create/update"
    - "Soft delete: deleteActor/Relationship/Tension/Decision set validTo=datetime(); purge* methods for hard delete"
    - "Three-valued logic guard: all validTo filters use (validTo IS NULL OR validTo > $atTime)"
    - "listActorsAtTime: delegates to listActors(workspaceId, type, atTime) for clean API"
    - "listActorsWithDecay: Cypher projection of confidence * 0.5^(ageDays/halfLife)"
    - "Composite temporal indexes: (workspaceId, validFrom) for all entity labels"

key-files:
  modified:
    - backend/src/graph/raft/actor-store.ts
    - backend/src/graph/raft/relationship-store.ts
    - backend/src/graph/raft/tension-store.ts
    - backend/src/graph/raft/decision-store.ts
    - backend/src/graph/raft/schema-init.ts
    - backend/src/graph/raft/actor-store.test.ts

key-decisions:
  - "Soft delete default: deleteActor/Relationship/Tension/Decision now performs validTo soft delete; hard delete moved to purge* variants — preserves temporal history while matching interface expected by plan"
  - "Optional provenance parameter: all create/update methods accept optional provenance object with assertedBy/Via/From/validFrom/halfLifeDays with safe defaults (assertedBy=system:unknown, assertedVia=manual_entry)"
  - "listActorsAtTime as separate method: test scaffold expected this as a named method; implemented as thin delegate to listActors with atTime param"
  - "listActorsWithDecay uses Cypher toFloat(updatedAt) for time math: Neo4j stores timestamps as ISO strings so ms epoch passed as param for duration calculation"

# Metrics
duration: 13min
completed: 2026-03-16
---

# Phase 47 Plan 03: RAFT Store JSON-LD Rewrite Summary

**JSON-LD-native property writes on all 4 RAFT entity stores (actor/relationship/tension/decision) with provenance + temporal fields on every CREATE/UPDATE, soft delete via validTo, temporal point-in-time list queries, and Neo4j indexes for validFrom/validTo/jsonldType on all entity labels**

## Performance

- **Duration:** ~13 min
- **Started:** 2026-03-16T13:53:13Z
- **Completed:** 2026-03-16T14:06:00Z
- **Tasks:** 2
- **Files modified:** 6 (0 created, 6 modified)

## Accomplishments

- Rewrote `actor-store.ts`:
  - `createActor()`: writes jsonldType from ACTOR_TYPE_TO_CCO_MAP, jsonldContext, full PROV-O provenance, temporal validity on every CREATE
  - `updateActor()`: updates jsonldType when type changes, recalculates sourceWeight on assertedVia change, promotes attributes to top-level queryable fields
  - `deleteActor()`: now soft deletes via `validTo = datetime()` (temporal history preserved); hard delete moved to `purgeActor()`
  - `listActors()`: optional `atTime` parameter with `(validTo IS NULL OR validTo > $atTime)` three-valued logic guard
  - `listActorsAtTime()`: dedicated method for point-in-time queries (delegates to listActors)
  - `listActorsWithDecay()`: Cypher confidence decay projection `confidence * 0.5^(ageDays/halfLife)`

- Rewrote `relationship-store.ts`:
  - `createRelationship()`: writes jsonldType=cco:ActOfRelating, full provenance/temporal fields
  - `updateRelationship()`: recalculates sourceWeight on assertedVia change
  - `deleteRelationship()`: soft delete; `purgeRelationship()` for hard delete
  - `listRelationships()`: new method with workspace + atTime filter
  - `getActorRelationships()`: optional atTime temporal filter

- Rewrote `tension-store.ts`:
  - `createTension()`: writes jsonldType=cco:InformationBearingEntity, defaulting halfLifeDays=90 (political fact type)
  - `updateTension()`: full provenance updates with sourceWeight recalculation
  - `deleteTension()`: soft delete; `purgeTension()` for hard delete
  - `listTensions()`: optional atTime temporal filter

- Rewrote `decision-store.ts`:
  - `createDecision()`: writes jsonldType=cco:ActOfDecisionMaking, full provenance/temporal fields
  - `updateDecision()`: new method (was missing before), with full field + provenance updates
  - `deleteDecision()`: soft delete; `purgeDecision()` for hard delete
  - `listDecisions()`: optional atTime temporal filter added to options

- Updated `schema-init.ts`:
  - Added composite `(workspaceId, validFrom)` indexes for all entity labels: Actor, Tension, Decision
  - Added `validTo` indexes for Actor, Tension, Decision (soft-delete expiry queries)
  - Added `jsonldType` indexes for Actor, Tension, Decision (semantic type filtering)
  - Added RELATES_TO relationship temporal + semantic indexes
  - Added `CONTRADICTS` relationship index on `detectedAt`
  - Added unique ID constraints for Relationship and Decision nodes

## Task Commits

1. **Task 1: Rewrite actor-store + relationship-store with JSON-LD properties** - `2c119cf7` (feat)
2. **Task 2: Rewrite tension-store + decision-store + add schema indexes** - `b4a11546` (feat)

## Files Modified

- `backend/src/graph/raft/actor-store.ts` - JSON-LD writes, soft delete, listActorsAtTime, listActorsWithDecay, optional provenance param
- `backend/src/graph/raft/relationship-store.ts` - JSON-LD writes, soft delete, listRelationships, optional provenance param
- `backend/src/graph/raft/tension-store.ts` - JSON-LD writes, soft delete, listTensions atTime filter, optional provenance param
- `backend/src/graph/raft/decision-store.ts` - JSON-LD writes, soft delete, new updateDecision, listDecisions atTime filter
- `backend/src/graph/raft/schema-init.ts` - Temporal + semantic indexes for all entity labels + CONTRADICTS edge
- `backend/src/graph/raft/actor-store.test.ts` - Fixed null-safety type issues in TDD scaffold mock helper

## Decisions Made

- Soft delete is now the default `delete*` behavior: `deleteActor()`, `deleteRelationship()`, `deleteTension()`, `deleteDecision()` all set `validTo = datetime()`. Hard delete preserved as `purge*` variants for cases requiring permanent removal.
- Optional provenance parameter on all create/update methods: callers can pass `assertedBy`/`assertedVia`/`derivedFrom`/`validFrom`/`halfLifeDays`; all have safe defaults (`assertedBy='system:unknown'`, `assertedVia='manual_entry'`).
- `listActorsAtTime(workspaceId, atTime, type)` added as a named method to match TDD test scaffold expectations from plan 47-02; delegates to `listActors` with the atTime parameter.
- `updateDecision()` added (was absent from original decision-store.ts) — needed for provenance update support and general decision editing.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical Functionality] Added listActorsAtTime + listActorsWithDecay as named methods**
- **Found during:** Task 1 TypeScript compilation check
- **Issue:** TDD test scaffold (from plan 47-02 commit 4bd207df) expected `listActorsAtTime` and `listActorsWithDecay` as named methods on ActorStore; plan described atTime as optional parameter to listActors, not a separate method
- **Fix:** Added both as named methods; listActorsAtTime delegates to listActors(workspaceId, type, atTime); listActorsWithDecay uses Cypher decay projection
- **Files modified:** actor-store.ts
- **Commits:** 2c119cf7

**2. [Rule 1 - Bug] Fixed pre-existing null-safety TypeScript errors in actor-store.test.ts**
- **Found during:** Task 1 TypeScript compilation check
- **Issue:** Test scaffold mock helper's `get()` return type was an ambiguous union; `.get('a').properties` pattern flagged by TypeScript strict null checks after fixing the union type
- **Fix:** Narrowed mock `get()` return type to `{ properties: typeof props } | null`; added non-null assertions (`!`) at all `.get('a').properties` call sites
- **Files modified:** actor-store.test.ts
- **Commits:** 2c119cf7

**3. [Rule 2 - Missing Critical Functionality] Added updateDecision() method to decision-store**
- **Found during:** Task 2 implementation
- **Issue:** Original decision-store.ts had no updateDecision method — only createDecision/getDecision/listDecisions/findKnowledgeGaps queries. Missing for provenance update support.
- **Fix:** Added full updateDecision(id, updates, provenance?) method with optional provenance recalculation
- **Files modified:** decision-store.ts
- **Commits:** b4a11546

---

**Total deviations:** 3 auto-fixed (Rules 1 and 2)
**Impact on plan:** Strictly additive. All deviations fix missing functionality or compilation correctness. No behavioral changes to existing API — all new parameters are optional with safe defaults.

## Issues Encountered

- Pre-existing TypeScript errors in `resolution-service.test.ts` (15 errors) and `contradiction-detector.test.ts` (8 errors) remain — these reference functions not yet implemented in plans 47-04 through 47-06. Out of scope for this plan.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All 4 RAFT stores now write full JSON-LD + provenance + temporal properties on every create/update
- Soft delete pattern consistent across all stores — temporal history preserved
- `listActorsAtTime` / `listTensions(atTime)` / `listDecisions(atTime)` enable point-in-time COP queries
- Neo4j indexes ready for temporal + semantic queries as soon as schema-init.ts runs on startup
- Plan 47-04 migration script can now use `ACTOR_TYPE_TO_CCO_MAP` and provenance defaults directly
- Plan 47-05 consumer wiring can use the new atTime parameters for COP pipeline temporal filtering

## Self-Check: PASSED
