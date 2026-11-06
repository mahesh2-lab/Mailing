import { NextResponse } from "next/server";
import { db } from "@/src";
import { emails, customLabels } from "@/src/db/schema";
import { and, eq, sql } from "drizzle-orm";
import { getAuthSession } from "@/src/lib/require-auth";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ label: string }> | { label: string } }
) {
  try {
    const session = await getAuthSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { label } = await Promise.resolve(params);
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
