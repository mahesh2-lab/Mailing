"use client";

import { useState } from "react";
import { Bot, Sparkles, ArrowRight, ShieldAlert, Check } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { WorkflowNode, WorkflowEdge } from "./automation-types";
import { toast } from "sonner";

interface AiBuilderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApplyWorkflow: (workflow: {
    name: string;
    description: string;
    nodes: WorkflowNode[];
    edges: WorkflowEdge[];
  }) => void;
}

const EXAMPLE_PROMPTS = [
  "Whenever I receive a sales inquiry, create a CRM lead and draft a reply.",
  "When an invoice arrives, notify Slack and tag as Finance.",
  "If an email is from an executive or marked urgent, star it and draft a high-priority reply.",
  "Bundle daily newsletter emails into a concise bullet-point summary and archive them.",
];

export function AiBuilderDialog({
  open,
  onOpenChange,
  onApplyWorkflow,
}: AiBuilderDialogProps) {
  const [prompt, setPrompt] = useState("");
  const [generating, setGenerating] = useState(false);
  const [preview, setPreview] = useState<{
    name: string;
    description: string;
    nodes: WorkflowNode[];
    edges: WorkflowEdge[];
  } | null>(null);

  async function handleGenerate() {
    if (!prompt.trim()) {
      toast.error("Please enter a description for your automation");
      return;
    }

    setGenerating(true);
    setPreview(null);

    try {
      try {
        const res = await fetch("/api/v1/automations/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt: prompt.trim() }),
        });

        const json = await res.json();

        if (res.ok && json.data) {
          setPreview(json.data);
          toast.success("AI generated your workflow!");
          return;
        }

        // If GEMINI_API_KEY is not configured or error returned, notify user or fallback gracefully
        if (res.status === 503) {
          toast.info("GEMINI_API_KEY not set in .env. Falling back to local smart template.");
        } else {
          toast.warning(json.error || "AI generation failed, using intelligent template.");
        }
      } catch (err: any) {
        console.warn("AI generation network error, falling back to local template:", err);
      }

      // Fallback template builder (when API key isn't provided or offline)
      const lower = prompt.toLowerCase();
      let generatedName = "AI Auto-Workflow";
      let generatedDesc = prompt;
      let generatedNodes: WorkflowNode[] = [];
      let generatedEdges: WorkflowEdge[] = [];

      if (lower.includes("sales") || lower.includes("crm")) {
        generatedName = "Sales Lead & CRM Pipeline";
        generatedDesc = "Classifies sales inquiries, inserts a lead into CRM, and prepares a draft reply.";
        generatedNodes = [
          {
            id: "ai-1",
            type: "trigger_email_received",
            category: "trigger",
            title: "Email Received",
            description: "Incoming lead email",
            config: {},
            position: { x: 260, y: 40 },
          },
          {
            id: "ai-2",
            type: "ai_classify",
            category: "ai",
            title: "AI Classify Lead",
            description: "Detect enterprise vs standard sales inquiry",
            config: { categories: ["Sales Inquiry", "General", "Support"] },
            position: { x: 260, y: 160 },
          },
          {
            id: "ai-3",
            type: "tool_http_request",
            category: "tool",
            title: "Create CRM Lead",
            description: "POST to CRM endpoint",
            config: {
              method: "POST",
              url: "https://api.crm.internal/v1/leads",
              body: '{"email":"{{email.from.address}}","name":"{{email.from.name}}","subject":"{{email.subject}}"}',
            },
            position: { x: 260, y: 280 },
          },
          {
            id: "ai-4",
            type: "email_reply",
            category: "email",
            title: "Send Sales Introduction",
            description: "Send initial reply with scheduler link",
            config: {
              template: "Hi {{email.from.name}},\n\nThanks for reaching out! I'd love to learn more about your team's needs.\n\nBest,\nSales Team",
            },
            position: { x: 260, y: 400 },
          },
        ];
        generatedEdges = [
          { id: "e1", from: "ai-1", to: "ai-2" },
          { id: "e2", from: "ai-2", to: "ai-3" },
          { id: "e3", from: "ai-3", to: "ai-4" },
        ];
      } else if (lower.includes("invoice") || lower.includes("receipt") || lower.includes("slack")) {
        generatedName = "Invoice & Slack Dispatcher";
        generatedDesc = "Detects invoices, posts an alert to Slack, and applies the Finance tag.";
        generatedNodes = [
          {
            id: "ai-1",
            type: "trigger_email_received",
            category: "trigger",
            title: "Email Received",
            description: "Filter for invoices or billing",
            config: { filterSubject: "invoice, receipt, billing" },
            position: { x: 260, y: 40 },
          },
          {
            id: "ai-2",
            type: "email_add_label",
            category: "email",
            title: "Tag as Finance",
            description: "Add label 'Work'",
            config: { label: "Work" },
            position: { x: 260, y: 160 },
          },
          {
            id: "ai-3",
            type: "tool_http_request",
            category: "tool",
            title: "Post Alert to Slack",
            description: "Send notification to #finance",
            config: {
              method: "POST",
              url: "https://hooks.slack.com/services/T00/B00/XXXXX",
              body: '{"text":"Received new invoice from {{email.from.name}} ({{email.subject}})"}',
            },
            position: { x: 260, y: 280 },
          },
        ];
        generatedEdges = [
          { id: "e1", from: "ai-1", to: "ai-2" },
          { id: "e2", from: "ai-2", to: "ai-3" },
        ];
      } else {
        // General Smart Assistant flow
        generatedName = "Smart AI Assistant Reply";
        generatedDesc = "Analyzes incoming email, drafts an AI contextual response, and flags high priority.";
        generatedNodes = [
          {
            id: "ai-1",
            type: "trigger_email_received",
            category: "trigger",
            title: "Email Received",
            description: "New incoming email",
            config: {},
            position: { x: 260, y: 40 },
          },
          {
            id: "ai-2",
            type: "ai_generate",
            category: "ai",
            title: "AI Draft Response",
            description: "Generate thoughtful response to text",
            config: {
              prompt: "Draft a helpful and concise reply to {{email.from.name}} regarding '{{email.subject}}'.",
            },
            position: { x: 260, y: 160 },
          },
          {
            id: "ai-3",
            type: "email_reply",
            category: "email",
            title: "Send Reply",
            description: "Dispatch generated reply",
            config: {
              template: "Hi {{email.from.name}},\n\n{{ai.reply}}\n\nBest regards,\nMailing Team",
            },
            position: { x: 260, y: 280 },
          },
        ];
        generatedEdges = [
          { id: "e1", from: "ai-1", to: "ai-2" },
          { id: "e2", from: "ai-2", to: "ai-3" },
        ];
      }

      setPreview({
        name: generatedName,
        description: generatedDesc,
        nodes: generatedNodes,
        edges: generatedEdges,
      });
    } finally {
      setGenerating(false);
    }
  }

  function handleConfirmApply() {
    if (!preview) return;
    onApplyWorkflow(preview);
    toast.success(`Workflow "${preview.name}" loaded into canvas (Paused by default)`);
    onOpenChange(false);
    setPreview(null);
    setPrompt("");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto p-6">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="size-8 rounded-lg bg-brand/10 text-brand grid place-items-center">
              <Sparkles className="size-4" />
            </div>
            <div>
              <DialogTitle className="text-base font-semibold">
                AI Workflow Builder
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Describe in plain English what you want to automate, and AI will construct the workflow.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">
              What would you like to automate?
            </label>
            <Textarea
              rows={3}
              placeholder="e.g. Whenever I receive a sales inquiry, create a CRM lead and draft a reply."
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className="text-xs font-normal resize-y"
            />
          </div>

          {/* Prompt suggestions */}
          <div className="space-y-1.5">
            <span className="text-[11px] font-semibold text-muted-foreground">
              Try an example:
            </span>
            <div className="flex flex-col gap-1.5">
              {EXAMPLE_PROMPTS.map((ex, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setPrompt(ex)}
                  className="text-left text-xs p-1.5 px-2.5 rounded bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground border border-border/60 transition-colors cursor-pointer"
                >
                  &ldquo;{ex}&rdquo;
                </button>
              ))}
            </div>
          </div>

          <div className="pt-2">
            <Button
              type="button"
              onClick={handleGenerate}
              disabled={generating || !prompt.trim()}
              className="w-full gap-2 text-xs font-medium"
            >
              <Sparkles className="size-3.5" />
              {generating ? "Synthesizing workflow steps…" : "Generate Workflow Preview"}
            </Button>
          </div>

          {/* Generated Preview */}
          {preview && (
            <div className="space-y-3 pt-3 border-t border-border">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-semibold text-foreground">
                    {preview.name}
                  </h4>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {preview.description}
                  </p>
                </div>
                <Badge variant="secondary" className="text-[10px] font-mono">
                  {preview.nodes.length} Steps
                </Badge>
              </div>

              {/* Step Sequence Preview */}
              <div className="p-3 bg-muted/40 rounded-lg border border-border space-y-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                  Workflow Pipeline
                </span>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {preview.nodes.map((node, i) => (
                    <div key={node.id} className="flex items-center gap-1.5">
                      <span className="text-xs font-medium px-2 py-1 rounded bg-background border border-border text-foreground shadow-2xs">
                        {node.title}
                      </span>
                      {i < preview.nodes.length - 1 && (
                        <ArrowRight className="size-3 text-muted-foreground shrink-0" />
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Safety notice per requirements */}
              <div className="p-2.5 rounded-md bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-400 text-xs flex items-start gap-2">
                <ShieldAlert className="size-4 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <span className="font-semibold">User Confirmation Required</span>
                  <p className="text-[11px] opacity-90 leading-normal">
                    AI-generated workflows are never automatically enabled. The workflow will be loaded into the canvas in a <strong>Paused</strong> state so you can inspect each node before activating.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="pt-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="text-xs"
          >
            Cancel
          </Button>
          {preview && (
            <Button
              type="button"
              size="sm"
              onClick={handleConfirmApply}
              className="text-xs gap-1.5 bg-brand text-brand-fg hover:opacity-90"
            >
              <Check className="size-3.5" /> Confirm & Load into Canvas
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
