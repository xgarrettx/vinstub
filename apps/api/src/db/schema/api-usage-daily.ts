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
import { pgTable, uuid, date, integer } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { users } from './users.js';

export const apiUsageDaily = pgTable(
  'api_usage_daily',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    /**
     * UTC date — always store in UTC regardless of user timezone.
     * The rate limit resets at UTC midnight.
     */
    date: date('date').notNull(),

    queryCount: integer('query_count').notNull().default(0),
  },
  // Composite primary key defined in migration SQL (Drizzle limitation)
);

// ─── RELATIONS ────────────────────────────────────────────────────────────────

export const apiUsageDailyRelations = relations(apiUsageDaily, ({ one }) => ({
  user: one(users, {
    fields: [apiUsageDaily.userId],
    references: [users.id],
  }),
}));

export type ApiUsageDaily = typeof apiUsageDaily.$inferSelect;
export type NewApiUsageDaily = typeof apiUsageDaily.$inferInsert;
