import { syncSentEmails, syncReceivedEmails } from "../src/lib/syncEmails";

import { db } from "@/src";
import { user } from "@/src/db/auth-schema";

async function main() {
  console.log("Starting manual Resend email sync for all users...");

  try {
    const allUsers = await db.select().from(user);
    console.log(`Found ${allUsers.length} users to sync.`);
    
    for (const user of allUsers) {
      console.log(`Syncing for user ${user.id}...`);
      // 1. Sync sent emails
      await syncSentEmails(user.id);
      
      // 2. Sync received emails
      await syncReceivedEmails(user.id);
    }

    console.log("Email sync complete.");
    process.exit(0);
  } catch (error) {
    console.error("Email sync failed:", error);
    process.exit(1);
  }
}

main();
