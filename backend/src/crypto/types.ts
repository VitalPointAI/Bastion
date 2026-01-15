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
