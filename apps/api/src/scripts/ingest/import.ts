/**
 * scripts/ingest/import.ts — VIN stub CSV import pipeline.
 *
 * Usage:
 *   pnpm --filter @vinstub/api ingest --file ./data/stubs.csv [--dry-run] [--batch-size 500]
 *
 * What it does:
 *   1. Reads and parses the CSV file (streaming, no full file in memory)
 *   2. Validates every row (year range, vin_stub chars, base model rules)
 *   3. Normalizes make/model/submodel for matching
 *   4. Upserts rows into vin_stubs in batches (INSERT ... ON CONFLICT DO UPDATE)
 *   5. Deactivates rows from previous source_versions not in the current import
 *   6. Rebuilds Redis reference caches (makes list, models list, synonym hash)
 *
 * Import strategy:
 *   - UPSERT on (year, make_normalized, model_normalized, submodel_normalized)
 *   - source_version column tracks which import batch each row came from
 *   - After all rows are loaded, a cleanup pass marks stale rows (same year/make/model
 *     combination that were active but not present in the new source_version) as
 *     is_active = FALSE
 *
 * Error handling:
 *   - Validation errors are collected and printed as a summary — they do NOT abort
 *     the import. Invalid rows are skipped with a warning.
 *   - DB errors abort the import immediately.
 *   - --dry-run parses and validates without writing to DB.
 */
import { createReadStream } from 'fs';
import { parse } from 'csv-parse';
import { and, eq, ne, sql } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { vinStubs, makeSynonyms } from '../../db/schema/index.js';
import { redis, Keys } from '../../redis/index.js';
import { normalize } from '../../services/vin.service.js';
import { validateRow, validateHeaders, type RawCsvRow, type ValidatedRow } from './validate.js';

// ─── CLI ARG PARSING ──────────────────────────────────────────────────────────

function getArg(flag: string): string | undefined {
  const idx = process.argv.indexOf(flag);
  return idx !== -1 ? process.argv[idx + 1] : undefined;
}

const FILE_PATH = getArg('--file');
const DRY_RUN = process.argv.includes('--dry-run');
const BATCH_SIZE = parseInt(getArg('--batch-size') ?? '500', 10);

if (!FILE_PATH) {
  console.error('Usage: pnpm ingest --file <path/to/stubs.csv> [--dry-run] [--batch-size N]');
  process.exit(1);
}

// ─── NORMALIZATION ────────────────────────────────────────────────────────────

function normalizeRow(row: ValidatedRow) {
  return {
    year: row.year,
    make: row.make,
    makeNormalized: normalize(row.make),
    model: row.model,
    modelNormalized: normalize(row.model),
    submodel: row.submodel || null,
    submodelNormalized: row.submodel ? normalize(row.submodel) : null,
    vinStub: row.vinStub,
    stubLength: row.vinStub.length,
    isBaseModel: row.isBaseModel,
    sourceVersion: row.sourceVersion,
    isActive: true,
  };
}

// ─── UPSERT BATCH ─────────────────────────────────────────────────────────────

async function upsertBatch(rows: ReturnType<typeof normalizeRow>[]): Promise<number> {
  await db
    .insert(vinStubs)
    .values(rows)
    .onConflictDoUpdate({
      // Conflict target: unique on (year, make_norm, model_norm, submodel_norm) WHERE is_active
      // On conflict, update the stub data but keep the row active
      target: [
        vinStubs.year,
        vinStubs.makeNormalized,
        vinStubs.modelNormalized,
        vinStubs.submodelNormalized,
      ],
      set: {
        vinStub: sql`EXCLUDED.vin_stub`,
        stubLength: sql`EXCLUDED.stub_length`,
        make: sql`EXCLUDED.make`,
        model: sql`EXCLUDED.model`,
        submodel: sql`EXCLUDED.submodel`,
        isBaseModel: sql`EXCLUDED.is_base_model`,
        sourceVersion: sql`EXCLUDED.source_version`,
        isActive: true,
        updatedAt: new Date(),
      },
    });

  return rows.length;
}

// ─── CACHE REBUILD ────────────────────────────────────────────────────────────

async function rebuildCaches(): Promise<void> {
  console.log('[ingest] rebuilding Redis reference caches...');

  // 1. Makes list
  const makeRows = await db
    .selectDistinct({ make: vinStubs.make, makeNorm: vinStubs.makeNormalized })
    .from(vinStubs)
    .where(eq(vinStubs.isActive, true))
    .orderBy(vinStubs.makeNormalized);

  const seen = new Set<string>();
  const makes: string[] = [];
  for (const row of makeRows) {
    if (!seen.has(row.makeNorm)) {
      seen.add(row.makeNorm);
      makes.push(row.make);
    }
  }
  await redis.set(Keys.makesList(), JSON.stringify(makes));

  // 2. Per-make models list
  for (const makeNorm of seen) {
    const modelRows = await db
      .selectDistinct({ model: vinStubs.model, modelNorm: vinStubs.modelNormalized })
      .from(vinStubs)
      .where(and(eq(vinStubs.makeNormalized, makeNorm), eq(vinStubs.isActive, true)))
      .orderBy(vinStubs.modelNormalized);

    const modelsSeen = new Set<string>();
    const models: string[] = [];
    for (const row of modelRows) {
      if (!modelsSeen.has(row.modelNorm)) {
        modelsSeen.add(row.modelNorm);
        models.push(row.model);
      }
    }
    await redis.set(Keys.modelsList(makeNorm), JSON.stringify(models));
  }

  // 3. Make synonyms hash — reload from DB
  await redis.del('ref:make_synonyms');
  const synonymRows = await db
    .select({ alias: makeSynonyms.alias, canonical: makeSynonyms.canonical })
    .from(makeSynonyms);

  if (synonymRows.length > 0) {
    const flat = synonymRows.flatMap((r) => [r.alias, r.canonical]);
    await redis.hset('ref:make_synonyms', ...flat);
  }

  console.log(`[ingest] caches rebuilt: ${makes.length} makes`);
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log(`[ingest] starting import from ${FILE_PATH}`);
  console.log(`[ingest] mode: ${DRY_RUN ? 'DRY RUN (no DB writes)' : 'LIVE'}, batch size: ${BATCH_SIZE}`);

  const validRows: ReturnType<typeof normalizeRow>[] = [];
  const validationErrors: string[] = [];
  let rowIndex = 0;
  let headerValidated = false;
  let sourceVersion: string | null = null;

  // ── Parse CSV ───────────────────────────────────────────────────────────
  await new Promise<void>((resolve, reject) => {
    const parser = parse({
      columns: true,
      skip_empty_lines: true,
      trim: true,
    });

    parser.on('readable', () => {
      let record: RawCsvRow;
      while ((record = parser.read()) !== null) {
        rowIndex++;

        // Validate headers on first row
        if (!headerValidated) {
          const missing = validateHeaders(Object.keys(record));
          if (missing.length > 0) {
            reject(new Error(`Missing required CSV columns: ${missing.join(', ')}`));
            return;
          }
          headerValidated = true;
        }

        const result = validateRow(record, rowIndex);
        if (!result.valid) {
          validationErrors.push(...result.errors);
          continue;
        }

        const normalized = normalizeRow(result.row!);
        validRows.push(normalized);

        // Track source_version (should be uniform across import file)
        if (!sourceVersion) {
          sourceVersion = normalized.sourceVersion;
        }
      }
    });

    parser.on('error', reject);
    parser.on('end', resolve);

    createReadStream(FILE_PATH!).pipe(parser);
  });

  // ── Deduplicate by conflict key ──────────────────────────────────────────
  // PostgreSQL ON CONFLICT cannot update the same row twice in one statement.
  // Keep the last occurrence for each (year, make_normalized, model_normalized,
  // submodel_normalized) tuple so batches are conflict-key-unique.
  const deduped = new Map<string, ReturnType<typeof normalizeRow>>();
  for (const row of validRows) {
    const key = `${row.year}|${row.makeNormalized}|${row.modelNormalized}|${row.submodelNormalized ?? ''}`;
    deduped.set(key, row);
  }
  const dedupedRows = [...deduped.values()];
  const dupCount = validRows.length - dedupedRows.length;
  if (dupCount > 0) {
    console.warn(`[ingest] deduplicated ${dupCount} rows with duplicate conflict keys`);
  }
  // Replace validRows in-place for the rest of the pipeline
  validRows.length = 0;
  validRows.push(...dedupedRows);

  console.log(`[ingest] parsed ${rowIndex} rows: ${validRows.length} valid, ${validationErrors.length} invalid`);

  if (validationErrors.length > 0) {
    console.warn('[ingest] VALIDATION ERRORS (these rows will be skipped):');
    for (const err of validationErrors.slice(0, 50)) {
      console.warn(`  ${err}`);
    }
    if (validationErrors.length > 50) {
      console.warn(`  ... and ${validationErrors.length - 50} more errors`);
    }
  }

  if (validRows.length === 0) {
    console.error('[ingest] No valid rows to import. Aborting.');
    process.exit(1);
  }

  if (DRY_RUN) {
    console.log('[ingest] DRY RUN complete — no changes written.');
    process.exit(0);
  }

  // ── Upsert in batches ────────────────────────────────────────────────────
  let inserted = 0;
  for (let i = 0; i < validRows.length; i += BATCH_SIZE) {
    const batch = validRows.slice(i, i + BATCH_SIZE);
    inserted += await upsertBatch(batch);
    process.stdout.write(`\r[ingest] upserted ${inserted}/${validRows.length} rows...`);
  }
  console.log(); // newline after progress

  // ── Deactivate stale rows ────────────────────────────────────────────────
  // Rows with the same year/make/model that are active but were NOT in
  // this import (different source_version) are marked inactive.
  if (sourceVersion) {
    const staleResult = await db
      .update(vinStubs)
      .set({ isActive: false, updatedAt: new Date() })
      .where(and(eq(vinStubs.isActive, true), ne(vinStubs.sourceVersion, sourceVersion)));

    console.log(`[ingest] deactivated stale rows from previous versions`);
  }

  // ── Rebuild Redis caches ─────────────────────────────────────────────────
  await rebuildCaches();

  console.log(`[ingest] ✓ complete — ${inserted} rows imported`);
  process.exit(0);
}

main().catch((err) => {
  console.error('[ingest] fatal error:', err);
  process.exit(1);
});
