"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.apiUsageDailyRelations = exports.apiUsageDaily = void 0;
/**
 * schema/api-usage-daily.ts — api_usage_daily table.
 *
 * Audit trail for per-user daily query counts.
 *
 * Redis is the real-time counter (fast, per-minute/hour/day).
 * This table is the durable source of truth, updated asynchronously
 * by the usage-sync worker job every 60 seconds.
 *
 * On Redis restart or cold-start, the worker seeds Redis from this table
 * for the current UTC day.
 *
 * Primary key is (user_id, date) — one row per user per day.
 * UPSERT pattern: ON CONFLICT (user_id, date) DO UPDATE SET query_count = EXCLUDED.query_count
 */
var pg_core_1 = require("drizzle-orm/pg-core");
var drizzle_orm_1 = require("drizzle-orm");
var users_js_1 = require("./users.js");
exports.apiUsageDaily = (0, pg_core_1.pgTable)('api_usage_daily', {
    userId: (0, pg_core_1.uuid)('user_id')
        .notNull()
        .references(function () { return users_js_1.users.id; }, { onDelete: 'cascade' }),
    /**
     * UTC date — always store in UTC regardless of user timezone.
     * The rate limit resets at UTC midnight.
     */
    date: (0, pg_core_1.date)('date').notNull(),
    queryCount: (0, pg_core_1.integer)('query_count').notNull().default(0),
});
// ─── RELATIONS ────────────────────────────────────────────────────────────────
exports.apiUsageDailyRelations = (0, drizzle_orm_1.relations)(exports.apiUsageDaily, function (_a) {
    var one = _a.one;
    return ({
        user: one(users_js_1.users, {
            fields: [exports.apiUsageDaily.userId],
            references: [users_js_1.users.id],
        }),
    });
});
