import { db } from "@/src";
import { emails } from "@/src/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getAuthSession } from "@/src/lib/require-auth";

export async function POST() {
  try {
    const session = await getAuthSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    await db.delete(emails).where(eq(emails.folder, "trash"));
    return NextResponse.json({ success: true, message: "Trash emptied" });
  } catch (error) {
    console.error("Failed to empty trash:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
