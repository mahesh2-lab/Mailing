import { NextResponse, after } from "next/server";
import { Webhook } from "svix";
import { and, eq } from "drizzle-orm";
import { db } from "@/src/index";
import {
  emails,
  webhookEvents,
  userApiKeys,
  automations,
} from "@/src/db/schema";
import { pusherServer } from "@/src/lib/pusher";
import { getResendClient } from "@/lib/resend";
import { decrypt } from "@/src/lib/crypto";
import { matchesTrigger } from "@/lib/automation-engine";
import { automationQueue } from "@/lib/queue";

import { userSettings } from "@/src/db/schema";

interface WebhookHeaders {
  id: string;
  timestamp: string;
  signature: string;
}

interface SecretCandidate {
  secret: string;
  userId?: string;
}

interface ResendEventData {
  email_id?: string;
  from?: string;
  to?: string | string[];
  subject?: string;
  bounce_summary?: string;
  [key: string]: unknown;
}

interface ResendWebhookEvent {
  type: string;
  created_at: string;
  data: ResendEventData;
}

function toArray<T>(value: T | T[] | null | undefined): T[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function cleanSecret(secret: string): string {
  return secret.trim().replace(/^["']|["']$/g, "");
}

function extractSvixHeaders(headers: Headers): WebhookHeaders | null {
  const id = headers.get("svix-id");
  const timestamp = headers.get("svix-timestamp");
  const signature = headers.get("svix-signature");

  if (!id || !timestamp || !signature) {
    return null;
  }

  return { id, timestamp, signature };
}

async function resolveSecretCandidates(
  queryUserId: string | null,
): Promise<SecretCandidate[]> {
  const candidates: SecretCandidate[] = [];

  if (queryUserId) {
    const userKey = await db.query.userApiKeys.findFirst({
      where: and(
        eq(userApiKeys.userId, queryUserId),
        eq(userApiKeys.provider, "Resend"),
      ),
    });

    if (userKey?.encryptedWebhookKey) {
      try {
        const decrypted = await decrypt(userKey.encryptedWebhookKey);
        candidates.push({
          secret: cleanSecret(decrypted),
          userId: queryUserId,
        });
      } catch (err) {
        console.error(
          "Failed to decrypt webhook secret for user:",
          queryUserId,
          err,
        );
      }
    }
  }

  try {
    const records = await db.query.userApiKeys.findMany({
      where: eq(userApiKeys.provider, "Resend"),
    });

    for (const record of records) {
      if (record.encryptedWebhookKey && record.userId !== queryUserId) {
        try {
          const decrypted = await decrypt(record.encryptedWebhookKey);
          candidates.push({
            secret: cleanSecret(decrypted),
            userId: record.userId,
          });
        } catch {}
      }
    }
  } catch (err) {
    console.error("Failed to query userApiKeys for webhook secrets:", err);
  }

  return candidates;
}

function verifyWebhookSignature(
  payload: string,
  svix: WebhookHeaders,
  candidates: SecretCandidate[],
): { isVerified: boolean; resolvedUserId: string | null } {
  let resolvedUserId: string | null = null;
  let isVerified = false;

  for (const candidate of candidates) {
    try {
      const wh = new Webhook(candidate.secret);
      wh.verify(payload, {
        "svix-id": svix.id,
        "svix-timestamp": svix.timestamp,
        "svix-signature": svix.signature,
      });

      isVerified = true;
      if (candidate.userId) {
        resolvedUserId = candidate.userId;
      }
      console.log(
        `[Webhook:Resend] Signature verified successfully with secret starting with: ${candidate.secret.slice(0, 8)}...`,
      );
      break;
    } catch (err: any) {
      console.log(
        `[Webhook:Resend] Signature mismatch with secret candidate starting with: ${candidate.secret.slice(0, 8)}...`,
      );
    }
  }

  if (!isVerified) {
    console.warn(
      `[Webhook:Resend] Signature verification failed across all ${candidates.length} secret candidates! Check configured webhook secrets.`
    );
  }

  return { isVerified, resolvedUserId };
}

async function handleEmailReceived(
  emailId: string,
  resolvedUserId: string | null,
  eventData: ResendEventData,
) {
  const resendClient = await getResendClient(resolvedUserId);
  if (!resendClient) {
    console.error("No Resend client available to fetch email:", emailId);
    return;
  }

  const { data: emailData, error } =
    await resendClient.emails.receiving.get(emailId);

  if (error || !emailData) {
    console.error("Failed to fetch received email from Resend API:", error);
    try {
      await pusherServer.trigger("emails", "new-email", {
        emailId,
        from: eventData.from || "Unknown",
        subject: eventData.subject || "New Email",
      });
    } catch (err) {
      console.error("Failed to trigger Pusher fallback event:", err);
    }
    return;
  }

  // Persist email to database
  await db
    .insert(emails)
    .values({
      id: emailData.id,
      userId: resolvedUserId!,
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

  try {
    const rawPreview = emailData.text || emailData.html || "";
    const cleanPreview = rawPreview.replace(/<[^>]+>/g, "").slice(0, 130);

    await pusherServer.trigger("emails", "new-email", {
      emailId: emailData.id,
      from: emailData.from,
      to: emailData.to,
      subject: emailData.subject || "No Subject",
      preview: cleanPreview,
      createdAt: emailData.created_at || new Date().toISOString(),
    });
  } catch (err) {
    console.error("Failed to trigger Pusher real-time event:", err);
  }

  // Trigger active automations. Runs inside the request's `after()` scope so it
  // reliably completes on serverless instead of being frozen post-response.
  try {
    const fromAddr = (emailData.from || "").toLowerCase();
    const settings = await db.query.userSettings.findFirst({
      where: eq(userSettings.userId, resolvedUserId!),
    });
    const ownDomain = settings?.senderEmail ? settings.senderEmail.split("@")[1]?.toLowerCase() : null;

    if (ownDomain && fromAddr.includes("@" + ownDomain)) {
      console.log(
        `[Webhook:Resend] Inbound email is from our own domain (${fromAddr}); skipping automations to avoid mail loops.`,
      );
      return;
    }

    const activeAutomations = await db.query.automations.findMany({
      where: eq(automations.enabled, true),
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

    // Only run automations whose trigger filters actually match this email,
    // so a subject/sender filter genuinely gates the workflow.
    const matching = activeAutomations.filter((auto) =>
      matchesTrigger(auto, { from: emailCtx.from, subject: emailCtx.subject }),
    );

    console.log(
      `[Webhook:Resend] ${matching.length}/${activeAutomations.length} enabled automations matched this email.`,
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
        }).catch((autoErr) => {
          console.error(
            `Failed to enqueue automation ${auto.id}:`,
            autoErr,
          );
        }),
      ),
    );
  } catch (autoQueryErr) {
    console.error(
      "Failed to query active automations for inbound email:",
      autoQueryErr,
    );
  }
}

async function handleStatusChange(
  emailId: string,
  type: string,
  eventData: ResendEventData,
) {
  switch (type) {
    case "email.clicked":
    case "email.opened": {
      await db
        .update(emails)
        .set({ status: "read" })
        .where(eq(emails.id, emailId));
      try {
        await pusherServer.trigger("emails", "read", { emailId });
      } catch {}
      break;
    }
    case "email.delivered": {
      await db
        .update(emails)
        .set({ status: "delivered" })
        .where(eq(emails.id, emailId));
      try {
        await pusherServer.trigger("emails", "delivered", {
          emailId,
          timestamp: new Date().toISOString(),
        });
      } catch {}
      break;
    }
    case "email.bounced": {
      await db
        .update(emails)
        .set({ status: "bounced" })
        .where(eq(emails.id, emailId));
      try {
        await pusherServer.trigger("emails", "bounced", {
          emailId,
          reason: eventData.bounce_summary || "Unknown",
          timestamp: new Date().toISOString(),
        });
      } catch {}
      break;
    }
  }
}

export async function POST(request: Request) {
  try {
    console.log("request initialized");

    const url = new URL(request.url);
    const queryUserId = url.searchParams.get("userId");

    console.log(`[Webhook:Resend] Inbound HTTP POST received: ${request.url}`);

    // 1. Verify required Svix headers
    const svixHeaders = extractSvixHeaders(request.headers);
    if (!svixHeaders) {
      console.warn("[Webhook:Resend] Missing required Svix headers in request");
      return NextResponse.json(
        { error: "Missing svix headers" },
        { status: 400 },
      );
    }

    const payload = await request.text();

    // 2. Resolve candidates and verify webhook signature
    const secretCandidates = await resolveSecretCandidates(queryUserId);
    if (secretCandidates.length === 0) {
      return NextResponse.json(
        { error: "Webhook secret not configured on server" },
        { status: 400 },
      );
    }

    const { isVerified, resolvedUserId } = verifyWebhookSignature(
      payload,
      svixHeaders,
      secretCandidates,
    );

    if (!isVerified) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    // 3. Parse JSON event payload
    let event: ResendWebhookEvent;
    try {
      event = JSON.parse(payload);
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON payload" },
        { status: 400 },
      );
    }

    // 4. Idempotency: if this delivery was already durably processed, just ack.
    const existing = await db.query.webhookEvents.findFirst({
      where: eq(webhookEvents.id, svixHeaders.id),
    });

    if (existing) {
      return NextResponse.json(
        { success: true, message: "Already processed" },
        { status: 200 },
      );
    }

    const emailId = event.data?.email_id;
    console.log(
      `[Webhook:Resend] Received event: ${event.type} for email: ${emailId || "none"}`,
    );

    // 5. Process after responding so Resend gets a fast 200, while `after()`
    //    guarantees the work still runs to completion (serverless-safe). The
    //    dedupe/audit row is written only AFTER processing succeeds, so a
    //    transient failure (e.g. Resend fetch error) is retried on redelivery
    //    instead of being permanently swallowed.
    //    Note: the pre-check above is not concurrency-safe against simultaneous
    //    identical deliveries; email persistence is idempotent, so the worst
    //    case is a rare duplicate automation run rather than a lost email.
    const recordEvent = () =>
      db
        .insert(webhookEvents)
        .values({
          id: svixHeaders.id,
          userId: resolvedUserId!,
          type: event.type,
          createdAt: event.created_at || new Date().toISOString(),
          emailId: emailId || null,
          data: event.data,
        })
        .onConflictDoNothing();

    if (emailId) {
      after(async () => {
        try {
          if (event.type === "email.received") {
            await handleEmailReceived(emailId, resolvedUserId, event.data);
          } else {
            await handleStatusChange(emailId, event.type, event.data);
          }
          await recordEvent();
        } catch (procErr) {
          console.error(
            `[Webhook:Resend] Background processing error for ${emailId} (will retry on redelivery):`,
            procErr,
          );
        }
      });
    } else {
      // No email to process; record the event so redeliveries no-op.
      await recordEvent();
    }

    return NextResponse.json(
      { success: true, event: event.type },
      { status: 200 },
    );
  } catch (error: any) {
    console.error("[Webhook:Resend] Processing exception:", error);
    return NextResponse.json(
      { error: error.message || "Failed to process webhook" },
      { status: 500 },
    );
  }
}
