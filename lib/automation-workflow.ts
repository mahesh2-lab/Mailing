export interface ExecutionContext {
  email?: {
    id: string;
    from: string;
    to: string[];
    subject: string;
    text: string;
    html: string;
    labels?: string[];
    attachments?: { id: string; filename: string }[];
  };
  webhook?: unknown;
  triggerSource: string;
  variables: Record<string, unknown>;
  steps: {
    nodeId: string;
    nodeTitle: string;
    nodeType: string;
    status: "success" | "failed" | "skipped";
    durationMs: number;
    input: Record<string, unknown>;
    output?: Record<string, unknown>;
    error?: string;
    logs?: string[];
  }[];
  userId: string;
}

export interface WorkflowNode {
  id: string;
  type: string;
  category?: string;
  title: string;
  config?: Record<string, unknown>;
}

export interface WorkflowEdge {
  id?: string;
  from: string;
  to: string;
  condition?: "true" | "false" | "default" | null;
}

export function resolveVariables(template: string, ctx: ExecutionContext): string {
  if (!template || typeof template !== "string") return template || "";

  const map: Record<string, unknown> = {
    "{{email.from.name}}": ctx.email?.from?.split("<")[0]?.trim() || ctx.email?.from || "Friend",
    "{{email.from.address}}": ctx.email?.from?.match(/<([^>]+)>/)?.[1] || ctx.email?.from || "",
    "{{email.subject}}": ctx.email?.subject || "",
    "{{email.text}}": ctx.email?.text || "",
    "{{email.id}}": ctx.email?.id || "",
    "{{date.now}}": new Date().toLocaleString(),
    ...ctx.variables,
  };

  return template.replace(/\{\{[^}]+\}\}/g, (token) => {
    if (!Object.prototype.hasOwnProperty.call(map, token)) return token;
    const value = map[token];
    return value !== undefined && value !== null ? String(value) : "";
  });
}

export function matchesTrigger(
  auto: { nodes?: unknown },
  email: { from?: string; subject?: string } | undefined,
): boolean {
  if (!email) return true;
  const nodes = Array.isArray(auto.nodes) ? auto.nodes as WorkflowNode[] : [];
  const trigger = nodes.find((node) => node.category === "trigger") || nodes[0];
  if (!trigger?.config) return true;

  const { filterFrom, filterSubject } = trigger.config;
  if (typeof filterFrom === "string" && filterFrom.trim()) {
    const from = (email.from || "").toLowerCase();
    const senders = filterFrom.toLowerCase().split(",").map((value) => value.trim()).filter(Boolean);
    if (senders.length && !senders.some((sender) => from.includes(sender))) return false;
  }
  if (typeof filterSubject === "string" && filterSubject.trim()) {
    const subject = (email.subject || "").toLowerCase();
    const keywords = filterSubject.toLowerCase().split(",").map((value) => value.trim()).filter(Boolean);
    if (keywords.length && !keywords.some((keyword) => subject.includes(keyword))) return false;
  }
  return true;
}
