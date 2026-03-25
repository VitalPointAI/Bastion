/**
 * Ironclaw Memory Cleanup Job
 *
 * Phase 57 Plan 04: Registers a daily pg-boss recurring job to delete
 * expired rows from all three ironclaw memory tables.
 *
 * Schedule: 3am UTC daily ('0 3 * * *')
 * - ironclaw_user_memory: delete rows where expires_at < NOW()
 * - ironclaw_context_memory: delete rows where expires_at < NOW()
 * - ironclaw_interaction_outcomes: delete rows older than 90 days (raw data retention)
 *
 * Follows the pattern from osint-cleanup-scheduler.ts and validation-scheduler.ts.
 */

import { getSharedBoss } from '../lib/database.js';
import { getPool } from '../lib/database.js';

const QUEUE_NAME = 'ironclaw-memory-cleanup';
const SCHEDULE = '0 3 * * *'; // Daily at 3am UTC

/**
 * Delete expired rows from all three ironclaw memory tables.
 * Called by the pg-boss job handler.
 */
async function runCleanup(): Promise<void> {
  const pool = getPool();
  const results = await Promise.allSettled([
    pool.query(`DELETE FROM ironclaw_user_memory WHERE expires_at < NOW()`),
    pool.query(`DELETE FROM ironclaw_context_memory WHERE expires_at < NOW()`),
    // interaction_outcomes: no expires_at column — delete records older than 90 days
    pool.query(
      `DELETE FROM ironclaw_interaction_outcomes WHERE created_at < NOW() - INTERVAL '90 days'`,
    ),
  ]);

  const tables = ['user_memory', 'context_memory', 'interaction_outcomes'];
  const summary = results.map((r, i) => {
    if (r.status === 'fulfilled') return `${tables[i]}: ${r.value.rowCount ?? 0} rows`;
    return `${tables[i]}: error (${(r.reason as Error)?.message ?? 'unknown'})`;
  });

  console.log(`[ironclaw-memory-cleanup] Completed: ${summary.join(', ')}`);
}

/**
 * Register the daily memory cleanup job with pg-boss.
 * Called during server startup after memory store tables are initialized.
 *
 * - Creates the queue
 * - Schedules daily runs at 3am UTC
 * - Registers the worker handler
 */
export async function registerMemoryCleanupJob(): Promise<void> {
  try {
    const boss = await getSharedBoss();

    await boss.createQueue(QUEUE_NAME);
    await boss.schedule(QUEUE_NAME, SCHEDULE);

    await boss.work(QUEUE_NAME, async () => {
      console.log('[ironclaw-memory-cleanup] Starting scheduled cleanup run');
      await runCleanup();
    });

    console.log('[ironclaw-memory-cleanup] Daily cleanup job registered (3am UTC)');
  } catch (err) {
    console.error('[ironclaw-memory-cleanup] Failed to register cleanup job:', err);
  }
}
