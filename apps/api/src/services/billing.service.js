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
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.createCheckoutSession = createCheckoutSession;
exports.handleCheckoutCompleted = handleCheckoutCompleted;
exports.handleInvoicePaymentSucceeded = handleInvoicePaymentSucceeded;
exports.handleInvoicePaymentFailed = handleInvoicePaymentFailed;
exports.handleSubscriptionUpdated = handleSubscriptionUpdated;
exports.handleSubscriptionDeleted = handleSubscriptionDeleted;
/**
 * services/billing.service.ts — Stripe billing lifecycle logic.
 *
 * All Stripe webhook event handlers live here. The webhook route
 * (routes/webhooks/stripe.ts) handles signature verification and
 * idempotency, then delegates to these handlers.
 *
 * Plan → Stripe price ID mapping is in env:
 *   STRIPE_PRICE_BASIC, STRIPE_PRICE_PREMIUM, STRIPE_PRICE_ENTERPRISE
 *
 * Checkout flow:
 *   1. User calls POST /v1/account/checkout?plan=basic
 *   2. createCheckoutSession() creates a Stripe Checkout Session with
 *      metadata.userId so we can identify the user in the webhook.
 *   3. User completes payment on Stripe-hosted page.
 *   4. Stripe fires checkout.session.completed → handleCheckoutCompleted().
 *   5. We update the user's plan, stripe_customer_id, stripe_subscription_id.
 *
 * Grace period / suspension flow:
 *   invoice.payment_failed  → set payment_failed_at, send email
 *   (72h passes via cron)   → account suspended
 *   invoice.payment_succeeded → clear payment_failed_at, reactivate if suspended
 */
var drizzle_orm_1 = require("drizzle-orm");
var stripe_js_1 = require("../config/stripe.js");
var env_js_1 = require("../config/env.js");
var index_js_1 = require("../db/index.js");
var index_js_2 = require("../db/schema/index.js");
var index_js_3 = require("../redis/index.js");
var email_service_js_1 = require("./email.service.js");
// ─── PRICE ID → PLAN MAPPING ──────────────────────────────────────────────────
var PRICE_TO_PLAN = (_a = {},
    _a[env_js_1.env.STRIPE_PRICE_BASIC] = 'basic',
    _a[env_js_1.env.STRIPE_PRICE_PREMIUM] = 'premium',
    _a[env_js_1.env.STRIPE_PRICE_ENTERPRISE] = 'enterprise',
    _a);
function planFromPriceId(priceId) {
    var _a;
    return (_a = PRICE_TO_PLAN[priceId]) !== null && _a !== void 0 ? _a : null;
}
// ─── CHECKOUT SESSION ─────────────────────────────────────────────────────────
/**
 * Create a Stripe Checkout Session for a new or upgrade subscription.
 *
 * @param userId      - Internal user ID (stored in session metadata)
 * @param plan        - Target plan ('basic' | 'premium' | 'enterprise')
 * @param email       - Pre-fill the checkout email field
 * @param customerId  - Existing Stripe customer ID if user has one
 */
function createCheckoutSession(userId, plan, email, customerId) {
    return __awaiter(this, void 0, void 0, function () {
        var priceMap, session;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    priceMap = {
                        basic: env_js_1.env.STRIPE_PRICE_BASIC,
                        premium: env_js_1.env.STRIPE_PRICE_PREMIUM,
                        enterprise: env_js_1.env.STRIPE_PRICE_ENTERPRISE,
                    };
                    return [4 /*yield*/, stripe_js_1.stripe.checkout.sessions.create(__assign(__assign({ mode: 'subscription', payment_method_types: ['card'], line_items: [{ price: priceMap[plan], quantity: 1 }], metadata: { userId: userId, plan: plan } }, (customerId ? { customer: customerId } : { customer_email: email })), { subscription_data: {
                                metadata: { userId: userId },
                            }, success_url: "".concat(env_js_1.env.APP_BASE_URL, "/dashboard/account?upgraded=1"), cancel_url: "".concat(env_js_1.env.APP_BASE_URL, "/dashboard/account?upgrade_cancelled=1"), allow_promotion_codes: true }))];
                case 1:
                    session = _a.sent();
                    if (!session.url)
                        throw new Error('Stripe did not return a checkout URL.');
                    return [2 /*return*/, { url: session.url }];
            }
        });
    });
}
// ─── WEBHOOK HANDLERS ─────────────────────────────────────────────────────────
/**
 * checkout.session.completed
 *
 * Fired when a user completes the Stripe Checkout flow.
 * Sets the user's plan, stripeCustomerId, stripeSubscriptionId, and
 * marks billing_status as 'active'.
 */
function handleCheckoutCompleted(session) {
    return __awaiter(this, void 0, void 0, function () {
        var userId, plan, customerId, subscriptionId;
        var _a, _b, _c, _d, _e, _f, _g;
        return __generator(this, function (_h) {
            switch (_h.label) {
                case 0:
                    userId = (_a = session.metadata) === null || _a === void 0 ? void 0 : _a['userId'];
                    if (!userId) {
                        throw new Error('checkout.session.completed: missing metadata.userId');
                    }
                    plan = (_c = (_b = session.metadata) === null || _b === void 0 ? void 0 : _b['plan']) !== null && _c !== void 0 ? _c : 'free';
                    customerId = typeof session.customer === 'string' ? session.customer : (_e = (_d = session.customer) === null || _d === void 0 ? void 0 : _d.id) !== null && _e !== void 0 ? _e : null;
                    subscriptionId = typeof session.subscription === 'string'
                        ? session.subscription
                        : (_g = (_f = session.subscription) === null || _f === void 0 ? void 0 : _f.id) !== null && _g !== void 0 ? _g : null;
                    return [4 /*yield*/, index_js_1.db
                            .update(index_js_2.users)
                            .set({
                            plan: plan,
                            stripeCustomerId: customerId,
                            stripeSubscriptionId: subscriptionId,
                            billingStatus: 'active',
                            paymentFailedAt: null,
                            suspendedAt: null,
                            accountStatus: 'active',
                        })
                            .where((0, drizzle_orm_1.eq)(index_js_2.users.id, userId))];
                case 1:
                    _h.sent();
                    return [4 /*yield*/, invalidateUserCacheByUserId(userId)];
                case 2:
                    _h.sent();
                    return [4 /*yield*/, (0, email_service_js_1.sendEmail)('payment_confirmed', undefined, { plan: plan }, false).catch(function () { })];
                case 3:
                    _h.sent();
                    return [2 /*return*/];
            }
        });
    });
}
/**
 * invoice.payment_succeeded
 *
 * Fired on every successful payment (recurring or first).
 * Clears any payment failure state and reactivates suspended accounts.
 */
function handleInvoicePaymentSucceeded(invoice) {
    return __awaiter(this, void 0, void 0, function () {
        var customerId, rows, user;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    customerId = typeof invoice.customer === 'string' ? invoice.customer : (_a = invoice.customer) === null || _a === void 0 ? void 0 : _a.id;
                    if (!customerId)
                        return [2 /*return*/];
                    return [4 /*yield*/, index_js_1.db
                            .select({ id: index_js_2.users.id, accountStatus: index_js_2.users.accountStatus, email: index_js_2.users.email })
                            .from(index_js_2.users)
                            .where((0, drizzle_orm_1.eq)(index_js_2.users.stripeCustomerId, customerId))
                            .limit(1)];
                case 1:
                    rows = _b.sent();
                    if (!rows.length)
                        return [2 /*return*/];
                    user = rows[0];
                    return [4 /*yield*/, index_js_1.db
                            .update(index_js_2.users)
                            .set({
                            billingStatus: 'active',
                            paymentFailedAt: null,
                            suspendedAt: null,
                            accountStatus: 'active',
                        })
                            .where((0, drizzle_orm_1.eq)(index_js_2.users.id, user.id))];
                case 2:
                    _b.sent();
                    return [4 /*yield*/, invalidateUserCacheByUserId(user.id)];
                case 3:
                    _b.sent();
                    if (!(user.accountStatus === 'suspended')) return [3 /*break*/, 5];
                    return [4 /*yield*/, (0, email_service_js_1.sendEmail)('account_reactivated', user.email, {}, false).catch(function () { })];
                case 4:
                    _b.sent();
                    _b.label = 5;
                case 5: return [2 /*return*/];
            }
        });
    });
}
/**
 * invoice.payment_failed
 *
 * Starts the 72-hour grace period. Sets billing_status to 'payment_failed'
 * and records the timestamp. The suspend-accounts cron job checks this
 * timestamp and suspends after 72 hours.
 */
function handleInvoicePaymentFailed(invoice) {
    return __awaiter(this, void 0, void 0, function () {
        var customerId, rows, user, now;
        var _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    customerId = typeof invoice.customer === 'string' ? invoice.customer : (_a = invoice.customer) === null || _a === void 0 ? void 0 : _a.id;
                    if (!customerId)
                        return [2 /*return*/];
                    return [4 /*yield*/, index_js_1.db
                            .select({ id: index_js_2.users.id, email: index_js_2.users.email, paymentFailedAt: index_js_2.users.paymentFailedAt })
                            .from(index_js_2.users)
                            .where((0, drizzle_orm_1.eq)(index_js_2.users.stripeCustomerId, customerId))
                            .limit(1)];
                case 1:
                    rows = _c.sent();
                    if (!rows.length)
                        return [2 /*return*/];
                    user = rows[0];
                    now = new Date();
                    return [4 /*yield*/, index_js_1.db
                            .update(index_js_2.users)
                            .set({
                            billingStatus: 'payment_failed',
                            paymentFailedAt: (_b = user.paymentFailedAt) !== null && _b !== void 0 ? _b : now,
                        })
                            .where((0, drizzle_orm_1.eq)(index_js_2.users.id, user.id))];
                case 2:
                    _c.sent();
                    return [4 /*yield*/, invalidateUserCacheByUserId(user.id)];
                case 3:
                    _c.sent();
                    return [4 /*yield*/, (0, email_service_js_1.sendEmail)('payment_failed', user.email, { gracePeriodHours: String(72) }, true).catch(function () { })];
                case 4:
                    _c.sent();
                    return [2 /*return*/];
            }
        });
    });
}
/**
 * customer.subscription.updated
 *
 * Handles plan upgrades/downgrades initiated via the Stripe Customer Portal.
 * Reads the first subscription item's price ID to determine the new plan.
 */
function handleSubscriptionUpdated(subscription) {
    return __awaiter(this, void 0, void 0, function () {
        var customerId, priceId, newPlan, rows;
        var _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    customerId = typeof subscription.customer === 'string'
                        ? subscription.customer
                        : (_a = subscription.customer) === null || _a === void 0 ? void 0 : _a.id;
                    if (!customerId)
                        return [2 /*return*/];
                    priceId = (_b = subscription.items.data[0]) === null || _b === void 0 ? void 0 : _b.price.id;
                    if (!priceId)
                        return [2 /*return*/];
                    newPlan = planFromPriceId(priceId);
                    if (!newPlan)
                        return [2 /*return*/]; // Unknown price — ignore
                    return [4 /*yield*/, index_js_1.db
                            .select({ id: index_js_2.users.id })
                            .from(index_js_2.users)
                            .where((0, drizzle_orm_1.eq)(index_js_2.users.stripeCustomerId, customerId))
                            .limit(1)];
                case 1:
                    rows = _c.sent();
                    if (!rows.length)
                        return [2 /*return*/];
                    return [4 /*yield*/, index_js_1.db
                            .update(index_js_2.users)
                            .set({ plan: newPlan })
                            .where((0, drizzle_orm_1.eq)(index_js_2.users.id, rows[0].id))];
                case 2:
                    _c.sent();
                    return [4 /*yield*/, invalidateUserCacheByUserId(rows[0].id)];
                case 3:
                    _c.sent();
                    return [2 /*return*/];
            }
        });
    });
}
/**
 * customer.subscription.deleted
 *
 * Subscription cancelled (end of period reached or immediate cancellation).
 * Downgrades user to free plan and clears subscription ID.
 */
function handleSubscriptionDeleted(subscription) {
    return __awaiter(this, void 0, void 0, function () {
        var customerId, rows, user;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    customerId = typeof subscription.customer === 'string'
                        ? subscription.customer
                        : (_a = subscription.customer) === null || _a === void 0 ? void 0 : _a.id;
                    if (!customerId)
                        return [2 /*return*/];
                    return [4 /*yield*/, index_js_1.db
                            .select({ id: index_js_2.users.id, email: index_js_2.users.email })
                            .from(index_js_2.users)
                            .where((0, drizzle_orm_1.eq)(index_js_2.users.stripeCustomerId, customerId))
                            .limit(1)];
                case 1:
                    rows = _b.sent();
                    if (!rows.length)
                        return [2 /*return*/];
                    user = rows[0];
                    return [4 /*yield*/, index_js_1.db
                            .update(index_js_2.users)
                            .set({
                            plan: 'free',
                            stripeSubscriptionId: null,
                            billingStatus: 'active',
                            paymentFailedAt: null,
                            suspendedAt: null,
                            accountStatus: 'active',
                        })
                            .where((0, drizzle_orm_1.eq)(index_js_2.users.id, user.id))];
                case 2:
                    _b.sent();
                    return [4 /*yield*/, invalidateUserCacheByUserId(user.id)];
                case 3:
                    _b.sent();
                    return [4 /*yield*/, (0, email_service_js_1.sendEmail)('subscription_cancelled', user.email, {}, false).catch(function () { })];
                case 4:
                    _b.sent();
                    return [2 /*return*/];
            }
        });
    });
}
// ─── HELPERS ──────────────────────────────────────────────────────────────────
/**
 * Invalidate the Redis auth cache for a user by their internal userId.
 * Must look up the active API key hash to know which cache entry to bust.
 */
function invalidateUserCacheByUserId(userId) {
    return __awaiter(this, void 0, void 0, function () {
        var apiKeys, _a, eqInner, and, keyRows;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, Promise.resolve().then(function () { return __importStar(require('../db/schema/index.js')); })];
                case 1:
                    apiKeys = (_b.sent()).apiKeys;
                    return [4 /*yield*/, Promise.resolve().then(function () { return __importStar(require('drizzle-orm')); })];
                case 2:
                    _a = _b.sent(), eqInner = _a.eq, and = _a.and;
                    return [4 /*yield*/, index_js_1.db
                            .select({ keyHash: apiKeys.keyHash })
                            .from(apiKeys)
                            .where(eqInner(apiKeys.userId, userId))];
                case 3:
                    keyRows = _b.sent();
                    return [4 /*yield*/, Promise.all(keyRows.map(function (r) { return (0, index_js_3.invalidateAuthCache)(r.keyHash); }))];
                case 4:
                    _b.sent();
                    return [2 /*return*/];
            }
        });
    });
}
