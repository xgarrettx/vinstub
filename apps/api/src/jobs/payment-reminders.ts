/**
 * jobs/payment-reminders.ts — Payment failure reminder emails.
 *
 * Runs every hour. Sends reminder emails at two points during the
 * 72-hour grace period:
 *
 *   24h after payment_failed_at — first reminder
 *   48h after payment_failed_at — final reminder (24h before suspension)
 *
 * Deduplication is handled by email.service.ts (isDuplicate checks the
 * email_log for the same userId + eventType within 23 hours), so it is
 * safe to run this job more frequently than once per hour if needed.
 *
 * Only runs for accounts that are still in payment_failed status and
 * have NOT yet been suspended.
 */
import { eq, and, gte, lt, ne, isNotNull } from 'drizzle-orm';
import { db } from '../db/index.js';
import { users } from '../db/schema/index.js';
import { sendEmail } from '../services/email.service.js';
import { PAYMENT_GRACE_PERIOD_HOURS as SUSPENSION_GRACE_HOURS } from '@vinstub/shared/constants.js';

const REMINDER_WINDOWS = [
  { afterHours: 24, eventType: 'payment_reminder_24h' as const },
  { afterHours: 48, eventType: 'payment_reminder_48h' as const },
] as const;

export async function runPaymentReminders(): Promise<void> {
  const now = Date.now();

  for (const window of REMINDER_WINDOWS) {
    const windowStart = new Date(now - window.afterHours * 60 * 60 * 1000 - 60 * 60 * 1000); // 1hr back buffer
    const windowEnd = new Date(now - window.afterHours * 60 * 60 * 1000);
    const graceCutoff = new Date(now - SUSPENSION_GRACE_HOURS * 60 * 60 * 1000);

    // Find accounts that failed payment in the target window,
    // are not yet suspended, and are still in grace period
    const accounts = await db
      .select({ id: users.id, email: users.email, paymentFailedAt: users.paymentFailedAt })
      .from(users)
      .where(
        and(
          eq(users.billingStatus, 'payment_failed'),
          ne(users.accountStatus, 'suspended'),
          isNotNull(users.paymentFailedAt),
          gte(users.paymentFailedAt, windowStart),
          lt(users.paymentFailedAt, windowEnd),
          // Only within the grace period (not yet overdue for suspension)
          gte(users.paymentFailedAt, graceCutoff),
        ),
      );

    if (accounts.length === 0) continue;

    console.log(`[payment-reminders] sending ${window.eventType} to ${accounts.length} account(s)`);

    for (const account of accounts) {
      try {
        const hoursRemaining = Math.max(
          0,
          Math.round(
            SUSPENSION_GRACE_HOURS -
            (now - (account.paymentFailedAt?.getTime() ?? now)) / (60 * 60 * 1000),
          ),
        );

        await sendEmail(
          window.eventType,
          account.email,
          { hoursRemaining: String(hoursRemaining), gracePeriodHours: String(SUSPENSION_GRACE_HOURS) },
          true, // deduplicate
        );
      } catch (err) {
        console.error(`[payment-reminders] failed for user ${account.id}:`, err);
      }
    }
  }
}
