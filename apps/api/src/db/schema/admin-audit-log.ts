/**
 * schema/admin-audit-log.ts — admin_audit_log table.
 *
 * Immutable record of every action taken by an admin.
 * No deletes are ever performed on this table.
 *
 * action values:
 *   'suspend_user' | 'unsuspend_user' | 'rotate_key' | 'revoke_key' |
 *   'override_plan' | 'view_user' | 'login' | 'failed_login'
 */
import { pgTable, uuid, varchar, jsonb, timestamp, inet } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { adminUsers } from './admin-users.js';

export const adminAuditLog = pgTable('admin_audit_log', {
  id: uuid('id').primaryKey().defaultRandom(),

  adminId: uuid('admin_id')
    .notNull()
    .references(() => adminUsers.id),

  action: varchar('action', { length: 64 }).notNull(),

  /** 'user' | 'api_key' | 'vin_stub' | 'system' */
  targetType: varchar('target_type', { length: 32 }),

  /** UUID or other identifier of the affected record */
  targetId: varchar('target_id', { length: 64 }),

  /** Snapshot of relevant fields BEFORE the change */
  beforeState: jsonb('before_state'),

  /** Snapshot of relevant fields AFTER the change */
  afterState: jsonb('after_state'),

  /** Optional freeform note from admin */
  note: varchar('note', { length: 512 }),

  ip: inet('ip'),

  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ─── RELATIONS ────────────────────────────────────────────────────────────────

export const adminAuditLogRelations = relations(adminAuditLog, ({ one }) => ({
  admin: one(adminUsers, {
    fields: [adminAuditLog.adminId],
    references: [adminUsers.id],
  }),
}));

export type AdminAuditLog = typeof adminAuditLog.$inferSelect;
export type NewAdminAuditLog = typeof adminAuditLog.$inferInsert;
