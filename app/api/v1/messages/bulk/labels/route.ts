import { NextResponse } from "next/server";
import { db } from "@/src";
import { emails } from "@/src/db/schema";
import { inArray } from "drizzle-orm";
import { getAuthSession } from "@/src/lib/require-auth";

export async function POST(request: Request) {
  try {
    const session = await getAuthSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { messageIds, label, action } = await request.json();

    if (!Array.isArray(messageIds) || messageIds.length === 0 || !label) {
      return NextResponse.json({ error: "Invalid parameters" }, { status: 400 });
    }

    const trimmedLabel = label.trim();
    const rows = await db
      .select({ id: emails.id, labels: emails.labels })
      .from(emails)
      .where(inArray(emails.id, messageIds));

    for (const row of rows) {
      let current: string[] = Array.isArray(row.labels) ? [...row.labels] : [];
      if (action === "add") {
        if (!current.includes(trimmedLabel)) {
          current.push(trimmedLabel);
          await db
            .update(emails)
            .set({ labels: current })
            .where(inArray(emails.id, [row.id]));
        }
      } else if (action === "remove") {
        if (current.includes(trimmedLabel)) {
          current = current.filter((l) => l !== trimmedLabel);
          await db
            .update(emails)
            .set({ labels: current })
            .where(inArray(emails.id, [row.id]));
        }
      }
    }

    return NextResponse.json({ success: true, updatedCount: rows.length });
  } catch (error) {
    console.error("Failed to perform bulk label action:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
