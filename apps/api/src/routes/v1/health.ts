/**
 * routes/v1/health.ts — GET /v1/health
 *
 * Public health check endpoint. Returns HTTP 200 when the API and its
 * dependencies (Postgres, Redis) are reachable, or HTTP 503 when any
 * dependency is degraded.
 *
 * Used by:
 *   - DigitalOcean App Platform health probes
 *   - Load balancer liveness checks
 *   - Uptime monitoring (Better Uptime, etc.)
 *
 * No auth required — intentionally public.
 */
import type { FastifyPluginAsync } from 'fastify';
import { checkDbHealth } from '../../db/index.js';
import { redis } from '../../redis/index.js';

const healthRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/health', {
    schema: {
      tags: ['System'],
      summary: 'Health check',
      description: 'Returns 200 when all dependencies are healthy, 503 when degraded.',
      response: {
        200: {
          description: 'All systems operational',
          type: 'object',
          properties: {
            status: { type: 'string', enum: ['ok'] },
            version: { type: 'string' },
            uptime: { type: 'number', description: 'Process uptime in seconds' },
            checks: {
              type: 'object',
              properties: {
                postgres: {
                  type: 'object',
                  properties: {
                    ok: { type: 'boolean' },
                    latencyMs: { type: 'number' },
                  },
                },
                redis: {
                  type: 'object',
                  properties: {
                    ok: { type: 'boolean' },
                    latencyMs: { type: 'number' },
                  },
                },
              },
            },
          },
        },
        503: {
          description: 'One or more dependencies unhealthy',
          type: 'object',
          properties: {
            status: { type: 'string', enum: ['degraded'] },
            checks: {
              type: 'object',
              properties: {
                postgres: {
                  type: 'object',
                  properties: {
                    ok: { type: 'boolean' },
                    latencyMs: { type: ['number', 'null'] },
                    error: { type: 'string' },
                  },
                },
                redis: {
                  type: 'object',
                  properties: {
                    ok: { type: 'boolean' },
                    latencyMs: { type: ['number', 'null'] },
                    error: { type: 'string' },
                  },
                },
              },
            },
          },
        },
      },
    },
  }, async (_request, reply) => {
    const [dbHealth, redisHealth] = await Promise.all([
      checkDbHealth(),
      checkRedisHealth(),
    ]);

    const allOk = dbHealth.ok && redisHealth.ok;

    const body = {
      status: allOk ? ('ok' as const) : ('degraded' as const),
      ...(allOk ? { version: process.env['npm_package_version'] ?? 'unknown' } : {}),
      ...(allOk ? { uptime: Math.floor(process.uptime()) } : {}),
      checks: {
        postgres: dbHealth,
        redis: redisHealth,
      },
    };

    return reply.status(allOk ? 200 : 503).send(body);
  });
};

// ─── REDIS HEALTH ─────────────────────────────────────────────────────────────

async function checkRedisHealth(): Promise<{ ok: boolean; latencyMs: number | null; error?: string }> {
  const start = Date.now();
  try {
    const pong = await redis.ping();
    if (pong !== 'PONG') throw new Error(`Unexpected PING response: ${pong}`);
    return { ok: true, latencyMs: Date.now() - start };
  } catch (err) {
    return {
      ok: false,
      latencyMs: null,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export default healthRoutes;
