import { NextResponse } from "next/server";
import { db } from "@/src";
import { automations, automationRuns, customTools } from "@/src/db/schema";
import { eq, desc } from "drizzle-orm";

export async function GET() {
  try {
    const list = await db.select().from(automations).orderBy(desc(automations.createdAt));
    return NextResponse.json({ data: list });
  } catch (error: any) {
    console.error("GET /api/v1/automations error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
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
