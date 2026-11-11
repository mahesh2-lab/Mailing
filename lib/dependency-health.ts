import { sql } from "drizzle-orm";
import IORedis from "ioredis";
import { db } from "@/src";
import { pusherServer } from "@/src/lib/pusher";

const DEFAULT_TIMEOUT_MS = 5000;
const DEFAULT_RETRIES = 0;
const DEFAULT_RETRY_DELAY_MS = 1000;
const DEFAULT_BACKOFF_FACTOR = 1.5;

export type DependencyStatus = {
  name: string;
  status: "ok" | "error" | "not_configured";
  latencyMs?: number;
  error?: string;
  retries?: number;
};

export type CheckHealthOptions = {
  retries?: number;
  retryDelayMs?: number;
  timeoutMs?: number;
  backoffFactor?: number;
  onRetry?: (service: string, attempt: number, maxRetries: number, error: unknown) => void;
};

async function check(
  name: string,
  run: (attempt: number) => Promise<unknown>,
  options?: CheckHealthOptions,
): Promise<DependencyStatus> {
  const retries = options?.retries ?? DEFAULT_RETRIES;
  const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const baseDelay = options?.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS;
  const backoffFactor = options?.backoffFactor ?? DEFAULT_BACKOFF_FACTOR;

  let lastError: unknown;
  const overallStart = Date.now();

  for (let attempt = 0; attempt <= retries; attempt++) {
    let timeoutHandle: ReturnType<typeof setTimeout> | undefined;

    try {
      await Promise.race([
        run(attempt),
        new Promise((_, reject) => {
          timeoutHandle = setTimeout(
            () => reject(new Error(`Timeout after ${timeoutMs}ms`)),
            timeoutMs,
          );
        }),
      ]);

      return {
        name,
        status: "ok",
        latencyMs: Date.now() - overallStart,
        ...(attempt > 0 ? { retries: attempt } : {}),
      };
    } catch (err) {
      lastError = err;
      if (attempt < retries) {
        const delay = Math.round(baseDelay * Math.pow(backoffFactor, attempt));
        if (options?.onRetry) {
          try {
            options.onRetry(name, attempt + 1, retries, err);
          } catch {
            // ignore callback errors
          }
        }
        await new Promise((res) => setTimeout(res, delay));
      }
    } finally {
      clearTimeout(timeoutHandle);
    }
  }

  return {
    name,
    status: "error",
    latencyMs: Date.now() - overallStart,
    error: lastError instanceof Error ? lastError.message : String(lastError),
    ...(retries > 0 ? { retries } : {}),
  };
}

export async function checkDependencyHealth(
  options?: CheckHealthOptions,
): Promise<DependencyStatus[]> {
  const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  return Promise.all([
    process.env.DATABASE_URL
      ? check("database", () => db.execute(sql`SELECT 1`), options)
      : Promise.resolve({ name: "database", status: "not_configured" as const }),
    process.env.REDIS_URL
      ? check(
          "redis",
          async () => {
            const redis = new IORedis(process.env.REDIS_URL!, {
              lazyConnect: true,
              connectTimeout: timeoutMs,
              commandTimeout: timeoutMs,
              maxRetriesPerRequest: 1,
              retryStrategy: () => null,
              enableReadyCheck: false,
            });
            try {
              await redis.connect();
              await redis.ping();
            } finally {
              try {
                redis.disconnect();
              } catch {
                // ignore cleanup errors
              }
            }
          },
          options,
        )
      : Promise.resolve({ name: "redis", status: "not_configured" as const }),
    process.env.PUSHER_APP_ID &&
    process.env.PUSHER_SECRET &&
    (process.env.PUSHER_KEY || process.env.NEXT_PUBLIC_PUSHER_KEY) &&
    (process.env.PUSHER_CLUSTER || process.env.NEXT_PUBLIC_PUSHER_CLUSTER)
      ? check(
          "pusher",
          async () => {
            const response = await pusherServer.get({ path: "/channels" });
            if (!response.ok) {
              throw new Error(`Pusher check failed: ${response.statusText || response.status}`);
            }
          },
          options,
        )
      : Promise.resolve({ name: "pusher", status: "not_configured" as const }),
  ]);
}
