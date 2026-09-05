import { NextResponse } from "next/server";
import { syncSentEmails, syncReceivedEmails } from "@/src/lib/syncEmails";
import { getAuthSession } from "@/src/lib/require-auth";

const syncRateLimits = new Map<string, number>();

export async function POST() {
  try {
    const session = await getAuthSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const userId = session.user.id;
    const now = Date.now();
    const lastSync = syncRateLimits.get(userId);

    if (lastSync && now - lastSync < 60 * 1000) {
      const waitTime = Math.ceil((60 * 1000 - (now - lastSync)) / 1000);
      return NextResponse.json(
        { success: false, message: `Please wait ${waitTime} seconds before syncing again.` },
        { status: 429 }
      );
    }
    
    syncRateLimits.set(userId, now);

    const sentStats = await syncSentEmails(userId);
    const receivedStats = await syncReceivedEmails(userId);
    
    return NextResponse.json({ 
      success: true, 
      message: "Emails synced successfully",
      stats: {
        sent: sentStats,
        received: receivedStats,
        totalNew: (sentStats?.new || 0) + (receivedStats?.new || 0)
      }
    });
  } catch (error) {
    console.error("Error syncing emails:", error);
    return NextResponse.json(
      { success: false, message: "Failed to sync emails" },
      { status: 500 }
    );
  }
}
