import { NextResponse } from "next/server";
import { db } from "@/src";
import { emails } from "@/src/db/schema";
import { and, eq } from "drizzle-orm";
import { getAuthSession } from "@/src/lib/require-auth";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ messageId: string }> }
) {
  try {
    const session = await getAuthSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { messageId } = await params;
    const { label } = await request.json();
    const trimmedLabel = (label || "").trim();

    if (!trimmedLabel) {
      return NextResponse.json({ error: "Label name is required" }, { status: 400 });
    }

    const [email] = await db
      .select({ id: emails.id, labels: emails.labels })
      .from(emails)
      .where(and(eq(emails.id, messageId), eq(emails.userId, session.user.id)))
      .limit(1);

    if (!email) {
      return NextResponse.json({ error: "Email not found" }, { status: 404 });
    }

    const currentLabels: string[] = Array.isArray(email.labels) ? email.labels : [];
    if (!currentLabels.includes(trimmedLabel)) {
      currentLabels.push(trimmedLabel);
      await db
        .update(emails)
        .set({ labels: currentLabels })
        .where(and(eq(emails.id, messageId), eq(emails.userId, session.user.id)));
    }

    return NextResponse.json({ id: messageId, labels: currentLabels });
  } catch (error) {
    console.error("Failed to add label to message:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ messageId: string }> }
) {
  try {
    const session = await getAuthSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { messageId } = await params;
    const { searchParams } = new URL(request.url);
    const labelToDelete = searchParams.get("label");

    if (!labelToDelete) {
      return NextResponse.json({ error: "Label parameter is required" }, { status: 400 });
    }

    const [email] = await db
      .select({ id: emails.id, labels: emails.labels })
      .from(emails)
      .where(and(eq(emails.id, messageId), eq(emails.userId, session.user.id)))
      .limit(1);

    if (!email) {
      return NextResponse.json({ error: "Email not found" }, { status: 404 });
    }

    const currentLabels: string[] = Array.isArray(email.labels) ? email.labels : [];
    const updatedLabels = currentLabels.filter((l) => l !== labelToDelete);

    await db
      .update(emails)
      .set({ labels: updatedLabels })
        .where(and(eq(emails.id, messageId), eq(emails.userId, session.user.id)));

    return NextResponse.json({ id: messageId, labels: updatedLabels });
  } catch (error) {
    console.error("Failed to remove label from message:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
