"use client";

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
  MoreHorizontal,
  Plus,
  RefreshCw,
  Send,
  Settings,
  Sparkles,
  Star,
  Tag,
  Trash2,
  Wrench,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { WorkflowNode, NodeCategory, NodeType } from "./automation-types";

interface WorkflowNodeComponentProps {
  node: WorkflowNode;
  selected: boolean;
  onSelect: (nodeId: string) => void;
  onDelete: (nodeId: string) => void;
  onAddChild?: (nodeId: string, condition?: "true" | "false") => void;
}

const CATEGORY_COLORS: Record<
  NodeCategory,
  { bg: string; border: string; text: string; badge: string }
> = {
  trigger: {
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/40",
    text: "text-emerald-600 dark:text-emerald-400",
    badge: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  },
  logic: {
    bg: "bg-amber-500/10",
    border: "border-amber-500/40",
    text: "text-amber-600 dark:text-amber-400",
    badge: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  },
  ai: {
    bg: "bg-violet-500/10",
    border: "border-violet-500/40",
    text: "text-violet-600 dark:text-violet-400",
    badge: "bg-violet-500/15 text-violet-600 dark:text-violet-400",
  },
  email: {
    bg: "bg-blue-500/10",
    border: "border-blue-500/40",
    text: "text-blue-600 dark:text-blue-400",
    badge: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
  },
  tool: {
    bg: "bg-cyan-500/10",
    border: "border-cyan-500/40",
    text: "text-cyan-600 dark:text-cyan-400",
    badge: "bg-cyan-500/15 text-cyan-600 dark:text-cyan-400",
  },
};

function getNodeIcon(type: NodeType) {
  if (type.startsWith("trigger_schedule")) return Calendar;
  if (type.startsWith("trigger_webhook")) return Globe;
  if (type.startsWith("trigger")) return Inbox;
  if (type === "logic_if_else") return GitBranch;
  if (type === "logic_filter") return Filter;
  if (type === "logic_delay") return Clock;
  if (type === "logic_loop") return RefreshCw;
  if (type === "ai_classify") return Sparkles;
  if (type === "ai_generate") return Bot;
  if (type === "ai_extract") return FileCheck;
  if (type === "ai_summarize") return FileText;
  if (type === "email_send") return Send;
  if (type === "email_reply") return CornerUpLeft;
  if (type === "email_forward") return Forward;
  if (type === "email_add_label") return Tag;
  if (type === "email_star") return Star;
  if (type === "tool_custom") return Wrench;
  return Code;
}

export function WorkflowNodeCard({
  node,
  selected,
  onSelect,
  onDelete,
  onAddChild,
}: WorkflowNodeComponentProps) {
  const colors = CATEGORY_COLORS[node.category] || CATEGORY_COLORS.tool;
  const Icon = getNodeIcon(node.type);

  // Generate a concise subtitle based on config
  let configSummary = node.description || "";
  if (node.type === "trigger_email_received" && node.config.filterSubject) {
    configSummary = `Subject contains "${node.config.filterSubject}"`;
  } else if (node.type === "ai_classify" && node.config.categories?.length) {
    configSummary = `Categories: ${node.config.categories.join(", ")}`;
  } else if (node.type === "logic_if_else" && node.config.variable) {
    configSummary = `${node.config.variable} ${node.config.operator || "=="} ${node.config.value || '""'}`;
  } else if (node.type === "tool_http_request" && node.config.url) {
    configSummary = `${node.config.method || "POST"} ${node.config.url}`;
  } else if (node.type === "email_add_label" && node.config.label) {
    configSummary = `Tag with "${node.config.label}"`;
  }

  return (
    <div
      onClick={(e) => {
        e.stopPropagation();
        onSelect(node.id);
      }}
      className={`relative w-full rounded-xl bg-card border text-card-foreground shadow-xs transition-all cursor-pointer group ${
        selected
          ? "ring-2 ring-brand border-brand shadow-md"
          : "hover:border-foreground/40 hover:shadow-xs border-border"
      }`}
    >
      {/* Top Header Row */}
      <div className="flex items-center justify-between p-3 pb-2 border-b border-border/60">
        <div className="flex items-center gap-2 min-w-0">
          <div className={`size-6 rounded-md grid place-items-center shrink-0 ${colors.bg} ${colors.text}`}>
            <Icon className="size-3.5" />
          </div>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground truncate">
            {node.category}
          </span>
        </div>

        <div className="flex items-center gap-1">
          {node.branch && (
            <Badge
              variant="outline"
              className={`text-[9px] px-1.5 py-0 h-4 font-mono font-medium rounded-full ${
                node.branch === "true"
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                  : "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30"
              }`}
            >
              {node.branch === "true" ? "Yes" : "No"}
            </Badge>
          )}

          {/* Explicit direct Delete button on the card */}
          {node.category !== "trigger" && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(node.id);
              }}
              className="size-6 rounded-md grid place-items-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
              title="Delete this step"
            >
              <Trash2 className="size-3.5" />
            </button>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <button
                  type="button"
                  onClick={(e) => e.stopPropagation()}
                  className="size-6 rounded-md grid place-items-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                  title="More options"
                />
              }
            >
              <MoreHorizontal className="size-3.5" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-36 text-xs p-1">
              <DropdownMenuItem onClick={() => onSelect(node.id)}>
                <Settings className="size-3.5 mr-2" /> Configure
              </DropdownMenuItem>
              {node.category !== "trigger" && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => onDelete(node.id)}
                    className="text-destructive focus:text-destructive cursor-pointer"
                  >
                    <Trash2 className="size-3.5 mr-2" /> Delete node
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Main Body */}
      <div className="p-2.5">
        <div className="text-xs font-semibold text-foreground truncate">{node.title}</div>
        <div className="text-[11px] text-muted-foreground truncate mt-0.5 leading-snug">
          {configSummary || "Click to configure parameters"}
        </div>
      </div>

      {/* Add Next Step Button at bottom */}
      {onAddChild && (
        <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-all duration-150 z-10 flex gap-1.5 shadow-xs">
          {node.type === "logic_if_else" ? (
            <>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onAddChild(node.id, "true");
                }}
                className="size-6 rounded-full bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm grid place-items-center text-[10px] font-bold cursor-pointer transition-transform hover:scale-110 active:scale-95"
                title="Add True branch step"
              >
                Y
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onAddChild(node.id, "false");
                }}
                className="size-6 rounded-full bg-rose-600 text-white hover:bg-rose-700 shadow-sm grid place-items-center text-[10px] font-bold cursor-pointer transition-transform hover:scale-110 active:scale-95"
                title="Add False branch step"
              >
                N
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onAddChild(node.id);
              }}
              className="size-6 rounded-full bg-brand text-brand-fg hover:opacity-90 shadow-sm grid place-items-center transition-transform hover:scale-110 active:scale-95 cursor-pointer"
              title="Add next step"
            >
              <Plus className="size-3.5" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
