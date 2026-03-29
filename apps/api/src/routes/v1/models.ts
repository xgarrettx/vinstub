/**
 * routes/v1/models.ts — GET /v1/models?make=
 *
 * Returns the sorted list of all distinct model names for a given make.
 * Result is served from Redis cache — near-zero latency after first load.
 *
 * Auth: bearerAuth (API key required)
 * Rate: rateLimitMiddleware (counts against quota)
 */
import type { FastifyPluginAsync } from 'fastify';
import { bearerAuth } from '../../middleware/auth.js';
import { rateLimitMiddleware } from '../../middleware/rate-limit.js';
import { getModels } from '../../services/vin.service.js';

const modelsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/models', {
    preHandler: [bearerAuth, rateLimitMiddleware],
    schema: {
      tags: ['Reference'],
      summary: 'List models for a make',
      description: 'Returns a sorted list of all vehicle models available for the specified make.',
      security: [{ BearerAuth: [] }],
      querystring: {
        type: 'object',
        required: ['make'],
        additionalProperties: false,
        properties: {
          make: {
            type: 'string',
            minLength: 1,
            maxLength: 100,
            description: 'Vehicle make to filter by (e.g. "Toyota")',
          },
        },
      },
      response: {
        200: {
          description: 'List of models',
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            make: { type: 'string' },
            data: {
              type: 'array',
              items: { type: 'string' },
              description: 'Sorted list of model names for the given make',
            },
            count: { type: 'integer' },
          },
        },
        400: { $ref: 'ErrorResponse#' },
        401: { $ref: 'ErrorResponse#' },
        403: { $ref: 'ErrorResponse#' },
        429: { $ref: 'ErrorResponse#' },
      },
    },
  }, async (request, reply) => {
    const { make } = request.query as { make: string };

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

    const models = await getModels(make);

    return reply.status(200).send({
      success: true,
      make: make.trim(),
      data: models,
      count: models.length,
    });
  });
};

export default modelsRoutes;
