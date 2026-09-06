import { beforeEach, describe, expect, it, vi } from "vitest";

const getResendClientMock = vi.fn();
const userSettingsFindFirstMock = vi.fn();
const automationsFindManyMock = vi.fn();
const pusherTriggerMock = vi.fn();
const automationAddMock = vi.fn();
const onConflictDoNothingMock = vi.fn();

vi.mock("@/lib/resend", () => ({
  getResendClient: getResendClientMock,
}));

vi.mock("@/src/lib/pusher", () => ({
  pusherServer: { trigger: pusherTriggerMock },
}));

vi.mock("@/lib/queue", () => ({
  automationQueue: { add: automationAddMock },
}));

vi.mock("@/lib/automation-engine", () => ({
  matchesTrigger: vi.fn(() => true),
}));

vi.mock("@/src/index", () => ({
  db: {
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        onConflictDoNothing: onConflictDoNothingMock,
      })),
    })),
    query: {
      userSettings: { findFirst: userSettingsFindFirstMock },
      automations: { findMany: automationsFindManyMock },
    },
  },
}));

import { processMailFetchJob } from "@/lib/mail-fetch-processor";

describe("processMailFetchJob", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    onConflictDoNothingMock.mockResolvedValue(undefined);
    pusherTriggerMock.mockResolvedValue(undefined);
    automationAddMock.mockResolvedValue(undefined);
    userSettingsFindFirstMock.mockResolvedValue({
      senderEmail: "owner@userb.com",
    });
    getResendClientMock.mockResolvedValue({
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
    automationsFindManyMock.mockResolvedValue([
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

    expect(automationAddMock).toHaveBeenCalledTimes(1);
    expect(automationAddMock).toHaveBeenCalledWith(
      "execute-automation",
      expect.objectContaining({
        automationId: "auto-b",
      }),
    );

    expect(pusherTriggerMock).toHaveBeenCalledWith(
      "private-emails-user-b",
      "new-email",
      expect.objectContaining({ emailId: "inbound_1" }),
    );
  });
});
