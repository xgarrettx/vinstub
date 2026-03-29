/**
 * routes/v1/makes.ts — GET /v1/makes
 *
 * Returns the sorted list of all distinct make names in the database.
 * Result is served from Redis cache — near-zero latency after first load.
 * Cache is refreshed by the ingest script after each data import.
 *
 * Auth: bearerAuth (API key required)
 *
 * Rate limited by rateLimitMiddleware (counts against the user's quota).
 * This is intentional — reference endpoints still cost a query unit.
 */
import type { FastifyPluginAsync } from 'fastify';
import { bearerAuth } from '../../middleware/auth.js';
import { rateLimitMiddleware } from '../../middleware/rate-limit.js';
import { getMakes } from '../../services/vin.service.js';

const makesRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/makes', {
    preHandler: [bearerAuth, rateLimitMiddleware],
    schema: {
      tags: ['Reference'],
      summary: 'List all vehicle makes',
      description: 'Returns a sorted list of all vehicle makes available in the database.',
      security: [{ BearerAuth: [] }],
      response: {
        200: {
          description: 'List of makes',
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'array',
              items: { type: 'string' },
              description: 'Sorted list of canonical make names',
            },
            count: { type: 'integer' },
          },
        },
        401: { $ref: 'ErrorResponse#' },
        403: { $ref: 'ErrorResponse#' },
        429: { $ref: 'ErrorResponse#' },
      },
    },
  }, async (request, reply) => {
    // Set rate limit headers
    const rl = request.rateLimitData;
    if (rl) {
      reply.headers({
        'X-RateLimit-Limit-Day': String(rl.limits.daily),
        'X-RateLimit-Remaining-Day': String(Math.max(0, rl.limits.daily - rl.dayCount)),
        'X-RateLimit-Reset-Day': String(rl.dailyResetAt),
        'X-RateLimit-Limit-Minute': String(rl.limits.perMinute),
        'X-RateLimit-Remaining-Minute': String(Math.max(0, rl.limits.perMinute - rl.minuteCount)),
        'X-RateLimit-Reset-Minute': String(rl.minuteResetAt),
      });
      if (rl.softCapExceeded) reply.header('X-Soft-Cap-Exceeded', 'true');
    }

    const makes = await getMakes();

    return reply.status(200).send({
      success: true,
      data: makes,
      count: makes.length,
    });
  });
};

export default makesRoutes;
