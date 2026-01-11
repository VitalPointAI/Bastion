/**
 * Frontend Encryption API Client
 *
 * Proxies encryption operations to secure backend API.
 * All cryptographic operations happen server-side with Node.js crypto.
 */

import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex } from '@noble/hashes/utils.js';

const BACKEND_URL = import.meta.env.VITE_BACKEND_API_URL || 'http://localhost:3001';

/**
 * Encrypt data via backend API
 *
 * @param data - Data to encrypt (string or Uint8Array)
 * @returns Object with encrypted data, nonce, and key (all as hex/base64 strings)
 */
export async function encryptData(
  data: string | Uint8Array
): Promise<{ encrypted: string; nonce: string; key: string }> {
  // Convert Uint8Array to string if needed
  const dataStr = typeof data === 'string' ? data : bytesToString(data);

  const response = await fetch(`${BACKEND_URL}/api/encryption/encrypt`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data: dataStr })
  });

  if (!response.ok) {
    throw new Error('Encryption failed');
  }

  return response.json();
}

/**
 * Decrypt data via backend API
 *
 * @param encrypted - Encrypted data (base64 string)
 * @param key - Encryption key (hex string)
 * @param nonce - Nonce (hex string)
 * @returns Decrypted data as string
 */
export async function decryptData(
  encrypted: string,
  key: string,
  nonce: string
): Promise<string> {
  const response = await fetch(`${BACKEND_URL}/api/encryption/decrypt`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ encrypted, key, nonce })
  });

  if (!response.ok) {
    throw new Error('Decryption failed');
  }

  const result = await response.json();
  return result.data;
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
