import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/src";
import { automations } from "@/src/db/schema";
import { automationQueue } from "@/lib/queue";

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (token.length < 32) {
    return NextResponse.json({ error: "Webhook not found" }, { status: 404 });
  }
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const automation = await db.query.automations.findFirst({
    where: and(eq(automations.enabled, true), eq(automations.webhookTokenHash, tokenHash)),
  });
  if (automation && !(automation.nodes as Array<{ type?: string }>).some((node) => node.type === "trigger_webhook")) {
    return NextResponse.json({ error: "Webhook not found" }, { status: 404 });
  }
  if (!automation) return NextResponse.json({ error: "Webhook not found" }, { status: 404 });

  const raw = await request.text();
  if (raw.length > 1_000_000) return NextResponse.json({ error: "Payload too large" }, { status: 413 });
  let payload: unknown;
  try { payload = raw ? JSON.parse(raw) : {}; }
  catch { return NextResponse.json({ error: "Expected a JSON body" }, { status: 400 }); }
  const job = await automationQueue.add("execute-automation", {
    automationId: automation.id,
    triggerPayload: { triggerSource: "Inbound Automation Webhook", webhook: payload, simulated: false },
  });
  return NextResponse.json({ queued: true, jobId: job.id }, { status: 202 });
}
