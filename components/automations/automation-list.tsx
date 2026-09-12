"use client";

import { useState } from "react";
import {
  Plus,
  Search,
  Sparkles,
  History,
  Zap,
  CheckCircle2,
  XCircle,
  Clock,
  ChevronRight,
  Mail,
  ArrowRight,
  Activity,
  SlidersHorizontal,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Automation,
  ExecutionRun,
  WorkflowEdge,
  WorkflowNode,
} from "./automation-types";
import { AutomationCard } from "./automation-card";

export interface StarterTemplate {
  name: string;
  description: string;
  icon: React.ElementType;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
}

const STARTER_TEMPLATES: StarterTemplate[] = [
  {
    name: "Auto-Reply to Inquiries",
    description: "Instantly acknowledge incoming emails matching subject keywords.",
    icon: Mail,
    nodes: [
      {
        id: "root-1",
        type: "trigger_email_received",
        category: "trigger",
        title: "Email Received",
        description: "Subject contains 'Inquiry'",
        config: { filterSubject: "Inquiry" },
        position: { x: 200, y: 100 },
      },
      {
        id: "reply-1",
        type: "email_reply",
        category: "email",
        title: "Send Acknowledgment",
        description: "Reply to sender",
        config: {
          recipient: "{{email.from.address}}",
          template: "Thank you for reaching out! We received your message and will respond shortly.",
        },
        position: { x: 520, y: 100 },
      },
    ],
    edges: [{ id: "e-1", from: "root-1", to: "reply-1" }],
  },
  {
    name: "AI Lead Classifier & Tag",
    description: "Use Gemini AI to analyze intent and label high-value leads automatically.",
    icon: Sparkles,
    nodes: [
      {
        id: "root-2",
        type: "trigger_email_received",
        category: "trigger",
        title: "Email Received",
        description: "Any incoming email",
        config: {},
        position: { x: 200, y: 100 },
      },
      {
        id: "ai-2",
        type: "ai_classify",
        category: "ai",
        title: "Classify Intent",
        description: "Sales, Support, Billing",
        config: { categories: ["Sales Lead", "Support", "Billing", "Newsletter"] },
        position: { x: 520, y: 100 },
      },
      {
        id: "tag-2",
        type: "email_add_label",
        category: "email",
        title: "Tag VIP Lead",
        description: "Apply 'VIP Lead' label",
        config: { label: "VIP Lead" },
        position: { x: 840, y: 100 },
      },
    ],
    edges: [
      { id: "e-2a", from: "root-2", to: "ai-2" },
      { id: "e-2b", from: "ai-2", to: "tag-2" },
    ],
  },
  {
    name: "Invoice & Receipt Router",
    description: "Detect invoices or receipts and extract financial summaries.",
    icon: Zap,
    nodes: [
      {
        id: "root-3",
        type: "trigger_email_received",
        category: "trigger",
        title: "Email Received",
        description: "Subject contains 'Invoice'",
        config: { filterSubject: "Invoice" },
        position: { x: 200, y: 100 },
      },
      {
        id: "ai-3",
        type: "ai_summarize",
        category: "ai",
        title: "Extract Summary",
        description: "Summarize invoice contents",
        config: {},
        position: { x: 520, y: 100 },
      },
      {
        id: "tag-3",
        type: "email_add_label",
        category: "email",
        title: "Label Finance",
        description: "Tag with Finance label",
        config: { label: "Finance" },
        position: { x: 840, y: 100 },
      },
    ],
    edges: [
      { id: "e-3a", from: "root-3", to: "ai-3" },
      { id: "e-3b", from: "ai-3", to: "tag-3" },
    ],
  },
];

function formatRelativeTime(dateStr?: string) {
  if (!dateStr) return "Never";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

interface AutomationListProps {
  automations: Automation[];
  history?: ExecutionRun[];
  onCreateNew: () => void;
  onCreateFromTemplate?: (template: StarterTemplate) => void;
  onOpenHistory: () => void;
  onEdit: (automation: Automation) => void;
  onToggleEnabled: (id: string, enabled: boolean) => void;
  onDuplicate: (automation: Automation) => void;
  onDelete: (id: string) => void;
  onTestRun: (automation: Automation) => void;
  onViewHistoryForAutomation: (automationId: string) => void;
}

export function AutomationList({
  automations,
  history = [],
  onCreateNew,
  onCreateFromTemplate,
  onOpenHistory,
  onEdit,
  onToggleEnabled,
  onDuplicate,
  onDelete,
  onTestRun,
  onViewHistoryForAutomation,
}: AutomationListProps) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "paused">("all");

  const filtered = automations.filter((a) => {
    const matchesSearch =
      a.name.toLowerCase().includes(search.toLowerCase()) ||
      a.description.toLowerCase().includes(search.toLowerCase());

    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "active" && a.enabled) ||
      (statusFilter === "paused" && !a.enabled);

    return matchesSearch && matchesStatus;
  });

  const activeCount = automations.filter((a) => a.enabled).length;
  const pausedCount = automations.length - activeCount;
  const totalRuns = automations.reduce((acc, a) => acc + (a.runCount || 0), 0);
  const avgSuccess =
    automations.length > 0
      ? Math.round(
          automations.reduce((acc, a) => acc + (a.successRate || 100), 0) /
            automations.length
        )
      : 100;
  const recentRuns = history.slice(0, 4);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
      {/* Main Left Column: Workflows List (8 Cols) */}
      <div className="lg:col-span-8 space-y-4">
        {/* Search & Status Filters */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pb-1">
          <div className="relative w-full sm:w-80 group">
            <Search className="size-3.5 absolute left-3 top-3 text-muted-foreground group-focus-within:text-foreground transition-colors pointer-events-none" />
            <Input
              placeholder="Search workflows..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 text-xs pl-9 bg-card border-border focus:border-primary transition-all rounded-md shadow-2xs"
            />
          </div>

          <div className="flex items-center gap-1 self-start sm:self-auto bg-muted/60 p-1 rounded-lg border border-border">
            <Button
              type="button"
              variant={statusFilter === "all" ? "secondary" : "ghost"}
              size="xs"
              onClick={() => setStatusFilter("all")}
              className={`h-7 text-xs rounded-md transition-all ${
                statusFilter === "all"
                  ? "bg-background shadow-xs font-medium text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              All ({automations.length})
            </Button>
            <Button
              type="button"
              variant={statusFilter === "active" ? "secondary" : "ghost"}
              size="xs"
              onClick={() => setStatusFilter("active")}
              className={`h-7 text-xs rounded-md transition-all ${
                statusFilter === "active"
                  ? "bg-background shadow-xs font-medium text-emerald-600 dark:text-emerald-400"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Active ({activeCount})
            </Button>
            <Button
              type="button"
              variant={statusFilter === "paused" ? "secondary" : "ghost"}
              size="xs"
              onClick={() => setStatusFilter("paused")}
              className={`h-7 text-xs rounded-md transition-all ${
                statusFilter === "paused"
                  ? "bg-background shadow-xs font-medium text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Paused ({pausedCount})
            </Button>
          </div>
        </div>

        {/* Workflows Cards */}
        <div className="space-y-3">
          {filtered.map((auto) => (
            <AutomationCard
              key={auto.id}
              automation={auto}
              onEdit={onEdit}
              onToggleEnabled={onToggleEnabled}
              onDuplicate={onDuplicate}
              onDelete={onDelete}
              onTestRun={onTestRun}
              onViewHistory={onViewHistoryForAutomation}
            />
          ))}

          {filtered.length === 0 && (
            <div className="rounded-xl border border-border bg-card text-center py-12 px-4 space-y-3 shadow-xs">
              <div className="size-10 rounded-full bg-muted grid place-items-center mx-auto text-muted-foreground">
                <Zap className="size-5" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-foreground">
                  {search ? "No matching workflows" : "No automations configured"}
                </h3>
                <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                  {search
                    ? `No workflows found matching "${search}". Try clearing your search or status filter.`
                    : "Create your first automated email rule or choose one of the starter templates on the right."}
                </p>
              </div>
              <div className="pt-2">
                <Button
                  type="button"
                  onClick={onCreateNew}
                  size="sm"
                  className="text-xs font-semibold"
                >
                  <Plus className="size-3.5 mr-1" /> Create Workflow
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Right Column: Engine Stats, Templates & Activity (4 Cols) */}
      <div className="lg:col-span-4 space-y-6">
        {/* Panel 1: Engine Status & Key Metrics */}
        <div className="rounded-xl border border-border bg-card p-4 space-y-4 shadow-xs">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-foreground">Engine Status</h2>
              <p className="text-xs text-muted-foreground">Resend webhook & worker health</p>
            </div>
            <span className="flex items-center gap-1.5 text-[11px] text-emerald-600 dark:text-emerald-400 font-medium bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
              <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Online
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2.5 pt-1">
            <div className="p-3 rounded-lg bg-muted/40 border border-border/60">
              <div className="text-[11px] text-muted-foreground">Active Rules</div>
              <div className="text-lg font-bold text-foreground mt-0.5">{activeCount}</div>
            </div>
            <div className="p-3 rounded-lg bg-muted/40 border border-border/60">
              <div className="text-[11px] text-muted-foreground">Total Executions</div>
              <div className="text-lg font-bold text-foreground mt-0.5">{totalRuns}</div>
            </div>
            <div className="p-3 rounded-lg bg-muted/40 border border-border/60">
              <div className="text-[11px] text-muted-foreground">Success Rate</div>
              <div className="text-lg font-bold text-foreground mt-0.5">{avgSuccess}%</div>
            </div>
            <div className="p-3 rounded-lg bg-muted/40 border border-border/60">
              <div className="text-[11px] text-muted-foreground">Queue Worker</div>
              <div className="text-xs font-semibold text-foreground mt-1.5 flex items-center gap-1">
                <Activity className="size-3 text-brand" /> Active
              </div>
            </div>
          </div>
        </div>

        {/* Panel 2: Quick Starter Templates */}
        <div className="rounded-xl border border-border bg-card p-4 space-y-3 shadow-xs">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-foreground">Quick Templates</h2>
              <p className="text-xs text-muted-foreground">Click to instantiate pre-built logic.</p>
            </div>
            <Sparkles className="size-4 text-primary" />
          </div>

          <div className="space-y-2 pt-1">
            {STARTER_TEMPLATES.map((tpl) => (
              <button
                key={tpl.name}
                type="button"
                onClick={() => onCreateFromTemplate?.(tpl)}
                className="w-full text-left p-3 rounded-lg border border-border hover:border-foreground/30 bg-background hover:bg-muted/40 transition-all group flex items-start justify-between gap-3 cursor-pointer"
              >
                <div className="space-y-0.5 min-w-0">
                  <div className="text-xs font-semibold text-foreground group-hover:text-primary transition-colors flex items-center gap-1.5">
                    <tpl.icon className="size-3.5 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
                    <span className="truncate">{tpl.name}</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">
                    {tpl.description}
                  </p>
                </div>
                <ChevronRight className="size-3.5 text-muted-foreground/50 group-hover:text-foreground shrink-0 mt-0.5 transition-colors" />
              </button>
            ))}
          </div>
        </div>

        {/* Panel 3: Recent Executions Feed */}
        <div className="rounded-xl border border-border bg-card p-4 space-y-3 shadow-xs">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-foreground">Recent Activity</h2>
              <p className="text-xs text-muted-foreground">Latest execution audit traces.</p>
            </div>
            <History className="size-4 text-muted-foreground" />
          </div>

          <div className="space-y-2 pt-1">
            {recentRuns.length === 0 ? (
              <div className="text-xs text-muted-foreground py-4 text-center">
                No recent executions yet.
              </div>
            ) : (
              recentRuns.map((run) => (
                <div
                  key={run.id}
                  className="p-2 rounded-md border border-border/60 bg-muted/20 flex items-center justify-between text-xs gap-2"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {run.status === "success" ? (
                      <CheckCircle2 className="size-3.5 text-emerald-500 shrink-0" />
                    ) : (
                      <XCircle className="size-3.5 text-rose-500 shrink-0" />
                    )}
                    <span className="font-medium text-foreground truncate max-w-40">
                      {run.automationName}
                    </span>
                  </div>
                  <span className="text-[10px] text-muted-foreground shrink-0">
                    {formatRelativeTime(run.startedAt)}
                  </span>
                </div>
              ))
            )}

            <button
              type="button"
              onClick={onOpenHistory}
              className="text-button text-xs w-full justify-between pt-2 text-muted-foreground hover:text-foreground"
            >
              <span>View full history audit</span>
              <ArrowRight className="size-3" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

