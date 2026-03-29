/**
 * routes/v1/billing.ts — Checkout session creation.
 *
 * POST /v1/account/checkout?plan=basic
 *
 * Creates a Stripe Checkout Session and returns the hosted page URL.
 * The client should redirect to the URL immediately.
 *
 * Auth: JWT (dashboard session — not API key)
 * The user must be logged in to upgrade; we need their email to pre-fill
 * the Stripe checkout form.
 */
import type { FastifyPluginAsync } from 'fastify';
import { eq } from 'drizzle-orm';
import { jwtAuth } from '../../middleware/auth.js';
import { createCheckoutSession } from '../../services/billing.service.js';
import { db } from '../../db/index.js';
import { users } from '../../db/schema/index.js';
import type { Plan } from '@vinstub/shared/types.js';

const UPGRADEABLE_PLANS = ['basic', 'premium', 'enterprise'] as const;
type UpgradeablePlan = (typeof UPGRADEABLE_PLANS)[number];

const billingRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post('/account/checkout', {
    preHandler: [jwtAuth],
    schema: {
      tags: ['Billing'],
      summary: 'Create Stripe Checkout session',
      description:
        'Returns a Stripe Checkout URL for subscribing to a paid plan. ' +
        'Redirect the user to this URL immediately — it expires after 24 hours. ' +
        'Requires dashboard session (JWT).',
      querystring: {
        type: 'object',
        required: ['plan'],
        additionalProperties: false,
        properties: {
          plan: {
            type: 'string',
            enum: UPGRADEABLE_PLANS,
            description: 'Target plan to subscribe to',
          },
        },
      },
      response: {
        200: {
          description: 'Checkout session created',
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            url: {
              type: 'string',
              description: 'Stripe Checkout hosted page URL. Redirect the user here.',
            },
          },
        },
        400: { $ref: 'ErrorResponse#' },
        401: { $ref: 'ErrorResponse#' },
        409: { $ref: 'ErrorResponse#' },
      },
    },
  }, async (request, reply) => {
    const { plan } = request.query as { plan: UpgradeablePlan };
    const user = request.user!;

    // Fetch email + current plan + existing Stripe customer ID
    const rows = await db
      .select({
        email: users.email,
        currentPlan: users.plan,
        stripeCustomerId: users.stripeCustomerId,
      })
      .from(users)
      .where(eq(users.id, user.userId))
      .limit(1);

    if (!rows.length) {
      return reply.status(401).send({
        success: false,
        error: 'unauthorized',
        message: 'User not found.',
        request_id: request.id,
      });
    }

    const { email, currentPlan, stripeCustomerId } = rows[0]!;

    // Prevent "upgrading" to the same plan they already have
    if (currentPlan === plan) {
      return reply.status(409).send({
        success: false,
        error: 'already_on_plan',
        message: `You are already on the ${plan} plan.`,
        request_id: request.id,
      });
    }

    const { url } = await createCheckoutSession(
      user.userId,
      plan,
      email,
      stripeCustomerId,
    );

    return reply.status(200).send({ success: true, url });
  });
};

export default billingRoutes;
