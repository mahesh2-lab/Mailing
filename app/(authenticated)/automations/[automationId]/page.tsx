"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { AutomationBuilder } from "@/components/automations/automation-builder";
import { ExecutionDetails } from "@/components/automations/execution-details";
import { Automation, CustomTool, ExecutionRun } from "@/components/automations/automation-types";
import { toast } from "sonner";

export default function AutomationEditorPage() {
  const params = useParams();
  const router = useRouter();
  const automationId = params?.automationId as string;

  const [automation, setAutomation] = useState<Automation | null>(null);
  const [customTools, setCustomTools] = useState<CustomTool[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastExecutionRun, setLastExecutionRun] = useState<ExecutionRun | null>(null);
  const [executionDetailsOpen, setExecutionDetailsOpen] = useState(false);

  useEffect(() => {
    if (!automationId) return;

    async function loadAutomationData() {
      setLoading(true);
      setError(null);

      try {
        const [autoRes, toolsRes] = await Promise.all([
          fetch(`/api/v1/automations/${automationId}`).then((r) => r.json()),
          fetch("/api/v1/automations/tools").then((r) => r.json()),
        ]);

        if (autoRes?.data) {
          setAutomation({
            ...autoRes.data,
            runCount: parseInt(autoRes.data.runCount || "0", 10),
            successRate: parseFloat(autoRes.data.successRate || "100"),
          });
        } else {
          setError(autoRes?.error || "Automation not found");
        }

        if (toolsRes?.data) {
          setCustomTools(toolsRes.data);
        }
      } catch (err: any) {
        console.error("Failed to load automation:", err);
        setError(err.message || "Failed to load automation workflow");
      } finally {
        setLoading(false);
      }
    }

    loadAutomationData();
  }, [automationId]);

  async function handleSaveAutomation(updated: Automation) {
    setAutomation(updated);
    try {
      const res = await fetch(`/api/v1/automations/${updated.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updated),
      }).then((r) => r.json());

      if (res?.error) {
        toast.error(`Save error: ${res.error}`);
      } else {
        toast.success("Workflow saved successfully");
      }
    } catch {
      toast.error("Failed to save changes to server");
    }
  }

  async function handleSaveCustomTool(tool: CustomTool) {
    try {
      const res = await fetch("/api/v1/automations/tools", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(tool),
      }).then((r) => r.json());

      if (res?.data) {
        setCustomTools((prev) => [res.data, ...prev.filter((t) => t.id !== tool.id)]);
        toast.success(`Tool "${tool.name}" saved`);
      }
    } catch {
      toast.error("Failed to save tool to server");
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
        setLastExecutionRun(res.data);
        setExecutionDetailsOpen(true);
        toast.success(
          `Workflow execution completed in ${res.data.durationMs}ms with status: ${res.data.status}`,
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

  if (loading) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-background text-foreground gap-3">
        <Loader2 className="size-6 animate-spin text-brand" />
        <p className="text-xs text-muted-foreground">Loading automation workflow...</p>
      </div>
    );
  }

  if (error || !automation) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-background text-foreground gap-4 p-6">
        <div className="text-center space-y-1.5 max-w-sm">
          <h2 className="text-base font-semibold">Workflow Not Found</h2>
          <p className="text-xs text-muted-foreground">{error || "Could not find automation with the requested ID."}</p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => router.push("/automations")}
          className="text-xs gap-1.5"
        >
          <ArrowLeft className="size-3.5" /> Back to Automations
        </Button>
      </div>
    );
  }

  return (
    <main className="h-screen w-full flex flex-col overflow-hidden bg-background text-foreground select-none">
      {/* Site Navigation Bar */}
      <nav className="h-12 min-h-12 border-b border-border flex items-center justify-between px-4 bg-background z-20 shrink-0">
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

      {/* Editor Component */}
      <div className="flex-1 flex overflow-hidden">
        <AutomationBuilder
          automation={automation}
          customTools={customTools}
          onSaveAutomation={handleSaveAutomation}
          onSaveCustomTool={handleSaveCustomTool}
          onBack={() => router.push("/automations")}
          onRunTest={handleTestRun}
        />
      </div>

      {/* Execution Diagnostics & Logs Modal */}
      <ExecutionDetails
        run={lastExecutionRun}
        open={executionDetailsOpen}
        onOpenChange={setExecutionDetailsOpen}
        onRetry={() => {
          if (automation) handleTestRun(automation);
        }}
      />
    </main>
  );
}
