"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerOpenApi = registerOpenApi;
var swagger_1 = __importDefault(require("@fastify/swagger"));
var swagger_ui_1 = __importDefault(require("@fastify/swagger-ui"));
/**
 * Tags that are internal-only and should be excluded from the public API docs.
 * These routes are still fully functional — they just won't appear in /docs.
 */
var INTERNAL_TAGS = new Set([
    'Account',
    'Auth',
    'System',
    'Billing',
    'Webhooks',
    'Admin',
]);
function registerOpenApi(app) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, app.register(swagger_1.default, {
                        // Hide internal routes from the generated OpenAPI spec.
                        // The transform runs before shouldRouteHide(), so returning hide:true
                        // here is equivalent to adding { schema: { hide: true } } to each route.
                        transform: function (_a) {
                            var _b;
                            var schema = _a.schema, url = _a.url;
                            var tags = (_b = schema === null || schema === void 0 ? void 0 : schema.tags) !== null && _b !== void 0 ? _b : [];
                            if (tags.some(function (t) { return INTERNAL_TAGS.has(t); })) {
                                return { schema: __assign(__assign({}, schema), { hide: true }), url: url };
                            }
                            return { schema: schema, url: url };
                        },
                        openapi: {
                            openapi: '3.1.0',
                            info: {
                                title: 'VINSTUB.com API',
                                description: 'VIN stub lookup API — returns the Vehicle Descriptor Section (VIN stub) for a given year, make, model, and optional submodel.',
                                version: '1.0.0',
                                contact: {
                                    name: 'VINSTUB Support',
                                    email: 'support@vinstub.com',
                                    url: 'https://vinstub.com',
                                },
                                license: {
                                    name: 'Commercial',
                                    url: 'https://vinstub.com/legal/terms',
                                },
                            },
                            servers: [
                                { url: 'https://api.vinstub.com/v1', description: 'Production' },
                                { url: 'http://localhost:3001/v1', description: 'Local development' },
                            ],
                            components: {
                                securitySchemes: {
                                    BearerAuth: {
                                        type: 'http',
                                        scheme: 'bearer',
                                        bearerFormat: 'API Key (vs_live_<48-hex-chars>)',
                                        description: 'Pass your API key as a Bearer token. Example: `Authorization: Bearer vs_live_abc123...`',
                                    },
                                },
                                schemas: {
                                    ErrorResponse: {
                                        type: 'object',
                                        required: ['success', 'error', 'message', 'request_id'],
                                        properties: {
                                            success: { type: 'boolean', example: false },
                                            error: { type: 'string', example: 'rate_limit_exceeded' },
                                            message: { type: 'string' },
                                            retry_after: { type: 'integer', description: 'Seconds until retry (429 only)' },
                                            reset_at: { type: 'string', format: 'date-time' },
                                            upgrade_url: { type: 'string', format: 'uri' },
                                            request_id: { type: 'string', example: 'req_01J9AB3XYZ' },
                                        },
                                    },
                                },
                            },
                            tags: [
                                // Only public-facing tags are listed here. Internal tags (Account, Auth,
                                // System, Billing, Webhooks, Admin) are hidden via the transform above.
                                { name: 'VIN Lookup', description: 'Core VIN stub lookup endpoint' },
                                { name: 'Reference', description: 'Vehicle makes and models reference data' },
                            ],
                        },
                    })];
                case 1:
                    _a.sent();
                    // Register ErrorResponse as a Fastify shared schema so routes can use
                    // $ref: 'ErrorResponse#' in their serialization schemas.
                    // (OpenAPI components.schemas is swagger metadata only — Fastify's serializer
                    // does not read from it; addSchema() is the separate registry it uses.)
                    app.addSchema({
                        $id: 'ErrorResponse',
                        type: 'object',
                        required: ['success', 'error', 'message', 'request_id'],
                        properties: {
                            success: { type: 'boolean' },
                            error: { type: 'string' },
                            message: { type: 'string' },
                            retry_after: { type: 'integer' },
                            reset_at: { type: 'string' },
                            upgrade_url: { type: 'string' },
                            request_id: { type: 'string' },
                        },
                    });
                    return [4 /*yield*/, app.register(swagger_ui_1.default, {
                            routePrefix: '/docs',
                            uiConfig: {
                                docExpansion: 'list',
                                deepLinking: true,
                                displayRequestDuration: true,
                                persistAuthorization: true,
                            },
                            staticCSP: true,
                            transformStaticCSP: function (header) { return header; },
                        })];
                case 2:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
