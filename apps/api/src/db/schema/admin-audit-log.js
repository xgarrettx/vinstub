"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminAuditLogRelations = exports.adminAuditLog = void 0;
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
var pg_core_1 = require("drizzle-orm/pg-core");
var drizzle_orm_1 = require("drizzle-orm");
var admin_users_js_1 = require("./admin-users.js");
exports.adminAuditLog = (0, pg_core_1.pgTable)('admin_audit_log', {
    id: (0, pg_core_1.uuid)('id').primaryKey().defaultRandom(),
    adminId: (0, pg_core_1.uuid)('admin_id')
        .notNull()
        .references(function () { return admin_users_js_1.adminUsers.id; }),
    action: (0, pg_core_1.varchar)('action', { length: 64 }).notNull(),
    /** 'user' | 'api_key' | 'vin_stub' | 'system' */
    targetType: (0, pg_core_1.varchar)('target_type', { length: 32 }),
    /** UUID or other identifier of the affected record */
    targetId: (0, pg_core_1.varchar)('target_id', { length: 64 }),
    /** Snapshot of relevant fields BEFORE the change */
    beforeState: (0, pg_core_1.jsonb)('before_state'),
    /** Snapshot of relevant fields AFTER the change */
    afterState: (0, pg_core_1.jsonb)('after_state'),
    /** Optional freeform note from admin */
    note: (0, pg_core_1.varchar)('note', { length: 512 }),
    ip: (0, pg_core_1.inet)('ip'),
    createdAt: (0, pg_core_1.timestamp)('created_at', { withTimezone: true })
        .notNull()
        .defaultNow(),
});
// ─── RELATIONS ────────────────────────────────────────────────────────────────
exports.adminAuditLogRelations = (0, drizzle_orm_1.relations)(exports.adminAuditLog, function (_a) {
    var one = _a.one;
    return ({
        admin: one(admin_users_js_1.adminUsers, {
            fields: [exports.adminAuditLog.adminId],
            references: [admin_users_js_1.adminUsers.id],
        }),
    });
});
