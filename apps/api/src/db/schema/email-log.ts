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
import { pgTable, uuid, varchar, timestamp } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { users } from './users.js';

export const emailLog = pgTable('email_log', {
  id: uuid('id').primaryKey().defaultRandom(),

  /**
   * Nullable: if user account is deleted, we keep the log entry
   * but the FK becomes null (ON DELETE SET NULL).
   */
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),

  /**
   * Identifies the type of email sent.
   * Values: 'verify_email' | 'welcome' | 'payment_failed_0h' |
   *         'payment_failed_24h' | 'payment_failed_48h' |
   *         'account_suspended' | 'account_reactivated' |
   *         'subscription_changed' | 'subscription_cancelled' |
   *         'password_reset'
   */
  eventType: varchar('event_type', { length: 64 }).notNull(),

  sentAt: timestamp('sent_at', { withTimezone: true }).notNull().defaultNow(),

  /** Resend message ID — use for delivery status lookup via Resend API */
  resendId: varchar('resend_id', { length: 64 }),

  /** sent | bounced | failed */
  status: varchar('status', { length: 32 }).notNull().default('sent'),
});

// ─── RELATIONS ────────────────────────────────────────────────────────────────

export const emailLogRelations = relations(emailLog, ({ one }) => ({
  user: one(users, {
    fields: [emailLog.userId],
    references: [users.id],
  }),
}));

export type EmailLog = typeof emailLog.$inferSelect;
export type NewEmailLog = typeof emailLog.$inferInsert;
