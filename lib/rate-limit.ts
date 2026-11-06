import IORedis from "ioredis";

const redis = new IORedis(process.env.REDIS_URL || "redis://localhost:6379", {
  maxRetriesPerRequest: null,
});

export async function claimRateLimit(key: string, seconds: number) {
  const claimed = await redis.set(key, "1", "EX", seconds, "NX");
  return claimed === "OK" ? 0 : await redis.ttl(key);
}
