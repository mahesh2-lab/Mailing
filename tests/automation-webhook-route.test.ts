import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ findFirst: vi.fn(), add: vi.fn() }));
vi.mock("@/src", () => ({ db: { query: { automations: { findFirst: mocks.findFirst } } } }));
vi.mock("@/src/db/schema", () => ({ automations: { enabled: {}, webhookTokenHash: {}, nodes: {}, id: {} } }));
vi.mock("drizzle-orm", () => ({ and: vi.fn((...args) => args), eq: vi.fn((...args) => args) }));
vi.mock("@/lib/queue", () => ({ automationQueue: { add: mocks.add } }));
import { POST } from "@/app/api/automation-webhooks/[token]/route";

describe("automation webhook endpoint", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findFirst.mockResolvedValue({ id: "auto-1", nodes: [{ type: "trigger_webhook" }] });
    mocks.add.mockResolvedValue({ id: "job-1" });
  });
  it("queues a webhook payload for a matching URL secret", async () => {
    const response = await POST(new Request("https://example.com", { method: "POST", body: '{"event":"created"}' }), { params: Promise.resolve({ token: "12345678901234567890123456789012" }) });
    expect(response.status).toBe(202);
    expect(mocks.add).toHaveBeenCalledWith("execute-automation", expect.objectContaining({
      automationId: "auto-1",
      triggerPayload: { triggerSource: "Inbound Automation Webhook", webhook: { event: "created" }, simulated: false },
    }));
  });
  it("does not queue requests with invalid tokens or malformed bodies", async () => {
    const invalid = await POST(new Request("https://example.com", { method: "POST", body: "{}" }), { params: Promise.resolve({ token: "bad" }) });
    const malformed = await POST(new Request("https://example.com", { method: "POST", body: "{" }), { params: Promise.resolve({ token: "12345678901234567890123456789012" }) });
    expect(invalid.status).toBe(404);
    expect(malformed.status).toBe(400);
    expect(mocks.add).not.toHaveBeenCalled();
  });
});
