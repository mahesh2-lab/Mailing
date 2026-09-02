import { NextResponse } from "next/server";
import { db } from "@/src";
import { emails, customLabels } from "@/src/db/schema";
import { eq, sql } from "drizzle-orm";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ label: string }> | { label: string } }
) {
  try {
    const { label } = await Promise.resolve(params);
    const decodedLabel = decodeURIComponent(label);

    // Delete label from customLabels
    await db.delete(customLabels).where(eq(customLabels.name, decodedLabel));

    // Also remove the label from all emails that currently have it
    const affectedEmails = await db
      .select({ id: emails.id, labels: emails.labels })
      .from(emails)
      .where(sql`${emails.labels}::text LIKE ${"%" + decodedLabel + "%"}`);

    for (const em of affectedEmails) {
      if (Array.isArray(em.labels) && em.labels.includes(decodedLabel)) {
        const updatedLabels = em.labels.filter((l) => l !== decodedLabel);
        await db
          .update(emails)
          .set({ labels: updatedLabels })
          .where(eq(emails.id, em.id));
      }
    }

    return NextResponse.json({ success: true, deletedLabel: decodedLabel });
  } catch (error) {
    console.error("Failed to delete label:", error);
    return NextResponse.json({ error: "Failed to delete label" }, { status: 500 });
  }
}
