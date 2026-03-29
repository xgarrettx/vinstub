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
var stripe_js_1 = require("../../config/stripe.js");
var env_js_1 = require("../../config/env.js");
var index_js_1 = require("../../db/index.js");
var index_js_2 = require("../../db/schema/index.js");
var billing_service_js_1 = require("../../services/billing.service.js");
var stripeWebhookRoutes = function (fastify) { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        fastify.post('/stripe', {
            // Disable Fastify's automatic JSON body parsing for this route —
            // we need the raw Buffer for Stripe signature verification.
            config: { rawBody: true },
            schema: {
                tags: ['Webhooks'],
                summary: 'Stripe webhook receiver',
                description: 'Internal endpoint — not for direct use. Verifies Stripe signature and processes billing events.',
                // Intentionally minimal schema — body is arbitrary Stripe JSON
                response: {
                    200: {
                        type: 'object',
                        properties: {
                            received: { type: 'boolean' },
                        },
                    },
                },
            },
        }, function (request, reply) { return __awaiter(void 0, void 0, void 0, function () {
            var sig, event, err_1, _a, err_2;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        sig = request.headers['stripe-signature'];
                        if (!sig || typeof sig !== 'string') {
                            return [2 /*return*/, reply.status(400).send({ error: 'Missing stripe-signature header.' })];
                        }
                        // rawBody is populated by the content-type override parser in app.ts
                        if (!request.rawBody || request.rawBody.length === 0) {
                            return [2 /*return*/, reply.status(400).send({ error: 'Empty request body.' })];
                        }
                        try {
                            event = stripe_js_1.stripe.webhooks.constructEvent(request.rawBody, sig, env_js_1.env.STRIPE_WEBHOOK_SECRET);
                        }
                        catch (err) {
                            fastify.log.warn({ err: err }, '[stripe-webhook] signature verification failed');
                            return [2 /*return*/, reply.status(400).send({
                                    error: "Webhook signature verification failed: ".concat(err.message),
                                })];
                        }
                        _b.label = 1;
                    case 1:
                        _b.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, index_js_1.db.insert(index_js_2.webhookEvents).values({
                                stripeEventId: event.id,
                                eventType: event.type,
                                processedAt: new Date(),
                            })];
                    case 2:
                        _b.sent();
                        return [3 /*break*/, 4];
                    case 3:
                        err_1 = _b.sent();
                        // Unique violation = duplicate event
                        if ((err_1 === null || err_1 === void 0 ? void 0 : err_1.code) === '23505') {
                            fastify.log.info({ eventId: event.id }, '[stripe-webhook] duplicate event — skipping');
                            return [2 /*return*/, reply.status(200).send({ received: true })];
                        }
                        throw err_1;
                    case 4:
                        _b.trys.push([4, 17, , 18]);
                        _a = event.type;
                        switch (_a) {
                            case 'checkout.session.completed': return [3 /*break*/, 5];
                            case 'invoice.payment_succeeded': return [3 /*break*/, 7];
                            case 'invoice.payment_failed': return [3 /*break*/, 9];
                            case 'customer.subscription.updated': return [3 /*break*/, 11];
                            case 'customer.subscription.deleted': return [3 /*break*/, 13];
                        }
                        return [3 /*break*/, 15];
                    case 5: return [4 /*yield*/, (0, billing_service_js_1.handleCheckoutCompleted)(event.data.object)];
                    case 6:
                        _b.sent();
                        return [3 /*break*/, 16];
                    case 7: return [4 /*yield*/, (0, billing_service_js_1.handleInvoicePaymentSucceeded)(event.data.object)];
                    case 8:
                        _b.sent();
                        return [3 /*break*/, 16];
                    case 9: return [4 /*yield*/, (0, billing_service_js_1.handleInvoicePaymentFailed)(event.data.object)];
                    case 10:
                        _b.sent();
                        return [3 /*break*/, 16];
                    case 11: return [4 /*yield*/, (0, billing_service_js_1.handleSubscriptionUpdated)(event.data.object)];
                    case 12:
                        _b.sent();
                        return [3 /*break*/, 16];
                    case 13: return [4 /*yield*/, (0, billing_service_js_1.handleSubscriptionDeleted)(event.data.object)];
                    case 14:
                        _b.sent();
                        return [3 /*break*/, 16];
                    case 15:
                        fastify.log.debug({ type: event.type }, '[stripe-webhook] unhandled event type — acknowledged');
                        _b.label = 16;
                    case 16: return [3 /*break*/, 18];
                    case 17:
                        err_2 = _b.sent();
                        // Log the error but return 200 to Stripe to prevent retries for
                        // application-level errors. Sentry will capture this for alerting.
                        fastify.log.error({ err: err_2, eventId: event.id, eventType: event.type }, '[stripe-webhook] handler threw — event acknowledged but processing failed');
                        return [3 /*break*/, 18];
                    case 18: return [2 /*return*/, reply.status(200).send({ received: true })];
                }
            });
        }); });
        return [2 /*return*/];
    });
}); };
exports.default = stripeWebhookRoutes;
