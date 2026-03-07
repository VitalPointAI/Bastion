/**
 * Automatic Database Migration Runner
 *
 * Runs SQL migration files from src/db/migrations/ on startup.
 * Tracks applied migrations in a `schema_migrations` table.
 * Migrations are applied in filename order (e.g., 023-foo.sql, 024-bar.sql).
 */

import { getPool } from '../lib/database.js';
import { readdir, readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// In production (dist/), migrations are at dist/db/migrations/
// In dev (src/), migrations are at src/db/migrations/
const MIGRATIONS_DIR = join(__dirname, 'migrations');

async function ensureMigrationsTable(): Promise<void> {
  const pool = getPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

async function getAppliedMigrations(): Promise<Set<string>> {
  const pool = getPool();
  const result = await pool.query('SELECT filename FROM schema_migrations ORDER BY filename');
  return new Set(result.rows.map((r: { filename: string }) => r.filename));
}

async function getPendingMigrations(applied: Set<string>): Promise<string[]> {
  let files: string[];
  try {
    files = await readdir(MIGRATIONS_DIR);
  } catch {
    console.warn(`[migrations] Migrations directory not found: ${MIGRATIONS_DIR}`);
    return [];
  }

  return files
    .filter(f => f.endsWith('.sql'))
    .sort()
    .filter(f => !applied.has(f));
}

/**
 * Detect migrations that were applied manually before the migration runner existed.
 * Checks for database artifacts each migration would have created and marks them
 * as applied so they aren't re-run.
 */
async function detectPreExistingMigrations(pending: string[]): Promise<void> {
  const pool = getPool();

  // Map migration filenames to detection queries.
  // Each query returns a row if the migration's effects are already present.
  const detectors: Record<string, string> = {
    '023-workspace-to-problem-set.sql':
      `SELECT 1 FROM information_schema.tables WHERE table_name = 'problem_sets'`,
    '024-doctrinal-tabs.sql':
      `SELECT 1 FROM information_schema.columns WHERE table_name = 'problem_set_panel_config' AND column_name = 'panel_visibility'`,
    '025-exercise-positions.sql':
      `SELECT 1 FROM information_schema.tables WHERE table_name = 'exercise_positions'`,
    '026-fix-decision-gates-problem-set-id-type.sql':
      `SELECT 1 FROM information_schema.columns WHERE table_name = 'decision_gates' AND column_name = 'problem_set_id' AND data_type = 'text'`,
  };

  for (const filename of pending) {
    const detector = detectors[filename];
    if (!detector) continue;

    const result = await pool.query(detector);
    if (result.rows.length > 0) {
      await pool.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [filename]);
      console.log(`[migrations] Auto-detected as already applied: ${filename}`);
    }
  }
}

export async function runMigrations(): Promise<void> {
  const pool = getPool();

  await ensureMigrationsTable();

  // On first run (empty tracking table), detect pre-existing migrations
  const applied = await getAppliedMigrations();
  if (applied.size === 0) {
    const allMigrations = await getPendingMigrations(applied);
    if (allMigrations.length > 0) {
      console.log('[migrations] First run — detecting pre-existing migrations...');
      await detectPreExistingMigrations(allMigrations);
    }
  }

  // Re-fetch after detection
  const currentApplied = await getAppliedMigrations();
  const pending = await getPendingMigrations(currentApplied);

  if (pending.length === 0) {
    console.log('[migrations] Database is up to date');
    return;
  }

  console.log(`[migrations] ${pending.length} pending migration(s) to apply`);

  for (const filename of pending) {
    const filePath = join(MIGRATIONS_DIR, filename);
    const sql = await readFile(filePath, 'utf-8');

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [filename]);
      await client.query('COMMIT');
      console.log(`[migrations] Applied: ${filename}`);
    } catch (error) {
      await client.query('ROLLBACK');
      console.error(`[migrations] FAILED: ${filename}`, error);
      throw error; // Stop on first failure — don't skip broken migrations
    } finally {
      client.release();
    }
  }

  console.log(`[migrations] All ${pending.length} migration(s) applied successfully`);
}
