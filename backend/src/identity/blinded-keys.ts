import { hkdf } from '@noble/hashes/hkdf.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, hexToBytes, utf8ToBytes } from '@noble/hashes/utils.js';

/**
 * Derive a blinded key for DID lookup
 * This key is used as the storage key on-chain
 * @param userSecret - User's secret key material (from NEAR key or derived)
 * @param accountId - NEAR account ID
 * @returns 32-byte blinded key
 */
export function deriveDIDBlindedKey(userSecret: Uint8Array, accountId: string): Uint8Array {
  const salt = utf8ToBytes(accountId);
  const info = utf8ToBytes('bastion-did-v1');
  return hkdf(sha256, userSecret, salt, info, 32);
}

/**
 * Derive a blinded key for credential lookup
 * @param userSecret - Issuer's secret key material
 * @param credentialHash - Hash of the credential
 * @returns 32-byte blinded key
 */
export function deriveCredentialBlindedKey(userSecret: Uint8Array, credentialHash: string): Uint8Array {
  const salt = utf8ToBytes(credentialHash);
  const info = utf8ToBytes('bastion-credential-v1');
  return hkdf(sha256, userSecret, salt, info, 32);
}

/**
 * Derive a separate blinded key for revocation checks
 * Different from credential key to prevent correlation
 * @param userSecret - Issuer's secret key material
 * @param credentialHash - Hash of the credential
 * @returns 32-byte blinded revocation key
 */
export function deriveRevocationBlindedKey(userSecret: Uint8Array, credentialHash: string): Uint8Array {
  const salt = utf8ToBytes(credentialHash);
  const info = utf8ToBytes('bastion-revocation-v1');
  return hkdf(sha256, userSecret, salt, info, 32);
}

/**
 * Derive user secret from NEAR account key
 * This is deterministic so user can always recover their blinded keys
 * @param nearPrivateKey - User's NEAR private key
 * @param purpose - Purpose string for domain separation
 * @returns 32-byte derived secret
 */
export function deriveUserSecret(nearPrivateKey: Uint8Array, purpose: string): Uint8Array {
  const salt = utf8ToBytes('bastion-user-secret');
  const info = utf8ToBytes(purpose);
  return hkdf(sha256, nearPrivateKey, salt, info, 32);
}

// Hex conversion utilities
export function blindedKeyToHex(key: Uint8Array): string {
  return bytesToHex(key);
}

export function hexToBlindedKey(hex: string): Uint8Array {
  return hexToBytes(hex);
}
