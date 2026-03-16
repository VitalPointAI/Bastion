---
phase: 47-json-ld-semantic-brain-cop-fix
plan: 04
subsystem: database
tags: [json-ld, neo4j, migration, ontology, provenance, cco, prov-o, batch-processing, idempotent]

# Dependency graph
requires:
  - "47-01: JsonLdEntityBase, ACTOR_TYPE_TO_CCO_MAP, SOURCE_WEIGHTS, provenance-types, confidence-calculator"
provides:
  - "migrate-to-jsonld.ts: migrateActors, migrateRelationships, migrateTensions, migrateDecisions — batch JSON-LD migration functions"
  - "migration-runner.ts: CLI-runnable migration orchestrator with --dry-run and --verify flags"
affects:
  - "All existing Actor, Relationship, Tension, Decision Neo4j nodes — adds JSON-LD fields + migrationVersion"
  - 47-05-consumer-wiring

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Batched Cypher migration: LIMIT $batchSize in write query + while loop until totalMigrated >= totalUnmigrated"
    - "Idempotent migration guard: WHERE migrationVersion IS NULL skips already-migrated nodes"
    - "CASE expression built from ACTOR_TYPE_TO_CCO_MAP TypeScript map — single source of truth"
    - "coalesce() safe defaults: preserves existing field values, provides fallback for null"
    - "dotenv path resolution relative to __dirname for portable CLI execution"
    - "import.meta.url direct-invocation guard: supports both tsx runner and programmatic export"

key-files:
  created:
    - backend/src/graph/migration/migrate-to-jsonld.ts
    - backend/src/graph/migration/migration-runner.ts
  modified: []

key-decisions:
  - "Batch size default 500 chosen to avoid Neo4j write transaction timeouts — configurable per entity type via parameter"
  - "APOC used for attributes JSON blob promotion (apoc.convert.fromJsonMap) — APOC is already a hard dependency of the graph layer"
  - "Per-entity-type half-life defaults: Actor=180d, Relationship=180d, Tension=90d (volatile), Decision=365d (long-lived)"
  - "--verify flag runs post-migration node count check against migrationVersion=47 AND jsonldType IS NOT NULL"

# Metrics
duration: 4min
completed: 2026-03-16
---

# Phase 47 Plan 04: JSON-LD Migration Script Summary

**Batch Cypher migration script that rewrites all Actor, Relationship, Tension, Decision Neo4j nodes to JSON-LD format with PROV-O provenance, temporal validity, and CCO class type mapping — idempotent and runnable via `npx tsx`**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-16T13:53:08Z
- **Completed:** 2026-03-16T13:57:03Z
- **Tasks:** 2
- **Files created:** 2

## Accomplishments

- Created `migrate-to-jsonld.ts` exporting `migrateActors`, `migrateRelationships`, `migrateTensions`, `migrateDecisions`
- Each function processes nodes in batches of 500 via while loop until all nodes are migrated
- Idempotency via `WHERE migrationVersion IS NULL` — re-running skips already-migrated nodes
- Actor type mapped to CCO class URI via `buildActorTypeCaseExpr()` which generates Cypher CASE from `ACTOR_TYPE_TO_CCO_MAP`
- PROV-O defaults via `coalesce()`: `assertedBy='system:migration'`, `assertedVia='manual_entry'`, `derivedFrom='[]'`
- Temporal defaults: `validFrom` from `createdAt`, `validTo=null`, `halfLifeDays` per entity type (90-365 days)
- Actor attributes JSON blob promoted to flat properties (`attributes_affiliation`, `attributes_echelon`, `attributes_unitType`, `attributes_lat`, `attributes_lng`) via APOC
- All nodes marked with `migrationVersion = 47`
- Created `migration-runner.ts` CLI orchestrating all 4 migrations in sequence
- `--dry-run` flag: counts unmigrated nodes across all entity types without modifying
- `--verify` flag: post-migration check counts nodes with `migrationVersion=47 AND jsonldType IS NOT NULL`, exits 1 if incomplete
- `dotenv` loads `.env` from backend root via relative `__dirname` path
- `runMigration` programmatic export for test harness use

## Task Commits

Each task was committed atomically:

1. **Task 1: Create batch migration functions** - `246ec2f7` (feat)
2. **Task 2: Create migration runner CLI** - `57dade5d` (feat)

**Plan metadata:** (final commit — see below)

## Files Created/Modified

- `backend/src/graph/migration/migrate-to-jsonld.ts` - Batch migration functions for all 4 entity types
- `backend/src/graph/migration/migration-runner.ts` - CLI runner with --dry-run, --verify, progress logging

## Decisions Made

- Batch size default 500 prevents Neo4j write transaction timeouts; configurable as parameter to each function
- APOC `apoc.convert.fromJsonMap()` used for attributes JSON blob promotion — already a graph layer dependency
- Per-entity half-life defaults differentiated by volatility: Tension=90d, Actor=180d, Relationship=180d, Decision=365d
- `--verify` flag validates `migrationVersion=47 AND jsonldType IS NOT NULL` (not just version) to catch partial migrations
- Safety break: if batch returns 0 nodes but while loop hasn't finished, exits batch loop to prevent infinite loop

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

- Pre-existing TypeScript errors in test files (contradiction-detector.test.ts, actor-store.test.ts, resolution-service.test.ts) are out of scope for this plan — deferred to deferred-items.md as noted in Plan 47-01 SUMMARY.

## User Setup Required

Migration requires Neo4j connection. Set environment variables before running:
```bash
NEO4J_URI=bolt://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=<password>
```

Then run:
```bash
# Check what needs migrating
npx tsx backend/src/graph/migration/migration-runner.ts --dry-run

# Run migration
npx tsx backend/src/graph/migration/migration-runner.ts

# Verify complete
npx tsx backend/src/graph/migration/migration-runner.ts --verify
```

## Next Phase Readiness

- Migration script is ready to run on any Neo4j instance with existing RAFT data
- Plan 47-05 (consumer wiring) can now rely on all nodes having JSON-LD fields populated post-migration
- `--dry-run` output can be used to estimate migration duration before running on production

## Self-Check: PASSED

Both files exist on disk. Task commits 246ec2f7 and 57dade5d verified in git log. TypeScript compilation passes clean for migration files. No errors in `src/graph/migration/` path.

---
*Phase: 47-json-ld-semantic-brain-cop-fix*
*Completed: 2026-03-16*
