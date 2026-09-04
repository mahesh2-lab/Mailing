import { NextResponse } from "next/server";
import { db } from "@/src";
import { automationRuns } from "@/src/db/schema";
import { eq, desc } from "drizzle-orm";
import { getAuthSession } from "@/src/lib/require-auth";

export async function GET(request: Request) {
  try {
    const session = await getAuthSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const automationId = searchParams.get("automationId");

    let runs;
    if (automationId) {
      runs = await db
        .select()
        .from(automationRuns)
        .where(eq(automationRuns.automationId, automationId))
        .orderBy(desc(automationRuns.startedAt))
        .limit(100);
    } else {
      runs = await db
        .select()
        .from(automationRuns)
        .orderBy(desc(automationRuns.startedAt))
        .limit(100);
    }

    return NextResponse.json({ data: runs });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
