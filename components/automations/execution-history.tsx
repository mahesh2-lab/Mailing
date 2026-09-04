"use client";

import { useState } from "react";
import {
  CheckCircle2,
  XCircle,
  Clock,
  Search,
  Filter,
  ArrowRight,
  RotateCcw,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ExecutionRun } from "./automation-types";
import { ExecutionDetails } from "./execution-details";
import { toast } from "sonner";

interface ExecutionHistoryProps {
  history: ExecutionRun[];
  onRetryRun?: (run: ExecutionRun) => void;
}

export function ExecutionHistory({
  history,
  onRetryRun,
}: ExecutionHistoryProps) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "success" | "failed">("all");
  const [selectedRun, setSelectedRun] = useState<ExecutionRun | null>(null);

  const filtered = history.filter((run) => {
    const matchesSearch =
      run.automationName.toLowerCase().includes(search.toLowerCase()) ||
      run.triggerSource.toLowerCase().includes(search.toLowerCase()) ||
      (run.error && run.error.toLowerCase().includes(search.toLowerCase()));

    const matchesStatus =
      statusFilter === "all" || run.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-4">
      {/* Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="size-3.5 absolute left-2.5 top-2.5 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Search executions by workflow or trigger..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 text-xs pl-8"
          />
        </div>

        <div className="flex items-center gap-1.5 self-start sm:self-auto">
          <Button
            type="button"
            variant={statusFilter === "all" ? "secondary" : "ghost"}
            size="xs"
            onClick={() => setStatusFilter("all")}
            className="h-7 text-xs"
          >
            All Runs ({history.length})
          </Button>
          <Button
            type="button"
            variant={statusFilter === "success" ? "secondary" : "ghost"}
            size="xs"
            onClick={() => setStatusFilter("success")}
            className="h-7 text-xs gap-1 text-emerald-600 dark:text-emerald-400"
          >
            <CheckCircle2 className="size-3" /> Successful (
            {history.filter((h) => h.status === "success").length})
          </Button>
          <Button
            type="button"
            variant={statusFilter === "failed" ? "secondary" : "ghost"}
            size="xs"
            onClick={() => setStatusFilter("failed")}
            className="h-7 text-xs gap-1 text-destructive"
          >
            <XCircle className="size-3" /> Failed (
            {history.filter((h) => h.status === "failed").length})
          </Button>
        </div>
      </div>

      {/* Execution List */}
      <div className="rounded-lg border border-border bg-card divide-y divide-border overflow-hidden">
        {filtered.map((run) => {
          const isSuccess = run.status === "success";
          const stepSummary = run.steps.map((s) => s.nodeTitle).join(" → ");

          return (
            <div
              key={run.id}
              onClick={() => setSelectedRun(run)}
              className="p-3.5 hover:bg-muted/40 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer group"
            >
              <div className="flex items-start sm:items-center gap-3 min-w-0">
                <div className="pt-0.5 sm:pt-0">
                  {isSuccess ? (
                    <CheckCircle2 className="size-4 text-emerald-500 shrink-0" />
                  ) : (
                    <XCircle className="size-4 text-destructive shrink-0" />
                  )}
                </div>

                <div className="min-w-0 space-y-0.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-xs text-foreground">
                      {run.automationName}
                    </span>
                    <span className="text-[10px] text-muted-foreground font-mono">
                      #{run.id}
                    </span>
                    <Badge
                      variant="outline"
                      className={`text-[9px] px-1.5 py-0 font-medium ${
                        isSuccess
                          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                          : "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30"
                      }`}
                    >
                      {isSuccess ? "Successful" : "Failed"}
                    </Badge>
                  </div>

                  <div className="text-xs text-muted-foreground truncate font-mono text-[11px]">
                    {run.error ? (
                      <span className="text-destructive font-medium truncate block">
                        {run.error}
                      </span>
                    ) : (
                      <span className="truncate block">{stepSummary}</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-4 text-xs text-muted-foreground shrink-0 self-end sm:self-auto">
                <span className="text-[11px] font-mono">{run.durationMs}ms</span>
                <span className="text-[11px]">
                  {new Date(run.startedAt).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
                <Button
                  variant="ghost"
                  size="xs"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedRun(run);
                  }}
                  className="h-6 text-[11px] px-2 text-muted-foreground group-hover:text-foreground"
                >
                  Inspect
                </Button>
              </div>
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div className="text-center py-12 text-xs text-muted-foreground">
            No execution history found matching your filters.
          </div>
        )}
      </div>

      {/* Detail Modal */}
      <ExecutionDetails
        run={selectedRun}
        open={!!selectedRun}
        onOpenChange={(op) => !op && setSelectedRun(null)}
        onRetry={onRetryRun}
      />
    </div>
  );
}
