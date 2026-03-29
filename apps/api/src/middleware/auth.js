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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.jwtAuth = exports.bearerAuth = void 0;
exports.hashApiKey = hashApiKey;
exports.validateApiKey = validateApiKey;
exports.signAccessToken = signAccessToken;
exports.signRefreshToken = signRefreshToken;
exports.verifyAccessToken = verifyAccessToken;
exports.verifyRefreshToken = verifyRefreshToken;
var node_crypto_1 = __importDefault(require("node:crypto"));
var drizzle_orm_1 = require("drizzle-orm");
var index_js_1 = require("../db/index.js");
var index_js_2 = require("../db/schema/index.js");
var index_js_3 = require("../redis/index.js");
var shared_1 = require("@vinstub/shared");
// ─── HELPERS ──────────────────────────────────────────────────────────────────
/** SHA-256 hex digest of a raw API key string. */
function hashApiKey(rawKey) {
    return node_crypto_1.default.createHash('sha256').update(rawKey).digest('hex');
}
/** Extract the Bearer token from an Authorization header value. */
function extractBearer(header) {
    if (!header)
        return null;
    if (!header.startsWith('Bearer '))
        return null;
    return header.slice(7).trim();
}
// ─── CORE VALIDATION FUNCTION ─────────────────────────────────────────────────
/**
 * Validates a raw API key string.
 * Returns a UserContext on success, or null if invalid/not found.
 *
 * Exported for reuse in tests and the admin key-reset flow.
 */
function validateApiKey(rawKey) {
    return __awaiter(this, void 0, void 0, function () {
        var keyHash, cached, rows, row, entry;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    // 1. Format check — regex validates prefix + 48 hex chars
                    if (!shared_1.API_KEY_REGEX.test(rawKey))
                        return [2 /*return*/, null];
                    keyHash = hashApiKey(rawKey);
                    return [4 /*yield*/, (0, index_js_3.getAuthCache)(keyHash)];
                case 1:
                    cached = _a.sent();
                    if (cached) {
                        return [2 /*return*/, {
                                userId: cached.userId,
                                plan: cached.plan,
                                accountStatus: cached.accountStatus,
                            }];
                    }
                    return [4 /*yield*/, index_js_1.db
                            .select({
                            userId: index_js_2.users.id,
                            plan: index_js_2.users.plan,
                            accountStatus: index_js_2.users.accountStatus,
                            isActive: index_js_2.apiKeys.isActive,
                        })
                            .from(index_js_2.apiKeys)
                            .innerJoin(index_js_2.users, (0, drizzle_orm_1.eq)(index_js_2.apiKeys.userId, index_js_2.users.id))
                            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(index_js_2.apiKeys.keyHash, keyHash), (0, drizzle_orm_1.eq)(index_js_2.apiKeys.isActive, true)))
                            .limit(1)];
                case 2:
                    rows = _a.sent();
                    if (rows.length === 0)
                        return [2 /*return*/, null];
                    row = rows[0];
                    entry = {
                        userId: row.userId,
                        plan: row.plan,
                        accountStatus: row.accountStatus,
                    };
                    return [4 /*yield*/, (0, index_js_3.setAuthCache)(keyHash, entry)];
                case 3:
                    _a.sent();
                    // 6. Update last_used_at asynchronously (don't block the request)
                    setImmediate(function () {
                        index_js_1.db.update(index_js_2.apiKeys)
                            .set({ lastUsedAt: new Date() })
                            .where((0, drizzle_orm_1.eq)(index_js_2.apiKeys.keyHash, keyHash))
                            .catch(function (err) { return console.error('[auth] failed to update last_used_at:', err); });
                    });
                    return [2 /*return*/, {
                            userId: row.userId,
                            plan: row.plan,
                            accountStatus: row.accountStatus,
                        }];
            }
        });
    });
}
// ─── PREHANDLER MIDDLEWARE ────────────────────────────────────────────────────
/**
 * bearerAuth — Fastify preHandler hook.
 * Add to any route that requires a valid API key:
 *
 *   fastify.get('/v1/stub', { preHandler: [bearerAuth] }, handler)
 *
 * On success: attaches request.user and continues.
 * On failure: replies immediately with 401 or 403.
 */
var bearerAuth = function (request, reply) { return __awaiter(void 0, void 0, void 0, function () {
    var token, user;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                token = extractBearer(request.headers.authorization);
                if (!token) {
                    return [2 /*return*/, reply.status(401).send({
                            success: false,
                            error: 'unauthorized',
                            message: 'Missing Authorization header. Use: Authorization: Bearer <api-key>',
                            request_id: request.id,
                        })];
                }
                // Quick format check before any I/O
                if (!shared_1.API_KEY_REGEX.test(token)) {
                    return [2 /*return*/, reply.status(401).send({
                            success: false,
                            error: 'unauthorized',
                            message: 'Invalid API key format.',
                            request_id: request.id,
                        })];
                }
                return [4 /*yield*/, validateApiKey(token)];
            case 1:
                user = _a.sent();
                if (!user) {
                    return [2 /*return*/, reply.status(401).send({
                            success: false,
                            error: 'unauthorized',
                            message: 'API key not found or has been revoked.',
                            request_id: request.id,
                        })];
                }
                // Account must not be suspended
                if (user.accountStatus === 'suspended') {
                    return [2 /*return*/, reply.status(403).send({
                            success: false,
                            error: 'account_suspended',
                            message: 'Your account has been suspended. Please resolve your outstanding balance at app.vinstub.com.',
                            request_id: request.id,
                        })];
                }
                // Safety check — should never happen since we require email verification
                // before issuing an API key, but defend in depth
                if (user.accountStatus === 'pending_verification') {
                    return [2 /*return*/, reply.status(403).send({
                            success: false,
                            error: 'email_not_verified',
                            message: 'Please verify your email address before using the API.',
                            request_id: request.id,
                        })];
                }
                // Attach user context for downstream middleware and handlers
                request.user = user;
                return [2 /*return*/];
        }
    });
}); };
exports.bearerAuth = bearerAuth;
// ─── JWT AUTH (for dashboard routes) ─────────────────────────────────────────
// Defined here to keep all auth in one file.
var jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
var env_js_1 = require("../config/env.js");
function signAccessToken(userId, plan) {
    return jsonwebtoken_1.default.sign({ sub: userId, plan: plan, type: 'access' }, env_js_1.env.JWT_SECRET, { expiresIn: env_js_1.env.JWT_ACCESS_EXPIRY });
}
function signRefreshToken(userId, jti) {
    return jsonwebtoken_1.default.sign({ sub: userId, type: 'refresh', jti: jti }, env_js_1.env.REFRESH_SECRET, { expiresIn: env_js_1.env.JWT_REFRESH_EXPIRY });
}
function verifyAccessToken(token) {
    return jsonwebtoken_1.default.verify(token, env_js_1.env.JWT_SECRET);
}
function verifyRefreshToken(token) {
    return jsonwebtoken_1.default.verify(token, env_js_1.env.REFRESH_SECRET);
}
/**
 * jwtAuth — Fastify preHandler for dashboard/account-management routes.
 * Validates the JWT access token from the Authorization header (same header,
 * same Bearer format — the token just starts with "ey" not "vs_live_").
 */
var jwtAuth = function (request, reply) { return __awaiter(void 0, void 0, void 0, function () {
    var token, payload, userRows, user;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                token = extractBearer(request.headers.authorization);
                if (!token) {
                    return [2 /*return*/, reply.status(401).send({
                            success: false,
                            error: 'unauthorized',
                            message: 'Missing Authorization header.',
                            request_id: request.id,
                        })];
                }
                try {
                    payload = verifyAccessToken(token);
                }
                catch (_b) {
                    return [2 /*return*/, reply.status(401).send({
                            success: false,
                            error: 'unauthorized',
                            message: 'Invalid or expired access token. Please log in again.',
                            request_id: request.id,
                        })];
                }
                if (payload.type !== 'access') {
                    return [2 /*return*/, reply.status(401).send({
                            success: false,
                            error: 'unauthorized',
                            message: 'Token type mismatch.',
                            request_id: request.id,
                        })];
                }
                return [4 /*yield*/, index_js_1.db
                        .select({ plan: index_js_2.users.plan, accountStatus: index_js_2.users.accountStatus })
                        .from(index_js_2.users)
                        .where((0, drizzle_orm_1.eq)(index_js_2.users.id, payload.sub))
                        .limit(1)];
            case 1:
                userRows = _a.sent();
                if (userRows.length === 0) {
                    return [2 /*return*/, reply.status(401).send({
                            success: false,
                            error: 'unauthorized',
                            message: 'User not found.',
                            request_id: request.id,
                        })];
                }
                user = userRows[0];
                request.user = {
                    userId: payload.sub,
                    plan: user.plan,
                    accountStatus: user.accountStatus,
                };
                return [2 /*return*/];
        }
    });
}); };
exports.jwtAuth = jwtAuth;
