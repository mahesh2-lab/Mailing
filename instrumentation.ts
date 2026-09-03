export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    console.log("Starting Resend email sync...");

    try {
      const { syncSentEmails, syncReceivedEmails } =
        await import("./src/lib/syncEmails");

      // 1. Sync sent emails
      await syncSentEmails();

      // 2. Sync received emails
      await syncReceivedEmails();

      console.log("Email sync complete.");
    } catch (error) {
      console.error("Email sync failed:", error);
    }
  }
}
