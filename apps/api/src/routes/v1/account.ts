/**
 * routes/v1/account.ts — Account management routes.
 *
 * Mixed-auth routes: some require Bearer (API key), others require JWT
 * (dashboard session). The split exists because:
 *   - GET /v1/account     is called by API consumers to check their own status
 *   - Key rotation, billing portal, etc. are dashboard-level actions that
 *     should NOT be accessible with only an API key (privilege separation).
 *
 * Routes:
 *   GET  /v1/account              — Bearer auth — account info + key metadata
 *   POST /v1/account/rotate-key   — JWT auth    — generate new API key
 *   POST /v1/account/revoke-key   — JWT auth    — deactivate API key
 *   GET  /v1/account/billing      — JWT auth    — Stripe Customer Portal URL
 *   GET  /v1/account/usage        — JWT auth    — daily usage for current period
 */
import type { FastifyPluginAsync } from 'fastify';
import { eq, desc, gte, and } from 'drizzle-orm';
import { bearerAuth, jwtAuth } from '../../middleware/auth.js';
import { db } from '../../db/index.js';
import { users, apiKeys, apiUsageDaily } from '../../db/schema/index.js';
import { rotateApiKey, revokeApiKey } from '../../services/auth.service.js';
import { stripe } from '../../config/stripe.js';
import { env } from '../../config/env.js';

const accountRoutes: FastifyPluginAsync = async (fastify) => {
  // ─── GET /v1/account ────────────────────────────────────────────────────────
  // Returns the authenticated user's account info, plan, and masked API key.
  // Uses Bearer auth so API consumers can self-inspect programmatically.
  fastify.get('/account', {
    preHandler: [bearerAuth],
    schema: {
      tags: ['Account'],
      summary: 'Get account details',
      description:
        'Returns current account status, plan, usage limits, and masked API key. ' +
        'Requires API key authentication.',
      security: [{ BearerAuth: [] }],
      response: {
        200: {
          description: 'Account details',
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                userId: { type: 'string' },
                email: { type: 'string' },
                plan: { type: 'string' },
                accountStatus: { type: 'string' },
                billingStatus: { type: 'string' },
                apiKey: {
                  type: 'object',
                  properties: {
                    prefix: { type: 'string', description: 'First 16 chars for display' },
                    createdAt: { type: 'string', format: 'date-time' },
                    lastUsedAt: { type: ['string', 'null'], format: 'date-time' },
                  },
                },
                limits: {
                  type: 'object',
                  properties: {
                    daily: { type: 'integer' },
                    perHour: { type: 'integer' },
                    perMinute: { type: 'integer' },
                  },
                },
              },
            },
          },
        },
        401: { $ref: 'ErrorResponse#' },
        403: { $ref: 'ErrorResponse#' },
      },
    },
  }, async (request, reply) => {
    const user = request.user!;

    // Fetch full user row + active key metadata
    const rows = await db
      .select({
        email: users.email,
        plan: users.plan,
        accountStatus: users.accountStatus,
        billingStatus: users.billingStatus,
        keyPrefix: apiKeys.keyPrefix,
        keyCreatedAt: apiKeys.createdAt,
        keyLastUsedAt: apiKeys.lastUsedAt,
      })
      .from(users)
      .leftJoin(apiKeys, and(eq(apiKeys.userId, users.id), eq(apiKeys.isActive, true)))
      .where(eq(users.id, user.userId))
      .limit(1);

    if (!rows.length) {
      return reply.status(401).send({
        success: false,
        error: 'unauthorized',
        message: 'User not found.',
        request_id: request.id,
      });
    }

    const row = rows[0]!;

    const { PLAN_LIMITS } = await import('@vinstub/shared/constants.js');
    const limits = PLAN_LIMITS[user.plan];

    return reply.status(200).send({
      success: true,
      data: {
        userId: user.userId,
        email: row.email,
        plan: row.plan,
        accountStatus: row.accountStatus,
        billingStatus: row.billingStatus,
        apiKey: row.keyPrefix
          ? {
              prefix: row.keyPrefix,
              createdAt: row.keyCreatedAt,
              lastUsedAt: row.keyLastUsedAt,
            }
          : null,
        limits: {
          daily: limits.daily,
          perHour: limits.perHour,
          perMinute: limits.perMinute,
        },
      },
    });
  });

  // ─── GET /v1/account/key-info ───────────────────────────────────────────────
  // Returns the stored key prefix (first 16 chars) for display in the dashboard.
  // Full key is never stored — only the prefix and a sha256 hash.
  // Requires JWT (dashboard session).
  fastify.get('/account/key-info', {
    preHandler: [jwtAuth],
    schema: {
      tags: ['Account'],
      summary: 'Get API key display info',
      description: 'Returns the stored key prefix for display. The full key is never stored.',
      security: [{ BearerAuth: [] }],
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                keyPrefix: { type: ['string', 'null'], description: 'First 16 chars of key, e.g. vs_live_a3f9b2c1' },
                createdAt: { type: ['string', 'null'], format: 'date-time' },
                lastUsedAt: { type: ['string', 'null'], format: 'date-time' },
                hasKey: { type: 'boolean' },
              },
            },
          },
        },
        401: { $ref: 'ErrorResponse#' },
      },
    },
  }, async (request, reply) => {
    const user = request.user!;
    const rows = await db
      .select({
        keyPrefix: apiKeys.keyPrefix,
        createdAt: apiKeys.createdAt,
        lastUsedAt: apiKeys.lastUsedAt,
      })
      .from(apiKeys)
      .where(and(eq(apiKeys.userId, user.userId), eq(apiKeys.isActive, true)))
      .orderBy(desc(apiKeys.createdAt))
      .limit(1);

    const key = rows[0] ?? null;
    return reply.send({
      success: true,
      data: {
        keyPrefix: key?.keyPrefix ?? null,
        createdAt: key?.createdAt ?? null,
        lastUsedAt: key?.lastUsedAt ?? null,
        hasKey: !!key,
      },
    });
  });

  // ─── POST /v1/account/rotate-key ────────────────────────────────────────────
  // Generates a new API key and immediately invalidates the old one.
  // Returns the new raw key ONE TIME. Requires JWT (dashboard session).
  fastify.post('/account/rotate-key', {
    preHandler: [jwtAuth],
    schema: {
      tags: ['Account'],
      summary: 'Rotate API key',
      description:
        'Generates a new API key and immediately deactivates the current one. ' +
        'The new key is returned ONCE — it cannot be retrieved again. ' +
        'Requires dashboard session (JWT).',
      response: {
        200: {
          description: 'New API key generated',
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            apiKey: {
              type: 'string',
              description: 'Your new API key. Save it — it will not be shown again.',
            },
          },
        },
        401: { $ref: 'ErrorResponse#' },
        403: { $ref: 'ErrorResponse#' },
        500: { $ref: 'ErrorResponse#' },
      },
    },
  }, async (request, reply) => {
    const user = request.user!;
    const result = await rotateApiKey(user.userId);

    if ('code' in result) {
      return reply.status(500).send({
        success: false,
        error: result.code,
        message: result.message,
        request_id: request.id,
      });
    }

    return reply.status(200).send({
      success: true,
      message: 'API key rotated. Save your new key — it will not be shown again.',
      apiKey: result.rawApiKey,
    });
  });

  // ─── POST /v1/account/revoke-key ────────────────────────────────────────────
  // Deactivates the current API key without issuing a replacement.
  // Useful when a key is suspected compromised. Requires JWT.
  fastify.post('/account/revoke-key', {
    preHandler: [jwtAuth],
    schema: {
      tags: ['Account'],
      summary: 'Revoke API key',
      description:
        'Permanently deactivates the current API key. No replacement is issued. ' +
        'Use /account/rotate-key if you want a new key immediately. ' +
        'Requires dashboard session (JWT).',
      response: {
        200: {
          description: 'API key revoked',
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
          },
        },
        401: { $ref: 'ErrorResponse#' },
        404: { $ref: 'ErrorResponse#' },
      },
    },
  }, async (request, reply) => {
    const user = request.user!;
    const result = await revokeApiKey(user.userId);

    if (result && 'code' in result) {
      return reply.status(404).send({
        success: false,
        error: result.code,
        message: result.message,
        request_id: request.id,
      });
    }

    return reply.status(200).send({
      success: true,
      message: 'API key revoked. No requests can be made until a new key is issued.',
    });
  });

  // ─── GET /v1/account/billing ────────────────────────────────────────────────
  // Creates a Stripe Customer Portal session and returns the one-time URL.
  // Requires JWT. The portal URL expires after 5 minutes.
  fastify.get('/account/billing', {
    preHandler: [jwtAuth],
    schema: {
      tags: ['Account'],
      summary: 'Get Stripe billing portal URL',
      description:
        'Returns a one-time Stripe Customer Portal URL for managing subscription, ' +
        'payment method, and invoices. URL expires in 5 minutes. ' +
        'Requires dashboard session (JWT).',
      response: {
        200: {
          description: 'Billing portal URL',
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            url: {
              type: 'string',
              description: 'One-time Stripe Customer Portal URL (expires in 5 min)',
            },
          },
        },
        401: { $ref: 'ErrorResponse#' },
        403: { $ref: 'ErrorResponse#' },
        422: { $ref: 'ErrorResponse#' },
      },
    },
  }, async (request, reply) => {
    const user = request.user!;

    // Fetch Stripe customer ID
    const rows = await db
      .select({ stripeCustomerId: users.stripeCustomerId })
      .from(users)
      .where(eq(users.id, user.userId))
      .limit(1);

    const stripeCustomerId = rows[0]?.stripeCustomerId;

    if (!stripeCustomerId) {
      return reply.status(422).send({
        success: false,
        error: 'no_subscription',
        message: 'No billing account found. Please subscribe to a paid plan first.',
        request_id: request.id,
      });
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: stripeCustomerId,
      return_url: `${env.APP_BASE_URL}/dashboard/account`,
    });

    return reply.status(200).send({
      success: true,
      url: session.url,
    });
  });

  // ─── GET /v1/account/usage ───────────────────────────────────────────────────
  // Returns daily API usage for the last 30 days.
  // Requires JWT (dashboard view — not intended for programmatic rate-limit checks;
  // use the X-RateLimit-* headers on /v1/stub responses for that).
  fastify.get('/account/usage', {
    preHandler: [jwtAuth],
    schema: {
      tags: ['Account'],
      summary: 'Get usage history',
      description:
        'Returns daily API call counts for the last 30 days. ' +
        'Requires dashboard session (JWT).',
      querystring: {
        type: 'object',
        additionalProperties: false,
        properties: {
          days: {
            type: 'integer',
            minimum: 1,
            maximum: 90,
            default: 30,
            description: 'Number of days to look back (default 30, max 90)',
          },
        },
      },
      response: {
        200: {
          description: 'Usage history',
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  date: { type: 'string', format: 'date' },
                  requestCount: { type: 'integer' },
                },
              },
            },
            totalRequests: { type: 'integer' },
          },
        },
        401: { $ref: 'ErrorResponse#' },
      },
    },
  }, async (request, reply) => {
    const user = request.user!;
    const { days = 30 } = request.query as { days?: number };

    const since = new Date();
    since.setDate(since.getDate() - days);
    since.setHours(0, 0, 0, 0);

    const rows = await db
      .select({
        date: apiUsageDaily.usageDate,
        requestCount: apiUsageDaily.requestCount,
      })
      .from(apiUsageDaily)
      .where(
        and(
          eq(apiUsageDaily.userId, user.userId),
          gte(apiUsageDaily.usageDate, since.toISOString().slice(0, 10)),
        ),
      )
      .orderBy(desc(apiUsageDaily.usageDate));

    const totalRequests = rows.reduce((sum, r) => sum + r.requestCount, 0);

    return reply.status(200).send({
      success: true,
      data: rows.map((r) => ({
        date: r.date,
        requestCount: r.requestCount,
      })),
      totalRequests,
    });
  });
};

export default accountRoutes;
