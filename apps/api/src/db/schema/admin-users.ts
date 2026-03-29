/**
 * schema/admin-users.ts — admin_users table.
 *
 * Completely separate from the users table. Admin accounts are internal only.
 * TOTP secret is stored AES-256 encrypted using ADMIN_TOTP_ENCRYPTION_KEY env var.
 *
 * First admin account is created via a seed script or direct DB insert —
 * there is intentionally no self-registration endpoint for admin accounts.
 */
import { pgTable, uuid, varchar, boolean, timestamp } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { adminAuditLog } from './admin-audit-log.js';

export const adminUsers = pgTable('admin_users', {
  id: uuid('id').primaryKey().defaultRandom(),

  email: varchar('email', { length: 320 }).notNull().unique(),

  /** bcrypt hash, cost 12 */
  passwordHash: varchar('password_hash', { length: 256 }).notNull(),

  /**
   * AES-256-GCM encrypted TOTP secret (base32).
   * Null until the admin completes 2FA setup.
   * Format after decryption: base32 string for use with otplib.
   */
  totpSecretEncrypted: varchar('totp_secret_encrypted', { length: 256 }),
  totpEnabled: boolean('totp_enabled').notNull().default(false),

  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),

  lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
});

// ─── RELATIONS ────────────────────────────────────────────────────────────────

export const adminUsersRelations = relations(adminUsers, ({ many }) => ({
  auditLogs: many(adminAuditLog),
}));

export type AdminUser = typeof adminUsers.$inferSelect;
export type NewAdminUser = typeof adminUsers.$inferInsert;
