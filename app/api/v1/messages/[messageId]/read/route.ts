import { NextResponse } from "next/server";
import { db } from "@/src";
import { emails } from "@/src/db/schema";
import { and, eq } from "drizzle-orm";
import { getAuthSession } from "@/src/lib/require-auth";
import { pusherServer } from "@/src/lib/pusher";
import { emailChannelForUser } from "@/lib/realtime-channels";

async function handleReadUpdate(
  request: Request,
  messageId: string,
) {
  const session = await getAuthSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const email = await db
      .select({ id: emails.id })
      .from(emails)
      .where(and(eq(emails.id, messageId), eq(emails.userId, session.user.id)))
      .limit(1);

    if (!email || email.length === 0) {
      return NextResponse.json({ error: "Email not found" }, { status: 404 });
    }

    let unread = false;
    try {
      const body = await request.json();
      if (typeof body.unread === "boolean") {
        unread = body.unread;
      } else if (typeof body.read === "boolean") {
        unread = !body.read;
      }
    } catch {
      // No or empty body; defaults to unread = false (marked as read)
    }

    await db
      .update(emails)
      .set({
        unread,
        status: unread ? "received" : "read",
      })
      .where(and(eq(emails.id, messageId), eq(emails.userId, session.user.id)));

    try {
      await pusherServer.trigger(
        emailChannelForUser(session.user.id),
        unread ? "unread" : "read",
        { emailId: messageId },
      );
    } catch (pusherErr) {
      console.warn("[read-route] Pusher trigger failed:", pusherErr);
    }

    return NextResponse.json({ id: messageId, unread, read: !unread });
  } catch (error) {
    console.error("Failed to update message read state:", error);
    return NextResponse.json({ error: "Error updating message" }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ messageId: string }> },
) {
  const { messageId } = await params;
  return handleReadUpdate(request, messageId);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ messageId: string }> },
) {
  const { messageId } = await params;
  return handleReadUpdate(request, messageId);
}
