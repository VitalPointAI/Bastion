/**
 * JSON-LD Migration Script — Batch Migration Functions
 *
 * Rewrites all existing Actor, Relationship, Tension, Decision nodes from flat
 * Neo4j properties to JSON-LD native format with provenance and temporal fields.
 *
 * Design principles:
 * - Idempotent: Only touches nodes WHERE migrationVersion IS NULL
 * - Batched: Processes 500 nodes per transaction to avoid Neo4j timeouts
 * - Progressive: Tracks progress via migrationVersion = 47 on each node
 * - Safe defaults: Uses coalesce() to preserve existing data where present
 *
 * Run via: npx tsx backend/src/graph/migration/migration-runner.ts
 */

import { ACTOR_TYPE_TO_CCO_MAP } from '../raft/types.js';
import { SOURCE_WEIGHTS } from '../confidence-calculator.js';
import { executeWriteQuery, executeReadQuery } from '../neo4j-client.js';

// Migration version — bump if schema changes again
const MIGRATION_VERSION = 47;

// Default JSON-LD context URL (bundled file used at runtime, URL for interop signaling)
const JSONLD_CONTEXT = 'https://bastion.vitalpoint.ai/ontology/context.jsonld';

// Default source weight for migrated nodes (conservative for legacy data)
const MIGRATION_SOURCE_WEIGHT = SOURCE_WEIGHTS['manual_entry'] ?? 0.75;

// ============================================================================
// Type for migration results
// ============================================================================

export interface MigrationResult {
  entityType: string;
  totalUnmigrated: number;
  totalMigrated: number;
  batches: number;
}

// ============================================================================
// Actor Migration
// ============================================================================

/**
 * Migrate all Actor nodes to JSON-LD format.
 *
 * For each unmigrated Actor:
 * - Maps type field to CCO class URI via ACTOR_TYPE_TO_CCO_MAP
 * - Sets JSON-LD context reference
 * - Applies PROV-O provenance defaults (assertedBy, assertedVia, derivedFrom)
 * - Applies temporal validity defaults (validFrom from createdAt, no expiry)
 * - Sets confidence defaults (conservative 0.75 for legacy data)
 * - Promotes attributes JSON blob to queryable flat properties
 * - Marks with migrationVersion = 47
 *
 * @param batchSize - Nodes per transaction (default: 500)
 */
export async function migrateActors(batchSize = 500): Promise<MigrationResult> {
  // Count unmigrated actors
  const countResult = await executeReadQuery<{ count: number }>(
    'MATCH (a:Actor) WHERE a.migrationVersion IS NULL RETURN count(a) AS count'
  );
  const totalUnmigrated = (countResult.records[0]?.get('count') as unknown as number) ?? 0;

  if (totalUnmigrated === 0) {
    console.log('  Actors: all already migrated, skipping');
    return { entityType: 'Actor', totalUnmigrated: 0, totalMigrated: 0, batches: 0 };
  }

  console.log(`  Actors: ${totalUnmigrated} nodes to migrate`);

  let totalMigrated = 0;
  let batch = 0;

  // Build CASE expression for type mapping
  const typeCaseExpr = buildActorTypeCaseExpr();

  while (totalMigrated < totalUnmigrated) {
    batch++;

    const result = await executeWriteQuery<{ migratedCount: number }>(
      `MATCH (a:Actor)
       WHERE a.migrationVersion IS NULL
       WITH a LIMIT $batchSize
       SET
         a.jsonldType = ${typeCaseExpr},
         a.jsonldContext = $jsonldContext,
         a.assertedBy = coalesce(a.assertedBy, 'system:migration'),
         a.assertedVia = coalesce(a.assertedVia, 'manual_entry'),
         a.derivedFrom = coalesce(a.derivedFrom, '[]'),
         a.confidence = coalesce(a.confidence, 0.75),
         a.sourceWeight = $sourceWeight,
         a.validFrom = coalesce(a.validFrom, a.createdAt),
         a.validTo = null,
         a.halfLifeDays = 180,
         a.attributes_affiliation = CASE
           WHEN a.attributes IS NOT NULL
           THEN apoc.convert.fromJsonMap(a.attributes).affiliation
           ELSE null
         END,
         a.attributes_echelon = CASE
           WHEN a.attributes IS NOT NULL
           THEN apoc.convert.fromJsonMap(a.attributes).echelon
           ELSE null
         END,
         a.attributes_unitType = CASE
           WHEN a.attributes IS NOT NULL
           THEN apoc.convert.fromJsonMap(a.attributes).unitType
           ELSE null
         END,
         a.attributes_lat = CASE
           WHEN a.attributes IS NOT NULL
           THEN toFloat(apoc.convert.fromJsonMap(a.attributes).lat)
           ELSE null
         END,
         a.attributes_lng = CASE
           WHEN a.attributes IS NOT NULL
           THEN toFloat(apoc.convert.fromJsonMap(a.attributes).lng)
           ELSE null
         END,
         a.migrationVersion = $migrationVersion
       RETURN count(a) AS migratedCount`,
      {
        batchSize,
        jsonldContext: JSONLD_CONTEXT,
        sourceWeight: MIGRATION_SOURCE_WEIGHT,
        migrationVersion: MIGRATION_VERSION,
      }
    );

    const batchCount = (result.records[0]?.get('migratedCount') as unknown as number) ?? 0;
    totalMigrated += batchCount;
    console.log(`    Batch ${batch}: ${batchCount} actors migrated (${totalMigrated}/${totalUnmigrated})`);

    // Safety: if batch returned 0 but we haven't finished, something is wrong
    if (batchCount === 0) break;
  }

  return { entityType: 'Actor', totalUnmigrated, totalMigrated, batches: batch };
}

// ============================================================================
// Relationship Migration
// ============================================================================

/**
 * Migrate all Relationship nodes to JSON-LD format.
 *
 * jsonldType = 'cco:ActOfRelating' (CCO class for relationships between entities)
 *
 * @param batchSize - Nodes per transaction (default: 500)
 */
export async function migrateRelationships(batchSize = 500): Promise<MigrationResult> {
  const countResult = await executeReadQuery<{ count: number }>(
    'MATCH (r:Relationship) WHERE r.migrationVersion IS NULL RETURN count(r) AS count'
  );
  const totalUnmigrated = (countResult.records[0]?.get('count') as unknown as number) ?? 0;

  if (totalUnmigrated === 0) {
    console.log('  Relationships: all already migrated, skipping');
    return { entityType: 'Relationship', totalUnmigrated: 0, totalMigrated: 0, batches: 0 };
  }

  console.log(`  Relationships: ${totalUnmigrated} nodes to migrate`);

  let totalMigrated = 0;
  let batch = 0;

  while (totalMigrated < totalUnmigrated) {
    batch++;

    const result = await executeWriteQuery<{ migratedCount: number }>(
      `MATCH (r:Relationship)
       WHERE r.migrationVersion IS NULL
       WITH r LIMIT $batchSize
       SET
         r.jsonldType = 'cco:ActOfRelating',
         r.jsonldContext = $jsonldContext,
         r.assertedBy = coalesce(r.assertedBy, 'system:migration'),
         r.assertedVia = coalesce(r.assertedVia, 'manual_entry'),
         r.derivedFrom = coalesce(r.derivedFrom, '[]'),
         r.confidence = coalesce(r.confidence, 0.75),
         r.sourceWeight = $sourceWeight,
         r.validFrom = coalesce(r.validFrom, r.createdAt),
         r.validTo = null,
         r.halfLifeDays = 180,
         r.migrationVersion = $migrationVersion
       RETURN count(r) AS migratedCount`,
      {
        batchSize,
        jsonldContext: JSONLD_CONTEXT,
        sourceWeight: MIGRATION_SOURCE_WEIGHT,
        migrationVersion: MIGRATION_VERSION,
      }
    );

    const batchCount = (result.records[0]?.get('migratedCount') as unknown as number) ?? 0;
    totalMigrated += batchCount;
    console.log(`    Batch ${batch}: ${batchCount} relationships migrated (${totalMigrated}/${totalUnmigrated})`);

    if (batchCount === 0) break;
  }

  return { entityType: 'Relationship', totalUnmigrated, totalMigrated, batches: batch };
}

// ============================================================================
// Tension Migration
// ============================================================================

/**
 * Migrate all Tension nodes to JSON-LD format.
 *
 * jsonldType = 'cco:InformationBearingEntity' (tensions are propositions about
 * the operational environment — information-bearing in the CCO sense)
 *
 * @param batchSize - Nodes per transaction (default: 500)
 */
export async function migrateTensions(batchSize = 500): Promise<MigrationResult> {
  const countResult = await executeReadQuery<{ count: number }>(
    'MATCH (t:Tension) WHERE t.migrationVersion IS NULL RETURN count(t) AS count'
  );
  const totalUnmigrated = (countResult.records[0]?.get('count') as unknown as number) ?? 0;

  if (totalUnmigrated === 0) {
    console.log('  Tensions: all already migrated, skipping');
    return { entityType: 'Tension', totalUnmigrated: 0, totalMigrated: 0, batches: 0 };
  }

  console.log(`  Tensions: ${totalUnmigrated} nodes to migrate`);

  let totalMigrated = 0;
  let batch = 0;

  while (totalMigrated < totalUnmigrated) {
    batch++;

    const result = await executeWriteQuery<{ migratedCount: number }>(
      `MATCH (t:Tension)
       WHERE t.migrationVersion IS NULL
       WITH t LIMIT $batchSize
       SET
         t.jsonldType = 'cco:InformationBearingEntity',
         t.jsonldContext = $jsonldContext,
         t.assertedBy = coalesce(t.assertedBy, 'system:migration'),
         t.assertedVia = coalesce(t.assertedVia, 'manual_entry'),
         t.derivedFrom = coalesce(t.derivedFrom, '[]'),
         t.confidence = coalesce(t.confidence, 0.75),
         t.sourceWeight = $sourceWeight,
         t.validFrom = coalesce(t.validFrom, t.createdAt),
         t.validTo = null,
         t.halfLifeDays = 90,
         t.migrationVersion = $migrationVersion
       RETURN count(t) AS migratedCount`,
      {
        batchSize,
        jsonldContext: JSONLD_CONTEXT,
        sourceWeight: MIGRATION_SOURCE_WEIGHT,
        migrationVersion: MIGRATION_VERSION,
      }
    );

    const batchCount = (result.records[0]?.get('migratedCount') as unknown as number) ?? 0;
    totalMigrated += batchCount;
    console.log(`    Batch ${batch}: ${batchCount} tensions migrated (${totalMigrated}/${totalUnmigrated})`);

    if (batchCount === 0) break;
  }

  return { entityType: 'Tension', totalUnmigrated, totalMigrated, batches: batch };
}

// ============================================================================
// Decision Migration
// ============================================================================

/**
 * Migrate all Decision nodes to JSON-LD format.
 *
 * jsonldType = 'cco:ActOfDecisionMaking' (CCO class for decision acts)
 *
 * @param batchSize - Nodes per transaction (default: 500)
 */
export async function migrateDecisions(batchSize = 500): Promise<MigrationResult> {
  const countResult = await executeReadQuery<{ count: number }>(
    'MATCH (d:Decision) WHERE d.migrationVersion IS NULL RETURN count(d) AS count'
  );
  const totalUnmigrated = (countResult.records[0]?.get('count') as unknown as number) ?? 0;

  if (totalUnmigrated === 0) {
    console.log('  Decisions: all already migrated, skipping');
    return { entityType: 'Decision', totalUnmigrated: 0, totalMigrated: 0, batches: 0 };
  }

  console.log(`  Decisions: ${totalUnmigrated} nodes to migrate`);

  let totalMigrated = 0;
  let batch = 0;

  while (totalMigrated < totalUnmigrated) {
    batch++;

    const result = await executeWriteQuery<{ migratedCount: number }>(
      `MATCH (d:Decision)
       WHERE d.migrationVersion IS NULL
       WITH d LIMIT $batchSize
       SET
         d.jsonldType = 'cco:ActOfDecisionMaking',
         d.jsonldContext = $jsonldContext,
         d.assertedBy = coalesce(d.assertedBy, 'system:migration'),
         d.assertedVia = coalesce(d.assertedVia, 'manual_entry'),
         d.derivedFrom = coalesce(d.derivedFrom, '[]'),
         d.confidence = coalesce(d.confidence, 0.75),
         d.sourceWeight = $sourceWeight,
         d.validFrom = coalesce(d.validFrom, d.createdAt),
         d.validTo = null,
         d.halfLifeDays = 365,
         d.migrationVersion = $migrationVersion
       RETURN count(d) AS migratedCount`,
      {
        batchSize,
        jsonldContext: JSONLD_CONTEXT,
        sourceWeight: MIGRATION_SOURCE_WEIGHT,
        migrationVersion: MIGRATION_VERSION,
      }
    );

    const batchCount = (result.records[0]?.get('migratedCount') as unknown as number) ?? 0;
    totalMigrated += batchCount;
    console.log(`    Batch ${batch}: ${batchCount} decisions migrated (${totalMigrated}/${totalUnmigrated})`);

    if (batchCount === 0) break;
  }

  return { entityType: 'Decision', totalUnmigrated, totalMigrated, batches: batch };
}

// ============================================================================
// Internal helpers
// ============================================================================

/**
 * Build a Cypher CASE expression that maps Actor.type to CCO class URI.
 * Uses ACTOR_TYPE_TO_CCO_MAP as the source of truth.
 */
function buildActorTypeCaseExpr(): string {
  const cases = Object.entries(ACTOR_TYPE_TO_CCO_MAP)
    .filter(([key]) => key !== 'default')
    .map(([actorType, ccoUri]) => `WHEN a.type = '${actorType}' THEN '${ccoUri}'`)
    .join('\n           ');

  const defaultUri = ACTOR_TYPE_TO_CCO_MAP['default'] ?? 'cco:Agent';

  return `CASE
           ${cases}
           ELSE '${defaultUri}'
         END`;
}
