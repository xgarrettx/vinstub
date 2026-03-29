/**
 * middleware/rate-limit.ts — Rate limiting preHandler hook.
 *
 * Designed to run AFTER bearerAuth (which populates request.user).
 * Calls checkRateLimit(), blocks with 429 when limits exceeded, and
 * attaches RateLimitData to request.rateLimitData for downstream route
 * handlers to read when setting X-RateLimit-* response headers.
 *
 * This middleware does NOT set response headers itself — that's done in
 * each route handler so the headers are accurate post-increment. This
 * avoids a double-increment problem if we tried to peek-then-increment.
 *
 * 429 response body:
 *   {
 *     success: false,
 *     error: 'rate_limited',
 *     message: '...',
 *     request_id: '...',
 *     retry_after: <seconds until window resets>
 *   }
 *
 * The Retry-After header is also set on 429 responses per RFC 6585.
 */
import type { preHandlerHookHandler } from 'fastify';
import { checkRateLimit } from '../services/rate-limit.service.js';
import { PLAN_LIMITS } from '@vinstub/shared/constants.js';
import type { RateLimitData } from '../types/fastify.js';

export const rateLimitMiddleware: preHandlerHookHandler = async (request, reply) => {
  const user = request.user;

  // Should never happen — bearerAuth must run first. Defensive check.
  if (!user) {
    return reply.status(401).send({
      success: false,
      error: 'unauthorized',
      message: 'Authentication required.',
      request_id: request.id,
    });
  }

  // Suspended accounts: caught by bearerAuth, but double-check here as a
  // safety net in case account status changed mid-session.
  if (user.accountStatus !== 'active') {
    return reply.status(403).send({
      success: false,
      error: 'account_suspended',
      message: 'Your account has been suspended. Please resolve any outstanding balance.',
      request_id: request.id,
    });
  }

  const decision = await checkRateLimit(user.userId, user.plan);
  const limits = PLAN_LIMITS[user.plan];

  // Attach rate limit data to request for route handlers to set headers
  const rateLimitData: RateLimitData = {
    dayCount: decision.counters.dayCount,
    hourCount: decision.counters.hourCount,
    minuteCount: decision.counters.minuteCount,
    limits,
    softCapExceeded: decision.softCapExceeded,
    dailyResetAt: decision.dailyResetAt,
    minuteResetAt: decision.minuteResetAt,
  };
  request.rateLimitData = rateLimitData;

  if (!decision.allowed) {
    const reason = decision.blockReason!;

    let retryAfter: number;
    let message: string;

    switch (reason) {
      case 'minute_limit':
        retryAfter = decision.minuteResetAt - Math.floor(Date.now() / 1000);
        message = `Per-minute rate limit exceeded (${limits.perMinute} req/min). ` +
          `Retry after ${retryAfter} seconds.`;
        break;
      case 'hour_limit':
        retryAfter = Math.floor(Date.now() / 1000 / 3600) * 3600 + 3600 - Math.floor(Date.now() / 1000);
        message = `Per-hour rate limit exceeded (${limits.perHour} req/hr). ` +
          `Retry after ${retryAfter} seconds.`;
        break;
      case 'day_limit':
        retryAfter = decision.dailyResetAt - Math.floor(Date.now() / 1000);
        message = `Daily quota exhausted (${limits.daily} req/day on the ${user.plan} plan). ` +
          `Quota resets at midnight UTC. Upgrade your plan for higher limits.`;
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

    return reply.status(429).send({
      success: false,
      error: 'rate_limited',
      message,
      request_id: request.id,
      retry_after: Math.max(1, retryAfter),
    });
  }
};
