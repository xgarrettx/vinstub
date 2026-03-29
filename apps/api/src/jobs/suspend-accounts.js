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
exports.runSuspendAccounts = runSuspendAccounts;
/**
 * jobs/suspend-accounts.ts — Grace period enforcement cron.
 *
 * Runs every 15 minutes. Finds all accounts where:
 *   - billing_status = 'payment_failed'
 *   - payment_failed_at < NOW() - 72 hours
 *   - account_status != 'suspended' (not already processed)
 *
 * For each matching account:
 *   1. Sets account_status = 'suspended', suspended_at = NOW()
 *   2. Invalidates Redis auth cache (immediate lockout)
 *   3. Sends suspension notification email
 *
 * Accounts are automatically reactivated by the
 * handleInvoicePaymentSucceeded webhook handler when Stripe processes
 * a successful payment.
 */
var drizzle_orm_1 = require("drizzle-orm");
var index_js_1 = require("../db/index.js");
var index_js_2 = require("../db/schema/index.js");
var index_js_3 = require("../redis/index.js");
var email_service_js_1 = require("../services/email.service.js");
var constants_js_1 = require("@vinstub/shared/constants.js");
function runSuspendAccounts() {
    return __awaiter(this, void 0, void 0, function () {
        var cutoff, staleAccounts, staleAccounts_1, staleAccounts_1_1, account, now, keyRows, err_1, e_1_1;
        var e_1, _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    cutoff = new Date(Date.now() - constants_js_1.PAYMENT_GRACE_PERIOD_HOURS * 60 * 60 * 1000);
                    return [4 /*yield*/, index_js_1.db
                            .select({
                            id: index_js_2.users.id,
                            email: index_js_2.users.email,
                        })
                            .from(index_js_2.users)
                            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(index_js_2.users.billingStatus, 'payment_failed'), (0, drizzle_orm_1.ne)(index_js_2.users.accountStatus, 'suspended'), (0, drizzle_orm_1.isNotNull)(index_js_2.users.paymentFailedAt), (0, drizzle_orm_1.lt)(index_js_2.users.paymentFailedAt, cutoff)))];
                case 1:
                    staleAccounts = _b.sent();
                    if (staleAccounts.length === 0)
                        return [2 /*return*/];
                    console.log("[suspend-accounts] suspending ".concat(staleAccounts.length, " account(s)"));
                    _b.label = 2;
                case 2:
                    _b.trys.push([2, 12, 13, 14]);
                    staleAccounts_1 = __values(staleAccounts), staleAccounts_1_1 = staleAccounts_1.next();
                    _b.label = 3;
                case 3:
                    if (!!staleAccounts_1_1.done) return [3 /*break*/, 11];
                    account = staleAccounts_1_1.value;
                    _b.label = 4;
                case 4:
                    _b.trys.push([4, 9, , 10]);
                    now = new Date();
                    // 1. Mark as suspended
                    return [4 /*yield*/, index_js_1.db
                            .update(index_js_2.users)
                            .set({ accountStatus: 'suspended', suspendedAt: now })
                            .where((0, drizzle_orm_1.eq)(index_js_2.users.id, account.id))];
                case 5:
                    // 1. Mark as suspended
                    _b.sent();
                    return [4 /*yield*/, index_js_1.db
                            .select({ keyHash: index_js_2.apiKeys.keyHash })
                            .from(index_js_2.apiKeys)
                            .where((0, drizzle_orm_1.eq)(index_js_2.apiKeys.userId, account.id))];
                case 6:
                    keyRows = _b.sent();
                    return [4 /*yield*/, Promise.all(keyRows.map(function (k) { return (0, index_js_3.invalidateAuthCache)(k.keyHash); }))];
                case 7:
                    _b.sent();
                    // 3. Send notification email
                    return [4 /*yield*/, (0, email_service_js_1.sendEmail)('account_suspended', account.email, {}, false)];
                case 8:
                    // 3. Send notification email
                    _b.sent();
                    console.log("[suspend-accounts] suspended user ".concat(account.id));
                    return [3 /*break*/, 10];
                case 9:
                    err_1 = _b.sent();
                    console.error("[suspend-accounts] failed for user ".concat(account.id, ":"), err_1);
                    return [3 /*break*/, 10];
                case 10:
                    staleAccounts_1_1 = staleAccounts_1.next();
                    return [3 /*break*/, 3];
                case 11: return [3 /*break*/, 14];
                case 12:
                    e_1_1 = _b.sent();
                    e_1 = { error: e_1_1 };
                    return [3 /*break*/, 14];
                case 13:
                    try {
                        if (staleAccounts_1_1 && !staleAccounts_1_1.done && (_a = staleAccounts_1.return)) _a.call(staleAccounts_1);
                    }
                    finally { if (e_1) throw e_1.error; }
                    return [7 /*endfinally*/];
                case 14: return [2 /*return*/];
            }
        });
    });
}
