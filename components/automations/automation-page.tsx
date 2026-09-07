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
import { SiteNav } from "@/components/site-nav";
import {
  Automation,
  CustomTool,
  ExecutionRun,
  WorkflowEdge,
  WorkflowNode,
} from "./automation-types";
import { AutomationList } from "./automation-list";
import { ExecutionHistory } from "./execution-history";
import { toast } from "sonner";

export function AutomationPage() {
  const router = useRouter();
  const [view, setView] = useState<"list" | "history">("list");

  // State synced with backend database
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [customTools, setCustomTools] = useState<CustomTool[]>([]);
  const [history, setHistory] = useState<ExecutionRun[]>([]);
  const [loading, setLoading] = useState(true);

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
      name: "New Workflow",
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



  async function handleCreateFromTemplate(template: {
    name: string;
    description: string;
    nodes: WorkflowNode[];
    edges: WorkflowEdge[];
  }) {
    const newAuto: Automation = {
      id: `auto-${Date.now()}`,
      name: template.name,
      description: template.description,
      enabled: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      runCount: 0,
      successRate: 100,
      nodes: template.nodes,
      edges: template.edges,
    };

    try {
      await fetch("/api/v1/automations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newAuto),
      });
      setAutomations([newAuto, ...automations]);
      toast.success(`Created "${newAuto.name}"`);
    } catch {}

    router.push(`/automations/${newAuto.id}`);
  }

  return (
    <main className="site-page">
      {/* Site Navigation Bar */}
      <SiteNav current="automations" />

      {/* Standard Site Page Header */}
      <header className="page-header">
        <div>
          <span className="eyebrow">
            {view === "list" ? "AUTOMATION / WORKFLOW ENGINE" : "AUTOMATION / EXECUTION AUDIT"}
          </span>
          <h1>{view === "list" ? "Automations" : "Execution History"}</h1>
          <p>
            {view === "list"
              ? "Build automated rules and intelligent AI workflows triggered by incoming emails."
              : "Audit logs, execution traces, and performance metrics for all automated inbox actions."}
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {view === "list" ? (
            <>
              <Link href="/inbox" className="button-secondary">
                <ArrowLeft className="size-4 mr-1.5" /> Back to Inbox
              </Link>
              <button
                type="button"
                className="button-secondary"
                onClick={() => setView("history")}
              >
                <History className="size-4 mr-1.5" /> History {history.length > 0 && `(${history.length})`}
              </button>
              <button
                type="button"
                className="button-primary"
                onClick={handleCreateNew}
              >
                <Plus className="size-4 mr-1.5" /> New workflow
              </button>
            </>
          ) : (
            <button
              type="button"
              className="button-secondary"
              onClick={() => setView("list")}
            >
              <ArrowLeft className="size-4 mr-1.5" /> Back to Workflows
            </button>
          )}
        </div>
      </header>

      {/* Main View Switcher */}
      {view === "list" && (
        <AutomationList
          automations={automations}
          history={history}
          onCreateNew={handleCreateNew}
          onCreateFromTemplate={handleCreateFromTemplate}
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
        <ExecutionHistory
          history={history}
          onRetryRun={(run) => {
            const auto = automations.find((a) => a.id === run.automationId);
            if (auto) handleTestRun(auto);
          }}
        />
      )}
    </main>
  );
}
