/**
 * worker/index.ts — Background job scheduler.
 *
 * Runs as a separate DigitalOcean App Platform Worker service.
 * Uses node-cron to schedule recurring jobs. Each job is imported
 * from the api package's jobs/ directory to share logic.
 *
 * IMPORTANT: The worker connects to the same Postgres and Redis as the API.
 * It does NOT expose any HTTP endpoints.
 */
import cron from 'node-cron';
import * as Sentry from '@sentry/node';
import { env } from '../../api/src/config/env.js';
import { runSuspensionJob } from '../../api/src/jobs/suspension.job.js';
import { runRemindersJob } from '../../api/src/jobs/reminders.job.js';
import { runUsageSyncJob } from '../../api/src/jobs/usage-sync.job.js';

if (env.SENTRY_DSN) {
  Sentry.init({ dsn: env.SENTRY_DSN, environment: env.NODE_ENV });
}

console.log(`[worker] Starting — NODE_ENV=${env.NODE_ENV}`);

// ── Usage sync: Redis day counters → Postgres (every 60 seconds) ─────────────
cron.schedule('* * * * *', async () => {
  try {
    const { synced } = await runUsageSyncJob();
    if (synced > 0) console.log(`[usage-sync] synced ${synced} records`);
  } catch (err) {
    Sentry.captureException(err);
    console.error('[usage-sync] error:', err);
  }
});

// ── Payment reminders: T+24h and T+48h emails (every hour) ───────────────────
cron.schedule('0 * * * *', async () => {
  try {
    const result = await runRemindersJob();
    console.log(`[reminders] sent: T+24h=${result.sent24h} T+48h=${result.sent48h}`);
  } catch (err) {
    Sentry.captureException(err);
    console.error('[reminders] error:', err);
  }
});

// ── Account suspension: past T+72h grace period (every 15 minutes) ───────────
cron.schedule('*/15 * * * *', async () => {
  try {
    const { suspended } = await runSuspensionJob();
    if (suspended > 0) console.log(`[suspension] suspended ${suspended} accounts`);
  } catch (err) {
    Sentry.captureException(err);
    console.error('[suspension] error:', err);
  }
});

console.log('[worker] All cron jobs scheduled');

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('[worker] SIGTERM received — stopping');
  process.exit(0);
});
