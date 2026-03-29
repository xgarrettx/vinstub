"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.webhookEvents = void 0;
/**
 * schema/webhook-events.ts — webhook_events idempotency log.
 *
 * Every incoming Stripe webhook is recorded here before processing.
 * The handler checks for an existing stripe_event_id before doing anything —
 * if it already exists, it returns HTTP 200 immediately without reprocessing.
 *
 * This guarantees idempotency even if Stripe retries the same event multiple times.
 */
var pg_core_1 = require("drizzle-orm/pg-core");
exports.webhookEvents = (0, pg_core_1.pgTable)('webhook_events', {
    /**
     * Stripe's event ID — the primary key.
     * Format: "evt_1234abcd..."
     */
    stripeEventId: (0, pg_core_1.varchar)('stripe_event_id', { length: 64 }).primaryKey(),
    eventType: (0, pg_core_1.varchar)('event_type', { length: 128 }).notNull(),
    processedAt: (0, pg_core_1.timestamp)('processed_at', { withTimezone: true })
        .notNull()
        .defaultNow(),
    /** Full Stripe event payload — useful for debugging and replays */
    payload: (0, pg_core_1.jsonb)('payload').notNull(),
});
