/**
 * Resource DID Management
 *
 * Helpers for creating and resolving resource decentralized identifiers (DIDs).
 * Resource DIDs follow format: did:near:resource-{resourceId}
 *
 * Phase 27 Plan 01: Cloned from agent-did.ts with resource-specific context.
 */

import { hkdf } from '@noble/hashes/hkdf.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils.js';

// System secret for deriving resource keys
const RESOURCE_KEY_CONTEXT = 'bastion-resource-did-v1';

/**
 * Generate deterministic keys for a resource DID.
 * Uses HKDF with resource ID to derive consistent keys.
 */
function deriveResourceKeys(resourceId: string): {
  blindedKey: string;
  publicKey: string;
} {
  const systemSecret = process.env.ENCRYPTION_KEY || 'dev-secret-key';
  const info = utf8ToBytes(`${RESOURCE_KEY_CONTEXT}:${resourceId}`);

  // Derive 64 bytes: 32 for blinded key, 32 for public key
  const derived = hkdf(sha256, utf8ToBytes(systemSecret), undefined, info, 64);

  return {
    blindedKey: bytesToHex(derived.slice(0, 32)),
    publicKey: bytesToHex(derived.slice(32, 64)),
  };
}

/**
 * Create a DID for a resource.
 * Returns the DID string and associated keys.
 */
export async function createResourceDID(resourceId: string): Promise<{
  did: string;
  blindedKey: string;
  publicKey: string;
}> {
  const keys = deriveResourceKeys(resourceId);
  const did = `did:near:resource-${resourceId}`;

  return {
    did,
    blindedKey: keys.blindedKey,
    publicKey: keys.publicKey,
  };
}

/**
 * Resolve a resource DID to extract the resource ID.
 * Returns null if the DID format is invalid.
 */
export function resolveResourceDID(did: string): string | null {
  const match = did.match(/^did:near:resource-(.+)$/);
  if (!match) {
    return null;
  }
  return match[1];
}

/**
 * Verify a resource's DID matches expected keys.
 * Used for authentication/verification of resource identity.
 */
export function verifyResourceDID(resourceId: string, providedPublicKey: string): boolean {
  const keys = deriveResourceKeys(resourceId);
  return keys.publicKey === providedPublicKey;
}
