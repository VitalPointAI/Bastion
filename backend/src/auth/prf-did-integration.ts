/**
 * PRF-to-DID Integration
 *
 * CRITICAL: This module enables DID operations using WebAuthn PRF extension output.
 *
 * Architecture:
 * - PRF output (32 bytes from WebAuthn) replaces NEAR-private-key-derived userSecret
 * - Existing DID encryption/blinding logic unchanged (deriveDIDBlindedKey, deriveEncryptionKey)
 * - DIDService.createDID and resolveDID accept PRF-derived userSecret directly
 *
 * Key insight: PRF output is cryptographically equivalent to deriveUserSecret(nearPrivateKey).
 * Both produce 32-byte deterministic values suitable for HKDF input.
 */

import { getDIDService } from '../identity/did-service.js';
import { deriveDIDBlindedKey, blindedKeyToHex } from '../identity/blinded-keys.js';
import { deriveEncryptionKey } from '../identity/did-encryption.js';
import type { DIDDocument, EntityType } from '../identity/types.js';

/**
 * Create DID using PRF-derived secret
 *
 * This is the passkey-native path for DID creation.
 * Uses PRF output as userSecret for HKDF derivation.
 *
 * @param accountId - NEAR account ID (from MPC using user UUID, NOT from passkey)
 * @param prfSecret - 32-byte output from WebAuthn PRF extension
 * @param publicKeyBase58 - Public key for DID document
 * @param entityType - Entity type (default: Human)
 * @returns DID and blinded key
 */
export async function createDIDFromPRF(
  accountId: string,
  prfSecret: Uint8Array,
  publicKeyBase58: string,
  entityType: EntityType = 'Human'
): Promise<{ did: string; blindedKey: string }> {
  // Validate PRF secret length
  if (prfSecret.length !== 32) {
    throw new Error(`Invalid PRF secret length: expected 32, got ${prfSecret.length}`);
  }

  // PRF secret becomes the userSecret for DID operations
  // This is the KEY insight: PRF output replaces nearPrivateKey-derived secret
  const userSecret = prfSecret;

  const didService = getDIDService();

  const result = await didService.createDID(
    accountId,
    entityType,
    userSecret,
    publicKeyBase58
  );

  return result;
}

/**
 * Resolve DID using PRF-derived secret
 *
 * @param accountId - NEAR account ID
 * @param prfSecret - 32-byte output from WebAuthn PRF extension
 * @returns DID document or null if not found
 */
export async function resolveDIDFromPRF(
  accountId: string,
  prfSecret: Uint8Array
): Promise<DIDDocument | null> {
  if (prfSecret.length !== 32) {
    throw new Error(`Invalid PRF secret length: expected 32, got ${prfSecret.length}`);
  }

  const didService = getDIDService();
  return didService.resolveDID(accountId, prfSecret);
}

/**
 * Check if DID exists for account using PRF secret
 */
export async function checkDIDExistsFromPRF(
  accountId: string,
  prfSecret: Uint8Array
): Promise<boolean> {
  const didService = getDIDService();
  return didService.isDIDActive(accountId, prfSecret);
}

/**
 * Derive blinded key from PRF secret
 *
 * Used for DID lookup operations without full resolution.
 *
 * @param accountId - NEAR account ID
 * @param prfSecret - 32-byte PRF output
 * @returns Hex-encoded blinded key
 */
export function deriveBlindedKeyFromPRF(
  accountId: string,
  prfSecret: Uint8Array
): string {
  const blindedKey = deriveDIDBlindedKey(prfSecret, accountId);
  return blindedKeyToHex(blindedKey);
}

/**
 * Derive encryption key from PRF secret
 *
 * Used for encrypting/decrypting DID documents.
 *
 * @param prfSecret - 32-byte PRF output
 * @returns Encryption key
 */
export function deriveEncryptionKeyFromPRF(prfSecret: Uint8Array): Uint8Array {
  return deriveEncryptionKey(prfSecret);
}

/**
 * Normalize PRF output for consistent use
 *
 * PRF outputs may come in different encodings from the browser.
 * This ensures we always work with Uint8Array.
 *
 * @param prfOutput - PRF output in various formats
 * @returns Normalized 32-byte Uint8Array
 */
export function normalizePRFOutput(
  prfOutput: Uint8Array | ArrayBuffer | string
): Uint8Array {
  if (prfOutput instanceof Uint8Array) {
    return prfOutput;
  }

  if (prfOutput instanceof ArrayBuffer) {
    return new Uint8Array(prfOutput);
  }

  // Assume base64url string (from browser)
  if (typeof prfOutput === 'string') {
    // Base64url decode
    const base64 = prfOutput.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - base64.length % 4) % 4);
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }

  throw new Error('Invalid PRF output format');
}

/**
 * Verify PRF-DID compatibility
 *
 * Test function to verify that PRF-derived DIDs work correctly.
 * Creates a DID, resolves it, and verifies the document.
 */
export async function verifyPRFDIDCompatibility(
  accountId: string,
  prfSecret: Uint8Array,
  publicKeyBase58: string
): Promise<{ compatible: boolean; error?: string }> {
  try {
    // Create DID
    const createResult = await createDIDFromPRF(
      accountId,
      prfSecret,
      publicKeyBase58,
      'Human'
    );

    console.log('DID created:', createResult.did);

    // Resolve DID
    const document = await resolveDIDFromPRF(accountId, prfSecret);

    if (!document) {
      return { compatible: false, error: 'DID resolution returned null' };
    }

    // Verify document fields
    const expectedDID = `did:near:${accountId}`;
    if (document.id !== expectedDID) {
      return { compatible: false, error: `DID mismatch: ${document.id} != ${expectedDID}` };
    }

    if (document.publicKey?.[0]?.publicKeyBase58 !== publicKeyBase58) {
      return { compatible: false, error: 'Public key mismatch' };
    }

    return { compatible: true };
  } catch (error) {
    return {
      compatible: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}
