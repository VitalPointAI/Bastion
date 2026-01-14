---
phase: 02-identity-security-framework
plan: 05
type: execute
---

<objective>
Implement post-quantum cryptography utilities using hybrid key encapsulation and signatures.

Purpose: Future-proof classified data protection against quantum computing threats by implementing ML-KEM (Kyber) + X25519 hybrid key exchange and ML-DSA (Dilithium) signatures alongside classical cryptography.

Output: Working PQ crypto utilities for key encapsulation, signatures, and hybrid mode operations with proper key storage patterns.
</objective>

<execution_context>
~/.claude/get-shit-done/workflows/execute-phase.md
~/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/phases/02-identity-security-framework/2-RESEARCH.md
@.planning/phases/02-identity-security-framework/2-CONTEXT.md
@backend/src/lib/encryption.ts

**Tech stack available:** Node.js, TypeScript, @noble/ciphers (already installed)
**Established patterns:** Crypto utilities in backend/src/lib/
**Key insight from research:** PQ keys are MUCH larger than classical keys (ML-KEM-768 public key = 1,184 bytes vs X25519 = 32 bytes)

**From 2-RESEARCH.md:**
- @noble/post-quantum for ML-KEM and ML-DSA
- Hybrid mode (PQ + classical) recommended until audits complete
- ML-KEM-768 for key encapsulation
- ML-DSA-65 for signatures
</context>

<tasks>

<task type="auto">
  <name>Task 1: Implement hybrid key encapsulation (ML-KEM-768 + X25519)</name>
  <files>backend/src/crypto/pq-kem.ts, backend/src/crypto/types.ts</files>
  <action>
Create post-quantum key encapsulation module with hybrid mode.

**Install dependencies:**
```bash
cd backend && pnpm add @noble/post-quantum @noble/curves
```

**Create directory:**
```bash
mkdir -p backend/src/crypto
```

**backend/src/crypto/types.ts:**
```typescript
// Key pair types for PQ crypto
export interface HybridKeyPair {
  publicKey: Uint8Array;   // Combined PQ + classical public key
  secretKey: Uint8Array;   // Combined PQ + classical secret key
  algorithm: 'ML-KEM-768-X25519';
}

export interface EncapsulationResult {
  cipherText: Uint8Array;      // Encapsulated key material
  sharedSecret: Uint8Array;    // 32-byte shared secret for symmetric encryption
}

export interface PQSigningKeyPair {
  publicKey: Uint8Array;   // ML-DSA-65 public key (~1,952 bytes)
  secretKey: Uint8Array;   // ML-DSA-65 secret key (~4,032 bytes)
  algorithm: 'ML-DSA-65';
}

// Serialization helpers for storage/transmission
export interface SerializedKeyPair {
  publicKeyHex: string;
  secretKeyHex: string;
  algorithm: string;
}
```

**backend/src/crypto/pq-kem.ts:**
```typescript
import { ml_kem768 } from '@noble/post-quantum/ml-kem';
import { x25519 } from '@noble/curves/ed25519';
import { bytesToHex, hexToBytes } from '@noble/post-quantum/utils';
import { hkdf } from '@noble/hashes/hkdf';
import { sha256 } from '@noble/hashes/sha256';
import { HybridKeyPair, EncapsulationResult, SerializedKeyPair } from './types';

/**
 * Generate hybrid key pair (ML-KEM-768 + X25519)
 * Uses both post-quantum and classical algorithms for defense in depth
 */
export function generateHybridKeyPair(): HybridKeyPair {
  // Generate ML-KEM-768 key pair
  const pqKeys = ml_kem768.keygen();

  // Generate X25519 key pair
  const classicalSecret = x25519.utils.randomPrivateKey();
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
  const ephemeralSecret = x25519.utils.randomPrivateKey();
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
  const sharedSecret = hkdf(sha256, combinedSecret, undefined, 'BASTION-KEM-v1', 32);

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
  return hkdf(sha256, combinedSecret, undefined, 'BASTION-KEM-v1', 32);
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
```

**What to avoid:**
- Don't use PQ-only mode yet (library not audited)
- Don't store secret keys in plain text
- Don't reuse ephemeral keys
- Don't skip KDF on combined secrets
  </action>
  <verify>cd /home/vitalpointai/projects/ssr/backend && pnpm tsc --noEmit shows no TypeScript errors</verify>
  <done>Hybrid KEM module created with ML-KEM-768 + X25519 combination</done>
</task>

<task type="auto">
  <name>Task 2: Implement ML-DSA signatures for credential signing</name>
  <files>backend/src/crypto/pq-signatures.ts</files>
  <action>
Create post-quantum signature module for signing verifiable credentials.

**backend/src/crypto/pq-signatures.ts:**
```typescript
import { ml_dsa65 } from '@noble/post-quantum/ml-dsa';
import { bytesToHex, hexToBytes } from '@noble/post-quantum/utils';
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
```

**Create index file for crypto module:**
```typescript
// backend/src/crypto/index.ts
export * from './types';
export * from './pq-kem';
export * from './pq-signatures';
```

**What to avoid:**
- Don't use simple JSON.stringify (non-deterministic key order)
- Don't expose secret keys in error messages
- Don't assume signature size is small (3KB signatures)
  </action>
  <verify>cd /home/vitalpointai/projects/ssr/backend && pnpm tsc --noEmit shows no TypeScript errors</verify>
  <done>ML-DSA signature module created with JSON signing utilities</done>
</task>

</tasks>

<verification>
Before declaring plan complete:
- [ ] `pnpm tsc --noEmit` in backend passes without errors
- [ ] Hybrid KEM generates combined PQ + classical keys
- [ ] Encapsulate/decapsulate round-trip produces same shared secret
- [ ] ML-DSA sign/verify round-trip works correctly
- [ ] JSON signing produces deterministic signatures
</verification>

<success_criteria>
- Hybrid KEM (ML-KEM-768 + X25519) implemented
- ML-DSA-65 signatures implemented
- JSON signing with canonical serialization
- Key serialization/deserialization for storage
- All modules export cleanly
</success_criteria>

<output>
After completion, create `.planning/phases/02-identity-security-framework/2-05-SUMMARY.md`
</output>
