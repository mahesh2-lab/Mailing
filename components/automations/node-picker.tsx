"use client";

import { useState } from "react";
import {
  Bot,
  Calendar,
  Clock,
  Code,
  CornerUpLeft,
  FileCheck,
  FileText,
  Filter,
  Forward,
  GitBranch,
  Globe,
  Inbox,
  Mail,
  Plus,
  RefreshCw,
  Search,
  Send,
  Sparkles,
  Star,
  Tag,
  Wrench,
  Zap,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CustomTool, NodeCategory, NodeType } from "./automation-types";

interface NodeItemDef {
  type: NodeType;
  category: NodeCategory;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  customToolId?: string;
}

const PREDEFINED_NODE_ITEMS: NodeItemDef[] = [
  // TRIGGERS
  {
    type: "trigger_email_received",
    category: "trigger",
    title: "Email received",
    description: "Triggers when a new email arrives in inbox",
    icon: Inbox,
  },
  {
    type: "trigger_email_sent",
    category: "trigger",
    title: "Email sent",
    description: "Triggers when you send an email",
    icon: Send,
  },
  {
    type: "trigger_email_replied",
    category: "trigger",
    title: "Email replied",
    description: "Triggers when a recipient replies to a thread",
    icon: CornerUpLeft,
  },
  {
    type: "trigger_schedule",
    category: "trigger",
    title: "Schedule (Cron)",
    description: "Runs periodically or at a specific time",
    icon: Calendar,
  },
  {
    type: "trigger_webhook",
    category: "trigger",
    title: "Webhook trigger",
    description: "Triggers on inbound HTTP POST request",
    icon: Globe,
  },

  // LOGIC
  {
    type: "logic_if_else",
    category: "logic",
    title: "If / Else branch",
    description: "Split workflow based on conditions",
    icon: GitBranch,
  },
  {
    type: "logic_filter",
    category: "logic",
    title: "Filter condition",
    description: "Only continue if conditions match",
    icon: Filter,
  },
  {
    type: "logic_delay",
    category: "logic",
    title: "Delay timer",
    description: "Pause execution for minutes or days",
    icon: Clock,
  },
  {
    type: "logic_loop",
    category: "logic",
    title: "Loop (For each)",
    description: "Iterate over attachments or items",
    icon: RefreshCw,
  },

  // AI
  {
    type: "ai_classify",
    category: "ai",
    title: "AI Classify",
    description: "Categorize email intent or topic",
    icon: Sparkles,
  },
  {
    type: "ai_generate",
    category: "ai",
    title: "AI Generate reply",
    description: "Draft an intelligent contextual reply",
    icon: Bot,
  },
  {
    type: "ai_extract",
    category: "ai",
    title: "AI Extract data",
    description: "Parse structured fields or invoices into JSON",
    icon: FileCheck,
  },
  {
    type: "ai_summarize",
    category: "ai",
    title: "AI Summarize",
    description: "Generate concise summary of the thread",
    icon: FileText,
  },
  {
    type: "ai_decision",
    category: "ai",
    title: "AI Decision router",
    description: "Let AI choose next optimal step",
    icon: Sparkles,
  },

  // EMAIL
  {
    type: "email_send",
    category: "email",
    title: "Send email",
    description: "Compose and dispatch a new email",
    icon: Mail,
  },
  {
    type: "email_reply",
    category: "email",
    title: "Reply to thread",
    description: "Send reply in the same thread",
    icon: CornerUpLeft,
  },
  {
    type: "email_forward",
    category: "email",
    title: "Forward email",
    description: "Forward message to another address",
    icon: Forward,
  },
  {
    type: "email_add_label",
    category: "email",
    title: "Add label",
    description: "Attach tag or folder to email",
    icon: Tag,
  },
  {
    type: "email_archive",
    category: "email",
    title: "Archive thread",
    description: "Move out of inbox to Archive",
    icon: Inbox,
  },
  {
    type: "email_star",
    category: "email",
    title: "Star thread",
    description: "Mark conversation as starred priority",
    icon: Star,
  },

  // TOOLS
  {
    type: "tool_http_request",
    category: "tool",
    title: "HTTP Request",
    description: "Send GET, POST, or PUT to any API",
    icon: Globe,
  },
  {
    type: "tool_webhook",
    category: "tool",
    title: "Outgoing Webhook",
    description: "POST payload to an external endpoint",
    icon: Code,
  },
];

const CATEGORY_LABELS: Record<NodeCategory, string> = {
  trigger: "TRIGGERS",
  logic: "LOGIC",
  ai: "AI ACTIONS",
  email: "EMAIL ACTIONS",
  tool: "TOOLS & INTEGRATIONS",
};

interface NodePickerProps {
  onSelectNode: (item: {
    type: NodeType;
    category: NodeCategory;
    title: string;
    description: string;
    customTool?: CustomTool;
  }) => void;
  customTools: CustomTool[];
  onOpenCreateTool: () => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  defaultTab?: "actions" | "triggers";
}

export function NodePicker({
  onSelectNode,
  customTools,
  onOpenCreateTool,
  isCollapsed = false,
  onToggleCollapse,
  defaultTab = "actions",
}: NodePickerProps) {
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<"actions" | "triggers">(defaultTab);

  const allItems: NodeItemDef[] = [
    ...PREDEFINED_NODE_ITEMS,
    ...customTools.map((ct) => ({
      type: "tool_custom" as NodeType,
      category: "tool" as NodeCategory,
      title: ct.name,
      description: ct.description || `${ct.method} ${ct.url}`,
      icon: Wrench,
      customToolId: ct.id,
    })),
  ];

  // Filter based on active tab: Triggers tab shows only triggers; Actions tab shows logic, ai, email, and tools
  const tabItems = allItems.filter((item) =>
    activeTab === "triggers" ? item.category === "trigger" : item.category !== "trigger"
  );

  const filtered = tabItems.filter(
    (item) =>
      item.title.toLowerCase().includes(search.toLowerCase()) ||
      item.description.toLowerCase().includes(search.toLowerCase()) ||
      item.category.toLowerCase().includes(search.toLowerCase())
  );

  const actionCategories: NodeCategory[] = ["ai", "email", "logic", "tool"];
  const triggerCategories: NodeCategory[] = ["trigger"];
  const displayCategories = activeTab === "triggers" ? triggerCategories : actionCategories;

  if (isCollapsed) {
    return (
      <div className="w-12 border-r border-border bg-card/40 flex flex-col items-center py-3 select-none shrink-0 transition-all">
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          onClick={onToggleCollapse}
          className="size-8 text-muted-foreground hover:text-foreground"
          title="Expand Workflow Steps panel"
        >
          <Plus className="size-4" />
        </Button>
        <div className="mt-4 flex flex-col items-center gap-2">
          <span className="text-[10px] font-semibold tracking-widest text-muted-foreground uppercase [writing-mode:vertical-lr] rotate-180">
            Workflow Steps
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="w-72 border-r border-border bg-card/20 flex flex-col h-full select-none shrink-0 transition-all">
      {/* Header & Search */}
      <div className="p-3 border-b border-border space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold uppercase tracking-wider text-foreground">
              Workflow Steps
            </span>
          </div>
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="xs"
              onClick={onOpenCreateTool}
              className="h-6 text-[10px] gap-1 px-1.5 text-muted-foreground hover:text-foreground"
              title="Create Custom HTTP Tool"
            >
              <Plus className="size-3" /> Custom Tool
            </Button>
            {onToggleCollapse && (
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                onClick={onToggleCollapse}
                className="size-6 text-muted-foreground hover:text-foreground"
                title="Collapse sidebar"
              >
                <span className="text-xs">‹</span>
              </Button>
            )}
          </div>
        </div>

        {/* Clear Tab Segment: Actions (steps) vs Triggers (root) */}
        <div className="grid grid-cols-2 gap-1 p-0.5 rounded-lg bg-muted/70 border border-border/60 text-xs font-medium">
          <button
            type="button"
            onClick={() => setActiveTab("actions")}
            className={`py-1.5 rounded-md transition-all cursor-pointer text-center text-xs font-medium ${
              activeTab === "actions"
                ? "bg-background text-foreground shadow-2xs font-semibold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Actions
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("triggers")}
            className={`py-1.5 rounded-md transition-all cursor-pointer text-center text-xs font-medium ${
              activeTab === "triggers"
                ? "bg-background text-foreground shadow-2xs font-semibold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Triggers
          </button>
        </div>

        <div className="relative">
          <Search className="size-3.5 absolute left-2.5 top-2.5 text-muted-foreground pointer-events-none" />
          <Input
            placeholder={activeTab === "actions" ? "Search actions, AI, logic..." : "Search triggers..."}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 text-xs pl-8 rounded-lg bg-background/80"
          />
        </div>
      </div>

      {/* Node categories list */}
      <div className="flex-1 overflow-y-auto p-2 space-y-4">
        {displayCategories.map((cat) => {
          const catItems = filtered.filter((i) => i.category === cat);
          if (catItems.length === 0) return null;

          return (
            <div key={cat} className="space-y-1">
              <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-2 py-0.5">
                {CATEGORY_LABELS[cat]}
              </div>

              <div className="space-y-1">
                {catItems.map((item, idx) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={`${item.type}-${idx}`}
                      type="button"
                      onClick={() => {
                        const ct = item.customToolId
                          ? customTools.find((t) => t.id === item.customToolId)
                          : undefined;
                        onSelectNode({
                          type: item.type,
                          category: item.category,
                          title: item.title,
                          description: item.description,
                          customTool: ct,
                        });
                      }}
                      className="w-full text-left p-2 rounded-md hover:bg-accent hover:text-foreground transition-all flex items-start gap-2.5 group cursor-pointer border border-transparent hover:border-border/60"
                    >
                      <div className="size-6 rounded bg-muted grid place-items-center shrink-0 mt-0.5 text-muted-foreground group-hover:text-foreground group-hover:bg-background transition-colors shadow-xs">
                        <Icon className="size-3.5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium text-foreground truncate">
                          {item.title}
                        </div>
                        <div className="text-[11px] text-muted-foreground truncate leading-tight mt-0.5">
                          {item.description}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div className="text-center py-8 text-xs text-muted-foreground">
            {activeTab === "triggers" ? "No matching triggers found." : "No matching actions found."}
          </div>
        )}
      </div>
    </div>
  );
}
