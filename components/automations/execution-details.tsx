"use client";

import { CheckCircle2, XCircle, Clock, RotateCcw, AlertTriangle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ExecutionRun } from "./automation-types";
import { toast } from "sonner";

interface ExecutionDetailsProps {
  run: ExecutionRun | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRetry?: (run: ExecutionRun) => void;
}

export function ExecutionDetails({
  run,
  open,
  onOpenChange,
  onRetry,
}: ExecutionDetailsProps) {
  if (!run) return null;

  const isSuccess = run.status === "success";

  function handleRetry() {
    if (!run) return;
    if (onRetry) {
      onRetry(run);
    } else {
      toast.success(`Queued retry for ${run.automationName}`);
    }
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto p-6">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {isSuccess ? (
                <CheckCircle2 className="size-5 text-emerald-500" />
              ) : (
                <XCircle className="size-5 text-destructive" />
              )}
              <DialogTitle className="text-base font-semibold text-foreground">
                Run #{run.id}
              </DialogTitle>
            </div>
            <Badge
              variant="outline"
              className={`text-xs px-2 py-0.5 font-medium ${
                isSuccess
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                  : "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30"
              }`}
            >
              {isSuccess ? "Successful" : "Failed"}
            </Badge>
          </div>
          <DialogDescription className="text-xs text-muted-foreground flex items-center gap-3 pt-1">
            <span>Workflow: <strong>{run.automationName}</strong></span>
            <span>·</span>
            <span>Started: {new Date(run.startedAt).toLocaleString()}</span>
            <span>·</span>
            <span>Duration: {run.durationMs}ms</span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Failure Alert Banner */}
          {run.error && (
            <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-xs space-y-1">
              <div className="font-semibold flex items-center gap-1.5">
                <AlertTriangle className="size-4 shrink-0" /> Execution Error
              </div>
              <p className="font-mono text-[11px] leading-relaxed pl-5">
                {run.error}
              </p>
            </div>
          )}

          {/* Workflow Execution Console Logs */}
          {run.logs && run.logs.length > 0 && (
            <div className="space-y-1.5">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                <span>Execution Logs ({run.logs.length} events)</span>
                <span className="text-[10px] text-muted-foreground font-mono lowercase">live output</span>
              </span>
              <div className="p-3 rounded-lg bg-zinc-950 text-zinc-200 border border-border/80 font-mono text-[11px] leading-relaxed max-h-48 overflow-y-auto space-y-1 select-text shadow-inner">
                {run.logs.map((logLine, lIdx) => {
                  const isErr = logLine.includes("error") || logLine.includes("FAILED") || logLine.includes("failed");
                  const isSuccess = logLine.includes("SUCCESS") || logLine.includes("delivered") || logLine.includes("successfully");
                  return (
                    <div
                      key={lIdx}
                      className={`truncate ${
                        isErr
                          ? "text-rose-400 font-semibold"
                          : isSuccess
                          ? "text-emerald-400"
                          : "text-zinc-300"
                      }`}
                    >
                      {logLine}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Step by step execution trace */}
          <div className="space-y-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Node Execution Trace ({run.steps.length} steps)
            </span>

            <div className="space-y-3">
              {run.steps.map((step, idx) => {
                const stepOk = step.status === "success";
                const stepSkipped = step.status === "skipped";
                return (
                  <div
                    key={step.nodeId}
                    className="p-3 rounded-lg border border-border bg-card/60 space-y-2 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="size-5 rounded-full bg-muted grid place-items-center text-[10px] font-bold text-muted-foreground">
                          {idx + 1}
                        </span>
                        <span className="font-semibold text-foreground">
                          {step.nodeTitle}
                        </span>
                        <span className="text-[10px] font-mono text-muted-foreground">
                          ({step.nodeType})
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-muted-foreground font-mono">
                          {step.durationMs}ms
                        </span>
                        <Badge
                          variant="secondary"
                          className={`text-[9px] px-1.5 py-0 font-medium ${
                            stepOk
                              ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                              : stepSkipped
                              ? "bg-muted text-muted-foreground"
                              : "bg-rose-500/15 text-rose-600 dark:text-rose-400"
                          }`}
                        >
                          {step.status}
                        </Badge>
                      </div>
                    </div>

                    {step.error && (
                      <div className="p-2 rounded bg-destructive/10 text-destructive text-[11px] font-mono">
                        Error: {step.error}
                      </div>
                    )}

                    {/* Step-specific log details if available */}
                    {step.logs && step.logs.length > 0 && (
                      <div className="p-2 rounded bg-muted/40 border border-border/60 text-[10px] font-mono space-y-0.5 text-muted-foreground max-h-24 overflow-y-auto">
                        {step.logs.map((sLog, sIdx) => (
                          <div key={sIdx} className="leading-tight truncate">
                            {sLog}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Inputs & Outputs accordions */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                      <div className="space-y-1">
                        <span className="text-[10px] uppercase font-bold text-muted-foreground">
                          Input Payload
                        </span>
                        <pre className="p-2 rounded bg-background border border-border/80 text-[10px] font-mono overflow-x-auto max-h-32 text-foreground/90">
                          {JSON.stringify(step.input, null, 2)}
                        </pre>
                      </div>

                      <div className="space-y-1">
                        <span className="text-[10px] uppercase font-bold text-muted-foreground">
                          Output Result
                        </span>
                        <pre className="p-2 rounded bg-background border border-border/80 text-[10px] font-mono overflow-x-auto max-h-32 text-foreground/90">
                          {step.output ? JSON.stringify(step.output, null, 2) : "None"}
                        </pre>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <DialogFooter className="pt-2 flex sm:justify-between items-center">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleRetry}
            className="text-xs gap-1.5"
          >
            <RotateCcw className="size-3.5" /> Retry Execution
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="text-xs"
          >
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
