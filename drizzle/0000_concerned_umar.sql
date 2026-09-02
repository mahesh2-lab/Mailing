CREATE TABLE "custom_labels" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"color" text,
	"created_at" timestamp NOT NULL,
	CONSTRAINT "custom_labels_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "emails" (
	"id" text PRIMARY KEY NOT NULL,
	"to" jsonb NOT NULL,
	"from" text NOT NULL,
	"created_at" timestamp NOT NULL,
	"subject" text,
	"html" text,
	"text" text,
	"bcc" jsonb,
	"cc" jsonb,
	"reply_to" jsonb,
	"headers" jsonb,
	"attachments" jsonb,
	"status" text DEFAULT 'pending' NOT NULL,
	"folder" text DEFAULT 'inbox' NOT NULL,
	"starred" boolean DEFAULT false NOT NULL,
	"unread" boolean DEFAULT true NOT NULL,
	"labels" jsonb DEFAULT '[]'::jsonb
);
--> statement-breakpoint
CREATE TABLE "webhook_events" (
	"id" text PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"created_at" timestamp NOT NULL,
	"email_id" text,
	"data" jsonb
);
