/**
 * db/index.ts — Drizzle ORM client + pg Pool.
 *
 * Exports:
 *   db   — Drizzle query builder (use this everywhere for typed queries)
 *   pool — Raw pg Pool (use only for raw SQL where Drizzle falls short,
 *           e.g., bulk inserts in the ingest scripts)
 */
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { env } from '../config/env.js';
import * as schema from './schema/index.js';

// ─── pg Pool ──────────────────────────────────────────────────────────────────

export const pool = new Pool({
  connectionString: env.DATABASE_URL,
  max: 20,                  // max concurrent connections
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
  ssl: env.NODE_ENV !== 'development'
    ? { rejectUnauthorized: false }  // DigitalOcean managed Postgres uses TLS
    : false,
});

pool.on('error', (err) => {
  console.error('[pg] unexpected pool error:', err.message);
});

// ─── Drizzle client ───────────────────────────────────────────────────────────

export const db = drizzle(pool, {
  schema,
  logger: env.NODE_ENV === 'development',  // Log SQL queries in dev
});

// ─── Health check helper ─────────────────────────────────────────────────────

export async function checkDbHealth(): Promise<{ ok: boolean; latencyMs: number }> {
  const start = Date.now();
  try {
    await pool.query('SELECT 1');
    return { ok: true, latencyMs: Date.now() - start };
  } catch {
    return { ok: false, latencyMs: Date.now() - start };
  }
}
