import { NextResponse } from "next/server";
import { syncSentEmails, syncReceivedEmails } from "@/src/lib/syncEmails";

export async function POST() {
  try {
    // Run both sync functions
    await syncSentEmails();
    await syncReceivedEmails();
    
    return NextResponse.json({ success: true, message: "Emails synced successfully" });
  } catch (error) {
    console.error("Error syncing emails:", error);
    return NextResponse.json(
      { success: false, message: "Failed to sync emails" },
      { status: 500 }
    );
  }
}
