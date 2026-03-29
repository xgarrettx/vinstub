/**
 * middleware/admin-auth.ts — Admin route authentication.
 *
 * Admin endpoints require two-factor verification on every request:
 *   X-Admin-Key  : Static shared secret (ADMIN_API_KEY env var).
 *                  Used as the first factor — prevents anonymous probing.
 *   X-Admin-TOTP : Time-based one-time password from an authenticator app.
 *                  Uses the ADMIN_TOTP_SECRET env var (base32-encoded seed).
 *
 * Both headers must be present and valid. Either failure returns 401.
 *
 * This is intentionally simple for an internal ops tool. If the admin
 * surface expands significantly, replace with a full admin login flow
 * using the admin_users table (which already exists in the schema).
 *
 * TOTP parameters:
 *   Algorithm : SHA-1 (RFC 6238 default, compatible with all authenticators)
 *   Digits    : 6
 *   Period    : 30 seconds
 *   Window    : ±1 step (allows up to 30s clock skew)
 */
import type { preHandlerHookHandler } from 'fastify';
import { authenticator } from 'otplib';
import { env } from '../config/env.js';

// Configure otplib to match standard TOTP parameters
authenticator.options = {
  digits: 6,
  step: 30,
  window: 1, // Accept current ±1 step windows
};

export const adminAuth: preHandlerHookHandler = async (request, reply) => {
  const apiKey = request.headers['x-admin-key'];
  const totp = request.headers['x-admin-totp'];

  // Constant-time comparison to prevent timing attacks on the API key
  if (
    typeof apiKey !== 'string' ||
    !timingSafeEqual(apiKey, env.ADMIN_API_KEY)
  ) {
    return reply.status(401).send({
      success: false,
      error: 'unauthorized',
      message: 'Invalid or missing admin credentials.',
    });
  }

  if (typeof totp !== 'string' || !authenticator.verify({ token: totp, secret: env.ADMIN_TOTP_SECRET })) {
    return reply.status(401).send({
      success: false,
      error: 'invalid_totp',
      message: 'Invalid or expired TOTP code.',
    });
  }
};

/**
 * Constant-time string comparison to prevent timing side-channel attacks.
 * Falls back to false immediately if lengths differ (length is safe to leak).
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}
