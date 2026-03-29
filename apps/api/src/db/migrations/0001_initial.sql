-- ─────────────────────────────────────────────────────────────────────────────
-- 0001_initial.sql
-- VINSTUB.com — Initial database schema
-- Run via: pnpm db:migrate
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── EXTENSIONS ──────────────────────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS "pgcrypto";  -- gen_random_uuid()

-- ─── ENUMS ───────────────────────────────────────────────────────────────────

CREATE TYPE plan_type AS ENUM (
  'free',
  'basic',
  'premium',
  'enterprise'
);

CREATE TYPE account_status_type AS ENUM (
  'pending_verification',
  'active',
  'suspended',
  'cancelled'
);

CREATE TYPE billing_status_type AS ENUM (
  'none',
  'active',
  'past_due',
  'cancelled'
);

-- ─── USERS ───────────────────────────────────────────────────────────────────

CREATE TABLE users (
  id                                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email                               VARCHAR(320) NOT NULL UNIQUE,
  password_hash                       VARCHAR(256) NOT NULL,

  email_verified                      BOOLEAN NOT NULL DEFAULT FALSE,
  email_verification_token            VARCHAR(128),
  email_verification_token_expires_at TIMESTAMPTZ,

  password_reset_token                VARCHAR(128),
  password_reset_token_expires_at     TIMESTAMPTZ,

  plan                                plan_type NOT NULL DEFAULT 'free',
  account_status                      account_status_type NOT NULL DEFAULT 'pending_verification',
  billing_status                      billing_status_type NOT NULL DEFAULT 'none',

  stripe_customer_id                  VARCHAR(64) UNIQUE,
  stripe_subscription_id              VARCHAR(64) UNIQUE,

  payment_failed_at                   TIMESTAMPTZ,
  suspended_at                        TIMESTAMPTZ,

  created_at                          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_email          ON users (email);
CREATE INDEX idx_users_stripe_cust    ON users (stripe_customer_id) WHERE stripe_customer_id IS NOT NULL;
CREATE INDEX idx_users_stripe_sub     ON users (stripe_subscription_id) WHERE stripe_subscription_id IS NOT NULL;

-- Index for suspension job: find past-due accounts older than grace period
CREATE INDEX idx_users_past_due
  ON users (payment_failed_at)
  WHERE billing_status = 'past_due' AND account_status = 'active';

-- ─── API KEYS ─────────────────────────────────────────────────────────────────

CREATE TABLE api_keys (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  key_hash      CHAR(64) NOT NULL UNIQUE,      -- SHA-256 hex of raw key
  key_prefix    VARCHAR(24) NOT NULL,           -- 'vs_live_' + first 8 body chars
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  rotated_at    TIMESTAMPTZ,
  last_used_at  TIMESTAMPTZ,
  last_used_ip  INET
);

-- Fast auth validation: hash → key record
CREATE INDEX idx_api_keys_hash
  ON api_keys (key_hash)
  WHERE is_active = TRUE;

-- Used for key rotation (look up user's current active key)
CREATE INDEX idx_api_keys_user
  ON api_keys (user_id);

-- CRITICAL: Only one active key per user at any time
CREATE UNIQUE INDEX idx_api_keys_one_active
  ON api_keys (user_id)
  WHERE is_active = TRUE;

-- ─── VIN STUBS ───────────────────────────────────────────────────────────────

CREATE TABLE vin_stubs (
  id                  BIGSERIAL PRIMARY KEY,
  year                SMALLINT NOT NULL CHECK (year >= 1980 AND year <= 2035),
  make                VARCHAR(64) NOT NULL,
  make_normalized     VARCHAR(64) NOT NULL,
  model               VARCHAR(128) NOT NULL,
  model_normalized    VARCHAR(128) NOT NULL,
  submodel            VARCHAR(128),
  submodel_normalized VARCHAR(128),
  vin_stub            VARCHAR(17) NOT NULL,
  stub_length         SMALLINT NOT NULL CHECK (stub_length >= 7 AND stub_length <= 17),
  is_base_model       BOOLEAN NOT NULL DEFAULT FALSE,
  is_active           BOOLEAN NOT NULL DEFAULT TRUE,
  source_version      VARCHAR(32) NOT NULL DEFAULT 'v1',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- PRIMARY LOOKUP INDEX — the hot path for every /v1/stub request
-- Covering index: all lookup columns + vin_stub in the include clause
-- so the query is answered from the index without a heap fetch
CREATE INDEX idx_vin_lookup
  ON vin_stubs (year, make_normalized, model_normalized, submodel_normalized)
  INCLUDE (vin_stub, stub_length, make, model, submodel, is_base_model)
  WHERE is_active = TRUE;

-- BASE MODEL INDEX — used when submodel is omitted from query
CREATE UNIQUE INDEX idx_vin_base
  ON vin_stubs (year, make_normalized, model_normalized)
  WHERE is_active = TRUE AND is_base_model = TRUE;

-- MAKES REFERENCE INDEX — for GET /v1/makes (DISTINCT make_normalized)
CREATE INDEX idx_vin_makes
  ON vin_stubs (make_normalized)
  WHERE is_active = TRUE;

-- MODELS REFERENCE INDEX — for GET /v1/models?make=
CREATE INDEX idx_vin_models
  ON vin_stubs (make_normalized, model_normalized)
  WHERE is_active = TRUE;

-- ─── MAKE SYNONYMS ───────────────────────────────────────────────────────────

CREATE TABLE make_synonyms (
  id        SERIAL PRIMARY KEY,
  alias     VARCHAR(64) NOT NULL UNIQUE,
  canonical VARCHAR(64) NOT NULL
);

-- Seed common synonyms
INSERT INTO make_synonyms (alias, canonical) VALUES
  ('chevy', 'chevrolet'),
  ('vw', 'volkswagen'),
  ('benz', 'mercedes-benz'),
  ('merc', 'mercury'),
  ('bmw', 'bmw'),
  ('gmc', 'gmc'),
  ('kia', 'kia'),
  ('jag', 'jaguar'),
  ('rover', 'land rover'),
  ('landrover', 'land rover'),
  ('alfa', 'alfa romeo'),
  ('ram', 'ram'),       -- identity — also a make in its own right
  ('dodge', 'dodge'),
  ('jeep', 'jeep'),
  ('chrysler', 'chrysler'),
  ('ford', 'ford'),
  ('honda', 'honda'),
  ('toyota', 'toyota'),
  ('nissan', 'nissan'),
  ('hyundai', 'hyundai'),
  ('subaru', 'subaru'),
  ('mazda', 'mazda'),
  ('mitsubishi', 'mitsubishi'),
  ('isuzu', 'isuzu'),
  ('acura', 'acura'),
  ('lexus', 'lexus'),
  ('infiniti', 'infiniti'),
  ('cadillac', 'cadillac'),
  ('buick', 'buick'),
  ('oldsmobile', 'oldsmobile'),
  ('pontiac', 'pontiac'),
  ('saturn', 'saturn'),
  ('lincoln', 'lincoln'),
  ('mercury', 'mercury'),
  ('audi', 'audi'),
  ('porsche', 'porsche'),
  ('volvo', 'volvo'),
  ('saab', 'saab'),
  ('fiat', 'fiat'),
  ('ferrari', 'ferrari'),
  ('lamborghini', 'lamborghini'),
  ('maserati', 'maserati'),
  ('bentley', 'bentley'),
  ('rollsroyce', 'rolls-royce'),
  ('tesla', 'tesla'),
  ('rivian', 'rivian'),
  ('lucid', 'lucid'),
  ('genesis', 'genesis'),
  ('mini', 'mini');

-- ─── API USAGE DAILY ─────────────────────────────────────────────────────────

CREATE TABLE api_usage_daily (
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date        DATE NOT NULL,
  query_count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, date)
);

-- For admin reports: top users by day
CREATE INDEX idx_usage_date ON api_usage_daily (date, query_count DESC);

-- ─── WEBHOOK EVENTS (IDEMPOTENCY LOG) ────────────────────────────────────────

CREATE TABLE webhook_events (
  stripe_event_id  VARCHAR(64) PRIMARY KEY,
  event_type       VARCHAR(128) NOT NULL,
  processed_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  payload          JSONB NOT NULL
);

-- Prune old events after 90 days (run via pg_cron or manual job)
-- CREATE INDEX idx_webhook_processed ON webhook_events (processed_at);

-- ─── EMAIL LOG ───────────────────────────────────────────────────────────────

CREATE TABLE email_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES users(id) ON DELETE SET NULL,
  event_type  VARCHAR(64) NOT NULL,
  sent_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resend_id   VARCHAR(64),
  status      VARCHAR(32) NOT NULL DEFAULT 'sent'
);

-- Deduplication query: check if event_type was sent for user_id in last 23h
CREATE INDEX idx_email_log_dedup
  ON email_log (user_id, event_type, sent_at);

-- ─── ADMIN USERS ─────────────────────────────────────────────────────────────

CREATE TABLE admin_users (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email                   VARCHAR(320) NOT NULL UNIQUE,
  password_hash           VARCHAR(256) NOT NULL,
  totp_secret_encrypted   VARCHAR(256),
  totp_enabled            BOOLEAN NOT NULL DEFAULT FALSE,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_login_at           TIMESTAMPTZ
);

-- ─── ADMIN AUDIT LOG ─────────────────────────────────────────────────────────

CREATE TABLE admin_audit_log (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id      UUID NOT NULL REFERENCES admin_users(id),
  action        VARCHAR(64) NOT NULL,
  target_type   VARCHAR(32),
  target_id     VARCHAR(64),
  before_state  JSONB,
  after_state   JSONB,
  note          VARCHAR(512),
  ip            INET,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_log_admin  ON admin_audit_log (admin_id, created_at DESC);
CREATE INDEX idx_audit_log_target ON admin_audit_log (target_type, target_id);

-- ─── updated_at TRIGGER (auto-update on all tables that have it) ──────────────

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER vin_stubs_updated_at
  BEFORE UPDATE ON vin_stubs
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
