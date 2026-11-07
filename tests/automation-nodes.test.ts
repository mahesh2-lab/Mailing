import { afterEach, describe, expect, it, vi } from "vitest";
import { executeAiNode } from "@/lib/automation-ai-nodes";
import { executeLogicNode } from "@/lib/automation-logic-nodes";
import type { ExecutionContext, WorkflowNode } from "@/lib/automation-workflow";

function context(): ExecutionContext {
  return {
    email: {
      id: "email-1",
      from: "Support Team <support@example.com>",
      to: ["user@example.com"],
      subject: "A billing invoice",
      text: "Please review the billing invoice.",
      html: "",
    },
    triggerSource: "test",
    variables: {},
    steps: [],
    userId: "user-1",
  };
}

function node(
  type: string,
  config: Record<string, unknown> = {},
): WorkflowNode {
  return { id: type, type, title: type, config };
}

describe("automation node handlers", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("classifies by keywords when Gemini is not configured", async () => {
    vi.stubEnv("GEMINI_API_KEY", "");
    const ctx = context();
    const output = await executeAiNode(
      node("ai_classify", { categories: ["Support", "Billing"] }),
      ctx,
      () => {},
    );

    expect(output).toMatchObject({
      classifiedCategory: "Billing",
      confidence: 0.95,
    });
    expect(ctx.variables["{{ai.category}}"]).toBe("Billing");
  });

  it("falls back to defaults when category configuration is malformed", async () => {
    vi.stubEnv("GEMINI_API_KEY", "");
    const output = await executeAiNode(
      node("ai_classify", { categories: "Support" }),
      context(),
      () => {},
    );
    expect(output).toHaveProperty("classifiedCategory", "Billing");
  });

  it.each([
    ["equals", "Invoice", "invoice", true],
    ["contains", "invoice details", "invoice", true],
    ["starts_with", "invoice details", "invoice", true],
    ["not_equals", "invoice", "receipt", true],
    ["is_empty", "", "", true],
  ])(
    "evaluates %s conditions case-insensitively",
    (operator, value, target, expected) => {
      const ctx = context();
      ctx.variables["{{test.value}}"] = value;
      const result = executeLogicNode(
        node("logic_if_else", {
          variable: "{{test.value}}",
          operator,
          value: target,
        }),
        ctx,
        () => {},
      );
      expect(result.output.conditionPassed).toBe(expected);
      expect(result.branch).toBe("true");
    },
  );

  it("blocks false filters and validates bounded delays", () => {
    const ctx = context();
    expect(
      executeLogicNode(
        node("logic_filter", { condition: "false" }),
        ctx,
        () => {},
      ),
    ).toMatchObject({
      output: { conditionPassed: false },
      blocked: true,
    });
    expect(
      executeLogicNode(
        node("logic_delay", { amount: 2, unit: "hours" }),
        ctx,
        () => {},
        false,
      ).output,
    ).toMatchObject({
      delay: 2,
      unit: "hours",
      enforced: false,
      delayMs: 7_200_000,
    });
    expect(() =>
      executeLogicNode(
        node("logic_delay", { amount: 2, unit: "days" }),
        ctx,
        () => {},
      ),
    ).toThrow("no longer than 24 hours");
  });

  it("routes an AI decision using the configured variable and value", async () => {
    const ctx = context();
    ctx.variables["{{ai.category}}"] = "Billing";
    await expect(
      executeAiNode(
        node("ai_decision", { variable: "{{ai.category}}", value: "billing" }),
        ctx,
        () => {},
      ),
    ).resolves.toMatchObject({ decision: true, branch: "true" });
  });

  it("fails malformed condition operators instead of silently taking false", () => {
    expect(() =>
      executeLogicNode(
        node("logic_if_else", { operator: "greater_than" }),
        context(),
        () => {},
      ),
    ).toThrow("Unsupported condition operator: greater_than");
  });
});
