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
import {
  pgTable,
  uuid,
  varchar,
  boolean,
  timestamp,
  inet,
  char,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { users } from './users.js';

export const apiKeys = pgTable('api_keys', {
  id: uuid('id').primaryKey().defaultRandom(),

  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),

  /**
   * SHA-256 hex digest of the full raw API key.
   * CHAR(64) — always exactly 64 hex characters.
   */
  keyHash: char('key_hash', { length: 64 }).notNull().unique(),

  /**
   * First 16 chars of the raw key (prefix + first 8 body chars).
   * Example: "vs_live_a3f9b2c1"
   * Safe to store and display — not enough to reconstruct the hash.
   */
  keyPrefix: varchar('key_prefix', { length: 24 }).notNull(),

  isActive: boolean('is_active').notNull().default(true),

  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),

  rotatedAt: timestamp('rotated_at', { withTimezone: true }),

  lastUsedAt: timestamp('last_used_at', { withTimezone: true }),

  /** IP of the most recent request using this key */
  lastUsedIp: inet('last_used_ip'),
});

// ─── RELATIONS ────────────────────────────────────────────────────────────────

export const apiKeysRelations = relations(apiKeys, ({ one }) => ({
  user: one(users, {
    fields: [apiKeys.userId],
    references: [users.id],
  }),
}));

// ─── TYPES ────────────────────────────────────────────────────────────────────

export type ApiKey = typeof apiKeys.$inferSelect;
export type NewApiKey = typeof apiKeys.$inferInsert;
