/**
 * services/vin.service.ts — VIN stub lookup logic.
 *
 * Public interface:
 *   lookupStub(year, make, model, submodel?)
 *     → VinStubResult | VinStubError
 *
 * Normalization pipeline:
 *   1. Trim whitespace
 *   2. Lowercase
 *   3. Strip non-alphanumeric/space characters
 *   4. Collapse consecutive spaces
 *   5. Make synonym resolution (e.g. "chevy" → "chevrolet")
 *
 * Lookup strategy:
 *   - If submodel provided: exact match on (year, make_norm, model_norm, submodel_norm)
 *   - If submodel omitted: match on (year, make_norm, model_norm) WHERE is_base_model = TRUE
 *
 * Response padding:
 *   The VIN stub is stored at its canonical length in the DB.
 *   formatPadded() right-pads with zeros to exactly 9 characters if shorter,
 *   or returns as-is if already 9+ chars (stubs are 7-17 chars per schema check).
 */
import { eq, and } from 'drizzle-orm';
import { db } from '../db/index.js';
import { vinStubs, makeSynonyms } from '../db/schema/index.js';
import { redis, Keys } from '../redis/index.js';

// ─── TYPES ────────────────────────────────────────────────────────────────────

export interface VinStubResult {
  vin_stub: string;
  stub_length: number;
  year: number;
  make: string;
  model: string;
  submodel: string | null;
  match_type: 'exact' | 'base_model';
}

export interface VinStubError {
  code: 'not_found' | 'invalid_year' | 'invalid_input';
  message: string;
}

// ─── NORMALIZATION ────────────────────────────────────────────────────────────

/**
 * Normalize a make/model/submodel string for matching.
 * Lowercases, trims, removes all non-alphanumeric/space chars,
 * and collapses multiple spaces into one.
 */
export function normalize(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Normalize a make name and resolve synonyms.
 * Synonyms are cached in Redis (set populated by ingest script).
 * Falls back to DB query if not in cache.
 */
export async function normalizeMake(rawMake: string): Promise<string> {
  const normalized = normalize(rawMake);

  // Check Redis synonym cache first
  const cachedSynonyms = await redis.hget('ref:make_synonyms', normalized);
  if (cachedSynonyms) return cachedSynonyms;

  // Check DB
  const rows = await db
    .select({ canonical: makeSynonyms.canonical })
    .from(makeSynonyms)
    .where(eq(makeSynonyms.alias, normalized))
    .limit(1);

  if (rows.length > 0) {
    const canonical = rows[0]!.canonical;
    // Cache in Redis indefinitely (refreshed by ingest script)
    await redis.hset('ref:make_synonyms', normalized, canonical);
    return canonical;
  }

  // No synonym found — use the normalized form as-is
  return normalized;
}

// ─── PADDING ─────────────────────────────────────────────────────────────────

/**
 * Right-pad a VIN stub with zeros to reach 9 characters.
 * Stubs that are already 9+ chars are returned unchanged.
 * This represents the standard "WMI + VDS" portion of a VIN.
 */
export function formatPadded(stub: string): string {
  return stub.padEnd(9, '0');
}

// ─── COMMON PREFIX ────────────────────────────────────────────────────────────

/**
 * Return the longest common prefix shared by all strings in the array.
 * Returns empty string if the array is empty.
 */
export function commonPrefix(stubs: string[]): string {
  if (stubs.length === 0) return '';
  let prefix = stubs[0]!;
  for (let i = 1; i < stubs.length; i++) {
    const s = stubs[i]!;
    let j = 0;
    while (j < prefix.length && j < s.length && prefix[j] === s[j]) j++;
    prefix = prefix.slice(0, j);
    if (prefix.length === 0) break;
  }
  return prefix;
}

// ─── LOOKUP ───────────────────────────────────────────────────────────────────

const MIN_YEAR = 1980;
const MAX_YEAR = 2035;

/**
 * Look up a VIN stub by year / make / model / optional submodel.
 *
 * @param year      - Model year (integer)
 * @param make      - Make name (normalized internally)
 * @param model     - Model name (normalized internally)
 * @param submodel  - Optional trim/submodel (normalized internally)
 */
export async function lookupStub(
  year: number,
  make: string,
  model: string,
  submodel?: string,
): Promise<VinStubResult | VinStubError> {
  // ── Input validation ───────────────────────────────────────────────────────
  if (!Number.isInteger(year) || year < MIN_YEAR || year > MAX_YEAR) {
    return {
      code: 'invalid_year',
      message: `Year must be an integer between ${MIN_YEAR} and ${MAX_YEAR}.`,
    };
  }

  if (!make.trim() || !model.trim()) {
    return {
      code: 'invalid_input',
      message: 'Make and model are required.',
    };
  }

  // ── Normalize inputs ───────────────────────────────────────────────────────
  const makeNorm = await normalizeMake(make);
  const modelNorm = normalize(model);
  const submodelNorm = submodel ? normalize(submodel) : undefined;

  // ── Database query ─────────────────────────────────────────────────────────
  if (submodelNorm) {
    // Exact match including submodel
    const rows = await db
      .select({
        vinStub: vinStubs.vinStub,
        stubLength: vinStubs.stubLength,
        make: vinStubs.make,
        model: vinStubs.model,
        submodel: vinStubs.submodel,
      })
      .from(vinStubs)
      .where(
        and(
          eq(vinStubs.year, year),
          eq(vinStubs.makeNormalized, makeNorm),
          eq(vinStubs.modelNormalized, modelNorm),
          eq(vinStubs.submodelNormalized, submodelNorm),
          eq(vinStubs.isActive, true),
        ),
      )
      .limit(1);

    if (rows.length > 0) {
      const row = rows[0]!;
      return {
        vin_stub: formatPadded(row.vinStub),
        stub_length: row.stubLength,
        year,
        make: row.make,
        model: row.model,
        submodel: row.submodel,
        match_type: 'exact',
      };
    }

    // Submodel provided but not found — do NOT fall back to base model.
    // Return not_found so the caller knows the specific submodel isn't in our DB.
    return {
      code: 'not_found',
      message: `No VIN stub found for ${year} ${make} ${model} ${submodel}.`,
    };
  }

  // No submodel — compute the true common prefix from all submodel stubs for
  // this (year, make, model). This is more accurate than the pre-stored
  // is_base_model row, which may have been padded with zeros beyond the real
  // common prefix length.
  const submodelRows = await db
    .select({
      vinStub: vinStubs.vinStub,
      make: vinStubs.make,
      model: vinStubs.model,
    })
    .from(vinStubs)
    .where(
      and(
        eq(vinStubs.year, year),
        eq(vinStubs.makeNormalized, makeNorm),
        eq(vinStubs.modelNormalized, modelNorm),
        eq(vinStubs.isBaseModel, false),
        eq(vinStubs.isActive, true),
      ),
    );

  if (submodelRows.length > 0) {
    const stubs = submodelRows.map((r) => r.vinStub);
    const prefix = commonPrefix(stubs);
    // Must have at least the WMI (3 chars) to be meaningful
    if (prefix.length >= 3) {
      const displayRow = submodelRows[0]!;
      return {
        vin_stub: formatPadded(prefix),
        stub_length: prefix.length,
        year,
        make: displayRow.make,
        model: displayRow.model,
        submodel: null,
        match_type: 'base_model',
      };
    }
  }

  // Fall back to the explicit is_base_model row if no submodel rows exist
  const baseRows = await db
    .select({
      vinStub: vinStubs.vinStub,
      stubLength: vinStubs.stubLength,
      make: vinStubs.make,
      model: vinStubs.model,
      submodel: vinStubs.submodel,
    })
    .from(vinStubs)
    .where(
      and(
        eq(vinStubs.year, year),
        eq(vinStubs.makeNormalized, makeNorm),
        eq(vinStubs.modelNormalized, modelNorm),
        eq(vinStubs.isBaseModel, true),
        eq(vinStubs.isActive, true),
      ),
    )
    .limit(1);

  if (baseRows.length > 0) {
    const row = baseRows[0]!;
    return {
      vin_stub: formatPadded(row.vinStub),
      stub_length: row.stubLength,
      year,
      make: row.make,
      model: row.model,
      submodel: row.submodel,
      match_type: 'base_model',
    };
  }

  return {
    code: 'not_found',
    message: `No VIN stub found for ${year} ${make} ${model}.`,
  };
}

// ─── REFERENCE DATA ───────────────────────────────────────────────────────────

/**
 * Return a sorted list of all distinct canonical make names.
 * Result is cached in Redis indefinitely and refreshed by the ingest script.
 */
export async function getMakes(): Promise<string[]> {
  const cacheKey = Keys.makesList();
  const cached = await redis.get(cacheKey);
  if (cached) return JSON.parse(cached) as string[];

  const rows = await db
    .selectDistinct({ make: vinStubs.make, makeNorm: vinStubs.makeNormalized })
    .from(vinStubs)
    .where(eq(vinStubs.isActive, true))
    .orderBy(vinStubs.makeNormalized);

  // Deduplicate by normalized form (keep canonical display name)
  const seen = new Set<string>();
  const makes: string[] = [];
  for (const row of rows) {
    if (!seen.has(row.makeNorm)) {
      seen.add(row.makeNorm);
      makes.push(row.make);
    }
  }

  // Cache with no expiry — refreshed by ingest script
  await redis.set(cacheKey, JSON.stringify(makes));
  return makes;
}

/**
 * Return a sorted list of all distinct model names for a given make.
 * Result is cached in Redis indefinitely and refreshed by the ingest script.
 *
 * @param make - Raw make name (normalized internally)
 */
export async function getModels(make: string): Promise<string[]> {
  const makeNorm = await normalizeMake(make);
  const cacheKey = Keys.modelsList(makeNorm);

  const cached = await redis.get(cacheKey);
  if (cached) return JSON.parse(cached) as string[];

  const rows = await db
    .selectDistinct({ model: vinStubs.model, modelNorm: vinStubs.modelNormalized })
    .from(vinStubs)
    .where(and(eq(vinStubs.makeNormalized, makeNorm), eq(vinStubs.isActive, true)))
    .orderBy(vinStubs.modelNormalized);

  const seen = new Set<string>();
  const models: string[] = [];
  for (const row of rows) {
    if (!seen.has(row.modelNorm)) {
      seen.add(row.modelNorm);
      models.push(row.model);
    }
  }

  await redis.set(cacheKey, JSON.stringify(models));
  return models;
}
