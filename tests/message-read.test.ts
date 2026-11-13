import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  selectResult: [] as Array<{ id: string }>,
  updateSet: vi.fn(),
  pusherTrigger: vi.fn(),
  session: { user: { id: "user-1" } } as { user: { id: string } } | null,
}));

vi.mock("@/src", () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: async () => mocks.selectResult,
        }),
      }),
    }),
    update: () => ({
      set: mocks.updateSet,
    }),
  },
}));

vi.mock("@/src/db/schema", () => ({
  emails: { id: "id", userId: "userId", unread: "unread", status: "status" },
}));

vi.mock("drizzle-orm", () => ({
  and: (...args: unknown[]) => args,
  eq: (...args: unknown[]) => args,
}));

vi.mock("@/src/lib/require-auth", () => ({
  getAuthSession: async () => mocks.session,
}));

vi.mock("@/src/lib/pusher", () => ({
  pusherServer: {
    trigger: (...args: unknown[]) => mocks.pusherTrigger(...args),
  },
}));

vi.mock("@/lib/realtime-channels", () => ({
  emailChannelForUser: (userId: string) => `private-user-${userId}`,
}));

import { PATCH, POST } from "@/app/api/v1/messages/[messageId]/read/route";

describe("message read route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.session = { user: { id: "user-1" } };
    mocks.selectResult = [{ id: "msg-1" }];
    mocks.updateSet.mockReturnValue({ where: async () => [] });
  });

  it("returns 401 when unauthenticated", async () => {
    mocks.session = null;
    const req = new Request("http://localhost/api/v1/messages/msg-1/read", { method: "PATCH" });
    const res = await PATCH(req, { params: Promise.resolve({ messageId: "msg-1" }) });
    expect(res.status).toBe(401);
  });

  it("returns 404 when email not found", async () => {
    mocks.selectResult = [];
    const req = new Request("http://localhost/api/v1/messages/msg-unknown/read", { method: "PATCH" });
    const res = await PATCH(req, { params: Promise.resolve({ messageId: "msg-unknown" }) });
    expect(res.status).toBe(404);
  });

  it("marks email as read when body is empty or defaults", async () => {
    const req = new Request("http://localhost/api/v1/messages/msg-1/read", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const res = await PATCH(req, { params: Promise.resolve({ messageId: "msg-1" }) });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toEqual({ id: "msg-1", unread: false, read: true });
    expect(mocks.updateSet).toHaveBeenCalledWith({ unread: false, status: "read" });
    expect(mocks.pusherTrigger).toHaveBeenCalledWith("private-user-user-1", "read", { emailId: "msg-1" });
  });

  it("marks email as unread when unread: true is passed", async () => {
    const req = new Request("http://localhost/api/v1/messages/msg-1/read", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ unread: true }),
    });
    const res = await PATCH(req, { params: Promise.resolve({ messageId: "msg-1" }) });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toEqual({ id: "msg-1", unread: true, read: false });
    expect(mocks.updateSet).toHaveBeenCalledWith({ unread: true, status: "received" });
    expect(mocks.pusherTrigger).toHaveBeenCalledWith("private-user-user-1", "unread", { emailId: "msg-1" });
  });

  it("supports POST method as well", async () => {
    const req = new Request("http://localhost/api/v1/messages/msg-1/read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ unread: false, read: true }),
    });
    const res = await POST(req, { params: Promise.resolve({ messageId: "msg-1" }) });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toEqual({ id: "msg-1", unread: false, read: true });
    expect(mocks.updateSet).toHaveBeenCalledWith({ unread: false, status: "read" });
  });
});
