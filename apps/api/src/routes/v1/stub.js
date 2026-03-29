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
Object.defineProperty(exports, "__esModule", { value: true });
var auth_js_1 = require("../../middleware/auth.js");
var rate_limit_js_1 = require("../../middleware/rate-limit.js");
var vin_service_js_1 = require("../../services/vin.service.js");
var stubRoutes = function (fastify) { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        fastify.get('/stub', {
            preHandler: [auth_js_1.bearerAuth, rate_limit_js_1.rateLimitMiddleware],
            schema: {
                tags: ['VIN Lookup'],
                summary: 'Look up a VIN stub',
                description: 'Returns the VIN stub for a given year, make, model, and optional submodel. ' +
                    'When submodel is omitted, the base model record is returned. ' +
                    'Requires a valid API key in the Authorization header.',
                security: [{ BearerAuth: [] }],
                querystring: {
                    type: 'object',
                    required: ['year', 'make', 'model'],
                    additionalProperties: false,
                    properties: {
                        year: {
                            type: 'integer',
                            minimum: 1980,
                            maximum: 2027,
                            description: 'Vehicle model year (1980–2027)',
                        },
                        make: {
                            type: 'string',
                            minLength: 1,
                            maxLength: 100,
                            description: 'Vehicle make (e.g. "Toyota", "Chevrolet")',
                        },
                        model: {
                            type: 'string',
                            minLength: 1,
                            maxLength: 100,
                            description: 'Vehicle model (e.g. "Camry", "Silverado")',
                        },
                        submodel: {
                            type: 'string',
                            minLength: 1,
                            maxLength: 100,
                            description: 'Optional submodel / trim (e.g. "LE", "LTZ")',
                        },
                    },
                },
                response: {
                    200: {
                        description: 'VIN stub found',
                        type: 'object',
                        properties: {
                            success: { type: 'boolean' },
                            data: {
                                type: 'object',
                                properties: {
                                    vin_stub: {
                                        type: 'string',
                                        description: 'The VIN stub (WMI + VDS portion, zero-padded to 9 chars)',
                                    },
                                    stub_length: {
                                        type: 'integer',
                                        description: 'Number of significant characters in the stub',
                                    },
                                    year: { type: 'integer' },
                                    make: { type: 'string' },
                                    model: { type: 'string' },
                                    submodel: { type: ['string', 'null'] },
                                    match_type: {
                                        type: 'string',
                                        enum: ['exact', 'base_model'],
                                        description: '"exact" when submodel was matched, "base_model" when no submodel was provided',
                                    },
                                },
                            },
                        },
                    },
                    400: { $ref: 'ErrorResponse#' },
                    401: { $ref: 'ErrorResponse#' },
                    403: { $ref: 'ErrorResponse#' },
                    404: { $ref: 'ErrorResponse#' },
                    429: { $ref: 'ErrorResponse#' },
                },
            },
        }, function (request, reply) { return __awaiter(void 0, void 0, void 0, function () {
            var _a, year, make, model, submodel, rl, remaining_day, remaining_minute, result;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _a = request.query, year = _a.year, make = _a.make, model = _a.model, submodel = _a.submodel;
                        rl = request.rateLimitData;
                        if (rl) {
                            remaining_day = Math.max(0, rl.limits.daily - rl.dayCount);
                            remaining_minute = Math.max(0, rl.limits.perMinute - rl.minuteCount);
                            reply.headers({
                                'X-RateLimit-Limit-Day': String(rl.limits.daily),
                                'X-RateLimit-Remaining-Day': String(remaining_day),
                                'X-RateLimit-Reset-Day': String(rl.dailyResetAt),
                                'X-RateLimit-Limit-Minute': String(rl.limits.perMinute),
                                'X-RateLimit-Remaining-Minute': String(remaining_minute),
                                'X-RateLimit-Reset-Minute': String(rl.minuteResetAt),
                            });
                            if (rl.softCapExceeded) {
                                reply.header('X-Soft-Cap-Exceeded', 'true');
                            }
                        }
                        return [4 /*yield*/, (0, vin_service_js_1.lookupStub)(year, make, model, submodel)];
                    case 1:
                        result = _b.sent();
                        if ('code' in result) {
                            if (result.code === 'invalid_year' || result.code === 'invalid_input') {
                                return [2 /*return*/, reply.status(400).send({
                                        success: false,
                                        error: result.code,
                                        message: result.message,
                                        request_id: request.id,
                                    })];
                            }
                            // not_found
                            return [2 /*return*/, reply.status(404).send({
                                    success: false,
                                    error: 'not_found',
                                    message: result.message,
                                    request_id: request.id,
                                })];
                        }
                        return [2 /*return*/, reply.status(200).send({
                                success: true,
                                data: result,
                            })];
                }
            });
        }); });
        return [2 /*return*/];
    });
}); };
exports.default = stubRoutes;
