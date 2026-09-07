"use client";

import { useState, useEffect } from "react";
import { Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { VariablePicker, VariablePills } from "./variable-picker";
import { WorkflowNode } from "./automation-types";

interface NodeConfigPanelProps {
  node: WorkflowNode | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdateConfig: (nodeId: string, updates: Partial<WorkflowNode>) => void;
  onDeleteNode: (nodeId: string) => void;
}

export function NodeConfigPanel({
  node,
  open,
  onOpenChange,
  onUpdateConfig,
  onDeleteNode,
}: NodeConfigPanelProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [config, setConfig] = useState<Record<string, any>>({});

  useEffect(() => {
    if (node) {
      setTitle(node.title);
      setDescription(node.description || "");
      setConfig({ ...node.config });
    }
  }, [node]);

  if (!open || !node) return null;

  function handleSave() {
    if (!node) return;
    onUpdateConfig(node.id, {
      title,
      description,
      config,
    });
  }

  function handleConfigChange(key: string, value: any) {
    const updated = { ...config, [key]: value };
    setConfig(updated);
    if (node) {
      onUpdateConfig(node.id, { config: updated });
    }
  }

  function handleInsertVariable(fieldKey: string, vKey: string) {
    const updated = {
      ...config,
      [fieldKey]: (config[fieldKey] || "") + vKey,
    };
    setConfig(updated);
    if (node) {
      onUpdateConfig(node.id, { config: updated });
    }
  }

  return (
    <aside className="w-80 sm:w-96 border-l border-border bg-card flex flex-col h-full shrink-0 z-20 shadow-xl select-none transition-all">
      {/* Panel Header */}
      <div className="px-5 py-3.5 border-b border-border flex items-center justify-between bg-card shrink-0">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider bg-brand/10 text-brand border border-brand/20">
              {node.category} Step
            </span>
            <span
              className="text-[11px] font-mono text-muted-foreground truncate hover:text-foreground transition-colors cursor-default"
              title={`Step ID: ${node.id}`}
            >
              #{node.id.length > 8 ? node.id.slice(0, 8) : node.id}
            </span>
          </div>
          <h3 className="text-sm font-semibold tracking-tight text-foreground truncate mt-1">
            {node.title}
          </h3>
        </div>
        <button
          type="button"
          onClick={() => onOpenChange(false)}
          className="size-7 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors shrink-0 ml-2 cursor-pointer"
          title="Close configuration panel"
          aria-label="Close"
        >
          <X className="size-4" />
        </button>
      </div>

      {/* Panel Scrollable Content */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
        {/* General Title & Description */}
        <div className="space-y-3.5">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground tracking-tight">Step Title</label>
            <Input
              value={title}
              onChange={(e) => {
                const val = e.target.value;
                setTitle(val);
                if (node) onUpdateConfig(node.id, { title: val });
              }}
              className="h-8 text-xs bg-background rounded-md"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground tracking-tight">Step Notes</label>
            <Input
              value={description}
              onChange={(e) => {
                const val = e.target.value;
                setDescription(val);
                if (node) onUpdateConfig(node.id, { description: val });
              }}
              placeholder="Optional explanation of what this step does"
              className="h-8 text-xs bg-background rounded-md"
            />
          </div>
        </div>

        <div className="border-t border-border pt-4 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Step Parameters
            </span>
          </div>

          {/* ── TRIGGER CONFIGS ───────────────────────────── */}
          {node.type === "trigger_email_received" && (
            <>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground tracking-tight flex items-center justify-between">
                  <span>Sender Filter</span>
                  <span className="text-[11px] font-normal text-muted-foreground">Optional</span>
                </label>
                <Input
                  placeholder="e.g. @stripe.com or john@acme.com"
                  value={config.filterFrom || ""}
                  onChange={(e) => handleConfigChange("filterFrom", e.target.value)}
                  className="h-8 text-xs font-mono rounded-md"
                />
                <p className="text-[11px] text-muted-foreground leading-normal">
                  Leave blank to trigger on all senders.
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground tracking-tight flex items-center justify-between">
                  <span>Subject Contains</span>
                  <span className="text-[11px] font-normal text-muted-foreground">Optional</span>
                </label>
                <Input
                  placeholder="e.g. invoice, receipt, urgent"
                  value={config.filterSubject || ""}
                  onChange={(e) => handleConfigChange("filterSubject", e.target.value)}
                  className="h-8 text-xs rounded-md"
                />
                <p className="text-[11px] text-muted-foreground leading-normal">
                  Comma-separated list of keywords.
                </p>
              </div>
            </>
          )}

          {node.type === "trigger_schedule" && (
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground tracking-tight">
                Schedule Interval
              </label>
              <Select
                value={config.interval || "daily"}
                onValueChange={(val) => handleConfigChange("interval", val)}
              >
                <SelectTrigger className="h-8 text-xs rounded-md">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="hourly">Every hour</SelectItem>
                  <SelectItem value="daily">Daily at 9:00 AM</SelectItem>
                  <SelectItem value="weekly">Weekly on Monday</SelectItem>
                  <SelectItem value="custom">Custom Cron Expression</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {/* ── LOGIC CONFIGS ─────────────────────────────── */}
          {node.type === "logic_if_else" && (
            <>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-foreground tracking-tight">Variable to Check</label>
                  <VariablePicker onSelect={(v) => handleConfigChange("variable", v)} />
                </div>
                <Input
                  value={config.variable || "{{ai.category}}"}
                  onChange={(e) => handleConfigChange("variable", e.target.value)}
                  className="h-8 text-xs font-mono rounded-md"
                />
                <VariablePills
                  onSelect={(v) => handleConfigChange("variable", v)}
                  filterKeys={["{{ai.category}}", "{{email.subject}}", "{{email.from.address}}"]}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground tracking-tight">Condition Operator</label>
                <Select
                  value={config.operator || "equals"}
                  onValueChange={(val) => handleConfigChange("operator", val)}
                >
                  <SelectTrigger className="h-8 text-xs rounded-md">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="equals">Equals (==)</SelectItem>
                    <SelectItem value="not_equals">Does Not Equal (!=)</SelectItem>
                    <SelectItem value="contains">Contains substring</SelectItem>
                    <SelectItem value="starts_with">Starts with</SelectItem>
                    <SelectItem value="is_empty">Is Empty</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground tracking-tight">Target Value</label>
                <Input
                  placeholder="e.g. Billing or urgent"
                  value={config.value || ""}
                  onChange={(e) => handleConfigChange("value", e.target.value)}
                  className="h-8 text-xs font-mono rounded-md"
                />
              </div>
            </>
          )}

          {node.type === "logic_delay" && (
            <div className="grid grid-cols-2 gap-2.5">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground tracking-tight">Duration</label>
                <Input
                  type="number"
                  min={1}
                  value={config.amount || 15}
                  onChange={(e) => handleConfigChange("amount", Number(e.target.value))}
                  className="h-8 text-xs rounded-md"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground tracking-tight">Unit</label>
                <Select
                  value={config.unit || "minutes"}
                  onValueChange={(val) => handleConfigChange("unit", val)}
                >
                  <SelectTrigger className="h-8 text-xs rounded-md">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="minutes">Minutes</SelectItem>
                    <SelectItem value="hours">Hours</SelectItem>
                    <SelectItem value="days">Days</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {/* ── AI CONFIGS ────────────────────────────────── */}
          {node.type === "ai_classify" && (
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground tracking-tight">
                Classification Categories (comma-separated)
              </label>
              <Input
                value={
                  Array.isArray(config.categories)
                    ? config.categories.join(", ")
                    : config.categories || "Support, Sales, Billing, Other"
                }
                onChange={(e) =>
                  handleConfigChange(
                    "categories",
                    e.target.value.split(",").map((s) => s.trim()).filter(Boolean)
                  )
                }
                className="h-8 text-xs rounded-md"
              />
              <p className="text-[11px] text-muted-foreground leading-normal">
                AI will classify the email into one of these tags and save to{" "}
                <code className="font-mono text-foreground font-medium">&#123;&#123;ai.category&#125;&#125;</code>.
              </p>
            </div>
          )}

          {node.type === "ai_generate" && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-foreground tracking-tight">AI Generation Prompt</label>
                <VariablePicker onSelect={(v) => handleInsertVariable("prompt", v)} />
              </div>
              <Textarea
                rows={4}
                value={
                  config.prompt ||
                  "Draft a polite, helpful reply to {{email.from.name}} addressing their question in '{{email.text}}'. Sign off as the Customer Care Team."
                }
                onChange={(e) => handleConfigChange("prompt", e.target.value)}
                className="text-xs font-mono rounded-md resize-y leading-relaxed"
              />
              <VariablePills onSelect={(v) => handleInsertVariable("prompt", v)} />
            </div>
          )}

          {node.type === "ai_summarize" && (
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground tracking-tight">Summary Length</label>
              <Select
                value={config.length || "short"}
                onValueChange={(val) => handleConfigChange("length", val)}
              >
                <SelectTrigger className="h-8 text-xs rounded-md">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="short">1-2 sentences</SelectItem>
                  <SelectItem value="bullets">3 bullet points</SelectItem>
                  <SelectItem value="detailed">Detailed overview</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {/* ── EMAIL CONFIGS ─────────────────────────────── */}
          {(node.type === "email_send" || node.type === "email_reply") && (
            <>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-foreground tracking-tight">Recipient</label>
                  <VariablePicker onSelect={(v) => handleInsertVariable("recipient", v)} />
                </div>
                <Input
                  value={config.recipient || "{{email.from.address}}"}
                  onChange={(e) => handleConfigChange("recipient", e.target.value)}
                  className="h-8 text-xs font-mono rounded-md"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-foreground tracking-tight">Message Body Template</label>
                  <VariablePicker onSelect={(v) => handleInsertVariable("template", v)} />
                </div>
                <Textarea
                  rows={5}
                  value={
                    config.template ||
                    "Hi {{email.from.name}},\n\nThank you for reaching out regarding '{{email.subject}}'.\n\n{{ai.reply}}\n\nBest,\nMailing Support"
                  }
                  onChange={(e) => handleConfigChange("template", e.target.value)}
                  className="text-xs font-mono rounded-md resize-y leading-relaxed"
                />
                <VariablePills onSelect={(v) => handleInsertVariable("template", v)} />
              </div>
            </>
          )}

          {node.type === "email_add_label" && (
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground tracking-tight">Label Name</label>
              <Select
                value={config.label || "Work"}
                onValueChange={(val) => handleConfigChange("label", val)}
              >
                <SelectTrigger className="h-8 text-xs rounded-md">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Work">Work</SelectItem>
                  <SelectItem value="Personal">Personal</SelectItem>
                  <SelectItem value="Important">Important</SelectItem>
                  <SelectItem value="Finance">Finance</SelectItem>
                  <SelectItem value="Sales">Sales</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {/* ── TOOL CONFIGS ──────────────────────────────── */}
          {node.type === "tool_http_request" && (
            <>
              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1.5 col-span-1">
                  <label className="text-xs font-medium text-foreground tracking-tight">Method</label>
                  <Select
                    value={config.method || "POST"}
                    onValueChange={(val) => handleConfigChange("method", val)}
                  >
                    <SelectTrigger className="h-8 text-xs rounded-md">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="GET">GET</SelectItem>
                      <SelectItem value="POST">POST</SelectItem>
                      <SelectItem value="PUT">PUT</SelectItem>
                      <SelectItem value="DELETE">DELETE</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5 col-span-2">
                  <label className="text-xs font-medium text-foreground tracking-tight">URL</label>
                  <Input
                    value={config.url || "https://api.example.com/lead"}
                    onChange={(e) => handleConfigChange("url", e.target.value)}
                    className="h-8 text-xs font-mono rounded-md"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-foreground tracking-tight">JSON Body Payload</label>
                  <VariablePicker onSelect={(v) => handleInsertVariable("body", v)} />
                </div>
                <Textarea
                  rows={4}
                  value={
                    config.body ||
                    '{\n  "email": "{{email.from.address}}",\n  "name": "{{email.from.name}}",\n  "summary": "{{ai.summary}}"\n}'
                  }
                  onChange={(e) => handleConfigChange("body", e.target.value)}
                  className="text-xs font-mono rounded-md resize-y leading-relaxed"
                />
                <VariablePills onSelect={(v) => handleInsertVariable("body", v)} />
              </div>
            </>
          )}
        </div>
      </div>

      {/* Panel Footer */}
      <div className="px-5 py-3 border-t border-border bg-card flex items-center justify-between gap-2 shrink-0">
        {node.category !== "trigger" ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              onDeleteNode(node.id);
              onOpenChange(false);
            }}
            className="text-xs text-destructive hover:bg-destructive/10 gap-1.5 h-8 px-2.5 rounded-md font-medium"
          >
            <Trash2 className="size-3.5" /> Delete
          </Button>
        ) : (
          <div />
        )}
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="text-xs h-8 px-3.5 rounded-md font-medium border-border hover:bg-muted text-foreground"
          >
            Close
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() => {
              handleSave();
              onOpenChange(false);
            }}
            className="text-xs h-8 px-4 rounded-md font-semibold bg-primary text-primary-foreground hover:bg-primary/90 shadow-xs"
          >
            Done
          </Button>
        </div>
      </div>
    </aside>
  );
}
