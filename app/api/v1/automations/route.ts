import { NextResponse } from "next/server";
import { db } from "@/src";
import { automations } from "@/src/db/schema";
import { desc, eq } from "drizzle-orm";
import { getAuthSession } from "@/src/lib/require-auth";
import { syncAutomationSchedule } from "@/lib/automation-schedules";
import { getErrorMessage } from "@/src/lib/errors";
import { automationCreateInput } from "@/lib/automation-validation";

export async function GET() {
  try {
    const session = await getAuthSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const list = await db.select().from(automations).where(eq(automations.userId, session.user.id)).orderBy(desc(automations.createdAt));
    return NextResponse.json({ data: list });
  } catch (error: unknown) {
    console.error("GET /api/v1/automations error:", error);
    return NextResponse.json({ error: getErrorMessage(error, "Internal server error") }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getAuthSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const parsed = automationCreateInput.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Invalid automation data" }, { status: 400 });
    const body = parsed.data;
    const id = body.id || crypto.randomUUID();
    const now = new Date().toISOString();

    const record = {
      id,
      name: body.name || "Untitled Automation",
      description: body.description || "",
      enabled: body.enabled ?? false,
      nodes: body.nodes || [],
      edges: body.edges || [],
      runCount: "0",
      successRate: "100",
      lastRunAt: null,
      createdAt: now,
      userId: session.user.id,
      updatedAt: now,
    };

    const [created] = await db.insert(automations).values(record)
      .onConflictDoNothing()
      .returning({ id: automations.id });
    if (!created) return NextResponse.json({ error: "Automation ID already exists" }, { status: 409 });

    await syncAutomationSchedule(id, record.enabled, record.nodes);

    return NextResponse.json({ data: record }, { status: 201 });
  } catch (error: unknown) {
    console.error("POST /api/v1/automations error:", error);
    return NextResponse.json({ error: getErrorMessage(error, "Failed to create automation") }, { status: 400 });
  }
}
