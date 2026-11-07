ALTER TABLE "automations" ADD COLUMN "webhook_token_hash" text;--> statement-breakpoint
CREATE INDEX "automations_webhook_token_hash_idx" ON "automations" USING btree ("webhook_token_hash");