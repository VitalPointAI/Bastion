"use strict";
// Account Management API
// Creates NEAR accounts and tracks MPC derivation paths
// Actual key management handled by Chain Signatures MPC (user-owned)
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
var mpc_accounts_js_1 = require("../lib/mpc-accounts.js");
var database_js_1 = require("../lib/database.js");
var router = express_1.default.Router();
/**
 * POST /api/accounts/create
 *
 * Create NEAR account for authenticated Privy user
 * Account is created on-chain, keys managed by Chain Signatures MPC
 *
 * Request body:
 * {
 *   privyUserId: string,
 *   email: string,
 *   authToken: string (Privy JWT - for verification)
 * }
 *
 * Response:
 * {
 *   accountId: string,           // NEAR account ID (bastion-xxx.testnet)
 *   derivationPath: string,      // MPC derivation path
 *   mpcContractId: string,       // Chain Signatures MPC contract
 *   status: 'pending' | 'created'
 * }
 */
router.post('/create', function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var _a, privyUserId, email, authToken, existingAccount, mpcManager, account, error_1;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                _b.trys.push([0, 4, , 5]);
                _a = req.body, privyUserId = _a.privyUserId, email = _a.email, authToken = _a.authToken;
                // Validate required fields
                if (!privyUserId || !email) {
                    return [2 /*return*/, res.status(400).json({
                            error: 'Missing required fields: privyUserId, email',
                        })];
                }
                // TODO: Verify Privy JWT token
                // Production: Verify authToken with Privy's API
                // For v1, trust the frontend (behind auth)
                if (!authToken) {
                    return [2 /*return*/, res.status(401).json({
                            error: 'Authentication token required',
                        })];
                }
                return [4 /*yield*/, (0, database_js_1.getPool)().query('SELECT near_account_id, derivation_path FROM user_accounts WHERE privy_user_id = $1', [privyUserId])];
            case 1:
                existingAccount = _b.sent();
                if (existingAccount.rows.length > 0) {
                    // Account already exists
                    return [2 /*return*/, res.json({
                            accountId: existingAccount.rows[0].near_account_id,
                            derivationPath: existingAccount.rows[0].derivation_path,
                            mpcContractId: process.env.NEAR_NETWORK === 'mainnet'
                                ? 'v1.signer-prod.near'
                                : 'v1.signer-prod.testnet',
                            status: 'created',
                        })];
                }
                mpcManager = (0, mpc_accounts_js_1.getMPCAccountManager)(process.env.NEAR_NETWORK === 'mainnet' ? 'mainnet' : 'testnet');
                return [4 /*yield*/, mpcManager.createNEARAccount(privyUserId, email)];
            case 2:
                account = _b.sent();
                // Store account mapping in database
                return [4 /*yield*/, (0, database_js_1.getPool)().query("INSERT INTO user_accounts\n       (privy_user_id, email, near_account_id, derivation_path, mpc_public_key, created_at)\n       VALUES ($1, $2, $3, $4, $5, NOW())", [privyUserId, email, account.nearAccountId, account.derivationPath, account.mpcPublicKey])];
            case 3:
                // Store account mapping in database
                _b.sent();
                console.log('NEAR account created:', {
                    privyUserId: privyUserId,
                    email: email,
                    accountId: account.nearAccountId,
                    derivationPath: account.derivationPath,
                    onChain: account.onChain,
                });
                res.json({
                    accountId: account.nearAccountId,
                    derivationPath: account.derivationPath,
                    mpcContractId: process.env.NEAR_NETWORK === 'mainnet'
                        ? 'v1.signer-prod.near'
                        : 'v1.signer-prod.testnet',
                    mpcPublicKey: account.mpcPublicKey,
                    onChain: account.onChain,
                    status: account.onChain ? 'created' : 'pending',
                });
                return [3 /*break*/, 5];
            case 4:
                error_1 = _b.sent();
                console.error('Account creation error:', error_1);
                res.status(500).json({
                    error: 'Failed to create account',
                    details: error_1 instanceof Error ? error_1.message : 'Unknown error',
                });
                return [3 /*break*/, 5];
            case 5: return [2 /*return*/];
        }
    });
}); });
/**
 * GET /api/accounts/:privyUserId
 *
 * Get NEAR account for Privy user
 *
 * Response:
 * {
 *   accountId: string,
 *   derivationPath: string,
 *   mpcContractId: string,
 *   exists: boolean
 * }
 */
router.get('/:privyUserId', function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var privyUserId, result, error_2;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                privyUserId = req.params.privyUserId;
                return [4 /*yield*/, (0, database_js_1.getPool)().query('SELECT near_account_id, derivation_path FROM user_accounts WHERE privy_user_id = $1', [privyUserId])];
            case 1:
                result = _a.sent();
                if (result.rows.length === 0) {
                    return [2 /*return*/, res.json({
                            exists: false,
                        })];
                }
                res.json({
                    accountId: result.rows[0].near_account_id,
                    derivationPath: result.rows[0].derivation_path,
                    mpcContractId: process.env.NEAR_NETWORK === 'mainnet'
                        ? 'v1.signer-prod.near'
                        : 'v1.signer-prod.testnet',
                    exists: true,
                });
                return [3 /*break*/, 3];
            case 2:
                error_2 = _a.sent();
                console.error('Account lookup error:', error_2);
                res.status(500).json({
                    error: 'Failed to lookup account',
                });
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); });
/**
 * POST /api/accounts/add-mpc-key
 *
 * Add MPC public key to user's NEAR account on-chain
 *
 * This creates an AddKey transaction to add the MPC root key
 * as a full access key on the user's account.
 *
 * Request body:
 * {
 *   nearAccountId: string,
 *   mpcPublicKey: string (from MPC contract - root key)
 * }
 *
 * Response:
 * {
 *   success: boolean,
 *   txHash: string
 * }
 */
router.post('/add-mpc-key', function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var _a, nearAccountId, mpcPublicKey_1, rpcUrl, accessKeysResponse, keysResult, keyExists, isDevelopment, dbError_1, error_3;
    var _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                _c.trys.push([0, 8, , 9]);
                _a = req.body, nearAccountId = _a.nearAccountId, mpcPublicKey_1 = _a.mpcPublicKey;
                if (!nearAccountId || !mpcPublicKey_1) {
                    return [2 /*return*/, res.status(400).json({
                            error: 'Missing required fields: nearAccountId, mpcPublicKey',
                        })];
                }
                console.log('Adding MPC key to NEAR account:', {
                    nearAccountId: nearAccountId,
                    mpcPublicKey: mpcPublicKey_1,
                });
                rpcUrl = process.env.NEAR_RPC || 'https://rpc.testnet.near.org';
                return [4 /*yield*/, fetch(rpcUrl, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            jsonrpc: '2.0',
                            id: 'check-keys',
                            method: 'query',
                            params: {
                                request_type: 'view_access_key_list',
                                finality: 'final',
                                account_id: nearAccountId,
                            },
                        }),
                    })];
            case 1:
                accessKeysResponse = _c.sent();
                return [4 /*yield*/, accessKeysResponse.json()];
            case 2:
                keysResult = _c.sent();
                if ((_b = keysResult.result) === null || _b === void 0 ? void 0 : _b.keys) {
                    keyExists = keysResult.result.keys.some(function (k) { return k.public_key === mpcPublicKey_1; });
                    if (keyExists) {
                        console.log('MPC key already exists on account');
                        return [2 /*return*/, res.status(409).json({
                                error: 'MPC key already registered',
                                success: true, // This is actually success - key is there
                            })];
                    }
                }
                isDevelopment = process.env.NODE_ENV !== 'production';
                if (!isDevelopment) return [3 /*break*/, 7];
                console.log('DEV MODE: Simulating AddKey transaction');
                console.log('NOTE: Full implementation requires storing account keys or using Privy wallet');
                _c.label = 3;
            case 3:
                _c.trys.push([3, 5, , 6]);
                return [4 /*yield*/, (0, database_js_1.getPool)().query("UPDATE user_accounts\n           SET mpc_public_key = $1\n           WHERE near_account_id = $2", [mpcPublicKey_1, nearAccountId])];
            case 4:
                _c.sent();
                return [3 /*break*/, 6];
            case 5:
                dbError_1 = _c.sent();
                // Ignore DB errors in dev mode - key tracking is optional
                console.warn('DB update skipped:', dbError_1 instanceof Error ? dbError_1.message : 'unknown');
                return [3 /*break*/, 6];
            case 6: return [2 /*return*/, res.json({
                    success: true,
                    txHash: "dev-sim-".concat(Date.now()),
                    note: 'Development mode - AddKey transaction simulated',
                })];
            case 7: 
            // Production would implement real AddKey here
            return [2 /*return*/, res.status(501).json({
                    error: 'AddKey transaction not implemented for production',
                    details: 'Requires account key management implementation',
                })];
            case 8:
                error_3 = _c.sent();
                console.error('Add MPC key error:', error_3);
                res.status(500).json({
                    error: 'Failed to add MPC key',
                    details: error_3 instanceof Error ? error_3.message : 'Unknown error',
                });
                return [3 /*break*/, 9];
            case 9: return [2 /*return*/];
        }
    });
}); });
/**
 * POST /api/accounts/update-mpc-key
 *
 * Update MPC public key after frontend registers with MPC contract
 *
 * Request body:
 * {
 *   privyUserId: string,
 *   mpcPublicKey: string (from MPC registration)
 * }
 */
router.post('/update-mpc-key', function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var _a, privyUserId, mpcPublicKey, error_4;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                _b.trys.push([0, 2, , 3]);
                _a = req.body, privyUserId = _a.privyUserId, mpcPublicKey = _a.mpcPublicKey;
                if (!privyUserId || !mpcPublicKey) {
                    return [2 /*return*/, res.status(400).json({
                            error: 'Missing required fields',
                        })];
                }
                return [4 /*yield*/, (0, database_js_1.getPool)().query('UPDATE user_accounts SET mpc_public_key = $1 WHERE privy_user_id = $2', [mpcPublicKey, privyUserId])];
            case 1:
                _b.sent();
                res.json({
                    success: true,
                });
                return [3 /*break*/, 3];
            case 2:
                error_4 = _b.sent();
                console.error('MPC key update error:', error_4);
                res.status(500).json({
                    error: 'Failed to update MPC key',
                });
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); });
exports.default = router;
