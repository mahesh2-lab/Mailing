"use client";

import {
  ArrowRight,
  Clock,
  Copy,
  Edit,
  History,
  MoreHorizontal,
  Play,
  Trash2,
  Zap,
  Mail,
  Wrench,
  Sparkles,
  GitBranch,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Automation, NodeCategory } from "./automation-types";

interface AutomationCardProps {
  automation: Automation;
  onEdit: (automation: Automation) => void;
  onToggleEnabled: (id: string, enabled: boolean) => void;
  onDuplicate: (automation: Automation) => void;
  onDelete: (id: string) => void;
  onTestRun: (automation: Automation) => void;
  onViewHistory: (automationId: string) => void;
}

const CategoryIcon: Record<NodeCategory, React.ElementType> = {
  trigger: Zap,
  logic: GitBranch,
  ai: Sparkles,
  email: Mail,
  tool: Wrench,
};

const CATEGORY_STYLES: Record<
  NodeCategory,
  { bg: string; border: string; text: string }
> = {
  trigger: {
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/30",
    text: "text-emerald-600 dark:text-emerald-400",
  },
  logic: {
    bg: "bg-amber-500/10",
    border: "border-amber-500/30",
    text: "text-amber-600 dark:text-amber-400",
  },
  ai: {
    bg: "bg-violet-500/10",
    border: "border-violet-500/30",
    text: "text-violet-600 dark:text-violet-400",
  },
  email: {
    bg: "bg-blue-500/10",
    border: "border-blue-500/30",
    text: "text-blue-600 dark:text-blue-400",
  },
  tool: {
    bg: "bg-cyan-500/10",
    border: "border-cyan-500/30",
    text: "text-cyan-600 dark:text-cyan-400",
  },
};

export function AutomationCard({
  automation,
  onEdit,
  onToggleEnabled,
  onDuplicate,
  onDelete,
  onTestRun,
  onViewHistory,
}: AutomationCardProps) {
  return (
    <div
      onClick={() => onEdit(automation)}
      className="p-5 rounded-xl border border-border bg-card hover:border-foreground/25 hover:shadow-xs transition-all duration-200 cursor-pointer group space-y-4"
    >
      {/* Top Header: Title, Status, Native Toggle, and Actions */}
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1 min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm font-semibold text-foreground group-hover:text-brand transition-colors wrap-break-word">
              {automation.name}
            </h3>

            {/* Status Pill */}
            <span
              className={`inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-0.5 rounded-full border transition-colors shrink-0 ${
                automation.enabled
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                  : "bg-muted text-muted-foreground border-border"
              }`}
            >
              <span
                className={`size-1.5 rounded-full ${
                  automation.enabled ? "bg-emerald-500" : "bg-muted-foreground/60"
                }`}
              />
              {automation.enabled ? "Active" : "Paused"}
            </span>
          </div>

          <p className="text-xs text-muted-foreground line-clamp-2">
            {automation.description || "Triggered on inbound message"}
          </p>
        </div>

        {/* Right side controls */}
        <div
          className="flex items-center gap-2 shrink-0"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Toggle Switch */}
          <button
            type="button"
            role="switch"
            aria-checked={automation.enabled}
            className={cn(
              "relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              automation.enabled ? "bg-primary" : "bg-muted"
            )}
            onClick={() => onToggleEnabled(automation.id, !automation.enabled)}
            title={automation.enabled ? "Pause workflow" : "Activate workflow"}
            aria-label="Toggle workflow status"
          >
            <span
              className={cn(
                "pointer-events-none block size-4 rounded-full bg-background shadow-lg ring-0 transition-transform",
                automation.enabled ? "translate-x-4" : "translate-x-0"
              )}
            />
          </button>

          {/* Test & Edit Action buttons */}
          <div className="hidden sm:flex items-center gap-1.5">
            <Button
              type="button"
              variant="outline"
              size="xs"
              onClick={() => onTestRun(automation)}
              className="text-xs h-7 gap-1"
              title="Run test execution"
            >
              <Play className="size-3 text-primary fill-primary" />
              <span>Test</span>
            </Button>

            <Button
              type="button"
              variant="outline"
              size="xs"
              onClick={() => onEdit(automation)}
              className="text-xs h-7 gap-1"
            >
              <Edit className="size-3" />
              <span>Edit</span>
            </Button>
          </div>

          {/* Action Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-xs"
                  className="size-7 text-muted-foreground hover:text-foreground"
                  aria-label="More options"
                />
              }
            >
              <MoreHorizontal className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40 text-xs p-1">
              <DropdownMenuItem onClick={() => onEdit(automation)}>
                <Edit className="size-3.5 mr-2" /> Edit workflow
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onDuplicate(automation)}>
                <Copy className="size-3.5 mr-2" /> Duplicate
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onViewHistory(automation.id)}>
                <History className="size-3.5 mr-2" /> View history
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => onDelete(automation.id)}
                className="text-destructive focus:text-destructive cursor-pointer"
              >
                <Trash2 className="size-3.5 mr-2" /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Workflow Step Pipeline Visualization */}
      <div className="p-2.5 bg-muted/30 rounded-lg border border-border/60 flex items-center gap-2 flex-wrap">
        {automation.nodes.map((n, idx) => {
          const Icon = CategoryIcon[n.category] || Zap;
          const style = CATEGORY_STYLES[n.category] || CATEGORY_STYLES.tool;
          return (
            <div key={n.id} className="flex items-center gap-2">
              <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs font-medium shadow-2xs ${style.bg} ${style.border} ${style.text}`}>
                <Icon className="size-3.5 shrink-0" />
                <span className="truncate max-w-44">{n.title}</span>
              </span>
              {idx < automation.nodes.length - 1 && (
                <ArrowRight className="size-3.5 text-muted-foreground/40 shrink-0" />
              )}
            </div>
          );
        })}
      </div>

      {/* Metadata Footer */}
      <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-0.5 border-t border-border/40">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <Clock className="size-3" />
            Last run:{" "}
            <span className="text-foreground font-medium">
              {automation.lastRunAt
                ? new Date(automation.lastRunAt).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : "Never"}
            </span>
          </span>
          <span>·</span>
          <span>{automation.runCount} {automation.runCount === 1 ? "run" : "runs"}</span>
          <span>·</span>
          <span>{automation.successRate}% success</span>
        </div>

        <span className="text-[11px] text-muted-foreground group-hover:text-foreground font-medium flex items-center gap-1 transition-colors">
          Open workflow <ArrowRight className="size-3" />
        </span>
      </div>
    </div>
  );
}
