import { NextResponse } from "next/server";

import { emails, userSettings } from "@/src/db/schema";
import { db } from "@/src";
import { sql, eq, and, or, desc, ne } from "drizzle-orm";
import { getResendClient } from "@/lib/resend";
import { pusherServer } from "@/src/lib/pusher";
import { getAuthSession } from "@/src/lib/require-auth";
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
      const rows = await db.select({
        folder: emails.folder,
        status: emails.status,
        starred: emails.starred,
        unread: emails.unread,
        labels: emails.labels,
      }).from(emails).where(eq(emails.userId, userId));
      const counts: Record<string, number> = {};
      for (const row of rows) {
        const folderName = row.folder.toLowerCase();
        if (row.unread) {
          const key = folderName === "drafts" || row.status.toLowerCase() === "draft" ? "Drafts" :
            folderName === "inbox" ? "Inbox" : folderName === "sent" ? "Sent" :
            folderName === "archive" ? "Archive" : folderName === "trash" ? "Trash" : null;
          if (key) counts[key] = (counts[key] || 0) + 1;
          if (row.starred && folderName !== "trash") counts.Starred = (counts.Starred || 0) + 1;
          if (folderName !== "trash") {
            for (const name of row.labels || []) counts[name] = (counts[name] || 0) + 1;
          }
        }
      }
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
    if (pageLimit === null) return NextResponse.json(await query);

    const rows = await query.limit(pageLimit + 1).offset(offset);
    return NextResponse.json(rows.slice(0, pageLimit), {
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

    let emailId = crypto.randomUUID();

    if (!isDraft) {
      const resend = await getResendClient(userId);
      if (!resend) {
        return NextResponse.json(
          { error: "Resend not configured" },
          { status: 400 },
        );
      }
      const { data, error } = await resend.emails.send(resendPayload);
      if (error) {
        return NextResponse.json({ error }, { status: 400 });
      }
      emailId = data?.id || emailId;
    }

    const now = new Date().toISOString();

    const storedAttachments = (attachments || []).map(
      (att) => ({
        id: att.id || crypto.randomUUID(),
        filename: att.filename,
        size: att.size || 0,
        content_type: att.type || "application/octet-stream",
        download_url: att.url || "#",
      }),
    );

    await db
      .insert(emails)
      .values({
        id: emailId,
        userId: userId,
        to: recipients,
        cc: ccList,
        bcc: bccList,
        from: fromAddress,
        createdAt: now,
        subject: subject || "No Subject",
        html: htmlBody,
        text: text || "",
        attachments: storedAttachments,
        status: isDraft ? "draft" : "sent",
        folder: isDraft ? "drafts" : "sent",
        starred: false,
        unread: false,
        labels: [],
      })
      .onConflictDoNothing();

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
