/**
 * routes/admin/index.ts — Internal admin/ops routes.
 *
 * All routes require X-Admin-Key + X-Admin-TOTP headers (see admin-auth.ts).
 * These endpoints are for internal use by the ops team — NOT exposed in the
 * public API docs. Register with prefix /admin in app.ts.
 *
 * Routes:
 *   GET    /admin/users                  — paginated user list
 *   GET    /admin/users/:id              — user detail + recent usage
 *   PATCH  /admin/users/:id/plan         — override user's plan
 *   POST   /admin/users/:id/suspend      — manually suspend account
 *   POST   /admin/users/:id/unsuspend    — lift suspension
 *   POST   /admin/users/:id/reset-usage  — zero out today's Redis counters
 *   GET    /admin/stats                  — aggregate API stats
 */
import type { FastifyPluginAsync } from 'fastify';
import { eq, desc, sql, and, gte } from 'drizzle-orm';
import { adminAuth } from '../../middleware/admin-auth.js';
import { db } from '../../db/index.js';
import { users, apiKeys, apiUsageDaily } from '../../db/schema/index.js';
import { invalidateAuthCache } from '../../redis/index.js';
import { resetCounters } from '../../services/rate-limit.service.js';
import type { Plan } from '@vinstub/shared/types.js';

const VALID_PLANS: Plan[] = ['free', 'basic', 'premium', 'enterprise'];

const adminRoutes: FastifyPluginAsync = async (fastify) => {
  // Apply admin auth to every route in this plugin
  fastify.addHook('preHandler', adminAuth);

  // ─── GET /admin/users ──────────────────────────────────────────────────────
  fastify.get('/users', {
    schema: {
      tags: ['Admin'],
      querystring: {
        type: 'object',
        properties: {
          limit:  { type: 'integer', minimum: 1, maximum: 100, default: 50 },
          offset: { type: 'integer', minimum: 0, default: 0 },
          plan:   { type: 'string', enum: VALID_PLANS },
          status: { type: 'string', enum: ['active', 'suspended', 'unverified'] },
        },
      },
    },
  }, async (request, reply) => {
    const { limit = 50, offset = 0, plan, status } = request.query as {
      limit?: number; offset?: number; plan?: Plan; status?: string;
    };

    // Build WHERE conditions dynamically
    const conditions = [];
    if (plan) conditions.push(eq(users.plan, plan));
    if (status === 'suspended') conditions.push(eq(users.accountStatus, 'suspended'));
    if (status === 'unverified') conditions.push(eq(users.emailVerified, false));
    if (status === 'active') conditions.push(eq(users.accountStatus, 'active'));

    const rows = await db
      .select({
        id: users.id,
        email: users.email,
        plan: users.plan,
        accountStatus: users.accountStatus,
        billingStatus: users.billingStatus,
        emailVerified: users.emailVerified,
        createdAt: users.createdAt,
        paymentFailedAt: users.paymentFailedAt,
        suspendedAt: users.suspendedAt,
      })
      .from(users)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(users.createdAt))
      .limit(limit)
      .offset(offset);

    const [countResult] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(users)
      .where(conditions.length ? and(...conditions) : undefined);

    return reply.status(200).send({
      success: true,
      data: rows,
      total: Number(countResult?.count ?? 0),
      limit,
      offset,
    });
  });

  // ─── GET /admin/users/:id ──────────────────────────────────────────────────
  fastify.get('/users/:id', {
    schema: { tags: ['Admin'], params: { type: 'object', properties: { id: { type: 'string' } } } },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };

    const userRows = await db
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1);

    if (!userRows.length) {
      return reply.status(404).send({ success: false, error: 'not_found', message: 'User not found.' });
    }

    // Active API key metadata
    const keyRows = await db
      .select({ keyPrefix: apiKeys.keyPrefix, createdAt: apiKeys.createdAt, lastUsedAt: apiKeys.lastUsedAt })
      .from(apiKeys)
      .where(and(eq(apiKeys.userId, id), eq(apiKeys.isActive, true)))
      .limit(1);

    // Last 30 days of usage
    const since = new Date();
    since.setDate(since.getDate() - 30);
    const usageRows = await db
      .select({ date: apiUsageDaily.usageDate, count: apiUsageDaily.requestCount })
      .from(apiUsageDaily)
      .where(and(
        eq(apiUsageDaily.userId, id),
        gte(apiUsageDaily.usageDate, since.toISOString().slice(0, 10)),
      ))
      .orderBy(desc(apiUsageDaily.usageDate));

    const totalLast30 = usageRows.reduce((s, r) => s + r.count, 0);

    return reply.status(200).send({
      success: true,
      data: {
        user: userRows[0],
        activeKey: keyRows[0] ?? null,
        usageLast30Days: usageRows,
        totalRequestsLast30Days: totalLast30,
      },
    });
  });

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
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { plan } = request.body as { plan: Plan };

    const result = await db
      .update(users)
      .set({ plan })
      .where(eq(users.id, id))
      .returning({ id: users.id });

    if (!result.length) {
      return reply.status(404).send({ success: false, error: 'not_found', message: 'User not found.' });
    }

    // Invalidate auth cache so new plan takes effect immediately
    const keyRows = await db
      .select({ keyHash: apiKeys.keyHash })
      .from(apiKeys)
      .where(eq(apiKeys.userId, id));
    await Promise.all(keyRows.map((k) => invalidateAuthCache(k.keyHash)));

    return reply.status(200).send({ success: true, message: `Plan updated to ${plan}.` });
  });

  // ─── POST /admin/users/:id/suspend ────────────────────────────────────────
  fastify.post('/users/:id/suspend', {
    schema: { tags: ['Admin'], params: { type: 'object', properties: { id: { type: 'string' } } } },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };

    const result = await db
      .update(users)
      .set({ accountStatus: 'suspended', suspendedAt: new Date() })
      .where(eq(users.id, id))
      .returning({ id: users.id });

    if (!result.length) {
      return reply.status(404).send({ success: false, error: 'not_found', message: 'User not found.' });
    }

    const keyRows = await db
      .select({ keyHash: apiKeys.keyHash })
      .from(apiKeys)
      .where(eq(apiKeys.userId, id));
    await Promise.all(keyRows.map((k) => invalidateAuthCache(k.keyHash)));

    return reply.status(200).send({ success: true, message: 'Account suspended.' });
  });

  // ─── POST /admin/users/:id/unsuspend ──────────────────────────────────────
  fastify.post('/users/:id/unsuspend', {
    schema: { tags: ['Admin'], params: { type: 'object', properties: { id: { type: 'string' } } } },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };

    const result = await db
      .update(users)
      .set({
        accountStatus: 'active',
        suspendedAt: null,
        paymentFailedAt: null,
        billingStatus: 'active',
      })
      .where(eq(users.id, id))
      .returning({ id: users.id });

    if (!result.length) {
      return reply.status(404).send({ success: false, error: 'not_found', message: 'User not found.' });
    }

    const keyRows = await db
      .select({ keyHash: apiKeys.keyHash })
      .from(apiKeys)
      .where(eq(apiKeys.userId, id));
    await Promise.all(keyRows.map((k) => invalidateAuthCache(k.keyHash)));

    return reply.status(200).send({ success: true, message: 'Account reactivated.' });
  });

  // ─── POST /admin/users/:id/reset-usage ────────────────────────────────────
  fastify.post('/users/:id/reset-usage', {
    schema: { tags: ['Admin'], params: { type: 'object', properties: { id: { type: 'string' } } } },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };

    await resetCounters(id);
    return reply.status(200).send({ success: true, message: 'Rate limit counters reset.' });
  });

  // ─── GET /admin/stats ─────────────────────────────────────────────────────
  fastify.get('/stats', {
    schema: { tags: ['Admin'] },
  }, async (_request, reply) => {
    const [planCounts] = await db
      .select({
        free:       sql<number>`COUNT(*) FILTER (WHERE plan = 'free')`,
        basic:      sql<number>`COUNT(*) FILTER (WHERE plan = 'basic')`,
        premium:    sql<number>`COUNT(*) FILTER (WHERE plan = 'premium')`,
        enterprise: sql<number>`COUNT(*) FILTER (WHERE plan = 'enterprise')`,
        total:      sql<number>`COUNT(*)`,
        suspended:  sql<number>`COUNT(*) FILTER (WHERE account_status = 'suspended')`,
        paymentFailed: sql<number>`COUNT(*) FILTER (WHERE billing_status = 'payment_failed')`,
      })
      .from(users);

    // Total requests today
    const today = new Date().toISOString().slice(0, 10);
    const [todayUsage] = await db
      .select({ total: sql<number>`COALESCE(SUM(request_count), 0)` })
      .from(apiUsageDaily)
      .where(eq(apiUsageDaily.usageDate, today));

    return reply.status(200).send({
      success: true,
      data: {
        users: planCounts,
        requestsToday: Number(todayUsage?.total ?? 0),
      },
    });
  });
};

export default adminRoutes;
