import { NextResponse } from "next/server";
import { db } from "@/src";
import { customTools } from "@/src/db/schema";
import { desc, eq } from "drizzle-orm";
import { getAuthSession } from "@/src/lib/require-auth";
import { encrypt } from "@/src/lib/crypto";
import { z } from "zod";

const ToolInput = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500).optional().default(""),
  method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]),
  url: z.string().trim().min(8).max(2048).refine((value) => /^https:\/\//i.test(value), "URL must use HTTPS"),
  authType: z.enum(["none", "bearer", "basic", "header"]),
  authValue: z.string().max(4096).optional(),
  headers: z.array(z.object({ key: z.string().trim().min(1).max(200), value: z.string().max(4096) })).max(50).optional().default([]),
  bodyTemplate: z.string().max(100_000).nullable().optional(),
  inputSchema: z.string().max(100_000).nullable().optional(),
}).superRefine((tool, context) => {
  if (tool.authType !== "none" && !tool.authValue?.trim()) {
    context.addIssue({ code: "custom", path: ["authValue"], message: "Authentication value is required" });
  }
});

function isSecretHeader(name: string) {
  return /authorization|token|secret|api[-_]?key|password/i.test(name);
}

function hideHeaderSecrets(headers: { key: string; value: string }[] | null) {
  return (headers || []).map(({ key, value }) => ({
    key,
    value: isSecretHeader(key) ? "" : value.replace(/^enc:v1:/, ""),
    secretConfigured: isSecretHeader(key) && Boolean(value),
  }));
}

export async function GET() {
  try {
    const session = await getAuthSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const list = await db.select({
      id: customTools.id,
      name: customTools.name,
      description: customTools.description,
      method: customTools.method,
      url: customTools.url,
      authType: customTools.authType,
      hasAuth: customTools.authValue,
      headers: customTools.headers,
      bodyTemplate: customTools.bodyTemplate,
      inputSchema: customTools.inputSchema,
      createdAt: customTools.createdAt,
    }).from(customTools).where(eq(customTools.userId, session.user.id)).orderBy(desc(customTools.createdAt));
    return NextResponse.json({ data: list.map(({ hasAuth, headers, ...tool }) => ({
      ...tool,
      headers: hideHeaderSecrets(headers),
      authConfigured: Boolean(hasAuth),
    })) });
  } catch (error) {
    console.error("Failed to list custom tools:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getAuthSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const parsed = ToolInput.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Invalid custom tool" }, { status: 400 });
    const body = parsed.data;
    const id = body.id || crypto.randomUUID();
    const record = {
      id,
      name: body.name || "Custom Webhook Tool",
      description: body.description || "",
      method: body.method || "POST",
      url: body.url || "",
      authType: body.authType || "none",
      authValue: body.authValue ? `enc:v1:${await encrypt(body.authValue)}` : null,
      headers: await Promise.all(body.headers.map(async ({ key, value }) => ({
        key,
        value: isSecretHeader(key) && value ? `enc:v1:${await encrypt(value)}` : value,
      }))),
      bodyTemplate: body.bodyTemplate || null,
      inputSchema: body.inputSchema || null,
      userId: session.user.id,
      createdAt: new Date().toISOString(),
    };

    await db.insert(customTools).values(record);
    const { authValue, headers, ...safeRecord } = record;
    return NextResponse.json({ data: {
      ...safeRecord,
      headers: hideHeaderSecrets(headers),
      authConfigured: Boolean(authValue),
    } }, { status: 201 });
  } catch (error) {
    console.error("Failed to save custom tool:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
