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
var multer_1 = require("multer");
var encryption_js_1 = require("../lib/encryption.js");
var ipfs_js_1 = require("../lib/ipfs.js");
var database_js_1 = require("../lib/database.js");
var router = express_1.default.Router();
var upload = (0, multer_1.default)({
    storage: multer_1.default.memoryStorage(),
    limits: { fileSize: 100 * 1024 * 1024 } // 100MB
});
/**
 * POST /api/documents/upload - Upload document to IPFS and register in PostgreSQL + blockchain
 */
router.post('/upload', upload.single('file'), function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var file, _a, owner_account_id, classification, metadata, fileKey, _b, encryptedFile, fileNonce, encryptedBuffer, _c, cid, size, cidKey, _d, encryptedCid, cidNonce, classKey, _e, encryptedClassification, classNonce, metaKey, metadataStr, _f, encryptedMetadata, metaNonce, documentId, error_1;
    return __generator(this, function (_g) {
        switch (_g.label) {
            case 0:
                _g.trys.push([0, 11, , 12]);
                file = req.file;
                _a = req.body, owner_account_id = _a.owner_account_id, classification = _a.classification, metadata = _a.metadata;
                if (!file || !owner_account_id) {
                    return [2 /*return*/, res.status(400).json({ error: 'File and owner_account_id required' })];
                }
                return [4 /*yield*/, (0, encryption_js_1.generateEncryptionKey)()];
            case 1:
                fileKey = _g.sent();
                return [4 /*yield*/, (0, encryption_js_1.encryptData)(file.buffer, fileKey)];
            case 2:
                _b = _g.sent(), encryptedFile = _b.encrypted, fileNonce = _b.nonce;
                encryptedBuffer = Buffer.from(encryptedFile, 'base64');
                return [4 /*yield*/, (0, ipfs_js_1.uploadToIPFS)(encryptedBuffer, "".concat(file.originalname, ".encrypted"))];
            case 3:
                _c = _g.sent(), cid = _c.cid, size = _c.size;
                return [4 /*yield*/, (0, encryption_js_1.generateEncryptionKey)()];
            case 4:
                cidKey = _g.sent();
                return [4 /*yield*/, (0, encryption_js_1.encryptData)(cid, cidKey)];
            case 5:
                _d = _g.sent(), encryptedCid = _d.encrypted, cidNonce = _d.nonce;
                return [4 /*yield*/, (0, encryption_js_1.generateEncryptionKey)()];
            case 6:
                classKey = _g.sent();
                return [4 /*yield*/, (0, encryption_js_1.encryptData)(classification || 'UNCLASS', classKey)];
            case 7:
                _e = _g.sent(), encryptedClassification = _e.encrypted, classNonce = _e.nonce;
                return [4 /*yield*/, (0, encryption_js_1.generateEncryptionKey)()];
            case 8:
                metaKey = _g.sent();
                metadataStr = metadata ? JSON.stringify(metadata) : '{}';
                return [4 /*yield*/, (0, encryption_js_1.encryptData)(metadataStr, metaKey)];
            case 9:
                _f = _g.sent(), encryptedMetadata = _f.encrypted, metaNonce = _f.nonce;
                return [4 /*yield*/, (0, database_js_1.dualWriteDocument)({
                        encrypted_cid: encryptedCid,
                        encrypted_classification: encryptedClassification,
                        encrypted_metadata: { encrypted: encryptedMetadata }, // Store encrypted string in JSONB wrapper
                        owner_account_id: owner_account_id,
                        file_size_bytes: size,
                        mime_type: file.mimetype,
                        encryption_nonce: "".concat(fileNonce, "|").concat(cidNonce, "|").concat(classNonce, "|").concat(metaNonce) // Combined nonces
                    })];
            case 10:
                documentId = _g.sent();
                console.log("\u2713 Document registered: ".concat(documentId, ", IPFS CID: ").concat(cid));
                res.json({
                    document_id: documentId,
                    ipfs_cid: cid, // Return plaintext CID for now (client needs it to fetch)
                    size: size,
                    mime_type: file.mimetype,
                    // Keys for decryption (in production, these would be managed via TEE/key service)
                    encryption_keys: {
                        file_key: fileKey,
                        cid_key: cidKey,
                        classification_key: classKey,
                        metadata_key: metaKey
                    },
                    nonces: {
                        file_nonce: fileNonce,
                        cid_nonce: cidNonce,
                        classification_nonce: classNonce,
                        metadata_nonce: metaNonce
                    },
                    message: 'Document uploaded, encrypted, and registered for blockchain sync'
                });
                return [3 /*break*/, 12];
            case 11:
                error_1 = _g.sent();
                console.error('Upload failed:', error_1);
                res.status(500).json({ error: error_1.message });
                return [3 /*break*/, 12];
            case 12: return [2 /*return*/];
        }
    });
}); });
/**
 * GET /api/documents/:documentId - Get document metadata
 */
router.get('/:documentId', function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var doc, error_2;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                return [4 /*yield*/, (0, database_js_1.getDocument)(req.params.documentId)];
            case 1:
                doc = _a.sent();
                if (!doc) {
                    return [2 /*return*/, res.status(404).json({ error: 'Document not found' })];
                }
                // TODO: Verify user has access to this document
                res.json(doc);
                return [3 /*break*/, 3];
            case 2:
                error_2 = _a.sent();
                console.error('Get document failed:', error_2);
                res.status(500).json({ error: error_2.message });
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); });
/**
 * GET /api/documents - List user's documents
 */
router.get('/', function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var _a, owner_account_id, limit, offset, docs, error_3;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                _a = req.query, owner_account_id = _a.owner_account_id, limit = _a.limit, offset = _a.offset;
                if (!owner_account_id) {
                    return [2 /*return*/, res.status(400).json({ error: 'owner_account_id required' })];
                }
                _b.label = 1;
            case 1:
                _b.trys.push([1, 3, , 4]);
                return [4 /*yield*/, (0, database_js_1.listUserDocuments)(owner_account_id, parseInt(limit) || 20, parseInt(offset) || 0)];
            case 2:
                docs = _b.sent();
                res.json({ documents: docs, count: docs.length });
                return [3 /*break*/, 4];
            case 3:
                error_3 = _b.sent();
                console.error('List documents failed:', error_3);
                res.status(500).json({ error: error_3.message });
                return [3 /*break*/, 4];
            case 4: return [2 /*return*/];
        }
    });
}); });
exports.default = router;
