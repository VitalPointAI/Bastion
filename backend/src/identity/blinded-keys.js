"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deriveDIDBlindedKey = deriveDIDBlindedKey;
exports.deriveCredentialBlindedKey = deriveCredentialBlindedKey;
exports.deriveRevocationBlindedKey = deriveRevocationBlindedKey;
exports.deriveUserSecret = deriveUserSecret;
exports.blindedKeyToHex = blindedKeyToHex;
exports.hexToBlindedKey = hexToBlindedKey;
var hkdf_js_1 = require("@noble/hashes/hkdf.js");
var sha2_js_1 = require("@noble/hashes/sha2.js");
var utils_js_1 = require("@noble/hashes/utils.js");
/**
 * Derive a blinded key for DID lookup
 * This key is used as the storage key on-chain
 * @param userSecret - User's secret key material (from NEAR key or derived)
 * @param accountId - NEAR account ID
 * @returns 32-byte blinded key
 */
function deriveDIDBlindedKey(userSecret, accountId) {
    var salt = (0, utils_js_1.utf8ToBytes)(accountId);
    var info = (0, utils_js_1.utf8ToBytes)('bastion-did-v1');
    return (0, hkdf_js_1.hkdf)(sha2_js_1.sha256, userSecret, salt, info, 32);
}
/**
 * Derive a blinded key for credential lookup
 * @param userSecret - Issuer's secret key material
 * @param credentialHash - Hash of the credential
 * @returns 32-byte blinded key
 */
function deriveCredentialBlindedKey(userSecret, credentialHash) {
    var salt = (0, utils_js_1.utf8ToBytes)(credentialHash);
    var info = (0, utils_js_1.utf8ToBytes)('bastion-credential-v1');
    return (0, hkdf_js_1.hkdf)(sha2_js_1.sha256, userSecret, salt, info, 32);
}
/**
 * Derive a separate blinded key for revocation checks
 * Different from credential key to prevent correlation
 * @param userSecret - Issuer's secret key material
 * @param credentialHash - Hash of the credential
 * @returns 32-byte blinded revocation key
 */
function deriveRevocationBlindedKey(userSecret, credentialHash) {
    var salt = (0, utils_js_1.utf8ToBytes)(credentialHash);
    var info = (0, utils_js_1.utf8ToBytes)('bastion-revocation-v1');
    return (0, hkdf_js_1.hkdf)(sha2_js_1.sha256, userSecret, salt, info, 32);
}
/**
 * Derive user secret from NEAR account key
 * This is deterministic so user can always recover their blinded keys
 * @param nearPrivateKey - User's NEAR private key
 * @param purpose - Purpose string for domain separation
 * @returns 32-byte derived secret
 */
function deriveUserSecret(nearPrivateKey, purpose) {
    var salt = (0, utils_js_1.utf8ToBytes)('bastion-user-secret');
    var info = (0, utils_js_1.utf8ToBytes)(purpose);
    return (0, hkdf_js_1.hkdf)(sha2_js_1.sha256, nearPrivateKey, salt, info, 32);
}
// Hex conversion utilities
function blindedKeyToHex(key) {
    return (0, utils_js_1.bytesToHex)(key);
}
function hexToBlindedKey(hex) {
    return (0, utils_js_1.hexToBytes)(hex);
}
