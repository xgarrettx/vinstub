"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.stripe = void 0;
/**
 * config/stripe.ts — Stripe client singleton.
 *
 * Initialized with the STRIPE_SECRET_KEY from env and pinned to a specific
 * API version for stability. Import this wherever Stripe is needed — do not
 * construct a new Stripe instance elsewhere.
 */
var stripe_1 = __importDefault(require("stripe"));
var env_js_1 = require("./env.js");
exports.stripe = new stripe_1.default(env_js_1.env.STRIPE_SECRET_KEY, {
    apiVersion: '2024-06-20',
    typescript: true,
    // Automatically retry network errors up to 2 times with exponential backoff
    maxNetworkRetries: 2,
    // Timeout per request in ms
    timeout: 10000,
});
