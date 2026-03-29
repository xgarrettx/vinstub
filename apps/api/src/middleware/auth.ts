/**
 * middleware/auth.ts — Bearer token authentication.
 *
 * Validates the API key in the Authorization header, resolves the user's
 * plan and account status, and attaches a UserContext to request.user.
 *
 * Performance strategy:
 *   1. Validate token format with regex (< 1ms, zero I/O)
 *   2. SHA-256 hash the token (< 1ms)
 *   3. Check Redis auth cache (key:hash:{hash}) — 60s TTL
 *   4. On cache miss: query Postgres api_keys JOIN users, write to cache
 *
 * At 500 req/min this means ~1 DB query per key every 60 seconds,
 * not 500 DB queries per minute.
 *
 * Export both a preHandler function (for individual routes) and a
 * Fastify plugin (for registering on route groups).
 */
import type { FastifyRequest, FastifyReply, preHandlerHookHandler } from 'fastify';
import crypto from 'node:crypto';
import { eq, and } from 'drizzle-orm';
import { db } from '../db/index.js';
import { apiKeys, users } from '../db/schema/index.js';
import {
  getAuthCache,
  setAuthCache,
  type AuthCacheEntry,
} from '../redis/index.js';
import type { UserContext } from 'shared';
import { API_KEY_REGEX } from 'shared';

// ─── HELPERS ──────────────────────────────────────────────────────────────────

/** SHA-256 hex digest of a raw API key string. */
export function hashApiKey(rawKey: string): string {
  return crypto.createHash('sha256').update(rawKey).digest('hex');
}

/** Extract the Bearer token from an Authorization header value. */
function extractBearer(header: string | undefined): string | null {
  if (!header) return null;
  if (!header.startsWith('Bearer ')) return null;
  return header.slice(7).trim();
}

// ─── CORE VALIDATION FUNCTION ─────────────────────────────────────────────────

/**
 * Validates a raw API key string.
 * Returns a UserContext on success, or null if invalid/not found.
 *
 * Exported for reuse in tests and the admin key-reset flow.
 */
export async function validateApiKey(rawKey: string): Promise<UserContext | null> {
  // 1. Format check — regex validates prefix + 48 hex chars
  if (!API_KEY_REGEX.test(rawKey)) return null;

  // 2. Hash
  const keyHash = hashApiKey(rawKey);

  // 3. Redis cache check
  const cached = await getAuthCache(keyHash);
  if (cached) {
    return {
      userId: cached.userId,
      plan: cached.plan as UserContext['plan'],
      accountStatus: cached.accountStatus as UserContext['accountStatus'],
    };
  }

  // 4. Database lookup — JOIN api_keys and users in one query
  const rows = await db
    .select({
      userId: users.id,
      plan: users.plan,
      accountStatus: users.accountStatus,
      isActive: apiKeys.isActive,
    })
    .from(apiKeys)
    .innerJoin(users, eq(apiKeys.userId, users.id))
    .where(and(eq(apiKeys.keyHash, keyHash), eq(apiKeys.isActive, true)))
    .limit(1);

  if (rows.length === 0) return null;

  const row = rows[0]!;

  // 5. Write to Redis cache
  const entry: AuthCacheEntry = {
    userId: row.userId,
    plan: row.plan,
    accountStatus: row.accountStatus,
  };
  await setAuthCache(keyHash, entry);

  // 6. Update last_used_at asynchronously (don't block the request)
  setImmediate(() => {
    db.update(apiKeys)
      .set({ lastUsedAt: new Date() })
      .where(eq(apiKeys.keyHash, keyHash))
      .catch((err) => console.error('[auth] failed to update last_used_at:', err));
  });

  return {
    userId: row.userId,
    plan: row.plan as UserContext['plan'],
    accountStatus: row.accountStatus as UserContext['accountStatus'],
  };
}

// ─── PREHANDLER MIDDLEWARE ────────────────────────────────────────────────────

/**
 * bearerAuth — Fastify preHandler hook.
 * Add to any route that requires a valid API key:
 *
 *   fastify.get('/v1/stub', { preHandler: [bearerAuth] }, handler)
 *
 * On success: attaches request.user and continues.
 * On failure: replies immediately with 401 or 403.
 */
export const bearerAuth: preHandlerHookHandler = async (
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  const token = extractBearer(request.headers.authorization);

  if (!token) {
    return reply.status(401).send({
      success: false,
      error: 'unauthorized',
      message: 'Missing Authorization header. Use: Authorization: Bearer <api-key>',
      request_id: request.id,
    });
  }

  // Quick format check before any I/O
  if (!API_KEY_REGEX.test(token)) {
    return reply.status(401).send({
      success: false,
      error: 'unauthorized',
      message: 'Invalid API key format.',
      request_id: request.id,
    });
  }

  const user = await validateApiKey(token);

  if (!user) {
    return reply.status(401).send({
      success: false,
      error: 'unauthorized',
      message: 'API key not found or has been revoked.',
      request_id: request.id,
    });
  }

  // Account must not be suspended
  if (user.accountStatus === 'suspended') {
    return reply.status(403).send({
      success: false,
      error: 'account_suspended',
      message:
        'Your account has been suspended. Please resolve your outstanding balance at app.vinstub.com.',
      request_id: request.id,
    });
  }

  // Safety check — should never happen since we require email verification
  // before issuing an API key, but defend in depth
  if (user.accountStatus === 'pending_verification') {
    return reply.status(403).send({
      success: false,
      error: 'email_not_verified',
      message: 'Please verify your email address before using the API.',
      request_id: request.id,
    });
  }

  // Attach user context for downstream middleware and handlers
  request.user = user;
};

// ─── JWT AUTH (for dashboard routes) ─────────────────────────────────────────
// Defined here to keep all auth in one file.

import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { isRefreshJtiValid } from '../redis/index.js';

export interface JwtPayload {
  sub: string;      // user_id
  plan: string;
  type: 'access' | 'refresh';
  jti?: string;     // refresh tokens only
  iat: number;
  exp: number;
}

export function signAccessToken(userId: string, plan: string): string {
  return jwt.sign(
    { sub: userId, plan, type: 'access' },
    env.JWT_SECRET,
    { expiresIn: env.JWT_ACCESS_EXPIRY },
  );
}

export function signRefreshToken(userId: string, jti: string): string {
  return jwt.sign(
    { sub: userId, type: 'refresh', jti },
    env.REFRESH_SECRET,
    { expiresIn: env.JWT_REFRESH_EXPIRY },
  );
}

export function verifyAccessToken(token: string): JwtPayload {
  return jwt.verify(token, env.JWT_SECRET) as JwtPayload;
}

export function verifyRefreshToken(token: string): JwtPayload {
  return jwt.verify(token, env.REFRESH_SECRET) as JwtPayload;
}

/**
 * jwtAuth — Fastify preHandler for dashboard/account-management routes.
 * Validates the JWT access token from the Authorization header (same header,
 * same Bearer format — the token just starts with "ey" not "vs_live_").
 */
export const jwtAuth: preHandlerHookHandler = async (
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  const token = extractBearer(request.headers.authorization);

  if (!token) {
    return reply.status(401).send({
      success: false,
      error: 'unauthorized',
      message: 'Missing Authorization header.',
      request_id: request.id,
    });
  }

  let payload: JwtPayload;
  try {
    payload = verifyAccessToken(token);
  } catch {
    return reply.status(401).send({
      success: false,
      error: 'unauthorized',
      message: 'Invalid or expired access token. Please log in again.',
      request_id: request.id,
    });
  }

  if (payload.type !== 'access') {
    return reply.status(401).send({
      success: false,
      error: 'unauthorized',
      message: 'Token type mismatch.',
      request_id: request.id,
    });
  }

  // Load fresh user data from DB to get current account_status
  const userRows = await db
    .select({ plan: users.plan, accountStatus: users.accountStatus })
    .from(users)
    .where(eq(users.id, payload.sub))
    .limit(1);

  if (userRows.length === 0) {
    return reply.status(401).send({
      success: false,
      error: 'unauthorized',
      message: 'User not found.',
      request_id: request.id,
    });
  }

  const user = userRows[0]!;

  request.user = {
    userId: payload.sub,
    plan: user.plan as UserContext['plan'],
    accountStatus: user.accountStatus as UserContext['accountStatus'],
  };
};
