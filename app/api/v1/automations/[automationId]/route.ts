import { NextResponse } from "next/server";
import { db } from "@/src";
import { automations } from "@/src/db/schema";
import { and, eq } from "drizzle-orm";
import { automationQueue } from "@/lib/queue";
import { getAuthSession } from "@/src/lib/require-auth";
import { syncAutomationSchedule } from "@/lib/automation-schedules";
import { getErrorMessage } from "@/src/lib/errors";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ automationId: string }> }
) {
  try {
    const session = await getAuthSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { automationId } = await params;
    const item = await db.query.automations.findFirst({
      where: and(eq(automations.id, automationId), eq(automations.userId, session.user.id)),
    });

    if (!item) {
      return NextResponse.json({ error: "Automation not found" }, { status: 404 });
    }

    return NextResponse.json({ data: item });
  } catch (error: unknown) {
    return NextResponse.json({ error: getErrorMessage(error, "Internal server error") }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ automationId: string }> }
) {
  try {
    const session = await getAuthSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { automationId } = await params;
    const body = await request.json();
    const now = new Date().toISOString();

    await db
      .update(automations)
      .set({
        name: body.name,
        description: body.description,
        enabled: body.enabled !== undefined ? Boolean(body.enabled) : undefined,
        nodes: body.nodes !== undefined ? body.nodes : undefined,
        edges: body.edges !== undefined ? body.edges : undefined,
        updatedAt: now,
      })
      .where(and(eq(automations.id, automationId), eq(automations.userId, session.user.id)));

    const updated = await db.query.automations.findFirst({
      where: and(eq(automations.id, automationId), eq(automations.userId, session.user.id)),
    });

    if (updated) await syncAutomationSchedule(updated.id, updated.enabled, updated.nodes as never[]);

    return NextResponse.json({ data: updated });
  } catch (error: unknown) {
    return NextResponse.json({ error: getErrorMessage(error, "Invalid request") }, { status: 400 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ automationId: string }> }
) {
  try {
    const session = await getAuthSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { automationId } = await params;
    await db.delete(automations).where(and(eq(automations.id, automationId), eq(automations.userId, session.user.id)));
    await syncAutomationSchedule(automationId, false, []);
    return NextResponse.json({ success: true, deletedId: automationId });
  } catch (error: unknown) {
    return NextResponse.json({ error: getErrorMessage(error, "Internal server error") }, { status: 500 });
  }
}

// POST to trigger a live or simulated test execution
export async function POST(
  request: Request,
  { params }: { params: Promise<{ automationId: string }> }
) {
  try {
    const session = await getAuthSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { automationId } = await params;
    const body = await request.json().catch(() => ({}));
    const automation = await db.query.automations.findFirst({
      where: and(eq(automations.id, automationId), eq(automations.userId, session.user.id)),
      columns: { id: true },
    });
    if (!automation) return NextResponse.json({ error: "Automation not found" }, { status: 404 });
    
    const job = await automationQueue.add("execute-automation", {
      automationId,
      triggerPayload: {
        email: body.email || {
          id: "sim-email-1",
          from: "Acme Client <client@acme.corp>",
          to: ["mahesh@heymahesh.in"],
          subject: "Invoice #1042 for September services",
          text: "Please find attached our invoice #1042 for billing.",
        },
        triggerSource: body.triggerSource || "Manual Builder Test",
        simulated: body.simulated !== false,
      }
    });

    return NextResponse.json({ data: { queued: true, jobId: job.id } });
  } catch (error: unknown) {
    return NextResponse.json({ error: getErrorMessage(error, "Internal server error") }, { status: 500 });
  }
}
