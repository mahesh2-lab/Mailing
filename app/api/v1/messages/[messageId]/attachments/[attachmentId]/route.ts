import { NextResponse } from "next/server";
import { getResendClient } from "@/lib/resend";
import { auth } from "@/src/lib/auth";
import { headers } from "next/headers";
import { db } from "@/src";
import { emails } from "@/src/db/schema";
import { and, eq } from "drizzle-orm";
import { isRecord } from "@/src/lib/errors";

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
      .select({ attachments: emails.attachments })
      .from(emails)
      .where(and(eq(emails.id, messageId), eq(emails.userId, session.user.id)))
      .limit(1);
    if (!emailRecord) return new NextResponse("Message not found", { status: 404 });

    const { data, error } = await resend.emails.receiving.attachments.get({
      emailId: messageId,
      id: attachmentId,
    });

    if (error || !data) {
      console.error("Failed to fetch attachment from Resend:", error);
      
      if (emailRecord && Array.isArray(emailRecord.attachments)) {
        const attachment = emailRecord.attachments.find(
          (item) => isRecord(item) && item.id === attachmentId,
        );
        if (isRecord(attachment) && typeof attachment.download_url === "string") {
          return NextResponse.redirect(attachment.download_url);
        }
      }
      
      return new NextResponse("Attachment has expired or was not found on the server.", { status: 404 });
    }

    // If Resend returns a download_url, redirect to it
    if (typeof data.download_url === "string") {
      return NextResponse.redirect(data.download_url);
    }

    // The SDK's current response type only includes signed URLs; keep support for direct content if the API adds it.
    const payload: unknown = data;
    if (isRecord(payload) && typeof payload.content === "string") {
      const buffer = Buffer.from(payload.content, "base64");
      return new NextResponse(buffer, {
        headers: {
          "Content-Type": typeof payload.content_type === "string" ? payload.content_type : "application/octet-stream",
          "Content-Disposition": `attachment; filename="${typeof payload.filename === "string" ? payload.filename : "attachment"}"`,
        },
      });
    }

    return NextResponse.json(data);
  } catch (err) {
    console.error("Error fetching attachment:", err);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
