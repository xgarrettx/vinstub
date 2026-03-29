/**
 * services/rate-limit.service.ts — Redis counter helpers for rate limiting.
 *
 * Architecture: Two-layer sliding window.
 *
 *   Layer 1 — Per-minute + per-hour counters (Redis INCR + EXPIREAT)
 *     Key format:
 *       rl:min:{userId}:{minuteFloor}    — floor(now / 60) in seconds
 *       rl:hr:{userId}:{hourFloor}       — floor(now / 3600) in seconds
 *     TTL: set to end of the current window (next minute/hour boundary).
 *     These are HARD limits for ALL plans — 429 is returned when exceeded.
 *
 *   Layer 2 — Daily quota counter (Redis INCR + EXPIREAT)
 *     Key format:
 *       rl:day:{userId}:{YYYY-MM-DD}     — UTC calendar date
 *     TTL: midnight UTC of the next day.
 *     For Free tier: HARD limit (429 when exceeded).
 *     For paid tiers: SOFT cap — request is allowed but X-Soft-Cap-Exceeded: true
 *     is set on the response, and the daily count is still incremented.
 *
 * Usage sync:
 *   The daily Redis counter is the source of truth for in-flight limiting.
 *   A background job (jobs/sync-usage.ts) syncs Redis daily counts to the
 *   api_usage_daily Postgres table every 60 seconds for durable history.
 *
 * Concurrency:
 *   Concurrency limits are enforced at the infrastructure level (DigitalOcean
 *   App Platform autoscaling + connection pool caps). Not tracked here.
 */
import { redis, Keys } from '../redis/index.js';
import { PLAN_LIMITS } from '@vinstub/shared/constants.js';
import type { Plan } from '@vinstub/shared/types.js';

// ─── TYPES ────────────────────────────────────────────────────────────────────

export interface RateLimitCounters {
  minuteCount: number;
  hourCount: number;
  dayCount: number;
}

export interface RateLimitDecision {
  allowed: boolean;
  /** HTTP 429 error code when blocked */
  blockReason?: 'minute_limit' | 'hour_limit' | 'day_limit';
  /** Paid plans only — daily soft cap exceeded but request is allowed */
  softCapExceeded: boolean;
  counters: RateLimitCounters;
  /** Unix timestamp (seconds) when the daily counter resets (midnight UTC) */
  dailyResetAt: number;
  /** Unix timestamp (seconds) when the per-minute counter resets */
  minuteResetAt: number;
}

// ─── TIME HELPERS ─────────────────────────────────────────────────────────────

/** Returns the floor of now in whole minutes (used as Redis key suffix) */
function minuteFloor(): number {
  return Math.floor(Date.now() / 1000 / 60) * 60;
}

/** Returns the floor of now in whole hours (used as Redis key suffix) */
function hourFloor(): number {
  return Math.floor(Date.now() / 1000 / 3600) * 3600;
}

/** Returns today's UTC date as YYYY-MM-DD */
function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Returns the Unix timestamp (seconds) for midnight UTC tomorrow */
function midnightTomorrowUtc(): number {
  const d = new Date();
  d.setUTCHours(24, 0, 0, 0);
  return Math.floor(d.getTime() / 1000);
}

/** Returns the Unix timestamp (seconds) for the start of the next minute */
function nextMinuteBoundary(): number {
  return minuteFloor() + 60;
}

// ─── CORE: INCREMENT ALL COUNTERS ─────────────────────────────────────────────

/**
 * Increment all three counters (minute, hour, day) for the given user
 * atomically using a Redis pipeline. Sets TTL on first write.
 *
 * @returns The post-increment values of all three counters.
 */
export async function incrementCounters(userId: string): Promise<RateLimitCounters> {
  const minKey = Keys.rateLimitMinute(userId, minuteFloor());
  const hrKey = Keys.rateLimitHour(userId, hourFloor());
  const dayKey = Keys.rateLimitDay(userId, todayUtc());

  const minExpire = nextMinuteBoundary();
  const hrExpire = hourFloor() + 3600;
  const dayExpire = midnightTomorrowUtc();

  // Pipeline: INCR + EXPIREAT for each counter.
  // EXPIREAT is idempotent — sets the TTL only if the key already has no expiry,
  // but in practice we always want to extend/confirm the correct expiry window.
  // Using EXPIREAT (absolute epoch) rather than EXPIRE (relative TTL) means the
  // window is always aligned to the clock boundary regardless of when in the
  // minute/hour the key was first created.
  const pipeline = redis.pipeline();
  pipeline.incr(minKey);
  pipeline.expireat(minKey, minExpire);
  pipeline.incr(hrKey);
  pipeline.expireat(hrKey, hrExpire);
  pipeline.incr(dayKey);
  pipeline.expireat(dayKey, dayExpire);

  const results = await pipeline.exec();

  // pipeline.exec() returns [error, result] pairs
  const minuteCount = (results?.[0]?.[1] as number | null) ?? 1;
  const hourCount = (results?.[2]?.[1] as number | null) ?? 1;
  const dayCount = (results?.[4]?.[1] as number | null) ?? 1;

  return { minuteCount, hourCount, dayCount };
}

/**
 * Read all three counters WITHOUT incrementing.
 * Used for inspection (e.g. health dashboards, tests).
 */
export async function peekCounters(userId: string): Promise<RateLimitCounters> {
  const minKey = Keys.rateLimitMinute(userId, minuteFloor());
  const hrKey = Keys.rateLimitHour(userId, hourFloor());
  const dayKey = Keys.rateLimitDay(userId, todayUtc());

  const [minVal, hrVal, dayVal] = await redis.mget(minKey, hrKey, dayKey);

  return {
    minuteCount: minVal ? parseInt(minVal, 10) : 0,
    hourCount: hrVal ? parseInt(hrVal, 10) : 0,
    dayCount: dayVal ? parseInt(dayVal, 10) : 0,
  };
}

// ─── CORE: RATE LIMIT DECISION ────────────────────────────────────────────────

/**
 * Increment counters and return a rate limit decision for the given user/plan.
 *
 * Decision logic:
 *   1. Increment all three counters.
 *   2. Check per-minute: if exceeded → BLOCK (all plans).
 *   3. Check per-hour:   if exceeded → BLOCK (all plans).
 *   4. Check daily:
 *      - Free plan  → BLOCK if exceeded
 *      - Paid plans → ALLOW but set softCapExceeded = true
 *
 * Note: We increment BEFORE checking the limit (optimistic counter).
 * This means the counter is always accurate even for blocked requests.
 * The alternative (check-then-increment) has a TOCTOU race condition.
 */
export async function checkRateLimit(
  userId: string,
  plan: Plan,
): Promise<RateLimitDecision> {
  const limits = PLAN_LIMITS[plan];
  const counters = await incrementCounters(userId);

  const dailyResetAt = midnightTomorrowUtc();
  const minuteResetAt = nextMinuteBoundary();

  // Hard block: per-minute limit exceeded
  if (counters.minuteCount > limits.perMinute) {
    return {
      allowed: false,
      blockReason: 'minute_limit',
      softCapExceeded: false,
      counters,
      dailyResetAt,
      minuteResetAt,
    };
  }

  // Hard block: per-hour limit exceeded
  if (counters.hourCount > limits.perHour) {
    return {
      allowed: false,
      blockReason: 'hour_limit',
      softCapExceeded: false,
      counters,
      dailyResetAt,
      minuteResetAt,
    };
  }

  // Daily quota check
  if (counters.dayCount > limits.daily) {
    if (!limits.softDailyCap) {
      // Free plan: hard block
      return {
        allowed: false,
        blockReason: 'day_limit',
        softCapExceeded: false,
        counters,
        dailyResetAt,
        minuteResetAt,
      };
    }
    // Paid plan: soft cap — allow but signal
    return {
      allowed: true,
      softCapExceeded: true,
      counters,
      dailyResetAt,
      minuteResetAt,
    };
  }

  return {
    allowed: true,
    softCapExceeded: false,
    counters,
    dailyResetAt,
    minuteResetAt,
  };
}

// ─── RESET HELPERS ────────────────────────────────────────────────────────────

/**
 * Reset all rate limit counters for a user.
 * Used by tests and admin tools — not called in the request path.
 */
export async function resetCounters(userId: string): Promise<void> {
  const minKey = Keys.rateLimitMinute(userId, minuteFloor());
  const hrKey = Keys.rateLimitHour(userId, hourFloor());
  const dayKey = Keys.rateLimitDay(userId, todayUtc());

  await redis.del(minKey, hrKey, dayKey);
}
