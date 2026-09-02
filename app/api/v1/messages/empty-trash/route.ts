import { db } from "@/src";
import { emails } from "@/src/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function POST() {
  try {
    await db.delete(emails).where(eq(emails.folder, "trash"));
    return NextResponse.json({ success: true, message: "Trash emptied" });
  } catch (error) {
    console.error("Failed to empty trash:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
