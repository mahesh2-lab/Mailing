import type { WorkflowEdge, WorkflowNode } from "@/lib/automation-workflow";

const MAX_TOTAL_STEPS = 100;
const MAX_VISITS_PER_NODE = 10;

interface GraphRunResult {
  failed: boolean;
  error?: string;
  paused?: boolean;
  state?: WorkflowGraphState;
}

export interface WorkflowGraphState {
  queue: string[];
  visits: [string, number][];
  steps: number;
  linear: boolean;
}

export async function runWorkflowGraph(
  nodes: WorkflowNode[],
  edges: WorkflowEdge[],
  runNode: (node: WorkflowNode, stepIndex: number) => Promise<boolean | "paused">,
  isBlocked: (nodeId: string) => boolean,
  getBranch: (nodeId: string) => "true" | "false" | undefined,
  log: (message: string) => void,
  initialState?: WorkflowGraphState,
): Promise<GraphRunResult> {
  const startNode = nodes.find((node) => node.category === "trigger") || nodes[0];
  if (!startNode) {
    log("Workflow has no nodes to execute.");
    return { failed: false };
  }

  const linear = initialState?.linear ?? edges.length === 0;
  const nodesById = new Map(nodes.map((node) => [node.id, node]));
  let steps = initialState?.steps || 0;
  const visits = new Map(initialState?.visits || []);

  if (linear) {
    const queue = initialState?.queue || nodes.map((node) => node.id);
    if (!initialState) log("No edges defined; executing nodes in linear order.");
    while (queue.length) {
      if (steps >= MAX_TOTAL_STEPS) {
        const error = `Workflow exceeded maximum step count (${MAX_TOTAL_STEPS}); aborted to prevent an infinite loop.`;
        log(error);
        return { failed: true, error };
      }
      const node = nodesById.get(queue.shift()!);
      if (!node) continue;
      steps++;
      const result = await runNode(node, steps);
      if (result === false) return { failed: true };
      if (isBlocked(node.id)) {
        log("Path halted by trigger/filter; stopping linear execution.");
        break;
      }
      if (result === "paused") return { failed: false, paused: true, state: { queue, visits: [...visits], steps, linear } };
    }
    return { failed: false };
  }

  const edgesByFrom = new Map<string, WorkflowEdge[]>();
  for (const edge of edges) {
    if (!edge.from || !edge.to) continue;
    edgesByFrom.set(edge.from, [...(edgesByFrom.get(edge.from) || []), edge]);
  }

  const queue = initialState?.queue || [startNode.id];
  while (queue.length) {
    if (steps >= MAX_TOTAL_STEPS) {
      const error = `Workflow exceeded maximum step count (${MAX_TOTAL_STEPS}); aborted to prevent an infinite loop.`;
      log(error);
      return { failed: true, error };
    }

    const nodeId = queue.shift()!;
    const node = nodesById.get(nodeId);
    if (!node) continue;

    const visitCount = (visits.get(nodeId) || 0) + 1;
    visits.set(nodeId, visitCount);
    if (visitCount > MAX_VISITS_PER_NODE) {
      const error = `Workflow exceeded maximum visits (${MAX_VISITS_PER_NODE}) for node "${node.title}"; path stopped.`;
      log(error);
      return { failed: true, error };
    }

    steps++;
    const result = await runNode(node, steps);
    if (result === false) return { failed: true };
    if (isBlocked(nodeId)) continue;

    const outgoing = edgesByFrom.get(nodeId) || [];
    let nextEdges = outgoing;
    if (node.type === "logic_if_else") {
      const branch = getBranch(nodeId) || "false";
      const matching = outgoing.filter((edge) => edge.condition === branch);
      const fallback = outgoing.filter((edge) => !edge.condition || edge.condition === "default");
      nextEdges = matching.length ? matching : fallback;
    }
    for (const edge of nextEdges) {
      if (nodesById.has(edge.to)) queue.push(edge.to);
    }
    if (result === "paused") return { failed: false, paused: true, state: { queue, visits: [...visits], steps, linear } };
  }
  return { failed: false };
}
