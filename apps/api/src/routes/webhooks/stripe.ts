/**
 * routes/webhooks/stripe.ts — Stripe webhook receiver.
 *
 * Security:
 *   - Signature verified via stripe.webhooks.constructEvent() using the
 *     raw request body (Buffer stored on req.rawBody by the content-type
 *     parser in app.ts). Do NOT parse the body before this step.
 *   - Idempotency enforced via the webhook_events table keyed on
 *     stripe_event_id. Duplicate deliveries return 200 immediately.
 *
 * Event routing:
 *   checkout.session.completed       → handleCheckoutCompleted
 *   invoice.payment_succeeded        → handleInvoicePaymentSucceeded
 *   invoice.payment_failed           → handleInvoicePaymentFailed
 *   customer.subscription.updated   → handleSubscriptionUpdated
 *   customer.subscription.deleted   → handleSubscriptionDeleted
 *
 * Unknown event types are acknowledged (200) and ignored — Stripe will
 * not retry an acknowledged event.
 */
import type { FastifyPluginAsync } from 'fastify';
import { stripe } from '../../config/stripe.js';
import { env } from '../../config/env.js';
import { db } from '../../db/index.js';
import { webhookEvents } from '../../db/schema/index.js';
import {
  handleCheckoutCompleted,
  handleInvoicePaymentSucceeded,
  handleInvoicePaymentFailed,
  handleSubscriptionUpdated,
  handleSubscriptionDeleted,
} from '../../services/billing.service.js';

const stripeWebhookRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post('/stripe', {
    // Disable Fastify's automatic JSON body parsing for this route —
    // we need the raw Buffer for Stripe signature verification.
    config: { rawBody: true },
    schema: {
      tags: ['Webhooks'],
      summary: 'Stripe webhook receiver',
      description: 'Internal endpoint — not for direct use. Verifies Stripe signature and processes billing events.',
      // Intentionally minimal schema — body is arbitrary Stripe JSON
      response: {
        200: {
          type: 'object',
          properties: {
            received: { type: 'boolean' },
          },
        },
      },
    },
  }, async (request, reply) => {
    const sig = request.headers['stripe-signature'];

    if (!sig || typeof sig !== 'string') {
      return reply.status(400).send({ error: 'Missing stripe-signature header.' });
    }

    // rawBody is populated by the content-type override parser in app.ts
    if (!request.rawBody || request.rawBody.length === 0) {
      return reply.status(400).send({ error: 'Empty request body.' });
    }

    // ── Signature verification ──────────────────────────────────────────────
    let event;
    try {
      event = stripe.webhooks.constructEvent(
        request.rawBody,
        sig,
        env.STRIPE_WEBHOOK_SECRET,
      );
    } catch (err) {
      fastify.log.warn({ err }, '[stripe-webhook] signature verification failed');
      return reply.status(400).send({
        error: `Webhook signature verification failed: ${(err as Error).message}`,
      });
    }

    // ── Idempotency check ───────────────────────────────────────────────────
    // Insert the event ID first. If it already exists (duplicate delivery),
    // the INSERT will fail with a unique violation and we return 200 immediately.
    try {
      await db.insert(webhookEvents).values({
        stripeEventId: event.id,
        eventType: event.type,
        processedAt: new Date(),
      });
    } catch (err: any) {
      // Unique violation = duplicate event
      if (err?.code === '23505') {
        fastify.log.info({ eventId: event.id }, '[stripe-webhook] duplicate event — skipping');
        return reply.status(200).send({ received: true });
      }
      throw err;
    }

    // ── Event routing ───────────────────────────────────────────────────────
    try {
      switch (event.type) {
        case 'checkout.session.completed':
          await handleCheckoutCompleted(event.data.object as any);
          break;

        case 'invoice.payment_succeeded':
          await handleInvoicePaymentSucceeded(event.data.object as any);
          break;

        case 'invoice.payment_failed':
          await handleInvoicePaymentFailed(event.data.object as any);
          break;

        case 'customer.subscription.updated':
          await handleSubscriptionUpdated(event.data.object as any);
          break;

        case 'customer.subscription.deleted':
          await handleSubscriptionDeleted(event.data.object as any);
          break;

        default:
          fastify.log.debug({ type: event.type }, '[stripe-webhook] unhandled event type — acknowledged');
      }
    } catch (err) {
      // Log the error but return 200 to Stripe to prevent retries for
      // application-level errors. Sentry will capture this for alerting.
      fastify.log.error({ err, eventId: event.id, eventType: event.type },
        '[stripe-webhook] handler threw — event acknowledged but processing failed');
    }

    return reply.status(200).send({ received: true });
  });
};

export default stripeWebhookRoutes;
