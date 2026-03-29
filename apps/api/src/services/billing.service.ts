/**
 * services/billing.service.ts — Stripe billing lifecycle logic.
 *
 * All Stripe webhook event handlers live here. The webhook route
 * (routes/webhooks/stripe.ts) handles signature verification and
 * idempotency, then delegates to these handlers.
 *
 * Plan → Stripe price ID mapping is in env:
 *   STRIPE_PRICE_BASIC, STRIPE_PRICE_PREMIUM, STRIPE_PRICE_ENTERPRISE
 *
 * Checkout flow:
 *   1. User calls POST /v1/account/checkout?plan=basic
 *   2. createCheckoutSession() creates a Stripe Checkout Session with
 *      metadata.userId so we can identify the user in the webhook.
 *   3. User completes payment on Stripe-hosted page.
 *   4. Stripe fires checkout.session.completed → handleCheckoutCompleted().
 *   5. We update the user's plan, stripe_customer_id, stripe_subscription_id.
 *
 * Grace period / suspension flow:
 *   invoice.payment_failed  → set payment_failed_at, send email
 *   (72h passes via cron)   → account suspended
 *   invoice.payment_succeeded → clear payment_failed_at, reactivate if suspended
 */
import { eq } from 'drizzle-orm';
import type Stripe from 'stripe';
import { stripe } from '../config/stripe.js';
import { env } from '../config/env.js';
import { db } from '../db/index.js';
import { users } from '../db/schema/index.js';
import { invalidateAuthCache } from '../redis/index.js';
import { sendEmail } from './email.service.js';
import type { Plan } from '@vinstub/shared/types.js';

// ─── PRICE ID → PLAN MAPPING ──────────────────────────────────────────────────

const PRICE_TO_PLAN: Record<string, Plan> = {
  [env.STRIPE_PRICE_BASIC]: 'basic',
  [env.STRIPE_PRICE_PREMIUM]: 'premium',
  [env.STRIPE_PRICE_ENTERPRISE]: 'enterprise',
};

function planFromPriceId(priceId: string): Plan | null {
  return PRICE_TO_PLAN[priceId] ?? null;
}

// ─── CHECKOUT SESSION ─────────────────────────────────────────────────────────

/**
 * Create a Stripe Checkout Session for a new or upgrade subscription.
 *
 * @param userId      - Internal user ID (stored in session metadata)
 * @param plan        - Target plan ('basic' | 'premium' | 'enterprise')
 * @param email       - Pre-fill the checkout email field
 * @param customerId  - Existing Stripe customer ID if user has one
 */
export async function createCheckoutSession(
  userId: string,
  plan: Exclude<Plan, 'free'>,
  email: string,
  customerId?: string | null,
): Promise<{ url: string }> {
  const priceMap: Record<Exclude<Plan, 'free'>, string> = {
    basic: env.STRIPE_PRICE_BASIC,
    premium: env.STRIPE_PRICE_PREMIUM,
    enterprise: env.STRIPE_PRICE_ENTERPRISE,
  };

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    payment_method_types: ['card'],
    line_items: [{ price: priceMap[plan], quantity: 1 }],
    metadata: { userId, plan },
    ...(customerId ? { customer: customerId } : { customer_email: email }),
    subscription_data: {
      metadata: { userId },
    },
    success_url: `${env.APP_BASE_URL}/dashboard/account?upgraded=1`,
    cancel_url: `${env.APP_BASE_URL}/dashboard/account?upgrade_cancelled=1`,
    allow_promotion_codes: true,
  });

  if (!session.url) throw new Error('Stripe did not return a checkout URL.');
  return { url: session.url };
}

// ─── WEBHOOK HANDLERS ─────────────────────────────────────────────────────────

/**
 * checkout.session.completed
 *
 * Fired when a user completes the Stripe Checkout flow.
 * Sets the user's plan, stripeCustomerId, stripeSubscriptionId, and
 * marks billing_status as 'active'.
 */
export async function handleCheckoutCompleted(
  session: Stripe.Checkout.Session,
): Promise<void> {
  const userId = session.metadata?.['userId'];
  if (!userId) {
    throw new Error('checkout.session.completed: missing metadata.userId');
  }

  const plan = (session.metadata?.['plan'] as Plan) ?? 'free';
  const customerId =
    typeof session.customer === 'string' ? session.customer : session.customer?.id ?? null;
  const subscriptionId =
    typeof session.subscription === 'string'
      ? session.subscription
      : session.subscription?.id ?? null;

  await db
    .update(users)
    .set({
      plan,
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscriptionId,
      billingStatus: 'active' as any,
      paymentFailedAt: null,
      suspendedAt: null,
      accountStatus: 'active' as any,
    } as any)
    .where(eq(users.id, userId));

  await invalidateUserCacheByUserId(userId);

  await sendEmail('payment_confirmed', undefined, { plan }, false).catch(() => {/* fire-and-forget */});
}

/**
 * invoice.payment_succeeded
 *
 * Fired on every successful payment (recurring or first).
 * Clears any payment failure state and reactivates suspended accounts.
 */
export async function handleInvoicePaymentSucceeded(
  invoice: Stripe.Invoice,
): Promise<void> {
  const customerId =
    typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id;
  if (!customerId) return;

  const rows = await db
    .select({ id: users.id, accountStatus: users.accountStatus, email: users.email })
    .from(users)
    .where(eq(users.stripeCustomerId, customerId))
    .limit(1);

  if (!rows.length) return;
  const user = rows[0]!;

  await db
    .update(users)
    .set({
      billingStatus: 'active' as any,
      paymentFailedAt: null,
      suspendedAt: null,
      accountStatus: 'active' as any,
    } as any)
    .where(eq(users.id, user.id));

  await invalidateUserCacheByUserId(user.id);

  // Only send reactivation email if account was actually suspended
  if (user.accountStatus === 'suspended') {
    await sendEmail('account_reactivated', user.email, {}, false).catch(() => {});
  }
}

/**
 * invoice.payment_failed
 *
 * Starts the 72-hour grace period. Sets billing_status to 'payment_failed'
 * and records the timestamp. The suspend-accounts cron job checks this
 * timestamp and suspends after 72 hours.
 */
export async function handleInvoicePaymentFailed(
  invoice: Stripe.Invoice,
): Promise<void> {
  const customerId =
    typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id;
  if (!customerId) return;

  const rows = await db
    .select({ id: users.id, email: users.email, paymentFailedAt: users.paymentFailedAt })
    .from(users)
    .where(eq(users.stripeCustomerId, customerId))
    .limit(1);

  if (!rows.length) return;
  const user = rows[0]!;

  // Only set paymentFailedAt on the FIRST failure — don't reset the 72h clock
  // on subsequent Stripe retries.
  const now = new Date();
  await db
    .update(users)
    .set({
      billingStatus: 'payment_failed' as any,
      paymentFailedAt: user.paymentFailedAt ?? now,
    } as any)
    .where(eq(users.id, user.id));

  await invalidateUserCacheByUserId(user.id);

  await sendEmail('payment_failed', user.email, { gracePeriodHours: String(72) }, true).catch(() => {});
}

/**
 * customer.subscription.updated
 *
 * Handles plan upgrades/downgrades initiated via the Stripe Customer Portal.
 * Reads the first subscription item's price ID to determine the new plan.
 */
export async function handleSubscriptionUpdated(
  subscription: Stripe.Subscription,
): Promise<void> {
  const customerId =
    typeof subscription.customer === 'string'
      ? subscription.customer
      : subscription.customer?.id;
  if (!customerId) return;

  const priceId = subscription.items.data[0]?.price.id;
  if (!priceId) return;

  const newPlan = planFromPriceId(priceId);
  if (!newPlan) return; // Unknown price — ignore

  const rows = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.stripeCustomerId, customerId))
    .limit(1);

  if (!rows.length) return;

  await db
    .update(users)
    .set({ plan: newPlan } as any)
    .where(eq(users.id, rows[0]!.id));

  await invalidateUserCacheByUserId(rows[0]!.id);
}

/**
 * customer.subscription.deleted
 *
 * Subscription cancelled (end of period reached or immediate cancellation).
 * Downgrades user to free plan and clears subscription ID.
 */
export async function handleSubscriptionDeleted(
  subscription: Stripe.Subscription,
): Promise<void> {
  const customerId =
    typeof subscription.customer === 'string'
      ? subscription.customer
      : subscription.customer?.id;
  if (!customerId) return;

  const rows = await db
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(eq(users.stripeCustomerId, customerId))
    .limit(1);

  if (!rows.length) return;
  const user = rows[0]!;

  await db
    .update(users)
    .set({
      plan: 'free',
      stripeSubscriptionId: null,
      billingStatus: 'active' as any,
      paymentFailedAt: null,
      suspendedAt: null,
      accountStatus: 'active' as any,
    } as any)
    .where(eq(users.id, user.id));

  await invalidateUserCacheByUserId(user.id);

  await sendEmail('subscription_cancelled', user.email, {}, false).catch(() => {});
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────

/**
 * Invalidate the Redis auth cache for a user by their internal userId.
 * Must look up the active API key hash to know which cache entry to bust.
 */
async function invalidateUserCacheByUserId(userId: string): Promise<void> {
  const { apiKeys } = await import('../db/schema/index.js');
  const { eq: eqInner, and } = await import('drizzle-orm');

  const keyRows = await db
    .select({ keyHash: apiKeys.keyHash })
    .from(apiKeys)
    .where(eqInner(apiKeys.userId, userId));

  await Promise.all(keyRows.map((r) => invalidateAuthCache(r.keyHash)));
}
