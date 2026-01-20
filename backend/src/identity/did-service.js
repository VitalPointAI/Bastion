"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DIDService = void 0;
exports.getDIDService = getDIDService;
var blinded_keys_1 = require("./blinded-keys");
var did_encryption_1 = require("./did-encryption");
var NEAR_RPC_URL = process.env.NEAR_RPC_URL || 'https://rpc.testnet.near.org';
var DID_CONTRACT_ID = process.env.DID_CONTRACT_ID || 'did-registry.testnet';
/**
 * DID Service - handles encrypted DID operations
 */
var DIDService = /** @class */ (function () {
    function DIDService(rpcUrl, contractId) {
        this.rpcUrl = rpcUrl || NEAR_RPC_URL;
        this.contractId = contractId || DID_CONTRACT_ID;
    }
    /**
     * Create and store a new DID
     * Handles encryption and blinded key derivation
     */
    DIDService.prototype.createDID = function (accountId, entityType, userSecret, publicKeyBase58) {
        return __awaiter(this, void 0, void 0, function () {
            var did, document, blindedKey, encryptionKey, _a, encryptedDocument, encryptedEntityType, nonce, entityTypeNonce;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        did = "did:near:".concat(accountId);
                        document = {
                            '@context': ['https://www.w3.org/ns/did/v1'],
                            id: did,
                            entityType: entityType,
                            publicKey: [{
                                    id: "".concat(did, "#key-1"),
                                    type: 'Ed25519VerificationKey2020',
                                    controller: did,
                                    publicKeyBase58: publicKeyBase58
                                }],
                            authentication: ["".concat(did, "#key-1")],
                            controller: [did],
                            created: new Date().toISOString(),
                            updated: new Date().toISOString()
                        };
                        blindedKey = (0, blinded_keys_1.deriveDIDBlindedKey)(userSecret, accountId);
                        encryptionKey = (0, did_encryption_1.deriveEncryptionKey)(userSecret);
                        _a = (0, did_encryption_1.encryptDIDDocument)(document, entityType, encryptionKey), encryptedDocument = _a.encryptedDocument, encryptedEntityType = _a.encryptedEntityType, nonce = _a.nonce, entityTypeNonce = _a.entityTypeNonce;
                        // Store on-chain (via NEAR RPC call)
                        return [4 /*yield*/, this.storeEncryptedDID(blindedKey, encryptedDocument, encryptedEntityType, nonce, entityTypeNonce)];
                    case 1:
                        // Store on-chain (via NEAR RPC call)
                        _b.sent();
                        return [2 /*return*/, { did: did, blindedKey: (0, blinded_keys_1.blindedKeyToHex)(blindedKey) }];
                }
            });
        });
    };
    /**
     * Resolve a DID by account ID
     * Requires user's secret to derive blinded key and decrypt
     */
    DIDService.prototype.resolveDID = function (accountId, userSecret) {
        return __awaiter(this, void 0, void 0, function () {
            var blindedKey, encryptedEntry, encryptionKey, document;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        blindedKey = (0, blinded_keys_1.deriveDIDBlindedKey)(userSecret, accountId);
                        return [4 /*yield*/, this.getEncryptedDID(blindedKey)];
                    case 1:
                        encryptedEntry = _a.sent();
                        if (!encryptedEntry) {
                            return [2 /*return*/, null];
                        }
                        encryptionKey = (0, did_encryption_1.deriveEncryptionKey)(userSecret);
                        document = (0, did_encryption_1.decryptDIDDocument)(encryptedEntry.encryptedDocument, encryptedEntry.encryptedEntityType, encryptedEntry.nonce, encryptedEntry.entityTypeNonce, encryptionKey).document;
                        return [2 /*return*/, document];
                }
            });
        });
    };
    /**
     * Check if a DID is active (without decryption)
     */
    DIDService.prototype.isDIDActive = function (accountId, userSecret) {
        return __awaiter(this, void 0, void 0, function () {
            var blindedKey;
            return __generator(this, function (_a) {
                blindedKey = (0, blinded_keys_1.deriveDIDBlindedKey)(userSecret, accountId);
                return [2 /*return*/, this.checkDIDActive(blindedKey)];
            });
        });
    };
    // Private: NEAR RPC calls
    DIDService.prototype.storeEncryptedDID = function (blindedKey, encryptedDocument, encryptedEntityType, nonce, entityTypeNonce) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                // This will be a signed transaction to the contract
                // For now, structure the call - actual signing happens via wallet
                console.log('Store DID - blinded key length:', blindedKey.length);
                console.log('Store DID - nonces:', nonce.length, entityTypeNonce.length);
                return [2 /*return*/];
            });
        });
    };
    DIDService.prototype.getEncryptedDID = function (blindedKey) {
        return __awaiter(this, void 0, void 0, function () {
            var response, result, decoded, error_1;
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _b.trys.push([0, 3, , 4]);
                        return [4 /*yield*/, fetch(this.rpcUrl, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    jsonrpc: '2.0',
                                    id: 'dontcare',
                                    method: 'query',
                                    params: {
                                        request_type: 'call_function',
                                        finality: 'final',
                                        account_id: this.contractId,
                                        method_name: 'get_did',
                                        args_base64: Buffer.from(JSON.stringify({
                                            blinded_key: Array.from(blindedKey)
                                        })).toString('base64')
                                    }
                                })
                            })];
                    case 1:
                        response = _b.sent();
                        return [4 /*yield*/, response.json()];
                    case 2:
                        result = _b.sent();
                        if ((_a = result.result) === null || _a === void 0 ? void 0 : _a.result) {
                            decoded = JSON.parse(Buffer.from(result.result.result).toString());
                            if (!decoded)
                                return [2 /*return*/, null];
                            return [2 /*return*/, {
                                    encryptedDocument: new Uint8Array(decoded.encrypted_document),
                                    encryptedEntityType: new Uint8Array(decoded.encrypted_entity_type),
                                    nonce: new Uint8Array(decoded.nonce),
                                    entityTypeNonce: new Uint8Array(decoded.entity_type_nonce),
                                    createdAt: decoded.created_at,
                                    updatedAt: decoded.updated_at,
                                    active: decoded.active,
                                    owner: decoded.owner
                                }];
                        }
                        return [2 /*return*/, null];
                    case 3:
                        error_1 = _b.sent();
                        console.error('Failed to fetch DID:', error_1);
                        return [2 /*return*/, null];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    DIDService.prototype.checkDIDActive = function (blindedKey) {
        return __awaiter(this, void 0, void 0, function () {
            var response, result, error_2;
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _b.trys.push([0, 3, , 4]);
                        return [4 /*yield*/, fetch(this.rpcUrl, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    jsonrpc: '2.0',
                                    id: 'dontcare',
                                    method: 'query',
                                    params: {
                                        request_type: 'call_function',
                                        finality: 'final',
                                        account_id: this.contractId,
                                        method_name: 'is_did_active',
                                        args_base64: Buffer.from(JSON.stringify({
                                            blinded_key: Array.from(blindedKey)
                                        })).toString('base64')
                                    }
                                })
                            })];
                    case 1:
                        response = _b.sent();
                        return [4 /*yield*/, response.json()];
                    case 2:
                        result = _b.sent();
                        if ((_a = result.result) === null || _a === void 0 ? void 0 : _a.result) {
                            return [2 /*return*/, JSON.parse(Buffer.from(result.result.result).toString())];
                        }
                        return [2 /*return*/, false];
                    case 3:
                        error_2 = _b.sent();
                        console.error('Failed to check DID status:', error_2);
                        return [2 /*return*/, false];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    return DIDService;
}());
exports.DIDService = DIDService;
// Singleton instance
var serviceInstance = null;
function getDIDService() {
    if (!serviceInstance) {
        serviceInstance = new DIDService();
    }
    return serviceInstance;
}
