"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.emailLogRelations = exports.emailLog = void 0;
/**
 * schema/email-log.ts — email_log table.
 *
 * Records every transactional email sent.
 * Used for:
 *  1. Deduplication: before sending a billing email, check this table
 *     to avoid sending the same event_type twice within 23 hours.
 *  2. Support: admins can see what emails a user has received and when.
 *  3. Debugging: correlate Resend message IDs with user actions.
 */
var pg_core_1 = require("drizzle-orm/pg-core");
var drizzle_orm_1 = require("drizzle-orm");
var users_js_1 = require("./users.js");
exports.emailLog = (0, pg_core_1.pgTable)('email_log', {
    id: (0, pg_core_1.uuid)('id').primaryKey().defaultRandom(),
    /**
     * Nullable: if user account is deleted, we keep the log entry
     * but the FK becomes null (ON DELETE SET NULL).
     */
    userId: (0, pg_core_1.uuid)('user_id').references(function () { return users_js_1.users.id; }, { onDelete: 'set null' }),
    /**
     * Identifies the type of email sent.
     * Values: 'verify_email' | 'welcome' | 'payment_failed_0h' |
     *         'payment_failed_24h' | 'payment_failed_48h' |
     *         'account_suspended' | 'account_reactivated' |
     *         'subscription_changed' | 'subscription_cancelled' |
     *         'password_reset'
     */
    eventType: (0, pg_core_1.varchar)('event_type', { length: 64 }).notNull(),
    sentAt: (0, pg_core_1.timestamp)('sent_at', { withTimezone: true }).notNull().defaultNow(),
    /** Resend message ID — use for delivery status lookup via Resend API */
    resendId: (0, pg_core_1.varchar)('resend_id', { length: 64 }),
    /** sent | bounced | failed */
    status: (0, pg_core_1.varchar)('status', { length: 32 }).notNull().default('sent'),
});
// ─── RELATIONS ────────────────────────────────────────────────────────────────
exports.emailLogRelations = (0, drizzle_orm_1.relations)(exports.emailLog, function (_a) {
    var one = _a.one;
    return ({
        user: one(users_js_1.users, {
            fields: [exports.emailLog.userId],
            references: [users_js_1.users.id],
        }),
    });
});
