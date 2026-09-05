import { NextResponse } from "next/server";

import { emails, userSettings } from "@/src/db/schema";
import { db } from "@/src";
import { sql, eq, and, or, desc, ne } from "drizzle-orm";
import { getResendClient } from "@/lib/resend";
import { pusherServer } from "@/src/lib/pusher";
import { getAuthSession } from "@/src/lib/require-auth";

export async function GET(request: Request) {
  const session = await getAuthSession();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);

  const folder = searchParams.get("folder")?.toLowerCase();
  const label = searchParams.get("label");

  try {
    let data: any;

    const userId = session.user.id;

    if (folder) {
      if (folder === "inbox") {
        data = await db
          .select()
          .from(emails)
          .where(and(eq(emails.folder, "inbox"), eq(emails.userId, userId)))
          .orderBy(desc(emails.createdAt));
      } else if (folder === "starred") {
        data = await db
          .select()
          .from(emails)
          .where(and(eq(emails.starred, true), ne(emails.folder, "trash"), eq(emails.userId, userId)))
          .orderBy(desc(emails.createdAt));
      } else if (folder === "sent") {
        data = await db
          .select()
          .from(emails)
          .where(and(eq(emails.folder, "sent"), eq(emails.userId, userId)))
          .orderBy(desc(emails.createdAt));
      } else if (folder === "drafts") {
        data = await db
          .select()
          .from(emails)
          .where(and(or(eq(emails.folder, "drafts"), eq(emails.status, "draft")), eq(emails.userId, userId)))
          .orderBy(desc(emails.createdAt));
      } else if (folder === "archive") {
        data = await db
          .select()
          .from(emails)
          .where(and(eq(emails.folder, "archive"), eq(emails.userId, userId)))
          .orderBy(desc(emails.createdAt));
      } else if (folder === "trash") {
        data = await db
          .select()
          .from(emails)
          .where(and(eq(emails.folder, "trash"), eq(emails.userId, userId)))
          .orderBy(desc(emails.createdAt));
      } else {
        data = await db
          .select()
          .from(emails)
          .where(and(eq(emails.folder, folder), eq(emails.userId, userId)))
          .orderBy(desc(emails.createdAt));
      }
    } else if (label) {
      data = await db
        .select()
        .from(emails)
        .where(
          and(
            sql`${emails.labels}::text LIKE ${'%"' + label + '"%'}`,
            ne(emails.folder, "trash"),
            eq(emails.userId, userId)
          ),
        )
        .orderBy(desc(emails.createdAt));
    } else {
      data = await db.select().from(emails).where(eq(emails.userId, userId)).orderBy(desc(emails.createdAt));
    }

    return NextResponse.json(data ?? []);
  } catch (error) {
    console.error("Failed to fetch emails:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const internalToken = request.headers.get("x-internal-token");
    const internalSecret = process.env.INTERNAL_API_SECRET || "default-internal-secret-123";
    const isInternal = internalToken === internalSecret;

    const body = await request.json();
    const { to, cc, bcc, subject, html, text, attachments, isDraft } = body;
    
    let userId: string;
    if (isInternal) {
      if (!body.userId) return NextResponse.json({ error: "Missing userId for internal request" }, { status: 400 });
      userId = body.userId;
    } else {
      const session = await getAuthSession();
      if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      userId = session.user.id;
    }

    const recipients = Array.isArray(to) ? to : to ? [to] : [];
    const ccList = cc ? (Array.isArray(cc) ? cc : [cc]) : [];
    const bccList = bcc ? (Array.isArray(bcc) ? bcc : [bcc]) : [];

    const settings = await db.query.userSettings.findFirst({
      where: eq(userSettings.userId, userId)
    });

    const fromAddress = settings ? `${settings.senderName} <${settings.senderEmail}>` : "Mahesh <mahesh@heymahesh.in>";

    // Prepare Resend payload
    const resendPayload: any = {
      from: fromAddress,
      to: recipients,
      subject: subject || "No Subject",
    };

    if (html) {
      resendPayload.html = html;
    } else if (text) {
      resendPayload.text = text;
      // Optionally provide a basic HTML fallback to ensure consistent rendering
      resendPayload.html = `<p>${text.replace(/\n/g, "<br>")}</p>`;
    } else {
      resendPayload.html = "<p></p>";
    }

    if (ccList.length > 0) resendPayload.cc = ccList;
    if (bccList.length > 0) resendPayload.bcc = bccList;
    if (Array.isArray(attachments) && attachments.length > 0) {
      resendPayload.attachments = attachments.map((att: any) => ({
        filename: att.filename || "attachment",
        content: att.content || "",
      }));
    }

    let emailId = crypto.randomUUID();
    
    if (!isDraft) {
      const resend = await getResendClient(userId);
      if (!resend) {
        return NextResponse.json({ error: "Resend not configured" }, { status: 400 });
      }
      const { data, error } = await resend.emails.send(resendPayload);
      if (error) {
        return NextResponse.json({ error }, { status: 400 });
      }
      emailId = data?.id || emailId;
    }

    const now = new Date().toISOString();

    const storedAttachments = (attachments || []).map(
      (att: any, idx: number) => ({
        id: att.id || `att_${idx}_${Date.now()}`,
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
        html: resendPayload.html,
        text: resendPayload.text || "",
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
        await pusherServer.trigger("emails", "sent", {
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
