/**
 * schema/vin-stubs.ts — vin_stubs table.
 *
 * The core data table. All lookups hit this table via the composite index
 * on (year, make_normalized, model_normalized, submodel_normalized).
 *
 * is_base_model:
 *   When submodel is omitted from a query, the system looks for the record
 *   with is_base_model = TRUE for that (year, make_normalized, model_normalized)
 *   group. The ingest:mark-base script sets this flag during import.
 *
 * Indexes (defined in 0001_initial.sql — not in Drizzle DSL to support partial):
 *   idx_vin_lookup     — (year, make_norm, model_norm, submodel_norm) WHERE is_active
 *   idx_vin_base       — (year, make_norm, model_norm) WHERE is_active AND is_base_model
 *   idx_vin_makes      — (make_normalized) WHERE is_active
 */
import {
  pgTable,
  bigserial,
  smallint,
  varchar,
  boolean,
  timestamp,
  check,
  unique,
  index,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const vinStubs = pgTable(
  'vin_stubs',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),

    year: smallint('year').notNull(),

    /** Original make string — display-friendly, preserves casing */
    make: varchar('make', { length: 64 }).notNull(),
    /** Lowercased, punctuation-stripped, synonym-resolved make */
    makeNormalized: varchar('make_normalized', { length: 64 }).notNull(),

    /** Original model string */
    model: varchar('model', { length: 128 }).notNull(),
    modelNormalized: varchar('model_normalized', { length: 128 }).notNull(),

    /**
     * NULL means this IS the base model record.
     * A non-null value is the submodel/trim designation.
     */
    submodel: varchar('submodel', { length: 128 }),
    submodelNormalized: varchar('submodel_normalized', { length: 128 }),

    /** The VIN stub — max 17 chars, alphanumeric uppercase */
    vinStub: varchar('vin_stub', { length: 17 }).notNull(),

    /** Pre-computed length of vinStub for fast padded-output formatting */
    stubLength: smallint('stub_length').notNull(),

    /**
     * Exactly one record per (year, make_normalized, model_normalized) group
     * should have is_base_model = TRUE.
     * The ingest:mark-base script ensures this invariant.
     */
    isBaseModel: boolean('is_base_model').notNull().default(false),

    /** Soft-delete: set to false instead of deleting on data updates */
    isActive: boolean('is_active').notNull().default(true),

    /** Identifies which CSV import batch this record came from */
    sourceVersion: varchar('source_version', { length: 32 }).notNull().default('v1'),

    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    yearCheck: check('year_range', sql`${table.year} >= 1980 AND ${table.year} <= 2035`),
    stubLengthCheck: check(
      'stub_length_range',
      sql`${table.stubLength} >= 7 AND ${table.stubLength} <= 17`,
    ),
    // Unique constraint required for ON CONFLICT upsert in the ingest script
    yearMakeModelSubmodelUnique: unique('vin_stubs_year_make_model_submodel_unique').on(
      table.year,
      table.makeNormalized,
      table.modelNormalized,
      table.submodelNormalized,
    ),
    // Partial indexes for fast lookups — defined here so they appear in migrations
    lookupIdx: index('idx_vin_lookup').on(
      table.year,
      table.makeNormalized,
      table.modelNormalized,
      table.submodelNormalized,
    ),
    baseModelIdx: index('idx_vin_base').on(
      table.year,
      table.makeNormalized,
      table.modelNormalized,
    ),
    makesIdx: index('idx_vin_makes').on(table.makeNormalized),
  }),
);

// ─── TYPES ────────────────────────────────────────────────────────────────────

export type VinStub = typeof vinStubs.$inferSelect;
export type NewVinStub = typeof vinStubs.$inferInsert;
