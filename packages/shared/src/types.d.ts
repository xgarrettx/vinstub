/**
 * types.ts — Shared TypeScript types used across api, web, and worker.
 */
export type Plan = 'free' | 'basic' | 'premium' | 'enterprise';
export type AccountStatus = 'pending_verification' | 'active' | 'suspended' | 'cancelled';
export type BillingStatus = 'none' | 'active' | 'past_due' | 'cancelled';
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
export interface AccountResponse {
    plan: Plan;
    account_status: AccountStatus;
    billing_status: BillingStatus;
    key_prefix: string;
    quota_used_today: number;
    quota_limit_today: number;
    soft_cap_exceeded: boolean;
}
export interface UserContext {
    userId: string;
    plan: Plan;
    accountStatus: AccountStatus;
}
//# sourceMappingURL=types.d.ts.map