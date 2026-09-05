import { describe, it, expect } from "vitest";
import {
  resolveVariables,
  isSafeHttpUrl,
  matchesTrigger,
  type ExecutionContext,
} from "../lib/automation-engine";

function makeCtx(partial: Partial<ExecutionContext> = {}): ExecutionContext {
  return {
    email: {
      id: "email-1",
      from: "Acme Client <client@acme.corp>",
      to: ["mahesh@heymahesh.in"],
      subject: "Invoice #1042",
      text: "Please pay invoice #1042.",
      html: "",
    },
    triggerSource: "test",
    variables: {},
    steps: [],
    userId: "test-user-id",
    ...partial,
  };
}

describe("resolveVariables", () => {
  it("substitutes known email tokens from context", () => {
    const ctx = makeCtx();
    expect(resolveVariables("Hi {{email.from.name}}", ctx)).toBe("Hi Acme Client");
    expect(resolveVariables("Re: {{email.subject}}", ctx)).toBe("Re: Invoice #1042");
    expect(resolveVariables("addr={{email.from.address}}", ctx)).toBe("addr=client@acme.corp");
  });

  it("substitutes custom variables set on the context", () => {
    const ctx = makeCtx({ variables: { "{{ai.category}}": "Billing" } });
    expect(resolveVariables("Category: {{ai.category}}", ctx)).toBe("Category: Billing");
  });

  it("leaves unknown tokens intact rather than blanking them", () => {
    const ctx = makeCtx({ variables: {} });
    expect(resolveVariables("{{does.not.exist}}", ctx)).toBe("{{does.not.exist}}");
  });

  it("resolves in a single pass so a resolved value is not re-substituted", () => {
    const ctx = makeCtx({
      variables: { "{{a}}": "{{b}}", "{{b}}": "LEAKED" },
    });
    // {{a}} -> "{{b}}" and must NOT then expand to "LEAKED".
    expect(resolveVariables("{{a}}", ctx)).toBe("{{b}}");
  });

  it("returns an empty string for non-string input", () => {
    const ctx = makeCtx();
    expect(resolveVariables(undefined as unknown as string, ctx)).toBe("");
    expect(resolveVariables(null as unknown as string, ctx)).toBe("");
  });
});

describe("isSafeHttpUrl", () => {
  it("allows public http(s) URLs", () => {
    expect(isSafeHttpUrl("https://api.example.com/hook").ok).toBe(true);
    expect(isSafeHttpUrl("http://example.com").ok).toBe(true);
    expect(isSafeHttpUrl("https://8.8.8.8/path").ok).toBe(true);
  });

  it("blocks non-http(s) protocols", () => {
    expect(isSafeHttpUrl("file:///etc/passwd").ok).toBe(false);
    expect(isSafeHttpUrl("ftp://example.com").ok).toBe(false);
    expect(isSafeHttpUrl("gopher://example.com").ok).toBe(false);
  });

  it("blocks loopback and internal hostnames", () => {
    expect(isSafeHttpUrl("http://localhost/x").ok).toBe(false);
    expect(isSafeHttpUrl("http://foo.localhost/x").ok).toBe(false);
    expect(isSafeHttpUrl("http://service.internal/x").ok).toBe(false);
    expect(isSafeHttpUrl("http://printer.local/x").ok).toBe(false);
  });

  it("blocks loopback, private, and cloud-metadata IPv4 ranges", () => {
    expect(isSafeHttpUrl("http://127.0.0.1/x").ok).toBe(false);
    expect(isSafeHttpUrl("http://10.0.0.5/x").ok).toBe(false);
    expect(isSafeHttpUrl("http://172.16.0.1/x").ok).toBe(false);
    expect(isSafeHttpUrl("http://192.168.1.1/x").ok).toBe(false);
    expect(isSafeHttpUrl("http://169.254.169.254/latest/meta-data").ok).toBe(false);
    expect(isSafeHttpUrl("http://100.64.0.1/x").ok).toBe(false);
  });

  it("blocks IPv6 loopback and unique-local addresses", () => {
    expect(isSafeHttpUrl("http://[::1]/x").ok).toBe(false);
    expect(isSafeHttpUrl("http://[fd00::1]/x").ok).toBe(false);
  });

  it("rejects malformed URLs", () => {
    expect(isSafeHttpUrl("not-a-url").ok).toBe(false);
    expect(isSafeHttpUrl("").ok).toBe(false);
  });
});

describe("matchesTrigger", () => {
  const trigger = (config: Record<string, unknown>) => ({
    nodes: [{ id: "t", type: "trigger_email_received", category: "trigger", title: "Trigger", config }],
  });

  it("matches when there is no email context", () => {
    expect(matchesTrigger(trigger({ filterFrom: "acme.corp" }), undefined)).toBe(true);
  });

  it("matches when the trigger has no filters", () => {
    expect(matchesTrigger(trigger({}), { from: "anyone@x.com", subject: "hi" })).toBe(true);
  });

  it("applies the sender filter", () => {
    expect(matchesTrigger(trigger({ filterFrom: "acme.corp" }), { from: "client@acme.corp", subject: "" })).toBe(true);
    expect(matchesTrigger(trigger({ filterFrom: "acme.corp" }), { from: "spam@other.com", subject: "" })).toBe(false);
  });

  it("applies the subject filter with comma-separated keywords", () => {
    const t = trigger({ filterSubject: "invoice, receipt" });
    expect(matchesTrigger(t, { from: "x@y.com", subject: "Your Invoice #12" })).toBe(true);
    expect(matchesTrigger(t, { from: "x@y.com", subject: "A receipt for you" })).toBe(true);
    expect(matchesTrigger(t, { from: "x@y.com", subject: "Just saying hello" })).toBe(false);
  });

  it("requires both sender and subject filters to pass when both are set", () => {
    const t = trigger({ filterFrom: "acme.corp", filterSubject: "invoice" });
    expect(matchesTrigger(t, { from: "client@acme.corp", subject: "Invoice #1" })).toBe(true);
    expect(matchesTrigger(t, { from: "client@acme.corp", subject: "hello" })).toBe(false);
    expect(matchesTrigger(t, { from: "x@other.com", subject: "Invoice #1" })).toBe(false);
  });
});
