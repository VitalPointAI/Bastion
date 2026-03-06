import { chacha20poly1305 } from '@noble/ciphers/chacha.js';
import { randomBytes } from '@noble/ciphers/utils.js';
import { DIDDocument, EntityType } from './types.js';

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
): { encryptedDocument: Uint8Array; encryptedEntityType: Uint8Array; nonce: Uint8Array; entityTypeNonce: Uint8Array } {
  // Generate separate nonces for each encryption (required by @noble/ciphers)
  const nonce = randomBytes(NONCE_LENGTH);
  const entityTypeNonce = randomBytes(NONCE_LENGTH);

  // Encrypt document as JSON
  const documentBytes = new TextEncoder().encode(JSON.stringify(document));
  const documentCipher = chacha20poly1305(encryptionKey, nonce);
  const encryptedDocument = documentCipher.encrypt(documentBytes);

  // Encrypt entity type separately (for owner's local indexing)
  const entityTypeBytes = new TextEncoder().encode(entityType);
  const entityTypeCipher = chacha20poly1305(encryptionKey, entityTypeNonce);
  const encryptedEntityType = entityTypeCipher.encrypt(entityTypeBytes);

  return { encryptedDocument, encryptedEntityType, nonce, entityTypeNonce };
}

/**
 * Decrypt a DID document from on-chain storage
 * @param encryptedDocument - Encrypted document bytes
 * @param encryptedEntityType - Encrypted entity type bytes
 * @param nonce - Nonce used for document encryption
 * @param entityTypeNonce - Nonce used for entity type encryption
 * @param encryptionKey - 32-byte symmetric key
 * @returns Decrypted DID document and entity type
 */
export function decryptDIDDocument(
  encryptedDocument: Uint8Array,
  encryptedEntityType: Uint8Array,
  nonce: Uint8Array,
  entityTypeNonce: Uint8Array,
  encryptionKey: Uint8Array
): { document: DIDDocument; entityType: EntityType } {
  // Decrypt document with its cipher
  const documentCipher = chacha20poly1305(encryptionKey, nonce);
  const documentBytes = documentCipher.decrypt(encryptedDocument);
  const document = JSON.parse(new TextDecoder().decode(documentBytes)) as DIDDocument;

  // Decrypt entity type with its cipher (separate nonce)
  const entityTypeCipher = chacha20poly1305(encryptionKey, entityTypeNonce);
  const entityTypeBytes = entityTypeCipher.decrypt(encryptedEntityType);
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
