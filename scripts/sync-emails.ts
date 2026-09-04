import { syncSentEmails, syncReceivedEmails } from "../src/lib/syncEmails";

async function main() {
  console.log("Starting manual Resend email sync...");

  try {
    // 1. Sync sent emails
    await syncSentEmails();

    // 2. Sync received emails
    await syncReceivedEmails();

    console.log("Email sync complete.");
    process.exit(0);
  } catch (error) {
    console.error("Email sync failed:", error);
    process.exit(1);
  }
}

main();
