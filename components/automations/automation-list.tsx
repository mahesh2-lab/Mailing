"use client";

import { useState } from "react";
import {
  Plus,
  Search,
  Sparkles,
  History,
  Zap,
  CheckCircle2,
  Inbox,
  Filter,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Automation } from "./automation-types";
import { AutomationCard } from "./automation-card";

interface AutomationListProps {
  automations: Automation[];
  onCreateNew: () => void;
  onOpenAiBuilder: () => void;
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
  onCreateNew,
  onOpenAiBuilder,
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

  return (
    <div className="space-y-6">
      {/* Top Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border border-border/60 bg-gradient-to-br from-card/80 to-muted/20 backdrop-blur-xl p-5 rounded-xl shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <div className="size-8 rounded-lg bg-brand/10 grid place-items-center">
              <Zap className="size-4 text-brand" />
            </div>
            <h1 className="text-xl font-bold text-foreground tracking-tight">
              Automations
            </h1>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-brand/10 text-brand font-semibold tracking-wide uppercase">
              Resend Engine
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-2 ml-10">
            Set up rules and workflows to automate repetitive tasks in your Mailing inbox.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onOpenHistory}
            className="h-9 text-xs gap-1.5 shadow-xs bg-background/50"
          >
            <History className="size-3.5 text-muted-foreground" />
            <span>Execution History</span>
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onOpenAiBuilder}
            className="h-9 text-xs gap-1.5 text-brand hover:text-brand border-brand/20 bg-brand/5 hover:bg-brand/10 shadow-xs transition-colors"
          >
            <Sparkles className="size-3.5 text-brand" />
            <span>AI Builder</span>
          </Button>

          <Button
            type="button"
            size="sm"
            onClick={onCreateNew}
            className="h-9 text-xs gap-1.5 bg-brand text-brand-fg hover:opacity-90 font-semibold shadow-md transition-opacity"
          >
            <Plus className="size-4" />
            <span>Create Automation</span>
          </Button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-1">
        <div className="relative w-full sm:w-80 group">
          <Search className="size-4 absolute left-3 top-2.5 text-muted-foreground group-focus-within:text-brand transition-colors" />
          <Input
            placeholder="Search automations..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 text-xs pl-9 bg-card/50 border-border/80 focus:border-brand/50 transition-all rounded-lg shadow-xs"
          />
        </div>

        <div className="flex items-center gap-1 self-start sm:self-auto bg-card/50 p-1 rounded-lg border border-border/80 shadow-xs">
          <Button
            type="button"
            variant={statusFilter === "all" ? "secondary" : "ghost"}
            size="xs"
            onClick={() => setStatusFilter("all")}
            className={`h-7 text-xs rounded-md transition-all ${
              statusFilter === "all" ? "bg-background shadow-xs font-medium" : "text-muted-foreground"
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
              statusFilter === "active" ? "bg-background shadow-xs font-medium text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"
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
              statusFilter === "paused" ? "bg-background shadow-xs font-medium text-foreground" : "text-muted-foreground"
            }`}
          >
            Paused ({pausedCount})
          </Button>
        </div>
      </div>

      {/* Cards Grid */}
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
          <div className="p-16 text-center rounded-xl border border-dashed border-border/80 bg-card/30 space-y-4 shadow-inner">
            <div className="size-14 rounded-2xl bg-gradient-to-br from-brand/10 to-brand/5 border border-brand/10 grid place-items-center mx-auto text-brand shadow-xs relative">
              <div className="absolute inset-0 bg-brand/5 blur-xl rounded-full" />
              <Zap className="size-6 relative z-10" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-foreground tracking-tight">
                No automations found
              </h3>
              <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
                {search
                  ? "No workflows match your search query. Try clearing filters."
                  : "Create your first email automation to streamline your inbox."}
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              onClick={onCreateNew}
              className="text-xs gap-2 bg-brand text-brand-fg hover:opacity-90 font-medium shadow-md transition-all hover:scale-105"
            >
              <Plus className="size-4" /> Create Automation
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
