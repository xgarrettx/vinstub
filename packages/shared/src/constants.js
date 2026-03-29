export const PLAN_LIMITS = {
    free: {
        daily: 50,
        perHour: 30,
        perMinute: 5,
        concurrency: 1,
        softDailyCap: false, // hard block
    },
    basic: {
        daily: 500,
        perHour: 200,
        perMinute: 20,
        concurrency: 3,
        softDailyCap: true,
    },
    premium: {
        daily: 5_000,
        perHour: 2_000,
        perMinute: 100,
        concurrency: 10,
        softDailyCap: true,
    },
    enterprise: {
        daily: 50_000,
        perHour: 15_000,
        perMinute: 500,
        concurrency: 25,
        softDailyCap: true,
    },
};
export const PLAN_PRICING = {
    free: { cents: 0, display: '$0' },
    basic: { cents: 799, display: '$7.99' },
    premium: { cents: 1999, display: '$19.99' },
    enterprise: { cents: 9900, display: '$99.00' },
};
// ─── API KEY FORMAT ───────────────────────────────────────────────────────────
export const API_KEY_PREFIX = 'vs_live_';
export const API_KEY_BODY_LENGTH = 48; // hex chars (24 random bytes)
export const API_KEY_TOTAL_LENGTH = API_KEY_PREFIX.length + API_KEY_BODY_LENGTH;
export const API_KEY_REGEX = /^vs_live_[0-9a-f]{48}$/;
// ─── SUSPENSION POLICY ────────────────────────────────────────────────────────
/** Hours of grace period after payment failure before account is suspended */
export const PAYMENT_GRACE_PERIOD_HOURS = 72;
/** Hours after payment failure to send first reminder */
export const PAYMENT_REMINDER_1_HOURS = 24;
/** Hours after payment failure to send second (final) reminder */
export const PAYMENT_REMINDER_2_HOURS = 48;
/** Days after suspension before account is marked for deletion */
export const SUSPENSION_DELETION_DAYS = 30;
// ─── MISC ─────────────────────────────────────────────────────────────────────
/** Max accounts per IP per hour at signup */
export const MAX_SIGNUPS_PER_IP_PER_HOUR = 3;
/** Redis key cache TTL for auth validation (seconds) */
export const AUTH_CACHE_TTL_SECONDS = 60;
//# sourceMappingURL=constants.js.map