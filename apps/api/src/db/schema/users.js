"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.usersRelations = exports.users = exports.billingStatusEnum = exports.accountStatusEnum = exports.planEnum = void 0;
/**
 * schema/users.ts — users table + enums.
 * Central account record. Links to Stripe for billing state.
 */
var pg_core_1 = require("drizzle-orm/pg-core");
var drizzle_orm_1 = require("drizzle-orm");
var api_keys_js_1 = require("./api-keys.js");
var api_usage_daily_js_1 = require("./api-usage-daily.js");
var email_log_js_1 = require("./email-log.js");
// ─── ENUMS ────────────────────────────────────────────────────────────────────
exports.planEnum = (0, pg_core_1.pgEnum)('plan_type', [
    'free',
    'basic',
    'premium',
    'enterprise',
]);
exports.accountStatusEnum = (0, pg_core_1.pgEnum)('account_status_type', [
    'pending_verification',
    'active',
    'suspended',
    'cancelled',
]);
exports.billingStatusEnum = (0, pg_core_1.pgEnum)('billing_status_type', [
    'none',
    'active',
    'past_due',
    'cancelled',
    'payment_failed',
]);
// ─── TABLE ────────────────────────────────────────────────────────────────────
exports.users = (0, pg_core_1.pgTable)('users', {
    id: (0, pg_core_1.uuid)('id').primaryKey().defaultRandom(),
    email: (0, pg_core_1.varchar)('email', { length: 320 }).notNull().unique(),
    passwordHash: (0, pg_core_1.varchar)('password_hash', { length: 256 }).notNull(),
    emailVerified: (0, pg_core_1.boolean)('email_verified').notNull().default(false),
    emailVerificationToken: (0, pg_core_1.varchar)('email_verification_token', { length: 128 }),
    emailVerificationTokenExpiresAt: (0, pg_core_1.timestamp)('email_verification_token_expires_at', {
        withTimezone: true,
    }),
    passwordResetToken: (0, pg_core_1.varchar)('password_reset_token', { length: 128 }),
    passwordResetTokenExpiresAt: (0, pg_core_1.timestamp)('password_reset_token_expires_at', {
        withTimezone: true,
    }),
    plan: (0, exports.planEnum)('plan').notNull().default('free'),
    accountStatus: (0, exports.accountStatusEnum)('account_status')
        .notNull()
        .default('pending_verification'),
    billingStatus: (0, exports.billingStatusEnum)('billing_status').notNull().default('none'),
    // Stripe identifiers — stored for lookup; never store payment methods here
    stripeCustomerId: (0, pg_core_1.varchar)('stripe_customer_id', { length: 64 }).unique(),
    stripeSubscriptionId: (0, pg_core_1.varchar)('stripe_subscription_id', { length: 64 }).unique(),
    // Timestamps for suspension lifecycle
    paymentFailedAt: (0, pg_core_1.timestamp)('payment_failed_at', { withTimezone: true }),
    suspendedAt: (0, pg_core_1.timestamp)('suspended_at', { withTimezone: true }),
    createdAt: (0, pg_core_1.timestamp)('created_at', { withTimezone: true })
        .notNull()
        .defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at', { withTimezone: true })
        .notNull()
        .defaultNow(),
});
// ─── RELATIONS ────────────────────────────────────────────────────────────────
exports.usersRelations = (0, drizzle_orm_1.relations)(exports.users, function (_a) {
    var many = _a.many;
    return ({
        apiKeys: many(api_keys_js_1.apiKeys),
        usageDaily: many(api_usage_daily_js_1.apiUsageDaily),
        emailLogs: many(email_log_js_1.emailLog),
    });
});
