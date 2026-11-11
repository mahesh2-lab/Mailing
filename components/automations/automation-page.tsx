"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  History,
  Plus,
} from "@/components/animate-ui/icons";
import { Button } from "@/components/ui/button";
import { AuthenticatedPageShell } from "@/components/authenticated-page-shell";
import {
  Automation,
  ExecutionRun,
  WorkflowEdge,
  WorkflowNode,
} from "./automation-types";
import { AutomationList } from "./automation-list";
import { ExecutionHistory } from "./execution-history";
import { toast } from "sonner";
import { generateId } from "@/lib/utils";
import { authClient } from "@/src/lib/auth-client";

export function AutomationPage() {
  const router = useRouter();
  const { data: session } = authClient.useSession();
  const [view, setView] = useState<"list" | "history">("list");

  // State synced with backend database
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [history, setHistory] = useState<ExecutionRun[]>([]);

  // Load live data from PostgreSQL backend API
  async function loadData() {
    return Promise.all([
      fetch("/api/v1/automations").then((r) => r.json()),
      fetch("/api/v1/automations/history").then((r) => r.json()),
    ]);
  }

  useEffect(() => {
    let active = true;
    loadData()
      .then(([autosRes, histRes]) => {
        if (!active) return;
        if (autosRes?.data) {
          type AutomationRecord = Omit<Automation, "runCount" | "successRate"> & {
            runCount: string | number;
            successRate: string | number;
          };
          setAutomations(
            (autosRes.data as AutomationRecord[]).map((a) => ({
              ...a,
              runCount: parseInt(String(a.runCount || "0"), 10),
              successRate: parseFloat(String(a.successRate || "100")),
            }))
          );
        }
        if (histRes?.data) setHistory(histRes.data);
      })
      .catch((error: unknown) => {
        console.error("Failed to load automations from backend:", error);
        if (active) toast.error("Failed to load automations from server");
      });
    return () => {
      active = false;
    };
  }, []);

  async function handleCreateNew() {
    const newAutoId = generateId();
    const newAuto: Automation = {
      id: newAutoId,
      name: "New Workflow",
      description: "Triggered on inbound message",
      enabled: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      runCount: 0,
      successRate: 100,
      nodes: [
        {
          id: generateId(),
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
      const response = await fetch("/api/v1/automations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newAuto),
      });
      const res = await response.json();

      if (!response.ok || !res.data) {
        toast.error(res.error || "Failed to create automation");
        return;
      }

      setAutomations((previous) => [newAuto, ...previous]);
      toast.success("Created new automation workflow");
      router.push(`/automations/${newAuto.id}`);
    } catch {
      toast.error("Failed to create automation");
    }
  }

  function handleEdit(automation: Automation) {
    router.push(`/automations/${automation.id}`);
  }

  async function handleToggleEnabled(id: string, enabled: boolean) {
    try {
      const response = await fetch(`/api/v1/automations/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled }),
      });
      if (!response.ok) throw new Error("Request failed");
      setAutomations((prev) => prev.map((a) => (a.id === id ? { ...a, enabled } : a)));
      toast.success(enabled ? "Automation activated" : "Automation paused");
    } catch {
      try {
        const response = await fetch(`/api/v1/automations/${id}`);
        if (response.ok) {
          const { data } = await response.json();
          setAutomations((prev) => prev.map((a) => (a.id === id ? { ...a, enabled: data.enabled } : a)));
        }
      } catch {}
      toast.error("Failed to update status on server");
    }
  }

  async function handleDuplicate(automation: Automation) {
    const idMap = new Map<string, string>();
    const duplicatedNodes = (automation.nodes || []).map((node) => {
      const newId = generateId();
      idMap.set(node.id, newId);
      return { ...node, id: newId };
    });
    const duplicatedEdges = (automation.edges || []).map((edge) => ({
      ...edge,
      id: generateId(),
      from: idMap.get(edge.from) || edge.from,
      to: idMap.get(edge.to) || edge.to,
    }));

    const duplicated: Automation = {
      ...automation,
      id: generateId(),
      name: `${automation.name} (Copy)`,
      enabled: false,
      nodes: duplicatedNodes,
      edges: duplicatedEdges,
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
    try {
      const response = await fetch(`/api/v1/automations/${id}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Request failed");
      setAutomations((prev) => prev.filter((a) => a.id !== id));
      toast.success(`Deleted "${target?.name || "Automation"}"`);
    } catch {
      try {
        const response = await fetch(`/api/v1/automations/${id}`);
        if (response.status === 404) setAutomations((prev) => prev.filter((a) => a.id !== id));
      } catch {}
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
            id: generateId(),
            from: "Billing Department <billing@acme.corp>",
            to: [session?.user?.email || "user@example.com"],
            subject: "Invoice #9021 for Professional Services",
            text: `Hi ${session?.user?.name?.split(" ")[0] || "there"}, please find attached our invoice #9021 for billing and review.`,
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
    } catch (err: unknown) {
      console.error("Test run error:", err);
      toast.error(`Execution error: ${err instanceof Error ? err.message : "Unknown error"}`, { id: "test-run" });
    }
  }

  async function handleCreateFromTemplate(template: {
    name: string;
    description: string;
    nodes: WorkflowNode[];
    edges: WorkflowEdge[];
  }) {
    const idMap = new Map<string, string>();
    const newNodes = template.nodes.map((node) => {
      const newId = generateId();
      idMap.set(node.id, newId);
      return { ...node, id: newId };
    });
    const newEdges = template.edges.map((edge) => ({
      ...edge,
      id: generateId(),
      from: idMap.get(edge.from) || edge.from,
      to: idMap.get(edge.to) || edge.to,
    }));

    const newAuto: Automation = {
      id: generateId(),
      name: template.name,
      description: template.description,
      enabled: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      runCount: 0,
      successRate: 100,
      nodes: newNodes,
      edges: newEdges,
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
    <AuthenticatedPageShell
      title="Automations"
      actions={
        <div className="flex items-center gap-1.5">
          {view === "list" ? (
            <>
              <Button
                type="button"
                variant="outline"
                size="xs"
                onClick={() => setView("history")}
                className="text-xs gap-1.5 h-8"
              >
                <History className="size-3.5" />
                <span>History {history.length > 0 && `(${history.length})`}</span>
              </Button>
              <Button
                type="button"
                size="xs"
                onClick={handleCreateNew}
                className="text-xs gap-1.5 h-8 font-medium shadow-xs"
              >
                <Plus className="size-3.5" />
                <span>New workflow</span>
              </Button>
            </>
          ) : (
            <Button
              type="button"
              variant="outline"
              size="xs"
              onClick={() => setView("list")}
              className="text-xs gap-1.5 h-8"
            >
              <ArrowLeft className="size-3.5" />
              <span>Back to Workflows</span>
            </Button>
          )}
        </div>
      }
    >
      <div className="space-y-6">
        {/* Page Title & Subtitle Banner */}
        <div className="border-b border-border pb-5">
          <h1 className="text-xl font-bold tracking-tight text-foreground">
            {view === "list" ? "Automations" : "Execution History"}
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            {view === "list"
              ? "Build automated rules and intelligent AI workflows triggered by incoming emails."
              : "Audit logs, execution traces, and performance metrics for all automated inbox actions."}
          </p>
        </div>

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
            onViewHistoryForAutomation={() => setView("history")}
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
      </div>
    </AuthenticatedPageShell>
  );
}
