"use strict";
var __makeTemplateObject = (this && this.__makeTemplateObject) || function (cooked, raw) {
    if (Object.defineProperty) { Object.defineProperty(cooked, "raw", { value: raw }); } else { cooked.raw = raw; }
    return cooked;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.vinStubs = void 0;
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
var pg_core_1 = require("drizzle-orm/pg-core");
var drizzle_orm_1 = require("drizzle-orm");
exports.vinStubs = (0, pg_core_1.pgTable)('vin_stubs', {
    id: (0, pg_core_1.bigserial)('id', { mode: 'number' }).primaryKey(),
    year: (0, pg_core_1.smallint)('year').notNull(),
    /** Original make string — display-friendly, preserves casing */
    make: (0, pg_core_1.varchar)('make', { length: 64 }).notNull(),
    /** Lowercased, punctuation-stripped, synonym-resolved make */
    makeNormalized: (0, pg_core_1.varchar)('make_normalized', { length: 64 }).notNull(),
    /** Original model string */
    model: (0, pg_core_1.varchar)('model', { length: 128 }).notNull(),
    modelNormalized: (0, pg_core_1.varchar)('model_normalized', { length: 128 }).notNull(),
    /**
     * NULL means this IS the base model record.
     * A non-null value is the submodel/trim designation.
     */
    submodel: (0, pg_core_1.varchar)('submodel', { length: 128 }),
    submodelNormalized: (0, pg_core_1.varchar)('submodel_normalized', { length: 128 }),
    /** The VIN stub — max 17 chars, alphanumeric uppercase */
    vinStub: (0, pg_core_1.varchar)('vin_stub', { length: 17 }).notNull(),
    /** Pre-computed length of vinStub for fast padded-output formatting */
    stubLength: (0, pg_core_1.smallint)('stub_length').notNull(),
    /**
     * Exactly one record per (year, make_normalized, model_normalized) group
     * should have is_base_model = TRUE.
     * The ingest:mark-base script ensures this invariant.
     */
    isBaseModel: (0, pg_core_1.boolean)('is_base_model').notNull().default(false),
    /** Soft-delete: set to false instead of deleting on data updates */
    isActive: (0, pg_core_1.boolean)('is_active').notNull().default(true),
    /** Identifies which CSV import batch this record came from */
    sourceVersion: (0, pg_core_1.varchar)('source_version', { length: 32 }).notNull().default('v1'),
    createdAt: (0, pg_core_1.timestamp)('created_at', { withTimezone: true })
        .notNull()
        .defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at', { withTimezone: true })
        .notNull()
        .defaultNow(),
}, function (table) { return ({
    yearCheck: (0, pg_core_1.check)('year_range', (0, drizzle_orm_1.sql)(templateObject_1 || (templateObject_1 = __makeTemplateObject(["", " >= 1980 AND ", " <= 2035"], ["", " >= 1980 AND ", " <= 2035"])), table.year, table.year)),
    stubLengthCheck: (0, pg_core_1.check)('stub_length_range', (0, drizzle_orm_1.sql)(templateObject_2 || (templateObject_2 = __makeTemplateObject(["", " >= 7 AND ", " <= 17"], ["", " >= 7 AND ", " <= 17"])), table.stubLength, table.stubLength)),
    // Unique constraint required for ON CONFLICT upsert in the ingest script
    yearMakeModelSubmodelUnique: (0, pg_core_1.unique)('vin_stubs_year_make_model_submodel_unique').on(table.year, table.makeNormalized, table.modelNormalized, table.submodelNormalized),
    // Partial indexes for fast lookups — defined here so they appear in migrations
    lookupIdx: (0, pg_core_1.index)('idx_vin_lookup').on(table.year, table.makeNormalized, table.modelNormalized, table.submodelNormalized),
    baseModelIdx: (0, pg_core_1.index)('idx_vin_base').on(table.year, table.makeNormalized, table.modelNormalized),
    makesIdx: (0, pg_core_1.index)('idx_vin_makes').on(table.makeNormalized),
}); });
var templateObject_1, templateObject_2;
