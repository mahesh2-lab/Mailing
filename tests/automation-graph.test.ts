import { describe, expect, it, vi } from "vitest";
import { runWorkflowGraph } from "@/lib/automation-graph";
import type { WorkflowEdge, WorkflowNode } from "@/lib/automation-workflow";

function node(id: string, type = "action"): WorkflowNode {
  return { id, type, title: id };
}

describe("runWorkflowGraph", () => {
  it("runs linear workflows in order and stops on a failed node", async () => {
    const nodes = [node("first"), node("failure"), node("last")];
    const visited: string[] = [];
    const result = await runWorkflowGraph(
      nodes,
      [],
      async (item) => {
        visited.push(item.id);
        return item.id !== "failure";
      },
      () => false,
      () => undefined,
      () => {},
    );

    expect(visited).toEqual(["first", "failure"]);
    expect(result.failed).toBe(true);
  });

  it("follows only the selected conditional branch", async () => {
    const nodes = [node("trigger", "trigger"), node("condition", "logic_if_else"), node("yes"), node("no")];
    const edges: WorkflowEdge[] = [
      { from: "trigger", to: "condition" },
      { from: "condition", to: "yes", condition: "true" },
      { from: "condition", to: "no", condition: "false" },
    ];
    const visited: string[] = [];
    const result = await runWorkflowGraph(
      nodes,
      edges,
      async (item) => { visited.push(item.id); return true; },
      () => false,
      (id) => id === "condition" ? "true" : undefined,
      () => {},
    );

    expect(result.failed).toBe(false);
    expect(visited).toEqual(["trigger", "condition", "yes"]);
  });

  it("does not follow edges from a blocked path", async () => {
    const nodes = [node("filter", "logic_filter"), node("downstream")];
    const visited: string[] = [];
    const result = await runWorkflowGraph(
      nodes,
      [{ from: "filter", to: "downstream" }],
      async (item) => { visited.push(item.id); return true; },
      (id) => id === "filter",
      () => undefined,
      () => {},
    );

    expect(result.failed).toBe(false);
    expect(visited).toEqual(["filter"]);
  });

  it("fails instead of reporting success when a cycle hits the visit cap", async () => {
    const cycle = [node("loop", "logic_loop")];
    const runNode = vi.fn(async () => true);
    const result = await runWorkflowGraph(
      cycle,
      [{ from: "loop", to: "loop" }],
      runNode,
      () => false,
      () => undefined,
      () => {},
    );

    expect(runNode).toHaveBeenCalledTimes(10);
    expect(result).toMatchObject({ failed: true, error: expect.stringContaining("maximum visits") });
  });

  it("enforces the same step cap for linear workflows", async () => {
    const manyNodes = Array.from({ length: 101 }, (_, i) => node(String(i)));
    const runNode = vi.fn(async () => true);
    const result = await runWorkflowGraph(manyNodes, [], runNode, () => false, () => undefined, () => {});

    expect(runNode).toHaveBeenCalledTimes(100);
    expect(result).toMatchObject({ failed: true, error: expect.stringContaining("maximum step count") });
  });

  it("returns a resumable queue when a node pauses and resumes after it", async () => {
    const nodes = [node("first"), node("delay"), node("last")];
    const first = await runWorkflowGraph(nodes, [], async (item) => item.id !== "delay" ? true : "paused", () => false, () => undefined, () => {});
    expect(first).toMatchObject({ paused: true, state: { queue: ["last"], steps: 2, linear: true } });
    const visited: string[] = [];
    const resumed = await runWorkflowGraph(nodes, [], async (item) => { visited.push(item.id); return true; }, () => false, () => undefined, () => {}, first.state);
    expect(resumed.failed).toBe(false);
    expect(visited).toEqual(["last"]);
  });
});
