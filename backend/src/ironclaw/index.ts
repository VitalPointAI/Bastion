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
// NOTE: tool-bridge.ts should import githubService for 'bastion_code_create_pr' actions

// ---------------------------------------------------------------------------
// Startup initialization
// ---------------------------------------------------------------------------

import { startConsolidationJob } from './concept-consolidation.js';

/**
 * Start background Ironclaw jobs. Called once during application startup.
 * Concept consolidation merges duplicate concept entries learned from chat;
 * it runs independently of the removed BASTION memory stores (which were
 * collapsed into Ironclaw's intrinsic memory system).
 */
export function initIronclawBackgroundJobs(): void {
  startConsolidationJob();
  console.log('[ironclaw] Concept consolidation job started');
}
