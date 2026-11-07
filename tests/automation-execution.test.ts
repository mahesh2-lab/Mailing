import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findAutomation: vi.fn(),
  findEmail: vi.fn(),
  insertRun: vi.fn(),
  metricWhere: vi.fn(),
  updateWhere: vi.fn(),
  updateSet: vi.fn(),
  updateReturning: vi.fn(),
  requestSafeHttp: vi.fn(),
  queueAdd: vi.fn(),
  customTool: { id: "tool-1", userId: "owner-1", name: "CRM", method: "POST", url: "https://api.example.com", authType: "bearer", authValue: "plain-secret", headers: [], bodyTemplate: '{"subject":"{{email.subject}}"}' },
}));

vi.mock("@/src", () => ({
  db: {
    query: {
      automations: { findFirst: mocks.findAutomation },
      emails: { findFirst: mocks.findEmail },
    },
    insert: () => ({ values: mocks.insertRun }),
    select: () => ({ from: () => ({ where: () => ({
      limit: () => Promise.resolve([mocks.customTool]),
      then: (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) => mocks.metricWhere().then(resolve, reject),
    }) }) }),
    update: () => ({ set: mocks.updateSet }),
  },
}));

vi.mock("@/lib/safe-http-request", () => ({
  isSafeHttpUrl: () => ({ ok: true }),
  requestSafeHttp: mocks.requestSafeHttp,
}));
vi.mock("@/lib/queue", () => ({ automationQueue: { add: mocks.queueAdd } }));

vi.mock("@/lib/logger", () => ({
  logger: { child: () => ({ info: vi.fn(), error: vi.fn() }) },
}));

import { executeAutomation } from "@/lib/automation-engine";

const baseAutomation = {
  id: "automation-1",
  userId: "owner-1",
  name: "Test automation",
  nodes: [] as Array<Record<string, unknown>>,
  edges: [] as Array<Record<string, unknown>>,
  runCount: "0",
};

describe("executeAutomation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("GEMINI_API_KEY", "");
    mocks.findAutomation.mockResolvedValue({ ...baseAutomation });
    mocks.insertRun.mockResolvedValue(undefined);
    mocks.metricWhere
      .mockResolvedValueOnce([{ total: 1 }])
      .mockResolvedValueOnce([{ succeeded: 1 }]);
    mocks.updateSet.mockImplementation(() => ({ where: mocks.updateWhere }));
    mocks.updateWhere.mockImplementation(() => Object.assign(Promise.resolve(undefined), {
      returning: mocks.updateReturning,
    }));
    mocks.updateReturning.mockResolvedValue([{ id: "email-1" }]);
    mocks.queueAdd.mockResolvedValue({ id: "continuation-1" });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("records simulated email actions as successful without sending", async () => {
    mocks.findAutomation.mockResolvedValue({
      ...baseAutomation,
      nodes: [{ id: "send", type: "email_send", title: "Send", config: { recipient: "person@example.com" } }],
    });
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await executeAutomation("automation-1", {});

    expect(result.status).toBe("success");
    expect(result.steps).toHaveLength(1);
    expect(result.steps[0]).toMatchObject({ status: "success", output: { status: "simulated_send_ok" } });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(mocks.insertRun).toHaveBeenCalledWith(expect.objectContaining({ userId: "owner-1", status: "success" }));
  });

  it("fails and stops when an email action has no recipient", async () => {
    mocks.findAutomation.mockResolvedValue({
      ...baseAutomation,
      nodes: [
        { id: "send", type: "email_send", title: "Send", config: {} },
        { id: "later", type: "unknown", title: "Later", config: {} },
      ],
    });

    const result = await executeAutomation("automation-1", { simulated: true });

    expect(result.status).toBe("failed");
    expect(result.steps).toHaveLength(1);
    expect(result.steps[0].error).toContain("no recipient");
  });

  it("marks a live delivery error as a failed step", async () => {
    mocks.findAutomation.mockResolvedValue({
      ...baseAutomation,
      nodes: [{ id: "send", type: "email_send", title: "Send", config: { recipient: "person@example.com" } }],
    });
    vi.stubEnv("INTERNAL_API_SECRET", "test-secret");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("connection refused")));

    const result = await executeAutomation("automation-1", { simulated: false });

    expect(result.status).toBe("failed");
    expect(result.steps[0]).toMatchObject({ status: "failed", error: expect.stringContaining("connection refused") });
  });

  it("marks a failed HTTP tool call as failed and does not report a fallback success", async () => {
    mocks.findAutomation.mockResolvedValue({
      ...baseAutomation,
      nodes: [{ id: "tool", type: "tool_http_request", title: "Tool", config: { url: "https://api.example.com" } }],
    });
    mocks.requestSafeHttp.mockRejectedValue(new Error("timeout"));

    const result = await executeAutomation("automation-1", { simulated: false });

    expect(result.status).toBe("failed");
    expect(result.steps[0]).toMatchObject({ status: "failed", error: expect.stringContaining("timeout") });
    expect(result.steps[0].output).toBeUndefined();
  });

  it("loads saved custom tools for the automation owner and applies credentials", async () => {
    mocks.findAutomation.mockResolvedValue({
      ...baseAutomation,
      nodes: [{ id: "custom", type: "tool_custom", title: "CRM", config: { toolId: "tool-1" } }],
    });
    mocks.requestSafeHttp.mockResolvedValue({ status: 201, data: { id: "lead-1" } });
    const result = await executeAutomation("automation-1", {
      simulated: false,
      email: { id: "email-1", from: "sender@example.com", to: [], subject: "Hello", text: "Message", html: "" },
    });
    expect(result.status).toBe("success");
    expect(mocks.requestSafeHttp).toHaveBeenCalledWith(
      "https://api.example.com", "POST", { subject: "Hello" }, { Authorization: "Bearer plain-secret" },
    );
  });

  it("evaluates conditions and executes only the selected branch", async () => {
    mocks.findAutomation.mockResolvedValue({
      ...baseAutomation,
      nodes: [
        { id: "condition", type: "logic_if_else", title: "Invoice?", config: { variable: "{{email.subject}}", operator: "contains", value: "invoice" } },
        { id: "yes", type: "email_send", title: "Send invoice reply", config: { recipient: "billing@example.com" } },
        { id: "no", type: "email_send", title: "Send other reply", config: { recipient: "other@example.com" } },
      ],
      edges: [
        { from: "condition", to: "yes", condition: "true" },
        { from: "condition", to: "no", condition: "false" },
      ],
    });

    const result = await executeAutomation("automation-1", {
      email: {
        id: "email-1", from: "sender@example.com", to: [], subject: "Invoice details", text: "Please review", html: "",
      },
    });

    expect(result.status).toBe("success");
    expect(result.steps.map((step) => step.nodeId)).toEqual(["condition", "yes"]);
  });

  it("fails AI extraction clearly when Gemini is not configured", async () => {
    mocks.findAutomation.mockResolvedValue({
      ...baseAutomation,
      nodes: [{ id: "extract", type: "ai_extract", title: "Extract fields", config: {} }],
    });

    const result = await executeAutomation("automation-1", {
      simulated: true,
      email: { id: "email-1", from: "sender@example.com", to: [], subject: "Hello", text: "Please help", html: "" },
    });

    expect(result.status).toBe("failed");
    expect(result.steps[0].error).toContain("GEMINI_API_KEY is required");
  });

  it("simulates forwarding without sending", async () => {
    mocks.findAutomation.mockResolvedValue({
      ...baseAutomation,
      nodes: [{ id: "forward", type: "email_forward", title: "Forward", config: { forwardTo: "archive@example.com" } }],
    });
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const result = await executeAutomation("automation-1", {
      email: { id: "email-1", from: "sender@example.com", to: [], subject: "Hello", text: "Message", html: "" },
    });
    expect(result.steps[0]).toMatchObject({ status: "success", output: { sentTo: "archive@example.com", text: expect.stringContaining("Message") } });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not mutate email state during a simulated action", async () => {
    mocks.findAutomation.mockResolvedValue({
      ...baseAutomation,
      nodes: [{ id: "archive", type: "email_archive", title: "Archive", config: {} }],
    });

    const result = await executeAutomation("automation-1", {
      simulated: true,
      email: { id: "email-1", from: "sender@example.com", to: [], subject: "Hello", text: "", html: "" },
    });

    expect(result.status).toBe("success");
    expect(result.steps[0].output).toMatchObject({ archived: true, simulated: true });
    expect(mocks.updateSet).toHaveBeenCalledTimes(1); // run metrics only
  });

  it("accepts live schedule triggers without requiring an email payload", async () => {
    mocks.findAutomation.mockResolvedValue({
      ...baseAutomation,
      nodes: [{ id: "schedule", type: "trigger_schedule", category: "trigger", title: "Schedule", config: {} }],
    });

    const result = await executeAutomation("automation-1", { simulated: false });

    expect(result.status).toBe("success");
    expect(result.steps[0].output).toMatchObject({ matched: true, triggered: true });
  });

  it("queues a live delay continuation instead of holding a worker slot", async () => {
    mocks.findAutomation.mockResolvedValue({
      ...baseAutomation,
      nodes: [
        { id: "delay", type: "logic_delay", title: "Wait", config: { amount: 2, unit: "hours" } },
        { id: "later", type: "logic_filter", title: "Continue", config: { condition: "true" } },
      ],
    });
    const result = await executeAutomation("automation-1", { simulated: false });
    expect(result.status).toBe("waiting");
    expect(mocks.queueAdd).toHaveBeenCalledWith("execute-automation", expect.objectContaining({
      automationId: "automation-1",
      triggerPayload: expect.objectContaining({ resumeState: expect.objectContaining({ graph: expect.objectContaining({ queue: ["later"] }) }) }),
    }), { delay: 7_200_000 });
  });
});
