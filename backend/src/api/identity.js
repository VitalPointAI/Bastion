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
var express_1 = require("express");
var did_service_1 = require("../identity/did-service");
var blinded_keys_1 = require("../identity/blinded-keys");
var router = (0, express_1.Router)();
var didService = (0, did_service_1.getDIDService)();
/**
 * POST /api/identity/did/create
 * Create a new DID (requires user secret in secure header)
 */
router.post('/did/create', function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var _a, accountId, entityType, publicKeyBase58, userSecretHex, validEntityTypes, userSecret, result, error_1;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                _b.trys.push([0, 2, , 3]);
                _a = req.body, accountId = _a.accountId, entityType = _a.entityType, publicKeyBase58 = _a.publicKeyBase58;
                userSecretHex = req.headers['x-user-secret'];
                if (!userSecretHex) {
                    res.status(401).json({ error: 'User secret required for DID creation' });
                    return [2 /*return*/];
                }
                if (!accountId || !entityType || !publicKeyBase58) {
                    res.status(400).json({ error: 'accountId, entityType, and publicKeyBase58 required' });
                    return [2 /*return*/];
                }
                validEntityTypes = ['Human', 'AiAgent', 'Vehicle', 'Mission', 'DataObject', 'Organization', 'Resource'];
                if (!validEntityTypes.includes(entityType)) {
                    res.status(400).json({ error: 'Invalid entityType', validEntityTypes: validEntityTypes });
                    return [2 /*return*/];
                }
                userSecret = (0, blinded_keys_1.hexToBlindedKey)(userSecretHex);
                return [4 /*yield*/, didService.createDID(accountId, entityType, userSecret, publicKeyBase58)];
            case 1:
                result = _b.sent();
                res.json({
                    success: true,
                    did: result.did,
                    blindedKey: result.blindedKey,
                    message: 'DID created and stored encrypted on-chain'
                });
                return [3 /*break*/, 3];
            case 2:
                error_1 = _b.sent();
                console.error('DID creation error:', error_1);
                res.status(500).json({ error: 'Failed to create DID' });
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); });
/**
 * POST /api/identity/did/resolve
 * Resolve a DID (requires user secret for decryption)
 */
router.post('/did/resolve', function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var accountId, userSecretHex, userSecret, document_1, error_2;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                accountId = req.body.accountId;
                userSecretHex = req.headers['x-user-secret'];
                if (!userSecretHex) {
                    res.status(401).json({ error: 'User secret required for DID resolution' });
                    return [2 /*return*/];
                }
                if (!accountId) {
                    res.status(400).json({ error: 'accountId required' });
                    return [2 /*return*/];
                }
                userSecret = (0, blinded_keys_1.hexToBlindedKey)(userSecretHex);
                return [4 /*yield*/, didService.resolveDID(accountId, userSecret)];
            case 1:
                document_1 = _a.sent();
                if (!document_1) {
                    res.status(404).json({ error: 'DID not found or unable to decrypt' });
                    return [2 /*return*/];
                }
                res.json({ document: document_1 });
                return [3 /*break*/, 3];
            case 2:
                error_2 = _a.sent();
                console.error('DID resolution error:', error_2);
                res.status(500).json({ error: 'Failed to resolve DID' });
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); });
/**
 * POST /api/identity/did/check-active
 * Check if a DID is active (without full decryption)
 */
router.post('/did/check-active', function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var accountId, userSecretHex, userSecret, active, error_3;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                accountId = req.body.accountId;
                userSecretHex = req.headers['x-user-secret'];
                if (!userSecretHex || !accountId) {
                    res.status(400).json({ error: 'accountId and user secret required' });
                    return [2 /*return*/];
                }
                userSecret = (0, blinded_keys_1.hexToBlindedKey)(userSecretHex);
                return [4 /*yield*/, didService.isDIDActive(accountId, userSecret)];
            case 1:
                active = _a.sent();
                res.json({ accountId: accountId, active: active });
                return [3 /*break*/, 3];
            case 2:
                error_3 = _a.sent();
                console.error('DID status check error:', error_3);
                res.status(500).json({ error: 'Failed to check DID status' });
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); });
/**
 * POST /api/identity/derive-blinded-key
 * Derive a blinded key (utility endpoint)
 */
router.post('/derive-blinded-key', function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var accountId, userSecretHex, userSecret, blindedKey;
    return __generator(this, function (_a) {
        try {
            accountId = req.body.accountId;
            userSecretHex = req.headers['x-user-secret'];
            if (!userSecretHex || !accountId) {
                res.status(400).json({ error: 'accountId and user secret required' });
                return [2 /*return*/];
            }
            userSecret = (0, blinded_keys_1.hexToBlindedKey)(userSecretHex);
            blindedKey = (0, blinded_keys_1.deriveDIDBlindedKey)(userSecret, accountId);
            res.json({
                accountId: accountId,
                blindedKey: (0, blinded_keys_1.blindedKeyToHex)(blindedKey)
            });
        }
        catch (error) {
            console.error('Key derivation error:', error);
            res.status(500).json({ error: 'Failed to derive blinded key' });
        }
        return [2 /*return*/];
    });
}); });
/**
 * GET /api/identity/entity-types
 * List valid entity types
 */
router.get('/entity-types', function (req, res) {
    res.json({
        entityTypes: ['Human', 'AiAgent', 'Vehicle', 'Mission', 'DataObject', 'Organization', 'Resource'],
        description: {
            Human: 'Human users with authentication',
            AiAgent: 'AI agents and autonomous systems',
            Vehicle: 'Vehicles and platforms',
            Mission: 'Mission definitions',
            DataObject: 'Data objects with classification',
            Organization: 'Organizations and units',
            Resource: 'Other trackable resources'
        }
    });
});
exports.default = router;
