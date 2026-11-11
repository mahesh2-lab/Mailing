import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findUserSettings: vi.fn(),
  findEmail: vi.fn(),
  insertValues: vi.fn(),
  send: vi.fn(),
  updateSet: vi.fn(),
}));

vi.mock("@/src", () => ({
  db: {
    query: { userSettings: { findFirst: mocks.findUserSettings }, emails: { findFirst: mocks.findEmail } },
    insert: () => ({ values: mocks.insertValues }),
    update: () => ({ set: mocks.updateSet }),
  },
}));
vi.mock("@/src/db/schema", () => ({ emails: { id: {}, userId: {}, idempotencyKey: {} }, userSettings: { userId: {} } }));
vi.mock("drizzle-orm", () => ({
  and: (...args: unknown[]) => args,
  eq: (...args: unknown[]) => args,
  or: (...args: unknown[]) => args,
  desc: vi.fn(),
  ne: vi.fn(),
  sql: vi.fn(),
}));
vi.mock("@/src/lib/require-auth", () => ({ getAuthSession: async () => ({ user: { id: "user-1" } }) }));
vi.mock("@/lib/resend", () => ({ getResendClient: async () => ({ emails: { send: mocks.send } }) }));
vi.mock("@/src/lib/pusher", () => ({ pusherServer: { trigger: vi.fn() } }));
vi.mock("@/lib/realtime-channels", () => ({ emailChannelForUser: () => "user-channel" }));
vi.mock("@/lib/utils", () => ({ escapeHtml: (value: string) => value }));

import { POST } from "@/app/api/v1/messages/route";

describe("message send idempotency", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findUserSettings.mockResolvedValue({ senderName: "Sender", senderEmail: "sender@example.com" });
    mocks.findEmail.mockResolvedValue(null);
    mocks.insertValues.mockImplementation((row) => ({
      onConflictDoNothing: () => ({ returning: async () => [{ id: row.id }] }),
    }));
    mocks.updateSet.mockReturnValue({ where: async () => [] });
    mocks.send.mockResolvedValue({ data: { id: "provider-1" }, error: null });
  });

  it("stores before sending and reuses the sent record on retry", async () => {
    const request = () => new Request("https://mail.test/api/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Idempotency-Key": "send-key-1" },
      body: JSON.stringify({ to: "recipient@example.com", subject: "Hello", text: "Body" }),
    });

    const firstResponse = await POST(request());
    const first = await firstResponse.json();
    expect(firstResponse.status).toBe(201);
    expect(mocks.insertValues.mock.invocationCallOrder[0]).toBeLessThan(mocks.send.mock.invocationCallOrder[0]);
    expect(mocks.insertValues).toHaveBeenCalledWith(expect.objectContaining({ status: "sending", folder: "outbox" }));
    expect(mocks.send).toHaveBeenCalledWith(expect.any(Object), { idempotencyKey: "send-key-1" });

    const stored = mocks.insertValues.mock.calls[0][0];
    mocks.findEmail.mockResolvedValueOnce({ ...stored, providerId: "provider-1" });
    const retryResponse = await POST(request());
    expect(retryResponse.status).toBe(200);
    expect(await retryResponse.json()).toEqual({ id: first.id, isDraft: false });
    expect(mocks.send).toHaveBeenCalledTimes(1);
  });
});
