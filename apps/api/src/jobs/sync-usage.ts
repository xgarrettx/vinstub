/**
 * jobs/sync-usage.ts — Redis → Postgres daily usage sync.
 *
 * Runs every 60 seconds. Scans all active `rl:day:{userId}:{date}` keys
 * in Redis and upserts their counts into the api_usage_daily table.
 *
 * This is a best-effort durability layer — the Redis counter is always
 * the source of truth for live rate limiting. The DB is the source of
 * truth for usage history, billing analytics, and reporting.
 *
 * Uses SCAN (cursor-based) rather than KEYS to avoid blocking Redis on
 * large datasets. Processes in batches of 100 keys.
 */
import { sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { apiUsageDaily } from '../db/schema/index.js';
import { redis } from '../redis/index.js';

const BATCH_SIZE = 100;
// Key format: rl:day:{userId}:{YYYY-MM-DD}
const KEY_PATTERN = 'rl:day:*';
const KEY_REGEX = /^rl:day:([^:]+):(\d{4}-\d{2}-\d{2})$/;

export async function runSyncUsage(): Promise<void> {
  let cursor = '0';
  let totalSynced = 0;

  do {
    const [nextCursor, keys] = await redis.scan(cursor, 'MATCH', KEY_PATTERN, 'COUNT', BATCH_SIZE);
    cursor = nextCursor;

    if (keys.length === 0) continue;

    // Fetch all counts in a single pipeline
    const pipeline = redis.pipeline();
    for (const key of keys) pipeline.get(key);
    const results = await pipeline.exec();

    // Build upsert rows
    type UsageRow = { userId: string; usageDate: string; requestCount: number };
    const rows: UsageRow[] = [];

    for (let i = 0; i < keys.length; i++) {
      const key = keys[i]!;
      const match = KEY_REGEX.exec(key);
      if (!match) continue;

      const [, userId, usageDate] = match;
      const rawCount = results?.[i]?.[1];
      if (!rawCount || !userId || !usageDate) continue;

      const requestCount = parseInt(rawCount as string, 10);
      if (isNaN(requestCount) || requestCount <= 0) continue;

      rows.push({ userId, usageDate, requestCount });
    }

    if (rows.length === 0) continue;

    // Upsert: INSERT ... ON CONFLICT (user_id, usage_date) DO UPDATE SET request_count = GREATEST(...)
    // GREATEST() ensures we never write a lower count than what's already in the DB
    // (protects against a race where the Redis counter was reset between reads).
    await db
      .insert(apiUsageDaily)
      .values(rows)
      .onConflictDoUpdate({
        target: [apiUsageDaily.userId, apiUsageDaily.usageDate],
        set: {
          requestCount: sql`GREATEST(excluded.request_count, api_usage_daily.request_count)`,
          updatedAt: new Date(),
        },
      });

    totalSynced += rows.length;
  } while (cursor !== '0');

  if (totalSynced > 0) {
    console.log(`[sync-usage] synced ${totalSynced} usage rows`);
  }
}
