import { chacha20poly1305 } from '@noble/ciphers/chacha';
import { randomBytes } from '@noble/ciphers/utils';
import { DIDDocument, EntityType, EncryptedDIDEntry } from './types.js';

const NONCE_LENGTH = 12; // ChaCha20-Poly1305 nonce

/**
 * Encrypt a DID document for on-chain storage
 * Uses ChaCha20-Poly1305 (already used in Phase 1 for IPFS)
 * @param document - Plaintext DID document
 * @param entityType - Entity type (encrypted separately for owner indexing)
 * @param encryptionKey - 32-byte symmetric key (derived from user secret)
 * @returns Encrypted entry ready for on-chain storage
 */
export function encryptDIDDocument(
  document: DIDDocument,
  entityType: EntityType,
  encryptionKey: Uint8Array
): { encryptedDocument: Uint8Array; encryptedEntityType: Uint8Array; nonce: Uint8Array } {
  const nonce = randomBytes(NONCE_LENGTH);
  const cipher = chacha20poly1305(encryptionKey, nonce);

  // Encrypt document as JSON
  const documentBytes = new TextEncoder().encode(JSON.stringify(document));
  const encryptedDocument = cipher.encrypt(documentBytes);

  // Encrypt entity type separately (for owner's local indexing)
  const entityTypeBytes = new TextEncoder().encode(entityType);
  const encryptedEntityType = cipher.encrypt(entityTypeBytes);

  return { encryptedDocument, encryptedEntityType, nonce };
}

/**
 * Decrypt a DID document from on-chain storage
 * @param encryptedEntry - Encrypted entry from chain
 * @param encryptionKey - 32-byte symmetric key
 * @returns Decrypted DID document and entity type
 */
export function decryptDIDDocument(
  encryptedDocument: Uint8Array,
  encryptedEntityType: Uint8Array,
  nonce: Uint8Array,
  encryptionKey: Uint8Array
): { document: DIDDocument; entityType: EntityType } {
  const cipher = chacha20poly1305(encryptionKey, nonce);

  // Decrypt document
  const documentBytes = cipher.decrypt(encryptedDocument);
  const document = JSON.parse(new TextDecoder().decode(documentBytes)) as DIDDocument;

  // Decrypt entity type
  const entityTypeBytes = cipher.decrypt(encryptedEntityType);
  const entityType = new TextDecoder().decode(entityTypeBytes) as EntityType;

  return { document, entityType };
}

/**
 * Derive encryption key from user secret
 * Different from blinded key to maintain separation of concerns
 */
export function deriveEncryptionKey(userSecret: Uint8Array): Uint8Array {
  // Use first 32 bytes of user secret as encryption key
  // In production, derive with additional context
  return userSecret.slice(0, 32);
}

/**
 * Encrypt entity type string for storage
 */
export function encryptEntityType(entityType: EntityType, encryptionKey: Uint8Array): { encrypted: Uint8Array; nonce: Uint8Array } {
  const nonce = randomBytes(NONCE_LENGTH);
  const cipher = chacha20poly1305(encryptionKey, nonce);
  const encrypted = cipher.encrypt(new TextEncoder().encode(entityType));
  return { encrypted, nonce };
}
