/**
 * server.ts — Entry point.
 * Builds the Fastify app and binds it to a port.
 */
import { buildApp } from './app.js';
import { env } from './config/env.js';
import { closeRedis } from './redis/index.js';
import { startJobs, stopJobs } from './jobs/index.js';

async function start() {
  const app = await buildApp();

  try {
    await app.listen({ port: env.PORT, host: '0.0.0.0' });
    (app.log as any).info(`API listening on port ${env.PORT} [${env.NODE_ENV}]`);
  } catch (err) {
    (app.log as any).error(err);
    process.exit(1);
  }

  // Start background jobs after server is ready
  startJobs();

  // ── Graceful shutdown ───────────────────────────────────────────────────────
  const shutdown = async (signal: string) => {
    (app.log as any).info(`Received ${signal} — shutting down gracefully`);
    stopJobs();
    await app.close();
    await closeRedis();
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

start();
