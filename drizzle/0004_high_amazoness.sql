CREATE TABLE "automation_runs" (
	"id" text PRIMARY KEY NOT NULL,
	"automation_id" text NOT NULL,
	"automation_name" text NOT NULL,
	"status" text DEFAULT 'success' NOT NULL,
	"trigger_source" text NOT NULL,
	"started_at" timestamp NOT NULL,
	"duration_ms" text DEFAULT '0' NOT NULL,
	"steps" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"error" text
);
--> statement-breakpoint
CREATE TABLE "automations" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"enabled" boolean DEFAULT false NOT NULL,
	"nodes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"edges" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"run_count" text DEFAULT '0' NOT NULL,
	"success_rate" text DEFAULT '100' NOT NULL,
	"last_run_at" timestamp,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "custom_tools" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"method" text DEFAULT 'POST' NOT NULL,
	"url" text NOT NULL,
	"auth_type" text DEFAULT 'none' NOT NULL,
	"auth_value" text,
	"headers" jsonb DEFAULT '[]'::jsonb,
	"body_template" text,
	"input_schema" text,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_api_keys" ADD COLUMN "domain" text;