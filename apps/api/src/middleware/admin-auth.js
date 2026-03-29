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
exports.adminAuth = void 0;
var otplib_1 = require("otplib");
var env_js_1 = require("../config/env.js");
// Configure otplib to match standard TOTP parameters
otplib_1.authenticator.options = {
    digits: 6,
    step: 30,
    window: 1, // Accept current ±1 step windows
};
var adminAuth = function (request, reply) { return __awaiter(void 0, void 0, void 0, function () {
    var apiKey, totp;
    return __generator(this, function (_a) {
        apiKey = request.headers['x-admin-key'];
        totp = request.headers['x-admin-totp'];
        // Constant-time comparison to prevent timing attacks on the API key
        if (typeof apiKey !== 'string' ||
            !timingSafeEqual(apiKey, env_js_1.env.ADMIN_API_KEY)) {
            return [2 /*return*/, reply.status(401).send({
                    success: false,
                    error: 'unauthorized',
                    message: 'Invalid or missing admin credentials.',
                })];
        }
        if (typeof totp !== 'string' || !otplib_1.authenticator.verify({ token: totp, secret: env_js_1.env.ADMIN_TOTP_SECRET })) {
            return [2 /*return*/, reply.status(401).send({
                    success: false,
                    error: 'invalid_totp',
                    message: 'Invalid or expired TOTP code.',
                })];
        }
        return [2 /*return*/];
    });
}); };
exports.adminAuth = adminAuth;
/**
 * Constant-time string comparison to prevent timing side-channel attacks.
 * Falls back to false immediately if lengths differ (length is safe to leak).
 */
function timingSafeEqual(a, b) {
    if (a.length !== b.length)
        return false;
    var diff = 0;
    for (var i = 0; i < a.length; i++) {
        diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }
    return diff === 0;
}
