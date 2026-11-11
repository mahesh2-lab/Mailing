import { NextResponse } from "next/server";

import { emails, userSettings } from "@/src/db/schema";
import { db } from "@/src";
import { sql, eq, and, or, desc, ne } from "drizzle-orm";
import { createHash } from "node:crypto";
import { getResendClient } from "@/lib/resend";
import { pusherServer } from "@/src/lib/pusher";
import { getAuthSession } from "@/src/lib/require-auth";
import { gravatarUrl } from "@/lib/gravatar";
import { emailChannelForUser } from "@/lib/realtime-channels";
import { escapeHtml } from "@/lib/utils";
import { z } from "zod";

const EmailAddress = z.string().trim().email().max(320);
const MessageInput = z.object({
  userId: z.string().min(1).optional(),
  to: z.union([EmailAddress, z.array(EmailAddress).max(100)]).optional(),
  cc: z.union([EmailAddress, z.array(EmailAddress).max(100)]).optional(),
  bcc: z.union([EmailAddress, z.array(EmailAddress).max(100)]).optional(),
  subject: z.string().max(998).optional(),
  html: z.string().max(1_000_000).optional(),
  text: z.string().max(1_000_000).optional(),
  attachments: z.array(z.object({
    id: z.string().optional(),
    filename: z.string().min(1).max(255),
    size: z.number().nonnegative().optional(),
    type: z.string().max(255).optional(),
    url: z.string().max(4096).optional(),
    content: z.string().max(14_000_000).optional(),
  })).max(20).optional(),
  isDraft: z.boolean().optional(),
}).superRefine((message, context) => {
  if (!message.isDraft && !message.to) {
    context.addIssue({ code: "custom", path: ["to"], message: "At least one recipient is required" });
  }
});

export async function GET(request: Request) {
  const session = await getAuthSession();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);

  const folder = searchParams.get("folder")?.toLowerCase();
  const label = searchParams.get("label");
    const limitParam = searchParams.get("limit");
    const offsetParam = searchParams.get("offset") ?? "0";
    const pageLimit = limitParam === null ? null : Number(limitParam);
    const offset = Number(offsetParam);
    if (
      (pageLimit !== null && (!Number.isInteger(pageLimit) || pageLimit < 1 || pageLimit > 100)) ||
      !Number.isSafeInteger(offset) || offset < 0
    ) {
      return NextResponse.json({ error: "Invalid pagination" }, { status: 400 });
    }

  try {
    const userId = session.user.id;

    if (searchParams.get("summary") === "1") {
      const result = await db.execute(sql`
        WITH unread AS (
          SELECT lower(folder) AS folder, lower(status) AS status, starred, labels
          FROM emails WHERE user_id = ${userId} AND unread = true
        ), counts AS (
          SELECT CASE
            WHEN folder = 'drafts' OR status = 'draft' THEN 'Drafts'
            WHEN folder = 'inbox' THEN 'Inbox'
            WHEN folder = 'sent' THEN 'Sent'
            WHEN folder = 'archive' THEN 'Archive'
            WHEN folder = 'trash' THEN 'Trash'
          END AS key, count(*)::int AS count
          FROM unread GROUP BY 1
          UNION ALL
          SELECT 'Starred', count(*)::int FROM unread WHERE starred AND folder <> 'trash' HAVING count(*) > 0
          UNION ALL
          SELECT label.value, count(*)::int
          FROM unread CROSS JOIN LATERAL jsonb_array_elements_text(coalesce(labels, '[]'::jsonb)) AS label(value)
          WHERE folder <> 'trash' GROUP BY label.value
        )
        SELECT key, sum(count)::int AS count FROM counts WHERE key IS NOT NULL GROUP BY key
      `);
      const counts = Object.fromEntries(result.rows.map((row) => [String(row.key), Number(row.count)]));
      return NextResponse.json(counts);
    }

    const filters = [eq(emails.userId, userId)];

    if (folder) {
      if (folder === "inbox") {
        filters.push(eq(emails.folder, "inbox"));
      } else if (folder === "starred") {
        filters.push(eq(emails.starred, true), ne(emails.folder, "trash"));
      } else if (folder === "sent") {
        filters.push(eq(emails.folder, "sent"));
      } else if (folder === "drafts") {
        filters.push(or(eq(emails.folder, "drafts"), eq(emails.status, "draft"))!);
      } else if (folder === "archive") {
        filters.push(eq(emails.folder, "archive"));
      } else if (folder === "trash") {
        filters.push(eq(emails.folder, "trash"));
      } else {
        filters.push(eq(emails.folder, folder));
      }
    } else if (label) {
      filters.push(sql`${emails.labels}::text LIKE ${'%"' + label + '"%'}`, ne(emails.folder, "trash"));
    }

    const query = db.select({
      id: emails.id,
      from: emails.from,
      createdAt: emails.createdAt,
      subject: emails.subject,
      preview: sql<string>`left(regexp_replace(coalesce(${emails.text}, ${emails.html}, ''), '<[^>]*>', ' ', 'g'), 140)`,
      folder: emails.folder,
      status: emails.status,
      starred: emails.starred,
      unread: emails.unread,
      labels: emails.labels,
      attachments: emails.attachments,
    }).from(emails).where(and(...filters)).orderBy(desc(emails.createdAt));
    if (pageLimit === null) {
      const rows = await query;
      return NextResponse.json(rows.map((row) => ({ ...row, avatarUrl: gravatarUrl(row.from) })));
    }

    const rows = await query.limit(pageLimit + 1).offset(offset);
    return NextResponse.json(rows.slice(0, pageLimit).map((row) => ({
      ...row,
      avatarUrl: gravatarUrl(row.from),
    })), {
      headers: { "x-has-more": String(rows.length > pageLimit) },
    });
  } catch (error) {
    console.error("Failed to fetch emails:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const internalToken = request.headers.get("x-internal-token");
    const internalSecret = process.env.INTERNAL_API_SECRET;
    const isInternal = Boolean(internalSecret && internalToken === internalSecret);

    const parsed = MessageInput.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Invalid email payload" }, { status: 400 });
    const body = parsed.data;
    const { to, cc, bcc, subject, html, text, attachments, isDraft } = body;

    let userId: string;
    if (isInternal) {
      if (!body.userId)
        return NextResponse.json(
          { error: "Missing userId for internal request" },
          { status: 400 },
        );
      userId = body.userId;
    } else {
      const session = await getAuthSession();
      if (!session)
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      userId = session.user.id;
    }

    const recipients = Array.isArray(to) ? to : to ? [to] : [];
    const ccList = cc ? (Array.isArray(cc) ? cc : [cc]) : [];
    const bccList = bcc ? (Array.isArray(bcc) ? bcc : [bcc]) : [];

    const settings = await db.query.userSettings.findFirst({
      where: eq(userSettings.userId, userId),
    });

    if (!settings) return NextResponse.json({ error: "Complete sender setup before composing email" }, { status: 400 });
    const fromAddress = `${settings.senderName} <${settings.senderEmail}>`;

    // Prepare Resend payload
    const htmlBody = html ?? (text
      ? `<p>${text.split(/\r?\n/).map(escapeHtml).join("<br>")}</p>`
      : "<p></p>");
    const resendPayload = {
      from: fromAddress,
      to: recipients,
      subject: subject || "No Subject",
      html: htmlBody,
      ...(text ? { text } : {}),
      ...(ccList.length ? { cc: ccList } : {}),
      ...(bccList.length ? { bcc: bccList } : {}),
      ...(attachments?.length ? {
        attachments: attachments.map((att) => ({
          filename: att.filename,
          content: att.content || "",
        })),
      } : {}),
    };

    const now = new Date().toISOString();
    const storedAttachments = (attachments || []).map((att) => ({
      id: att.id || crypto.randomUUID(),
      filename: att.filename,
      size: att.size || 0,
      content_type: att.type || "application/octet-stream",
      download_url: att.url || "#",
    }));
    let emailId = crypto.randomUUID();

    if (!isDraft) {
      // Clients without this header remain supported, but retries are idempotent only when they reuse it.
      const idempotencyKey = request.headers.get("Idempotency-Key") || crypto.randomUUID();
      if (idempotencyKey.length > 256) {
        return NextResponse.json({ error: "Invalid Idempotency-Key" }, { status: 400 });
      }
      const requestHash = createHash("sha256").update(JSON.stringify(resendPayload)).digest("hex");
      const existingByKey = async () => db.query.emails.findFirst({
        where: and(eq(emails.userId, userId), eq(emails.idempotencyKey, idempotencyKey)),
      });
      let existing = await existingByKey();
      if (existing) {
        if (existing.requestHash !== requestHash) {
          return NextResponse.json({ error: "Idempotency-Key was already used for a different email" }, { status: 409 });
        }
        emailId = existing.id;
        if (existing.providerId) return NextResponse.json({ id: emailId, isDraft: false }, { status: 200 });
      } else {
        const [claimed] = await db.insert(emails).values({
          id: emailId,
          userId,
          idempotencyKey,
          requestHash,
          to: recipients,
          cc: ccList,
          bcc: bccList,
          from: fromAddress,
          createdAt: now,
          subject: subject || "No Subject",
          html: htmlBody,
          text: text || "",
          attachments: storedAttachments,
          status: "sending",
          folder: "outbox",
          starred: false,
          unread: false,
          labels: [],
        }).onConflictDoNothing().returning({ id: emails.id });
        if (!claimed) {
          existing = await existingByKey();
          if (!existing || existing.requestHash !== requestHash) {
            return NextResponse.json({ error: "Email request is already being processed" }, { status: 409 });
          }
          emailId = existing.id;
          if (existing.providerId) return NextResponse.json({ id: emailId, isDraft: false }, { status: 200 });
        }
      }

      const resend = await getResendClient(userId);
      if (!resend) {
        return NextResponse.json(
          { error: "Resend not configured" },
          { status: 400 },
        );
      }
      // shortcut: Resend retains idempotency keys for 24 hours; reconcile an older pending outbox row before retrying it.
      const { data, error } = await resend.emails.send(resendPayload, { idempotencyKey });
      if (error) {
        return NextResponse.json({ error }, { status: 502 });
      }
      if (!data?.id) return NextResponse.json({ error: "Email provider returned no message ID" }, { status: 502 });
      await db.update(emails).set({ providerId: data.id, status: "sent", folder: "sent" })
        .where(and(eq(emails.id, emailId), eq(emails.userId, userId)));
    } else {
      await db.insert(emails).values({
        id: emailId,
        userId,
        to: recipients,
        cc: ccList,
        bcc: bccList,
        from: fromAddress,
        createdAt: now,
        subject: subject || "No Subject",
        html: htmlBody,
        text: text || "",
        attachments: storedAttachments,
        status: "draft",
        folder: "drafts",
        starred: false,
        unread: false,
        labels: [],
      }).onConflictDoNothing();
    }

    if (!isDraft) {
      try {
        await pusherServer.trigger(emailChannelForUser(userId), "sent", {
          emailId,
          to: recipients,
          subject: subject || "No Subject",
        });
      } catch (pushErr) {
        console.error("Pusher trigger sent error:", pushErr);
      }
    }

    return NextResponse.json({ id: emailId, isDraft }, { status: 201 });
  } catch (error) {
    console.error("Failed to send email:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
