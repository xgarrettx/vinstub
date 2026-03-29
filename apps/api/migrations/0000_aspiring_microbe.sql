CREATE TYPE "public"."account_status_type" AS ENUM('pending_verification', 'active', 'suspended', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."billing_status_type" AS ENUM('none', 'active', 'past_due', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."plan_type" AS ENUM('free', 'basic', 'premium', 'enterprise');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "admin_audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"admin_id" uuid NOT NULL,
	"action" varchar(64) NOT NULL,
	"target_type" varchar(32),
	"target_id" varchar(64),
	"before_state" jsonb,
	"after_state" jsonb,
	"note" varchar(512),
	"ip" "inet",
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "admin_users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(320) NOT NULL,
	"password_hash" varchar(256) NOT NULL,
	"totp_secret_encrypted" varchar(256),
	"totp_enabled" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_login_at" timestamp with time zone,
	CONSTRAINT "admin_users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "api_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"key_hash" char(64) NOT NULL,
	"key_prefix" varchar(24) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"rotated_at" timestamp with time zone,
	"last_used_at" timestamp with time zone,
	"last_used_ip" "inet",
	CONSTRAINT "api_keys_key_hash_unique" UNIQUE("key_hash")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "api_usage_daily" (
	"user_id" uuid NOT NULL,
	"date" date NOT NULL,
	"query_count" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "email_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"event_type" varchar(64) NOT NULL,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resend_id" varchar(64),
	"status" varchar(32) DEFAULT 'sent' NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(320) NOT NULL,
	"password_hash" varchar(256) NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"email_verification_token" varchar(128),
	"email_verification_token_expires_at" timestamp with time zone,
	"password_reset_token" varchar(128),
	"password_reset_token_expires_at" timestamp with time zone,
	"plan" "plan_type" DEFAULT 'free' NOT NULL,
	"account_status" "account_status_type" DEFAULT 'pending_verification' NOT NULL,
	"billing_status" "billing_status_type" DEFAULT 'none' NOT NULL,
	"stripe_customer_id" varchar(64),
	"stripe_subscription_id" varchar(64),
	"payment_failed_at" timestamp with time zone,
	"suspended_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_stripe_customer_id_unique" UNIQUE("stripe_customer_id"),
	CONSTRAINT "users_stripe_subscription_id_unique" UNIQUE("stripe_subscription_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "vin_stubs" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"year" smallint NOT NULL,
	"make" varchar(64) NOT NULL,
	"make_normalized" varchar(64) NOT NULL,
	"model" varchar(128) NOT NULL,
	"model_normalized" varchar(128) NOT NULL,
	"submodel" varchar(128),
	"submodel_normalized" varchar(128),
	"vin_stub" varchar(17) NOT NULL,
	"stub_length" smallint NOT NULL,
	"is_base_model" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"source_version" varchar(32) DEFAULT 'v1' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "year_range" CHECK ("vin_stubs"."year" >= 1980 AND "vin_stubs"."year" <= 2035),
	CONSTRAINT "stub_length_range" CHECK ("vin_stubs"."stub_length" >= 7 AND "vin_stubs"."stub_length" <= 17)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "make_synonyms" (
	"id" serial PRIMARY KEY NOT NULL,
	"alias" varchar(64) NOT NULL,
	"canonical" varchar(64) NOT NULL,
	CONSTRAINT "make_synonyms_alias_unique" UNIQUE("alias")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "webhook_events" (
	"stripe_event_id" varchar(64) PRIMARY KEY NOT NULL,
	"event_type" varchar(128) NOT NULL,
	"processed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"payload" jsonb NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "admin_audit_log" ADD CONSTRAINT "admin_audit_log_admin_id_admin_users_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."admin_users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "api_usage_daily" ADD CONSTRAINT "api_usage_daily_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "email_log" ADD CONSTRAINT "email_log_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
