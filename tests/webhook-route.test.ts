import { beforeEach, describe, expect, it, vi } from "vitest";

const afterMock = vi.fn();
const queueAddMock = vi.fn();
const webhookFindFirstMock = vi.fn();
const userApiKeyFindFirstMock = vi.fn();
const onConflictDoNothingMock = vi.fn();
const decryptMock = vi.fn();

vi.mock("next/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next/server")>();
  return {
    ...actual,
    after: afterMock,
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
  decrypt: decryptMock,
}));

vi.mock("@/lib/queue", () => ({
  mailFetchQueue: {
    add: queueAddMock,
  },
}));

vi.mock("@/src/lib/pusher", () => ({
  pusherServer: {
    trigger: vi.fn(),
  },
}));

vi.mock("@/src/index", () => ({
  db: {
    query: {
      userApiKeys: {
        findFirst: userApiKeyFindFirstMock,
        findMany: vi.fn(),
      },
      webhookEvents: {
        findFirst: webhookFindFirstMock,
      },
    },
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        onConflictDoNothing: onConflictDoNothingMock,
      })),
    })),
  },
}));

import { POST } from "@/app/api/webhooks/resend/route";

describe("resend webhook route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    userApiKeyFindFirstMock.mockResolvedValue({
      userId: "user-1",
      provider: "Resend",
      encryptedWebhookKey: "encrypted-secret",
    });
    decryptMock.mockResolvedValue("whsec_test");
    webhookFindFirstMock.mockResolvedValue(null);
    queueAddMock.mockResolvedValue({ id: "job-1" });
    onConflictDoNothingMock.mockResolvedValue(undefined);
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
    expect(afterMock).not.toHaveBeenCalled();
    expect(queueAddMock).toHaveBeenCalledWith(
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
    expect(onConflictDoNothingMock).toHaveBeenCalledTimes(1);
    expect(queueAddMock.mock.invocationCallOrder[0]).toBeLessThan(
      onConflictDoNothingMock.mock.invocationCallOrder[0],
    );
  });
});
