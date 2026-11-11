import { NextResponse } from "next/server";
import { db } from "@/src";
import { emails, customLabels } from "@/src/db/schema";
import { and, eq, sql } from "drizzle-orm";
import { getAuthSession } from "@/src/lib/require-auth";
import { z } from "zod";

const ColorInput = z.object({ color: z.string().regex(/^#[\da-f]{6}$/i) });

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ label: string }> }
) {
  try {
    const session = await getAuthSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { label } = await params;
    const parsed = ColorInput.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Invalid label color" }, { status: 400 });

    const [updated] = await db.update(customLabels)
      .set({ color: parsed.data.color })
      .where(and(eq(customLabels.name, decodeURIComponent(label)), eq(customLabels.userId, session.user.id)))
      .returning({ name: customLabels.name, color: customLabels.color });
    if (!updated) return NextResponse.json({ error: "Label not found" }, { status: 404 });
    return NextResponse.json(updated);
  } catch (error) {
    console.error("Failed to update label color:", error);
    return NextResponse.json({ error: "Failed to update label color" }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ label: string }> }
) {
  try {
    const session = await getAuthSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { label } = await params;
    const decodedLabel = decodeURIComponent(label);

    
    await db.delete(customLabels).where(and(
      eq(customLabels.name, decodedLabel),
      eq(customLabels.userId, session.user.id),
    ));

    
    const affectedEmails = await db
      .select({ id: emails.id, labels: emails.labels })
      .from(emails)
      .where(and(
        eq(emails.userId, session.user.id),
        sql`${emails.labels}::text LIKE ${"%" + decodedLabel + "%"}`,
      ));

    for (const em of affectedEmails) {
      if (Array.isArray(em.labels) && em.labels.includes(decodedLabel)) {
        const updatedLabels = em.labels.filter((l) => l !== decodedLabel);
        await db
          .update(emails)
          .set({ labels: updatedLabels })
          .where(and(eq(emails.id, em.id), eq(emails.userId, session.user.id)));
      }
    }

    return NextResponse.json({ success: true, deletedLabel: decodedLabel });
  } catch (error) {
    console.error("Failed to delete label:", error);
    return NextResponse.json({ error: "Failed to delete label" }, { status: 500 });
  }
}
