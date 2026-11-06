import "dotenv/config";
import { db } from "../src/index.js";
import { sql } from "drizzle-orm";

async function resetDb() {
  if (!process.argv.includes("--confirm-reset") || process.env.ALLOW_DESTRUCTIVE_DB_RESET !== "true") {
    console.error("Refusing to reset. Set ALLOW_DESTRUCTIVE_DB_RESET=true and pass --confirm-reset.");
    process.exitCode = 1;
    await db.$client.end();
    return;
  }

  console.log("Starting confirmed database reset...");
  try {
    await db.execute(sql`
      TRUNCATE TABLE 
        "user", "session", "account", "verification",
        "emails", "webhook_events", "custom_labels", "user_api_keys",
        "automations", "automation_runs", "custom_tools", "user_settings"
      RESTART IDENTITY CASCADE;
    `);
    console.log("Database successfully reset.");
  } catch (error) {
    console.error("Error resetting database:", error);
    process.exitCode = 1;
  } finally {
    await db.$client.end();
  }
}

resetDb();
