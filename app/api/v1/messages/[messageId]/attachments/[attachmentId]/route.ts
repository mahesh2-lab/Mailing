import { NextResponse } from "next/server";
import { getResendClient } from "@/lib/resend";
import { auth } from "@/src/lib/auth";
import { headers } from "next/headers";
import { db } from "@/src";
import { emails } from "@/src/db/schema";
import { and, eq } from "drizzle-orm";
import { isRecord } from "@/src/lib/errors";
import dns from "node:dns";

if (typeof dns.setDefaultResultOrder === "function") {
  dns.setDefaultResultOrder("ipv4first");
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ messageId: string; attachmentId: string }> }
) {
  const { messageId, attachmentId } = await params;
  
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  
  if (!session || !session.user) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const resend = await getResendClient(session.user.id);
  if (!resend) {
    return new NextResponse("Resend not configured", { status: 400 });
  }

  try {
    const [emailRecord] = await db
      .select({ attachments: emails.attachments, status: emails.status })
      .from(emails)
      .where(and(eq(emails.id, messageId), eq(emails.userId, session.user.id)))
      .limit(1);

    if (!emailRecord) {
      return new NextResponse("Message not found", { status: 404 });
    }

    let downloadUrl: string | undefined;
    let filename = "attachment";
    let contentType = "application/octet-stream";

    // 1. Try receiving attachments first
    try {
      const res = await resend.emails.receiving.attachments.get({
        emailId: messageId,
        id: attachmentId,
      });
      if (res.data?.download_url) {
        downloadUrl = res.data.download_url;
        filename = res.data.filename || filename;
        contentType = res.data.content_type || contentType;
      }
    } catch (receivingErr) {
      console.warn(`Could not get attachment from receiving API for email ${messageId}:`, receivingErr);
    }

    // 2. If not found, try sent attachments
    if (!downloadUrl) {
      try {
        const res = await resend.emails.attachments.get({
          emailId: messageId,
          id: attachmentId,
        });
        if (res.data?.download_url) {
          downloadUrl = res.data.download_url;
          filename = res.data.filename || filename;
          contentType = res.data.content_type || contentType;
        }
      } catch (sentErr) {
        console.warn(`Could not get attachment from sent API for email ${messageId}:`, sentErr);
      }
    }

    // 3. If API didn't return a URL, check stored attachment metadata in DB
    if (!downloadUrl && emailRecord.attachments && Array.isArray(emailRecord.attachments)) {
      const attachment = emailRecord.attachments.find(
        (item) => isRecord(item) && item.id === attachmentId,
      );
      if (isRecord(attachment)) {
        if (typeof attachment.filename === "string") filename = attachment.filename;
        if (typeof attachment.content_type === "string") contentType = attachment.content_type;
        if (typeof attachment.download_url === "string") downloadUrl = attachment.download_url;
      }
    }

    if (!downloadUrl) {
      return new NextResponse("Attachment not found", { status: 404 });
    }

    // Fetch and proxy the file so the browser downloads it with proper Content-Disposition
    const urlObj = new URL(request.url);
    const forceDownload = urlObj.searchParams.get("download") === "1" || urlObj.searchParams.get("dl") === "1";
    const dispositionType = forceDownload ? "attachment" : "inline";

    try {
      const fileRes = await fetch(downloadUrl);
      if (fileRes.ok && fileRes.body) {
        const resHeaders = new Headers();
        resHeaders.set("Content-Type", fileRes.headers.get("content-type") || contentType);
        resHeaders.set(
          "Content-Disposition",
          `${dispositionType}; filename="${encodeURIComponent(filename)}"`
        );
        const len = fileRes.headers.get("content-length");
        if (len) resHeaders.set("Content-Length", len);
        resHeaders.set("Cache-Control", "private, max-age=3600");

        return new NextResponse(fileRes.body, {
          status: 200,
          headers: resHeaders,
        });
      }
    } catch (fetchErr) {
      console.warn("Direct stream fetch failed, redirecting to signed URL:", fetchErr);
    }

    return NextResponse.redirect(downloadUrl, 302);
  } catch (err) {
    console.error("Error fetching attachment:", err);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
