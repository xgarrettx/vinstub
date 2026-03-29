"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
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
var drizzle_orm_1 = require("drizzle-orm");
var auth_js_1 = require("../../middleware/auth.js");
var index_js_1 = require("../../db/index.js");
var index_js_2 = require("../../db/schema/index.js");
var auth_service_js_1 = require("../../services/auth.service.js");
var stripe_js_1 = require("../../config/stripe.js");
var env_js_1 = require("../../config/env.js");
var accountRoutes = function (fastify) { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        // ─── GET /v1/account ────────────────────────────────────────────────────────
        // Returns the authenticated user's account info, plan, and masked API key.
        // Uses Bearer auth so API consumers can self-inspect programmatically.
        fastify.get('/account', {
            preHandler: [auth_js_1.bearerAuth],
            schema: {
                tags: ['Account'],
                summary: 'Get account details',
                description: 'Returns current account status, plan, usage limits, and masked API key. ' +
                    'Requires API key authentication.',
                security: [{ BearerAuth: [] }],
                response: {
                    200: {
                        description: 'Account details',
                        type: 'object',
                        properties: {
                            success: { type: 'boolean' },
                            data: {
                                type: 'object',
                                properties: {
                                    userId: { type: 'string' },
                                    email: { type: 'string' },
                                    plan: { type: 'string' },
                                    accountStatus: { type: 'string' },
                                    billingStatus: { type: 'string' },
                                    apiKey: {
                                        type: 'object',
                                        properties: {
                                            prefix: { type: 'string', description: 'First 16 chars for display' },
                                            createdAt: { type: 'string', format: 'date-time' },
                                            lastUsedAt: { type: ['string', 'null'], format: 'date-time' },
                                        },
                                    },
                                    limits: {
                                        type: 'object',
                                        properties: {
                                            daily: { type: 'integer' },
                                            perHour: { type: 'integer' },
                                            perMinute: { type: 'integer' },
                                        },
                                    },
                                },
                            },
                        },
                    },
                    401: { $ref: 'ErrorResponse#' },
                    403: { $ref: 'ErrorResponse#' },
                },
            },
        }, function (request, reply) { return __awaiter(void 0, void 0, void 0, function () {
            var user, rows, row, PLAN_LIMITS, limits;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        user = request.user;
                        return [4 /*yield*/, index_js_1.db
                                .select({
                                email: index_js_2.users.email,
                                plan: index_js_2.users.plan,
                                accountStatus: index_js_2.users.accountStatus,
                                billingStatus: index_js_2.users.billingStatus,
                                keyPrefix: index_js_2.apiKeys.keyPrefix,
                                keyCreatedAt: index_js_2.apiKeys.createdAt,
                                keyLastUsedAt: index_js_2.apiKeys.lastUsedAt,
                            })
                                .from(index_js_2.users)
                                .leftJoin(index_js_2.apiKeys, (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(index_js_2.apiKeys.userId, index_js_2.users.id), (0, drizzle_orm_1.eq)(index_js_2.apiKeys.isActive, true)))
                                .where((0, drizzle_orm_1.eq)(index_js_2.users.id, user.userId))
                                .limit(1)];
                    case 1:
                        rows = _a.sent();
                        if (!rows.length) {
                            return [2 /*return*/, reply.status(401).send({
                                    success: false,
                                    error: 'unauthorized',
                                    message: 'User not found.',
                                    request_id: request.id,
                                })];
                        }
                        row = rows[0];
                        return [4 /*yield*/, Promise.resolve().then(function () { return __importStar(require('@vinstub/shared/constants.js')); })];
                    case 2:
                        PLAN_LIMITS = (_a.sent()).PLAN_LIMITS;
                        limits = PLAN_LIMITS[user.plan];
                        return [2 /*return*/, reply.status(200).send({
                                success: true,
                                data: {
                                    userId: user.userId,
                                    email: row.email,
                                    plan: row.plan,
                                    accountStatus: row.accountStatus,
                                    billingStatus: row.billingStatus,
                                    apiKey: row.keyPrefix
                                        ? {
                                            prefix: row.keyPrefix,
                                            createdAt: row.keyCreatedAt,
                                            lastUsedAt: row.keyLastUsedAt,
                                        }
                                        : null,
                                    limits: {
                                        daily: limits.daily,
                                        perHour: limits.perHour,
                                        perMinute: limits.perMinute,
                                    },
                                },
                            })];
                }
            });
        }); });
        // ─── GET /v1/account/key-info ───────────────────────────────────────────────
        // Returns the stored key prefix (first 16 chars) for display in the dashboard.
        // Full key is never stored — only the prefix and a sha256 hash.
        // Requires JWT (dashboard session).
        fastify.get('/account/key-info', {
            preHandler: [auth_js_1.jwtAuth],
            schema: {
                tags: ['Account'],
                summary: 'Get API key display info',
                description: 'Returns the stored key prefix for display. The full key is never stored.',
                security: [{ BearerAuth: [] }],
                response: {
                    200: {
                        type: 'object',
                        properties: {
                            success: { type: 'boolean' },
                            data: {
                                type: 'object',
                                properties: {
                                    keyPrefix: { type: ['string', 'null'], description: 'First 16 chars of key, e.g. vs_live_a3f9b2c1' },
                                    createdAt: { type: ['string', 'null'], format: 'date-time' },
                                    lastUsedAt: { type: ['string', 'null'], format: 'date-time' },
                                    hasKey: { type: 'boolean' },
                                },
                            },
                        },
                    },
                    401: { $ref: 'ErrorResponse#' },
                },
            },
        }, function (request, reply) { return __awaiter(void 0, void 0, void 0, function () {
            var user, rows, key;
            var _a, _b, _c, _d;
            return __generator(this, function (_e) {
                switch (_e.label) {
                    case 0:
                        user = request.user;
                        return [4 /*yield*/, index_js_1.db
                                .select({
                                keyPrefix: index_js_2.apiKeys.keyPrefix,
                                createdAt: index_js_2.apiKeys.createdAt,
                                lastUsedAt: index_js_2.apiKeys.lastUsedAt,
                            })
                                .from(index_js_2.apiKeys)
                                .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(index_js_2.apiKeys.userId, user.userId), (0, drizzle_orm_1.eq)(index_js_2.apiKeys.isActive, true)))
                                .orderBy((0, drizzle_orm_1.desc)(index_js_2.apiKeys.createdAt))
                                .limit(1)];
                    case 1:
                        rows = _e.sent();
                        key = (_a = rows[0]) !== null && _a !== void 0 ? _a : null;
                        return [2 /*return*/, reply.send({
                                success: true,
                                data: {
                                    keyPrefix: (_b = key === null || key === void 0 ? void 0 : key.keyPrefix) !== null && _b !== void 0 ? _b : null,
                                    createdAt: (_c = key === null || key === void 0 ? void 0 : key.createdAt) !== null && _c !== void 0 ? _c : null,
                                    lastUsedAt: (_d = key === null || key === void 0 ? void 0 : key.lastUsedAt) !== null && _d !== void 0 ? _d : null,
                                    hasKey: !!key,
                                },
                            })];
                }
            });
        }); });
        // ─── POST /v1/account/rotate-key ────────────────────────────────────────────
        // Generates a new API key and immediately invalidates the old one.
        // Returns the new raw key ONE TIME. Requires JWT (dashboard session).
        fastify.post('/account/rotate-key', {
            preHandler: [auth_js_1.jwtAuth],
            schema: {
                tags: ['Account'],
                summary: 'Rotate API key',
                description: 'Generates a new API key and immediately deactivates the current one. ' +
                    'The new key is returned ONCE — it cannot be retrieved again. ' +
                    'Requires dashboard session (JWT).',
                response: {
                    200: {
                        description: 'New API key generated',
                        type: 'object',
                        properties: {
                            success: { type: 'boolean' },
                            message: { type: 'string' },
                            apiKey: {
                                type: 'string',
                                description: 'Your new API key. Save it — it will not be shown again.',
                            },
                        },
                    },
                    401: { $ref: 'ErrorResponse#' },
                    403: { $ref: 'ErrorResponse#' },
                    500: { $ref: 'ErrorResponse#' },
                },
            },
        }, function (request, reply) { return __awaiter(void 0, void 0, void 0, function () {
            var user, result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        user = request.user;
                        return [4 /*yield*/, (0, auth_service_js_1.rotateApiKey)(user.userId)];
                    case 1:
                        result = _a.sent();
                        return [2 /*return*/, reply.status(200).send({
                                success: true,
                                message: 'API key rotated. Save your new key — it will not be shown again.',
                                apiKey: result.rawApiKey,
                            })];
                }
            });
        }); });
        // ─── POST /v1/account/revoke-key ────────────────────────────────────────────
        // Deactivates the current API key without issuing a replacement.
        // Useful when a key is suspected compromised. Requires JWT.
        fastify.post('/account/revoke-key', {
            preHandler: [auth_js_1.jwtAuth],
            schema: {
                tags: ['Account'],
                summary: 'Revoke API key',
                description: 'Permanently deactivates the current API key. No replacement is issued. ' +
                    'Use /account/rotate-key if you want a new key immediately. ' +
                    'Requires dashboard session (JWT).',
                response: {
                    200: {
                        description: 'API key revoked',
                        type: 'object',
                        properties: {
                            success: { type: 'boolean' },
                            message: { type: 'string' },
                        },
                    },
                    401: { $ref: 'ErrorResponse#' },
                    404: { $ref: 'ErrorResponse#' },
                },
            },
        }, function (request, reply) { return __awaiter(void 0, void 0, void 0, function () {
            var user;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        user = request.user;
                        return [4 /*yield*/, (0, auth_service_js_1.revokeApiKey)(user.userId)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/, reply.status(200).send({
                                success: true,
                                message: 'API key revoked. No requests can be made until a new key is issued.',
                            })];
                }
            });
        }); });
        // ─── GET /v1/account/billing ────────────────────────────────────────────────
        // Creates a Stripe Customer Portal session and returns the one-time URL.
        // Requires JWT. The portal URL expires after 5 minutes.
        fastify.get('/account/billing', {
            preHandler: [auth_js_1.jwtAuth],
            schema: {
                tags: ['Account'],
                summary: 'Get Stripe billing portal URL',
                description: 'Returns a one-time Stripe Customer Portal URL for managing subscription, ' +
                    'payment method, and invoices. URL expires in 5 minutes. ' +
                    'Requires dashboard session (JWT).',
                response: {
                    200: {
                        description: 'Billing portal URL',
                        type: 'object',
                        properties: {
                            success: { type: 'boolean' },
                            url: {
                                type: 'string',
                                description: 'One-time Stripe Customer Portal URL (expires in 5 min)',
                            },
                        },
                    },
                    401: { $ref: 'ErrorResponse#' },
                    403: { $ref: 'ErrorResponse#' },
                    422: { $ref: 'ErrorResponse#' },
                },
            },
        }, function (request, reply) { return __awaiter(void 0, void 0, void 0, function () {
            var user, rows, stripeCustomerId, session;
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        user = request.user;
                        return [4 /*yield*/, index_js_1.db
                                .select({ stripeCustomerId: index_js_2.users.stripeCustomerId })
                                .from(index_js_2.users)
                                .where((0, drizzle_orm_1.eq)(index_js_2.users.id, user.userId))
                                .limit(1)];
                    case 1:
                        rows = _b.sent();
                        stripeCustomerId = (_a = rows[0]) === null || _a === void 0 ? void 0 : _a.stripeCustomerId;
                        if (!stripeCustomerId) {
                            return [2 /*return*/, reply.status(422).send({
                                    success: false,
                                    error: 'no_subscription',
                                    message: 'No billing account found. Please subscribe to a paid plan first.',
                                    request_id: request.id,
                                })];
                        }
                        return [4 /*yield*/, stripe_js_1.stripe.billingPortal.sessions.create({
                                customer: stripeCustomerId,
                                return_url: "".concat(env_js_1.env.APP_BASE_URL, "/dashboard/account"),
                            })];
                    case 2:
                        session = _b.sent();
                        return [2 /*return*/, reply.status(200).send({
                                success: true,
                                url: session.url,
                            })];
                }
            });
        }); });
        // ─── GET /v1/account/usage ───────────────────────────────────────────────────
        // Returns daily API usage for the last 30 days.
        // Requires JWT (dashboard view — not intended for programmatic rate-limit checks;
        // use the X-RateLimit-* headers on /v1/stub responses for that).
        fastify.get('/account/usage', {
            preHandler: [auth_js_1.jwtAuth],
            schema: {
                tags: ['Account'],
                summary: 'Get usage history',
                description: 'Returns daily API call counts for the last 30 days. ' +
                    'Requires dashboard session (JWT).',
                querystring: {
                    type: 'object',
                    additionalProperties: false,
                    properties: {
                        days: {
                            type: 'integer',
                            minimum: 1,
                            maximum: 90,
                            default: 30,
                            description: 'Number of days to look back (default 30, max 90)',
                        },
                    },
                },
                response: {
                    200: {
                        description: 'Usage history',
                        type: 'object',
                        properties: {
                            success: { type: 'boolean' },
                            data: {
                                type: 'array',
                                items: {
                                    type: 'object',
                                    properties: {
                                        date: { type: 'string', format: 'date' },
                                        requestCount: { type: 'integer' },
                                    },
                                },
                            },
                            totalRequests: { type: 'integer' },
                        },
                    },
                    401: { $ref: 'ErrorResponse#' },
                },
            },
        }, function (request, reply) { return __awaiter(void 0, void 0, void 0, function () {
            var user, _a, days, since, rows, totalRequests;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        user = request.user;
                        _a = request.query.days, days = _a === void 0 ? 30 : _a;
                        since = new Date();
                        since.setDate(since.getDate() - days);
                        since.setHours(0, 0, 0, 0);
                        return [4 /*yield*/, index_js_1.db
                                .select({
                                date: index_js_2.apiUsageDaily.date,
                                requestCount: index_js_2.apiUsageDaily.queryCount,
                            })
                                .from(index_js_2.apiUsageDaily)
                                .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(index_js_2.apiUsageDaily.userId, user.userId), (0, drizzle_orm_1.gte)(index_js_2.apiUsageDaily.date, since.toISOString().slice(0, 10))))
                                .orderBy((0, drizzle_orm_1.desc)(index_js_2.apiUsageDaily.date))];
                    case 1:
                        rows = _b.sent();
                        totalRequests = rows.reduce(function (sum, r) { return sum + r.requestCount; }, 0);
                        return [2 /*return*/, reply.status(200).send({
                                success: true,
                                data: rows.map(function (r) { return ({
                                    date: r.date,
                                    requestCount: r.requestCount,
                                }); }),
                                totalRequests: totalRequests,
                            })];
                }
            });
        }); });
        return [2 /*return*/];
    });
}); };
exports.default = accountRoutes;
