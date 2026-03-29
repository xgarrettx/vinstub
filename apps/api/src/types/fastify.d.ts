/**
 * types/fastify.d.ts — Module augmentation for FastifyRequest.
 *
 * Adds typed properties that middleware attaches to every request.
 * Import this file anywhere you need typed access to request.user
 * or request.rateLimitData.
 */
import type { UserContext, PlanLimits } from '@vinstub/shared';

declare module 'fastify' {
  interface FastifyRequest {
    /**
     * Set by bearerAuthMiddleware after a valid API key is validated.
     * Null on routes that don't require auth.
     */
    user: UserContext | null;

    /**
     * Set by rateLimitMiddleware.
     * Contains current counter values and limit config for the active plan.
     * Used by route handlers to populate X-RateLimit-* response headers.
     */
    rateLimitData: RateLimitData | null;

    /**
     * Raw request body buffer — attached by the content-type parser in app.ts.
     * Used exclusively by the Stripe webhook handler for signature verification.
     */
    rawBody: Buffer;
  }
}

export interface RateLimitData {
  dayCount: number;
  hourCount: number;
  minuteCount: number;
  limits: PlanLimits;
  softCapExceeded: boolean;
  dailyResetAt: number;   // Unix epoch seconds — next UTC midnight
  minuteResetAt: number;  // Unix epoch seconds — next minute boundary
}
