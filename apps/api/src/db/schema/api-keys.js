"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.apiKeysRelations = exports.apiKeys = void 0;
/**
 * schema/api-keys.ts — api_keys table.
 *
 * Stores hashed API keys only. The raw key is shown to the user once
 * at generation time and is never persisted.
 *
 * Constraints:
 *  - key_hash must be unique (prevents duplicate keys across all users)
 *  - Only ONE active key per user at a time (enforced by partial unique index
 *    defined in the migration SQL — Drizzle does not yet support partial indexes
 *    via schema DSL, so the index is hand-written in 0001_initial.sql)
 */
var pg_core_1 = require("drizzle-orm/pg-core");
var drizzle_orm_1 = require("drizzle-orm");
var users_js_1 = require("./users.js");
exports.apiKeys = (0, pg_core_1.pgTable)('api_keys', {
    id: (0, pg_core_1.uuid)('id').primaryKey().defaultRandom(),
    userId: (0, pg_core_1.uuid)('user_id')
        .notNull()
        .references(function () { return users_js_1.users.id; }, { onDelete: 'cascade' }),
    /**
     * SHA-256 hex digest of the full raw API key.
     * CHAR(64) — always exactly 64 hex characters.
     */
    keyHash: (0, pg_core_1.char)('key_hash', { length: 64 }).notNull().unique(),
    /**
     * First 16 chars of the raw key (prefix + first 8 body chars).
     * Example: "vs_live_a3f9b2c1"
     * Safe to store and display — not enough to reconstruct the hash.
     */
    keyPrefix: (0, pg_core_1.varchar)('key_prefix', { length: 24 }).notNull(),
    isActive: (0, pg_core_1.boolean)('is_active').notNull().default(true),
    createdAt: (0, pg_core_1.timestamp)('created_at', { withTimezone: true })
        .notNull()
        .defaultNow(),
    rotatedAt: (0, pg_core_1.timestamp)('rotated_at', { withTimezone: true }),
    lastUsedAt: (0, pg_core_1.timestamp)('last_used_at', { withTimezone: true }),
    /** IP of the most recent request using this key */
    lastUsedIp: (0, pg_core_1.inet)('last_used_ip'),
});
// ─── RELATIONS ────────────────────────────────────────────────────────────────
exports.apiKeysRelations = (0, drizzle_orm_1.relations)(exports.apiKeys, function (_a) {
    var one = _a.one;
    return ({
        user: one(users_js_1.users, {
            fields: [exports.apiKeys.userId],
            references: [users_js_1.users.id],
        }),
    });
});
