/**
 * One-time re-extraction of OSINT events with tightened entity extraction prompt.
 *
 * Steps:
 * 1. Soft-delete all existing OSINT-sourced orphan actors (no relationships)
 * 2. Load all OSINT events from PostgreSQL
 * 3. Re-run LLM entity extraction on each with the new prompt
 * 4. New actors created via MERGE on canonical names
 *
 * Run inside the backend container after deploy:
 *   node dist/scripts/reextract-osint-actors.js [--batch-size=50] [--dry-run]
 *
 * Or locally via tsx:
 *   npx tsx backend/src/scripts/reextract-osint-actors.ts --dry-run
 */

import { executeWriteQuery, executeReadQuery } from '../graph/neo4j-client.js';
import { extractAndSyncToGraph } from '../osint/osint-entity-extractor.js';
import { osintEventStore } from '../graph/osint/event-store.js';

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const BATCH_SIZE = parseInt(
  args.find(a => a.startsWith('--batch-size='))?.split('=')[1] ?? '50',
  10,
);

async function main() {
  // Need database pool — dynamic import to allow env to be set up
  const { getPool } = await import('../lib/database.js');

  console.log(`[Re-Extract] Starting OSINT re-extraction (dryRun=${DRY_RUN}, batchSize=${BATCH_SIZE})`);

  // Pre-stats
  const preStats = await executeReadQuery(
    `MATCH (a:Actor) WHERE a.validTo IS NULL RETURN a.type as type, count(*) as cnt ORDER BY cnt DESC`,
  );
  console.log('[Re-Extract] Current active actors by type:');
  preStats.records.forEach(r =>
    console.log(`  ${r.get('type')}: ${(r.get('cnt') as { toNumber(): number }).toNumber()}`),
  );

  // Step 1: Soft-delete orphan OSINT actors (no relationships)
  if (!DRY_RUN) {
    const now = new Date().toISOString();
    const orphanResult = await executeWriteQuery(
      `MATCH (a:Actor)
       WHERE a.assertedVia = 'osint'
         AND a.validTo IS NULL
         AND NOT (a)-[:RELATES_TO]-()
       SET a.validTo = $now, a.updatedAt = $now
       RETURN count(a) as deleted`,
      { now },
    );
    const deleted = (orphanResult.records[0].get('deleted') as { toNumber(): number }).toNumber();
    console.log(`[Re-Extract] Soft-deleted ${deleted} orphan OSINT actors`);
  } else {
    const orphanCount = await executeReadQuery(
      `MATCH (a:Actor)
       WHERE a.assertedVia = 'osint'
         AND a.validTo IS NULL
         AND NOT (a)-[:RELATES_TO]-()
       RETURN count(a) as cnt`,
    );
    console.log(`[Re-Extract] Would soft-delete ${(orphanCount.records[0].get('cnt') as { toNumber(): number }).toNumber()} orphan OSINT actors`);
  }

  // Step 2: Count OSINT events
  const pool = getPool();
  const countResult = await pool.query('SELECT count(*) as cnt FROM osint_events');
  const totalEvents = parseInt(countResult.rows[0].cnt, 10);
  console.log(`[Re-Extract] Found ${totalEvents} OSINT events to re-extract`);

  if (DRY_RUN) {
    console.log('[Re-Extract] Dry run complete. Exiting.');
    process.exit(0);
  }

  // Step 3: Process in batches (newest first — most relevant)
  let processed = 0;
  let actorsTotal = 0;
  let relsTotal = 0;
  let tensionsTotal = 0;
  let skipped = 0;
  let errors = 0;
  let offset = 0;

  while (offset < totalEvents) {
    const batch = await pool.query(
      `SELECT id FROM osint_events ORDER BY published_at DESC LIMIT $1 OFFSET $2`,
      [BATCH_SIZE, offset],
    );

    if (batch.rows.length === 0) break;

    for (const row of batch.rows) {
      try {
        const event = await osintEventStore.getEvent(row.id);
        if (!event) { skipped++; continue; }

        // Skip events with very short content (entity extractor will return empty anyway)
        const text = `${event.title}\n${event.description ?? ''}`.trim();
        if (text.length < 50) { skipped++; continue; }

        const result = await extractAndSyncToGraph(event);
        actorsTotal += result.actorsCreated;
        relsTotal += result.relationshipsCreated;
        tensionsTotal += result.tensionsCreated;
        processed++;

        if (processed % 25 === 0) {
          console.log(
            `[Re-Extract] ${processed}/${totalEvents} events ` +
            `| ${actorsTotal} actors, ${relsTotal} rels, ${tensionsTotal} tensions ` +
            `| ${skipped} skipped, ${errors} errors`,
          );
        }
      } catch (err) {
        errors++;
        if (errors <= 5) {
          console.warn(`[Re-Extract] Failed event ${row.id}:`, err instanceof Error ? err.message : err);
        }
      }
    }

    offset += BATCH_SIZE;
  }

  // Step 4: Final stats
  const postStats = await executeReadQuery(
    `MATCH (a:Actor) WHERE a.validTo IS NULL RETURN a.type as type, count(*) as cnt ORDER BY cnt DESC`,
  );
  console.log(`\n[Re-Extract] Complete!`);
  console.log(`  Events processed: ${processed} (${skipped} skipped, ${errors} errors)`);
  console.log(`  Actors created/updated: ${actorsTotal}`);
  console.log(`  Relationships: ${relsTotal}`);
  console.log(`  Tensions: ${tensionsTotal}`);
  console.log('  Active actors by type:');
  postStats.records.forEach(r =>
    console.log(`    ${r.get('type')}: ${(r.get('cnt') as { toNumber(): number }).toNumber()}`),
  );

  process.exit(0);
}

main().catch(err => {
  console.error('[Re-Extract] Fatal error:', err);
  process.exit(1);
});
