CREATE TABLE "contacts" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"notes" text,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
ALTER TABLE "custom_labels" DROP CONSTRAINT "custom_labels_name_unique";--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "contacts_user_id_idx" ON "contacts" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "contacts_user_email_idx" ON "contacts" USING btree ("user_id","email");--> statement-breakpoint
CREATE UNIQUE INDEX "custom_labels_user_name_idx" ON "custom_labels" USING btree ("user_id","name");