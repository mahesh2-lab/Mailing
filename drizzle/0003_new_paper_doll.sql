ALTER TABLE "user_api_keys" ADD COLUMN "encrypted_webhook_key" text;--> statement-breakpoint
ALTER TABLE "user_api_keys" ADD COLUMN "webhook_key_last_four" text;--> statement-breakpoint
ALTER TABLE "user_api_keys" ADD COLUMN "updated_at" timestamp;--> statement-breakpoint
CREATE UNIQUE INDEX "user_provider_idx" ON "user_api_keys" USING btree ("user_id","provider");