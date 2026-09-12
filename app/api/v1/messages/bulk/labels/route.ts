import { NextResponse } from "next/server";
import { db } from "@/src";
import { emails } from "@/src/db/schema";
import { and, eq, inArray } from "drizzle-orm";
import { getAuthSession } from "@/src/lib/require-auth";

export async function POST(request: Request) {
  try {
    const session = await getAuthSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const rawIds = body.messageIds || body.ids;
    const label = body.label;
    const action = body.action || "add";

    if (!Array.isArray(rawIds) || rawIds.length === 0 || !label || typeof label !== "string") {
      return NextResponse.json({ error: "Invalid parameters" }, { status: 400 });
    }

    const trimmedLabel = label.trim();
    if (!trimmedLabel) {
      return NextResponse.json({ error: "Label cannot be empty" }, { status: 400 });
    }

    const rows = await db
      .select({ id: emails.id, labels: emails.labels })
      .from(emails)
      .where(and(inArray(emails.id, rawIds), eq(emails.userId, session.user.id)));

    for (const row of rows) {
      let current: string[] = Array.isArray(row.labels) ? [...row.labels] : [];
      if (action === "add") {
        if (!current.includes(trimmedLabel)) {
          current.push(trimmedLabel);
          await db
            .update(emails)
            .set({ labels: current })
            .where(and(eq(emails.id, row.id), eq(emails.userId, session.user.id)));
        }
      } else if (action === "remove") {
        if (current.includes(trimmedLabel)) {
          current = current.filter((l) => l !== trimmedLabel);
          await db
            .update(emails)
            .set({ labels: current })
            .where(and(eq(emails.id, row.id), eq(emails.userId, session.user.id)));
        }
      }
    }

    return NextResponse.json({ success: true, updatedCount: rows.length });
  } catch (error) {
    console.error("Failed to perform bulk label action:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
