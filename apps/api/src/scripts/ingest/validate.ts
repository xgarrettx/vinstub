/**
 * scripts/ingest/validate.ts — CSV row validation for VIN stub imports.
 *
 * Validates a single parsed CSV row before it is written to the database.
 * Returns a list of validation errors (empty = valid).
 *
 * Expected CSV columns (case-insensitive headers):
 *   year        — integer 1980–2035
 *   make        — non-empty string
 *   model       — non-empty string
 *   submodel    — string or empty (empty = base model row)
 *   vin_stub    — 7–17 char alphanumeric string
 *   is_base_model — boolean (true/false/1/0/yes/no)
 *   source_version — non-empty string (e.g. "2024-Q2")
 *
 * Business rules:
 *   - vin_stub must be alphanumeric only (A-Z, 0-9, no I/O/Q per VIN spec)
 *   - is_base_model = true REQUIRES submodel to be empty
 *   - is_base_model = false REQUIRES submodel to be non-empty
 *   - year must be a valid integer in range
 */

export interface RawCsvRow {
  year: string;
  make: string;
  model: string;
  submodel: string;
  vin_stub: string;
  is_base_model: string;
  source_version: string;
  [key: string]: string;
}

export interface ValidatedRow {
  year: number;
  make: string;
  model: string;
  submodel: string; // empty string = no submodel
  vinStub: string;
  isBaseModel: boolean;
  sourceVersion: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  row?: ValidatedRow;
}

// Characters excluded from VIN: I, O, Q
const VIN_CHARS_REGEX = /^[A-HJ-NPR-Z0-9]+$/i;

const MIN_YEAR = 1980;
const MAX_YEAR = 2035;
const MIN_STUB_LEN = 7;
const MAX_STUB_LEN = 17;

const TRUTHY_VALUES = new Set(['true', '1', 'yes', 'y']);
const FALSY_VALUES  = new Set(['false', '0', 'no', 'n', '']);

function parseBool(value: string): boolean | null {
  const v = value.trim().toLowerCase();
  if (TRUTHY_VALUES.has(v)) return true;
  if (FALSY_VALUES.has(v))  return false;
  return null;
}

export function validateRow(raw: RawCsvRow, rowIndex: number): ValidationResult {
  const errors: string[] = [];
  const prefix = `Row ${rowIndex}`;

  // ── year ──────────────────────────────────────────────────────────────────
  const yearInt = parseInt(raw.year?.trim() ?? '', 10);
  if (isNaN(yearInt) || !Number.isInteger(yearInt)) {
    errors.push(`${prefix}: year "${raw.year}" is not a valid integer`);
  } else if (yearInt < MIN_YEAR || yearInt > MAX_YEAR) {
    errors.push(`${prefix}: year ${yearInt} out of range (${MIN_YEAR}–${MAX_YEAR})`);
  }

  // ── make ─────────────────────────────────────────────────────────────────
  const make = raw.make?.trim() ?? '';
  if (!make) errors.push(`${prefix}: make is required`);

  // ── model ─────────────────────────────────────────────────────────────────
  const model = raw.model?.trim() ?? '';
  if (!model) errors.push(`${prefix}: model is required`);

  // ── vin_stub ──────────────────────────────────────────────────────────────
  const vinStub = (raw.vin_stub?.trim() ?? '').toUpperCase();
  if (!vinStub) {
    errors.push(`${prefix}: vin_stub is required`);
  } else if (vinStub.length < MIN_STUB_LEN || vinStub.length > MAX_STUB_LEN) {
    errors.push(`${prefix}: vin_stub length ${vinStub.length} out of range (${MIN_STUB_LEN}–${MAX_STUB_LEN})`);
  } else if (!VIN_CHARS_REGEX.test(vinStub)) {
    errors.push(`${prefix}: vin_stub "${vinStub}" contains invalid characters (I, O, Q not allowed)`);
  }

  // ── is_base_model ─────────────────────────────────────────────────────────
  const isBaseModel = parseBool(raw.is_base_model ?? '');
  if (isBaseModel === null) {
    errors.push(`${prefix}: is_base_model "${raw.is_base_model}" is not a valid boolean`);
  }

  // ── submodel ──────────────────────────────────────────────────────────────
  const submodel = raw.submodel?.trim() ?? '';

  // Cross-field: base model rows must have no submodel; non-base rows must have one
  if (isBaseModel !== null) {
    if (isBaseModel && submodel) {
      errors.push(`${prefix}: is_base_model=true but submodel is non-empty ("${submodel}")`);
    }
    if (!isBaseModel && !submodel) {
      errors.push(`${prefix}: is_base_model=false but submodel is empty`);
    }
  }

  // ── source_version ────────────────────────────────────────────────────────
  const sourceVersion = raw.source_version?.trim() ?? '';
  if (!sourceVersion) errors.push(`${prefix}: source_version is required`);

  if (errors.length > 0) return { valid: false, errors };

  return {
    valid: true,
    errors: [],
    row: {
      year: yearInt,
      make,
      model,
      submodel,
      vinStub,
      isBaseModel: isBaseModel as boolean,
      sourceVersion,
    },
  };
}

/**
 * Validate required CSV headers are present (case-insensitive check).
 */
const REQUIRED_HEADERS = ['year', 'make', 'model', 'submodel', 'vin_stub', 'is_base_model', 'source_version'];

export function validateHeaders(headers: string[]): string[] {
  const lower = headers.map((h) => h.trim().toLowerCase());
  return REQUIRED_HEADERS.filter((h) => !lower.includes(h));
}
