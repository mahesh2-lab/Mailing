import { NextResponse } from "next/server";
import { emails } from "@/src/db/schema";
import { db } from "@/src";
import { and, eq } from "drizzle-orm";
import { getAuthSession } from "@/src/lib/require-auth";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ messageId: string }> },
) {
  const session = await getAuthSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { messageId } = await params;

  try {
    const message = await db
      .select()
      .from(emails)
      .where(and(eq(emails.id, messageId), eq(emails.userId, session.user.id)));

    if (!message || message.length === 0) {
      return NextResponse.json({ error: "Message not found" }, { status: 404 });
    }
    return NextResponse.json(message[0]);
  } catch (error) {
    console.error("Failed to fetch single message:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ messageId: string }> },
) {
  const session = await getAuthSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { messageId } = await params;

  try {
    await db.delete(emails).where(and(eq(emails.id, messageId), eq(emails.userId, session.user.id)));
    return NextResponse.json({ success: true, deletedId: messageId });
  } catch (error) {
    console.error("Failed to permanently delete message:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
