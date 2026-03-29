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
exports.TTL = exports.Keys = exports.redis = void 0;
exports.getRedis = getRedis;
exports.closeRedis = closeRedis;
exports.setAuthCache = setAuthCache;
exports.getAuthCache = getAuthCache;
exports.invalidateAuthCache = invalidateAuthCache;
exports.storeRefreshJti = storeRefreshJti;
exports.isRefreshJtiValid = isRefreshJtiValid;
exports.revokeRefreshJti = revokeRefreshJti;
exports.incrementSignupIp = incrementSignupIp;
/**
 * redis/index.ts — ioredis client singleton + typed helpers.
 *
 * All Redis interactions in the app go through these helpers so:
 *  - Key naming is consistent and documented in one place
 *  - Error handling is centralized
 *  - Tests can mock a single module
 */
var ioredis_1 = __importDefault(require("ioredis"));
var env_js_1 = require("../config/env.js");
// ─── CLIENT ───────────────────────────────────────────────────────────────────
var _client = null;
function getRedis() {
    if (!_client) {
        _client = new ioredis_1.default(env_js_1.env.REDIS_URL, {
            maxRetriesPerRequest: 3,
            retryStrategy: function (times) { return Math.min(times * 100, 3000); },
            enableReadyCheck: true,
            lazyConnect: false,
        });
        _client.on('error', function (err) {
            // Don't crash on Redis errors — the rate-limit middleware handles disconnects
            console.error('[redis] connection error:', err.message);
        });
    }
    return _client;
}
function closeRedis() {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!_client) return [3 /*break*/, 2];
                    return [4 /*yield*/, _client.quit()];
                case 1:
                    _a.sent();
                    _client = null;
                    _a.label = 2;
                case 2: return [2 /*return*/];
            }
        });
    });
}
/**
 * Lazy singleton — use this everywhere instead of calling getRedis() directly.
 * The Proxy defers client creation until the first method call, so importing
 * this module doesn't immediately open a Redis connection (useful for scripts
 * and tests that may not need Redis).
 */
exports.redis = new Proxy({}, {
    get: function (_target, prop) {
        return Reflect.get(getRedis(), prop);
    },
});
// ─── KEY SCHEMA ───────────────────────────────────────────────────────────────
// Centralised key builders — one place to see every Redis key used in the system.
/** Per-minute rate-limit counter */
exports.Keys = {
    rateLimitMinute: function (userId, minuteFloor) {
        return "rl:min:".concat(userId, ":").concat(minuteFloor);
    },
    rateLimitHour: function (userId, hourFloor) {
        return "rl:hr:".concat(userId, ":").concat(hourFloor);
    },
    rateLimitDay: function (userId, dateStr) {
        return "rl:day:".concat(userId, ":").concat(dateStr);
    },
    /** Auth cache — key hash → {user_id, plan, account_status} */
    authCache: function (keyHash) { return "key:hash:".concat(keyHash); },
    /** JWT refresh token invalidation set */
    refreshJti: function (jti) { return "jti:".concat(jti); },
    /** Cached /v1/makes response */
    makesList: function () { return "ref:makes"; },
    /** Cached /v1/models?make= response */
    modelsList: function (makeNormalized) { return "ref:models:".concat(makeNormalized); },
    /** Signup throttle per IP */
    signupIp: function (ip) { return "signup:ip:".concat(ip); },
};
// ─── TTL CONSTANTS (seconds) ──────────────────────────────────────────────────
exports.TTL = {
    rateLimitMinute: 90, // 1.5× the window so late requests don't get missed
    rateLimitHour: 7200, // 2× the window
    rateLimitDay: 172800, // 2 days — survives UTC midnight rollover
    authCache: 60, // 1 minute — fast key validation, tolerates 60s revocation lag
    makesList: 300, // 5 minutes
    modelsList: 300,
    signupIp: 3600, // 1 hour
    refreshToken: 604800, // 7 days
};
/** Write an auth cache entry. Returns the Redis response. */
function setAuthCache(keyHash, entry) {
    return __awaiter(this, void 0, void 0, function () {
        var redis;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    redis = getRedis();
                    return [4 /*yield*/, redis.setex(exports.Keys.authCache(keyHash), exports.TTL.authCache, JSON.stringify(entry))];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
/** Read an auth cache entry. Returns null on miss. */
function getAuthCache(keyHash) {
    return __awaiter(this, void 0, void 0, function () {
        var redis, raw;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    redis = getRedis();
                    return [4 /*yield*/, redis.get(exports.Keys.authCache(keyHash))];
                case 1:
                    raw = _a.sent();
                    if (!raw)
                        return [2 /*return*/, null];
                    return [2 /*return*/, JSON.parse(raw)];
            }
        });
    });
}
/** Evict an auth cache entry (on key rotation/revocation). */
function invalidateAuthCache(keyHash) {
    return __awaiter(this, void 0, void 0, function () {
        var redis;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    redis = getRedis();
                    return [4 /*yield*/, redis.del(exports.Keys.authCache(keyHash))];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
/** Store a refresh token JTI so it can be invalidated on logout/rotation. */
function storeRefreshJti(jti) {
    return __awaiter(this, void 0, void 0, function () {
        var redis;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    redis = getRedis();
                    return [4 /*yield*/, redis.setex(exports.Keys.refreshJti(jti), exports.TTL.refreshToken, '1')];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
/** Returns true if the JTI is still valid (not revoked). */
function isRefreshJtiValid(jti) {
    return __awaiter(this, void 0, void 0, function () {
        var redis, val;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    redis = getRedis();
                    return [4 /*yield*/, redis.get(exports.Keys.refreshJti(jti))];
                case 1:
                    val = _a.sent();
                    return [2 /*return*/, val === '1'];
            }
        });
    });
}
/** Revoke a refresh token JTI. */
function revokeRefreshJti(jti) {
    return __awaiter(this, void 0, void 0, function () {
        var redis;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    redis = getRedis();
                    return [4 /*yield*/, redis.del(exports.Keys.refreshJti(jti))];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
/** Increment signup IP counter. Returns new count. */
function incrementSignupIp(ip) {
    return __awaiter(this, void 0, void 0, function () {
        var redis, key, count;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    redis = getRedis();
                    key = exports.Keys.signupIp(ip);
                    return [4 /*yield*/, redis.incr(key)];
                case 1:
                    count = _a.sent();
                    if (!(count === 1)) return [3 /*break*/, 3];
                    return [4 /*yield*/, redis.expire(key, exports.TTL.signupIp)];
                case 2:
                    _a.sent();
                    _a.label = 3;
                case 3: return [2 /*return*/, count];
            }
        });
    });
}
