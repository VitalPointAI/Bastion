/**
 * Ironclaw Integration — Barrel Exports
 *
 * Phase 30: Re-exports all public APIs from the Ironclaw integration module.
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
