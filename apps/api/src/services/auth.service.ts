/**
 * services/auth.service.ts
 *
 * All user authentication and API key lifecycle logic.
 * Routes call these functions — no SQL lives in route handlers.
 *
 * API Key convention:
 *   raw key  = "vs_live_" + 48 hex chars  (never stored)
 *   key_hash = sha256(rawKey).hex           (stored in api_keys.key_hash)
 *   key_prefix = rawKey.slice(0, 16)        (stored for masked display)
 */
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';

// nanoid replaced with native crypto — URL-safe base64, same usage pattern
function nanoid(size = 21): string {
  return crypto.randomBytes(size).toString('base64url').slice(0, size);
}
import { eq, and } from 'drizzle-orm';
import { db } from '../db/index.js';
import { users, apiKeys } from '../db/schema/index.js';
import {
  hashApiKey,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from '../middleware/auth.js';
import {
  invalidateAuthCache,
  storeRefreshJti,
  isRefreshJtiValid,
  revokeRefreshJti,
  incrementSignupIp,
} from '../redis/index.js';
import { sendEmail } from './email.service.js';
import {
  API_KEY_PREFIX,
  API_KEY_BODY_LENGTH,
  MAX_SIGNUPS_PER_IP_PER_HOUR,
} from '@vinstub/shared';

// ─── CONSTANTS ────────────────────────────────────────────────────────────────

const BCRYPT_ROUNDS = 12;
const EMAIL_VERIFY_EXPIRY_MS = 24 * 60 * 60 * 1000;   // 24 hours
const PASSWORD_RESET_EXPIRY_MS = 60 * 60 * 1000;       // 1 hour

// ─── HELPERS ──────────────────────────────────────────────────────────────────

function generateRawApiKey(): string {
  const body = crypto.randomBytes(API_KEY_BODY_LENGTH / 2).toString('hex');
  return `${API_KEY_PREFIX}${body}`;
}

function generateToken(): string {
  return nanoid(48); // URL-safe, 48 chars
}

// ─── REGISTER ─────────────────────────────────────────────────────────────────

export interface RegisterResult {
  userId: string;
}

export interface RegisterError {
  code: 'email_taken' | 'ip_limit_exceeded' | 'invalid_password';
  message: string;
}

export async function register(
  email: string,
  password: string,
  ip: string,
): Promise<RegisterResult | RegisterError> {
  // 1. Password validation (min 8 chars, at least 1 uppercase, 1 digit)
  if (password.length < 8 || !/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
    return {
      code: 'invalid_password',
      message: 'Password must be at least 8 characters with one uppercase letter and one number.',
    };
  }

  // 2. IP throttle — max 3 signups per IP per hour
  const ipCount = await incrementSignupIp(ip);
  if (ipCount > MAX_SIGNUPS_PER_IP_PER_HOUR) {
    return {
      code: 'ip_limit_exceeded',
      message: 'Too many registrations from this IP address. Please try again later.',
    };
  }

  // 3. Check email uniqueness
  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email.toLowerCase()))
    .limit(1);

  if (existing.length > 0) {
    return { code: 'email_taken', message: 'An account with that email already exists.' };
  }

  // 4. Hash password
  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

  // 5. Generate verification token
  const verificationToken = generateToken();
  const tokenExpiresAt = new Date(Date.now() + EMAIL_VERIFY_EXPIRY_MS);

  // 6. Insert user
  const [user] = await db
    .insert(users)
    .values({
      email: email.toLowerCase(),
      passwordHash,
      emailVerificationToken: verificationToken,
      emailVerificationTokenExpiresAt: tokenExpiresAt,
      accountStatus: 'pending_verification',
      plan: 'free',
      billingStatus: 'none',
    })
    .returning({ id: users.id });

  if (!user) throw new Error('Failed to create user');

  // 7. Send verification email (fire-and-forget — don't fail registration if email fails)
  sendEmail('verify_email', email, { token: verificationToken, userId: user.id })
    .catch((err) => console.error('[auth] failed to send verify email:', err));

  return { userId: user.id };
}

// ─── RESEND VERIFICATION EMAIL ────────────────────────────────────────────────

export async function resendVerificationEmail(
  email: string,
): Promise<{ sent: boolean }> {
  const rows = await db
    .select({
      id: users.id,
      emailVerified: users.emailVerified,
      accountStatus: users.accountStatus,
    })
    .from(users)
    .where(eq(users.email, email.toLowerCase()))
    .limit(1);

  // Always return { sent: true } — don't reveal whether the email exists
  if (rows.length === 0) return { sent: true };

  const user = rows[0]!;

  // Already verified — nothing to resend
  if (user.emailVerified || user.accountStatus !== 'pending_verification') {
    return { sent: true };
  }

  // Generate a fresh token and extend the expiry
  const verificationToken = generateToken();
  const tokenExpiresAt = new Date(Date.now() + EMAIL_VERIFY_EXPIRY_MS);

  await db
    .update(users)
    .set({
      emailVerificationToken: verificationToken,
      emailVerificationTokenExpiresAt: tokenExpiresAt,
    } as any)
    .where(eq(users.id, user.id));

  sendEmail('verify_email', email.toLowerCase(), {
    token: verificationToken,
    userId: user.id,
  }).catch((err) => console.error('[auth] failed to resend verify email:', err));

  return { sent: true };
}

// ─── VERIFY EMAIL ─────────────────────────────────────────────────────────────

export interface VerifyEmailResult {
  userId: string;
  rawApiKey: string;  // returned ONCE — show to user, never stored
}

export interface VerifyEmailError {
  code: 'invalid_token' | 'token_expired' | 'already_verified';
  message: string;
}

export async function verifyEmail(
  token: string,
): Promise<VerifyEmailResult | VerifyEmailError> {
  // 1. Find user by token
  const rows = await db
    .select({
      id: users.id,
      emailVerified: users.emailVerified,
      tokenExpiresAt: users.emailVerificationTokenExpiresAt,
    })
    .from(users)
    .where(eq(users.emailVerificationToken, token))
    .limit(1);

  if (rows.length === 0) {
    return { code: 'invalid_token', message: 'Verification link is invalid or has already been used.' };
  }

  const user = rows[0]!;

  if (user.emailVerified) {
    return { code: 'already_verified', message: 'Email address is already verified.' };
  }

  if (!user.tokenExpiresAt || user.tokenExpiresAt < new Date()) {
    return { code: 'token_expired', message: 'Verification link has expired. Please request a new one.' };
  }

  // 2. Generate API key
  const rawApiKey = generateRawApiKey();
  const keyHash = hashApiKey(rawApiKey);
  const keyPrefix = rawApiKey.slice(0, 16); // "vs_live_" + first 8 body chars

  // 3. Atomic: verify email + create API key
  await db.transaction(async (tx) => {
    await tx
      .update(users)
      .set({
        emailVerified: true,
        accountStatus: 'active' as any,
        emailVerificationToken: null,
        emailVerificationTokenExpiresAt: null,
        updatedAt: new Date(),
      } as any)
      .where(eq(users.id, user.id));

    await tx.insert(apiKeys).values({
      userId: user.id,
      keyHash,
      keyPrefix,
      isActive: true,
    } as any);
  });

  // 4. Send welcome email
  sendEmail('welcome', undefined, { userId: user.id, keyPrefix })
    .catch((err) => console.error('[auth] failed to send welcome email:', err));

  return { userId: user.id, rawApiKey };
}

// ─── LOGIN ────────────────────────────────────────────────────────────────────

export interface LoginResult {
  accessToken: string;
  refreshToken: string;
  userId: string;
  plan: string;
}

export interface LoginError {
  code: 'invalid_credentials' | 'email_not_verified' | 'account_suspended';
  message: string;
}

export async function login(
  email: string,
  password: string,
): Promise<LoginResult | LoginError> {
  // 1. Find user
  const rows = await db
    .select({
      id: users.id,
      passwordHash: users.passwordHash,
      emailVerified: users.emailVerified,
      accountStatus: users.accountStatus,
      plan: users.plan,
    })
    .from(users)
    .where(eq(users.email, email.toLowerCase()))
    .limit(1);

  // Use constant-time comparison placeholder to prevent timing attacks
  // even when user is not found
  const dummyHash = '$2b$12$invalidhashfortimingattackprevention.padding1234';
  const hashToCheck = rows.length > 0 ? rows[0]!.passwordHash : dummyHash;
  const passwordMatch = await bcrypt.compare(password, hashToCheck);

  if (rows.length === 0 || !passwordMatch) {
    return { code: 'invalid_credentials', message: 'Invalid email or password.' };
  }

  const user = rows[0]!;

  if (!user.emailVerified) {
    return {
      code: 'email_not_verified',
      message: 'Please verify your email address before logging in.',
    };
  }

  if (user.accountStatus === 'suspended') {
    return {
      code: 'account_suspended',
      message: 'Your account has been suspended. Please resolve your outstanding balance.',
    };
  }

  // 2. Generate tokens
  const jti = nanoid(32);
  const accessToken = signAccessToken(user.id, user.plan);
  const refreshToken = signRefreshToken(user.id, jti);

  // 3. Store refresh JTI in Redis for revocation support
  await storeRefreshJti(jti);

  return { accessToken, refreshToken, userId: user.id, plan: user.plan };
}

// ─── REFRESH TOKEN ────────────────────────────────────────────────────────────

export interface RefreshResult {
  accessToken: string;
  refreshToken: string;
}

export interface RefreshError {
  code: 'invalid_token' | 'token_revoked';
  message: string;
}

export async function refreshTokens(
  rawRefreshToken: string,
): Promise<RefreshResult | RefreshError> {
  let payload;
  try {
    payload = verifyRefreshToken(rawRefreshToken);
  } catch {
    return { code: 'invalid_token', message: 'Refresh token is invalid or expired.' };
  }

  if (payload.type !== 'refresh' || !payload.jti) {
    return { code: 'invalid_token', message: 'Token type mismatch.' };
  }

  // Check JTI is still valid (not revoked by logout/rotation)
  const valid = await isRefreshJtiValid(payload.jti);
  if (!valid) {
    return { code: 'token_revoked', message: 'Refresh token has been revoked. Please log in again.' };
  }

  // Load current plan (may have changed since token was issued)
  const rows = await db
    .select({ plan: users.plan, accountStatus: users.accountStatus })
    .from(users)
    .where(eq(users.id, payload.sub))
    .limit(1);

  if (rows.length === 0) {
    return { code: 'invalid_token', message: 'User not found.' };
  }

  // Rotate: revoke old JTI, issue new pair
  await revokeRefreshJti(payload.jti);
  const newJti = nanoid(32);
  const accessToken = signAccessToken(payload.sub, rows[0]!.plan);
  const refreshToken = signRefreshToken(payload.sub, newJti);
  await storeRefreshJti(newJti);

  return { accessToken, refreshToken };
}

// ─── LOGOUT ───────────────────────────────────────────────────────────────────

export async function logout(rawRefreshToken: string): Promise<void> {
  try {
    const payload = verifyRefreshToken(rawRefreshToken);
    if (payload.jti) await revokeRefreshJti(payload.jti);
  } catch {
    // Token already expired or invalid — nothing to revoke
  }
}

// ─── PASSWORD RESET ───────────────────────────────────────────────────────────

export async function requestPasswordReset(email: string): Promise<void> {
  const rows = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email.toLowerCase()))
    .limit(1);

  // Always return success — don't leak whether email exists
  if (rows.length === 0) return;

  const token = generateToken();
  const expiresAt = new Date(Date.now() + PASSWORD_RESET_EXPIRY_MS);

  await db
    .update(users)
    .set({
      passwordResetToken: token,
      passwordResetTokenExpiresAt: expiresAt,
      updatedAt: new Date(),
    } as any)
    .where(eq(users.id, rows[0]!.id));

  sendEmail('password_reset', email, { token })
    .catch((err) => console.error('[auth] failed to send password reset email:', err));
}

export interface ResetPasswordError {
  code: 'invalid_token' | 'token_expired';
  message: string;
}

export async function resetPassword(
  token: string,
  newPassword: string,
): Promise<void | ResetPasswordError> {
  if (newPassword.length < 8 || !/[A-Z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
    return {
      code: 'invalid_token', // Reuse code to not reveal policy in unauthenticated flow
      message: 'Password must be at least 8 characters with one uppercase letter and one number.',
    };
  }

  const rows = await db
    .select({ id: users.id, tokenExpiresAt: users.passwordResetTokenExpiresAt })
    .from(users)
    .where(eq(users.passwordResetToken, token))
    .limit(1);

  if (rows.length === 0) {
    return { code: 'invalid_token', message: 'Reset link is invalid or has already been used.' };
  }

  const user = rows[0]!;
  if (!user.tokenExpiresAt || user.tokenExpiresAt < new Date()) {
    return { code: 'token_expired', message: 'Reset link has expired. Please request a new one.' };
  }

  const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);

  await db
    .update(users)
    .set({
      passwordHash,
      passwordResetToken: null,
      passwordResetTokenExpiresAt: null,
      updatedAt: new Date(),
    } as any)
    .where(eq(users.id, user.id));
}

// ─── API KEY OPERATIONS ───────────────────────────────────────────────────────

export interface KeyResult {
  rawApiKey: string;
  keyPrefix: string;
}

/**
 * Rotate the user's API key — deactivates old key, generates new key.
 * Returns the new raw key (shown once, never stored).
 */
export async function rotateApiKey(userId: string): Promise<KeyResult> {
  const rawApiKey = generateRawApiKey();
  const keyHash = hashApiKey(rawApiKey);
  const keyPrefix = rawApiKey.slice(0, 16);

  // Find existing active key hash so we can invalidate Redis cache
  const existingRows = await db
    .select({ keyHash: apiKeys.keyHash })
    .from(apiKeys)
    .where(and(eq(apiKeys.userId, userId), eq(apiKeys.isActive, true)))
    .limit(1);

  await db.transaction(async (tx) => {
    // Deactivate existing key(s) for this user
    await tx
      .update(apiKeys)
      .set({ isActive: false, rotatedAt: new Date() } as any)
      .where(and(eq(apiKeys.userId, userId), eq(apiKeys.isActive, true)));

    // Insert new key
    await tx.insert(apiKeys).values({
      userId,
      keyHash,
      keyPrefix,
      isActive: true,
    } as any);
  });

  // Evict old key from Redis cache (within 60s it would expire anyway,
  // but explicit eviction makes revocation immediate)
  if (existingRows.length > 0) {
    await invalidateAuthCache(existingRows[0]!.keyHash);
  }

  return { rawApiKey, keyPrefix };
}

/**
 * Revoke the user's active API key without generating a replacement.
 * The user must call POST /v1/account/generate-key to get a new one.
 */
export async function revokeApiKey(userId: string): Promise<void> {
  const existingRows = await db
    .select({ keyHash: apiKeys.keyHash })
    .from(apiKeys)
    .where(and(eq(apiKeys.userId, userId), eq(apiKeys.isActive, true)))
    .limit(1);

  await db
    .update(apiKeys)
    .set({ isActive: false, rotatedAt: new Date() } as any)
    .where(and(eq(apiKeys.userId, userId), eq(apiKeys.isActive, true)));

  if (existingRows.length > 0) {
    await invalidateAuthCache(existingRows[0]!.keyHash);
  }
}

/**
 * Generate a fresh API key for a user who has no active key (e.g., after revocation).
 * Throws if the user already has an active key — they must rotate instead.
 */
export async function generateApiKey(userId: string): Promise<KeyResult> {
  const existing = await db
    .select({ id: apiKeys.id })
    .from(apiKeys)
    .where(and(eq(apiKeys.userId, userId), eq(apiKeys.isActive, true)))
    .limit(1);

  if (existing.length > 0) {
    throw new Error('User already has an active API key. Use rotate instead.');
  }

  const rawApiKey = generateRawApiKey();
  const keyHash = hashApiKey(rawApiKey);
  const keyPrefix = rawApiKey.slice(0, 16);

  await db.insert(apiKeys).values({ userId, keyHash, keyPrefix, isActive: true } as any);

  return { rawApiKey, keyPrefix };
}
