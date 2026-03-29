"use strict";
var __makeTemplateObject = (this && this.__makeTemplateObject) || function (cooked, raw) {
    if (Object.defineProperty) { Object.defineProperty(cooked, "raw", { value: raw }); } else { cooked.raw = raw; }
    return cooked;
};
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
var __read = (this && this.__read) || function (o, n) {
    var m = typeof Symbol === "function" && o[Symbol.iterator];
    if (!m) return o;
    var i = m.call(o), r, ar = [], e;
    try {
        while ((n === void 0 || n-- > 0) && !(r = i.next()).done) ar.push(r.value);
    }
    catch (error) { e = { error: error }; }
    finally {
        try {
            if (r && !r.done && (m = i["return"])) m.call(i);
        }
        finally { if (e) throw e.error; }
    }
    return ar;
};
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
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
var fs_1 = require("fs");
var csv_parse_1 = require("csv-parse");
var drizzle_orm_1 = require("drizzle-orm");
var index_js_1 = require("../../db/index.js");
var index_js_2 = require("../../db/schema/index.js");
var index_js_3 = require("../../redis/index.js");
var vin_service_js_1 = require("../../services/vin.service.js");
var validate_js_1 = require("./validate.js");
// ─── CLI ARG PARSING ──────────────────────────────────────────────────────────
function getArg(flag) {
    var idx = process.argv.indexOf(flag);
    return idx !== -1 ? process.argv[idx + 1] : undefined;
}
var FILE_PATH = getArg('--file');
var DRY_RUN = process.argv.includes('--dry-run');
var BATCH_SIZE = parseInt((_a = getArg('--batch-size')) !== null && _a !== void 0 ? _a : '500', 10);
if (!FILE_PATH) {
    console.error('Usage: pnpm ingest --file <path/to/stubs.csv> [--dry-run] [--batch-size N]');
    process.exit(1);
}
// ─── NORMALIZATION ────────────────────────────────────────────────────────────
function normalizeRow(row) {
    return {
        year: row.year,
        make: row.make,
        makeNormalized: (0, vin_service_js_1.normalize)(row.make),
        model: row.model,
        modelNormalized: (0, vin_service_js_1.normalize)(row.model),
        submodel: row.submodel || null,
        submodelNormalized: row.submodel ? (0, vin_service_js_1.normalize)(row.submodel) : null,
        vinStub: row.vinStub,
        stubLength: row.vinStub.length,
        isBaseModel: row.isBaseModel,
        sourceVersion: row.sourceVersion,
        isActive: true,
    };
}
// ─── UPSERT BATCH ─────────────────────────────────────────────────────────────
function upsertBatch(rows) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, index_js_1.db
                        .insert(index_js_2.vinStubs)
                        .values(rows)
                        .onConflictDoUpdate({
                        // Conflict target: unique on (year, make_norm, model_norm, submodel_norm) WHERE is_active
                        // On conflict, update the stub data but keep the row active
                        target: [
                            index_js_2.vinStubs.year,
                            index_js_2.vinStubs.makeNormalized,
                            index_js_2.vinStubs.modelNormalized,
                            index_js_2.vinStubs.submodelNormalized,
                        ],
                        set: {
                            vinStub: (0, drizzle_orm_1.sql)(templateObject_1 || (templateObject_1 = __makeTemplateObject(["EXCLUDED.vin_stub"], ["EXCLUDED.vin_stub"]))),
                            stubLength: (0, drizzle_orm_1.sql)(templateObject_2 || (templateObject_2 = __makeTemplateObject(["EXCLUDED.stub_length"], ["EXCLUDED.stub_length"]))),
                            make: (0, drizzle_orm_1.sql)(templateObject_3 || (templateObject_3 = __makeTemplateObject(["EXCLUDED.make"], ["EXCLUDED.make"]))),
                            model: (0, drizzle_orm_1.sql)(templateObject_4 || (templateObject_4 = __makeTemplateObject(["EXCLUDED.model"], ["EXCLUDED.model"]))),
                            submodel: (0, drizzle_orm_1.sql)(templateObject_5 || (templateObject_5 = __makeTemplateObject(["EXCLUDED.submodel"], ["EXCLUDED.submodel"]))),
                            isBaseModel: (0, drizzle_orm_1.sql)(templateObject_6 || (templateObject_6 = __makeTemplateObject(["EXCLUDED.is_base_model"], ["EXCLUDED.is_base_model"]))),
                            sourceVersion: (0, drizzle_orm_1.sql)(templateObject_7 || (templateObject_7 = __makeTemplateObject(["EXCLUDED.source_version"], ["EXCLUDED.source_version"]))),
                            isActive: true,
                            updatedAt: new Date(),
                        },
                    })];
                case 1:
                    _a.sent();
                    return [2 /*return*/, rows.length];
            }
        });
    });
}
// ─── CACHE REBUILD ────────────────────────────────────────────────────────────
function rebuildCaches() {
    return __awaiter(this, void 0, void 0, function () {
        var makeRows, seen, makes, makeRows_1, makeRows_1_1, row, seen_1, seen_1_1, makeNorm, modelRows, modelsSeen, models, modelRows_1, modelRows_1_1, row, e_1_1, synonymRows, flat;
        var e_2, _a, e_1, _b, e_3, _c;
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0:
                    console.log('[ingest] rebuilding Redis reference caches...');
                    return [4 /*yield*/, index_js_1.db
                            .selectDistinct({ make: index_js_2.vinStubs.make, makeNorm: index_js_2.vinStubs.makeNormalized })
                            .from(index_js_2.vinStubs)
                            .where((0, drizzle_orm_1.eq)(index_js_2.vinStubs.isActive, true))
                            .orderBy(index_js_2.vinStubs.makeNormalized)];
                case 1:
                    makeRows = _d.sent();
                    seen = new Set();
                    makes = [];
                    try {
                        for (makeRows_1 = __values(makeRows), makeRows_1_1 = makeRows_1.next(); !makeRows_1_1.done; makeRows_1_1 = makeRows_1.next()) {
                            row = makeRows_1_1.value;
                            if (!seen.has(row.makeNorm)) {
                                seen.add(row.makeNorm);
                                makes.push(row.make);
                            }
                        }
                    }
                    catch (e_2_1) { e_2 = { error: e_2_1 }; }
                    finally {
                        try {
                            if (makeRows_1_1 && !makeRows_1_1.done && (_a = makeRows_1.return)) _a.call(makeRows_1);
                        }
                        finally { if (e_2) throw e_2.error; }
                    }
                    return [4 /*yield*/, index_js_3.redis.set(index_js_3.Keys.makesList(), JSON.stringify(makes))];
                case 2:
                    _d.sent();
                    _d.label = 3;
                case 3:
                    _d.trys.push([3, 9, 10, 11]);
                    seen_1 = __values(seen), seen_1_1 = seen_1.next();
                    _d.label = 4;
                case 4:
                    if (!!seen_1_1.done) return [3 /*break*/, 8];
                    makeNorm = seen_1_1.value;
                    return [4 /*yield*/, index_js_1.db
                            .selectDistinct({ model: index_js_2.vinStubs.model, modelNorm: index_js_2.vinStubs.modelNormalized })
                            .from(index_js_2.vinStubs)
                            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(index_js_2.vinStubs.makeNormalized, makeNorm), (0, drizzle_orm_1.eq)(index_js_2.vinStubs.isActive, true)))
                            .orderBy(index_js_2.vinStubs.modelNormalized)];
                case 5:
                    modelRows = _d.sent();
                    modelsSeen = new Set();
                    models = [];
                    try {
                        for (modelRows_1 = (e_3 = void 0, __values(modelRows)), modelRows_1_1 = modelRows_1.next(); !modelRows_1_1.done; modelRows_1_1 = modelRows_1.next()) {
                            row = modelRows_1_1.value;
                            if (!modelsSeen.has(row.modelNorm)) {
                                modelsSeen.add(row.modelNorm);
                                models.push(row.model);
                            }
                        }
                    }
                    catch (e_3_1) { e_3 = { error: e_3_1 }; }
                    finally {
                        try {
                            if (modelRows_1_1 && !modelRows_1_1.done && (_c = modelRows_1.return)) _c.call(modelRows_1);
                        }
                        finally { if (e_3) throw e_3.error; }
                    }
                    return [4 /*yield*/, index_js_3.redis.set(index_js_3.Keys.modelsList(makeNorm), JSON.stringify(models))];
                case 6:
                    _d.sent();
                    _d.label = 7;
                case 7:
                    seen_1_1 = seen_1.next();
                    return [3 /*break*/, 4];
                case 8: return [3 /*break*/, 11];
                case 9:
                    e_1_1 = _d.sent();
                    e_1 = { error: e_1_1 };
                    return [3 /*break*/, 11];
                case 10:
                    try {
                        if (seen_1_1 && !seen_1_1.done && (_b = seen_1.return)) _b.call(seen_1);
                    }
                    finally { if (e_1) throw e_1.error; }
                    return [7 /*endfinally*/];
                case 11: 
                // 3. Make synonyms hash — reload from DB
                return [4 /*yield*/, index_js_3.redis.del('ref:make_synonyms')];
                case 12:
                    // 3. Make synonyms hash — reload from DB
                    _d.sent();
                    return [4 /*yield*/, index_js_1.db
                            .select({ alias: index_js_2.makeSynonyms.alias, canonical: index_js_2.makeSynonyms.canonical })
                            .from(index_js_2.makeSynonyms)];
                case 13:
                    synonymRows = _d.sent();
                    if (!(synonymRows.length > 0)) return [3 /*break*/, 15];
                    flat = synonymRows.flatMap(function (r) { return [r.alias, r.canonical]; });
                    return [4 /*yield*/, index_js_3.redis.hset.apply(index_js_3.redis, __spreadArray(['ref:make_synonyms'], __read(flat), false))];
                case 14:
                    _d.sent();
                    _d.label = 15;
                case 15:
                    console.log("[ingest] caches rebuilt: ".concat(makes.length, " makes"));
                    return [2 /*return*/];
            }
        });
    });
}
// ─── MAIN ─────────────────────────────────────────────────────────────────────
function main() {
    return __awaiter(this, void 0, void 0, function () {
        var validRows, validationErrors, rowIndex, headerValidated, sourceVersion, deduped, validRows_1, validRows_1_1, row, key, dedupedRows, dupCount, _a, _b, err, inserted, i, batch, _c, staleResult;
        var e_4, _d, e_5, _e;
        var _f;
        return __generator(this, function (_g) {
            switch (_g.label) {
                case 0:
                    console.log("[ingest] starting import from ".concat(FILE_PATH));
                    console.log("[ingest] mode: ".concat(DRY_RUN ? 'DRY RUN (no DB writes)' : 'LIVE', ", batch size: ").concat(BATCH_SIZE));
                    validRows = [];
                    validationErrors = [];
                    rowIndex = 0;
                    headerValidated = false;
                    sourceVersion = null;
                    // ── Parse CSV ───────────────────────────────────────────────────────────
                    return [4 /*yield*/, new Promise(function (resolve, reject) {
                            var parser = (0, csv_parse_1.parse)({
                                columns: true,
                                skip_empty_lines: true,
                                trim: true,
                            });
                            parser.on('readable', function () {
                                var record;
                                while ((record = parser.read()) !== null) {
                                    rowIndex++;
                                    // Validate headers on first row
                                    if (!headerValidated) {
                                        var missing = (0, validate_js_1.validateHeaders)(Object.keys(record));
                                        if (missing.length > 0) {
                                            reject(new Error("Missing required CSV columns: ".concat(missing.join(', '))));
                                            return;
                                        }
                                        headerValidated = true;
                                    }
                                    var result = (0, validate_js_1.validateRow)(record, rowIndex);
                                    if (!result.valid) {
                                        validationErrors.push.apply(validationErrors, __spreadArray([], __read(result.errors), false));
                                        continue;
                                    }
                                    var normalized = normalizeRow(result.row);
                                    validRows.push(normalized);
                                    // Track source_version (should be uniform across import file)
                                    if (!sourceVersion) {
                                        sourceVersion = normalized.sourceVersion;
                                    }
                                }
                            });
                            parser.on('error', reject);
                            parser.on('end', resolve);
                            (0, fs_1.createReadStream)(FILE_PATH).pipe(parser);
                        })];
                case 1:
                    // ── Parse CSV ───────────────────────────────────────────────────────────
                    _g.sent();
                    deduped = new Map();
                    try {
                        for (validRows_1 = __values(validRows), validRows_1_1 = validRows_1.next(); !validRows_1_1.done; validRows_1_1 = validRows_1.next()) {
                            row = validRows_1_1.value;
                            key = "".concat(row.year, "|").concat(row.makeNormalized, "|").concat(row.modelNormalized, "|").concat((_f = row.submodelNormalized) !== null && _f !== void 0 ? _f : '');
                            deduped.set(key, row);
                        }
                    }
                    catch (e_4_1) { e_4 = { error: e_4_1 }; }
                    finally {
                        try {
                            if (validRows_1_1 && !validRows_1_1.done && (_d = validRows_1.return)) _d.call(validRows_1);
                        }
                        finally { if (e_4) throw e_4.error; }
                    }
                    dedupedRows = __spreadArray([], __read(deduped.values()), false);
                    dupCount = validRows.length - dedupedRows.length;
                    if (dupCount > 0) {
                        console.warn("[ingest] deduplicated ".concat(dupCount, " rows with duplicate conflict keys"));
                    }
                    // Replace validRows in-place for the rest of the pipeline
                    validRows.length = 0;
                    validRows.push.apply(validRows, __spreadArray([], __read(dedupedRows), false));
                    console.log("[ingest] parsed ".concat(rowIndex, " rows: ").concat(validRows.length, " valid, ").concat(validationErrors.length, " invalid"));
                    if (validationErrors.length > 0) {
                        console.warn('[ingest] VALIDATION ERRORS (these rows will be skipped):');
                        try {
                            for (_a = __values(validationErrors.slice(0, 50)), _b = _a.next(); !_b.done; _b = _a.next()) {
                                err = _b.value;
                                console.warn("  ".concat(err));
                            }
                        }
                        catch (e_5_1) { e_5 = { error: e_5_1 }; }
                        finally {
                            try {
                                if (_b && !_b.done && (_e = _a.return)) _e.call(_a);
                            }
                            finally { if (e_5) throw e_5.error; }
                        }
                        if (validationErrors.length > 50) {
                            console.warn("  ... and ".concat(validationErrors.length - 50, " more errors"));
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
                    inserted = 0;
                    i = 0;
                    _g.label = 2;
                case 2:
                    if (!(i < validRows.length)) return [3 /*break*/, 5];
                    batch = validRows.slice(i, i + BATCH_SIZE);
                    _c = inserted;
                    return [4 /*yield*/, upsertBatch(batch)];
                case 3:
                    inserted = _c + _g.sent();
                    process.stdout.write("\r[ingest] upserted ".concat(inserted, "/").concat(validRows.length, " rows..."));
                    _g.label = 4;
                case 4:
                    i += BATCH_SIZE;
                    return [3 /*break*/, 2];
                case 5:
                    console.log(); // newline after progress
                    if (!sourceVersion) return [3 /*break*/, 7];
                    return [4 /*yield*/, index_js_1.db
                            .update(index_js_2.vinStubs)
                            .set({ isActive: false, updatedAt: new Date() })
                            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(index_js_2.vinStubs.isActive, true), (0, drizzle_orm_1.ne)(index_js_2.vinStubs.sourceVersion, sourceVersion)))];
                case 6:
                    staleResult = _g.sent();
                    console.log("[ingest] deactivated stale rows from previous versions");
                    _g.label = 7;
                case 7: 
                // ── Rebuild Redis caches ─────────────────────────────────────────────────
                return [4 /*yield*/, rebuildCaches()];
                case 8:
                    // ── Rebuild Redis caches ─────────────────────────────────────────────────
                    _g.sent();
                    console.log("[ingest] \u2713 complete \u2014 ".concat(inserted, " rows imported"));
                    process.exit(0);
                    return [2 /*return*/];
            }
        });
    });
}
main().catch(function (err) {
    console.error('[ingest] fatal error:', err);
    process.exit(1);
});
var templateObject_1, templateObject_2, templateObject_3, templateObject_4, templateObject_5, templateObject_6, templateObject_7;
