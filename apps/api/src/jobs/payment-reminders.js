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
exports.runPaymentReminders = runPaymentReminders;
/**
 * jobs/payment-reminders.ts — Payment failure reminder emails.
 *
 * Runs every hour. Sends reminder emails at two points during the
 * 72-hour grace period:
 *
 *   24h after payment_failed_at — first reminder
 *   48h after payment_failed_at — final reminder (24h before suspension)
 *
 * Deduplication is handled by email.service.ts (isDuplicate checks the
 * email_log for the same userId + eventType within 23 hours), so it is
 * safe to run this job more frequently than once per hour if needed.
 *
 * Only runs for accounts that are still in payment_failed status and
 * have NOT yet been suspended.
 */
var drizzle_orm_1 = require("drizzle-orm");
var index_js_1 = require("../db/index.js");
var index_js_2 = require("../db/schema/index.js");
var email_service_js_1 = require("../services/email.service.js");
var constants_js_1 = require("@vinstub/shared/constants.js");
var REMINDER_WINDOWS = [
    { afterHours: 24, eventType: 'payment_reminder_24h' },
    { afterHours: 48, eventType: 'payment_reminder_48h' },
];
function runPaymentReminders() {
    return __awaiter(this, void 0, void 0, function () {
        var now, REMINDER_WINDOWS_1, REMINDER_WINDOWS_1_1, window_1, windowStart, windowEnd, graceCutoff, accounts, accounts_1, accounts_1_1, account, hoursRemaining, err_1, e_1_1, e_2_1;
        var e_2, _a, e_1, _b;
        var _c, _d;
        return __generator(this, function (_e) {
            switch (_e.label) {
                case 0:
                    now = Date.now();
                    _e.label = 1;
                case 1:
                    _e.trys.push([1, 15, 16, 17]);
                    REMINDER_WINDOWS_1 = __values(REMINDER_WINDOWS), REMINDER_WINDOWS_1_1 = REMINDER_WINDOWS_1.next();
                    _e.label = 2;
                case 2:
                    if (!!REMINDER_WINDOWS_1_1.done) return [3 /*break*/, 14];
                    window_1 = REMINDER_WINDOWS_1_1.value;
                    windowStart = new Date(now - window_1.afterHours * 60 * 60 * 1000 - 60 * 60 * 1000);
                    windowEnd = new Date(now - window_1.afterHours * 60 * 60 * 1000);
                    graceCutoff = new Date(now - constants_js_1.PAYMENT_GRACE_PERIOD_HOURS * 60 * 60 * 1000);
                    return [4 /*yield*/, index_js_1.db
                            .select({ id: index_js_2.users.id, email: index_js_2.users.email, paymentFailedAt: index_js_2.users.paymentFailedAt })
                            .from(index_js_2.users)
                            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(index_js_2.users.billingStatus, 'payment_failed'), (0, drizzle_orm_1.ne)(index_js_2.users.accountStatus, 'suspended'), (0, drizzle_orm_1.isNotNull)(index_js_2.users.paymentFailedAt), (0, drizzle_orm_1.gte)(index_js_2.users.paymentFailedAt, windowStart), (0, drizzle_orm_1.lt)(index_js_2.users.paymentFailedAt, windowEnd), 
                        // Only within the grace period (not yet overdue for suspension)
                        (0, drizzle_orm_1.gte)(index_js_2.users.paymentFailedAt, graceCutoff)))];
                case 3:
                    accounts = _e.sent();
                    if (accounts.length === 0)
                        return [3 /*break*/, 13];
                    console.log("[payment-reminders] sending ".concat(window_1.eventType, " to ").concat(accounts.length, " account(s)"));
                    _e.label = 4;
                case 4:
                    _e.trys.push([4, 11, 12, 13]);
                    accounts_1 = (e_1 = void 0, __values(accounts)), accounts_1_1 = accounts_1.next();
                    _e.label = 5;
                case 5:
                    if (!!accounts_1_1.done) return [3 /*break*/, 10];
                    account = accounts_1_1.value;
                    _e.label = 6;
                case 6:
                    _e.trys.push([6, 8, , 9]);
                    hoursRemaining = Math.max(0, Math.round(constants_js_1.PAYMENT_GRACE_PERIOD_HOURS -
                        (now - ((_d = (_c = account.paymentFailedAt) === null || _c === void 0 ? void 0 : _c.getTime()) !== null && _d !== void 0 ? _d : now)) / (60 * 60 * 1000)));
                    return [4 /*yield*/, (0, email_service_js_1.sendEmail)(window_1.eventType, account.email, { hoursRemaining: String(hoursRemaining), gracePeriodHours: String(constants_js_1.PAYMENT_GRACE_PERIOD_HOURS) }, true)];
                case 7:
                    _e.sent();
                    return [3 /*break*/, 9];
                case 8:
                    err_1 = _e.sent();
                    console.error("[payment-reminders] failed for user ".concat(account.id, ":"), err_1);
                    return [3 /*break*/, 9];
                case 9:
                    accounts_1_1 = accounts_1.next();
                    return [3 /*break*/, 5];
                case 10: return [3 /*break*/, 13];
                case 11:
                    e_1_1 = _e.sent();
                    e_1 = { error: e_1_1 };
                    return [3 /*break*/, 13];
                case 12:
                    try {
                        if (accounts_1_1 && !accounts_1_1.done && (_b = accounts_1.return)) _b.call(accounts_1);
                    }
                    finally { if (e_1) throw e_1.error; }
                    return [7 /*endfinally*/];
                case 13:
                    REMINDER_WINDOWS_1_1 = REMINDER_WINDOWS_1.next();
                    return [3 /*break*/, 2];
                case 14: return [3 /*break*/, 17];
                case 15:
                    e_2_1 = _e.sent();
                    e_2 = { error: e_2_1 };
                    return [3 /*break*/, 17];
                case 16:
                    try {
                        if (REMINDER_WINDOWS_1_1 && !REMINDER_WINDOWS_1_1.done && (_a = REMINDER_WINDOWS_1.return)) _a.call(REMINDER_WINDOWS_1);
                    }
                    finally { if (e_2) throw e_2.error; }
                    return [7 /*endfinally*/];
                case 17: return [2 /*return*/];
            }
        });
    });
}
