/**
 * Drop Legacy Auth Tables
 *
 * Phase 18 Plan 01: Drop all legacy passkey/session auth tables that were
 * created by Phase 1.2. The @vitalpoint/near-phantom-auth package creates
 * its own schema (anon_users, anon_passkeys, anon_sessions, etc.) via
 * auth.initialize(). This migration removes the old schema to avoid conflicts.
 *
 * Tables dropped (all used CASCADE to handle foreign key dependencies):
 *   - user_sessions
 *   - passkey_challenges
 *   - passkeys
 *   - magic_link_tokens
 *   - totp_credentials
 *   - recovery_tokens
 *   - auth_users
 *
 * This migration is idempotent (IF EXISTS) and runs once at startup
 * before auth.initialize().
 */

import { getPool } from '../lib/database.js';

export async function dropLegacyAuthTables(): Promise<void> {
  const pool = getPool();

  console.log('Running legacy auth table migration: dropping old auth tables...');

  await pool.query(`
    DROP TABLE IF EXISTS user_sessions CASCADE;
    DROP TABLE IF EXISTS passkey_challenges CASCADE;
    DROP TABLE IF EXISTS passkeys CASCADE;
    DROP TABLE IF EXISTS magic_link_tokens CASCADE;
    DROP TABLE IF EXISTS totp_credentials CASCADE;
    DROP TABLE IF EXISTS recovery_tokens CASCADE;
    DROP TABLE IF EXISTS auth_users CASCADE;
  `);

  console.log('Legacy auth tables dropped (or did not exist).');
}
