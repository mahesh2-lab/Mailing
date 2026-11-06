import { NextResponse } from "next/server";
import { syncSentEmails, syncReceivedEmails } from "@/src/lib/syncEmails";
import { getAuthSession } from "@/src/lib/require-auth";
import { claimRateLimit } from "@/lib/rate-limit";

export async function POST() {
  try {
    const session = await getAuthSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const userId = session.user.id;
    const waitTime = await claimRateLimit(`email-sync:${userId}`, 60);

    if (waitTime > 0) {
      return NextResponse.json(
        { success: false, message: `Please wait ${waitTime} seconds before syncing again.` },
        { status: 429 }
      );
    }
    
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
