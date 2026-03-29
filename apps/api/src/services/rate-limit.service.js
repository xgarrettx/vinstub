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
Object.defineProperty(exports, "__esModule", { value: true });
exports.incrementCounters = incrementCounters;
exports.peekCounters = peekCounters;
exports.checkRateLimit = checkRateLimit;
exports.resetCounters = resetCounters;
/**
 * services/rate-limit.service.ts — Redis counter helpers for rate limiting.
 *
 * Architecture: Two-layer sliding window.
 *
 *   Layer 1 — Per-minute + per-hour counters (Redis INCR + EXPIREAT)
 *     Key format:
 *       rl:min:{userId}:{minuteFloor}    — floor(now / 60) in seconds
 *       rl:hr:{userId}:{hourFloor}       — floor(now / 3600) in seconds
 *     TTL: set to end of the current window (next minute/hour boundary).
 *     These are HARD limits for ALL plans — 429 is returned when exceeded.
 *
 *   Layer 2 — Daily quota counter (Redis INCR + EXPIREAT)
 *     Key format:
 *       rl:day:{userId}:{YYYY-MM-DD}     — UTC calendar date
 *     TTL: midnight UTC of the next day.
 *     For Free tier: HARD limit (429 when exceeded).
 *     For paid tiers: SOFT cap — request is allowed but X-Soft-Cap-Exceeded: true
 *     is set on the response, and the daily count is still incremented.
 *
 * Usage sync:
 *   The daily Redis counter is the source of truth for in-flight limiting.
 *   A background job (jobs/sync-usage.ts) syncs Redis daily counts to the
 *   api_usage_daily Postgres table every 60 seconds for durable history.
 *
 * Concurrency:
 *   Concurrency limits are enforced at the infrastructure level (DigitalOcean
 *   App Platform autoscaling + connection pool caps). Not tracked here.
 */
var index_js_1 = require("../redis/index.js");
var constants_js_1 = require("@vinstub/shared/constants.js");
// ─── TIME HELPERS ─────────────────────────────────────────────────────────────
/** Returns the floor of now in whole minutes (used as Redis key suffix) */
function minuteFloor() {
    return Math.floor(Date.now() / 1000 / 60) * 60;
}
/** Returns the floor of now in whole hours (used as Redis key suffix) */
function hourFloor() {
    return Math.floor(Date.now() / 1000 / 3600) * 3600;
}
/** Returns today's UTC date as YYYY-MM-DD */
function todayUtc() {
    return new Date().toISOString().slice(0, 10);
}
/** Returns the Unix timestamp (seconds) for midnight UTC tomorrow */
function midnightTomorrowUtc() {
    var d = new Date();
    d.setUTCHours(24, 0, 0, 0);
    return Math.floor(d.getTime() / 1000);
}
/** Returns the Unix timestamp (seconds) for the start of the next minute */
function nextMinuteBoundary() {
    return minuteFloor() + 60;
}
// ─── CORE: INCREMENT ALL COUNTERS ─────────────────────────────────────────────
/**
 * Increment all three counters (minute, hour, day) for the given user
 * atomically using a Redis pipeline. Sets TTL on first write.
 *
 * @returns The post-increment values of all three counters.
 */
function incrementCounters(userId) {
    return __awaiter(this, void 0, void 0, function () {
        var minKey, hrKey, dayKey, minExpire, hrExpire, dayExpire, pipeline, results, minuteCount, hourCount, dayCount;
        var _a, _b, _c, _d, _e, _f;
        return __generator(this, function (_g) {
            switch (_g.label) {
                case 0:
                    minKey = index_js_1.Keys.rateLimitMinute(userId, minuteFloor());
                    hrKey = index_js_1.Keys.rateLimitHour(userId, hourFloor());
                    dayKey = index_js_1.Keys.rateLimitDay(userId, todayUtc());
                    minExpire = nextMinuteBoundary();
                    hrExpire = hourFloor() + 3600;
                    dayExpire = midnightTomorrowUtc();
                    pipeline = index_js_1.redis.pipeline();
                    pipeline.incr(minKey);
                    pipeline.expireat(minKey, minExpire);
                    pipeline.incr(hrKey);
                    pipeline.expireat(hrKey, hrExpire);
                    pipeline.incr(dayKey);
                    pipeline.expireat(dayKey, dayExpire);
                    return [4 /*yield*/, pipeline.exec()];
                case 1:
                    results = _g.sent();
                    minuteCount = (_b = (_a = results === null || results === void 0 ? void 0 : results[0]) === null || _a === void 0 ? void 0 : _a[1]) !== null && _b !== void 0 ? _b : 1;
                    hourCount = (_d = (_c = results === null || results === void 0 ? void 0 : results[2]) === null || _c === void 0 ? void 0 : _c[1]) !== null && _d !== void 0 ? _d : 1;
                    dayCount = (_f = (_e = results === null || results === void 0 ? void 0 : results[4]) === null || _e === void 0 ? void 0 : _e[1]) !== null && _f !== void 0 ? _f : 1;
                    return [2 /*return*/, { minuteCount: minuteCount, hourCount: hourCount, dayCount: dayCount }];
            }
        });
    });
}
/**
 * Read all three counters WITHOUT incrementing.
 * Used for inspection (e.g. health dashboards, tests).
 */
function peekCounters(userId) {
    return __awaiter(this, void 0, void 0, function () {
        var minKey, hrKey, dayKey, _a, minVal, hrVal, dayVal;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    minKey = index_js_1.Keys.rateLimitMinute(userId, minuteFloor());
                    hrKey = index_js_1.Keys.rateLimitHour(userId, hourFloor());
                    dayKey = index_js_1.Keys.rateLimitDay(userId, todayUtc());
                    return [4 /*yield*/, index_js_1.redis.mget(minKey, hrKey, dayKey)];
                case 1:
                    _a = __read.apply(void 0, [_b.sent(), 3]), minVal = _a[0], hrVal = _a[1], dayVal = _a[2];
                    return [2 /*return*/, {
                            minuteCount: minVal ? parseInt(minVal, 10) : 0,
                            hourCount: hrVal ? parseInt(hrVal, 10) : 0,
                            dayCount: dayVal ? parseInt(dayVal, 10) : 0,
                        }];
            }
        });
    });
}
// ─── CORE: RATE LIMIT DECISION ────────────────────────────────────────────────
/**
 * Increment counters and return a rate limit decision for the given user/plan.
 *
 * Decision logic:
 *   1. Increment all three counters.
 *   2. Check per-minute: if exceeded → BLOCK (all plans).
 *   3. Check per-hour:   if exceeded → BLOCK (all plans).
 *   4. Check daily:
 *      - Free plan  → BLOCK if exceeded
 *      - Paid plans → ALLOW but set softCapExceeded = true
 *
 * Note: We increment BEFORE checking the limit (optimistic counter).
 * This means the counter is always accurate even for blocked requests.
 * The alternative (check-then-increment) has a TOCTOU race condition.
 */
function checkRateLimit(userId, plan) {
    return __awaiter(this, void 0, void 0, function () {
        var limits, counters, dailyResetAt, minuteResetAt;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    limits = constants_js_1.PLAN_LIMITS[plan];
                    return [4 /*yield*/, incrementCounters(userId)];
                case 1:
                    counters = _a.sent();
                    dailyResetAt = midnightTomorrowUtc();
                    minuteResetAt = nextMinuteBoundary();
                    // Hard block: per-minute limit exceeded
                    if (counters.minuteCount > limits.perMinute) {
                        return [2 /*return*/, {
                                allowed: false,
                                blockReason: 'minute_limit',
                                softCapExceeded: false,
                                counters: counters,
                                dailyResetAt: dailyResetAt,
                                minuteResetAt: minuteResetAt,
                            }];
                    }
                    // Hard block: per-hour limit exceeded
                    if (counters.hourCount > limits.perHour) {
                        return [2 /*return*/, {
                                allowed: false,
                                blockReason: 'hour_limit',
                                softCapExceeded: false,
                                counters: counters,
                                dailyResetAt: dailyResetAt,
                                minuteResetAt: minuteResetAt,
                            }];
                    }
                    // Daily quota check
                    if (counters.dayCount > limits.daily) {
                        if (!limits.softDailyCap) {
                            // Free plan: hard block
                            return [2 /*return*/, {
                                    allowed: false,
                                    blockReason: 'day_limit',
                                    softCapExceeded: false,
                                    counters: counters,
                                    dailyResetAt: dailyResetAt,
                                    minuteResetAt: minuteResetAt,
                                }];
                        }
                        // Paid plan: soft cap — allow but signal
                        return [2 /*return*/, {
                                allowed: true,
                                softCapExceeded: true,
                                counters: counters,
                                dailyResetAt: dailyResetAt,
                                minuteResetAt: minuteResetAt,
                            }];
                    }
                    return [2 /*return*/, {
                            allowed: true,
                            softCapExceeded: false,
                            counters: counters,
                            dailyResetAt: dailyResetAt,
                            minuteResetAt: minuteResetAt,
                        }];
            }
        });
    });
}
// ─── RESET HELPERS ────────────────────────────────────────────────────────────
/**
 * Reset all rate limit counters for a user.
 * Used by tests and admin tools — not called in the request path.
 */
function resetCounters(userId) {
    return __awaiter(this, void 0, void 0, function () {
        var minKey, hrKey, dayKey;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    minKey = index_js_1.Keys.rateLimitMinute(userId, minuteFloor());
                    hrKey = index_js_1.Keys.rateLimitHour(userId, hourFloor());
                    dayKey = index_js_1.Keys.rateLimitDay(userId, todayUtc());
                    return [4 /*yield*/, index_js_1.redis.del(minKey, hrKey, dayKey)];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
