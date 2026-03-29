"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.makeSynonyms = void 0;
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
var pg_core_1 = require("drizzle-orm/pg-core");
exports.makeSynonyms = (0, pg_core_1.pgTable)('make_synonyms', {
    id: (0, pg_core_1.serial)('id').primaryKey(),
    /** Input alias — lowercased, no punctuation (normalized the same way as query inputs) */
    alias: (0, pg_core_1.varchar)('alias', { length: 64 }).notNull().unique(),
    /** Canonical make name — must match make_normalized values in vin_stubs */
    canonical: (0, pg_core_1.varchar)('canonical', { length: 64 }).notNull(),
});
