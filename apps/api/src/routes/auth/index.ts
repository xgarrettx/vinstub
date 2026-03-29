/**
 * routes/auth/index.ts — Authentication routes plugin.
 *
 * All routes here are public (no auth required).
 * Refresh token is stored as an httpOnly Secure cookie.
 * Access token is returned in the response body for the client to store
 * in memory (never in localStorage).
 *
 * Routes:
 *   POST /auth/register
 *   GET  /auth/verify-email?token=
 *   POST /auth/login
 *   POST /auth/refresh
 *   POST /auth/logout
 *   POST /auth/forgot-password
 *   POST /auth/reset-password
 */
import type { FastifyPluginAsync } from 'fastify';
import {
  register,
  verifyEmail,
  resendVerificationEmail,
  login,
  refreshTokens,
  logout,
  requestPasswordReset,
  resetPassword,
} from '../../services/auth.service.js';
import { env } from '../../config/env.js';

// ─── COOKIE CONFIG ────────────────────────────────────────────────────────────

const REFRESH_COOKIE = 'vs_refresh';
const COOKIE_MAX_AGE = 7 * 24 * 60 * 60; // 7 days in seconds

function setRefreshCookie(reply: Parameters<FastifyPluginAsync>[0]['inject'] extends infer _ ? any : any, token: string) {
  reply.setCookie(REFRESH_COOKIE, token, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax',  // 'strict' blocks cookie on redirects from email links
    path: '/',         // '/' so Next.js middleware can read it across all routes
    maxAge: COOKIE_MAX_AGE,
  });
}

function clearRefreshCookie(reply: any) {
  reply.clearCookie(REFRESH_COOKIE, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
  });
}

// ─── SCHEMAS ──────────────────────────────────────────────────────────────────

const registerBodySchema = {
  type: 'object',
  required: ['email', 'password'],
  additionalProperties: false,
  properties: {
    email: { type: 'string', format: 'email', maxLength: 254 },
    password: { type: 'string', minLength: 8, maxLength: 128 },
  },
} as const;

const loginBodySchema = {
  type: 'object',
  required: ['email', 'password'],
  additionalProperties: false,
  properties: {
    email: { type: 'string', format: 'email', maxLength: 254 },
    password: { type: 'string', minLength: 1, maxLength: 128 },
  },
} as const;

const verifyEmailQuerySchema = {
  type: 'object',
  required: ['token'],
  properties: {
    token: { type: 'string', minLength: 1 },
  },
} as const;

const forgotPasswordBodySchema = {
  type: 'object',
  required: ['email'],
  additionalProperties: false,
  properties: {
    email: { type: 'string', format: 'email', maxLength: 254 },
  },
} as const;

const resetPasswordBodySchema = {
  type: 'object',
  required: ['token', 'password'],
  additionalProperties: false,
  properties: {
    token: { type: 'string', minLength: 1 },
    password: { type: 'string', minLength: 8, maxLength: 128 },
  },
} as const;

// ─── PLUGIN ───────────────────────────────────────────────────────────────────

const authRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * POST /auth/register
   *
   * Creates a new user account and sends a verification email.
   * Does NOT log the user in — they must verify email first.
   */
  fastify.post('/register', {
    schema: {
      tags: ['Auth'],
      summary: 'Register a new account',
      body: registerBodySchema,
      response: {
        201: {
          description: 'Account created; verification email sent',
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            userId: { type: 'string' },
          },
        },
        409: { $ref: 'ErrorResponse#' },
        429: { $ref: 'ErrorResponse#' },
        422: { $ref: 'ErrorResponse#' },
      },
    },
  }, async (request, reply) => {
    const { email, password } = request.body as { email: string; password: string };

    // Extract real IP — Fastify sets x-forwarded-for when behind a proxy
    const ip =
      (request.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() ??
      request.ip;

    const result = await register(email, password, ip);

    if ('code' in result) {
      if (result.code === 'email_taken') {
        return reply.status(409).send({
          success: false,
          error: result.code,
          message: result.message,
          request_id: request.id,
        });
      }
      if (result.code === 'ip_limit_exceeded') {
        return reply.status(429).send({
          success: false,
          error: result.code,
          message: result.message,
          request_id: request.id,
        });
      }
      // invalid_password
      return reply.status(422).send({
        success: false,
        error: result.code,
        message: result.message,
        request_id: request.id,
      });
    }

    return reply.status(201).send({
      success: true,
      message: 'Account created. Please check your email to verify your address.',
      userId: result.userId,
    });
  });

  /**
   * GET /auth/verify-email?token=
   *
   * Verifies the user's email address. On success, activates the account,
   * generates the user's first API key, and returns the raw key ONE TIME.
   * The raw key is never stored — if lost, the user must rotate.
   */
  fastify.get('/verify-email', {
    schema: {
      tags: ['Auth'],
      summary: 'Verify email address',
      querystring: verifyEmailQuerySchema,
      response: {
        200: {
          description: 'Email verified; API key returned once',
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            userId: { type: 'string' },
            apiKey: {
              type: 'string',
              description: 'Your API key. Save this — it will not be shown again.',
            },
          },
        },
        400: { $ref: 'ErrorResponse#' },
        410: { $ref: 'ErrorResponse#' },
      },
    },
  }, async (request, reply) => {
    const { token } = request.query as { token: string };

    const result = await verifyEmail(token);

    if ('code' in result) {
      const status = result.code === 'token_expired' ? 410 : 400;
      return reply.status(status).send({
        success: false,
        error: result.code,
        message: result.message,
        request_id: request.id,
      });
    }

    return reply.status(200).send({
      success: true,
      message: 'Email verified. Your API key has been generated. Save it now — it will not be shown again.',
      userId: result.userId,
      apiKey: result.rawApiKey,
    });
  });

  /**
   * POST /auth/login
   *
   * Authenticates with email + password.
   * Returns an access token in the body and sets the refresh token
   * as an httpOnly cookie scoped to /auth.
   */
  fastify.post('/login', {
    schema: {
      tags: ['Auth'],
      summary: 'Log in to the dashboard',
      body: loginBodySchema,
      response: {
        200: {
          description: 'Login successful',
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            accessToken: { type: 'string' },
            userId: { type: 'string' },
            plan: { type: 'string' },
          },
        },
        401: { $ref: 'ErrorResponse#' },
        403: { $ref: 'ErrorResponse#' },
      },
    },
  }, async (request, reply) => {
    const { email, password } = request.body as { email: string; password: string };

    const result = await login(email, password);

    if ('code' in result) {
      const status = result.code === 'account_suspended' ? 403 : 401;
      return reply.status(status).send({
        success: false,
        error: result.code,
        message: result.message,
        request_id: request.id,
      });
    }

    setRefreshCookie(reply, result.refreshToken);

    return reply.status(200).send({
      success: true,
      accessToken: result.accessToken,
      userId: result.userId,
      plan: result.plan,
    });
  });

  /**
   * POST /auth/refresh
   *
   * Issues a new access + refresh token pair.
   * Reads the refresh token from the httpOnly cookie.
   * Old refresh token is revoked (rotation).
   */
  fastify.post('/refresh', {
    schema: {
      tags: ['Auth'],
      summary: 'Refresh access token',
      response: {
        200: {
          description: 'Tokens rotated',
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            accessToken: { type: 'string' },
          },
        },
        401: { $ref: 'ErrorResponse#' },
      },
    },
  }, async (request, reply) => {
    const refreshToken = request.cookies?.[REFRESH_COOKIE];

    if (!refreshToken) {
      return reply.status(401).send({
        success: false,
        error: 'unauthorized',
        message: 'No refresh token. Please log in again.',
        request_id: request.id,
      });
    }

    const result = await refreshTokens(refreshToken);

    if ('code' in result) {
      clearRefreshCookie(reply);
      return reply.status(401).send({
        success: false,
        error: result.code,
        message: result.message,
        request_id: request.id,
      });
    }

    setRefreshCookie(reply, result.refreshToken);

    return reply.status(200).send({
      success: true,
      accessToken: result.accessToken,
    });
  });

  /**
   * POST /auth/logout
   *
   * Revokes the refresh token and clears the cookie.
   * Always returns 200 — logout should never fail from the user's perspective.
   */
  fastify.post('/logout', {
    schema: {
      tags: ['Auth'],
      summary: 'Log out',
      response: {
        200: {
          description: 'Logged out',
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
          },
        },
      },
    },
  }, async (request, reply) => {
    const refreshToken = request.cookies?.[REFRESH_COOKIE];

    if (refreshToken) {
      await logout(refreshToken);
    }

    clearRefreshCookie(reply);

    return reply.status(200).send({
      success: true,
      message: 'Logged out successfully.',
    });
  });

  /**
   * POST /auth/forgot-password
   *
   * Sends a password reset email. Always returns 200 to prevent
   * email enumeration — the response is identical whether the address
   * exists or not.
   */
  fastify.post('/forgot-password', {
    schema: {
      tags: ['Auth'],
      summary: 'Request password reset email',
      body: forgotPasswordBodySchema,
      response: {
        200: {
          description: 'Reset email sent (if account exists)',
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
          },
        },
      },
    },
  }, async (request, reply) => {
    const { email } = request.body as { email: string };

    // Fire-and-forget — always respond the same way
    requestPasswordReset(email).catch((err) =>
      fastify.log.error({ err }, '[auth] forgot-password failed'),
    );

    return reply.status(200).send({
      success: true,
      message: 'If an account with that email exists, you will receive a reset link shortly.',
    });
  });

  /**
   * POST /auth/reset-password
   *
   * Resets the password using the token from the email link.
   * Token is single-use and expires in 1 hour.
   */
  fastify.post('/reset-password', {
    schema: {
      tags: ['Auth'],
      summary: 'Reset password using email token',
      body: resetPasswordBodySchema,
      response: {
        200: {
          description: 'Password reset successfully',
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
          },
        },
        400: { $ref: 'ErrorResponse#' },
        410: { $ref: 'ErrorResponse#' },
      },
    },
  }, async (request, reply) => {
    const { token, password } = request.body as { token: string; password: string };

    const result = await resetPassword(token, password);

    if (result && 'code' in result) {
      const status = result.code === 'token_expired' ? 410 : 400;
      return reply.status(status).send({
        success: false,
        error: result.code,
        message: result.message,
        request_id: request.id,
      });
    }

    return reply.status(200).send({
      success: true,
      message: 'Password reset successfully. You can now log in with your new password.',
    });
  });

  /**
   * POST /auth/resend-verification
   *
   * Generates a fresh verification token and resends the email.
   * Always returns 200 to prevent email enumeration.
   */
  fastify.post('/resend-verification', {
    schema: {
      tags: ['Auth'],
      summary: 'Resend email verification link',
      body: {
        type: 'object',
        required: ['email'],
        additionalProperties: false,
        properties: {
          email: { type: 'string', format: 'email', maxLength: 254 },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
          },
        },
      },
    },
  }, async (request, reply) => {
    const { email } = request.body as { email: string };
    await resendVerificationEmail(email);
    return reply.status(200).send({
      success: true,
      message: 'If an unverified account exists for that email, a new verification link has been sent.',
    });
  });
};

export default authRoutes;
