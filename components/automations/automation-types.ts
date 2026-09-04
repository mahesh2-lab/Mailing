export type NodeCategory = "trigger" | "logic" | "ai" | "email" | "tool";

export type NodeType =
  // Triggers
  | "trigger_email_received"
  | "trigger_email_sent"
  | "trigger_email_replied"
  | "trigger_schedule"
  | "trigger_webhook"
  // Logic
  | "logic_if_else"
  | "logic_filter"
  | "logic_delay"
  | "logic_loop"
  // AI
  | "ai_classify"
  | "ai_generate"
  | "ai_extract"
  | "ai_summarize"
  | "ai_decision"
  // Email
  | "email_send"
  | "email_reply"
  | "email_forward"
  | "email_add_label"
  | "email_archive"
  | "email_star"
  // Tools
  | "tool_http_request"
  | "tool_webhook"
  | "tool_custom";

export interface WorkflowNodeConfig {
  [key: string]: any;
}

export interface WorkflowNode {
  id: string;
  type: NodeType;
  category: NodeCategory;
  title: string;
  description?: string;
  config: WorkflowNodeConfig;
  position: { x: number; y: number };
  branch?: "main" | "true" | "false";
}

export interface WorkflowEdge {
  id: string;
  from: string;
  to: string;
  label?: string;
  condition?: "true" | "false" | "default";
}

export interface CustomTool {
  id: string;
  name: string;
  description: string;
  method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  url: string;
  authType: "none" | "bearer" | "basic" | "header";
  authValue?: string;
  headers: { key: string; value: string }[];
  bodyTemplate?: string;
  inputSchema?: string;
  createdAt: string;
}

export interface StepExecutionResult {
  nodeId: string;
  nodeTitle: string;
  nodeType: NodeType;
  status: "success" | "failed" | "skipped";
  durationMs: number;
  input: Record<string, any>;
  output?: Record<string, any>;
  error?: string;
  logs?: string[];
}

export interface ExecutionRun {
  id: string;
  automationId: string;
  automationName: string;
  status: "success" | "failed" | "running";
  triggerSource: string;
  startedAt: string;
  durationMs: number;
  steps: StepExecutionResult[];
  logs?: string[];
  error?: string;
}

export interface Automation {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  createdAt: string;
  updatedAt: string;
  lastRunAt?: string;
  runCount: number;
  successRate: number;
}

export const WORKFLOW_VARIABLES = [
  { key: "{{email.from.name}}", label: "Sender Name", category: "Email" },
  { key: "{{email.from.address}}", label: "Sender Email", category: "Email" },
  { key: "{{email.subject}}", label: "Subject", category: "Email" },
  { key: "{{email.text}}", label: "Message Body (Text)", category: "Email" },
  { key: "{{email.threadId}}", label: "Thread ID", category: "Email" },
  { key: "{{email.labels}}", label: "Email Labels", category: "Email" },
  { key: "{{ai.category}}", label: "AI Classification Result", category: "AI" },
  { key: "{{ai.reply}}", label: "AI Drafted Reply", category: "AI" },
  { key: "{{ai.summary}}", label: "AI Summary", category: "AI" },
  { key: "{{ai.extracted}}", label: "AI Extracted Data (JSON)", category: "AI" },
  { key: "{{tool.response}}", label: "HTTP Tool Response", category: "Tool" },
  { key: "{{date.now}}", label: "Current Timestamp", category: "System" },
] as const;

export const DEFAULT_AUTOMATIONS: Automation[] = [];
export const DEFAULT_CUSTOM_TOOLS: CustomTool[] = [];
export const MOCK_EXECUTION_HISTORY: ExecutionRun[] = [];

