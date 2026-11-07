import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ remove: vi.fn(), upsert: vi.fn(), where: vi.fn() }));
vi.mock("@/lib/queue", () => ({ automationQueue: { removeJobScheduler: mocks.remove, upsertJobScheduler: mocks.upsert } }));
vi.mock("@/src", () => ({ db: { update: () => ({ set: () => ({ where: mocks.where }) }) } }));
vi.mock("@/src/db/schema", () => ({ automations: { id: {} } }));
vi.mock("drizzle-orm", () => ({ eq: vi.fn((...args) => args) }));
import { restoreAutomationSchedules, syncAutomationSchedule } from "@/lib/automation-schedules";

describe("automation schedules", () => {
  beforeEach(() => vi.clearAllMocks());
  it.each([
    ["hourly", { every: 3_600_000 }],
    ["daily", { pattern: "0 9 * * *" }],
    ["weekly", { pattern: "0 9 * * 1" }],
    ["custom", { pattern: "15 8 * * 2" }],
  ])("registers %s schedules", async (interval, repeat) => {
    await syncAutomationSchedule("a1", true, [{ id: "t1", title: "Schedule", type: "trigger_schedule", config: { interval, cron: "15 8 * * 2" } }]);
    expect(mocks.upsert).toHaveBeenCalledWith("automation:a1", repeat, expect.objectContaining({ name: "execute-automation" }));
  });
  it("removes schedules when disabled and rejects an empty custom cron", async () => {
    await syncAutomationSchedule("a1", false, [{ id: "t1", title: "Schedule", type: "trigger_schedule", config: {} }]);
    await expect(syncAutomationSchedule("a1", true, [{ id: "t1", title: "Schedule", type: "trigger_schedule", config: { interval: "custom" } }]))
      .rejects.toThrow("Custom schedule requires a cron expression");
    expect(mocks.remove).toHaveBeenCalledTimes(2);
    expect(mocks.upsert).not.toHaveBeenCalled();
  });
  it("restores valid schedules even when one saved schedule is invalid", async () => {
    mocks.upsert.mockRejectedValueOnce(new Error("bad cron"));
    const result = await restoreAutomationSchedules([
      { id: "bad", enabled: true, nodes: [{ id: "t1", title: "Schedule", type: "trigger_schedule", config: { interval: "custom", cron: "bad" } }] },
      { id: "good", enabled: true, nodes: [{ id: "t2", title: "Schedule", type: "trigger_schedule", config: { interval: "hourly" } }] },
    ]);
    expect(result[0]).toMatchObject({ id: "bad" });
    expect(result[1]).toBeNull();
    expect(mocks.upsert).toHaveBeenCalledTimes(2);
  });
});
