import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  after: vi.fn(),
  queueAdd: vi.fn(),
  webhookFindFirst: vi.fn(),
  userApiKeyFindFirst: vi.fn(),
  onConflictDoNothing: vi.fn(),
  decrypt: vi.fn(),
}));

vi.mock("next/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next/server")>();
  return {
    ...actual,
    after: mocks.after,
  };
});

vi.mock("svix", () => ({
  Webhook: class {
    verify() {
      return true;
    }
  },
}));

vi.mock("@/src/lib/crypto", () => ({
  decrypt: mocks.decrypt,
}));

vi.mock("@/lib/queue", () => ({
  mailFetchQueue: {
    add: mocks.queueAdd,
  },
}));

vi.mock("@/src/lib/pusher", () => ({
  pusherServer: {
    trigger: vi.fn(),
    authorizeChannel: vi.fn(),
  },
}));

vi.mock("@/src/index", () => ({
  db: {
    query: {
      userApiKeys: {
        findFirst: mocks.userApiKeyFindFirst,
        findMany: vi.fn(),
      },
      webhookEvents: {
        findFirst: mocks.webhookFindFirst,
      },
    },
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        onConflictDoNothing: mocks.onConflictDoNothing,
      })),
    })),
  },
}));

import { POST } from "@/app/api/webhooks/resend/route";

describe("resend webhook route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.userApiKeyFindFirst.mockResolvedValue({
      userId: "user-1",
      provider: "Resend",
      encryptedWebhookKey: "encrypted-secret",
    });
    mocks.decrypt.mockResolvedValue("whsec_test");
    mocks.webhookFindFirst.mockResolvedValue(null);
    mocks.queueAdd.mockResolvedValue({ id: "job-1" });
    mocks.onConflictDoNothing.mockResolvedValue(undefined);
  });

  it("enqueues email.received into mail-fetch-queue and records webhook after enqueue", async () => {
    const payload = JSON.stringify({
      type: "email.received",
      created_at: "2026-01-01T00:00:00.000Z",
      data: {
        email_id: "email_123",
        from: "sender@example.com",
      },
    });

    const response = await POST(
      new Request("http://localhost/api/webhooks/resend?userId=user-1", {
        method: "POST",
        headers: {
          "svix-id": "svix_1",
          "svix-timestamp": "1111111111",
          "svix-signature": "v1,test",
          "content-type": "application/json",
        },
        body: payload,
      }),
    );

    expect(response.status).toBe(200);
    expect(mocks.after).not.toHaveBeenCalled();
    expect(mocks.queueAdd).toHaveBeenCalledWith(
      "fetch-inbound-email",
      {
        emailId: "email_123",
        resolvedUserId: "user-1",
        eventData: expect.objectContaining({ email_id: "email_123" }),
      },
      {
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 2000,
        },
      },
    );
    expect(mocks.onConflictDoNothing).toHaveBeenCalledTimes(1);
    expect(mocks.queueAdd.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.onConflictDoNothing.mock.invocationCallOrder[0],
    );
  });
});
