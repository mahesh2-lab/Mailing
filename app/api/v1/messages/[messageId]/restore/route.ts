import { db } from "@/src";
import { emails } from "@/src/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getAuthSession } from "@/src/lib/require-auth";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ messageId: string }> | { messageId: string } }
) {
  const session = await getAuthSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { messageId } = await Promise.resolve(params);

  try {
    let targetFolder = "inbox";
    try {
      const body = await request.json();
      if (body?.folder && typeof body.folder === "string") {
        targetFolder = body.folder.toLowerCase();
      }
    } catch {
      // Body not present or invalid JSON, default to inbox
    }

    const email = await db
      .select()
      .from(emails)
      .where(eq(emails.id, messageId));

    if (!email || email.length === 0) {
      return NextResponse.json({ error: "Email not found" }, { status: 404 });
    }

    await db
      .update(emails)
      .set({ folder: targetFolder })
      .where(eq(emails.id, messageId));

    return NextResponse.json({ id: messageId, folder: targetFolder });
  } catch (error) {
    console.error("Failed to restore message:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
