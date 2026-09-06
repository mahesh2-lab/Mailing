import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getResendClient: vi.fn(),
  userSettingsFindFirst: vi.fn(),
  automationsFindMany: vi.fn(),
  pusherTrigger: vi.fn(),
  automationAdd: vi.fn(),
  onConflictDoNothing: vi.fn(),
}));

vi.mock("@/lib/resend", () => ({
  getResendClient: mocks.getResendClient,
}));

vi.mock("@/src/lib/pusher", () => ({
  pusherServer: { trigger: mocks.pusherTrigger },
}));

vi.mock("@/lib/queue", () => ({
  automationQueue: { add: mocks.automationAdd },
}));

vi.mock("@/lib/automation-engine", () => ({
  matchesTrigger: vi.fn(() => true),
}));

vi.mock("@/src/index", () => ({
  db: {
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        onConflictDoNothing: mocks.onConflictDoNothing,
      })),
    })),
    query: {
      userSettings: { findFirst: mocks.userSettingsFindFirst },
      automations: { findMany: mocks.automationsFindMany },
    },
  },
}));

import { processMailFetchJob } from "@/lib/mail-fetch-processor";

describe("processMailFetchJob", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.onConflictDoNothing.mockResolvedValue(undefined);
    mocks.pusherTrigger.mockResolvedValue(undefined);
    mocks.automationAdd.mockResolvedValue(undefined);
    mocks.userSettingsFindFirst.mockResolvedValue({
      senderEmail: "owner@userb.com",
    });
    mocks.getResendClient.mockResolvedValue({
      emails: {
        receiving: {
          get: vi.fn().mockResolvedValue({
            data: {
              id: "inbound_1",
              from: "alerts@example.com",
              to: ["userb@company.com"],
              subject: "Invoice #1",
              text: "Hello User B",
              html: "<p>Hello User B</p>",
              created_at: "2026-01-01T00:00:00.000Z",
              bcc: [],
              cc: [],
              reply_to: [],
              headers: {},
              attachments: [],
            },
            error: null,
          }),
        },
      },
    });
  });

  it("queues automations only for the resolved user and triggers user-scoped channel", async () => {
    mocks.automationsFindMany.mockResolvedValue([
      {
        id: "auto-a",
        userId: "user-a",
        enabled: true,
        nodes: [],
      },
      {
        id: "auto-b",
        userId: "user-b",
        enabled: true,
        nodes: [],
      },
    ]);

    await processMailFetchJob({
      emailId: "resend_email_1",
      resolvedUserId: "user-b",
      eventData: { email_id: "resend_email_1" },
    });

    expect(mocks.automationAdd).toHaveBeenCalledTimes(1);
    expect(mocks.automationAdd).toHaveBeenCalledWith(
      "execute-automation",
      expect.objectContaining({
        automationId: "auto-b",
      }),
    );

    expect(mocks.pusherTrigger).toHaveBeenCalledWith(
      "private-emails-user-b",
      "new-email",
      expect.objectContaining({ emailId: "inbound_1" }),
    );
  });
});
