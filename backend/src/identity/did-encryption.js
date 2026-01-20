"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.encryptDIDDocument = encryptDIDDocument;
exports.decryptDIDDocument = decryptDIDDocument;
exports.deriveEncryptionKey = deriveEncryptionKey;
exports.encryptEntityType = encryptEntityType;
var chacha_js_1 = require("@noble/ciphers/chacha.js");
var utils_js_1 = require("@noble/ciphers/utils.js");
var NONCE_LENGTH = 12; // ChaCha20-Poly1305 nonce
/**
 * Encrypt a DID document for on-chain storage
 * Uses ChaCha20-Poly1305 (already used in Phase 1 for IPFS)
 * @param document - Plaintext DID document
 * @param entityType - Entity type (encrypted separately for owner indexing)
 * @param encryptionKey - 32-byte symmetric key (derived from user secret)
 * @returns Encrypted entry ready for on-chain storage
 */
function encryptDIDDocument(document, entityType, encryptionKey) {
    // Generate separate nonces for each encryption (required by @noble/ciphers)
    var nonce = (0, utils_js_1.randomBytes)(NONCE_LENGTH);
    var entityTypeNonce = (0, utils_js_1.randomBytes)(NONCE_LENGTH);
    // Encrypt document as JSON
    var documentBytes = new TextEncoder().encode(JSON.stringify(document));
    var documentCipher = (0, chacha_js_1.chacha20poly1305)(encryptionKey, nonce);
    var encryptedDocument = documentCipher.encrypt(documentBytes);
    // Encrypt entity type separately (for owner's local indexing)
    var entityTypeBytes = new TextEncoder().encode(entityType);
    var entityTypeCipher = (0, chacha_js_1.chacha20poly1305)(encryptionKey, entityTypeNonce);
    var encryptedEntityType = entityTypeCipher.encrypt(entityTypeBytes);
    return { encryptedDocument: encryptedDocument, encryptedEntityType: encryptedEntityType, nonce: nonce, entityTypeNonce: entityTypeNonce };
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
function decryptDIDDocument(encryptedDocument, encryptedEntityType, nonce, entityTypeNonce, encryptionKey) {
    // Decrypt document with its cipher
    var documentCipher = (0, chacha_js_1.chacha20poly1305)(encryptionKey, nonce);
    var documentBytes = documentCipher.decrypt(encryptedDocument);
    var document = JSON.parse(new TextDecoder().decode(documentBytes));
    // Decrypt entity type with its cipher (separate nonce)
    var entityTypeCipher = (0, chacha_js_1.chacha20poly1305)(encryptionKey, entityTypeNonce);
    var entityTypeBytes = entityTypeCipher.decrypt(encryptedEntityType);
    var entityType = new TextDecoder().decode(entityTypeBytes);
    return { document: document, entityType: entityType };
}
/**
 * Derive encryption key from user secret
 * Different from blinded key to maintain separation of concerns
 */
function deriveEncryptionKey(userSecret) {
    // Use first 32 bytes of user secret as encryption key
    // In production, derive with additional context
    return userSecret.slice(0, 32);
}
/**
 * Encrypt entity type string for storage
 */
function encryptEntityType(entityType, encryptionKey) {
    var nonce = (0, utils_js_1.randomBytes)(NONCE_LENGTH);
    var cipher = (0, chacha_js_1.chacha20poly1305)(encryptionKey, nonce);
    var encrypted = cipher.encrypt(new TextEncoder().encode(entityType));
    return { encrypted: encrypted, nonce: nonce };
}
