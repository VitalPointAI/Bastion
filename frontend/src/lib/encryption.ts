/**
 * Client-Side Encryption Library
 *
 * Uses ChaCha20-Poly1305 AEAD cipher for authenticated encryption.
 * All data encrypted before IPFS upload or on-chain storage.
 * Uses audited @noble/ciphers library (timing-attack resistant, no dependencies).
 */

import { xchacha20poly1305 } from '@noble/ciphers/chacha.js';
import { randomBytes } from '@noble/ciphers/utils.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex } from '@noble/hashes/utils.js';

export interface EncryptedData {
  encryptedData: Uint8Array;
  nonce: Uint8Array;
}

/**
 * Generate a random 32-byte encryption key
 *
 * Uses crypto.getRandomValues() for cryptographically secure randomness.
 *
 * @returns 32-byte encryption key
 */
export function generateEncryptionKey(): Uint8Array {
  return randomBytes(32);
}

/**
 * Encrypt data using ChaCha20-Poly1305 AEAD cipher
 *
 * ChaCha20-Poly1305 provides:
 * - Confidentiality (encryption)
 * - Authenticity (authentication tag)
 * - Tamper detection (fails if data modified)
 *
 * @param data - Data to encrypt
 * @param key - 32-byte encryption key
 * @returns Encrypted data with nonce
 */
export function encryptData(data: Uint8Array, key: Uint8Array): EncryptedData {
  if (key.length !== 32) {
    throw new Error('Encryption key must be 32 bytes');
  }

  // Generate random 24-byte nonce for XChaCha20-Poly1305
  const nonce = randomBytes(24);

  // Create cipher instance
  const cipher = xchacha20poly1305(key, nonce);

  // Encrypt data (includes authentication tag)
  const encryptedData = cipher.encrypt(data);

  return {
    encryptedData,
    nonce,
  };
}

/**
 * Decrypt data using ChaCha20-Poly1305 AEAD cipher
 *
 * Verifies authentication tag - throws error if data has been tampered with.
 *
 * @param encryptedData - Encrypted data
 * @param key - 32-byte encryption key (same as used for encryption)
 * @param nonce - 24-byte nonce (same as used for encryption)
 * @returns Decrypted data
 * @throws Error if authentication tag invalid (tampered data)
 */
export function decryptData(
  encryptedData: Uint8Array,
  key: Uint8Array,
  nonce: Uint8Array
): Uint8Array {
  if (key.length !== 32) {
    throw new Error('Encryption key must be 32 bytes');
  }

  if (nonce.length !== 24) {
    throw new Error('Nonce must be 24 bytes');
  }

  try {
    // Create cipher instance
    const cipher = xchacha20poly1305(key, nonce);

    // Decrypt data (verifies authentication tag)
    const decryptedData = cipher.decrypt(encryptedData);

    return decryptedData;
  } catch (error) {
    throw new Error(
      `Decryption failed: ${error instanceof Error ? error.message : 'Invalid authentication tag or corrupted data'}`
    );
  }
}

/**
 * Hash data using SHA256
 *
 * Used for:
 * - Content verification
 * - Document fingerprinting
 * - Integrity checking
 *
 * @param data - Data to hash
 * @returns SHA256 hash as hex string
 */
export function hashData(data: Uint8Array): string {
  const hash = sha256(data);
  return bytesToHex(hash);
}

/**
 * Convert string to Uint8Array
 *
 * @param str - String to convert
 * @returns Uint8Array
 */
export function stringToBytes(str: string): Uint8Array {
  return new TextEncoder().encode(str);
}

/**
 * Convert Uint8Array to string
 *
 * @param bytes - Bytes to convert
 * @returns String
 */
export function bytesToString(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes);
}

/**
 * Convert Uint8Array to base64 string (for storage)
 *
 * @param bytes - Bytes to convert
 * @returns Base64 string
 */
export function bytesToBase64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes));
}

/**
 * Convert base64 string to Uint8Array (for retrieval)
 *
 * @param base64 - Base64 string
 * @returns Uint8Array
 */
export function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}
