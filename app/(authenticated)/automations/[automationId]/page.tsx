"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Loader2 } from "@/components/animate-ui/icons";
import { Button } from "@/components/ui/button";
import { AuthenticatedPageShell } from "@/components/authenticated-page-shell";
import { AutomationBuilder } from "@/components/automations/automation-builder";
import { Automation, CustomTool } from "@/components/automations/automation-types";
import { toast } from "sonner";
import { generateId } from "@/lib/utils";

export default function AutomationEditorPage() {
  const params = useParams();
  const router = useRouter();
  const automationId = params?.automationId as string;

  const [automation, setAutomation] = useState<Automation | null>(null);
  const [customTools, setCustomTools] = useState<CustomTool[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
      } catch (err: unknown) {
        console.error("Failed to load automation:", err);
        setError(err instanceof Error ? err.message : "Failed to load automation workflow");
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
      const response = await fetch(`/api/v1/automations/${auto.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          simulated: true,
          triggerSource: "Live Interactive Test",
          email: {
            id: generateId(),
            from: "Billing Department <billing@acme.corp>",
            to: ["user@example.com"],
            subject: "Workflow test message",
            text: "This message is used only to simulate an automation run.",
          },
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Failed to queue workflow test");
      toast.success("Simulated workflow test queued", { id: "test-run" });
    } catch (err: unknown) {
      console.error("Test run error:", err);
      toast.error(`Execution error: ${err instanceof Error ? err.message : "Unknown error"}`, { id: "test-run" });
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
    <AuthenticatedPageShell
      title={automation.name || "Workflow Editor"}
      fullWidth={true}
    >
      <div className="flex-1 flex w-full h-full overflow-hidden">
        <AutomationBuilder
          automation={automation}
          customTools={customTools}
          onSaveAutomation={handleSaveAutomation}
          onSaveCustomTool={handleSaveCustomTool}
          onBack={() => router.push("/automations")}
          onRunTest={handleTestRun}
        />
      </div>

    </AuthenticatedPageShell>
  );
}
