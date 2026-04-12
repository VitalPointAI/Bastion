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
import { routineService } from './routine-service.js';

/**
 * Start background Ironclaw jobs. Called once during application startup.
 *  - Concept consolidation merges duplicate concept entries learned from chat.
 *  - Refines Ironclaw's three installer-created learning routines
 *    (daily_situation_brief, bastion_knowledge_sync, weekly_capability_update)
 *    to produce distilled per-problem-set memory with REPLACE semantics instead
 *    of narrative append. These routines ARE Ironclaw's long-term memory loop —
 *    we keep them enabled and refine the prompts rather than disable them.
 *  - Periodic backstop trim enforces path-based size caps on memory_documents
 *    in case the LLM ignores the prompt-level size limits.
 */
export function initIronclawBackgroundJobs(): void {
  startConsolidationJob();
  void routineService.refineIronclawDefaultRoutines();

  setTimeout(() => void routineService.trimOversizedMemoryDocuments(), 30_000);
  setInterval(() => void routineService.trimOversizedMemoryDocuments(), 6 * 60 * 60 * 1000);

  console.log('[ironclaw] Background jobs started (consolidation + routine refinement + memory trim)');
}
