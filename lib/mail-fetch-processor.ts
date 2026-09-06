import { and, eq } from "drizzle-orm";
import { db } from "@/src/index";
import { automations, emails, userSettings } from "@/src/db/schema";
import { getResendClient } from "@/lib/resend";
import { pusherServer } from "@/src/lib/pusher";
import { matchesTrigger } from "@/lib/automation-engine";
import { automationQueue } from "@/lib/queue";
import { emailChannelForUser } from "@/lib/realtime-channels";

export interface ResendEventData {
  email_id?: string;
  from?: string;
  to?: string | string[];
  subject?: string;
  bounce_summary?: string;
  [key: string]: unknown;
}

export interface MailFetchJobData {
  emailId: string;
  resolvedUserId: string;
  eventData: ResendEventData;
}

function toArray<T>(value: T | T[] | null | undefined): T[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

export async function processMailFetchJob({
  emailId,
  resolvedUserId,
  eventData,
}: MailFetchJobData) {
  const resendClient = await getResendClient(resolvedUserId);
  if (!resendClient) {
    throw new Error(`No Resend client available to fetch email: ${emailId}`);
  }

  const { data: emailData, error } =
    await resendClient.emails.receiving.get(emailId);

  if (error || !emailData) {
    throw new Error(
      `Failed to fetch received email from Resend API: ${error?.message || "unknown error"}`,
    );
  }

  await db
    .insert(emails)
    .values({
      id: emailData.id,
      userId: resolvedUserId,
      to: toArray(emailData.to),
      from: emailData.from,
      createdAt: emailData.created_at || new Date().toISOString(),
      subject: emailData.subject || "No Subject",
      html: emailData.html || "",
      text: emailData.text || "",
      bcc: toArray(emailData.bcc),
      cc: toArray(emailData.cc),
      replyTo: toArray(emailData.reply_to),
      headers: (emailData.headers as Record<string, string>) || {},
      attachments: emailData.attachments || [],
      status: "received",
      folder: "inbox",
      unread: true,
      starred: false,
      labels: [],
    })
    .onConflictDoNothing();

  const rawPreview = emailData.text || emailData.html || "";
  const cleanPreview = rawPreview.replace(/<[^>]+>/g, "").slice(0, 130);

  await pusherServer.trigger(emailChannelForUser(resolvedUserId), "new-email", {
    emailId: emailData.id,
    from: emailData.from,
    to: emailData.to,
    subject: emailData.subject || "No Subject",
    preview: cleanPreview,
    createdAt: emailData.created_at || new Date().toISOString(),
  });

  const fromAddr = (emailData.from || "").toLowerCase();
  const settings = await db.query.userSettings.findFirst({
    where: eq(userSettings.userId, resolvedUserId),
  });
  const ownDomain = settings?.senderEmail?.split("@")[1]?.toLowerCase();

  if (ownDomain && fromAddr.includes(`@${ownDomain}`)) {
    return;
  }

  const activeAutomations = await db.query.automations.findMany({
    where: and(
      eq(automations.enabled, true),
      eq(automations.userId, resolvedUserId),
    ),
  });

  const emailCtx = {
    id: emailData.id,
    from: emailData.from,
    to: toArray(emailData.to),
    subject: emailData.subject || "",
    text: emailData.text || "",
    html: emailData.html || "",
    labels: [] as string[],
  };

  const matching = activeAutomations.filter(
    (auto) =>
      auto.userId === resolvedUserId &&
      matchesTrigger(auto, { from: emailCtx.from, subject: emailCtx.subject }),
  );

  await Promise.allSettled(
    matching.map((auto) =>
      automationQueue.add("execute-automation", {
        automationId: auto.id,
        triggerPayload: {
          email: emailCtx,
          triggerSource: "Resend Inbound Email Webhook",
          simulated: false,
        },
      }),
    ),
  );

  return {
    emailId: emailData.id,
    userId: resolvedUserId,
    matchedAutomationCount: matching.length,
    sourceEmailId: eventData.email_id || emailId,
  };
}
