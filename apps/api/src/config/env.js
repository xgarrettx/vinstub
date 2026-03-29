"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.env = void 0;
/**
 * env.ts — Single source of truth for all environment variables.
 * Parsed and validated at startup via Zod. Any missing required var
 * crashes the process immediately with a clear error message.
 */
var zod_1 = require("zod");
var envSchema = zod_1.z.object({
    // App
    NODE_ENV: zod_1.z.enum(['development', 'staging', 'production']).default('development'),
    PORT: zod_1.z.coerce.number().int().min(1024).max(65535).default(8080),
    /** Base URL of the web dashboard — used for Stripe redirect URLs. No trailing slash. */
    APP_BASE_URL: zod_1.z.string().url().default('http://localhost:3000'),
    /** Allowed CORS origin for the dashboard (may differ from APP_BASE_URL in staging). */
    APP_URL: zod_1.z.string().url().default('http://localhost:3000'),
    // Database
    DATABASE_URL: zod_1.z.string().url(),
    // Redis
    REDIS_URL: zod_1.z.string().url(),
    // Auth
    JWT_SECRET: zod_1.z.string().min(32),
    REFRESH_SECRET: zod_1.z.string().min(32),
    JWT_ACCESS_EXPIRY: zod_1.z.coerce.number().int().positive().default(900), // 15 minutes
    JWT_REFRESH_EXPIRY: zod_1.z.coerce.number().int().positive().default(604800), // 7 days
    // Stripe
    STRIPE_SECRET_KEY: zod_1.z.string().startsWith('sk_'),
    STRIPE_WEBHOOK_SECRET: zod_1.z.string().startsWith('whsec_'),
    STRIPE_PRICE_BASIC: zod_1.z.string().startsWith('price_'),
    STRIPE_PRICE_PREMIUM: zod_1.z.string().startsWith('price_'),
    STRIPE_PRICE_ENTERPRISE: zod_1.z.string().startsWith('price_'),
    // Resend
    RESEND_API_KEY: zod_1.z.string().startsWith('re_'),
    RESEND_FROM_ADDRESS: zod_1.z.string().email().default('noreply@vinstub.com'),
    RESEND_FROM_NAME: zod_1.z.string().default('VINSTUB.com'),
    // Sentry (optional — omit to disable)
    SENTRY_DSN: zod_1.z.string().url().optional(),
    // Admin — two-factor: static key + TOTP
    /** Static shared secret for /admin/* routes. Generate: openssl rand -hex 32 */
    ADMIN_API_KEY: zod_1.z.string().min(16),
    /** Base32-encoded TOTP seed. Generate: node -e "const {authenticator}=require('otplib'); console.log(authenticator.generateSecret())" */
    ADMIN_TOTP_SECRET: zod_1.z.string().min(16),
});
/**
 * Parse process.env once at module load time.
 * Throws ZodError with a readable message if validation fails.
 */
function parseEnv() {
    var result = envSchema.safeParse(process.env);
    if (!result.success) {
        var issues = result.error.issues
            .map(function (i) { return "  \u2022 ".concat(i.path.join('.'), ": ").concat(i.message); })
            .join('\n');
        throw new Error("Environment validation failed:\n".concat(issues, "\n\nSee .env.example for required variables."));
    }
    return result.data;
}
exports.env = parseEnv();
