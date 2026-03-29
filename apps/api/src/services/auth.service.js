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
var __read = (this && this.__read) || function (o, n) {
    var m = typeof Symbol === "function" && o[Symbol.iterator];
    if (!m) return o;
    var i = m.call(o), r, ar = [], e;
    try {
        while ((n === void 0 || n-- > 0) && !(r = i.next()).done) ar.push(r.value);
    }
    catch (error) { e = { error: error }; }
    finally {
        try {
            if (r && !r.done && (m = i["return"])) m.call(i);
        }
        finally { if (e) throw e.error; }
    }
    return ar;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.register = register;
exports.resendVerificationEmail = resendVerificationEmail;
exports.verifyEmail = verifyEmail;
exports.login = login;
exports.refreshTokens = refreshTokens;
exports.logout = logout;
exports.requestPasswordReset = requestPasswordReset;
exports.resetPassword = resetPassword;
exports.rotateApiKey = rotateApiKey;
exports.revokeApiKey = revokeApiKey;
exports.generateApiKey = generateApiKey;
/**
 * services/auth.service.ts
 *
 * All user authentication and API key lifecycle logic.
 * Routes call these functions — no SQL lives in route handlers.
 *
 * API Key convention:
 *   raw key  = "vs_live_" + 48 hex chars  (never stored)
 *   key_hash = sha256(rawKey).hex           (stored in api_keys.key_hash)
 *   key_prefix = rawKey.slice(0, 16)        (stored for masked display)
 */
var node_crypto_1 = __importDefault(require("node:crypto"));
var bcryptjs_1 = __importDefault(require("bcryptjs"));
// nanoid replaced with native crypto — URL-safe base64, same usage pattern
function nanoid(size) {
    if (size === void 0) { size = 21; }
    return node_crypto_1.default.randomBytes(size).toString('base64url').slice(0, size);
}
var drizzle_orm_1 = require("drizzle-orm");
var index_js_1 = require("../db/index.js");
var index_js_2 = require("../db/schema/index.js");
var auth_js_1 = require("../middleware/auth.js");
var index_js_3 = require("../redis/index.js");
var email_service_js_1 = require("./email.service.js");
var shared_1 = require("@vinstub/shared");
// ─── CONSTANTS ────────────────────────────────────────────────────────────────
var BCRYPT_ROUNDS = 12;
var EMAIL_VERIFY_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours
var PASSWORD_RESET_EXPIRY_MS = 60 * 60 * 1000; // 1 hour
// ─── HELPERS ──────────────────────────────────────────────────────────────────
function generateRawApiKey() {
    var body = node_crypto_1.default.randomBytes(shared_1.API_KEY_BODY_LENGTH / 2).toString('hex');
    return "".concat(shared_1.API_KEY_PREFIX).concat(body);
}
function generateToken() {
    return nanoid(48); // URL-safe, 48 chars
}
function register(email, password, ip) {
    return __awaiter(this, void 0, void 0, function () {
        var ipCount, existing, passwordHash, verificationToken, tokenExpiresAt, _a, user;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    // 1. Password validation (min 8 chars, at least 1 uppercase, 1 digit)
                    if (password.length < 8 || !/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
                        return [2 /*return*/, {
                                code: 'invalid_password',
                                message: 'Password must be at least 8 characters with one uppercase letter and one number.',
                            }];
                    }
                    return [4 /*yield*/, (0, index_js_3.incrementSignupIp)(ip)];
                case 1:
                    ipCount = _b.sent();
                    if (ipCount > shared_1.MAX_SIGNUPS_PER_IP_PER_HOUR) {
                        return [2 /*return*/, {
                                code: 'ip_limit_exceeded',
                                message: 'Too many registrations from this IP address. Please try again later.',
                            }];
                    }
                    return [4 /*yield*/, index_js_1.db
                            .select({ id: index_js_2.users.id })
                            .from(index_js_2.users)
                            .where((0, drizzle_orm_1.eq)(index_js_2.users.email, email.toLowerCase()))
                            .limit(1)];
                case 2:
                    existing = _b.sent();
                    if (existing.length > 0) {
                        return [2 /*return*/, { code: 'email_taken', message: 'An account with that email already exists.' }];
                    }
                    return [4 /*yield*/, bcryptjs_1.default.hash(password, BCRYPT_ROUNDS)];
                case 3:
                    passwordHash = _b.sent();
                    verificationToken = generateToken();
                    tokenExpiresAt = new Date(Date.now() + EMAIL_VERIFY_EXPIRY_MS);
                    return [4 /*yield*/, index_js_1.db
                            .insert(index_js_2.users)
                            .values({
                            email: email.toLowerCase(),
                            passwordHash: passwordHash,
                            emailVerificationToken: verificationToken,
                            emailVerificationTokenExpiresAt: tokenExpiresAt,
                            accountStatus: 'pending_verification',
                            plan: 'free',
                            billingStatus: 'none',
                        })
                            .returning({ id: index_js_2.users.id })];
                case 4:
                    _a = __read.apply(void 0, [_b.sent(), 1]), user = _a[0];
                    if (!user)
                        throw new Error('Failed to create user');
                    // 7. Send verification email (fire-and-forget — don't fail registration if email fails)
                    (0, email_service_js_1.sendEmail)('verify_email', email, { token: verificationToken, userId: user.id })
                        .catch(function (err) { return console.error('[auth] failed to send verify email:', err); });
                    return [2 /*return*/, { userId: user.id }];
            }
        });
    });
}
// ─── RESEND VERIFICATION EMAIL ────────────────────────────────────────────────
function resendVerificationEmail(email) {
    return __awaiter(this, void 0, void 0, function () {
        var rows, user, verificationToken, tokenExpiresAt;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, index_js_1.db
                        .select({
                        id: index_js_2.users.id,
                        emailVerified: index_js_2.users.emailVerified,
                        accountStatus: index_js_2.users.accountStatus,
                    })
                        .from(index_js_2.users)
                        .where((0, drizzle_orm_1.eq)(index_js_2.users.email, email.toLowerCase()))
                        .limit(1)];
                case 1:
                    rows = _a.sent();
                    // Always return { sent: true } — don't reveal whether the email exists
                    if (rows.length === 0)
                        return [2 /*return*/, { sent: true }];
                    user = rows[0];
                    // Already verified — nothing to resend
                    if (user.emailVerified || user.accountStatus !== 'pending_verification') {
                        return [2 /*return*/, { sent: true }];
                    }
                    verificationToken = generateToken();
                    tokenExpiresAt = new Date(Date.now() + EMAIL_VERIFY_EXPIRY_MS);
                    return [4 /*yield*/, index_js_1.db
                            .update(index_js_2.users)
                            .set({
                            emailVerificationToken: verificationToken,
                            emailVerificationTokenExpiresAt: tokenExpiresAt,
                        })
                            .where((0, drizzle_orm_1.eq)(index_js_2.users.id, user.id))];
                case 2:
                    _a.sent();
                    (0, email_service_js_1.sendEmail)('verify_email', email.toLowerCase(), {
                        token: verificationToken,
                        userId: user.id,
                    }).catch(function (err) { return console.error('[auth] failed to resend verify email:', err); });
                    return [2 /*return*/, { sent: true }];
            }
        });
    });
}
function verifyEmail(token) {
    return __awaiter(this, void 0, void 0, function () {
        var rows, user, rawApiKey, keyHash, keyPrefix;
        var _this = this;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, index_js_1.db
                        .select({
                        id: index_js_2.users.id,
                        emailVerified: index_js_2.users.emailVerified,
                        tokenExpiresAt: index_js_2.users.emailVerificationTokenExpiresAt,
                    })
                        .from(index_js_2.users)
                        .where((0, drizzle_orm_1.eq)(index_js_2.users.emailVerificationToken, token))
                        .limit(1)];
                case 1:
                    rows = _a.sent();
                    if (rows.length === 0) {
                        return [2 /*return*/, { code: 'invalid_token', message: 'Verification link is invalid or has already been used.' }];
                    }
                    user = rows[0];
                    if (user.emailVerified) {
                        return [2 /*return*/, { code: 'already_verified', message: 'Email address is already verified.' }];
                    }
                    if (!user.tokenExpiresAt || user.tokenExpiresAt < new Date()) {
                        return [2 /*return*/, { code: 'token_expired', message: 'Verification link has expired. Please request a new one.' }];
                    }
                    rawApiKey = generateRawApiKey();
                    keyHash = (0, auth_js_1.hashApiKey)(rawApiKey);
                    keyPrefix = rawApiKey.slice(0, 16);
                    // 3. Atomic: verify email + create API key
                    return [4 /*yield*/, index_js_1.db.transaction(function (tx) { return __awaiter(_this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0: return [4 /*yield*/, tx
                                            .update(index_js_2.users)
                                            .set({
                                            emailVerified: true,
                                            accountStatus: 'active',
                                            emailVerificationToken: null,
                                            emailVerificationTokenExpiresAt: null,
                                            updatedAt: new Date(),
                                        })
                                            .where((0, drizzle_orm_1.eq)(index_js_2.users.id, user.id))];
                                    case 1:
                                        _a.sent();
                                        return [4 /*yield*/, tx.insert(index_js_2.apiKeys).values({
                                                userId: user.id,
                                                keyHash: keyHash,
                                                keyPrefix: keyPrefix,
                                                isActive: true,
                                            })];
                                    case 2:
                                        _a.sent();
                                        return [2 /*return*/];
                                }
                            });
                        }); })];
                case 2:
                    // 3. Atomic: verify email + create API key
                    _a.sent();
                    // 4. Send welcome email
                    (0, email_service_js_1.sendEmail)('welcome', undefined, { userId: user.id, keyPrefix: keyPrefix })
                        .catch(function (err) { return console.error('[auth] failed to send welcome email:', err); });
                    return [2 /*return*/, { userId: user.id, rawApiKey: rawApiKey }];
            }
        });
    });
}
function login(email, password) {
    return __awaiter(this, void 0, void 0, function () {
        var rows, dummyHash, hashToCheck, passwordMatch, user, jti, accessToken, refreshToken;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, index_js_1.db
                        .select({
                        id: index_js_2.users.id,
                        passwordHash: index_js_2.users.passwordHash,
                        emailVerified: index_js_2.users.emailVerified,
                        accountStatus: index_js_2.users.accountStatus,
                        plan: index_js_2.users.plan,
                    })
                        .from(index_js_2.users)
                        .where((0, drizzle_orm_1.eq)(index_js_2.users.email, email.toLowerCase()))
                        .limit(1)];
                case 1:
                    rows = _a.sent();
                    dummyHash = '$2b$12$invalidhashfortimingattackprevention.padding1234';
                    hashToCheck = rows.length > 0 ? rows[0].passwordHash : dummyHash;
                    return [4 /*yield*/, bcryptjs_1.default.compare(password, hashToCheck)];
                case 2:
                    passwordMatch = _a.sent();
                    if (rows.length === 0 || !passwordMatch) {
                        return [2 /*return*/, { code: 'invalid_credentials', message: 'Invalid email or password.' }];
                    }
                    user = rows[0];
                    if (!user.emailVerified) {
                        return [2 /*return*/, {
                                code: 'email_not_verified',
                                message: 'Please verify your email address before logging in.',
                            }];
                    }
                    if (user.accountStatus === 'suspended') {
                        return [2 /*return*/, {
                                code: 'account_suspended',
                                message: 'Your account has been suspended. Please resolve your outstanding balance.',
                            }];
                    }
                    jti = nanoid(32);
                    accessToken = (0, auth_js_1.signAccessToken)(user.id, user.plan);
                    refreshToken = (0, auth_js_1.signRefreshToken)(user.id, jti);
                    // 3. Store refresh JTI in Redis for revocation support
                    return [4 /*yield*/, (0, index_js_3.storeRefreshJti)(jti)];
                case 3:
                    // 3. Store refresh JTI in Redis for revocation support
                    _a.sent();
                    return [2 /*return*/, { accessToken: accessToken, refreshToken: refreshToken, userId: user.id, plan: user.plan }];
            }
        });
    });
}
function refreshTokens(rawRefreshToken) {
    return __awaiter(this, void 0, void 0, function () {
        var payload, valid, rows, newJti, accessToken, refreshToken;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    try {
                        payload = (0, auth_js_1.verifyRefreshToken)(rawRefreshToken);
                    }
                    catch (_b) {
                        return [2 /*return*/, { code: 'invalid_token', message: 'Refresh token is invalid or expired.' }];
                    }
                    if (payload.type !== 'refresh' || !payload.jti) {
                        return [2 /*return*/, { code: 'invalid_token', message: 'Token type mismatch.' }];
                    }
                    return [4 /*yield*/, (0, index_js_3.isRefreshJtiValid)(payload.jti)];
                case 1:
                    valid = _a.sent();
                    if (!valid) {
                        return [2 /*return*/, { code: 'token_revoked', message: 'Refresh token has been revoked. Please log in again.' }];
                    }
                    return [4 /*yield*/, index_js_1.db
                            .select({ plan: index_js_2.users.plan, accountStatus: index_js_2.users.accountStatus })
                            .from(index_js_2.users)
                            .where((0, drizzle_orm_1.eq)(index_js_2.users.id, payload.sub))
                            .limit(1)];
                case 2:
                    rows = _a.sent();
                    if (rows.length === 0) {
                        return [2 /*return*/, { code: 'invalid_token', message: 'User not found.' }];
                    }
                    // Rotate: revoke old JTI, issue new pair
                    return [4 /*yield*/, (0, index_js_3.revokeRefreshJti)(payload.jti)];
                case 3:
                    // Rotate: revoke old JTI, issue new pair
                    _a.sent();
                    newJti = nanoid(32);
                    accessToken = (0, auth_js_1.signAccessToken)(payload.sub, rows[0].plan);
                    refreshToken = (0, auth_js_1.signRefreshToken)(payload.sub, newJti);
                    return [4 /*yield*/, (0, index_js_3.storeRefreshJti)(newJti)];
                case 4:
                    _a.sent();
                    return [2 /*return*/, { accessToken: accessToken, refreshToken: refreshToken }];
            }
        });
    });
}
// ─── LOGOUT ───────────────────────────────────────────────────────────────────
function logout(rawRefreshToken) {
    return __awaiter(this, void 0, void 0, function () {
        var payload, _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _b.trys.push([0, 3, , 4]);
                    payload = (0, auth_js_1.verifyRefreshToken)(rawRefreshToken);
                    if (!payload.jti) return [3 /*break*/, 2];
                    return [4 /*yield*/, (0, index_js_3.revokeRefreshJti)(payload.jti)];
                case 1:
                    _b.sent();
                    _b.label = 2;
                case 2: return [3 /*break*/, 4];
                case 3:
                    _a = _b.sent();
                    return [3 /*break*/, 4];
                case 4: return [2 /*return*/];
            }
        });
    });
}
// ─── PASSWORD RESET ───────────────────────────────────────────────────────────
function requestPasswordReset(email) {
    return __awaiter(this, void 0, void 0, function () {
        var rows, token, expiresAt;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, index_js_1.db
                        .select({ id: index_js_2.users.id })
                        .from(index_js_2.users)
                        .where((0, drizzle_orm_1.eq)(index_js_2.users.email, email.toLowerCase()))
                        .limit(1)];
                case 1:
                    rows = _a.sent();
                    // Always return success — don't leak whether email exists
                    if (rows.length === 0)
                        return [2 /*return*/];
                    token = generateToken();
                    expiresAt = new Date(Date.now() + PASSWORD_RESET_EXPIRY_MS);
                    return [4 /*yield*/, index_js_1.db
                            .update(index_js_2.users)
                            .set({
                            passwordResetToken: token,
                            passwordResetTokenExpiresAt: expiresAt,
                            updatedAt: new Date(),
                        })
                            .where((0, drizzle_orm_1.eq)(index_js_2.users.id, rows[0].id))];
                case 2:
                    _a.sent();
                    (0, email_service_js_1.sendEmail)('password_reset', email, { token: token })
                        .catch(function (err) { return console.error('[auth] failed to send password reset email:', err); });
                    return [2 /*return*/];
            }
        });
    });
}
function resetPassword(token, newPassword) {
    return __awaiter(this, void 0, void 0, function () {
        var rows, user, passwordHash;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (newPassword.length < 8 || !/[A-Z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
                        return [2 /*return*/, {
                                code: 'invalid_token', // Reuse code to not reveal policy in unauthenticated flow
                                message: 'Password must be at least 8 characters with one uppercase letter and one number.',
                            }];
                    }
                    return [4 /*yield*/, index_js_1.db
                            .select({ id: index_js_2.users.id, tokenExpiresAt: index_js_2.users.passwordResetTokenExpiresAt })
                            .from(index_js_2.users)
                            .where((0, drizzle_orm_1.eq)(index_js_2.users.passwordResetToken, token))
                            .limit(1)];
                case 1:
                    rows = _a.sent();
                    if (rows.length === 0) {
                        return [2 /*return*/, { code: 'invalid_token', message: 'Reset link is invalid or has already been used.' }];
                    }
                    user = rows[0];
                    if (!user.tokenExpiresAt || user.tokenExpiresAt < new Date()) {
                        return [2 /*return*/, { code: 'token_expired', message: 'Reset link has expired. Please request a new one.' }];
                    }
                    return [4 /*yield*/, bcryptjs_1.default.hash(newPassword, BCRYPT_ROUNDS)];
                case 2:
                    passwordHash = _a.sent();
                    return [4 /*yield*/, index_js_1.db
                            .update(index_js_2.users)
                            .set({
                            passwordHash: passwordHash,
                            passwordResetToken: null,
                            passwordResetTokenExpiresAt: null,
                            updatedAt: new Date(),
                        })
                            .where((0, drizzle_orm_1.eq)(index_js_2.users.id, user.id))];
                case 3:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
/**
 * Rotate the user's API key — deactivates old key, generates new key.
 * Returns the new raw key (shown once, never stored).
 */
function rotateApiKey(userId) {
    return __awaiter(this, void 0, void 0, function () {
        var rawApiKey, keyHash, keyPrefix, existingRows;
        var _this = this;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    rawApiKey = generateRawApiKey();
                    keyHash = (0, auth_js_1.hashApiKey)(rawApiKey);
                    keyPrefix = rawApiKey.slice(0, 16);
                    return [4 /*yield*/, index_js_1.db
                            .select({ keyHash: index_js_2.apiKeys.keyHash })
                            .from(index_js_2.apiKeys)
                            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(index_js_2.apiKeys.userId, userId), (0, drizzle_orm_1.eq)(index_js_2.apiKeys.isActive, true)))
                            .limit(1)];
                case 1:
                    existingRows = _a.sent();
                    return [4 /*yield*/, index_js_1.db.transaction(function (tx) { return __awaiter(_this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0: 
                                    // Deactivate existing key(s) for this user
                                    return [4 /*yield*/, tx
                                            .update(index_js_2.apiKeys)
                                            .set({ isActive: false, rotatedAt: new Date() })
                                            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(index_js_2.apiKeys.userId, userId), (0, drizzle_orm_1.eq)(index_js_2.apiKeys.isActive, true)))];
                                    case 1:
                                        // Deactivate existing key(s) for this user
                                        _a.sent();
                                        // Insert new key
                                        return [4 /*yield*/, tx.insert(index_js_2.apiKeys).values({
                                                userId: userId,
                                                keyHash: keyHash,
                                                keyPrefix: keyPrefix,
                                                isActive: true,
                                            })];
                                    case 2:
                                        // Insert new key
                                        _a.sent();
                                        return [2 /*return*/];
                                }
                            });
                        }); })];
                case 2:
                    _a.sent();
                    if (!(existingRows.length > 0)) return [3 /*break*/, 4];
                    return [4 /*yield*/, (0, index_js_3.invalidateAuthCache)(existingRows[0].keyHash)];
                case 3:
                    _a.sent();
                    _a.label = 4;
                case 4: return [2 /*return*/, { rawApiKey: rawApiKey, keyPrefix: keyPrefix }];
            }
        });
    });
}
/**
 * Revoke the user's active API key without generating a replacement.
 * The user must call POST /v1/account/generate-key to get a new one.
 */
function revokeApiKey(userId) {
    return __awaiter(this, void 0, void 0, function () {
        var existingRows;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, index_js_1.db
                        .select({ keyHash: index_js_2.apiKeys.keyHash })
                        .from(index_js_2.apiKeys)
                        .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(index_js_2.apiKeys.userId, userId), (0, drizzle_orm_1.eq)(index_js_2.apiKeys.isActive, true)))
                        .limit(1)];
                case 1:
                    existingRows = _a.sent();
                    return [4 /*yield*/, index_js_1.db
                            .update(index_js_2.apiKeys)
                            .set({ isActive: false, rotatedAt: new Date() })
                            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(index_js_2.apiKeys.userId, userId), (0, drizzle_orm_1.eq)(index_js_2.apiKeys.isActive, true)))];
                case 2:
                    _a.sent();
                    if (!(existingRows.length > 0)) return [3 /*break*/, 4];
                    return [4 /*yield*/, (0, index_js_3.invalidateAuthCache)(existingRows[0].keyHash)];
                case 3:
                    _a.sent();
                    _a.label = 4;
                case 4: return [2 /*return*/];
            }
        });
    });
}
/**
 * Generate a fresh API key for a user who has no active key (e.g., after revocation).
 * Throws if the user already has an active key — they must rotate instead.
 */
function generateApiKey(userId) {
    return __awaiter(this, void 0, void 0, function () {
        var existing, rawApiKey, keyHash, keyPrefix;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, index_js_1.db
                        .select({ id: index_js_2.apiKeys.id })
                        .from(index_js_2.apiKeys)
                        .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(index_js_2.apiKeys.userId, userId), (0, drizzle_orm_1.eq)(index_js_2.apiKeys.isActive, true)))
                        .limit(1)];
                case 1:
                    existing = _a.sent();
                    if (existing.length > 0) {
                        throw new Error('User already has an active API key. Use rotate instead.');
                    }
                    rawApiKey = generateRawApiKey();
                    keyHash = (0, auth_js_1.hashApiKey)(rawApiKey);
                    keyPrefix = rawApiKey.slice(0, 16);
                    return [4 /*yield*/, index_js_1.db.insert(index_js_2.apiKeys).values({ userId: userId, keyHash: keyHash, keyPrefix: keyPrefix, isActive: true })];
                case 2:
                    _a.sent();
                    return [2 /*return*/, { rawApiKey: rawApiKey, keyPrefix: keyPrefix }];
            }
        });
    });
}
