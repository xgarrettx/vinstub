/**
 * redis/index.ts — ioredis client singleton + typed helpers.
 *
 * All Redis interactions in the app go through these helpers so:
 *  - Key naming is consistent and documented in one place
 *  - Error handling is centralized
 *  - Tests can mock a single module
 */
import Redis from 'ioredis';
import { env } from '../config/env.js';

// ─── CLIENT ───────────────────────────────────────────────────────────────────

let _client: Redis | null = null;

export function getRedis(): Redis {
  if (!_client) {
    _client = new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => Math.min(times * 100, 3000),
      enableReadyCheck: true,
      lazyConnect: false,
    });

    _client.on('error', (err) => {
      // Don't crash on Redis errors — the rate-limit middleware handles disconnects
      console.error('[redis] connection error:', err.message);
    });
  }
  return _client;
}

export async function closeRedis(): Promise<void> {
  if (_client) {
    await _client.quit();
    _client = null;
  }
}

/**
 * Lazy singleton — use this everywhere instead of calling getRedis() directly.
 * The Proxy defers client creation until the first method call, so importing
 * this module doesn't immediately open a Redis connection (useful for scripts
 * and tests that may not need Redis).
 */
export const redis: Redis = new Proxy({} as Redis, {
  get(_target, prop: string | symbol) {
    return Reflect.get(getRedis(), prop as string);
  },
});

// ─── KEY SCHEMA ───────────────────────────────────────────────────────────────
// Centralised key builders — one place to see every Redis key used in the system.

/** Per-minute rate-limit counter */
export const Keys = {
  rateLimitMinute: (userId: string, minuteFloor: number) =>
    `rl:min:${userId}:${minuteFloor}`,

  rateLimitHour: (userId: string, hourFloor: number) =>
    `rl:hr:${userId}:${hourFloor}`,

  rateLimitDay: (userId: string, dateStr: string) =>
    `rl:day:${userId}:${dateStr}`,

  /** Auth cache — key hash → {user_id, plan, account_status} */
  authCache: (keyHash: string) => `key:hash:${keyHash}`,

  /** JWT refresh token invalidation set */
  refreshJti: (jti: string) => `jti:${jti}`,

  /** Cached /v1/makes response */
  makesList: () => `ref:makes`,

  /** Cached /v1/models?make= response */
  modelsList: (makeNormalized: string) => `ref:models:${makeNormalized}`,

  /** Signup throttle per IP */
  signupIp: (ip: string) => `signup:ip:${ip}`,
} as const;

// ─── TTL CONSTANTS (seconds) ──────────────────────────────────────────────────

export const TTL = {
  rateLimitMinute: 90,       // 1.5× the window so late requests don't get missed
  rateLimitHour: 7200,       // 2× the window
  rateLimitDay: 172_800,     // 2 days — survives UTC midnight rollover
  authCache: 60,             // 1 minute — fast key validation, tolerates 60s revocation lag
  makesList: 300,            // 5 minutes
  modelsList: 300,
  signupIp: 3600,            // 1 hour
  refreshToken: 604_800,     // 7 days
} as const;

// ─── TYPED HELPERS ────────────────────────────────────────────────────────────

export interface AuthCacheEntry {
  userId: string;
  plan: string;
  accountStatus: string;
}

/** Write an auth cache entry. Returns the Redis response. */
export async function setAuthCache(keyHash: string, entry: AuthCacheEntry): Promise<void> {
  const redis = getRedis();
  await redis.setex(Keys.authCache(keyHash), TTL.authCache, JSON.stringify(entry));
}

/** Read an auth cache entry. Returns null on miss. */
export async function getAuthCache(keyHash: string): Promise<AuthCacheEntry | null> {
  const redis = getRedis();
  const raw = await redis.get(Keys.authCache(keyHash));
  if (!raw) return null;
  return JSON.parse(raw) as AuthCacheEntry;
}

/** Evict an auth cache entry (on key rotation/revocation). */
export async function invalidateAuthCache(keyHash: string): Promise<void> {
  const redis = getRedis();
  await redis.del(Keys.authCache(keyHash));
}

/** Store a refresh token JTI so it can be invalidated on logout/rotation. */
export async function storeRefreshJti(jti: string): Promise<void> {
  const redis = getRedis();
  await redis.setex(Keys.refreshJti(jti), TTL.refreshToken, '1');
}

/** Returns true if the JTI is still valid (not revoked). */
export async function isRefreshJtiValid(jti: string): Promise<boolean> {
  const redis = getRedis();
  const val = await redis.get(Keys.refreshJti(jti));
  return val === '1';
}

/** Revoke a refresh token JTI. */
export async function revokeRefreshJti(jti: string): Promise<void> {
  const redis = getRedis();
  await redis.del(Keys.refreshJti(jti));
}

/** Increment signup IP counter. Returns new count. */
export async function incrementSignupIp(ip: string): Promise<number> {
  const redis = getRedis();
  const key = Keys.signupIp(ip);
  const count = await redis.incr(key);
  if (count === 1) await redis.expire(key, TTL.signupIp);
  return count;
}
