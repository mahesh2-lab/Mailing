import { sql } from "drizzle-orm";
import IORedis from "ioredis";
import { db } from "@/src";
import { pusherServer } from "@/src/lib/pusher";

const CHECK_TIMEOUT_MS = 3000;

export type DependencyStatus = {
  name: string;
  status: "ok" | "error" | "not_configured";
  latencyMs?: number;
};

async function check(name: string, run: () => Promise<unknown>): Promise<DependencyStatus> {
  const startedAt = Date.now();
  let timeout: ReturnType<typeof setTimeout> | undefined;

  try {
    await Promise.race([
      run(),
      new Promise((_, reject) => {
        timeout = setTimeout(() => reject(new Error("timeout")), CHECK_TIMEOUT_MS);
      }),
    ]);
    return { name, status: "ok", latencyMs: Date.now() - startedAt };
  } catch {
    return { name, status: "error", latencyMs: Date.now() - startedAt };
  } finally {
    clearTimeout(timeout);
  }
}

export async function checkDependencyHealth(): Promise<DependencyStatus[]> {
  return Promise.all([
    process.env.DATABASE_URL
      ? check("database", () => db.execute(sql`SELECT 1`))
      : Promise.resolve({ name: "database", status: "not_configured" as const }),
    process.env.REDIS_URL
      ? check("redis", async () => {
          const redis = new IORedis(process.env.REDIS_URL!, {
            lazyConnect: true,
            connectTimeout: CHECK_TIMEOUT_MS,
            commandTimeout: CHECK_TIMEOUT_MS,
            maxRetriesPerRequest: 1,
            retryStrategy: () => null,
          });
          try {
            await redis.connect();
            await redis.ping();
          } finally {
            redis.disconnect();
          }
        })
      : Promise.resolve({ name: "redis", status: "not_configured" as const }),
    process.env.PUSHER_APP_ID &&
    process.env.PUSHER_SECRET &&
    (process.env.PUSHER_KEY || process.env.NEXT_PUBLIC_PUSHER_KEY) &&
    (process.env.PUSHER_CLUSTER || process.env.NEXT_PUBLIC_PUSHER_CLUSTER)
      ? check("pusher", async () => {
          const response = await pusherServer.get({ path: "/channels" });
          if (!response.ok) throw new Error("Pusher check failed");
        })
      : Promise.resolve({ name: "pusher", status: "not_configured" as const }),
  ]);
}
