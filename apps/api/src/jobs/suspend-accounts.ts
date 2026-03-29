/**
 * jobs/suspend-accounts.ts — Grace period enforcement cron.
 *
 * Runs every 15 minutes. Finds all accounts where:
 *   - billing_status = 'payment_failed'
 *   - payment_failed_at < NOW() - 72 hours
 *   - account_status != 'suspended' (not already processed)
 *
 * For each matching account:
 *   1. Sets account_status = 'suspended', suspended_at = NOW()
 *   2. Invalidates Redis auth cache (immediate lockout)
 *   3. Sends suspension notification email
 *
 * Accounts are automatically reactivated by the
 * handleInvoicePaymentSucceeded webhook handler when Stripe processes
 * a successful payment.
 */
import { eq, and, lt, ne, isNotNull } from 'drizzle-orm';
import { db } from '../db/index.js';
import { users, apiKeys } from '../db/schema/index.js';
import { invalidateAuthCache } from '../redis/index.js';
import { sendEmail } from '../services/email.service.js';
import { PAYMENT_GRACE_PERIOD_HOURS as SUSPENSION_GRACE_HOURS } from '@vinstub/shared/constants.js';

export async function runSuspendAccounts(): Promise<void> {
  const cutoff = new Date(Date.now() - SUSPENSION_GRACE_HOURS * 60 * 60 * 1000);

  const staleAccounts = await db
    .select({
      id: users.id,
      email: users.email,
    })
    .from(users)
    .where(
      and(
        eq(users.billingStatus, 'payment_failed'),
        ne(users.accountStatus, 'suspended'),
        isNotNull(users.paymentFailedAt),
        lt(users.paymentFailedAt, cutoff),
      ),
    );

  if (staleAccounts.length === 0) return;

  console.log(`[suspend-accounts] suspending ${staleAccounts.length} account(s)`);

  for (const account of staleAccounts) {
    try {
      const now = new Date();

      // 1. Mark as suspended
      await db
        .update(users)
        .set({ accountStatus: 'suspended', suspendedAt: now })
        .where(eq(users.id, account.id));

      // 2. Invalidate all API key cache entries for this user
      const keyRows = await db
        .select({ keyHash: apiKeys.keyHash })
        .from(apiKeys)
        .where(eq(apiKeys.userId, account.id));

      await Promise.all(keyRows.map((k) => invalidateAuthCache(k.keyHash)));

      // 3. Send notification email
      await sendEmail('account_suspended', account.email, {}, false);

      console.log(`[suspend-accounts] suspended user ${account.id}`);
    } catch (err) {
      console.error(`[suspend-accounts] failed for user ${account.id}:`, err);
    }
  }
}
