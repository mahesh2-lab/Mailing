import "dotenv/config";
import { db } from "../src/index.js";
import { sql } from "drizzle-orm";

async function resetDb() {
  console.log("Starting database reset...");
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
  } finally {
    process.exit(0);
  }
}

resetDb();
