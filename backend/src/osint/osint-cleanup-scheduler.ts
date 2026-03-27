/**
 * OSINT Graph Cleanup Scheduler
 *
 * Periodically removes stale OSINT nodes from the knowledge graph
 * and old events from PostgreSQL that have decayed past usefulness.
 *
 * Runs every 12 hours via PgBoss. Two sweep passes:
 *
 *   1. **General staleness sweep** — applies to ALL graph nodes regardless of source.
 *      Uses the confidence decay formula: conf(t) = conf_0 * 2^(-t/half_life).
 *      Nodes whose decayed confidence falls below CONFIDENCE_FLOOR (0.10) are
 *      soft-deleted (validTo set). This preserves historical state — point-in-time
 *      queries with atTime can still reconstruct past graph snapshots.
 *
 *   2. **OSINT-specific cleanup** — hard-deletes OSINT nodes that have been
 *      soft-deleted for 30+ days with no remaining edges.
 *      Deletes old PostgreSQL osint_events past retention (180 days).
 */

import { getSharedBoss } from '../lib/database.js';
import { getPool } from '../lib/database.js';

const QUEUE_NAME = 'osint-graph-cleanup';
const SCHEDULE = '0 */12 * * *'; // Every 12 hours

// Nodes older than 3× half-life have < 12.5% of original confidence — safe to remove
const HALF_LIFE_MULTIPLIER = 3;

// PostgreSQL event retention: 180 days
const EVENT_RETENTION_DAYS = 180;

// General staleness sweep: soft-delete any node whose decayed confidence < this floor
const CONFIDENCE_FLOOR = 0.10;

/**
 * Remove stale OSINT nodes from Neo4j and old events from PostgreSQL.
 */
async function runCleanup(): Promise<{ staleSwept: number; nodesRemoved: number; edgesRemoved: number; eventsDeleted: number }> {
  const stats = { staleSwept: 0, nodesRemoved: 0, edgesRemoved: 0, eventsDeleted: 0 };

  // ── 0. General staleness sweep — all node types ────────────────────────
  // Uses the confidence decay formula in Cypher to find nodes whose decayed
  // confidence has fallen below CONFIDENCE_FLOOR. Sets validTo to soft-delete
  // them (preserving history for point-in-time queries).
  try {
    const { executeWriteQuery } = await import('../graph/neo4j-client.js');

    // Sweep Actors
    const actorSweep = await executeWriteQuery(`
      MATCH (a:Actor)
      WHERE a.validTo IS NULL
        AND a.validFrom IS NOT NULL
        AND a.confidence IS NOT NULL
        AND a.halfLifeDays IS NOT NULL
        AND a.halfLifeDays > 0
      WITH a,
           a.confidence * (0.5 ^ (duration.between(datetime(a.validFrom), datetime()).days / toFloat(a.halfLifeDays))) AS decayed
      WHERE decayed < $floor
      SET a.validTo = datetime().epochMillis
      RETURN count(a) AS swept
    `, { floor: CONFIDENCE_FLOOR });

    const actorSwept = (actorSweep.records?.[0]?.get?.('swept') as number) ?? 0;

    // Sweep RELATES_TO edges
    const relSweep = await executeWriteQuery(`
      MATCH ()-[r:RELATES_TO]-()
      WHERE r.validTo IS NULL
        AND r.validFrom IS NOT NULL
        AND r.confidence IS NOT NULL
        AND r.halfLifeDays IS NOT NULL
        AND r.halfLifeDays > 0
      WITH r,
           r.confidence * (0.5 ^ (duration.between(datetime(r.validFrom), datetime()).days / toFloat(r.halfLifeDays))) AS decayed
      WHERE decayed < $floor
      SET r.validTo = datetime().epochMillis
      RETURN count(r) AS swept
    `, { floor: CONFIDENCE_FLOOR });

    const relSwept = (relSweep.records?.[0]?.get?.('swept') as number) ?? 0;

    // Sweep Tension nodes
    const tensionSweep = await executeWriteQuery(`
      MATCH (t:Tension)
      WHERE t.validTo IS NULL
        AND t.validFrom IS NOT NULL
        AND t.confidence IS NOT NULL
        AND t.halfLifeDays IS NOT NULL
        AND t.halfLifeDays > 0
      WITH t,
           t.confidence * (0.5 ^ (duration.between(datetime(t.validFrom), datetime()).days / toFloat(t.halfLifeDays))) AS decayed
      WHERE decayed < $floor
      SET t.validTo = datetime().epochMillis
      RETURN count(t) AS swept
    `, { floor: CONFIDENCE_FLOOR });

    const tensionSwept = (tensionSweep.records?.[0]?.get?.('swept') as number) ?? 0;

    stats.staleSwept = actorSwept + relSwept + tensionSwept;
    if (stats.staleSwept > 0) {
      console.log(
        `[OSINT-Cleanup] Staleness sweep: ${actorSwept} actors, ${relSwept} relationships, ` +
        `${tensionSwept} tensions soft-deleted (decayed confidence < ${CONFIDENCE_FLOOR})`,
      );
    }
  } catch (err) {
    console.error('[OSINT-Cleanup] Staleness sweep failed:', err);
  }

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
      console.log('[OSINT-Cleanup] Starting scheduled cleanup run (staleness sweep + OSINT cleanup)');
      const stats = await runCleanup();
      console.log(`[OSINT-Cleanup] Complete: ${JSON.stringify(stats)}`);
    });

    console.log(`[OSINT-Cleanup] Scheduled every 12 hours`);
  } catch (err) {
    console.error('[OSINT-Cleanup] Failed to register cleanup job:', err);
  }
}
