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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-foreground tracking-tight">
              Automations
            </h1>
            <span className="text-xs px-2 py-0.5 rounded-full bg-brand/10 text-brand font-medium">
              Resend Engine
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Set up rules and workflows to automate repetitive tasks in your Mailing inbox — powered by Resend.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onOpenHistory}
            className="h-8 text-xs gap-1.5"
          >
            <History className="size-3.5 text-muted-foreground" />
            <span>Execution History</span>
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onOpenAiBuilder}
            className="h-8 text-xs gap-1.5 text-brand hover:text-brand"
          >
            <Sparkles className="size-3.5 text-brand" />
            <span>AI Builder</span>
          </Button>

          <Button
            type="button"
            size="sm"
            onClick={onCreateNew}
            className="h-8 text-xs gap-1.5 bg-brand text-brand-fg hover:opacity-90 font-medium"
          >
            <Plus className="size-3.5" />
            <span>Create automation</span>
          </Button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="size-3.5 absolute left-2.5 top-2.5 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Search automations..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 text-xs pl-8"
          />
        </div>

        <div className="flex items-center gap-1 self-start sm:self-auto">
          <Button
            type="button"
            variant={statusFilter === "all" ? "secondary" : "ghost"}
            size="xs"
            onClick={() => setStatusFilter("all")}
            className="h-7 text-xs"
          >
            All ({automations.length})
          </Button>
          <Button
            type="button"
            variant={statusFilter === "active" ? "secondary" : "ghost"}
            size="xs"
            onClick={() => setStatusFilter("active")}
            className="h-7 text-xs text-emerald-600 dark:text-emerald-400"
          >
            Active ({activeCount})
          </Button>
          <Button
            type="button"
            variant={statusFilter === "paused" ? "secondary" : "ghost"}
            size="xs"
            onClick={() => setStatusFilter("paused")}
            className="h-7 text-xs text-muted-foreground"
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
          <div className="p-12 text-center rounded-lg border border-dashed border-border bg-card/40 space-y-3">
            <div className="size-10 rounded-full bg-muted grid place-items-center mx-auto text-muted-foreground">
              <Zap className="size-5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground">
                No automations found
              </h3>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                {search
                  ? "No workflows match your search query. Try clearing filters."
                  : "Create your first email automation to streamline your inbox."}
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              onClick={onCreateNew}
              className="text-xs gap-1.5"
            >
              <Plus className="size-3.5" /> Create Automation
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
