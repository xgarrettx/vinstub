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
exports.sendEmail = sendEmail;
/**
 * services/email.service.ts — Resend wrapper + email dispatch.
 *
 * All email sending goes through sendEmail(). Template rendering is
 * handled inline here for MVP — move to packages/email-templates once
 * the templates need complex styling.
 *
 * Deduplication: before sending any billing email, we check email_log
 * for the same (userId, eventType) within the last 23 hours.
 *
 * eventType values (matches email_log.event_type column):
 *   verify_email | welcome | payment_failed_0h | payment_failed_24h |
 *   payment_failed_48h | account_suspended | account_reactivated |
 *   subscription_changed | subscription_cancelled | password_reset
 */
var resend_1 = require("resend");
var drizzle_orm_1 = require("drizzle-orm");
var index_js_1 = require("../db/index.js");
var index_js_2 = require("../db/schema/index.js");
var env_js_1 = require("../config/env.js");
var resend = new resend_1.Resend(env_js_1.env.RESEND_API_KEY);
var FROM = "".concat(env_js_1.env.RESEND_FROM_NAME, " <").concat(env_js_1.env.RESEND_FROM_ADDRESS, ">");
// ─── DEDUPLICATION CHECK ──────────────────────────────────────────────────────
/** Returns true if this eventType was already sent to userId within 23 hours. */
function isDuplicate(userId, eventType) {
    return __awaiter(this, void 0, void 0, function () {
        var cutoff, rows;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    cutoff = new Date(Date.now() - 23 * 60 * 60 * 1000);
                    return [4 /*yield*/, index_js_1.db
                            .select({ id: index_js_2.emailLog.id })
                            .from(index_js_2.emailLog)
                            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(index_js_2.emailLog.userId, userId), (0, drizzle_orm_1.eq)(index_js_2.emailLog.eventType, eventType), (0, drizzle_orm_1.gte)(index_js_2.emailLog.sentAt, cutoff)))
                            .limit(1)];
                case 1:
                    rows = _a.sent();
                    return [2 /*return*/, rows.length > 0];
            }
        });
    });
}
/** Log a sent email to email_log for deduplication and admin visibility. */
function logEmail(userId, eventType, resendId) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, index_js_1.db.insert(index_js_2.emailLog).values({
                        userId: userId,
                        eventType: eventType,
                        resendId: resendId !== null && resendId !== void 0 ? resendId : null,
                        status: 'sent',
                    })];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
function buildTemplate(eventType, data) {
    var _a, _b;
    var appUrl = env_js_1.env.APP_URL;
    switch (eventType) {
        case 'verify_email':
            return {
                subject: 'Verify your VINSTUB.com account',
                html: "<p>Thanks for signing up! Click the link below to verify your email address and get your API key.</p>\n               <p><a href=\"".concat(appUrl, "/auth/verify-email?token=").concat(data.token, "\">Verify my email address</a></p>\n               <p>This link expires in 24 hours.</p>"),
                text: "Verify your email: ".concat(appUrl, "/auth/verify-email?token=").concat(data.token, "\n\nThis link expires in 24 hours."),
            };
        case 'welcome':
            return {
                subject: 'Welcome to VINSTUB.com — your API key is ready',
                html: "<p>Your email has been verified and your API key has been generated.</p>\n               <p>Log in to your dashboard to view and copy your key: <a href=\"".concat(appUrl, "/dashboard\">").concat(appUrl, "/dashboard</a></p>\n               <p>API documentation: <a href=\"https://docs.vinstub.com\">docs.vinstub.com</a></p>"),
                text: "Your API key is ready. View it at: ".concat(appUrl, "/dashboard\nDocs: https://docs.vinstub.com"),
            };
        case 'payment_failed_0h':
            return {
                subject: 'Action required: payment failed on your VINSTUB.com account',
                html: "<p>We were unable to process your most recent payment.</p>\n               <p>Your API access remains active for the next 72 hours. Please update your payment method to avoid interruption.</p>\n               <p><a href=\"".concat(appUrl, "/dashboard/billing\">Update payment method</a></p>"),
                text: "Payment failed. Update your billing info within 72 hours: ".concat(appUrl, "/dashboard/billing"),
            };
        case 'payment_failed_24h':
            return {
                subject: 'Reminder: your VINSTUB.com account is at risk',
                html: "<p>We still haven't received payment for your subscription.</p>\n               <p>Your account will be suspended in 48 hours if payment is not resolved.</p>\n               <p><a href=\"".concat(appUrl, "/dashboard/billing\">Resolve now</a></p>"),
                text: "Payment still outstanding. Account suspension in 48h: ".concat(appUrl, "/dashboard/billing"),
            };
        case 'payment_failed_48h':
            return {
                subject: 'Final warning: VINSTUB.com account suspension in 24 hours',
                html: "<p><strong>Your account will be suspended in 24 hours</strong> if payment is not resolved.</p>\n               <p>Once suspended, all API requests will return HTTP 403 until payment is recovered.</p>\n               <p><a href=\"".concat(appUrl, "/dashboard/billing\">Update payment method immediately</a></p>"),
                text: "FINAL WARNING: Account suspended in 24h. Resolve at: ".concat(appUrl, "/dashboard/billing"),
            };
        case 'account_suspended':
            return {
                subject: 'Your VINSTUB.com account has been suspended',
                html: "<p>Your account has been suspended due to an unresolved payment failure.</p>\n               <p>All API requests are currently blocked. To reactivate, please update your payment method.</p>\n               <p><a href=\"".concat(appUrl, "/dashboard/billing\">Reactivate account</a></p>"),
                text: "Account suspended. Reactivate at: ".concat(appUrl, "/dashboard/billing"),
            };
        case 'account_reactivated':
            return {
                subject: 'Your VINSTUB.com account is reactivated',
                html: "<p>Your payment has been processed and your account is fully active again.</p>\n               <p>API access has been restored. <a href=\"".concat(appUrl, "/dashboard\">View your dashboard</a></p>"),
                text: "Account reactivated. API access restored. Dashboard: ".concat(appUrl, "/dashboard"),
            };
        case 'subscription_changed':
            return {
                subject: "Your VINSTUB.com plan has been updated to ".concat((_a = data.newPlan) !== null && _a !== void 0 ? _a : 'a new plan'),
                html: "<p>Your subscription has been updated.</p>\n               <p>New plan: <strong>".concat((_b = data.newPlan) !== null && _b !== void 0 ? _b : 'unknown', "</strong></p>\n               <p><a href=\"").concat(appUrl, "/dashboard\">View your dashboard</a></p>"),
                text: "Plan updated to ".concat(data.newPlan, ". Dashboard: ").concat(appUrl, "/dashboard"),
            };
        case 'subscription_cancelled':
            return {
                subject: 'Your VINSTUB.com subscription has been cancelled',
                html: "<p>Your subscription has been cancelled. You will retain access until the end of your current billing period.</p>\n               <p>After that, your account will revert to the Free plan (50 queries/day).</p>\n               <p>You can reactivate at any time from your <a href=\"".concat(appUrl, "/dashboard/billing\">billing settings</a>.</p>"),
                text: "Subscription cancelled. Reverts to Free plan at period end. Reactivate: ".concat(appUrl, "/dashboard/billing"),
            };
        case 'password_reset':
            return {
                subject: 'Reset your VINSTUB.com password',
                html: "<p>We received a request to reset your password.</p>\n               <p><a href=\"".concat(appUrl, "/auth/reset-password?token=").concat(data.token, "\">Reset my password</a></p>\n               <p>This link expires in 1 hour. If you didn't request this, you can safely ignore this email.</p>"),
                text: "Reset your password: ".concat(appUrl, "/auth/reset-password?token=").concat(data.token, "\n\nExpires in 1 hour."),
            };
        default:
            throw new Error("Unknown email event type: ".concat(eventType));
    }
}
// ─── MAIN SEND FUNCTION ───────────────────────────────────────────────────────
/**
 * Send a transactional email.
 *
 * @param eventType  - identifies which template to use and is logged to email_log
 * @param toEmail    - recipient address (pass undefined to look up by userId)
 * @param data       - template variables (token, newPlan, etc.)
 * @param deduplicate - if true (default for billing emails), skip if sent within 23h
 */
function sendEmail(eventType_1, toEmail_1) {
    return __awaiter(this, arguments, void 0, function (eventType, toEmail, data, deduplicate) {
        var recipientEmail, rows, dup, template, resendId, result, err_1;
        var _a, _b, _c;
        if (data === void 0) { data = {}; }
        if (deduplicate === void 0) { deduplicate = false; }
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0:
                    recipientEmail = toEmail;
                    if (!(!recipientEmail && data.userId)) return [3 /*break*/, 2];
                    return [4 /*yield*/, index_js_1.db
                            .select({ email: index_js_2.users.email })
                            .from(index_js_2.users)
                            .where((0, drizzle_orm_1.eq)(index_js_2.users.id, data.userId))
                            .limit(1)];
                case 1:
                    rows = _d.sent();
                    if (rows.length > 0)
                        recipientEmail = rows[0].email;
                    _d.label = 2;
                case 2:
                    if (!recipientEmail) {
                        console.error("[email] cannot resolve recipient for event=".concat(eventType));
                        return [2 /*return*/];
                    }
                    if (!(deduplicate && data.userId)) return [3 /*break*/, 4];
                    return [4 /*yield*/, isDuplicate(data.userId, eventType)];
                case 3:
                    dup = _d.sent();
                    if (dup) {
                        console.log("[email] skipping duplicate event=".concat(eventType, " userId=").concat(data.userId));
                        return [2 /*return*/];
                    }
                    _d.label = 4;
                case 4:
                    template = buildTemplate(eventType, data);
                    _d.label = 5;
                case 5:
                    _d.trys.push([5, 7, , 9]);
                    return [4 /*yield*/, resend.emails.send({
                            from: FROM,
                            to: recipientEmail,
                            subject: template.subject,
                            html: template.html,
                            text: template.text,
                        })];
                case 6:
                    result = _d.sent();
                    resendId = (_a = result.data) === null || _a === void 0 ? void 0 : _a.id;
                    return [3 /*break*/, 9];
                case 7:
                    err_1 = _d.sent();
                    console.error("[email] send failed event=".concat(eventType, " to=").concat(recipientEmail, ":"), err_1);
                    // Log failure but don't throw — email failures should not crash API requests
                    return [4 /*yield*/, logEmail((_b = data.userId) !== null && _b !== void 0 ? _b : null, eventType, undefined)
                            .catch(function () { return undefined; })];
                case 8:
                    // Log failure but don't throw — email failures should not crash API requests
                    _d.sent();
                    return [2 /*return*/];
                case 9: 
                // Log successful send
                return [4 /*yield*/, logEmail((_c = data.userId) !== null && _c !== void 0 ? _c : null, eventType, resendId)
                        .catch(function (err) { return console.error('[email] failed to log email:', err); })];
                case 10:
                    // Log successful send
                    _d.sent();
                    return [2 /*return*/];
            }
        });
    });
}
