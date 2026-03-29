/**
 * constants.ts — Plan limits and pricing.
 * Single source of truth — imported by API (enforcement), web (display), and docs.
 */
import type { Plan } from './types.js';
export interface PlanLimits {
    daily: number;
    perHour: number;
    perMinute: number;
    /** Max concurrent requests from one token (enforced via Redis incr pattern) */
    concurrency: number;
    /**
     * If true, hitting the daily limit returns a soft-cap flag but does NOT
     * block the request. The API still responds with HTTP 200 but sets
     * X-Soft-Cap-Exceeded: true.
     *
     * If false (Free tier), hitting the daily limit returns HTTP 429.
     */
    softDailyCap: boolean;
}
export declare const PLAN_LIMITS: Record<Plan, PlanLimits>;
export interface PlanPricing {
    /** Monthly price in USD cents */
    cents: number;
    /** Display string */
    display: string;
}
export declare const PLAN_PRICING: Record<Plan, PlanPricing>;
export declare const API_KEY_PREFIX = "vs_live_";
export declare const API_KEY_BODY_LENGTH = 48;
export declare const API_KEY_TOTAL_LENGTH: number;
export declare const API_KEY_REGEX: RegExp;
/** Hours of grace period after payment failure before account is suspended */
export declare const PAYMENT_GRACE_PERIOD_HOURS = 72;
/** Hours after payment failure to send first reminder */
export declare const PAYMENT_REMINDER_1_HOURS = 24;
/** Hours after payment failure to send second (final) reminder */
export declare const PAYMENT_REMINDER_2_HOURS = 48;
/** Days after suspension before account is marked for deletion */
export declare const SUSPENSION_DELETION_DAYS = 30;
/** Max accounts per IP per hour at signup */
export declare const MAX_SIGNUPS_PER_IP_PER_HOUR = 3;
/** Redis key cache TTL for auth validation (seconds) */
export declare const AUTH_CACHE_TTL_SECONDS = 60;
//# sourceMappingURL=constants.d.ts.map