/**
 * schema/webhook-events.ts — webhook_events idempotency log.
 *
 * Every incoming Stripe webhook is recorded here before processing.
 * The handler checks for an existing stripe_event_id before doing anything —
 * if it already exists, it returns HTTP 200 immediately without reprocessing.
 *
 * This guarantees idempotency even if Stripe retries the same event multiple times.
 */
import { pgTable, varchar, timestamp, jsonb } from 'drizzle-orm/pg-core';

export const webhookEvents = pgTable('webhook_events', {
  /**
   * Stripe's event ID — the primary key.
   * Format: "evt_1234abcd..."
   */
  stripeEventId: varchar('stripe_event_id', { length: 64 }).primaryKey(),

  eventType: varchar('event_type', { length: 128 }).notNull(),

  processedAt: timestamp('processed_at', { withTimezone: true })
    .notNull()
    .defaultNow(),

  /** Full Stripe event payload — useful for debugging and replays */
  payload: jsonb('payload').notNull(),
});

export type WebhookEvent = typeof webhookEvents.$inferSelect;
export type NewWebhookEvent = typeof webhookEvents.$inferInsert;
