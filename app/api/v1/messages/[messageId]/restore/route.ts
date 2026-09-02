import { db } from "@/src";
import { emails } from "@/src/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ messageId: string }> | { messageId: string } }
) {
  const { messageId } = await Promise.resolve(params);

  try {
    const email = await db
      .select()
      .from(emails)
      .where(eq(emails.id, messageId));

    if (!email || email.length === 0) {
      return NextResponse.json({ error: "Email not found" }, { status: 404 });
    }

    await db
      .update(emails)
      .set({ folder: "inbox" })
      .where(eq(emails.id, messageId));

    return NextResponse.json({ id: messageId, folder: "inbox" });
  } catch (error) {
    console.error("Failed to restore message to inbox:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
