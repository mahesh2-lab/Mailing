import { NextResponse } from "next/server";
import { db } from "@/src";
import { automations } from "@/src/db/schema";
import { desc, eq } from "drizzle-orm";
import { getAuthSession } from "@/src/lib/require-auth";

export async function GET() {
  try {
    const session = await getAuthSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const list = await db.select().from(automations).where(eq(automations.userId, session.user.id)).orderBy(desc(automations.createdAt));
    return NextResponse.json({ data: list });
  } catch (error: any) {
    console.error("GET /api/v1/automations error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getAuthSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const id = body.id || `auto-${Date.now()}`;
    const now = new Date().toISOString();

    const record = {
      id,
      name: body.name || "Untitled Automation",
      description: body.description || "",
      enabled: Boolean(body.enabled),
      nodes: body.nodes || [],
      edges: body.edges || [],
      runCount: String(body.runCount || 0),
      successRate: String(body.successRate || 100),
      lastRunAt: body.lastRunAt || null,
      createdAt: body.createdAt || now,
      userId: session.user.id,
      updatedAt: now,
    };

    await db.insert(automations).values(record).onConflictDoUpdate({
      target: automations.id,
      set: {
        name: record.name,
        description: record.description,
        enabled: record.enabled,
        nodes: record.nodes,
        edges: record.edges,
        updatedAt: now,
      },
    });

    return NextResponse.json({ data: record }, { status: 201 });
  } catch (error: any) {
    console.error("POST /api/v1/automations error:", error);
    return NextResponse.json({ error: error.message || "Failed to create automation" }, { status: 400 });
  }
}
