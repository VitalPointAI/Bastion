"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
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
exports.uploadToIPFS = uploadToIPFS;
exports.retrieveFromIPFS = retrieveFromIPFS;
var axios_1 = require("axios");
var form_data_1 = require("form-data");
// Pinata V3 API uses different upload endpoint
var PINATA_UPLOAD_URL = 'https://uploads.pinata.cloud/v3/files';
function uploadToIPFS(data, filename) {
    return __awaiter(this, void 0, void 0, function () {
        var PINATA_JWT, formData, response;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    PINATA_JWT = process.env.PINATA_JWT;
                    if (!PINATA_JWT) {
                        throw new Error('PINATA_JWT not configured');
                    }
                    formData = new form_data_1.default();
                    formData.append('file', data, filename);
                    formData.append('network', 'public'); // Required for V3 API
                    return [4 /*yield*/, axios_1.default.post(PINATA_UPLOAD_URL, formData, {
                            headers: __assign({ 'Authorization': "Bearer ".concat(PINATA_JWT) }, formData.getHeaders()),
                            maxBodyLength: Infinity
                        })];
                case 1:
                    response = _a.sent();
                    // V3 API response structure: { data: { id, cid, name, size, ... } }
                    return [2 /*return*/, {
                            cid: response.data.data.cid,
                            size: response.data.data.size
                        }];
            }
        });
    });
}
function retrieveFromIPFS(cid) {
    return __awaiter(this, void 0, void 0, function () {
        var PINATA_GATEWAY, response;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    PINATA_GATEWAY = process.env.PINATA_GATEWAY;
                    if (!PINATA_GATEWAY) {
                        throw new Error('PINATA_GATEWAY not configured');
                    }
                    return [4 /*yield*/, axios_1.default.get("".concat(PINATA_GATEWAY, "/ipfs/").concat(cid), {
                            responseType: 'arraybuffer'
                        })];
                case 1:
                    response = _a.sent();
                    return [2 /*return*/, Buffer.from(response.data)];
            }
        });
    });
}
