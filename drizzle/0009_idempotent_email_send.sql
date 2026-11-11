ALTER TABLE "emails" ADD COLUMN "provider_id" text;--> statement-breakpoint
ALTER TABLE "emails" ADD COLUMN "idempotency_key" text;--> statement-breakpoint
ALTER TABLE "emails" ADD COLUMN "request_hash" text;--> statement-breakpoint
CREATE UNIQUE INDEX "emails_user_idempotency_key_idx" ON "emails" USING btree ("user_id","idempotency_key");