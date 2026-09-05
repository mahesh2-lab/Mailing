import { NextResponse } from "next/server";
import { db } from "@/src";
import { customTools } from "@/src/db/schema";
import { desc, eq } from "drizzle-orm";
import { getAuthSession } from "@/src/lib/require-auth";

export async function GET() {
  try {
    const session = await getAuthSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const list = await db.select().from(customTools).where(eq(customTools.userId, session.user.id)).orderBy(desc(customTools.createdAt));
    return NextResponse.json({ data: list });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getAuthSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const id = body.id || `tool-${Date.now()}`;
    const record = {
      id,
      name: body.name || "Custom Webhook Tool",
      description: body.description || "",
      method: body.method || "POST",
      url: body.url || "",
      authType: body.authType || "none",
      authValue: body.authValue || null,
      headers: body.headers || [],
      bodyTemplate: body.bodyTemplate || null,
      inputSchema: body.inputSchema || null,
      userId: session.user.id,
      createdAt: new Date().toISOString(),
    };

    await db.insert(customTools).values(record);
    return NextResponse.json({ data: record }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
