"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Check,
  History,
  Inbox,
  Plus,
  Sparkles,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  Automation,
  CustomTool,
  ExecutionRun,
  WorkflowEdge,
  WorkflowNode,
} from "./automation-types";
import { AutomationList } from "./automation-list";
import { ExecutionHistory } from "./execution-history";
import { AiBuilderDialog } from "./ai-builder-dialog";
import { toast } from "sonner";

export function AutomationPage() {
  const router = useRouter();
  const [view, setView] = useState<"list" | "history">("list");

  // State synced with backend database
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [customTools, setCustomTools] = useState<CustomTool[]>([]);
  const [history, setHistory] = useState<ExecutionRun[]>([]);
  const [loading, setLoading] = useState(true);

  // AI Builder modal
  const [aiBuilderOpen, setAiBuilderOpen] = useState(false);

  // Load live data from PostgreSQL backend API
  async function loadData() {
    setLoading(true);
    try {
      const [autosRes, toolsRes, histRes] = await Promise.all([
        fetch("/api/v1/automations").then((r) => r.json()),
        fetch("/api/v1/automations/tools").then((r) => r.json()),
        fetch("/api/v1/automations/history").then((r) => r.json()),
      ]);

      if (autosRes?.data) {
        setAutomations(
          autosRes.data.map((a: any) => ({
            ...a,
            runCount: parseInt(a.runCount || "0", 10),
            successRate: parseFloat(a.successRate || "100"),
          }))
        );
      }
      if (toolsRes?.data) setCustomTools(toolsRes.data);
      if (histRes?.data) setHistory(histRes.data);
    } catch (err) {
      console.error("Failed to load automations from backend:", err);
      toast.error("Failed to load automations from server");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function handleCreateNew() {
    const newAuto: Automation = {
      id: `auto-${Date.now()}`,
      name: "New Automation Workflow",
      description: "Triggered on inbound message",
      enabled: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      runCount: 0,
      successRate: 100,
      nodes: [
        {
          id: "node-root",
          type: "trigger_email_received",
          category: "trigger",
          title: "Email Received",
          description: "Matches any new incoming email",
          config: {},
          position: { x: 260, y: 40 },
        },
      ],
      edges: [],
    };

    try {
      const res = await fetch("/api/v1/automations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newAuto),
      }).then((r) => r.json());

      if (res.data) {
        setAutomations([newAuto, ...automations]);
        toast.success("Created new automation workflow");
        router.push(`/automations/${newAuto.id}`);
      }
    } catch (err) {
      router.push(`/automations/${newAuto.id}`);
    }
  }

  function handleEdit(automation: Automation) {
    router.push(`/automations/${automation.id}`);
  }

  async function handleToggleEnabled(id: string, enabled: boolean) {
    // Optimistic update
    setAutomations((prev) =>
      prev.map((a) => (a.id === id ? { ...a, enabled } : a))
    );

    try {
      await fetch(`/api/v1/automations/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled }),
      });
      toast.success(enabled ? "Automation activated" : "Automation paused");
    } catch {
      toast.error("Failed to update status on server");
    }
  }

  async function handleDuplicate(automation: Automation) {
    const duplicated: Automation = {
      ...automation,
      id: `auto-${Date.now()}`,
      name: `${automation.name} (Copy)`,
      enabled: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      runCount: 0,
      lastRunAt: undefined,
    };

    try {
      await fetch("/api/v1/automations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(duplicated),
      });
      setAutomations([duplicated, ...automations]);
      toast.success(`Duplicated "${automation.name}"`);
    } catch {
      toast.error("Failed to duplicate automation");
    }
  }

  async function handleDelete(id: string) {
    const target = automations.find((a) => a.id === id);
    setAutomations((prev) => prev.filter((a) => a.id !== id));

    try {
      await fetch(`/api/v1/automations/${id}`, { method: "DELETE" });
      toast.success(`Deleted "${target?.name || "Automation"}"`);
    } catch {
      toast.error("Failed to delete automation from server");
    }
  }

  async function handleTestRun(auto: Automation) {
    toast.loading("Executing workflow test against backend...", { id: "test-run" });

    try {
      const res = await fetch(`/api/v1/automations/${auto.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          simulated: false,
          triggerSource: "Live Interactive Test",
          email: {
            id: `test-email-${Date.now().toString().slice(-4)}`,
            from: "Billing Department <billing@acme.corp>",
            to: ["mahesh@heymahesh.in"],
            subject: "Invoice #9021 for Professional Services",
            text: "Hi Mahesh, please find attached our invoice #9021 for billing and review.",
          },
        }),
      }).then((r) => r.json());

      if (res.data) {
        const run: ExecutionRun = res.data;
        setHistory((prev) => [run, ...prev]);

        // Refresh automation stats
        setAutomations((prev) =>
          prev.map((a) =>
            a.id === auto.id
              ? {
                  ...a,
                  runCount: a.runCount + 1,
                  lastRunAt: run.startedAt,
                }
              : a
          )
        );

        toast.success(
          `Workflow execution completed in ${run.durationMs}ms with status: ${run.status}`,
          { id: "test-run" }
        );
      } else {
        toast.error("Test execution failed to return result", { id: "test-run" });
      }
    } catch (err: any) {
      console.error("Test run error:", err);
      toast.error(`Execution error: ${err.message}`, { id: "test-run" });
    }
  }

  async function handleApplyAiWorkflow(wf: {
    name: string;
    description: string;
    nodes: WorkflowNode[];
    edges: WorkflowEdge[];
  }) {
    const newAuto: Automation = {
      id: `auto-${Date.now()}`,
      name: wf.name,
      description: wf.description,
      enabled: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      runCount: 0,
      successRate: 100,
      nodes: wf.nodes,
      edges: wf.edges,
    };

    try {
      await fetch("/api/v1/automations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newAuto),
      });
      setAutomations([newAuto, ...automations]);
    } catch {}

    router.push(`/automations/${newAuto.id}`);
  }

  return (
    <main className="site-page">
      {/* Site Navigation Bar */}
      <nav className="site-nav">
        <Link href="/inbox" className="site-brand" title="Go to Inbox">
          <span className="site-brand-mark" aria-hidden="true">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="2" y="4" width="20" height="16" rx="3" />
              <path d="M2 7l10 7 10-7" />
            </svg>
          </span>
          Mailing
        </Link>

        <div className="site-links items-center flex">
          <Link href="/inbox">Inbox</Link>
          <Link href="/contacts">Contacts</Link>
          <Link href="/automations" className="text-foreground font-semibold">
            Automations
          </Link>
          <Link href="/help">Help</Link>
          <Link href="/profile">Profile</Link>
          <Link href="/settings">Settings</Link>
          <div className="ml-2">
            <ThemeToggle />
          </div>
        </div>
      </nav>

      {/* Main View Switcher */}
      {view === "list" && (
        <AutomationList
          automations={automations}
          onCreateNew={handleCreateNew}
          onOpenAiBuilder={() => setAiBuilderOpen(true)}
          onOpenHistory={() => setView("history")}
          onEdit={handleEdit}
          onToggleEnabled={handleToggleEnabled}
          onDuplicate={handleDuplicate}
          onDelete={handleDelete}
          onTestRun={handleTestRun}
          onViewHistoryForAutomation={(autoId) => setView("history")}
        />
      )}

      {view === "history" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between border-b border-border pb-4">
            <div className="flex items-center gap-3">
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                onClick={() => setView("list")}
                className="size-8 text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="size-4" />
              </Button>
              <div>
                <h2 className="text-lg font-bold text-foreground">Execution History</h2>
                <p className="text-xs text-muted-foreground">
                  Audit logs and execution traces for all automated inbox actions.
                </p>
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setView("list")}
              className="text-xs"
            >
              Back to Automations
            </Button>
          </div>

          <ExecutionHistory
            history={history}
            onRetryRun={(run) => {
              const auto = automations.find((a) => a.id === run.automationId);
              if (auto) handleTestRun(auto);
            }}
          />
        </div>
      )}

      {/* AI Builder Modal */}
      <AiBuilderDialog
        open={aiBuilderOpen}
        onOpenChange={setAiBuilderOpen}
        onApplyWorkflow={handleApplyAiWorkflow}
      />
    </main>
  );
}
