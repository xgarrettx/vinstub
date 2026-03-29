"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __values = (this && this.__values) || function(o) {
    var s = typeof Symbol === "function" && Symbol.iterator, m = s && o[s], i = 0;
    if (m) return m.call(o);
    if (o && typeof o.length === "number") return {
        next: function () {
            if (o && i >= o.length) o = void 0;
            return { value: o && o[i++], done: !o };
        }
    };
    throw new TypeError(s ? "Object is not iterable." : "Symbol.iterator is not defined.");
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalize = normalize;
exports.normalizeMake = normalizeMake;
exports.formatPadded = formatPadded;
exports.commonPrefix = commonPrefix;
exports.lookupStub = lookupStub;
exports.getMakes = getMakes;
exports.getModels = getModels;
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
var drizzle_orm_1 = require("drizzle-orm");
var index_js_1 = require("../db/index.js");
var index_js_2 = require("../db/schema/index.js");
var index_js_3 = require("../redis/index.js");
// ─── NORMALIZATION ────────────────────────────────────────────────────────────
/**
 * Normalize a make/model/submodel string for matching.
 * Lowercases, trims, removes all non-alphanumeric/space chars,
 * and collapses multiple spaces into one.
 */
function normalize(input) {
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
function normalizeMake(rawMake) {
    return __awaiter(this, void 0, void 0, function () {
        var normalized, cachedSynonyms, rows, canonical;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    normalized = normalize(rawMake);
                    return [4 /*yield*/, index_js_3.redis.hget('ref:make_synonyms', normalized)];
                case 1:
                    cachedSynonyms = _a.sent();
                    if (cachedSynonyms)
                        return [2 /*return*/, cachedSynonyms];
                    return [4 /*yield*/, index_js_1.db
                            .select({ canonical: index_js_2.makeSynonyms.canonical })
                            .from(index_js_2.makeSynonyms)
                            .where((0, drizzle_orm_1.eq)(index_js_2.makeSynonyms.alias, normalized))
                            .limit(1)];
                case 2:
                    rows = _a.sent();
                    if (!(rows.length > 0)) return [3 /*break*/, 4];
                    canonical = rows[0].canonical;
                    // Cache in Redis indefinitely (refreshed by ingest script)
                    return [4 /*yield*/, index_js_3.redis.hset('ref:make_synonyms', normalized, canonical)];
                case 3:
                    // Cache in Redis indefinitely (refreshed by ingest script)
                    _a.sent();
                    return [2 /*return*/, canonical];
                case 4: 
                // No synonym found — use the normalized form as-is
                return [2 /*return*/, normalized];
            }
        });
    });
}
// ─── PADDING ─────────────────────────────────────────────────────────────────
/**
 * Right-pad a VIN stub with zeros to reach 9 characters.
 * Stubs that are already 9+ chars are returned unchanged.
 * This represents the standard "WMI + VDS" portion of a VIN.
 */
function formatPadded(stub) {
    return stub.padEnd(9, '0');
}
// ─── COMMON PREFIX ────────────────────────────────────────────────────────────
/**
 * Return the longest common prefix shared by all strings in the array.
 * Returns empty string if the array is empty.
 */
function commonPrefix(stubs) {
    if (stubs.length === 0)
        return '';
    var prefix = stubs[0];
    for (var i = 1; i < stubs.length; i++) {
        var s = stubs[i];
        var j = 0;
        while (j < prefix.length && j < s.length && prefix[j] === s[j])
            j++;
        prefix = prefix.slice(0, j);
        if (prefix.length === 0)
            break;
    }
    return prefix;
}
// ─── LOOKUP ───────────────────────────────────────────────────────────────────
var MIN_YEAR = 1980;
var MAX_YEAR = 2035;
/**
 * Look up a VIN stub by year / make / model / optional submodel.
 *
 * @param year      - Model year (integer)
 * @param make      - Make name (normalized internally)
 * @param model     - Model name (normalized internally)
 * @param submodel  - Optional trim/submodel (normalized internally)
 */
function lookupStub(year, make, model, submodel) {
    return __awaiter(this, void 0, void 0, function () {
        var makeNorm, modelNorm, submodelNorm, rows, row, submodelRows, stubs, prefix, displayRow, baseRows, row;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    // ── Input validation ───────────────────────────────────────────────────────
                    if (!Number.isInteger(year) || year < MIN_YEAR || year > MAX_YEAR) {
                        return [2 /*return*/, {
                                code: 'invalid_year',
                                message: "Year must be an integer between ".concat(MIN_YEAR, " and ").concat(MAX_YEAR, "."),
                            }];
                    }
                    if (!make.trim() || !model.trim()) {
                        return [2 /*return*/, {
                                code: 'invalid_input',
                                message: 'Make and model are required.',
                            }];
                    }
                    return [4 /*yield*/, normalizeMake(make)];
                case 1:
                    makeNorm = _a.sent();
                    modelNorm = normalize(model);
                    submodelNorm = submodel ? normalize(submodel) : undefined;
                    if (!submodelNorm) return [3 /*break*/, 3];
                    return [4 /*yield*/, index_js_1.db
                            .select({
                            vinStub: index_js_2.vinStubs.vinStub,
                            stubLength: index_js_2.vinStubs.stubLength,
                            make: index_js_2.vinStubs.make,
                            model: index_js_2.vinStubs.model,
                            submodel: index_js_2.vinStubs.submodel,
                        })
                            .from(index_js_2.vinStubs)
                            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(index_js_2.vinStubs.year, year), (0, drizzle_orm_1.eq)(index_js_2.vinStubs.makeNormalized, makeNorm), (0, drizzle_orm_1.eq)(index_js_2.vinStubs.modelNormalized, modelNorm), (0, drizzle_orm_1.eq)(index_js_2.vinStubs.submodelNormalized, submodelNorm), (0, drizzle_orm_1.eq)(index_js_2.vinStubs.isActive, true)))
                            .limit(1)];
                case 2:
                    rows = _a.sent();
                    if (rows.length > 0) {
                        row = rows[0];
                        return [2 /*return*/, {
                                vin_stub: formatPadded(row.vinStub),
                                stub_length: row.stubLength,
                                year: year,
                                make: row.make,
                                model: row.model,
                                submodel: row.submodel,
                                match_type: 'exact',
                            }];
                    }
                    // Submodel provided but not found — do NOT fall back to base model.
                    // Return not_found so the caller knows the specific submodel isn't in our DB.
                    return [2 /*return*/, {
                            code: 'not_found',
                            message: "No VIN stub found for ".concat(year, " ").concat(make, " ").concat(model, " ").concat(submodel, "."),
                        }];
                case 3: return [4 /*yield*/, index_js_1.db
                        .select({
                        vinStub: index_js_2.vinStubs.vinStub,
                        make: index_js_2.vinStubs.make,
                        model: index_js_2.vinStubs.model,
                    })
                        .from(index_js_2.vinStubs)
                        .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(index_js_2.vinStubs.year, year), (0, drizzle_orm_1.eq)(index_js_2.vinStubs.makeNormalized, makeNorm), (0, drizzle_orm_1.eq)(index_js_2.vinStubs.modelNormalized, modelNorm), (0, drizzle_orm_1.eq)(index_js_2.vinStubs.isBaseModel, false), (0, drizzle_orm_1.eq)(index_js_2.vinStubs.isActive, true)))];
                case 4:
                    submodelRows = _a.sent();
                    if (submodelRows.length > 0) {
                        stubs = submodelRows.map(function (r) { return r.vinStub; });
                        prefix = commonPrefix(stubs);
                        // Must have at least the WMI (3 chars) to be meaningful
                        if (prefix.length >= 3) {
                            displayRow = submodelRows[0];
                            return [2 /*return*/, {
                                    vin_stub: formatPadded(prefix),
                                    stub_length: prefix.length,
                                    year: year,
                                    make: displayRow.make,
                                    model: displayRow.model,
                                    submodel: null,
                                    match_type: 'base_model',
                                }];
                        }
                    }
                    return [4 /*yield*/, index_js_1.db
                            .select({
                            vinStub: index_js_2.vinStubs.vinStub,
                            stubLength: index_js_2.vinStubs.stubLength,
                            make: index_js_2.vinStubs.make,
                            model: index_js_2.vinStubs.model,
                            submodel: index_js_2.vinStubs.submodel,
                        })
                            .from(index_js_2.vinStubs)
                            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(index_js_2.vinStubs.year, year), (0, drizzle_orm_1.eq)(index_js_2.vinStubs.makeNormalized, makeNorm), (0, drizzle_orm_1.eq)(index_js_2.vinStubs.modelNormalized, modelNorm), (0, drizzle_orm_1.eq)(index_js_2.vinStubs.isBaseModel, true), (0, drizzle_orm_1.eq)(index_js_2.vinStubs.isActive, true)))
                            .limit(1)];
                case 5:
                    baseRows = _a.sent();
                    if (baseRows.length > 0) {
                        row = baseRows[0];
                        return [2 /*return*/, {
                                vin_stub: formatPadded(row.vinStub),
                                stub_length: row.stubLength,
                                year: year,
                                make: row.make,
                                model: row.model,
                                submodel: row.submodel,
                                match_type: 'base_model',
                            }];
                    }
                    return [2 /*return*/, {
                            code: 'not_found',
                            message: "No VIN stub found for ".concat(year, " ").concat(make, " ").concat(model, "."),
                        }];
            }
        });
    });
}
// ─── REFERENCE DATA ───────────────────────────────────────────────────────────
/**
 * Return a sorted list of all distinct canonical make names.
 * Result is cached in Redis indefinitely and refreshed by the ingest script.
 */
function getMakes() {
    return __awaiter(this, void 0, void 0, function () {
        var cacheKey, cached, rows, seen, makes, rows_1, rows_1_1, row;
        var e_1, _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    cacheKey = index_js_3.Keys.makesList();
                    return [4 /*yield*/, index_js_3.redis.get(cacheKey)];
                case 1:
                    cached = _b.sent();
                    if (cached)
                        return [2 /*return*/, JSON.parse(cached)];
                    return [4 /*yield*/, index_js_1.db
                            .selectDistinct({ make: index_js_2.vinStubs.make, makeNorm: index_js_2.vinStubs.makeNormalized })
                            .from(index_js_2.vinStubs)
                            .where((0, drizzle_orm_1.eq)(index_js_2.vinStubs.isActive, true))
                            .orderBy(index_js_2.vinStubs.makeNormalized)];
                case 2:
                    rows = _b.sent();
                    seen = new Set();
                    makes = [];
                    try {
                        for (rows_1 = __values(rows), rows_1_1 = rows_1.next(); !rows_1_1.done; rows_1_1 = rows_1.next()) {
                            row = rows_1_1.value;
                            if (!seen.has(row.makeNorm)) {
                                seen.add(row.makeNorm);
                                makes.push(row.make);
                            }
                        }
                    }
                    catch (e_1_1) { e_1 = { error: e_1_1 }; }
                    finally {
                        try {
                            if (rows_1_1 && !rows_1_1.done && (_a = rows_1.return)) _a.call(rows_1);
                        }
                        finally { if (e_1) throw e_1.error; }
                    }
                    // Cache with no expiry — refreshed by ingest script
                    return [4 /*yield*/, index_js_3.redis.set(cacheKey, JSON.stringify(makes))];
                case 3:
                    // Cache with no expiry — refreshed by ingest script
                    _b.sent();
                    return [2 /*return*/, makes];
            }
        });
    });
}
/**
 * Return a sorted list of all distinct model names for a given make.
 * Result is cached in Redis indefinitely and refreshed by the ingest script.
 *
 * @param make - Raw make name (normalized internally)
 */
function getModels(make) {
    return __awaiter(this, void 0, void 0, function () {
        var makeNorm, cacheKey, cached, rows, seen, models, rows_2, rows_2_1, row;
        var e_2, _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, normalizeMake(make)];
                case 1:
                    makeNorm = _b.sent();
                    cacheKey = index_js_3.Keys.modelsList(makeNorm);
                    return [4 /*yield*/, index_js_3.redis.get(cacheKey)];
                case 2:
                    cached = _b.sent();
                    if (cached)
                        return [2 /*return*/, JSON.parse(cached)];
                    return [4 /*yield*/, index_js_1.db
                            .selectDistinct({ model: index_js_2.vinStubs.model, modelNorm: index_js_2.vinStubs.modelNormalized })
                            .from(index_js_2.vinStubs)
                            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(index_js_2.vinStubs.makeNormalized, makeNorm), (0, drizzle_orm_1.eq)(index_js_2.vinStubs.isActive, true)))
                            .orderBy(index_js_2.vinStubs.modelNormalized)];
                case 3:
                    rows = _b.sent();
                    seen = new Set();
                    models = [];
                    try {
                        for (rows_2 = __values(rows), rows_2_1 = rows_2.next(); !rows_2_1.done; rows_2_1 = rows_2.next()) {
                            row = rows_2_1.value;
                            if (!seen.has(row.modelNorm)) {
                                seen.add(row.modelNorm);
                                models.push(row.model);
                            }
                        }
                    }
                    catch (e_2_1) { e_2 = { error: e_2_1 }; }
                    finally {
                        try {
                            if (rows_2_1 && !rows_2_1.done && (_a = rows_2.return)) _a.call(rows_2);
                        }
                        finally { if (e_2) throw e_2.error; }
                    }
                    return [4 /*yield*/, index_js_3.redis.set(cacheKey, JSON.stringify(models))];
                case 4:
                    _b.sent();
                    return [2 /*return*/, models];
            }
        });
    });
}
