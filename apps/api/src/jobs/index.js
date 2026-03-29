"use strict";
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startJobs = startJobs;
exports.stopJobs = stopJobs;
/**
 * jobs/index.ts — Background job scheduler.
 *
 * Starts all background jobs using node-cron. Meant to be called once
 * during server bootstrap, after the DB and Redis connections are ready.
 *
 * Jobs:
 *   sync-usage        — every 60 seconds  — Redis → Postgres usage sync
 *   suspend-accounts  — every 15 minutes  — grace period enforcement
 *   payment-reminders — every hour        — reminder emails
 *
 * Each job wraps its handler in a try/catch so one failing job cannot
 * crash the scheduler. Errors are logged to stderr (Sentry picks these up
 * via the unhandled exception integration set in server.ts).
 *
 * On SIGTERM/SIGINT, all scheduled tasks are destroyed so the process can
 * exit cleanly. The server.ts shutdown sequence calls stopJobs().
 */
var node_cron_1 = __importDefault(require("node-cron"));
var sync_usage_js_1 = require("./sync-usage.js");
var suspend_accounts_js_1 = require("./suspend-accounts.js");
var payment_reminders_js_1 = require("./payment-reminders.js");
var tasks = [];
function startJobs() {
    // Usage sync — every 60 seconds
    tasks.push(node_cron_1.default.schedule('* * * * *', function () {
        (0, sync_usage_js_1.runSyncUsage)().catch(function (err) {
            return console.error('[jobs] sync-usage failed:', err);
        });
    }));
    // Suspend accounts — every 15 minutes
    tasks.push(node_cron_1.default.schedule('*/15 * * * *', function () {
        (0, suspend_accounts_js_1.runSuspendAccounts)().catch(function (err) {
            return console.error('[jobs] suspend-accounts failed:', err);
        });
    }));
    // Payment reminder emails — every hour at :05 past the hour
    tasks.push(node_cron_1.default.schedule('5 * * * *', function () {
        (0, payment_reminders_js_1.runPaymentReminders)().catch(function (err) {
            return console.error('[jobs] payment-reminders failed:', err);
        });
    }));
    console.log("[jobs] started ".concat(tasks.length, " background jobs"));
}
function stopJobs() {
    var e_1, _a;
    try {
        for (var tasks_1 = __values(tasks), tasks_1_1 = tasks_1.next(); !tasks_1_1.done; tasks_1_1 = tasks_1.next()) {
            var task = tasks_1_1.value;
            task.destroy();
        }
    }
    catch (e_1_1) { e_1 = { error: e_1_1 }; }
    finally {
        try {
            if (tasks_1_1 && !tasks_1_1.done && (_a = tasks_1.return)) _a.call(tasks_1);
        }
        finally { if (e_1) throw e_1.error; }
    }
    tasks = [];
    console.log('[jobs] all background jobs stopped');
}
