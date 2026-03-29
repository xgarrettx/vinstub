/**
 * app.ts — Fastify application factory.
 *
 * Registers all plugins and routes. Returns a configured Fastify instance
 * without starting the server — this separation makes testing easier.
 */
import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import sensible from '@fastify/sensible';
import * as Sentry from '@sentry/node';
import { env } from './config/env.js';
import { registerOpenApi } from './openapi.js';

// Routes — all files use `export default`, so import without braces
import authRoutes from './routes/auth/index.js';
import stubRoutes from './routes/v1/stub.js';
import accountRoutes from './routes/v1/account.js';
import billingRoutes from './routes/v1/billing.js';
import makesRoutes from './routes/v1/makes.js';
import modelsRoutes from './routes/v1/models.js';
import healthRoutes from './routes/v1/health.js';
import stripeWebhookRoutes from './routes/webhooks/stripe.js';
import adminRoutes from './routes/admin/index.js';

export async function buildApp(): Promise<FastifyInstance> {
  // ── Sentry ─────────────────────────────────────────────────────────────────
  if (env.SENTRY_DSN) {
    Sentry.init({
      dsn: env.SENTRY_DSN,
      environment: env.NODE_ENV,
      tracesSampleRate: env.NODE_ENV === 'production' ? 0.1 : 1.0,
    });
  }

  // ── Fastify instance ────────────────────────────────────────────────────────
  const app = Fastify({
    logger: {
      level: env.NODE_ENV === 'production' ? 'info' : 'debug',
      // Pino pretty-print in dev
      ...(env.NODE_ENV !== 'production' && {
        transport: { target: 'pino-pretty', options: { colorize: true } },
      }),
    },
    // Raw body needed for Stripe webhook signature verification
    addContentTypeParser: false as never, // handled per-route for /webhooks/stripe
    trustProxy: true, // DigitalOcean App Platform sits behind a load balancer
    requestIdHeader: 'x-request-id',
    requestIdLogLabel: 'request_id',
    genReqId: () => `req_${Math.random().toString(36).slice(2, 14)}`,
  });

  // ── Core plugins ────────────────────────────────────────────────────────────
  await app.register(sensible);

  await app.register(cors, {
    origin:
      env.NODE_ENV === 'production'
        ? [env.APP_URL, env.APP_BASE_URL]
        : true, // allow all origins in dev
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });

  await app.register(cookie, {
    secret: env.REFRESH_SECRET, // signs cookies
    hook: 'onRequest',
  });

  // ── OpenAPI / Swagger ───────────────────────────────────────────────────────
  await registerOpenApi(app);

  // ── Parse raw body for Stripe webhook (must come before route registration) ─
  app.addContentTypeParser(
    'application/json',
    { parseAs: 'buffer' },
    (req, body, done) => {
      // Attach raw buffer so Stripe can verify the signature
      (req as unknown as { rawBody: Buffer }).rawBody = body as Buffer;
      try {
        done(null, JSON.parse((body as Buffer).toString()));
      } catch (err) {
        done(err as Error, undefined);
      }
    },
  );

  // ── Request ID header on every response ─────────────────────────────────────
  app.addHook('onSend', async (request, reply) => {
    reply.header('X-Request-Id', request.id);
  });

  // ── Routes ──────────────────────────────────────────────────────────────────
  await app.register(healthRoutes, { prefix: '/v1' });
  await app.register(makesRoutes, { prefix: '/v1' });
  await app.register(modelsRoutes, { prefix: '/v1' });
  await app.register(stubRoutes, { prefix: '/v1' });
  await app.register(accountRoutes, { prefix: '/v1' });
  await app.register(billingRoutes, { prefix: '/v1' });
  await app.register(authRoutes, { prefix: '/auth' });
  await app.register(stripeWebhookRoutes, { prefix: '/webhooks' });
  await app.register(adminRoutes, { prefix: '/admin' });

  // ── Global error handler ────────────────────────────────────────────────────
  app.setErrorHandler(async (error, request, reply) => {
    if (env.SENTRY_DSN) {
      Sentry.withScope((scope) => {
        scope.setTag('request_id', String(request.id));
        Sentry.captureException(error);
      });
    }

    request.log.error({ err: error, request_id: request.id }, 'unhandled error');

    // Don't expose internal error details in production
    const statusCode = error.statusCode ?? 500;
    return reply.status(statusCode).send({
      success: false,
      error: 'internal_error',
      message:
        env.NODE_ENV === 'production'
          ? 'An unexpected error occurred.'
          : error.message,
      request_id: request.id,
    });
  });

  return app;
}
