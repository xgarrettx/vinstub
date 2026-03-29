/**
 * jobs/index.ts — Background job scheduler.
 *
 * Starts all background jobs using node-cron. Meant to be called once
 * during server bootstrap, after the DB and Redis connections are ready.
 *
 * Jobs:
 *   sync-usage        — every 60 seconds  — Redis → Postgres usage sync
 *   suspend-accounts  — every 15 minutes  — grace period enforcement
 *   payment-reminders — every hour        — reminder emails
 *
 * Each job wraps its handler in a try/catch so one failing job cannot
 * crash the scheduler. Errors are logged to stderr (Sentry picks these up
 * via the unhandled exception integration set in server.ts).
 *
 * On SIGTERM/SIGINT, all scheduled tasks are destroyed so the process can
 * exit cleanly. The server.ts shutdown sequence calls stopJobs().
 */
import cron from 'node-cron';
import { runSyncUsage } from './sync-usage.js';
import { runSuspendAccounts } from './suspend-accounts.js';
import { runPaymentReminders } from './payment-reminders.js';

let tasks: cron.ScheduledTask[] = [];

export function startJobs(): void {
  // Usage sync — every 60 seconds
  tasks.push(
    cron.schedule('* * * * *', () => {
      runSyncUsage().catch((err) =>
        console.error('[jobs] sync-usage failed:', err),
      );
    }),
  );

  // Suspend accounts — every 15 minutes
  tasks.push(
    cron.schedule('*/15 * * * *', () => {
      runSuspendAccounts().catch((err) =>
        console.error('[jobs] suspend-accounts failed:', err),
      );
    }),
  );

  // Payment reminder emails — every hour at :05 past the hour
  tasks.push(
    cron.schedule('5 * * * *', () => {
      runPaymentReminders().catch((err) =>
        console.error('[jobs] payment-reminders failed:', err),
      );
    }),
  );

  console.log(`[jobs] started ${tasks.length} background jobs`);
}

export function stopJobs(): void {
  for (const task of tasks) {
    (task as any).destroy();
  }
  tasks = [];
  console.log('[jobs] all background jobs stopped');
}
