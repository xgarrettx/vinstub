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
var auth_service_js_1 = require("../../services/auth.service.js");
var env_js_1 = require("../../config/env.js");
// ─── COOKIE CONFIG ────────────────────────────────────────────────────────────
var REFRESH_COOKIE = 'vs_refresh';
var COOKIE_MAX_AGE = 7 * 24 * 60 * 60; // 7 days in seconds
function setRefreshCookie(reply, token) {
    reply.setCookie(REFRESH_COOKIE, token, {
        httpOnly: true,
        secure: env_js_1.env.NODE_ENV === 'production',
        sameSite: 'lax', // 'strict' blocks cookie on redirects from email links
        path: '/', // '/' so Next.js middleware can read it across all routes
        maxAge: COOKIE_MAX_AGE,
    });
}
function clearRefreshCookie(reply) {
    reply.clearCookie(REFRESH_COOKIE, {
        httpOnly: true,
        secure: env_js_1.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
    });
}
// ─── SCHEMAS ──────────────────────────────────────────────────────────────────
var registerBodySchema = {
    type: 'object',
    required: ['email', 'password'],
    additionalProperties: false,
    properties: {
        email: { type: 'string', format: 'email', maxLength: 254 },
        password: { type: 'string', minLength: 8, maxLength: 128 },
    },
};
var loginBodySchema = {
    type: 'object',
    required: ['email', 'password'],
    additionalProperties: false,
    properties: {
        email: { type: 'string', format: 'email', maxLength: 254 },
        password: { type: 'string', minLength: 1, maxLength: 128 },
    },
};
var verifyEmailQuerySchema = {
    type: 'object',
    required: ['token'],
    properties: {
        token: { type: 'string', minLength: 1 },
    },
};
var forgotPasswordBodySchema = {
    type: 'object',
    required: ['email'],
    additionalProperties: false,
    properties: {
        email: { type: 'string', format: 'email', maxLength: 254 },
    },
};
var resetPasswordBodySchema = {
    type: 'object',
    required: ['token', 'password'],
    additionalProperties: false,
    properties: {
        token: { type: 'string', minLength: 1 },
        password: { type: 'string', minLength: 8, maxLength: 128 },
    },
};
// ─── PLUGIN ───────────────────────────────────────────────────────────────────
var authRoutes = function (fastify) { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        /**
         * POST /auth/register
         *
         * Creates a new user account and sends a verification email.
         * Does NOT log the user in — they must verify email first.
         */
        fastify.post('/register', {
            schema: {
                tags: ['Auth'],
                summary: 'Register a new account',
                body: registerBodySchema,
                response: {
                    201: {
                        description: 'Account created; verification email sent',
                        type: 'object',
                        properties: {
                            success: { type: 'boolean' },
                            message: { type: 'string' },
                            userId: { type: 'string' },
                        },
                    },
                    409: { $ref: 'ErrorResponse#' },
                    429: { $ref: 'ErrorResponse#' },
                    422: { $ref: 'ErrorResponse#' },
                },
            },
        }, function (request, reply) { return __awaiter(void 0, void 0, void 0, function () {
            var _a, email, password, ip, result;
            var _b, _c, _d;
            return __generator(this, function (_e) {
                switch (_e.label) {
                    case 0:
                        _a = request.body, email = _a.email, password = _a.password;
                        ip = (_d = (_c = (_b = request.headers['x-forwarded-for']) === null || _b === void 0 ? void 0 : _b.split(',')[0]) === null || _c === void 0 ? void 0 : _c.trim()) !== null && _d !== void 0 ? _d : request.ip;
                        return [4 /*yield*/, (0, auth_service_js_1.register)(email, password, ip)];
                    case 1:
                        result = _e.sent();
                        if ('code' in result) {
                            if (result.code === 'email_taken') {
                                return [2 /*return*/, reply.status(409).send({
                                        success: false,
                                        error: result.code,
                                        message: result.message,
                                        request_id: request.id,
                                    })];
                            }
                            if (result.code === 'ip_limit_exceeded') {
                                return [2 /*return*/, reply.status(429).send({
                                        success: false,
                                        error: result.code,
                                        message: result.message,
                                        request_id: request.id,
                                    })];
                            }
                            // invalid_password
                            return [2 /*return*/, reply.status(422).send({
                                    success: false,
                                    error: result.code,
                                    message: result.message,
                                    request_id: request.id,
                                })];
                        }
                        return [2 /*return*/, reply.status(201).send({
                                success: true,
                                message: 'Account created. Please check your email to verify your address.',
                                userId: result.userId,
                            })];
                }
            });
        }); });
        /**
         * GET /auth/verify-email?token=
         *
         * Verifies the user's email address. On success, activates the account,
         * generates the user's first API key, and returns the raw key ONE TIME.
         * The raw key is never stored — if lost, the user must rotate.
         */
        fastify.get('/verify-email', {
            schema: {
                tags: ['Auth'],
                summary: 'Verify email address',
                querystring: verifyEmailQuerySchema,
                response: {
                    200: {
                        description: 'Email verified; API key returned once',
                        type: 'object',
                        properties: {
                            success: { type: 'boolean' },
                            message: { type: 'string' },
                            userId: { type: 'string' },
                            apiKey: {
                                type: 'string',
                                description: 'Your API key. Save this — it will not be shown again.',
                            },
                        },
                    },
                    400: { $ref: 'ErrorResponse#' },
                    410: { $ref: 'ErrorResponse#' },
                },
            },
        }, function (request, reply) { return __awaiter(void 0, void 0, void 0, function () {
            var token, result, status_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        token = request.query.token;
                        return [4 /*yield*/, (0, auth_service_js_1.verifyEmail)(token)];
                    case 1:
                        result = _a.sent();
                        if ('code' in result) {
                            status_1 = result.code === 'token_expired' ? 410 : 400;
                            return [2 /*return*/, reply.status(status_1).send({
                                    success: false,
                                    error: result.code,
                                    message: result.message,
                                    request_id: request.id,
                                })];
                        }
                        return [2 /*return*/, reply.status(200).send({
                                success: true,
                                message: 'Email verified. Your API key has been generated. Save it now — it will not be shown again.',
                                userId: result.userId,
                                apiKey: result.rawApiKey,
                            })];
                }
            });
        }); });
        /**
         * POST /auth/login
         *
         * Authenticates with email + password.
         * Returns an access token in the body and sets the refresh token
         * as an httpOnly cookie scoped to /auth.
         */
        fastify.post('/login', {
            schema: {
                tags: ['Auth'],
                summary: 'Log in to the dashboard',
                body: loginBodySchema,
                response: {
                    200: {
                        description: 'Login successful',
                        type: 'object',
                        properties: {
                            success: { type: 'boolean' },
                            accessToken: { type: 'string' },
                            userId: { type: 'string' },
                            plan: { type: 'string' },
                        },
                    },
                    401: { $ref: 'ErrorResponse#' },
                    403: { $ref: 'ErrorResponse#' },
                },
            },
        }, function (request, reply) { return __awaiter(void 0, void 0, void 0, function () {
            var _a, email, password, result, status_2;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _a = request.body, email = _a.email, password = _a.password;
                        return [4 /*yield*/, (0, auth_service_js_1.login)(email, password)];
                    case 1:
                        result = _b.sent();
                        if ('code' in result) {
                            status_2 = result.code === 'account_suspended' ? 403 : 401;
                            return [2 /*return*/, reply.status(status_2).send({
                                    success: false,
                                    error: result.code,
                                    message: result.message,
                                    request_id: request.id,
                                })];
                        }
                        setRefreshCookie(reply, result.refreshToken);
                        return [2 /*return*/, reply.status(200).send({
                                success: true,
                                accessToken: result.accessToken,
                                userId: result.userId,
                                plan: result.plan,
                            })];
                }
            });
        }); });
        /**
         * POST /auth/refresh
         *
         * Issues a new access + refresh token pair.
         * Reads the refresh token from the httpOnly cookie.
         * Old refresh token is revoked (rotation).
         */
        fastify.post('/refresh', {
            schema: {
                tags: ['Auth'],
                summary: 'Refresh access token',
                response: {
                    200: {
                        description: 'Tokens rotated',
                        type: 'object',
                        properties: {
                            success: { type: 'boolean' },
                            accessToken: { type: 'string' },
                        },
                    },
                    401: { $ref: 'ErrorResponse#' },
                },
            },
        }, function (request, reply) { return __awaiter(void 0, void 0, void 0, function () {
            var refreshToken, result;
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        refreshToken = (_a = request.cookies) === null || _a === void 0 ? void 0 : _a[REFRESH_COOKIE];
                        if (!refreshToken) {
                            return [2 /*return*/, reply.status(401).send({
                                    success: false,
                                    error: 'unauthorized',
                                    message: 'No refresh token. Please log in again.',
                                    request_id: request.id,
                                })];
                        }
                        return [4 /*yield*/, (0, auth_service_js_1.refreshTokens)(refreshToken)];
                    case 1:
                        result = _b.sent();
                        if ('code' in result) {
                            clearRefreshCookie(reply);
                            return [2 /*return*/, reply.status(401).send({
                                    success: false,
                                    error: result.code,
                                    message: result.message,
                                    request_id: request.id,
                                })];
                        }
                        setRefreshCookie(reply, result.refreshToken);
                        return [2 /*return*/, reply.status(200).send({
                                success: true,
                                accessToken: result.accessToken,
                            })];
                }
            });
        }); });
        /**
         * POST /auth/logout
         *
         * Revokes the refresh token and clears the cookie.
         * Always returns 200 — logout should never fail from the user's perspective.
         */
        fastify.post('/logout', {
            schema: {
                tags: ['Auth'],
                summary: 'Log out',
                response: {
                    200: {
                        description: 'Logged out',
                        type: 'object',
                        properties: {
                            success: { type: 'boolean' },
                            message: { type: 'string' },
                        },
                    },
                },
            },
        }, function (request, reply) { return __awaiter(void 0, void 0, void 0, function () {
            var refreshToken;
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        refreshToken = (_a = request.cookies) === null || _a === void 0 ? void 0 : _a[REFRESH_COOKIE];
                        if (!refreshToken) return [3 /*break*/, 2];
                        return [4 /*yield*/, (0, auth_service_js_1.logout)(refreshToken)];
                    case 1:
                        _b.sent();
                        _b.label = 2;
                    case 2:
                        clearRefreshCookie(reply);
                        return [2 /*return*/, reply.status(200).send({
                                success: true,
                                message: 'Logged out successfully.',
                            })];
                }
            });
        }); });
        /**
         * POST /auth/forgot-password
         *
         * Sends a password reset email. Always returns 200 to prevent
         * email enumeration — the response is identical whether the address
         * exists or not.
         */
        fastify.post('/forgot-password', {
            schema: {
                tags: ['Auth'],
                summary: 'Request password reset email',
                body: forgotPasswordBodySchema,
                response: {
                    200: {
                        description: 'Reset email sent (if account exists)',
                        type: 'object',
                        properties: {
                            success: { type: 'boolean' },
                            message: { type: 'string' },
                        },
                    },
                },
            },
        }, function (request, reply) { return __awaiter(void 0, void 0, void 0, function () {
            var email;
            return __generator(this, function (_a) {
                email = request.body.email;
                // Fire-and-forget — always respond the same way
                (0, auth_service_js_1.requestPasswordReset)(email).catch(function (err) {
                    return fastify.log.error({ err: err }, '[auth] forgot-password failed');
                });
                return [2 /*return*/, reply.status(200).send({
                        success: true,
                        message: 'If an account with that email exists, you will receive a reset link shortly.',
                    })];
            });
        }); });
        /**
         * POST /auth/reset-password
         *
         * Resets the password using the token from the email link.
         * Token is single-use and expires in 1 hour.
         */
        fastify.post('/reset-password', {
            schema: {
                tags: ['Auth'],
                summary: 'Reset password using email token',
                body: resetPasswordBodySchema,
                response: {
                    200: {
                        description: 'Password reset successfully',
                        type: 'object',
                        properties: {
                            success: { type: 'boolean' },
                            message: { type: 'string' },
                        },
                    },
                    400: { $ref: 'ErrorResponse#' },
                    410: { $ref: 'ErrorResponse#' },
                },
            },
        }, function (request, reply) { return __awaiter(void 0, void 0, void 0, function () {
            var _a, token, password, result, status_3;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _a = request.body, token = _a.token, password = _a.password;
                        return [4 /*yield*/, (0, auth_service_js_1.resetPassword)(token, password)];
                    case 1:
                        result = _b.sent();
                        if (result && 'code' in result) {
                            status_3 = result.code === 'token_expired' ? 410 : 400;
                            return [2 /*return*/, reply.status(status_3).send({
                                    success: false,
                                    error: result.code,
                                    message: result.message,
                                    request_id: request.id,
                                })];
                        }
                        return [2 /*return*/, reply.status(200).send({
                                success: true,
                                message: 'Password reset successfully. You can now log in with your new password.',
                            })];
                }
            });
        }); });
        /**
         * POST /auth/resend-verification
         *
         * Generates a fresh verification token and resends the email.
         * Always returns 200 to prevent email enumeration.
         */
        fastify.post('/resend-verification', {
            schema: {
                tags: ['Auth'],
                summary: 'Resend email verification link',
                body: {
                    type: 'object',
                    required: ['email'],
                    additionalProperties: false,
                    properties: {
                        email: { type: 'string', format: 'email', maxLength: 254 },
                    },
                },
                response: {
                    200: {
                        type: 'object',
                        properties: {
                            success: { type: 'boolean' },
                            message: { type: 'string' },
                        },
                    },
                },
            },
        }, function (request, reply) { return __awaiter(void 0, void 0, void 0, function () {
            var email;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        email = request.body.email;
                        return [4 /*yield*/, (0, auth_service_js_1.resendVerificationEmail)(email)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/, reply.status(200).send({
                                success: true,
                                message: 'If an unverified account exists for that email, a new verification link has been sent.',
                            })];
                }
            });
        }); });
        return [2 /*return*/];
    });
}); };
exports.default = authRoutes;
