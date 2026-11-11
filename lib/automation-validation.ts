import { z } from "zod";

const nodeTypes = [
  "trigger_email_received", "trigger_email_sent", "trigger_email_replied", "trigger_schedule", "trigger_webhook",
  "logic_if_else", "logic_filter", "logic_delay", "logic_loop",
  "ai_classify", "ai_generate", "ai_extract", "ai_summarize", "ai_decision",
  "email_send", "email_reply", "email_forward", "email_add_label", "email_archive", "email_star",
  "tool_http_request", "tool_webhook", "tool_custom",
] as const;

const nodeSchema = z.object({
  id: z.string().min(1).max(200),
  type: z.enum(nodeTypes),
  category: z.enum(["trigger", "logic", "ai", "email", "tool"]),
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  config: z.record(z.string(), z.unknown()),
  position: z.object({ x: z.number().finite(), y: z.number().finite() }),
  branch: z.enum(["main", "true", "false"]).optional(),
}).refine((node) => node.type.split("_")[0] === node.category, { message: "Node type and category must match" });

const edgeSchema = z.object({
  id: z.string().min(1).max(200),
  from: z.string().min(1).max(200),
  to: z.string().min(1).max(200),
  label: z.string().max(200).optional(),
  condition: z.enum(["true", "false", "default"]).optional(),
});

const workflowGraph = {
  nodes: z.array(nodeSchema).max(100),
  edges: z.array(edgeSchema).max(500),
};

export function validateWorkflowGraph(nodes: z.infer<typeof nodeSchema>[], edges: z.infer<typeof edgeSchema>[]) {
  const ids = new Set(nodes.map((node) => node.id));
  const edgeIds = new Set(edges.map((edge) => edge.id));
  return ids.size === nodes.length && edgeIds.size === edges.length &&
    edges.every((edge) => ids.has(edge.from) && ids.has(edge.to));
}

export const automationCreateInput = z.object({
  id: z.string().min(1).max(200).optional(),
  name: z.string().trim().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  enabled: z.boolean().optional(),
  ...workflowGraph,
}).superRefine((value, context) => {
  if (!validateWorkflowGraph(value.nodes ?? [], value.edges ?? [])) {
    context.addIssue({ code: "custom", path: ["edges"], message: "Workflow edges must reference unique node IDs" });
  }
});

export const automationUpdateInput = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  enabled: z.boolean().optional(),
  ...workflowGraph,
}).partial().refine((value) => Object.keys(value).length > 0)
  .superRefine((value, context) => {
    if (value.nodes && value.edges && !validateWorkflowGraph(value.nodes, value.edges)) {
      context.addIssue({ code: "custom", path: ["edges"], message: "Workflow edges must reference unique node IDs" });
    }
  });
