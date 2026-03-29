"use strict";
var __makeTemplateObject = (this && this.__makeTemplateObject) || function (cooked, raw) {
    if (Object.defineProperty) { Object.defineProperty(cooked, "raw", { value: raw }); } else { cooked.raw = raw; }
    return cooked;
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
var __read = (this && this.__read) || function (o, n) {
    var m = typeof Symbol === "function" && o[Symbol.iterator];
    if (!m) return o;
    var i = m.call(o), r, ar = [], e;
    try {
        while ((n === void 0 || n-- > 0) && !(r = i.next()).done) ar.push(r.value);
    }
    catch (error) { e = { error: error }; }
    finally {
        try {
            if (r && !r.done && (m = i["return"])) m.call(i);
        }
        finally { if (e) throw e.error; }
    }
    return ar;
};
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
var drizzle_orm_1 = require("drizzle-orm");
var admin_auth_js_1 = require("../../middleware/admin-auth.js");
var index_js_1 = require("../../db/index.js");
var index_js_2 = require("../../db/schema/index.js");
var index_js_3 = require("../../redis/index.js");
var rate_limit_service_js_1 = require("../../services/rate-limit.service.js");
var VALID_PLANS = ['free', 'basic', 'premium', 'enterprise'];
var adminRoutes = function (fastify) { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        // Apply admin auth to every route in this plugin
        fastify.addHook('preHandler', admin_auth_js_1.adminAuth);
        // ─── GET /admin/users ──────────────────────────────────────────────────────
        fastify.get('/users', {
            schema: {
                tags: ['Admin'],
                querystring: {
                    type: 'object',
                    properties: {
                        limit: { type: 'integer', minimum: 1, maximum: 100, default: 50 },
                        offset: { type: 'integer', minimum: 0, default: 0 },
                        plan: { type: 'string', enum: VALID_PLANS },
                        status: { type: 'string', enum: ['active', 'suspended', 'unverified'] },
                    },
                },
            },
        }, function (request, reply) { return __awaiter(void 0, void 0, void 0, function () {
            var _a, _b, limit, _c, offset, plan, status, conditions, rows, _d, countResult;
            var _e;
            return __generator(this, function (_f) {
                switch (_f.label) {
                    case 0:
                        _a = request.query, _b = _a.limit, limit = _b === void 0 ? 50 : _b, _c = _a.offset, offset = _c === void 0 ? 0 : _c, plan = _a.plan, status = _a.status;
                        conditions = [];
                        if (plan)
                            conditions.push((0, drizzle_orm_1.eq)(index_js_2.users.plan, plan));
                        if (status === 'suspended')
                            conditions.push((0, drizzle_orm_1.eq)(index_js_2.users.accountStatus, 'suspended'));
                        if (status === 'unverified')
                            conditions.push((0, drizzle_orm_1.eq)(index_js_2.users.emailVerified, false));
                        if (status === 'active')
                            conditions.push((0, drizzle_orm_1.eq)(index_js_2.users.accountStatus, 'active'));
                        return [4 /*yield*/, index_js_1.db
                                .select({
                                id: index_js_2.users.id,
                                email: index_js_2.users.email,
                                plan: index_js_2.users.plan,
                                accountStatus: index_js_2.users.accountStatus,
                                billingStatus: index_js_2.users.billingStatus,
                                emailVerified: index_js_2.users.emailVerified,
                                createdAt: index_js_2.users.createdAt,
                                paymentFailedAt: index_js_2.users.paymentFailedAt,
                                suspendedAt: index_js_2.users.suspendedAt,
                            })
                                .from(index_js_2.users)
                                .where(conditions.length ? drizzle_orm_1.and.apply(void 0, __spreadArray([], __read(conditions), false)) : undefined)
                                .orderBy((0, drizzle_orm_1.desc)(index_js_2.users.createdAt))
                                .limit(limit)
                                .offset(offset)];
                    case 1:
                        rows = _f.sent();
                        return [4 /*yield*/, index_js_1.db
                                .select({ count: (0, drizzle_orm_1.sql)(templateObject_1 || (templateObject_1 = __makeTemplateObject(["COUNT(*)"], ["COUNT(*)"]))) })
                                .from(index_js_2.users)
                                .where(conditions.length ? drizzle_orm_1.and.apply(void 0, __spreadArray([], __read(conditions), false)) : undefined)];
                    case 2:
                        _d = __read.apply(void 0, [_f.sent(), 1]), countResult = _d[0];
                        return [2 /*return*/, reply.status(200).send({
                                success: true,
                                data: rows,
                                total: Number((_e = countResult === null || countResult === void 0 ? void 0 : countResult.count) !== null && _e !== void 0 ? _e : 0),
                                limit: limit,
                                offset: offset,
                            })];
                }
            });
        }); });
        // ─── GET /admin/users/:id ──────────────────────────────────────────────────
        fastify.get('/users/:id', {
            schema: { tags: ['Admin'], params: { type: 'object', properties: { id: { type: 'string' } } } },
        }, function (request, reply) { return __awaiter(void 0, void 0, void 0, function () {
            var id, userRows, keyRows, since, usageRows, totalLast30;
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        id = request.params.id;
                        return [4 /*yield*/, index_js_1.db
                                .select()
                                .from(index_js_2.users)
                                .where((0, drizzle_orm_1.eq)(index_js_2.users.id, id))
                                .limit(1)];
                    case 1:
                        userRows = _b.sent();
                        if (!userRows.length) {
                            return [2 /*return*/, reply.status(404).send({ success: false, error: 'not_found', message: 'User not found.' })];
                        }
                        return [4 /*yield*/, index_js_1.db
                                .select({ keyPrefix: index_js_2.apiKeys.keyPrefix, createdAt: index_js_2.apiKeys.createdAt, lastUsedAt: index_js_2.apiKeys.lastUsedAt })
                                .from(index_js_2.apiKeys)
                                .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(index_js_2.apiKeys.userId, id), (0, drizzle_orm_1.eq)(index_js_2.apiKeys.isActive, true)))
                                .limit(1)];
                    case 2:
                        keyRows = _b.sent();
                        since = new Date();
                        since.setDate(since.getDate() - 30);
                        return [4 /*yield*/, index_js_1.db
                                .select({ date: index_js_2.apiUsageDaily.date, count: index_js_2.apiUsageDaily.queryCount })
                                .from(index_js_2.apiUsageDaily)
                                .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(index_js_2.apiUsageDaily.userId, id), (0, drizzle_orm_1.gte)(index_js_2.apiUsageDaily.date, since.toISOString().slice(0, 10))))
                                .orderBy((0, drizzle_orm_1.desc)(index_js_2.apiUsageDaily.date))];
                    case 3:
                        usageRows = _b.sent();
                        totalLast30 = usageRows.reduce(function (s, r) { return s + r.count; }, 0);
                        return [2 /*return*/, reply.status(200).send({
                                success: true,
                                data: {
                                    user: userRows[0],
                                    activeKey: (_a = keyRows[0]) !== null && _a !== void 0 ? _a : null,
                                    usageLast30Days: usageRows,
                                    totalRequestsLast30Days: totalLast30,
                                },
                            })];
                }
            });
        }); });
        // ─── PATCH /admin/users/:id/plan ──────────────────────────────────────────
        fastify.patch('/users/:id/plan', {
            schema: {
                tags: ['Admin'],
                params: { type: 'object', properties: { id: { type: 'string' } } },
                body: {
                    type: 'object',
                    required: ['plan'],
                    properties: { plan: { type: 'string', enum: VALID_PLANS } },
                },
            },
        }, function (request, reply) { return __awaiter(void 0, void 0, void 0, function () {
            var id, plan, result, keyRows;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        id = request.params.id;
                        plan = request.body.plan;
                        return [4 /*yield*/, index_js_1.db
                                .update(index_js_2.users)
                                .set({ plan: plan })
                                .where((0, drizzle_orm_1.eq)(index_js_2.users.id, id))
                                .returning({ id: index_js_2.users.id })];
                    case 1:
                        result = _a.sent();
                        if (!result.length) {
                            return [2 /*return*/, reply.status(404).send({ success: false, error: 'not_found', message: 'User not found.' })];
                        }
                        return [4 /*yield*/, index_js_1.db
                                .select({ keyHash: index_js_2.apiKeys.keyHash })
                                .from(index_js_2.apiKeys)
                                .where((0, drizzle_orm_1.eq)(index_js_2.apiKeys.userId, id))];
                    case 2:
                        keyRows = _a.sent();
                        return [4 /*yield*/, Promise.all(keyRows.map(function (k) { return (0, index_js_3.invalidateAuthCache)(k.keyHash); }))];
                    case 3:
                        _a.sent();
                        return [2 /*return*/, reply.status(200).send({ success: true, message: "Plan updated to ".concat(plan, ".") })];
                }
            });
        }); });
        // ─── POST /admin/users/:id/suspend ────────────────────────────────────────
        fastify.post('/users/:id/suspend', {
            schema: { tags: ['Admin'], params: { type: 'object', properties: { id: { type: 'string' } } } },
        }, function (request, reply) { return __awaiter(void 0, void 0, void 0, function () {
            var id, result, keyRows;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        id = request.params.id;
                        return [4 /*yield*/, index_js_1.db
                                .update(index_js_2.users)
                                .set({ accountStatus: 'suspended', suspendedAt: new Date() })
                                .where((0, drizzle_orm_1.eq)(index_js_2.users.id, id))
                                .returning({ id: index_js_2.users.id })];
                    case 1:
                        result = _a.sent();
                        if (!result.length) {
                            return [2 /*return*/, reply.status(404).send({ success: false, error: 'not_found', message: 'User not found.' })];
                        }
                        return [4 /*yield*/, index_js_1.db
                                .select({ keyHash: index_js_2.apiKeys.keyHash })
                                .from(index_js_2.apiKeys)
                                .where((0, drizzle_orm_1.eq)(index_js_2.apiKeys.userId, id))];
                    case 2:
                        keyRows = _a.sent();
                        return [4 /*yield*/, Promise.all(keyRows.map(function (k) { return (0, index_js_3.invalidateAuthCache)(k.keyHash); }))];
                    case 3:
                        _a.sent();
                        return [2 /*return*/, reply.status(200).send({ success: true, message: 'Account suspended.' })];
                }
            });
        }); });
        // ─── POST /admin/users/:id/unsuspend ──────────────────────────────────────
        fastify.post('/users/:id/unsuspend', {
            schema: { tags: ['Admin'], params: { type: 'object', properties: { id: { type: 'string' } } } },
        }, function (request, reply) { return __awaiter(void 0, void 0, void 0, function () {
            var id, result, keyRows;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        id = request.params.id;
                        return [4 /*yield*/, index_js_1.db
                                .update(index_js_2.users)
                                .set({
                                accountStatus: 'active',
                                suspendedAt: null,
                                paymentFailedAt: null,
                                billingStatus: 'active',
                            })
                                .where((0, drizzle_orm_1.eq)(index_js_2.users.id, id))
                                .returning({ id: index_js_2.users.id })];
                    case 1:
                        result = _a.sent();
                        if (!result.length) {
                            return [2 /*return*/, reply.status(404).send({ success: false, error: 'not_found', message: 'User not found.' })];
                        }
                        return [4 /*yield*/, index_js_1.db
                                .select({ keyHash: index_js_2.apiKeys.keyHash })
                                .from(index_js_2.apiKeys)
                                .where((0, drizzle_orm_1.eq)(index_js_2.apiKeys.userId, id))];
                    case 2:
                        keyRows = _a.sent();
                        return [4 /*yield*/, Promise.all(keyRows.map(function (k) { return (0, index_js_3.invalidateAuthCache)(k.keyHash); }))];
                    case 3:
                        _a.sent();
                        return [2 /*return*/, reply.status(200).send({ success: true, message: 'Account reactivated.' })];
                }
            });
        }); });
        // ─── POST /admin/users/:id/reset-usage ────────────────────────────────────
        fastify.post('/users/:id/reset-usage', {
            schema: { tags: ['Admin'], params: { type: 'object', properties: { id: { type: 'string' } } } },
        }, function (request, reply) { return __awaiter(void 0, void 0, void 0, function () {
            var id;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        id = request.params.id;
                        return [4 /*yield*/, (0, rate_limit_service_js_1.resetCounters)(id)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/, reply.status(200).send({ success: true, message: 'Rate limit counters reset.' })];
                }
            });
        }); });
        // ─── GET /admin/stats ─────────────────────────────────────────────────────
        fastify.get('/stats', {
            schema: { tags: ['Admin'] },
        }, function (_request, reply) { return __awaiter(void 0, void 0, void 0, function () {
            var _a, planCounts, today, _b, todayUsage;
            var _c;
            return __generator(this, function (_d) {
                switch (_d.label) {
                    case 0: return [4 /*yield*/, index_js_1.db
                            .select({
                            free: (0, drizzle_orm_1.sql)(templateObject_2 || (templateObject_2 = __makeTemplateObject(["COUNT(*) FILTER (WHERE plan = 'free')"], ["COUNT(*) FILTER (WHERE plan = 'free')"]))),
                            basic: (0, drizzle_orm_1.sql)(templateObject_3 || (templateObject_3 = __makeTemplateObject(["COUNT(*) FILTER (WHERE plan = 'basic')"], ["COUNT(*) FILTER (WHERE plan = 'basic')"]))),
                            premium: (0, drizzle_orm_1.sql)(templateObject_4 || (templateObject_4 = __makeTemplateObject(["COUNT(*) FILTER (WHERE plan = 'premium')"], ["COUNT(*) FILTER (WHERE plan = 'premium')"]))),
                            enterprise: (0, drizzle_orm_1.sql)(templateObject_5 || (templateObject_5 = __makeTemplateObject(["COUNT(*) FILTER (WHERE plan = 'enterprise')"], ["COUNT(*) FILTER (WHERE plan = 'enterprise')"]))),
                            total: (0, drizzle_orm_1.sql)(templateObject_6 || (templateObject_6 = __makeTemplateObject(["COUNT(*)"], ["COUNT(*)"]))),
                            suspended: (0, drizzle_orm_1.sql)(templateObject_7 || (templateObject_7 = __makeTemplateObject(["COUNT(*) FILTER (WHERE account_status = 'suspended')"], ["COUNT(*) FILTER (WHERE account_status = 'suspended')"]))),
                            paymentFailed: (0, drizzle_orm_1.sql)(templateObject_8 || (templateObject_8 = __makeTemplateObject(["COUNT(*) FILTER (WHERE billing_status = 'payment_failed')"], ["COUNT(*) FILTER (WHERE billing_status = 'payment_failed')"]))),
                        })
                            .from(index_js_2.users)];
                    case 1:
                        _a = __read.apply(void 0, [_d.sent(), 1]), planCounts = _a[0];
                        today = new Date().toISOString().slice(0, 10);
                        return [4 /*yield*/, index_js_1.db
                                .select({ total: (0, drizzle_orm_1.sql)(templateObject_9 || (templateObject_9 = __makeTemplateObject(["COALESCE(SUM(query_count), 0)"], ["COALESCE(SUM(query_count), 0)"]))) })
                                .from(index_js_2.apiUsageDaily)
                                .where((0, drizzle_orm_1.eq)(index_js_2.apiUsageDaily.date, today))];
                    case 2:
                        _b = __read.apply(void 0, [_d.sent(), 1]), todayUsage = _b[0];
                        return [2 /*return*/, reply.status(200).send({
                                success: true,
                                data: {
                                    users: planCounts,
                                    requestsToday: Number((_c = todayUsage === null || todayUsage === void 0 ? void 0 : todayUsage.total) !== null && _c !== void 0 ? _c : 0),
                                },
                            })];
                }
            });
        }); });
        return [2 /*return*/];
    });
}); };
exports.default = adminRoutes;
var templateObject_1, templateObject_2, templateObject_3, templateObject_4, templateObject_5, templateObject_6, templateObject_7, templateObject_8, templateObject_9;
