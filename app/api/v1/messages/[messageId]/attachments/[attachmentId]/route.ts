import { NextResponse } from "next/server";
import { getResendClient } from "@/lib/resend";
import { auth } from "@/src/lib/auth";
import { headers } from "next/headers";
import { db } from "@/src";
import { emails } from "@/src/db/schema";
import { eq } from "drizzle-orm";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ messageId: string; attachmentId: string }> | { messageId: string; attachmentId: string } }
) {
  const { messageId, attachmentId } = await Promise.resolve(params);
  
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
    const { data, error } = await resend.emails.receiving.attachments.get({
      emailId: messageId,
      id: attachmentId,
    });

    if (error || !data) {
      console.error("Failed to fetch attachment from Resend:", error);
      
      // Fallback: Check if we have the attachment URL in the database
      const [emailRecord] = await db
        .select({ attachments: emails.attachments })
        .from(emails)
        .where(eq(emails.id, messageId));
        
      if (emailRecord && Array.isArray(emailRecord.attachments)) {
        const att = emailRecord.attachments.find((a: any) => a.id === attachmentId) as any;
        if (att && att.download_url) {
          return NextResponse.redirect(att.download_url);
        }
      }
      
      return new NextResponse("Attachment has expired or was not found on the server.", { status: 404 });
    }

    // If Resend returns a download_url, redirect to it
    if ((data as any).download_url) {
      return NextResponse.redirect((data as any).download_url);
    }
    
    // If Resend returns content directly (e.g. as buffer or base64)
    if ((data as any).content) {
      const buffer = Buffer.from((data as any).content, "base64");
      return new NextResponse(buffer, {
        headers: {
          "Content-Type": (data as any).content_type || "application/octet-stream",
          "Content-Disposition": `attachment; filename="${(data as any).filename || "attachment"}"`,
        },
      });
    }

    return NextResponse.json(data);
  } catch (err) {
    console.error("Error fetching attachment:", err);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
