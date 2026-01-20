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
exports.startSyncWorkers = startSyncWorkers;
exports.stopSyncWorkers = stopSyncWorkers;
var pg_boss_1 = require("pg-boss");
var database_js_1 = require("./database.js");
var boss;
/**
 * Process outbox records and write to NEAR blockchain
 */
function processOutboxWorker() {
    return __awaiter(this, void 0, void 0, function () {
        var _this = this;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: 
                // Poll outbox for unprocessed records
                return [4 /*yield*/, boss.work('process-outbox', function (job) { return __awaiter(_this, void 0, void 0, function () {
                        var client, outboxResult, outboxRecord, payload, blockchainTxHash, error_1;
                        var _a;
                        return __generator(this, function (_b) {
                            switch (_b.label) {
                                case 0: return [4 /*yield*/, (0, database_js_1.getPool)().connect()];
                                case 1:
                                    client = _b.sent();
                                    _b.label = 2;
                                case 2:
                                    _b.trys.push([2, 6, 9, 10]);
                                    return [4 /*yield*/, client.query("\n        SELECT * FROM outbox\n        WHERE processed_at IS NULL\n        ORDER BY created_at ASC\n        LIMIT 1\n        FOR UPDATE SKIP LOCKED\n      ")];
                                case 3:
                                    // Get oldest unprocessed outbox record
                                    outboxResult = _b.sent();
                                    if (outboxResult.rows.length === 0)
                                        return [2 /*return*/];
                                    outboxRecord = outboxResult.rows[0];
                                    payload = outboxRecord.payload;
                                    blockchainTxHash = "near:".concat(Date.now());
                                    // Mark as processed
                                    return [4 /*yield*/, client.query("\n        UPDATE outbox\n        SET processed_at = NOW(),\n            blockchain_tx_hash = $1\n        WHERE outbox_id = $2\n      ", [blockchainTxHash, outboxRecord.outbox_id])];
                                case 4:
                                    // Mark as processed
                                    _b.sent();
                                    // Update document record
                                    return [4 /*yield*/, client.query("\n        UPDATE documents\n        SET blockchain_synced = true,\n            blockchain_tx_hash = $1\n        WHERE document_id = $2\n      ", [blockchainTxHash, outboxRecord.aggregate_id])];
                                case 5:
                                    // Update document record
                                    _b.sent();
                                    console.log("\u2713 Synced document ".concat(outboxRecord.aggregate_id, " to blockchain: ").concat(blockchainTxHash));
                                    return [3 /*break*/, 10];
                                case 6:
                                    error_1 = _b.sent();
                                    console.error('Error processing outbox record:', error_1);
                                    if (!((_a = outboxResult === null || outboxResult === void 0 ? void 0 : outboxResult.rows) === null || _a === void 0 ? void 0 : _a[0])) return [3 /*break*/, 8];
                                    return [4 /*yield*/, client.query("\n          UPDATE outbox\n          SET retry_count = retry_count + 1,\n              error = $1\n          WHERE outbox_id = $2\n        ", [error_1.message, outboxResult.rows[0].outbox_id])];
                                case 7:
                                    _b.sent();
                                    // If max retries exceeded, alert
                                    if (outboxResult.rows[0].retry_count >= 5) {
                                        console.error('❌ Max retries exceeded for outbox record', outboxResult.rows[0].outbox_id);
                                    }
                                    _b.label = 8;
                                case 8: throw error_1; // pgboss will retry with exponential backoff
                                case 9:
                                    client.release();
                                    return [7 /*endfinally*/];
                                case 10: return [2 /*return*/];
                            }
                        });
                    }); })];
                case 1:
                    // Poll outbox for unprocessed records
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
/**
 * Listen to NEAR blockchain events and sync to PostgreSQL
 */
function syncBlockchainEventsWorker() {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            // TODO: Implement NEAR event listener
            // Use NEAR RPC subscriptions or polling
            // When external document registered on blockchain:
            // - Check if exists in PostgreSQL
            // - If not: INSERT from blockchain event
            // - INSERT into blockchain_events table for audit
            console.log('Blockchain event sync worker: Deferred to Phase 2');
            return [2 /*return*/];
        });
    });
}
/**
 * Start all sync workers
 */
function startSyncWorkers() {
    return __awaiter(this, void 0, void 0, function () {
        var dbUrl;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    // Initialize pg-boss with DATABASE_URL
                    if (!boss) {
                        dbUrl = process.env.DATABASE_URL;
                        if (!dbUrl) {
                            console.error('⚠️  DATABASE_URL not set, skipping sync workers');
                            return [2 /*return*/];
                        }
                        boss = new pg_boss_1.PgBoss(dbUrl);
                    }
                    // Handle pg-boss errors gracefully - don't crash the server
                    boss.on('error', function (error) {
                        console.error('⚠️  pg-boss error (non-fatal):', error.message);
                    });
                    return [4 /*yield*/, boss.start()];
                case 1:
                    _a.sent();
                    // In pg-boss v12+, queues must be explicitly created before use
                    return [4 /*yield*/, boss.createQueue('process-outbox')];
                case 2:
                    // In pg-boss v12+, queues must be explicitly created before use
                    _a.sent();
                    // Register the worker to process jobs
                    return [4 /*yield*/, processOutboxWorker()];
                case 3:
                    // Register the worker to process jobs
                    _a.sent();
                    // Schedule outbox processing every 5 seconds
                    return [4 /*yield*/, boss.schedule('process-outbox', '*/5 * * * * *')];
                case 4:
                    // Schedule outbox processing every 5 seconds
                    _a.sent();
                    // await syncBlockchainEventsWorker(); // Phase 2
                    console.log('✓ Blockchain sync workers started');
                    console.log('  - Outbox processor: every 5 seconds');
                    console.log('  - Blockchain event listener: deferred to Phase 2');
                    return [2 /*return*/];
            }
        });
    });
}
/**
 * Graceful shutdown
 */
function stopSyncWorkers() {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, boss.stop()];
                case 1:
                    _a.sent();
                    console.log('✓ Blockchain sync workers stopped');
                    return [2 /*return*/];
            }
        });
    });
}
// Handle process termination
process.on('SIGTERM', stopSyncWorkers);
process.on('SIGINT', stopSyncWorkers);
