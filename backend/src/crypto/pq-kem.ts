import { ml_kem768 } from '@noble/post-quantum/ml-kem';
import { x25519 } from '@noble/curves/ed25519';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils';
import { hkdf } from '@noble/hashes/hkdf';
import { sha256 } from '@noble/hashes/sha2';
import { HybridKeyPair, EncapsulationResult, SerializedKeyPair } from './types';

// KDF info parameter as bytes
const KDF_INFO = new TextEncoder().encode('BASTION-KEM-v1');

/**
 * Generate hybrid key pair (ML-KEM-768 + X25519)
 * Uses both post-quantum and classical algorithms for defense in depth
 */
export function generateHybridKeyPair(): HybridKeyPair {
  // Generate ML-KEM-768 key pair
  const pqKeys = ml_kem768.keygen();

  // Generate X25519 key pair
  const classicalSecret = x25519.utils.randomSecretKey();
  const classicalPublic = x25519.getPublicKey(classicalSecret);

  // Combine keys (PQ || classical)
  const publicKey = new Uint8Array([...pqKeys.publicKey, ...classicalPublic]);
  const secretKey = new Uint8Array([...pqKeys.secretKey, ...classicalSecret]);

  return {
    publicKey,
    secretKey,
    algorithm: 'ML-KEM-768-X25519'
  };
}

/**
 * Encapsulate a shared secret using recipient's hybrid public key
 * Returns ciphertext that only recipient can decapsulate
 */
export function encapsulate(recipientPublicKey: Uint8Array): EncapsulationResult {
  // Split combined public key
  const pqPublicKey = recipientPublicKey.slice(0, 1184);  // ML-KEM-768 public key size
  const classicalPublicKey = recipientPublicKey.slice(1184);  // X25519 = 32 bytes

  // ML-KEM encapsulation
  const pqResult = ml_kem768.encapsulate(pqPublicKey);

  // X25519 key exchange
  const ephemeralSecret = x25519.utils.randomSecretKey();
  const ephemeralPublic = x25519.getPublicKey(ephemeralSecret);
  const classicalSharedSecret = x25519.getSharedSecret(ephemeralSecret, classicalPublicKey);

  // Combine ciphertexts (PQ ciphertext || ephemeral public key)
  const cipherText = new Uint8Array([...pqResult.cipherText, ...ephemeralPublic]);

  // Derive final shared secret from both (XOR then KDF for security)
  const combinedSecret = new Uint8Array(32);
  for (let i = 0; i < 32; i++) {
    combinedSecret[i] = pqResult.sharedSecret[i] ^ classicalSharedSecret[i];
  }

  // KDF for uniformity
  const sharedSecret = hkdf(sha256, combinedSecret, undefined, KDF_INFO, 32);

  return { cipherText, sharedSecret };
}

/**
 * Decapsulate shared secret using own secret key
 */
export function decapsulate(cipherText: Uint8Array, secretKey: Uint8Array): Uint8Array {
  // Split combined secret key
  const pqSecretKey = secretKey.slice(0, 2400);  // ML-KEM-768 secret key size
  const classicalSecretKey = secretKey.slice(2400);  // X25519 = 32 bytes

  // Split ciphertext
  const pqCipherText = cipherText.slice(0, 1088);  // ML-KEM-768 ciphertext size
  const ephemeralPublic = cipherText.slice(1088);   // X25519 = 32 bytes

  // ML-KEM decapsulation
  const pqSharedSecret = ml_kem768.decapsulate(pqCipherText, pqSecretKey);

  // X25519 key exchange
  const classicalSharedSecret = x25519.getSharedSecret(classicalSecretKey, ephemeralPublic);

  // Combine secrets (same as encapsulate)
  const combinedSecret = new Uint8Array(32);
  for (let i = 0; i < 32; i++) {
    combinedSecret[i] = pqSharedSecret[i] ^ classicalSharedSecret[i];
  }

  // KDF for uniformity
  return hkdf(sha256, combinedSecret, undefined, KDF_INFO, 32);
}

/**
 * Serialize key pair for storage
 */
export function serializeKeyPair(keyPair: HybridKeyPair): SerializedKeyPair {
  return {
    publicKeyHex: bytesToHex(keyPair.publicKey),
    secretKeyHex: bytesToHex(keyPair.secretKey),
    algorithm: keyPair.algorithm
  };
}

/**
 * Deserialize key pair from storage
 */
export function deserializeKeyPair(serialized: SerializedKeyPair): HybridKeyPair {
  if (serialized.algorithm !== 'ML-KEM-768-X25519') {
    throw new Error(`Unsupported algorithm: ${serialized.algorithm}`);
  }
  return {
    publicKey: hexToBytes(serialized.publicKeyHex),
    secretKey: hexToBytes(serialized.secretKeyHex),
    algorithm: 'ML-KEM-768-X25519'
  };
}
