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
var drizzle_orm_1 = require("drizzle-orm");
var auth_js_1 = require("../../middleware/auth.js");
var billing_service_js_1 = require("../../services/billing.service.js");
var index_js_1 = require("../../db/index.js");
var index_js_2 = require("../../db/schema/index.js");
var UPGRADEABLE_PLANS = ['basic', 'premium', 'enterprise'];
var billingRoutes = function (fastify) { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        fastify.post('/account/checkout', {
            preHandler: [auth_js_1.jwtAuth],
            schema: {
                tags: ['Billing'],
                summary: 'Create Stripe Checkout session',
                description: 'Returns a Stripe Checkout URL for subscribing to a paid plan. ' +
                    'Redirect the user to this URL immediately — it expires after 24 hours. ' +
                    'Requires dashboard session (JWT).',
                querystring: {
                    type: 'object',
                    required: ['plan'],
                    additionalProperties: false,
                    properties: {
                        plan: {
                            type: 'string',
                            enum: UPGRADEABLE_PLANS,
                            description: 'Target plan to subscribe to',
                        },
                    },
                },
                response: {
                    200: {
                        description: 'Checkout session created',
                        type: 'object',
                        properties: {
                            success: { type: 'boolean' },
                            url: {
                                type: 'string',
                                description: 'Stripe Checkout hosted page URL. Redirect the user here.',
                            },
                        },
                    },
                    400: { $ref: 'ErrorResponse#' },
                    401: { $ref: 'ErrorResponse#' },
                    409: { $ref: 'ErrorResponse#' },
                },
            },
        }, function (request, reply) { return __awaiter(void 0, void 0, void 0, function () {
            var plan, user, rows, _a, email, currentPlan, stripeCustomerId, url;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        plan = request.query.plan;
                        user = request.user;
                        return [4 /*yield*/, index_js_1.db
                                .select({
                                email: index_js_2.users.email,
                                currentPlan: index_js_2.users.plan,
                                stripeCustomerId: index_js_2.users.stripeCustomerId,
                            })
                                .from(index_js_2.users)
                                .where((0, drizzle_orm_1.eq)(index_js_2.users.id, user.userId))
                                .limit(1)];
                    case 1:
                        rows = _b.sent();
                        if (!rows.length) {
                            return [2 /*return*/, reply.status(401).send({
                                    success: false,
                                    error: 'unauthorized',
                                    message: 'User not found.',
                                    request_id: request.id,
                                })];
                        }
                        _a = rows[0], email = _a.email, currentPlan = _a.currentPlan, stripeCustomerId = _a.stripeCustomerId;
                        // Prevent "upgrading" to the same plan they already have
                        if (currentPlan === plan) {
                            return [2 /*return*/, reply.status(409).send({
                                    success: false,
                                    error: 'already_on_plan',
                                    message: "You are already on the ".concat(plan, " plan."),
                                    request_id: request.id,
                                })];
                        }
                        return [4 /*yield*/, (0, billing_service_js_1.createCheckoutSession)(user.userId, plan, email, stripeCustomerId)];
                    case 2:
                        url = (_b.sent()).url;
                        return [2 /*return*/, reply.status(200).send({ success: true, url: url })];
                }
            });
        }); });
        return [2 /*return*/];
    });
}); };
exports.default = billingRoutes;
