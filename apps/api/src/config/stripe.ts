/**
 * config/stripe.ts — Stripe client singleton.
 *
 * Initialized with the STRIPE_SECRET_KEY from env and pinned to a specific
 * API version for stability. Import this wherever Stripe is needed — do not
 * construct a new Stripe instance elsewhere.
 */
import Stripe from 'stripe';
import { env } from './env.js';

export const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
  apiVersion: '2024-06-20',
  typescript: true,
  // Automatically retry network errors up to 2 times with exponential backoff
  maxNetworkRetries: 2,
  // Timeout per request in ms
  timeout: 10_000,
});
