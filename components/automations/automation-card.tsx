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
  Cpu,
  GitBranch,
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
  ai: Cpu,
  email: Mail,
  tool: Wrench,
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
      className="p-4 rounded-xl border border-border bg-card/60 hover:bg-card hover:border-foreground/20 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 cursor-pointer group space-y-4"
    >
      {/* Top Header: Title, Enable/Disable, Action menu */}
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1.5 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm font-semibold text-foreground group-hover:text-brand transition-colors truncate">
              {automation.name}
            </h3>

            {/* Enabled / Paused status pill */}
            <span
              className={`inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-0.5 rounded-full border transition-colors shadow-xs ${
                automation.enabled
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                  : "bg-muted text-muted-foreground border-border"
              }`}
            >
              <span className="relative flex h-2 w-2">
                {automation.enabled && (
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                )}
                <span
                  className={`relative inline-flex rounded-full h-2 w-2 ${
                    automation.enabled ? "bg-emerald-500" : "bg-muted-foreground"
                  }`}
                ></span>
              </span>
              {automation.enabled ? "Active" : "Paused"}
            </span>
          </div>

          <p className="text-xs text-muted-foreground line-clamp-1">
            {automation.description || "No description provided."}
          </p>
        </div>

        {/* Right side controls */}
        <div
          className="flex items-center gap-1.5 shrink-0 opacity-80 group-hover:opacity-100 transition-opacity"
          onClick={(e) => e.stopPropagation()}
        >
          <Button
            type="button"
            variant="outline"
            size="xs"
            onClick={() => onToggleEnabled(automation.id, !automation.enabled)}
            className="h-7 text-xs px-2 shadow-xs"
          >
            {automation.enabled ? "Pause" : "Enable"}
          </Button>

          <Button
            type="button"
            variant="outline"
            size="xs"
            onClick={() => onTestRun(automation)}
            className="h-7 text-xs px-2 gap-1 text-muted-foreground hover:text-foreground shadow-xs"
            title="Run test execution"
          >
            <Play className="size-3 text-brand" /> Test
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <button
                  type="button"
                  className="size-7 rounded-md grid place-items-center border border-transparent text-muted-foreground hover:text-foreground hover:bg-muted hover:border-border transition-all cursor-pointer"
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
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="size-3.5 mr-2" /> Delete automation
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Workflow Nodes Pipeline Breadcrumb */}
      <div className="p-2.5 bg-background/50 rounded-lg border border-border/60 flex items-center gap-2 flex-wrap text-xs text-foreground/80 font-mono text-[11px] shadow-inner">
        {automation.nodes.map((n, idx) => {
          const Icon = CategoryIcon[n.category] || Zap;
          return (
            <div key={n.id} className="flex items-center gap-2">
              <span className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-card border border-border/80 text-foreground font-sans font-medium text-xs shadow-xs transition-colors group-hover:border-border">
                <Icon className="size-3.5 text-muted-foreground group-hover:text-brand transition-colors" />
                {n.title}
              </span>
              {idx < automation.nodes.length - 1 && (
                <ArrowRight className="size-3.5 text-muted-foreground/40 shrink-0" />
              )}
            </div>
          );
        })}
      </div>

      {/* Metadata / Run Stats footer */}
      <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <Clock className="size-3" />
            Last run:{" "}
            <strong className="text-foreground/80">
              {automation.lastRunAt
                ? new Date(automation.lastRunAt).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : "Never"}
            </strong>
          </span>
          <span>·</span>
          <span>{automation.runCount} total runs</span>
          <span>·</span>
          <span>{automation.successRate}% success</span>
        </div>

        <span className="text-[10px] text-brand hover:underline font-medium flex items-center gap-1">
          Open builder <ArrowRight className="size-2.5" />
        </span>
      </div>
    </div>
  );
}
