/**
 * routes/v1/stub.ts — GET /v1/stub
 *
 * The core monetized endpoint. Returns the VIN stub for a given
 * year / make / model / optional submodel combination.
 *
 * Auth:    bearerAuth (API key in Authorization header)
 * Rate:    rateLimitMiddleware (sliding window Redis counters)
 *
 * Query parameters:
 *   year      (required) integer 1980–2027
 *   make      (required) string
 *   model     (required) string
 *   submodel  (optional) string
 *
 * Response headers set by rateLimitMiddleware (see rate-limit.ts):
 *   X-RateLimit-Limit-Day
 *   X-RateLimit-Remaining-Day
 *   X-RateLimit-Reset-Day
 *   X-RateLimit-Limit-Minute
 *   X-RateLimit-Remaining-Minute
 *   X-RateLimit-Reset-Minute
 *   X-Soft-Cap-Exceeded  (paid plans only, when daily soft cap hit)
 */
import type { FastifyPluginAsync } from 'fastify';
import { bearerAuth } from '../../middleware/auth.js';
import { rateLimitMiddleware } from '../../middleware/rate-limit.js';
import { lookupStub } from '../../services/vin.service.js';

const stubRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/stub', {
    preHandler: [bearerAuth, rateLimitMiddleware],
    schema: {
      tags: ['VIN Lookup'],
      summary: 'Look up a VIN stub',
      description:
        'Returns the VIN stub for a given year, make, model, and optional submodel. ' +
        'When submodel is omitted, the base model record is returned. ' +
        'Requires a valid API key in the Authorization header.',
      security: [{ BearerAuth: [] }],
      querystring: {
        type: 'object',
        required: ['year', 'make', 'model'],
        additionalProperties: false,
        properties: {
          year: {
            type: 'integer',
            minimum: 1980,
            maximum: 2027,
            description: 'Vehicle model year (1980–2027)',
          },
          make: {
            type: 'string',
            minLength: 1,
            maxLength: 100,
            description: 'Vehicle make (e.g. "Toyota", "Chevrolet")',
          },
          model: {
            type: 'string',
            minLength: 1,
            maxLength: 100,
            description: 'Vehicle model (e.g. "Camry", "Silverado")',
          },
          submodel: {
            type: 'string',
            minLength: 1,
            maxLength: 100,
            description: 'Optional submodel / trim (e.g. "LE", "LTZ")',
          },
        },
      },
      response: {
        200: {
          description: 'VIN stub found',
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                vin_stub: {
                  type: 'string',
                  description: 'The VIN stub (WMI + VDS portion, zero-padded to 9 chars)',
                },
                stub_length: {
                  type: 'integer',
                  description: 'Number of significant characters in the stub',
                },
                year: { type: 'integer' },
                make: { type: 'string' },
                model: { type: 'string' },
                submodel: { type: ['string', 'null'] },
                match_type: {
                  type: 'string',
                  enum: ['exact', 'base_model'],
                  description:
                    '"exact" when submodel was matched, "base_model" when no submodel was provided',
                },
              },
            },
          },
        },
        400: { $ref: 'ErrorResponse#' },
        401: { $ref: 'ErrorResponse#' },
        403: { $ref: 'ErrorResponse#' },
        404: { $ref: 'ErrorResponse#' },
        429: { $ref: 'ErrorResponse#' },
      },
    },
  }, async (request, reply) => {
    const { year, make, model, submodel } = request.query as {
      year: number;
      make: string;
      model: string;
      submodel?: string;
    };

    // Set rate limit response headers from data attached by rateLimitMiddleware
    const rl = request.rateLimitData;
    if (rl) {
      const remaining_day = Math.max(0, rl.limits.daily - rl.dayCount);
      const remaining_minute = Math.max(0, rl.limits.perMinute - rl.minuteCount);

      reply.headers({
        'X-RateLimit-Limit-Day': String(rl.limits.daily),
        'X-RateLimit-Remaining-Day': String(remaining_day),
        'X-RateLimit-Reset-Day': String(rl.dailyResetAt),
        'X-RateLimit-Limit-Minute': String(rl.limits.perMinute),
        'X-RateLimit-Remaining-Minute': String(remaining_minute),
        'X-RateLimit-Reset-Minute': String(rl.minuteResetAt),
      });

      if (rl.softCapExceeded) {
        reply.header('X-Soft-Cap-Exceeded', 'true');
      }
    }

    const result = await lookupStub(year, make, model, submodel);

    if ('code' in result) {
      if (result.code === 'invalid_year' || result.code === 'invalid_input') {
        return reply.status(400).send({
          success: false,
          error: result.code,
          message: result.message,
          request_id: request.id,
        });
      }
      // not_found
      return reply.status(404).send({
        success: false,
        error: 'not_found',
        message: result.message,
        request_id: request.id,
      });
    }

    return reply.status(200).send({
      success: true,
      data: result,
    });
  });
};

export default stubRoutes;
