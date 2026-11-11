import { NextResponse } from "next/server";
import { db } from "@/src";
import { emails, customLabels } from "@/src/db/schema";
import { sql, ne, eq, and } from "drizzle-orm";
import { getAuthSession } from "@/src/lib/require-auth";
import { getErrorCode, getErrorMessage } from "@/src/lib/errors";
import { z } from "zod";
import { DEFAULT_LABEL_COLORS } from "@/lib/label-colors";

const DEFAULT_LABELS = ["Important", "Work", "Personal"];
const LabelInput = z.object({
  name: z.string().trim().min(1).max(50),
  color: z.string().regex(/^#[\da-f]{6}$/i).optional(),
});


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
      color: lbl.color || DEFAULT_LABEL_COLORS[lbl.name] || null,
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

    const parsed = LabelInput.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Provide a label name and valid hex color" }, { status: 400 });
    const { name: trimmed, color } = parsed.data;

    const newLabel = {
      id: `lbl_${crypto.randomUUID()}`,
      name: trimmed,
      userId: session.user.id,
      color: color || null,
      createdAt: new Date().toISOString(),
    };

    await db.insert(customLabels).values(newLabel);

    return NextResponse.json({ ...newLabel, count: 0 }, { status: 201 });
  } catch (error: unknown) {
    if (
      getErrorMessage(error, "").includes("UNIQUE constraint failed") ||
      getErrorCode(error) === "SQLITE_CONSTRAINT" ||
      getErrorCode(error) === "23505"
    ) {
      return NextResponse.json({ error: "Label already exists" }, { status: 409 });
    }
    console.error("Failed to create label:", error);
    return NextResponse.json({ error: "Failed to create label" }, { status: 500 });
  }
}
