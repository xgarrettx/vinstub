"use strict";
/**
 * schema/index.ts — Re-exports all table definitions and relations.
 * Import from here everywhere in the app: import { users, vinStubs } from '../db/schema/index.js'
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
__exportStar(require("./users.js"), exports);
__exportStar(require("./api-keys.js"), exports);
__exportStar(require("./vin-stubs.js"), exports);
__exportStar(require("./make-synonyms.js"), exports);
__exportStar(require("./api-usage-daily.js"), exports);
__exportStar(require("./webhook-events.js"), exports);
__exportStar(require("./email-log.js"), exports);
__exportStar(require("./admin-users.js"), exports);
__exportStar(require("./admin-audit-log.js"), exports);
