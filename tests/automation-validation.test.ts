import { describe, expect, it } from "vitest";
import { automationCreateInput, automationUpdateInput } from "@/lib/automation-validation";

const node = {
  id: "trigger",
  type: "trigger_email_received",
  category: "trigger",
  title: "Email received",
  config: {},
  position: { x: 0, y: 0 },
};

describe("automation request validation", () => {
  it("rejects malformed nodes and edges to missing nodes", () => {
    expect(automationCreateInput.safeParse({ nodes: [{ id: 4 }], edges: [] }).success).toBe(false);
    expect(automationCreateInput.safeParse({
      nodes: [node],
      edges: [{ id: "edge", from: "trigger", to: "missing" }],
    }).success).toBe(false);
  });

  it("accepts valid create and partial updates while rejecting malformed workflow data", () => {
    expect(automationCreateInput.safeParse({ nodes: [node], edges: [] }).success).toBe(true);
    expect(automationUpdateInput.safeParse({ enabled: false }).success).toBe(true);
    expect(automationUpdateInput.safeParse({ nodes: [{ ...node, position: { x: "bad", y: 0 } }] }).success).toBe(false);
  });
});
