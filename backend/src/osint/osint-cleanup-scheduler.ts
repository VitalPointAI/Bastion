/**
 * OSINT Graph Cleanup Scheduler
 *
 * Periodically removes stale OSINT nodes from the knowledge graph
 * and old events from PostgreSQL that have decayed past usefulness.
 *
 * Runs every 12 hours via PgBoss. Criteria for cleanup:
 *   - OSINT event nodes older than 3× their half-life (confidence < 12.5%)
 *   - OSINT actor nodes with no remaining active event references
 *   - PostgreSQL osint_events older than retention period (default 180 days)
 */

import { getSharedBoss } from '../lib/database.js';
import { getPool } from '../lib/database.js';

const QUEUE_NAME = 'osint-graph-cleanup';
const SCHEDULE = '0 */12 * * *'; // Every 12 hours

// Nodes older than 3× half-life have < 12.5% of original confidence — safe to remove
const HALF_LIFE_MULTIPLIER = 3;

// PostgreSQL event retention: 180 days
const EVENT_RETENTION_DAYS = 180;

/**
 * Remove stale OSINT nodes from Neo4j and old events from PostgreSQL.
 */
async function runCleanup(): Promise<{ nodesRemoved: number; edgesRemoved: number; eventsDeleted: number }> {
  const stats = { nodesRemoved: 0, edgesRemoved: 0, eventsDeleted: 0 };

  // ── 1. Soft-delete expired Neo4j OSINT nodes ──────────────────────────
  try {
    const { executeWriteQuery, executeReadQuery } = await import('../graph/neo4j-client.js');

    // Find OSINT event nodes past their useful life (3× half-life)
    // and set validTo to mark them as expired
    const expiredResult = await executeWriteQuery(`
      MATCH (a:Actor)
      WHERE a.assertedVia = 'osint'
        AND a.halfLifeDays IS NOT NULL
        AND a.halfLifeDays > 0
        AND a.validFrom IS NOT NULL
        AND a.validTo IS NULL
        AND duration.between(datetime(a.validFrom), datetime()).days > (a.halfLifeDays * $multiplier)
      SET a.validTo = datetime().epochMillis
      RETURN count(a) AS expired
    `, { multiplier: HALF_LIFE_MULTIPLIER });

    const expiredCount = (expiredResult.records?.[0]?.get?.('expired') as number) ?? 0;

    // Delete edges connected to already-expired nodes (validTo set)
    // that have been expired for more than 7 days (grace period)
    const edgeResult = await executeWriteQuery(`
      MATCH (a:Actor)-[r:RELATES_TO]-()
      WHERE a.validTo IS NOT NULL
        AND a.assertedVia = 'osint'
        AND duration.between(datetime({epochMillis: a.validTo}), datetime()).days > 7
      DELETE r
      RETURN count(r) AS removed
    `, {});

    stats.edgesRemoved = (edgeResult.records?.[0]?.get?.('removed') as number) ?? 0;

    // Hard-delete OSINT nodes that have been soft-deleted for 30+ days
    // and have no remaining edges
    const deleteResult = await executeWriteQuery(`
      MATCH (a:Actor)
      WHERE a.validTo IS NOT NULL
        AND a.assertedVia = 'osint'
        AND duration.between(datetime({epochMillis: a.validTo}), datetime()).days > 30
        AND NOT (a)-[:RELATES_TO]-()
      DELETE a
      RETURN count(a) AS deleted
    `, {});

    stats.nodesRemoved = (deleteResult.records?.[0]?.get?.('deleted') as number) ?? 0;

    // Also clean up orphaned OSINT actor nodes that have no event references
    const orphanResult = await executeReadQuery(`
      MATCH (a:Actor)
      WHERE a.id STARTS WITH 'ACT-osint-'
        AND a.validTo IS NULL
        AND NOT (a)-[:RELATES_TO]->(:Actor {type: 'event'})
        AND a.updatedAt IS NOT NULL
        AND duration.between(datetime(a.updatedAt), datetime()).days > 90
      RETURN count(a) AS orphans
    `, {});

    const orphanCount = (orphanResult.records?.[0]?.get?.('orphans') as number) ?? 0;
    if (orphanCount > 0) {
      await executeWriteQuery(`
        MATCH (a:Actor)
        WHERE a.id STARTS WITH 'ACT-osint-'
          AND a.validTo IS NULL
          AND NOT (a)-[:RELATES_TO]->(:Actor {type: 'event'})
          AND a.updatedAt IS NOT NULL
          AND duration.between(datetime(a.updatedAt), datetime()).days > 90
        SET a.validTo = datetime().epochMillis
      `, {});
    }

    console.log(
      `[OSINT-Cleanup] Neo4j: ${expiredCount} nodes expired, ${stats.edgesRemoved} edges removed, ` +
      `${stats.nodesRemoved} nodes hard-deleted, ${orphanCount} orphans marked`,
    );
  } catch (err) {
    console.error('[OSINT-Cleanup] Neo4j cleanup failed:', err);
  }

  // ── 2. Delete old PostgreSQL OSINT events ─────────────────────────────
  try {
    const pool = getPool();
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - EVENT_RETENTION_DAYS);

    const result = await pool.query(
      `DELETE FROM osint_events WHERE published_at < $1 RETURNING id`,
      [cutoff.toISOString()],
    );

    stats.eventsDeleted = result.rowCount ?? 0;

    if (stats.eventsDeleted > 0) {
      console.log(`[OSINT-Cleanup] PostgreSQL: deleted ${stats.eventsDeleted} events older than ${EVENT_RETENTION_DAYS} days`);
    }
  } catch (err) {
    console.error('[OSINT-Cleanup] PostgreSQL cleanup failed:', err);
  }

  return stats;
}

/**
 * Register the OSINT cleanup job with PgBoss.
 * Called during server startup.
 */
export async function registerOSINTCleanupJob(): Promise<void> {
  try {
    const boss = await getSharedBoss();

    await boss.createQueue(QUEUE_NAME);
    await boss.schedule(QUEUE_NAME, SCHEDULE);

    await boss.work(QUEUE_NAME, async () => {
      console.log('[OSINT-Cleanup] Starting scheduled cleanup run');
      const stats = await runCleanup();
      console.log(`[OSINT-Cleanup] Complete: ${JSON.stringify(stats)}`);
    });

    console.log(`[OSINT-Cleanup] Scheduled every 12 hours`);
  } catch (err) {
    console.error('[OSINT-Cleanup] Failed to register cleanup job:', err);
  }
}
