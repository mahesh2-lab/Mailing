import { NextResponse } from "next/server";
import { db } from "@/src/index";
import { emails, webhookEvents, userApiKeys } from "@/src/db/schema";
import { eq, and } from "drizzle-orm";
import { getResendClient } from "@/lib/resend";
import { pusherServer } from "@/src/lib/pusher";
import { Webhook } from "svix";
import { decrypt } from "@/src/lib/crypto";

export async function POST(request: Request) {
  try {
    const url = new URL(request.url);
    const userId = url.searchParams.get("userId");

    if (!userId) {
      return NextResponse.json(
        { error: "Missing userId query parameter" },
        { status: 400 }
      );
    }

    
    const apiKeyRecord = await db.query.userApiKeys.findFirst({
      where: and(
        eq(userApiKeys.userId, userId),
        eq(userApiKeys.provider, "Resend")
      ),
    });

    if (!apiKeyRecord || !apiKeyRecord.encryptedWebhookKey) {
      return NextResponse.json(
        { error: "Webhook secret not configured for this user" },
        { status: 400 }
      );
    }

    let webhookSecret: string;
    try {
      webhookSecret = await decrypt(apiKeyRecord.encryptedWebhookKey);
    } catch (err) {
      return NextResponse.json(
        { error: "Failed to decrypt webhook secret" },
        { status: 500 }
      );
    }

    
    const payload = await request.text();
    const headersList = request.headers;
    const svix_id = headersList.get("svix-id");
    const svix_timestamp = headersList.get("svix-timestamp");
    const svix_signature = headersList.get("svix-signature");

    if (!svix_id || !svix_timestamp || !svix_signature) {
      return NextResponse.json(
        { error: "Missing svix headers" },
        { status: 400 }
      );
    }

    const wh = new Webhook(webhookSecret);
    let event: any;
    try {
      event = wh.verify(payload, {
        "svix-id": svix_id,
        "svix-timestamp": svix_timestamp,
        "svix-signature": svix_signature,
      });
    } catch (err) {
      console.error("Invalid webhook signature:", err);
      return NextResponse.json(
        { error: "Invalid signature" },
        { status: 401 }
      );
    }

    
    const existingEvent = await db.query.webhookEvents.findFirst({
      where: eq(webhookEvents.id, svix_id),
    });

    if (existingEvent) {
      return NextResponse.json({ success: true, message: "Already processed" }, { status: 200 });
    }

    if (event.type && typeof event.type === "string") {
      const emailId = event.data?.email_id;

      await db.insert(webhookEvents).values({
        id: svix_id,
        type: event.type,
        createdAt: event.created_at,
        emailId: emailId,
        data: event.data,
      });

      if (emailId) {
        if (event.type === "email.received") {
          const resend = await getResendClient(userId);
          if (resend) {
            const { data: fetchedEmail, error } = await resend.emails.receiving.get(emailId);
            if (fetchedEmail) {
              await db
                .insert(emails)
                .values({
                  id: fetchedEmail.id,
                  to: Array.isArray(fetchedEmail.to)
                    ? fetchedEmail.to
                    : fetchedEmail.to ? [fetchedEmail.to] : [],
                  from: fetchedEmail.from,
                  createdAt: fetchedEmail.created_at || new Date().toISOString(),
                  subject: fetchedEmail.subject || "No Subject",
                  html: fetchedEmail.html || "",
                  text: fetchedEmail.text || "",
                  bcc: Array.isArray(fetchedEmail.bcc) ? fetchedEmail.bcc : [],
                  cc: Array.isArray(fetchedEmail.cc) ? fetchedEmail.cc : [],
                  replyTo: Array.isArray(fetchedEmail.reply_to)
                    ? fetchedEmail.reply_to
                    : fetchedEmail.reply_to ? [fetchedEmail.reply_to] : [],
                  headers: fetchedEmail.headers || {},
                  attachments: fetchedEmail.attachments || [],
                  status: "received",
                  folder: "inbox",
                  unread: true,
                  starred: false,
                  labels: [],
                })
                .onConflictDoNothing();

              try {
                await pusherServer.trigger("emails", "new-email", {
                  emailId: fetchedEmail.id,
                  from: fetchedEmail.from,
                  to: fetchedEmail.to,
                  subject: fetchedEmail.subject || "No Subject",
                  preview: (fetchedEmail.text || fetchedEmail.html || "")
                    .replace(/<[^>]+>/g, "")
                    .slice(0, 130),
                  createdAt: fetchedEmail.created_at || new Date().toISOString(),
                });
              } catch (pushErr) {
                console.error("Pusher trigger new-email error:", pushErr);
              }
            } else {
              console.error("Failed to fetch received email from Resend API:", error);
              // Fallback
              try {
                await pusherServer.trigger("emails", "new-email", {
                  emailId,
                  from: event.data?.from || "Unknown",
                  subject: event.data?.subject || "New Email",
                });
              } catch (pushErr) {}
            }
          }
        } else if (event.type === "email.clicked" || event.type === "email.opened") {
          await db.update(emails).set({ status: "read" }).where(eq(emails.id, emailId));
          try {
            await pusherServer.trigger("emails", "read", { emailId });
          } catch (pushErr) {}
        } else if (event.type === "email.delivered") {
          await db.update(emails).set({ status: "delivered" }).where(eq(emails.id, emailId));
          try {
            await pusherServer.trigger("emails", "delivered", {
              emailId,
              to: event.data?.to,
              subject: event.data?.subject,
            });
          } catch (pushErr) {}
        } else if (event.type === "email.bounced") {
          await db.update(emails).set({ status: "bounced" }).where(eq(emails.id, emailId));
          try {
            await pusherServer.trigger("emails", "bounced", {
              emailId,
              to: event.data?.to,
              subject: event.data?.subject,
            });
          } catch (pushErr) {}
        }
      }
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("Webhook processing error:", error);
    return NextResponse.json(
      { error: "Failed to process webhook" },
      { status: 500 }
    );
  }
}
