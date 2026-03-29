/**
 * services/email.service.ts — Resend wrapper + email dispatch.
 *
 * All email sending goes through sendEmail(). Template rendering is
 * handled inline here for MVP — move to packages/email-templates once
 * the templates need complex styling.
 *
 * Deduplication: before sending any billing email, we check email_log
 * for the same (userId, eventType) within the last 23 hours.
 *
 * eventType values (matches email_log.event_type column):
 *   verify_email | welcome | payment_failed_0h | payment_failed_24h |
 *   payment_failed_48h | account_suspended | account_reactivated |
 *   subscription_changed | subscription_cancelled | password_reset
 */
import { Resend } from 'resend';
import { eq, and, gte } from 'drizzle-orm';
import { db } from '../db/index.js';
import { emailLog, users } from '../db/schema/index.js';
import { env } from '../config/env.js';

const resend = new Resend(env.RESEND_API_KEY);

const FROM = `${env.RESEND_FROM_NAME} <${env.RESEND_FROM_ADDRESS}>`;

// ─── DEDUPLICATION CHECK ──────────────────────────────────────────────────────

/** Returns true if this eventType was already sent to userId within 23 hours. */
async function isDuplicate(userId: string, eventType: string): Promise<boolean> {
  const cutoff = new Date(Date.now() - 23 * 60 * 60 * 1000);
  const rows = await db
    .select({ id: emailLog.id })
    .from(emailLog)
    .where(
      and(
        eq(emailLog.userId, userId),
        eq(emailLog.eventType, eventType),
        gte(emailLog.sentAt, cutoff),
      ),
    )
    .limit(1);
  return rows.length > 0;
}

/** Log a sent email to email_log for deduplication and admin visibility. */
async function logEmail(
  userId: string | null,
  eventType: string,
  resendId: string | undefined,
): Promise<void> {
  await db.insert(emailLog).values({
    userId,
    eventType,
    resendId: resendId ?? null,
    status: 'sent',
  });
}

// ─── TEMPLATE BUILDERS ────────────────────────────────────────────────────────
// Plain-text + simple HTML. Replace with React Email templates post-MVP.

interface TemplateOutput {
  subject: string;
  html: string;
  text: string;
}

function buildTemplate(
  eventType: string,
  data: Record<string, string>,
): TemplateOutput {
  const appUrl = env.APP_URL;

  switch (eventType) {
    case 'verify_email':
      return {
        subject: 'Verify your VINSTUB.com account',
        html: `<p>Thanks for signing up! Click the link below to verify your email address and get your API key.</p>
               <p><a href="${appUrl}/auth/verify-email?token=${data.token}">Verify my email address</a></p>
               <p>This link expires in 24 hours.</p>`,
        text: `Verify your email: ${appUrl}/auth/verify-email?token=${data.token}\n\nThis link expires in 24 hours.`,
      };

    case 'welcome':
      return {
        subject: 'Welcome to VINSTUB.com — your API key is ready',
        html: `<p>Your email has been verified and your API key has been generated.</p>
               <p>Log in to your dashboard to view and copy your key: <a href="${appUrl}/dashboard">${appUrl}/dashboard</a></p>
               <p>API documentation: <a href="https://docs.vinstub.com">docs.vinstub.com</a></p>`,
        text: `Your API key is ready. View it at: ${appUrl}/dashboard\nDocs: https://docs.vinstub.com`,
      };

    case 'payment_failed_0h':
      return {
        subject: 'Action required: payment failed on your VINSTUB.com account',
        html: `<p>We were unable to process your most recent payment.</p>
               <p>Your API access remains active for the next 72 hours. Please update your payment method to avoid interruption.</p>
               <p><a href="${appUrl}/dashboard/billing">Update payment method</a></p>`,
        text: `Payment failed. Update your billing info within 72 hours: ${appUrl}/dashboard/billing`,
      };

    case 'payment_failed_24h':
      return {
        subject: 'Reminder: your VINSTUB.com account is at risk',
        html: `<p>We still haven't received payment for your subscription.</p>
               <p>Your account will be suspended in 48 hours if payment is not resolved.</p>
               <p><a href="${appUrl}/dashboard/billing">Resolve now</a></p>`,
        text: `Payment still outstanding. Account suspension in 48h: ${appUrl}/dashboard/billing`,
      };

    case 'payment_failed_48h':
      return {
        subject: 'Final warning: VINSTUB.com account suspension in 24 hours',
        html: `<p><strong>Your account will be suspended in 24 hours</strong> if payment is not resolved.</p>
               <p>Once suspended, all API requests will return HTTP 403 until payment is recovered.</p>
               <p><a href="${appUrl}/dashboard/billing">Update payment method immediately</a></p>`,
        text: `FINAL WARNING: Account suspended in 24h. Resolve at: ${appUrl}/dashboard/billing`,
      };

    case 'account_suspended':
      return {
        subject: 'Your VINSTUB.com account has been suspended',
        html: `<p>Your account has been suspended due to an unresolved payment failure.</p>
               <p>All API requests are currently blocked. To reactivate, please update your payment method.</p>
               <p><a href="${appUrl}/dashboard/billing">Reactivate account</a></p>`,
        text: `Account suspended. Reactivate at: ${appUrl}/dashboard/billing`,
      };

    case 'account_reactivated':
      return {
        subject: 'Your VINSTUB.com account is reactivated',
        html: `<p>Your payment has been processed and your account is fully active again.</p>
               <p>API access has been restored. <a href="${appUrl}/dashboard">View your dashboard</a></p>`,
        text: `Account reactivated. API access restored. Dashboard: ${appUrl}/dashboard`,
      };

    case 'subscription_changed':
      return {
        subject: `Your VINSTUB.com plan has been updated to ${data.newPlan ?? 'a new plan'}`,
        html: `<p>Your subscription has been updated.</p>
               <p>New plan: <strong>${data.newPlan ?? 'unknown'}</strong></p>
               <p><a href="${appUrl}/dashboard">View your dashboard</a></p>`,
        text: `Plan updated to ${data.newPlan}. Dashboard: ${appUrl}/dashboard`,
      };

    case 'subscription_cancelled':
      return {
        subject: 'Your VINSTUB.com subscription has been cancelled',
        html: `<p>Your subscription has been cancelled. You will retain access until the end of your current billing period.</p>
               <p>After that, your account will revert to the Free plan (50 queries/day).</p>
               <p>You can reactivate at any time from your <a href="${appUrl}/dashboard/billing">billing settings</a>.</p>`,
        text: `Subscription cancelled. Reverts to Free plan at period end. Reactivate: ${appUrl}/dashboard/billing`,
      };

    case 'password_reset':
      return {
        subject: 'Reset your VINSTUB.com password',
        html: `<p>We received a request to reset your password.</p>
               <p><a href="${appUrl}/auth/reset-password?token=${data.token}">Reset my password</a></p>
               <p>This link expires in 1 hour. If you didn't request this, you can safely ignore this email.</p>`,
        text: `Reset your password: ${appUrl}/auth/reset-password?token=${data.token}\n\nExpires in 1 hour.`,
      };

    default:
      throw new Error(`Unknown email event type: ${eventType}`);
  }
}

// ─── MAIN SEND FUNCTION ───────────────────────────────────────────────────────

/**
 * Send a transactional email.
 *
 * @param eventType  - identifies which template to use and is logged to email_log
 * @param toEmail    - recipient address (pass undefined to look up by userId)
 * @param data       - template variables (token, newPlan, etc.)
 * @param deduplicate - if true (default for billing emails), skip if sent within 23h
 */
export async function sendEmail(
  eventType: string,
  toEmail: string | undefined,
  data: Record<string, string> = {},
  deduplicate = false,
): Promise<void> {
  // Resolve recipient email from userId if not provided
  let recipientEmail = toEmail;
  if (!recipientEmail && data.userId) {
    const rows = await db
      .select({ email: users.email })
      .from(users)
      .where(eq(users.id, data.userId))
      .limit(1);
    if (rows.length > 0) recipientEmail = rows[0]!.email;
  }

  if (!recipientEmail) {
    console.error(`[email] cannot resolve recipient for event=${eventType}`);
    return;
  }

  // Deduplication check for billing-critical emails
  if (deduplicate && data.userId) {
    const dup = await isDuplicate(data.userId, eventType);
    if (dup) {
      console.log(`[email] skipping duplicate event=${eventType} userId=${data.userId}`);
      return;
    }
  }

  const template = buildTemplate(eventType, data);

  let resendId: string | undefined;
  try {
    const result = await resend.emails.send({
      from: FROM,
      to: recipientEmail,
      subject: template.subject,
      html: template.html,
      text: template.text,
    });
    resendId = result.data?.id;
  } catch (err) {
    console.error(`[email] send failed event=${eventType} to=${recipientEmail}:`, err);
    // Log failure but don't throw — email failures should not crash API requests
    await logEmail(data.userId ?? null, eventType, undefined)
      .catch(() => undefined);
    return;
  }

  // Log successful send
  await logEmail(data.userId ?? null, eventType, resendId)
    .catch((err) => console.error('[email] failed to log email:', err));
}
