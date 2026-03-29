/**
 * schema/index.ts — Re-exports all table definitions and relations.
 * Import from here everywhere in the app: import { users, vinStubs } from '../db/schema/index.js'
 */

export * from './users.js';
export * from './api-keys.js';
export * from './vin-stubs.js';
export * from './make-synonyms.js';
export * from './api-usage-daily.js';
export * from './webhook-events.js';
export * from './email-log.js';
export * from './admin-users.js';
export * from './admin-audit-log.js';
