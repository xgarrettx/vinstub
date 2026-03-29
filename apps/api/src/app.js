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
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
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
exports.buildApp = buildApp;
/**
 * app.ts — Fastify application factory.
 *
 * Registers all plugins and routes. Returns a configured Fastify instance
 * without starting the server — this separation makes testing easier.
 */
var fastify_1 = __importDefault(require("fastify"));
var cors_1 = __importDefault(require("@fastify/cors"));
var cookie_1 = __importDefault(require("@fastify/cookie"));
var sensible_1 = __importDefault(require("@fastify/sensible"));
var Sentry = __importStar(require("@sentry/node"));
var env_js_1 = require("./config/env.js");
var openapi_js_1 = require("./openapi.js");
// Routes — all files use `export default`, so import without braces
var index_js_1 = __importDefault(require("./routes/auth/index.js"));
var stub_js_1 = __importDefault(require("./routes/v1/stub.js"));
var account_js_1 = __importDefault(require("./routes/v1/account.js"));
var billing_js_1 = __importDefault(require("./routes/v1/billing.js"));
var makes_js_1 = __importDefault(require("./routes/v1/makes.js"));
var models_js_1 = __importDefault(require("./routes/v1/models.js"));
var health_js_1 = __importDefault(require("./routes/v1/health.js"));
var stripe_js_1 = __importDefault(require("./routes/webhooks/stripe.js"));
var index_js_2 = __importDefault(require("./routes/admin/index.js"));
function buildApp() {
    return __awaiter(this, void 0, void 0, function () {
        var app;
        var _this = this;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    // ── Sentry ─────────────────────────────────────────────────────────────────
                    if (env_js_1.env.SENTRY_DSN) {
                        Sentry.init({
                            dsn: env_js_1.env.SENTRY_DSN,
                            environment: env_js_1.env.NODE_ENV,
                            tracesSampleRate: env_js_1.env.NODE_ENV === 'production' ? 0.1 : 1.0,
                        });
                    }
                    app = (0, fastify_1.default)({
                        logger: __assign({ level: env_js_1.env.NODE_ENV === 'production' ? 'info' : 'debug' }, (env_js_1.env.NODE_ENV !== 'production' && {
                            transport: { target: 'pino-pretty', options: { colorize: true } },
                        })),
                        trustProxy: true, // DigitalOcean App Platform sits behind a load balancer
                        requestIdHeader: 'x-request-id',
                        requestIdLogLabel: 'request_id',
                        genReqId: function () { return "req_".concat(Math.random().toString(36).slice(2, 14)); },
                    });
                    // ── Core plugins ────────────────────────────────────────────────────────────
                    return [4 /*yield*/, app.register(sensible_1.default)];
                case 1:
                    // ── Core plugins ────────────────────────────────────────────────────────────
                    _a.sent();
                    return [4 /*yield*/, app.register(cors_1.default, {
                            origin: env_js_1.env.NODE_ENV === 'production'
                                ? [env_js_1.env.APP_URL, env_js_1.env.APP_BASE_URL]
                                : true, // allow all origins in dev
                            credentials: true,
                            methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
                        })];
                case 2:
                    _a.sent();
                    return [4 /*yield*/, app.register(cookie_1.default, {
                            secret: env_js_1.env.REFRESH_SECRET, // signs cookies
                            hook: 'onRequest',
                        })];
                case 3:
                    _a.sent();
                    // ── OpenAPI / Swagger ───────────────────────────────────────────────────────
                    return [4 /*yield*/, (0, openapi_js_1.registerOpenApi)(app)];
                case 4:
                    // ── OpenAPI / Swagger ───────────────────────────────────────────────────────
                    _a.sent();
                    // ── Parse raw body for Stripe webhook (must come before route registration) ─
                    app.addContentTypeParser('application/json', { parseAs: 'buffer' }, function (req, body, done) {
                        // Attach raw buffer so Stripe can verify the signature
                        req.rawBody = body;
                        try {
                            done(null, JSON.parse(body.toString()));
                        }
                        catch (err) {
                            done(err, undefined);
                        }
                    });
                    // ── Request ID header on every response ─────────────────────────────────────
                    app.addHook('onSend', function (request, reply) { return __awaiter(_this, void 0, void 0, function () {
                        return __generator(this, function (_a) {
                            reply.header('X-Request-Id', request.id);
                            return [2 /*return*/];
                        });
                    }); });
                    // ── Routes ──────────────────────────────────────────────────────────────────
                    return [4 /*yield*/, app.register(health_js_1.default, { prefix: '/v1' })];
                case 5:
                    // ── Routes ──────────────────────────────────────────────────────────────────
                    _a.sent();
                    return [4 /*yield*/, app.register(makes_js_1.default, { prefix: '/v1' })];
                case 6:
                    _a.sent();
                    return [4 /*yield*/, app.register(models_js_1.default, { prefix: '/v1' })];
                case 7:
                    _a.sent();
                    return [4 /*yield*/, app.register(stub_js_1.default, { prefix: '/v1' })];
                case 8:
                    _a.sent();
                    return [4 /*yield*/, app.register(account_js_1.default, { prefix: '/v1' })];
                case 9:
                    _a.sent();
                    return [4 /*yield*/, app.register(billing_js_1.default, { prefix: '/v1' })];
                case 10:
                    _a.sent();
                    return [4 /*yield*/, app.register(index_js_1.default, { prefix: '/auth' })];
                case 11:
                    _a.sent();
                    return [4 /*yield*/, app.register(stripe_js_1.default, { prefix: '/webhooks' })];
                case 12:
                    _a.sent();
                    return [4 /*yield*/, app.register(index_js_2.default, { prefix: '/admin' })];
                case 13:
                    _a.sent();
                    // ── Global error handler ────────────────────────────────────────────────────
                    app.setErrorHandler(function (error, request, reply) { return __awaiter(_this, void 0, void 0, function () {
                        var statusCode;
                        var _a;
                        return __generator(this, function (_b) {
                            if (env_js_1.env.SENTRY_DSN) {
                                Sentry.withScope(function (scope) {
                                    scope.setTag('request_id', String(request.id));
                                    Sentry.captureException(error);
                                });
                            }
                            request.log.error({ err: error, request_id: request.id }, 'unhandled error');
                            statusCode = (_a = error.statusCode) !== null && _a !== void 0 ? _a : 500;
                            return [2 /*return*/, reply.status(statusCode).send({
                                    success: false,
                                    error: 'internal_error',
                                    message: env_js_1.env.NODE_ENV === 'production'
                                        ? 'An unexpected error occurred.'
                                        : error.message,
                                    request_id: request.id,
                                })];
                        });
                    }); });
                    return [2 /*return*/, app];
            }
        });
    });
}
