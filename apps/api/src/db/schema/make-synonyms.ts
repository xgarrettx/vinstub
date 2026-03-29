/**
 * schema/make-synonyms.ts — make_synonyms lookup table.
 *
 * Maps common aliases to canonical make names.
 * Loaded into memory at API startup and used by the normalization function.
 *
 * Examples:
 *   'chevy'   → 'chevrolet'
 *   'vw'      → 'volkswagen'
 *   'benz'    → 'mercedes-benz'
 *   'merc'    → 'mercury'
 *
 * Admin can add entries via the admin panel (POST /admin/make-synonyms).
 * Changes take effect on the next app restart or after a Redis cache flush.
 */
import { pgTable, serial, varchar } from 'drizzle-orm/pg-core';

export const makeSynonyms = pgTable('make_synonyms', {
  id: serial('id').primaryKey(),

  /** Input alias — lowercased, no punctuation (normalized the same way as query inputs) */
  alias: varchar('alias', { length: 64 }).notNull().unique(),

  /** Canonical make name — must match make_normalized values in vin_stubs */
  canonical: varchar('canonical', { length: 64 }).notNull(),
});

export type MakeSynonym = typeof makeSynonyms.$inferSelect;
export type NewMakeSynonym = typeof makeSynonyms.$inferInsert;
