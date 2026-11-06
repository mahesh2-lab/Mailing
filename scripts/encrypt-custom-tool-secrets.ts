import "dotenv/config";
import { and, eq } from "drizzle-orm";
import { db } from "../src/index";
import { customTools } from "../src/db/schema";
import { encrypt } from "../src/lib/crypto";

async function main() {
  try {
    const rows = await db.select({
      id: customTools.id,
      userId: customTools.userId,
      authValue: customTools.authValue,
      headers: customTools.headers,
    })
      .from(customTools);
    for (const row of rows) {
      const authValue = row.authValue && !row.authValue.startsWith("enc:v1:")
        ? `enc:v1:${await encrypt(row.authValue)}`
        : row.authValue;
      const headers = await Promise.all((row.headers || []).map(async ({ key, value }) =>
        /authorization|token|secret|api[-_]?key|password/i.test(key) && value && !value.startsWith("enc:v1:")
          ? { key, value: `enc:v1:${await encrypt(value)}` }
          : { key, value },
      ));
      if (authValue === row.authValue && headers.every((header, index) => header.value === row.headers?.[index]?.value)) continue;
      await db.update(customTools)
        .set({ authValue, headers })
        .where(and(eq(customTools.id, row.id), eq(customTools.userId, row.userId)));
    }
  } catch (error) {
    console.error("Failed to encrypt custom tool credentials:", error);
    process.exitCode = 1;
  } finally {
    await db.$client.end();
  }
}

main();
