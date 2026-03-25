/**
 * Ironclaw Integration — Barrel Exports
 *
 * Phase 30: Re-exports all public APIs from the Ironclaw integration module.
 *
 * Phase 57 Plan 04: Added initIronclawMemory() for startup initialization
 * of memory store tables and daily cleanup job registration.
 */

export * from './ironclaw-types.js';
export * from './ironclaw-store.js';
export * from './ironclaw-client.js';
export * from './ironclaw-service.js';
export { ironclawRouter } from './ironclaw-router.js';
export * from './action-registry.js';
export * from './action-pipeline.js';
export * from './tool-bridge.js';
export { GitHubService, githubService } from './github-service.js';
export type {
  CreatePRParams,
  CreatePRResult,
  PRStatus,
  DeploymentStatus,
  EmergencyMergeResult,
} from './github-service.js';
export * from './self-update-service.js';
export * from './audit-anchor-service.js';
export { signRequest, verifyRequest } from './hmac-auth.js';
// NOTE: tool-bridge.ts should import githubService for 'bastion.code.create_pr' actions

// ---------------------------------------------------------------------------
// Memory lifecycle initialization (Phase 57)
// ---------------------------------------------------------------------------

import {
  ironclawUserMemoryStore,
  ironclawContextMemoryStore,
  ironclawOutcomeStore,
} from './ironclaw-memory-store.js';
import { registerMemoryCleanupJob } from './ironclaw-memory-cleanup.js';

/**
 * Initialize Ironclaw memory stores and register the daily cleanup job.
 *
 * Call this once during application startup (after database connection is ready).
 * Ensures all three memory tables exist and registers the pg-boss recurring
 * job that deletes expired rows daily at 3am UTC.
 *
 * Safe to call multiple times (ensureTable is idempotent; pg-boss schedule
 * and work registrations are also idempotent).
 */
export async function initIronclawMemory(): Promise<void> {
  await ironclawUserMemoryStore.ensureTable();
  await ironclawContextMemoryStore.ensureTable();
  await ironclawOutcomeStore.ensureTable();
  await registerMemoryCleanupJob();
  console.log('[ironclaw] Memory stores initialized');
}
