"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminUsersRelations = exports.adminUsers = void 0;
/**
 * schema/admin-users.ts — admin_users table.
 *
 * Completely separate from the users table. Admin accounts are internal only.
 * TOTP secret is stored AES-256 encrypted using ADMIN_TOTP_ENCRYPTION_KEY env var.
 *
 * First admin account is created via a seed script or direct DB insert —
 * there is intentionally no self-registration endpoint for admin accounts.
 */
var pg_core_1 = require("drizzle-orm/pg-core");
var drizzle_orm_1 = require("drizzle-orm");
var admin_audit_log_js_1 = require("./admin-audit-log.js");
exports.adminUsers = (0, pg_core_1.pgTable)('admin_users', {
    id: (0, pg_core_1.uuid)('id').primaryKey().defaultRandom(),
    email: (0, pg_core_1.varchar)('email', { length: 320 }).notNull().unique(),
    /** bcrypt hash, cost 12 */
    passwordHash: (0, pg_core_1.varchar)('password_hash', { length: 256 }).notNull(),
    /**
     * AES-256-GCM encrypted TOTP secret (base32).
     * Null until the admin completes 2FA setup.
     * Format after decryption: base32 string for use with otplib.
     */
    totpSecretEncrypted: (0, pg_core_1.varchar)('totp_secret_encrypted', { length: 256 }),
    totpEnabled: (0, pg_core_1.boolean)('totp_enabled').notNull().default(false),
    createdAt: (0, pg_core_1.timestamp)('created_at', { withTimezone: true })
        .notNull()
        .defaultNow(),
    lastLoginAt: (0, pg_core_1.timestamp)('last_login_at', { withTimezone: true }),
});
// ─── RELATIONS ────────────────────────────────────────────────────────────────
exports.adminUsersRelations = (0, drizzle_orm_1.relations)(exports.adminUsers, function (_a) {
    var many = _a.many;
    return ({
        auditLogs: many(admin_audit_log_js_1.adminAuditLog),
    });
});
