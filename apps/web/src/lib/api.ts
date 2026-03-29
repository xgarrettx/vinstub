/**
 * api.ts — Typed API client for the VINSTUB backend.
 *
 * Access tokens live in memory only (never localStorage).
 * Refresh tokens live in httpOnly cookies managed by the browser.
 */

// Use relative URLs so all requests proxy through Next.js (same origin = cookies work)
const API_BASE = '';

// ─── TYPES ─────────────────────────────────────────────────────────────────

export type Plan = 'free' | 'basic' | 'premium' | 'enterprise';
export type AccountStatus = 'pending_verification' | 'active' | 'suspended' | 'cancelled';
export type BillingStatus = 'none' | 'active' | 'past_due' | 'cancelled';

export interface LoginResponse {
  success: true;
  accessToken: string;
  userId: string;
  plan: Plan;
}

export interface RegisterResponse {
  success: true;
  message: string;
  userId: string;
}

export interface RefreshResponse {
  success: true;
  accessToken: string;
}

export interface AccountData {
  userId: string;
  email: string;
  plan: Plan;
  accountStatus: AccountStatus;
  billingStatus: BillingStatus;
  apiKey: {
    prefix: string;
    createdAt: string;
    lastUsedAt: string | null;
  } | null;
  limits: {
    daily: number;
    perHour: number;
    perMinute: number;
  };
}

export interface UsageDay {
  date: string;
  requestCount: number;
  errorCount: number;
}

export interface UsageResponse {
  success: true;
  data: {
    periodStart: string;
    periodEnd: string;
    totalRequests: number;
    totalErrors: number;
    daily: UsageDay[];
  };
}

export interface RotateKeyResponse {
  success: true;
  message: string;
  apiKey: string;
}

export interface BillingPortalResponse {
  success: true;
  data: { url: string };
}

export interface ApiError {
  success: false;
  error: string;
  message: string;
  request_id?: string;
}

// ─── CLIENT ────────────────────────────────────────────────────────────────

class VinstubApiClient {
  private accessToken: string | null = null;

  setToken(token: string) {
    this.accessToken = token;
  }

  clearToken() {
    this.accessToken = null;
  }

  getToken(): string | null {
    return this.accessToken;
  }

  private async request<T>(
    path: string,
    options: RequestInit = {},
  ): Promise<T> {
    const headers: Record<string, string> = {
      // Only set Content-Type when we have a body — sending it without a body
      // causes Fastify to attempt JSON.parse('') → "Unexpected end of JSON input".
      ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(this.accessToken ? { Authorization: `Bearer ${this.accessToken}` } : {}),
      ...(options.headers as Record<string, string> || {}),
    };

    const res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers,
      credentials: 'include', // send cookies for refresh token
    });

    const data = await res.json();

    if (!res.ok) {
      throw data as ApiError;
    }

    return data as T;
  }

  // ── Auth ──────────────────────────────────────────────────────────────────

  login(email: string, password: string) {
    return this.request<LoginResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  }

  register(email: string, password: string) {
    return this.request<RegisterResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  }

  refresh() {
    return this.request<RefreshResponse>('/auth/refresh', { method: 'POST' });
  }

  logout() {
    return this.request<{ success: true; message: string }>('/auth/logout', {
      method: 'POST',
    });
  }

  resendVerification(email: string) {
    return this.request<{ success: true; message: string }>('/auth/resend-verification', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  }

  forgotPassword(email: string) {
    return this.request<{ success: true; message: string }>('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  }

  resetPassword(token: string, password: string) {
    return this.request<{ success: true; message: string }>('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token, password }),
    });
  }

  // ── Account ───────────────────────────────────────────────────────────────

  getKeyInfo() {
    return this.request<{
      success: true;
      data: {
        keyPrefix: string | null;
        createdAt: string | null;
        lastUsedAt: string | null;
        hasKey: boolean;
      };
    }>('/v1/account/key-info');
  }

  getAccount() {
    // GET /v1/account uses API key auth (Bearer = api key), not JWT.
    // For the dashboard we use JWT-authenticated endpoints instead.
    // Usage and billing are JWT-authenticated.
    return this.request<{ success: true; data: AccountData }>('/v1/account');
  }

  getUsage() {
    return this.request<UsageResponse>('/v1/account/usage');
  }

  getBillingPortal() {
    return this.request<BillingPortalResponse>('/v1/account/billing');
  }

  rotateKey() {
    return this.request<RotateKeyResponse>('/v1/account/rotate-key', {
      method: 'POST',
    });
  }

  revokeKey() {
    return this.request<{ success: true; message: string }>('/v1/account/revoke-key', {
      method: 'POST',
    });
  }
}

export const api = new VinstubApiClient();
