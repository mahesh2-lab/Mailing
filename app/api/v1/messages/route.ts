import { NextResponse } from "next/server";
import { resend } from "@/lib/resend";
import { emails } from "@/src/db/schema";
import { db } from "@/src";
import { sql, eq, and, or, desc, ne } from "drizzle-orm";
import { pusherServer } from "@/src/lib/pusher";
import { getAuthSession } from "@/src/lib/require-auth";

export async function GET(request: Request) {
  const session = await getAuthSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);

  const folder = searchParams.get("folder")?.toLowerCase();
  const label = searchParams.get("label");

  try {
    let data: any;

    if (folder) {
      if (folder === "inbox") {
        data = await db
          .select()
          .from(emails)
          .where(eq(emails.folder, "inbox"))
          .orderBy(desc(emails.createdAt));
      } else if (folder === "starred") {
        data = await db
          .select()
          .from(emails)
          .where(and(eq(emails.starred, true), ne(emails.folder, "trash")))
          .orderBy(desc(emails.createdAt));
      } else if (folder === "sent") {
        data = await db
          .select()
          .from(emails)
          .where(eq(emails.folder, "sent"))
          .orderBy(desc(emails.createdAt));
      } else if (folder === "drafts") {
        data = await db
          .select()
          .from(emails)
          .where(or(eq(emails.folder, "drafts"), eq(emails.status, "draft")))
          .orderBy(desc(emails.createdAt));
      } else if (folder === "archive") {
        data = await db
          .select()
          .from(emails)
          .where(eq(emails.folder, "archive"))
          .orderBy(desc(emails.createdAt));
      } else if (folder === "trash") {
        data = await db
          .select()
          .from(emails)
          .where(eq(emails.folder, "trash"))
          .orderBy(desc(emails.createdAt));
      } else {
        data = await db
          .select()
          .from(emails)
          .where(eq(emails.folder, folder))
          .orderBy(desc(emails.createdAt));
      }
    } else if (label) {
      data = await db
        .select()
        .from(emails)
        .where(
          and(
            sql`${emails.labels}::text LIKE ${"%\"" + label + "\"%"}`,
            ne(emails.folder, "trash")
          )
        )
        .orderBy(desc(emails.createdAt));
    } else {
      data = await db
        .select()
        .from(emails)
        .orderBy(desc(emails.createdAt));
    }

    return NextResponse.json(data ?? []);
  } catch (error) {
    console.error("Failed to fetch emails:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getAuthSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { to, cc, bcc, subject, html, text, attachments } = await request.json();
    const recipients = Array.isArray(to) ? to : (to ? [to] : []);
    const ccList = cc ? (Array.isArray(cc) ? cc : [cc]) : [];
    const bccList = bcc ? (Array.isArray(bcc) ? bcc : [bcc]) : [];

    // Prepare Resend payload
    const resendPayload: any = {
      from: 'Mahesh <mahesh@heymahesh.in>',
      to: recipients,
      subject: subject || "No Subject",
      html: html || "<p></p>",
      text: text || "",
    };

    if (ccList.length > 0) resendPayload.cc = ccList;
    if (bccList.length > 0) resendPayload.bcc = bccList;
    if (Array.isArray(attachments) && attachments.length > 0) {
      resendPayload.attachments = attachments.map((att: any) => ({
        filename: att.filename || "attachment",
        content: att.content || "",
      }));
    }

    const { data, error } = await resend.emails.send(resendPayload);

    if (error) {
      return NextResponse.json({ error }, { status: 400 });
    }

    const emailId = data?.id || crypto.randomUUID();
    const now = new Date().toISOString();

    const storedAttachments = (attachments || []).map((att: any, idx: number) => ({
      id: att.id || `att_${idx}_${Date.now()}`,
      filename: att.filename,
      size: att.size || 0,
      content_type: att.type || "application/octet-stream",
      download_url: att.url || "#",
    }));

    await db.insert(emails).values({
      id: emailId,
      to: recipients,
      cc: ccList,
      bcc: bccList,
      from: 'Mahesh <mahesh@heymahesh.in>',
      createdAt: now,
      subject: subject || "No Subject",
      html: html || "<p></p>",
      text: text || "",
      attachments: storedAttachments,
      status: "sent",
      folder: "sent",
      starred: false,
      unread: false,
      labels: [],
    }).onConflictDoNothing();

    try {
      await pusherServer.trigger("emails", "sent", {
        emailId,
        to: recipients,
        subject: subject || "No Subject",
      });
    } catch (pushErr) {
      console.error("Pusher trigger sent error:", pushErr);
    }

    return NextResponse.json({ ...data, id: emailId }, { status: 201 });
  } catch (error) {
    console.error("Failed to send email:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}