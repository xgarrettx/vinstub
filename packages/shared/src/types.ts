/**
 * types.ts — Shared TypeScript types used across api, web, and worker.
 */

// ─── PLANS ────────────────────────────────────────────────────────────────────

export type Plan = 'free' | 'basic' | 'premium' | 'enterprise';

export type AccountStatus =
  | 'pending_verification'
  | 'active'
  | 'suspended'
  | 'cancelled';

export type BillingStatus = 'none' | 'active' | 'past_due' | 'cancelled';

// ─── API RESPONSE ENVELOPE ────────────────────────────────────────────────────

export interface ApiSuccess<T> {
  success: true;
  request_id: string;
  data?: T;
}

export interface ApiError {
  success: false;
  error: string;
  message: string;
  request_id: string;
  retry_after?: number;
  reset_at?: string;
  upgrade_url?: string;
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;

// ─── VIN STUB RESPONSE ────────────────────────────────────────────────────────

export type MatchType = 'exact' | 'base_model';

export interface VinStubResponse {
  success: true;
  stub: string;
  padded: string | null;
  stub_length: number;
  year: number;
  make: string;
  model: string;
  submodel: string | null;
  match_type: MatchType;
  placeholder: string | null;
  request_id: string;
}

// ─── ACCOUNT RESPONSE ────────────────────────────────────────────────────────

export interface AccountResponse {
  plan: Plan;
  account_status: AccountStatus;
  billing_status: BillingStatus;
  key_prefix: string;        // e.g. "vs_live_a3f9" — masked display
  quota_used_today: number;
  quota_limit_today: number;
  soft_cap_exceeded: boolean;
}

// ─── USER (internal) ─────────────────────────────────────────────────────────

export interface UserContext {
  userId: string;
  plan: Plan;
  accountStatus: AccountStatus;
}
