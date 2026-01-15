import { ml_dsa65 } from '@noble/post-quantum/ml-dsa';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils';
import { PQSigningKeyPair, SerializedKeyPair } from './types';

/**
 * Generate ML-DSA-65 signing key pair
 * ML-DSA-65 provides ~128-bit security level (NIST Level 3)
 */
export function generateSigningKeyPair(): PQSigningKeyPair {
  const keys = ml_dsa65.keygen();
  return {
    publicKey: keys.publicKey,
    secretKey: keys.secretKey,
    algorithm: 'ML-DSA-65'
  };
}

/**
 * Sign a message with ML-DSA-65
 * @param message - Data to sign (will be encoded to UTF-8 if string)
 * @param secretKey - ML-DSA-65 secret key
 * @returns Signature bytes (~3,309 bytes for ML-DSA-65)
 */
export function sign(message: string | Uint8Array, secretKey: Uint8Array): Uint8Array {
  const messageBytes = typeof message === 'string'
    ? new TextEncoder().encode(message)
    : message;

  return ml_dsa65.sign(messageBytes, secretKey);
}

/**
 * Verify a signature
 * @param signature - Signature bytes
 * @param message - Original message
 * @param publicKey - ML-DSA-65 public key
 * @returns true if signature is valid
 */
export function verify(
  signature: Uint8Array,
  message: string | Uint8Array,
  publicKey: Uint8Array
): boolean {
  const messageBytes = typeof message === 'string'
    ? new TextEncoder().encode(message)
    : message;

  return ml_dsa65.verify(signature, messageBytes, publicKey);
}

/**
 * Sign a JSON object (canonical serialization)
 * For verifiable credentials, use deterministic JSON serialization
 */
export function signJSON(obj: object, secretKey: Uint8Array): string {
  // Sort keys for canonical form
  const canonical = JSON.stringify(obj, Object.keys(obj).sort());
  const signature = sign(canonical, secretKey);
  return bytesToHex(signature);
}

/**
 * Verify a JSON object signature
 */
export function verifyJSON(
  obj: object,
  signatureHex: string,
  publicKey: Uint8Array
): boolean {
  const canonical = JSON.stringify(obj, Object.keys(obj).sort());
  const signature = hexToBytes(signatureHex);
  return verify(signature, canonical, publicKey);
}

/**
 * Serialize signing key pair for storage
 */
export function serializeSigningKeyPair(keyPair: PQSigningKeyPair): SerializedKeyPair {
  return {
    publicKeyHex: bytesToHex(keyPair.publicKey),
    secretKeyHex: bytesToHex(keyPair.secretKey),
    algorithm: keyPair.algorithm
  };
}

/**
 * Deserialize signing key pair from storage
 */
export function deserializeSigningKeyPair(serialized: SerializedKeyPair): PQSigningKeyPair {
  if (serialized.algorithm !== 'ML-DSA-65') {
    throw new Error(`Unsupported algorithm: ${serialized.algorithm}`);
  }
  return {
    publicKey: hexToBytes(serialized.publicKeyHex),
    secretKey: hexToBytes(serialized.secretKeyHex),
    algorithm: 'ML-DSA-65'
  };
}

/**
 * Get signature size for ML-DSA-65 (for storage planning)
 */
export const ML_DSA_65_SIGNATURE_SIZE = 3309;
export const ML_DSA_65_PUBLIC_KEY_SIZE = 1952;
export const ML_DSA_65_SECRET_KEY_SIZE = 4032;
