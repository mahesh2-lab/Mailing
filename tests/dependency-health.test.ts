import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// We will test checkDependencyHealth with mocked dependencies
describe("dependency-health", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  it("reports not_configured when env vars are missing", async () => {
    process.env.DATABASE_URL = "";
    process.env.REDIS_URL = "";
    process.env.PUSHER_APP_ID = "";
    process.env.PUSHER_SECRET = "";
    process.env.PUSHER_KEY = "";
    process.env.PUSHER_CLUSTER = "";
    process.env.NEXT_PUBLIC_PUSHER_KEY = "";
    process.env.NEXT_PUBLIC_PUSHER_CLUSTER = "";

    const { checkDependencyHealth } = await import("@/lib/dependency-health");
    const results = await checkDependencyHealth();

    expect(results).toEqual([
      { name: "database", status: "not_configured" },
      { name: "redis", status: "not_configured" },
      { name: "pusher", status: "not_configured" },
    ]);
  });

  it("handles transient failure with retries for redis", async () => {
    process.env.REDIS_URL = "redis://localhost:6379";
    delete process.env.DATABASE_URL;
    delete process.env.PUSHER_APP_ID;

    let callCount = 0;
    const mockConnect = vi.fn().mockImplementation(async () => {
      callCount++;
      if (callCount < 3) {
        throw new Error("Connection refused (cold start)");
      }
      return undefined;
    });
    const mockPing = vi.fn().mockResolvedValue("PONG");
    const mockDisconnect = vi.fn();

    vi.doMock("ioredis", () => {
      return {
        default: class MockIORedis {
          connect = mockConnect;
          ping = mockPing;
          disconnect = mockDisconnect;
        },
      };
    });

    const retriedAttempts: number[] = [];
    const { checkDependencyHealth } = await import("@/lib/dependency-health");
    const results = await checkDependencyHealth({
      retries: 3,
      retryDelayMs: 10,
      timeoutMs: 1000,
      backoffFactor: 1,
      onRetry: (_service, attempt) => {
        retriedAttempts.push(attempt);
      },
    });

    const redisResult = results.find((r) => r.name === "redis");
    expect(redisResult?.status).toBe("ok");
    expect(redisResult?.retries).toBe(2);
    expect(retriedAttempts).toEqual([1, 2]);
    expect(callCount).toBe(3);
  });

  it("returns error with error details when retries are exhausted", async () => {
    process.env.REDIS_URL = "redis://localhost:6379";
    delete process.env.DATABASE_URL;
    delete process.env.PUSHER_APP_ID;

    const mockConnect = vi.fn().mockRejectedValue(new Error("WRONGPASS invalid password"));
    const mockDisconnect = vi.fn();

    vi.doMock("ioredis", () => {
      return {
        default: class MockIORedis {
          connect = mockConnect;
          ping = vi.fn();
          disconnect = mockDisconnect;
        },
      };
    });

    const { checkDependencyHealth } = await import("@/lib/dependency-health");
    const results = await checkDependencyHealth({
      retries: 2,
      retryDelayMs: 10,
      timeoutMs: 1000,
      backoffFactor: 1,
    });

    const redisResult = results.find((r) => r.name === "redis");
    expect(redisResult?.status).toBe("error");
    expect(redisResult?.error).toBe("WRONGPASS invalid password");
    expect(redisResult?.retries).toBe(2);
    expect(mockConnect).toHaveBeenCalledTimes(3); // 1 initial + 2 retries
  });
});
