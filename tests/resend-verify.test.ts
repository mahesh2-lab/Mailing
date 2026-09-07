import { describe, it, expect, vi } from "vitest";
import {
  verifyResendWebhookSecret,
  verifyResendApiKey,
  verifyResendCredentials,
} from "../lib/resend-verify";

vi.mock("resend", () => {
  return {
    Resend: class MockResend {
      domains: any;
      webhooks: any;
      apiKeys: any;
      emails: any;

      constructor(key: string) {
        if (key === "re_valid_key_123") {
          this.domains = {
            list: vi.fn().mockResolvedValue({
              data: {
                data: [
                  { id: "d_1", name: "acme.corp", status: "verified" },
                  { id: "d_2", name: "test.org", status: "pending" },
                ],
              },
              error: null,
            }),
          };
          this.webhooks = {
            list: vi.fn().mockResolvedValue({
              data: { data: [{ id: "wh_1", url: "https://acme.corp/api/webhooks/resend" }] },
              error: null,
            }),
          };
          this.apiKeys = {
            list: vi.fn().mockResolvedValue({ data: [], error: null }),
          };
          this.emails = {
            list: vi.fn().mockResolvedValue({ data: [], error: null }),
          };
        } else {
          this.domains = {
            list: vi.fn().mockResolvedValue({
              data: null,
              error: { message: "API key is invalid", name: "validation_error" },
            }),
          };
          this.apiKeys = {
            list: vi.fn().mockResolvedValue({
              data: null,
              error: { message: "API key is invalid", name: "validation_error" },
            }),
          };
          this.emails = {
            list: vi.fn().mockResolvedValue({
              data: null,
              error: { message: "API key is invalid", name: "validation_error" },
            }),
          };
          this.webhooks = {
            list: vi.fn().mockResolvedValue({ data: null, error: null }),
          };
        }
      }
    },
  };
});

describe("verifyResendWebhookSecret", () => {
  it("allows empty or omitted secret as optional", () => {
    expect(verifyResendWebhookSecret("").valid).toBe(true);
    expect(verifyResendWebhookSecret(null).valid).toBe(true);
    expect(verifyResendWebhookSecret(undefined).valid).toBe(true);
  });

  it("fails if secret does not start with whsec_", () => {
    const res = verifyResendWebhookSecret("sec_1234567890abcdef");
    expect(res.valid).toBe(false);
    expect(res.error).toContain("whsec_");
  });

  it("fails if secret has invalid base64 encoding", () => {
    const res = verifyResendWebhookSecret("whsec_!!!not_base_64!!!");
    expect(res.valid).toBe(false);
    expect(res.error).toContain("Invalid");
  });

  it("succeeds for valid Svix signing secret format", () => {
    const res = verifyResendWebhookSecret("whsec_MfKQ9r8GKYdaBeyYbGarvgYAkgFgDSDG");
    expect(res.valid).toBe(true);
  });
});

describe("verifyResendApiKey", () => {
  it("fails if key is empty", async () => {
    const res = await verifyResendApiKey("");
    expect(res.valid).toBe(false);
    expect(res.error).toContain("required");
  });

  it("fails if key does not start with re_", async () => {
    const res = await verifyResendApiKey("api_12345");
    expect(res.valid).toBe(false);
    expect(res.error).toContain("re_");
  });

  it("fails if Resend API returns error", async () => {
    const res = await verifyResendApiKey("re_invalid_key");
    expect(res.valid).toBe(false);
    expect(res.error).toContain("invalid");
  });

  it("succeeds and lists domains if Resend API returns data", async () => {
    const res = await verifyResendApiKey("re_valid_key_123");
    expect(res.valid).toBe(true);
    expect(res.domains).toHaveLength(2);
    expect(res.domains?.[0].name).toBe("acme.corp");
  });
});

describe("verifyResendCredentials", () => {
  it("fails if webhook secret format is invalid before calling API", async () => {
    const res = await verifyResendCredentials({
      apiKey: "re_valid_key_123",
      webhookSecret: "invalid_secret",
    });
    expect(res.valid).toBe(false);
    expect(res.field).toBe("webhookSecret");
  });

  it("fails if API key is invalid", async () => {
    const res = await verifyResendCredentials({
      apiKey: "re_bad_key",
      webhookSecret: "whsec_MfKQ9r8GKYdaBeyYbGarvgYAkgFgDSDG",
    });
    expect(res.valid).toBe(false);
    expect(res.field).toBe("apiKey");
  });

  it("succeeds and detects matching verified domains", async () => {
    const res = await verifyResendCredentials({
      apiKey: "re_valid_key_123",
      webhookSecret: "whsec_MfKQ9r8GKYdaBeyYbGarvgYAkgFgDSDG",
      senderEmail: "team@acme.corp",
    });
    expect(res.valid).toBe(true);
    expect(res.domainMatch?.verified).toBe(true);
    expect(res.webhooksCount).toBe(1);
  });

  it("warns if sender email domain is unverified", async () => {
    const res = await verifyResendCredentials({
      apiKey: "re_valid_key_123",
      senderEmail: "team@unverified.org",
    });
    expect(res.valid).toBe(true);
    expect(res.domainMatch?.verified).toBe(false);
    expect(res.domainMatch?.warning).toContain("unverified.org");
  });
});
