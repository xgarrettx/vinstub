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
exports.rateLimitMiddleware = void 0;
var rate_limit_service_js_1 = require("../services/rate-limit.service.js");
var constants_js_1 = require("@vinstub/shared/constants.js");
var rateLimitMiddleware = function (request, reply) { return __awaiter(void 0, void 0, void 0, function () {
    var user, decision, limits, rateLimitData, reason, retryAfter, message;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                user = request.user;
                // Should never happen — bearerAuth must run first. Defensive check.
                if (!user) {
                    return [2 /*return*/, reply.status(401).send({
                            success: false,
                            error: 'unauthorized',
                            message: 'Authentication required.',
                            request_id: request.id,
                        })];
                }
                // Suspended accounts: caught by bearerAuth, but double-check here as a
                // safety net in case account status changed mid-session.
                if (user.accountStatus !== 'active') {
                    return [2 /*return*/, reply.status(403).send({
                            success: false,
                            error: 'account_suspended',
                            message: 'Your account has been suspended. Please resolve any outstanding balance.',
                            request_id: request.id,
                        })];
                }
                return [4 /*yield*/, (0, rate_limit_service_js_1.checkRateLimit)(user.userId, user.plan)];
            case 1:
                decision = _a.sent();
                limits = constants_js_1.PLAN_LIMITS[user.plan];
                rateLimitData = {
                    dayCount: decision.counters.dayCount,
                    hourCount: decision.counters.hourCount,
                    minuteCount: decision.counters.minuteCount,
                    limits: limits,
                    softCapExceeded: decision.softCapExceeded,
                    dailyResetAt: decision.dailyResetAt,
                    minuteResetAt: decision.minuteResetAt,
                };
                request.rateLimitData = rateLimitData;
                if (!decision.allowed) {
                    reason = decision.blockReason;
                    retryAfter = void 0;
                    message = void 0;
                    switch (reason) {
                        case 'minute_limit':
                            retryAfter = decision.minuteResetAt - Math.floor(Date.now() / 1000);
                            message = "Per-minute rate limit exceeded (".concat(limits.perMinute, " req/min). ") +
                                "Retry after ".concat(retryAfter, " seconds.");
                            break;
                        case 'hour_limit':
                            retryAfter = Math.floor(Date.now() / 1000 / 3600) * 3600 + 3600 - Math.floor(Date.now() / 1000);
                            message = "Per-hour rate limit exceeded (".concat(limits.perHour, " req/hr). ") +
                                "Retry after ".concat(retryAfter, " seconds.");
                            break;
                        case 'day_limit':
                            retryAfter = decision.dailyResetAt - Math.floor(Date.now() / 1000);
                            message = "Daily quota exhausted (".concat(limits.daily, " req/day on the ").concat(user.plan, " plan). ") +
                                "Quota resets at midnight UTC. Upgrade your plan for higher limits.";
                            break;
                        default:
                            retryAfter = 60;
                            message = 'Rate limit exceeded.';
                    }
                    reply.header('Retry-After', String(Math.max(1, retryAfter)));
                    reply.header('X-RateLimit-Limit-Day', String(limits.daily));
                    reply.header('X-RateLimit-Remaining-Day', String(Math.max(0, limits.daily - decision.counters.dayCount)));
                    reply.header('X-RateLimit-Reset-Day', String(decision.dailyResetAt));
                    reply.header('X-RateLimit-Limit-Minute', String(limits.perMinute));
                    reply.header('X-RateLimit-Remaining-Minute', String(0));
                    reply.header('X-RateLimit-Reset-Minute', String(decision.minuteResetAt));
                    return [2 /*return*/, reply.status(429).send({
                            success: false,
                            error: 'rate_limited',
                            message: message,
                            request_id: request.id,
                            retry_after: Math.max(1, retryAfter),
                        })];
                }
                return [2 /*return*/];
        }
    });
}); };
exports.rateLimitMiddleware = rateLimitMiddleware;
