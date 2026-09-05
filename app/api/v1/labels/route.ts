import { NextResponse } from "next/server";
import { db } from "@/src";
import { emails, customLabels } from "@/src/db/schema";
import { sql, ne, eq, and } from "drizzle-orm";
import { getAuthSession } from "@/src/lib/require-auth";

const DEFAULT_LABELS = ["Important", "Work", "Personal"];


async function ensureLabelsInitialized(userId: string) {
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS custom_labels (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        color TEXT,
        created_at TIMESTAMP NOT NULL
      )
    `);

    const existing = await db.select().from(customLabels).where(eq(customLabels.userId, userId));
    if (existing.length === 0) {
      for (const name of DEFAULT_LABELS) {
        await db
          .insert(customLabels)
          .values({
            id: `lbl_${crypto.randomUUID()}`,
            name,
            userId,
            createdAt: new Date().toISOString(),
          })
          .onConflictDoNothing();
      }
    }
  } catch (err) {
    console.error("Failed to initialize custom_labels table:", err);
  }
}

export async function GET() {
  try {
    const session = await getAuthSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    await ensureLabelsInitialized(session.user.id);

    const allLabels = await db.select().from(customLabels).where(eq(customLabels.userId, session.user.id));
    const allEmails = await db
      .select({ id: emails.id, labels: emails.labels, folder: emails.folder })
      .from(emails)
      .where(and(ne(emails.folder, "trash"), eq(emails.userId, session.user.id)));

    // Compute live count for each label
    const labelCounts: Record<string, number> = {};
    for (const em of allEmails) {
      if (Array.isArray(em.labels)) {
        for (const lbl of em.labels) {
          labelCounts[lbl] = (labelCounts[lbl] || 0) + 1;
        }
      }
    }

    const result = allLabels.map((lbl) => ({
      id: lbl.id,
      name: lbl.name,
      color: lbl.color,
      count: labelCounts[lbl.name] || 0,
      createdAt: lbl.createdAt,
    }));

    return NextResponse.json(result);
  } catch (error) {
    console.error("Failed to fetch labels:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getAuthSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    await ensureLabelsInitialized(session.user.id);

    const { name, color } = await request.json();
    const trimmed = (name || "").trim();

    if (!trimmed) {
      return NextResponse.json({ error: "Label name is required" }, { status: 400 });
    }

    if (trimmed.length > 50) {
      return NextResponse.json({ error: "Label name is too long" }, { status: 400 });
    }

    const newLabel = {
      id: `lbl_${crypto.randomUUID()}`,
      name: trimmed,
      userId: session.user.id,
      color: color || null,
      createdAt: new Date().toISOString(),
    };

    await db.insert(customLabels).values(newLabel);

    return NextResponse.json({ ...newLabel, count: 0 }, { status: 201 });
  } catch (error: any) {
    if (
      error?.message?.includes("UNIQUE constraint failed") ||
      error?.code === "SQLITE_CONSTRAINT" ||
      error?.code === "23505"
    ) {
      return NextResponse.json({ error: "Label already exists" }, { status: 409 });
    }
    console.error("Failed to create label:", error);
    return NextResponse.json({ error: "Failed to create label" }, { status: 500 });
  }
}
