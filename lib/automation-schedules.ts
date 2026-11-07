import { automationQueue } from "@/lib/queue";
import type { WorkflowNode } from "@/lib/automation-workflow";
import { createHash } from "node:crypto";
import { db } from "@/src";
import { automations } from "@/src/db/schema";
import { eq } from "drizzle-orm";

export async function syncAutomationSchedule(id: string, enabled: boolean, nodes: WorkflowNode[]) {
  const token = nodes.find((node) => node.type === "trigger_webhook")?.config?.webhookSecret;
  const webhookTokenHash = typeof token === "string" && token.length >= 32
    ? createHash("sha256").update(token).digest("hex")
    : null;
  await db.update(automations).set({ webhookTokenHash }).where(eq(automations.id, id));

  const schedulerId = `automation:${id}`;
  await automationQueue.removeJobScheduler(schedulerId);
  const trigger = nodes.find((node) => node.type === "trigger_schedule");
  if (!enabled || !trigger) return;

  const interval = String(trigger.config?.interval || "daily");
  const repeat = interval === "hourly" ? { every: 60 * 60 * 1000 }
    : interval === "weekly" ? { pattern: "0 9 * * 1" }
      : interval === "custom" ? { pattern: String(trigger.config?.cron || "") }
        : { pattern: "0 9 * * *" };
  if ("pattern" in repeat && repeat.pattern !== undefined && !repeat.pattern.trim()) throw new Error("Custom schedule requires a cron expression");

  await automationQueue.upsertJobScheduler(schedulerId, repeat, {
    name: "execute-automation",
    data: { automationId: id, triggerPayload: { triggerSource: "Scheduled Automation", simulated: false } },
  });
}

export async function restoreAutomationSchedules(items: { id: string; enabled: boolean; nodes: WorkflowNode[] }[]) {
  return Promise.all(items.map(async (item) => {
    try {
      await syncAutomationSchedule(item.id, item.enabled, item.nodes);
      return null;
    } catch (error) {
      return { id: item.id, error };
    }
  }));
}
