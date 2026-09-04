import {
  pgTable,
  text,
  boolean,
  timestamp,
  jsonb,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const emails = pgTable("emails", {
  id: text("id").primaryKey(),

  to: jsonb("to").$type<string[]>().notNull(),

  from: text("from").notNull(),

  createdAt: timestamp("created_at", { mode: "string" }).notNull(),

  subject: text("subject"),

  html: text("html"),

  text: text("text"),

  bcc: jsonb("bcc").$type<string[]>(),

  cc: jsonb("cc").$type<string[]>(),

  replyTo: jsonb("reply_to").$type<string[]>(),

  headers: jsonb("headers").$type<Record<string, string>>(),

  attachments: jsonb("attachments").$type<unknown[]>(),

  status: text("status").notNull().default("pending"),

  folder: text("folder").notNull().default("inbox"),

  starred: boolean("starred").notNull().default(false),

  unread: boolean("unread").notNull().default(true),

  labels: jsonb("labels").$type<string[]>().default([]),
});

export const webhookEvents = pgTable("webhook_events", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),

  type: text("type").notNull(),

  createdAt: timestamp("created_at", { mode: "string" }).notNull(),

  emailId: text("email_id"),

  data: jsonb("data"),
});

export const customLabels = pgTable("custom_labels", {
  id: text("id").primaryKey(),
  name: text("name").notNull().unique(),
  color: text("color"),
  createdAt: timestamp("created_at", { mode: "string" }).notNull(),
});

export const userApiKeys = pgTable(
  "user_api_keys",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id").notNull(),
    provider: text("provider").notNull(),
    domain: text("domain"),
    encryptedKey: text("encrypted_key").notNull(),
    keyLastFour: text("key_last_four").notNull(),
    encryptedWebhookKey: text("encrypted_webhook_key"),
    webhookKeyLastFour: text("webhook_key_last_four"),
    createdAt: timestamp("created_at", { mode: "string" }).notNull(),
    updatedAt: timestamp("updated_at", { mode: "string" }),
  },
  (table) => ({
    userProviderIdx: uniqueIndex("user_provider_idx").on(
      table.userId,
      table.provider,
    ),
  }),
);

export const automations = pgTable("automations", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  enabled: boolean("enabled").notNull().default(false),
  nodes: jsonb("nodes").$type<any[]>().notNull().default([]),
  edges: jsonb("edges").$type<any[]>().notNull().default([]),
  runCount: text("run_count").notNull().default("0"),
  successRate: text("success_rate").notNull().default("100"),
  lastRunAt: timestamp("last_run_at", { mode: "string" }),
  createdAt: timestamp("created_at", { mode: "string" }).notNull(),
  updatedAt: timestamp("updated_at", { mode: "string" }).notNull(),
});

export const automationRuns = pgTable("automation_runs", {
  id: text("id").primaryKey(),
  automationId: text("automation_id").notNull(),
  automationName: text("automation_name").notNull(),
  status: text("status").notNull().default("success"),
  triggerSource: text("trigger_source").notNull(),
  startedAt: timestamp("started_at", { mode: "string" }).notNull(),
  durationMs: text("duration_ms").notNull().default("0"),
  steps: jsonb("steps").$type<any[]>().notNull().default([]),
  error: text("error"),
});

export const customTools = pgTable("custom_tools", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  method: text("method").notNull().default("POST"),
  url: text("url").notNull(),
  authType: text("auth_type").notNull().default("none"),
  authValue: text("auth_value"),
  headers: jsonb("headers")
    .$type<{ key: string; value: string }[]>()
    .default([]),
  bodyTemplate: text("body_template"),
  inputSchema: text("input_schema"),
  createdAt: timestamp("created_at", { mode: "string" }).notNull(),
});
