/**
 * Validation Scheduler
 *
 * Phase 31 Plan 03: Registers PgBoss periodic jobs for automated
 * validation runs. Follows message-bus.ts / blockchain-sync.ts pattern.
 */

import { getSharedBoss } from '../lib/database.js';
import { validationRunner } from './validation-runner.js';
import { validationStore } from './validation-store.js';
import { seedDefaultThresholds } from './threshold-config.js';

/**
 * Register validation PgBoss jobs for periodic automated runs.
 * Called during server startup.
 *
 * - Ensures validation tables exist
 * - Seeds default thresholds if none exist
 * - Schedules 6-hour periodic validation runs
 * - Registers worker to execute runs
 */
export async function registerValidationJobs(): Promise<void> {
  // Ensure tables exist
  await validationStore.ensureTable();

  // Seed default thresholds
  await seedDefaultThresholds();

  // Get PgBoss instance
  const boss = await getSharedBoss();

  // Create queue
  await boss.createQueue('validation-run');

  // Schedule periodic runs (every 6 hours)
  await boss.schedule('validation-run', '0 */6 * * *');

  // Register worker (handler receives Job[] per pg-boss types)
  await boss.work('validation-run', async (_jobs: unknown[]) => {
      console.log('[ValidationScheduler] Starting scheduled validation run');
      try {
        const run = await validationRunner.executeFullRun('scheduled');
        console.log(
          `[ValidationScheduler] Scheduled run ${run.id} completed with status: ${run.status}`,
        );
      } catch (err) {
        console.error('[ValidationScheduler] Scheduled run failed:', err);
      }
    },
  );

  console.log('[ValidationScheduler] Jobs registered (6-hour cycle)');
}
