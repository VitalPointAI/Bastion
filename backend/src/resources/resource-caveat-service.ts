/**
 * Resource Caveat Service
 *
 * Phase 58 Plan 02: Caveat CRUD + on-chain bridge
 *
 * Provides permission-gated caveat updates with DB as source of truth and
 * fire-and-forget on-chain sync for the immutable audit trail.
 *
 * AUTHORITY MODEL:
 * - Permission check: caller must be commander or XO of the problem set
 * - System HKDF secret signs on-chain transactions (resource DIDs are admin-owned,
 *   not user-owned — see Phase 58 Research Open Question 1 / Pitfall 3)
 * - On-chain sync failure is a soft failure; DB remains authoritative
 */

import { sha256 } from '@noble/hashes/sha2.js';
import { utf8ToBytes } from '@noble/hashes/utils.js';
import { resourceStore } from './resource-store.js';
import { problemSetMemberStore } from '../problem-set/problem-set-member-store.js';
import { storeResourceCaveatsOnChain, checkEmploymentAuthViaRPC } from '../near/tx-signer.js';
import type { ResourceCaveats, EmploymentContext, EmploymentAuthResult } from './types.js';

// ============================================================================
// System secret derivation
// ============================================================================

/**
 * Derive the system HKDF user secret used for resource DID operations.
 * This is the same pattern as the deriveUserSecret in problem-sets.ts — it uses
 * a constant accountId ('bastion-system') so that resource DID tx are always
 * signed by the same system signing account regardless of which user triggers them.
 */
function deriveSystemSecret(): Uint8Array {
  const seed = process.env.DID_SECRET_SEED || 'dev-secret-seed';
  const encoder = new TextEncoder();
  const combined = encoder.encode(`${seed}:bastion-system`);
  return sha256(combined);
}

// ============================================================================
// Allowed roles for caveat updates
// ============================================================================

const CAVEAT_UPDATE_ROLES = ['commander', 'xo'];

// ============================================================================
// ResourceCaveatService
// ============================================================================

class ResourceCaveatService {
  /**
   * Update resource caveats with permission check.
   *
   * Permissions:
   * - Caller must be commander or XO of the specified problem set
   *
   * Side effects:
   * - Writes caveat columns to DB (source of truth)
   * - Fire-and-forget: syncs to on-chain DID registry contract
   *
   * @throws Error with code 'FORBIDDEN' when caller lacks permission
   * @throws Error with code 'NOT_FOUND' when resource does not exist
   */
  async updateResourceCaveats(
    resourceId: string,
    problemSetId: string,
    callerDid: string,
    caveats: ResourceCaveats,
  ): Promise<void> {
    // Permission check: caller must be commander or XO
    const membership = await problemSetMemberStore.getMember(problemSetId, callerDid);
    if (!membership || !CAVEAT_UPDATE_ROLES.includes(membership.role)) {
      const err = new Error('Forbidden: must be commander or XO to update resource caveats');
      (err as NodeJS.ErrnoException).code = 'FORBIDDEN';
      throw err;
    }

    // Verify resource exists and get blinded key for on-chain sync
    const resource = await resourceStore.getResource(resourceId);
    if (!resource) {
      const err = new Error(`Resource not found: ${resourceId}`);
      (err as NodeJS.ErrnoException).code = 'NOT_FOUND';
      throw err;
    }

    // Write to DB (source of truth — must succeed before attempting chain sync)
    await resourceStore.updateResourceCaveats(resourceId, caveats);

    // Fire-and-forget on-chain sync
    if (resource.blindedKey) {
      const systemSecret = deriveSystemSecret();
      storeResourceCaveatsOnChain(systemSecret, resource.blindedKey, caveats)
        .then(async (result) => {
          if (result.success) {
            await resourceStore.markCaveatOnChainSynced(resourceId);
            console.log(`[caveat-service] On-chain caveat sync ok for ${resourceId} tx=${result.txHash}`);
          } else {
            console.warn(`[caveat-service] On-chain caveat sync failed for ${resourceId}: ${result.error}`);
          }
        })
        .catch((err: unknown) => {
          console.warn(`[caveat-service] On-chain caveat sync threw for ${resourceId}:`, err);
        });
    } else {
      console.warn(`[caveat-service] Resource ${resourceId} has no blindedKey — skipping on-chain sync`);
    }
  }

  /**
   * Check whether employment of a resource is authorized given a context.
   *
   * Queries the on-chain contract view method directly.
   * Falls back to { authorized: false, reasons: ['Resource not registered'] }
   * when the resource has no blinded key (not DID-registered).
   */
  async checkEmploymentAuth(
    resourceId: string,
    context: EmploymentContext,
  ): Promise<EmploymentAuthResult> {
    const resource = await resourceStore.getResource(resourceId);
    if (!resource || !resource.blindedKey) {
      return { authorized: false, reasons: ['Resource not registered'] };
    }

    return checkEmploymentAuthViaRPC(resource.blindedKey, context);
  }
}

// Singleton instance
export const caveatService = new ResourceCaveatService();
