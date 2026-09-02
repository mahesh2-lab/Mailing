import { NextResponse } from "next/server";
import { db } from "@/src";
import { emails } from "@/src/db/schema";
import { eq } from "drizzle-orm";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ messageId: string }> | { messageId: string } }
) {
  try {
    const { messageId } = await Promise.resolve(params);
    const { label } = await request.json();
    const trimmedLabel = (label || "").trim();

    if (!trimmedLabel) {
      return NextResponse.json({ error: "Label name is required" }, { status: 400 });
    }

    const [email] = await db
      .select({ id: emails.id, labels: emails.labels })
      .from(emails)
      .where(eq(emails.id, messageId))
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
        .where(eq(emails.id, messageId));
    }

    return NextResponse.json({ id: messageId, labels: currentLabels });
  } catch (error) {
    console.error("Failed to add label to message:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ messageId: string }> | { messageId: string } }
) {
  try {
    const { messageId } = await Promise.resolve(params);
    const { searchParams } = new URL(request.url);
    const labelToDelete = searchParams.get("label");

    if (!labelToDelete) {
      return NextResponse.json({ error: "Label parameter is required" }, { status: 400 });
    }

    const [email] = await db
      .select({ id: emails.id, labels: emails.labels })
      .from(emails)
      .where(eq(emails.id, messageId))
      .limit(1);

    if (!email) {
      return NextResponse.json({ error: "Email not found" }, { status: 404 });
    }

    const currentLabels: string[] = Array.isArray(email.labels) ? email.labels : [];
    const updatedLabels = currentLabels.filter((l) => l !== labelToDelete);

    await db
      .update(emails)
      .set({ labels: updatedLabels })
      .where(eq(emails.id, messageId));

    return NextResponse.json({ id: messageId, labels: updatedLabels });
  } catch (error) {
    console.error("Failed to remove label from message:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
