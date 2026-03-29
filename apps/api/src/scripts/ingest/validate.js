"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateRow = validateRow;
exports.validateHeaders = validateHeaders;
// Characters excluded from VIN: I, O, Q
var VIN_CHARS_REGEX = /^[A-HJ-NPR-Z0-9]+$/i;
var MIN_YEAR = 1980;
var MAX_YEAR = 2035;
var MIN_STUB_LEN = 7;
var MAX_STUB_LEN = 17;
var TRUTHY_VALUES = new Set(['true', '1', 'yes', 'y']);
var FALSY_VALUES = new Set(['false', '0', 'no', 'n', '']);
function parseBool(value) {
    var v = value.trim().toLowerCase();
    if (TRUTHY_VALUES.has(v))
        return true;
    if (FALSY_VALUES.has(v))
        return false;
    return null;
}
function validateRow(raw, rowIndex) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o;
    var errors = [];
    var prefix = "Row ".concat(rowIndex);
    // ── year ──────────────────────────────────────────────────────────────────
    var yearInt = parseInt((_b = (_a = raw.year) === null || _a === void 0 ? void 0 : _a.trim()) !== null && _b !== void 0 ? _b : '', 10);
    if (isNaN(yearInt) || !Number.isInteger(yearInt)) {
        errors.push("".concat(prefix, ": year \"").concat(raw.year, "\" is not a valid integer"));
    }
    else if (yearInt < MIN_YEAR || yearInt > MAX_YEAR) {
        errors.push("".concat(prefix, ": year ").concat(yearInt, " out of range (").concat(MIN_YEAR, "\u2013").concat(MAX_YEAR, ")"));
    }
    // ── make ─────────────────────────────────────────────────────────────────
    var make = (_d = (_c = raw.make) === null || _c === void 0 ? void 0 : _c.trim()) !== null && _d !== void 0 ? _d : '';
    if (!make)
        errors.push("".concat(prefix, ": make is required"));
    // ── model ─────────────────────────────────────────────────────────────────
    var model = (_f = (_e = raw.model) === null || _e === void 0 ? void 0 : _e.trim()) !== null && _f !== void 0 ? _f : '';
    if (!model)
        errors.push("".concat(prefix, ": model is required"));
    // ── vin_stub ──────────────────────────────────────────────────────────────
    var vinStub = ((_h = (_g = raw.vin_stub) === null || _g === void 0 ? void 0 : _g.trim()) !== null && _h !== void 0 ? _h : '').toUpperCase();
    if (!vinStub) {
        errors.push("".concat(prefix, ": vin_stub is required"));
    }
    else if (vinStub.length < MIN_STUB_LEN || vinStub.length > MAX_STUB_LEN) {
        errors.push("".concat(prefix, ": vin_stub length ").concat(vinStub.length, " out of range (").concat(MIN_STUB_LEN, "\u2013").concat(MAX_STUB_LEN, ")"));
    }
    else if (!VIN_CHARS_REGEX.test(vinStub)) {
        errors.push("".concat(prefix, ": vin_stub \"").concat(vinStub, "\" contains invalid characters (I, O, Q not allowed)"));
    }
    // ── is_base_model ─────────────────────────────────────────────────────────
    var isBaseModel = parseBool((_j = raw.is_base_model) !== null && _j !== void 0 ? _j : '');
    if (isBaseModel === null) {
        errors.push("".concat(prefix, ": is_base_model \"").concat(raw.is_base_model, "\" is not a valid boolean"));
    }
    // ── submodel ──────────────────────────────────────────────────────────────
    var submodel = (_l = (_k = raw.submodel) === null || _k === void 0 ? void 0 : _k.trim()) !== null && _l !== void 0 ? _l : '';
    // Cross-field: base model rows must have no submodel; non-base rows must have one
    if (isBaseModel !== null) {
        if (isBaseModel && submodel) {
            errors.push("".concat(prefix, ": is_base_model=true but submodel is non-empty (\"").concat(submodel, "\")"));
        }
        if (!isBaseModel && !submodel) {
            errors.push("".concat(prefix, ": is_base_model=false but submodel is empty"));
        }
    }
    // ── source_version ────────────────────────────────────────────────────────
    var sourceVersion = (_o = (_m = raw.source_version) === null || _m === void 0 ? void 0 : _m.trim()) !== null && _o !== void 0 ? _o : '';
    if (!sourceVersion)
        errors.push("".concat(prefix, ": source_version is required"));
    if (errors.length > 0)
        return { valid: false, errors: errors };
    return {
        valid: true,
        errors: [],
        row: {
            year: yearInt,
            make: make,
            model: model,
            submodel: submodel,
            vinStub: vinStub,
            isBaseModel: isBaseModel,
            sourceVersion: sourceVersion,
        },
    };
}
/**
 * Validate required CSV headers are present (case-insensitive check).
 */
var REQUIRED_HEADERS = ['year', 'make', 'model', 'submodel', 'vin_stub', 'is_base_model', 'source_version'];
function validateHeaders(headers) {
    var lower = headers.map(function (h) { return h.trim().toLowerCase(); });
    return REQUIRED_HEADERS.filter(function (h) { return !lower.includes(h); });
}
