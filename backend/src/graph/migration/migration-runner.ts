/**
 * Migration Runner CLI
 *
 * Orchestrates the full JSON-LD migration of existing Neo4j graph data.
 * Runs all four entity type migrations in sequence with progress logging.
 *
 * Usage:
 *   npx tsx backend/src/graph/migration/migration-runner.ts
 *   npx tsx backend/src/graph/migration/migration-runner.ts --dry-run
 *   npx tsx backend/src/graph/migration/migration-runner.ts --verify
 *
 * Flags:
 *   --dry-run   Count unmigrated nodes without modifying anything
 *   --verify    After migration, verify all nodes have migrationVersion=47
 *
 * Requirements:
 *   NEO4J_URI, NEO4J_USER, NEO4J_PASSWORD environment variables must be set.
 *   Copy .env from backend root or set environment variables directly.
 */

import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

import { getNeo4jDriver, closeNeo4jDriver, executeReadQuery } from '../neo4j-client.js';
import {
  migrateActors,
  migrateRelationships,
  migrateTensions,
  migrateDecisions,
  type MigrationResult,
} from './migrate-to-jsonld.js';

// ============================================================================
// Environment setup
// ============================================================================

// Load .env from backend root (two levels up from src/graph/migration/)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const envPath = join(__dirname, '..', '..', '..', '.env');
config({ path: envPath });

// ============================================================================
// Dry-run counter
// ============================================================================

interface UnmigratedCounts {
  actors: number;
  relationships: number;
  tensions: number;
  decisions: number;
}

async function countUnmigrated(): Promise<UnmigratedCounts> {
  const [actorResult, relResult, tensionResult, decisionResult] = await Promise.all([
    executeReadQuery<{ count: number }>(
      'MATCH (a:Actor) WHERE a.migrationVersion IS NULL RETURN count(a) AS count'
    ),
    executeReadQuery<{ count: number }>(
      'MATCH (r:Relationship) WHERE r.migrationVersion IS NULL RETURN count(r) AS count'
    ),
    executeReadQuery<{ count: number }>(
      'MATCH (t:Tension) WHERE t.migrationVersion IS NULL RETURN count(t) AS count'
    ),
    executeReadQuery<{ count: number }>(
      'MATCH (d:Decision) WHERE d.migrationVersion IS NULL RETURN count(d) AS count'
    ),
  ]);

  return {
    actors: (actorResult.records[0]?.get('count') as unknown as number) ?? 0,
    relationships: (relResult.records[0]?.get('count') as unknown as number) ?? 0,
    tensions: (tensionResult.records[0]?.get('count') as unknown as number) ?? 0,
    decisions: (decisionResult.records[0]?.get('count') as unknown as number) ?? 0,
  };
}

// ============================================================================
// Post-migration verification
// ============================================================================

interface VerificationResult {
  entityType: string;
  totalNodes: number;
  migratedNodes: number;
  unmigrated: number;
  complete: boolean;
}

async function verifyMigration(): Promise<VerificationResult[]> {
  const entityTypes = [
    { label: 'Actor', entityType: 'Actor' },
    { label: 'Relationship', entityType: 'Relationship' },
    { label: 'Tension', entityType: 'Tension' },
    { label: 'Decision', entityType: 'Decision' },
  ];

  const results: VerificationResult[] = [];

  for (const { label, entityType } of entityTypes) {
    const [totalResult, migratedResult] = await Promise.all([
      executeReadQuery<{ count: number }>(
        `MATCH (n:${label}) RETURN count(n) AS count`
      ),
      executeReadQuery<{ count: number }>(
        `MATCH (n:${label}) WHERE n.migrationVersion = 47 AND n.jsonldType IS NOT NULL RETURN count(n) AS count`
      ),
    ]);

    const totalNodes = (totalResult.records[0]?.get('count') as unknown as number) ?? 0;
    const migratedNodes = (migratedResult.records[0]?.get('count') as unknown as number) ?? 0;
    const unmigrated = totalNodes - migratedNodes;

    results.push({
      entityType,
      totalNodes,
      migratedNodes,
      unmigrated,
      complete: unmigrated === 0,
    });
  }

  return results;
}

// ============================================================================
// Main entry point
// ============================================================================

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const isDryRun = args.includes('--dry-run');
  const shouldVerify = args.includes('--verify');

  const startTime = Date.now();
  console.log('='.repeat(60));
  console.log('BASTION JSON-LD Migration Runner');
  console.log('='.repeat(60));
  console.log(`Started: ${new Date().toISOString()}`);

  if (isDryRun) {
    console.log('Mode: DRY RUN (counting only — no modifications)');
  } else {
    console.log('Mode: MIGRATE (will write to Neo4j)');
  }
  console.log('');

  // Initialize Neo4j connection (lazy — this validates env vars)
  try {
    getNeo4jDriver();
    console.log('Neo4j driver initialized.');
  } catch (err) {
    console.error('Failed to initialize Neo4j driver:', err instanceof Error ? err.message : err);
    process.exit(1);
  }

  try {
    // ---- DRY RUN ----
    if (isDryRun) {
      console.log('Counting unmigrated nodes...');
      const counts = await countUnmigrated();
      const total = counts.actors + counts.relationships + counts.tensions + counts.decisions;

      console.log('');
      console.log('Unmigrated node counts:');
      console.log(`  Actors:        ${counts.actors}`);
      console.log(`  Relationships: ${counts.relationships}`);
      console.log(`  Tensions:      ${counts.tensions}`);
      console.log(`  Decisions:     ${counts.decisions}`);
      console.log(`  TOTAL:         ${total}`);
      console.log('');
      console.log('Dry run complete. Re-run without --dry-run to apply migration.');
      return;
    }

    // ---- FULL MIGRATION ----
    const results: MigrationResult[] = [];

    console.log('Running migrations...');
    console.log('');

    console.log('Step 1/4: Migrating Actors...');
    results.push(await migrateActors(500));

    console.log('Step 2/4: Migrating Relationships...');
    results.push(await migrateRelationships(500));

    console.log('Step 3/4: Migrating Tensions...');
    results.push(await migrateTensions(500));

    console.log('Step 4/4: Migrating Decisions...');
    results.push(await migrateDecisions(500));

    // Summary
    const totalMigrated = results.reduce((sum, r) => sum + r.totalMigrated, 0);
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

    console.log('');
    console.log('='.repeat(60));
    console.log('Migration Summary');
    console.log('='.repeat(60));
    for (const r of results) {
      console.log(`  ${r.entityType.padEnd(15)} ${r.totalMigrated} migrated (${r.batches} batch${r.batches === 1 ? '' : 'es'})`);
    }
    console.log(`  ${'TOTAL'.padEnd(15)} ${totalMigrated} nodes`);
    console.log(`  Duration: ${elapsed}s`);
    console.log('');

    // ---- VERIFY (if requested) ----
    if (shouldVerify) {
      console.log('Running post-migration verification...');
      const verifyResults = await verifyMigration();

      console.log('');
      console.log('Verification Results:');
      let allComplete = true;
      for (const v of verifyResults) {
        const status = v.complete ? 'COMPLETE' : `INCOMPLETE (${v.unmigrated} unmigrated)`;
        console.log(`  ${v.entityType.padEnd(15)} ${v.migratedNodes}/${v.totalNodes} — ${status}`);
        if (!v.complete) allComplete = false;
      }
      console.log('');

      if (allComplete) {
        console.log('Verification PASSED: all nodes have migrationVersion=47 and jsonldType set.');
      } else {
        console.error('Verification FAILED: some nodes were not migrated. Re-run migration to retry.');
        process.exit(1);
      }
    }

    console.log('Migration complete.');

  } catch (err) {
    console.error('');
    console.error('Migration failed with error:');
    console.error(err instanceof Error ? err.stack : err);
    process.exit(1);
  } finally {
    await closeNeo4jDriver();
  }
}

// Run if invoked directly via npx tsx or ts-node
const thisFile = fileURLToPath(import.meta.url);
const entryFile = process.argv[1];

// Support both direct execution and tsx runner
if (
  thisFile === entryFile ||
  entryFile?.endsWith('migration-runner.ts') ||
  entryFile?.endsWith('migration-runner.js')
) {
  main().catch((err) => {
    console.error('Unhandled error in migration runner:', err);
    process.exit(1);
  });
}

// Re-export main for programmatic use in tests
export { main as runMigration };
