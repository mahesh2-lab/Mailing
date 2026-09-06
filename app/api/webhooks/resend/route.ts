import { NextResponse, after } from "next/server";
import { Webhook } from "svix";
import { eq } from "drizzle-orm";
import { db } from "@/src/index";
import { emails, webhookEvents, userApiKeys } from "@/src/db/schema";
import { pusherServer } from "@/src/lib/pusher";
import { decrypt } from "@/src/lib/crypto";
import { mailFetchQueue } from "@/lib/queue";
import {
  emailChannelForUser,
  notificationChannelForUser,
} from "@/lib/realtime-channels";
import { type ResendEventData } from "@/lib/mail-fetch-processor";

interface WebhookHeaders {
  id: string;
  timestamp: string;
  signature: string;
}

interface SecretCandidate {
  secret: string;
  userId: string;
}

interface ResendWebhookEvent {
  type: string;
  created_at: string;
  data: ResendEventData;
}

const DEBUG_WEBHOOKS = process.env.DEBUG_WEBHOOKS === "true";

function debugWebhookLog(...args: unknown[]) {
  if (DEBUG_WEBHOOKS) {
    console.log(...args);
  }
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

async function resolveSecretForUser(
  queryUserId: string,
): Promise<SecretCandidate | null> {
  const userKey = await db.query.userApiKeys.findFirst({
    where: (fields, { and, eq }) =>
      and(eq(fields.userId, queryUserId), eq(fields.provider, "Resend")),
  });

  if (!userKey?.encryptedWebhookKey) {
    return null;
  }

  try {
    const decrypted = await decrypt(userKey.encryptedWebhookKey);
    return {
      secret: cleanSecret(decrypted),
      userId: queryUserId,
    };
  } catch (err) {
    console.error(
      "Failed to decrypt webhook secret for user:",
      queryUserId,
      err,
    );
    return null;
  }
}

async function resolveFallbackSecretCandidates(
  excludeUserId?: string | null,
): Promise<SecretCandidate[]> {
  const candidates: SecretCandidate[] = [];

  try {
    const records = await db.query.userApiKeys.findMany({
      where: eq(userApiKeys.provider, "Resend"),
    });

    for (const record of records) {
      if (record.encryptedWebhookKey && record.userId !== excludeUserId) {
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

  debugWebhookLog(
    `[Webhook:Resend] Verifying signature for ${candidates.length} candidate(s), payload length ${payload.length}.`,
  );

  for (const candidate of candidates) {
    try {
      const wh = new Webhook(candidate.secret);
      wh.verify(payload, {
        "svix-id": svix.id,
        "svix-timestamp": svix.timestamp,
        "svix-signature": svix.signature,
      });

      resolvedUserId = candidate.userId;
      return { isVerified: true, resolvedUserId };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "unknown error";
      debugWebhookLog(
        `[Webhook:Resend] Signature mismatch for candidate user ${candidate.userId}: ${message}`,
      );
    }
  }

  return { isVerified: false, resolvedUserId };
}

async function handleStatusChange(
  emailId: string,
  resolvedUserId: string,
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
        await pusherServer.trigger(emailChannelForUser(resolvedUserId), "read", {
          emailId,
        });
      } catch {}
      break;
    }
    case "email.delivered": {
      await db
        .update(emails)
        .set({ status: "delivered" })
        .where(eq(emails.id, emailId));
      try {
        await pusherServer.trigger(
          emailChannelForUser(resolvedUserId),
          "delivered",
          {
            emailId,
            timestamp: new Date().toISOString(),
          },
        );
      } catch {}
      break;
    }
    case "email.bounced": {
      await db
        .update(emails)
        .set({ status: "bounced" })
        .where(eq(emails.id, emailId));
      try {
        await pusherServer.trigger(emailChannelForUser(resolvedUserId), "bounced", {
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
    const url = new URL(request.url);
    const queryUserId = url.searchParams.get("userId");

    const svixHeaders = extractSvixHeaders(request.headers);
    if (!svixHeaders) {
      return NextResponse.json(
        { error: "Missing svix headers" },
        { status: 400 },
      );
    }

    const payload = await request.text();

    let verificationResult = { isVerified: false, resolvedUserId: null as string | null };

    if (queryUserId) {
      const candidate = await resolveSecretForUser(queryUserId);
      if (candidate) {
        verificationResult = verifyWebhookSignature(payload, svixHeaders, [
          candidate,
        ]);
      }

      if (!verificationResult.isVerified) {
        console.warn(
          `[Webhook:Resend] Falling back to full secret scan after query userId verification failed for userId=${queryUserId}.`,
        );
        const fallbackCandidates =
          await resolveFallbackSecretCandidates(queryUserId);
        verificationResult = verifyWebhookSignature(
          payload,
          svixHeaders,
          fallbackCandidates,
        );
      }
    } else {
      console.warn(
        "[Webhook:Resend] Falling back to full secret scan because webhook URL is missing ?userId=.",
      );
      const fallbackCandidates = await resolveFallbackSecretCandidates();
      verificationResult = verifyWebhookSignature(
        payload,
        svixHeaders,
        fallbackCandidates,
      );
    }

    if (!verificationResult.isVerified || !verificationResult.resolvedUserId) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    let event: ResendWebhookEvent;
    try {
      event = JSON.parse(payload);
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON payload" },
        { status: 400 },
      );
    }

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
    const resolvedUserId = verificationResult.resolvedUserId;

    const recordEvent = () =>
      db
        .insert(webhookEvents)
        .values({
          id: svixHeaders.id,
          userId: resolvedUserId,
          type: event.type,
          createdAt: event.created_at || new Date().toISOString(),
          emailId: emailId || null,
          data: event.data,
        })
        .onConflictDoNothing();

    if (emailId && event.type === "email.received") {
      await mailFetchQueue.add(
        "fetch-inbound-email",
        {
          emailId,
          resolvedUserId,
          eventData: event.data,
        },
        {
          attempts: 3,
          backoff: {
            type: "exponential",
            delay: 2000,
          },
        },
      );
      await recordEvent();
    } else if (emailId) {
      // Intentional: keep lightweight status updates in `after()` instead of queueing.
      after(async () => {
        try {
          await handleStatusChange(emailId, resolvedUserId, event.type, event.data);
          await recordEvent();
        } catch (procErr) {
          console.error("[Webhook:Resend] Background status processing error:", {
            emailId,
            error: procErr,
          });
        }
      });
    } else {
      await recordEvent();
    }

    return NextResponse.json(
      { success: true, event: event.type },
      { status: 200 },
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to process webhook";
    console.error("[Webhook:Resend] Processing exception:", error);
    return NextResponse.json(
      { error: message },
      { status: 500 },
    );
  }
}

export const __internal = {
  handleStatusChange,
  resolveSecretForUser,
  resolveFallbackSecretCandidates,
  verifyWebhookSignature,
  notificationChannelForUser,
};
