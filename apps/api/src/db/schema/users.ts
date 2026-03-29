/**
 * schema/users.ts — users table + enums.
 * Central account record. Links to Stripe for billing state.
 */
import {
  pgTable,
  pgEnum,
  uuid,
  varchar,
  boolean,
  timestamp,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { apiKeys } from './api-keys.js';
import { apiUsageDaily } from './api-usage-daily.js';
import { emailLog } from './email-log.js';

// ─── ENUMS ────────────────────────────────────────────────────────────────────

export const planEnum = pgEnum('plan_type', [
  'free',
  'basic',
  'premium',
  'enterprise',
]);

export const accountStatusEnum = pgEnum('account_status_type', [
  'pending_verification',
  'active',
  'suspended',
  'cancelled',
]);

export const billingStatusEnum = pgEnum('billing_status_type', [
  'none',
  'active',
  'past_due',
  'cancelled',
]);

// ─── TABLE ────────────────────────────────────────────────────────────────────

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),

  email: varchar('email', { length: 320 }).notNull().unique(),
  passwordHash: varchar('password_hash', { length: 256 }).notNull(),

  emailVerified: boolean('email_verified').notNull().default(false),
  emailVerificationToken: varchar('email_verification_token', { length: 128 }),
  emailVerificationTokenExpiresAt: timestamp('email_verification_token_expires_at', {
    withTimezone: true,
  }),

  passwordResetToken: varchar('password_reset_token', { length: 128 }),
  passwordResetTokenExpiresAt: timestamp('password_reset_token_expires_at', {
    withTimezone: true,
  }),

  plan: planEnum('plan').notNull().default('free'),
  accountStatus: accountStatusEnum('account_status')
    .notNull()
    .default('pending_verification'),
  billingStatus: billingStatusEnum('billing_status').notNull().default('none'),

  // Stripe identifiers — stored for lookup; never store payment methods here
  stripeCustomerId: varchar('stripe_customer_id', { length: 64 }).unique(),
  stripeSubscriptionId: varchar('stripe_subscription_id', { length: 64 }).unique(),

  // Timestamps for suspension lifecycle
  paymentFailedAt: timestamp('payment_failed_at', { withTimezone: true }),
  suspendedAt: timestamp('suspended_at', { withTimezone: true }),

  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ─── RELATIONS ────────────────────────────────────────────────────────────────

export const usersRelations = relations(users, ({ many }) => ({
  apiKeys: many(apiKeys),
  usageDaily: many(apiUsageDaily),
  emailLogs: many(emailLog),
}));

// ─── TYPES ────────────────────────────────────────────────────────────────────

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
