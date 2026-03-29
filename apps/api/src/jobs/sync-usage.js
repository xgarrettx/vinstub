"use strict";
var __makeTemplateObject = (this && this.__makeTemplateObject) || function (cooked, raw) {
    if (Object.defineProperty) { Object.defineProperty(cooked, "raw", { value: raw }); } else { cooked.raw = raw; }
    return cooked;
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
var __values = (this && this.__values) || function(o) {
    var s = typeof Symbol === "function" && Symbol.iterator, m = s && o[s], i = 0;
    if (m) return m.call(o);
    if (o && typeof o.length === "number") return {
        next: function () {
            if (o && i >= o.length) o = void 0;
            return { value: o && o[i++], done: !o };
        }
    };
    throw new TypeError(s ? "Object is not iterable." : "Symbol.iterator is not defined.");
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runSyncUsage = runSyncUsage;
/**
 * jobs/sync-usage.ts — Redis → Postgres daily usage sync.
 *
 * Runs every 60 seconds. Scans all active `rl:day:{userId}:{date}` keys
 * in Redis and upserts their counts into the api_usage_daily table.
 *
 * This is a best-effort durability layer — the Redis counter is always
 * the source of truth for live rate limiting. The DB is the source of
 * truth for usage history, billing analytics, and reporting.
 *
 * Uses SCAN (cursor-based) rather than KEYS to avoid blocking Redis on
 * large datasets. Processes in batches of 100 keys.
 */
var drizzle_orm_1 = require("drizzle-orm");
var index_js_1 = require("../db/index.js");
var index_js_2 = require("../db/schema/index.js");
var index_js_3 = require("../redis/index.js");
var BATCH_SIZE = 100;
// Key format: rl:day:{userId}:{YYYY-MM-DD}
var KEY_PATTERN = 'rl:day:*';
var KEY_REGEX = /^rl:day:([^:]+):(\d{4}-\d{2}-\d{2})$/;
function runSyncUsage() {
    return __awaiter(this, void 0, void 0, function () {
        var cursor, totalSynced, _a, nextCursor, keys, pipeline, keys_1, keys_1_1, key, results, rows, i, key, match, _b, userId, dateStr, rawCount, queryCount;
        var e_1, _c;
        var _d;
        return __generator(this, function (_e) {
            switch (_e.label) {
                case 0:
                    cursor = '0';
                    totalSynced = 0;
                    _e.label = 1;
                case 1: return [4 /*yield*/, index_js_3.redis.scan(cursor, 'MATCH', KEY_PATTERN, 'COUNT', BATCH_SIZE)];
                case 2:
                    _a = __read.apply(void 0, [_e.sent(), 2]), nextCursor = _a[0], keys = _a[1];
                    cursor = nextCursor;
                    if (keys.length === 0)
                        return [3 /*break*/, 5];
                    pipeline = index_js_3.redis.pipeline();
                    try {
                        for (keys_1 = (e_1 = void 0, __values(keys)), keys_1_1 = keys_1.next(); !keys_1_1.done; keys_1_1 = keys_1.next()) {
                            key = keys_1_1.value;
                            pipeline.get(key);
                        }
                    }
                    catch (e_1_1) { e_1 = { error: e_1_1 }; }
                    finally {
                        try {
                            if (keys_1_1 && !keys_1_1.done && (_c = keys_1.return)) _c.call(keys_1);
                        }
                        finally { if (e_1) throw e_1.error; }
                    }
                    return [4 /*yield*/, pipeline.exec()];
                case 3:
                    results = _e.sent();
                    rows = [];
                    for (i = 0; i < keys.length; i++) {
                        key = keys[i];
                        match = KEY_REGEX.exec(key);
                        if (!match)
                            continue;
                        _b = __read(match, 3), userId = _b[1], dateStr = _b[2];
                        rawCount = (_d = results === null || results === void 0 ? void 0 : results[i]) === null || _d === void 0 ? void 0 : _d[1];
                        if (!rawCount || !userId || !dateStr)
                            continue;
                        queryCount = parseInt(rawCount, 10);
                        if (isNaN(queryCount) || queryCount <= 0)
                            continue;
                        rows.push({ userId: userId, date: dateStr, queryCount: queryCount });
                    }
                    if (rows.length === 0)
                        return [3 /*break*/, 5];
                    // Upsert: INSERT ... ON CONFLICT (user_id, date) DO UPDATE SET query_count = GREATEST(...)
                    // GREATEST() ensures we never write a lower count than what's already in the DB
                    // (protects against a race where the Redis counter was reset between reads).
                    return [4 /*yield*/, index_js_1.db
                            .insert(index_js_2.apiUsageDaily)
                            .values(rows)
                            .onConflictDoUpdate({
                            target: [index_js_2.apiUsageDaily.userId, index_js_2.apiUsageDaily.date],
                            set: {
                                queryCount: (0, drizzle_orm_1.sql)(templateObject_1 || (templateObject_1 = __makeTemplateObject(["GREATEST(excluded.query_count, api_usage_daily.query_count)"], ["GREATEST(excluded.query_count, api_usage_daily.query_count)"]))),
                            },
                        })];
                case 4:
                    // Upsert: INSERT ... ON CONFLICT (user_id, date) DO UPDATE SET query_count = GREATEST(...)
                    // GREATEST() ensures we never write a lower count than what's already in the DB
                    // (protects against a race where the Redis counter was reset between reads).
                    _e.sent();
                    totalSynced += rows.length;
                    _e.label = 5;
                case 5:
                    if (cursor !== '0') return [3 /*break*/, 1];
                    _e.label = 6;
                case 6:
                    if (totalSynced > 0) {
                        console.log("[sync-usage] synced ".concat(totalSynced, " usage rows"));
                    }
                    return [2 /*return*/];
            }
        });
    });
}
var templateObject_1;
