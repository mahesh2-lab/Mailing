"use client";

import { useState } from "react";
import {
  ArrowLeft,
  Check,
  Play,
  Save,
  Wrench,
  Layers,
  Sparkles,
  Settings,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Automation,
  CustomTool,
  NodeCategory,
  NodeType,
  WorkflowEdge,
  WorkflowNode,
} from "./automation-types";
import { NodePicker } from "./node-picker";
import { WorkflowCanvas } from "./workflow-canvas";
import { NodeConfigPanel } from "./node-config-panel";
import { CustomToolDialog } from "./custom-tool-dialog";
import { toast } from "sonner";

interface AutomationBuilderProps {
  automation: Automation;
  customTools: CustomTool[];
  onSaveAutomation: (updated: Automation) => void;
  onSaveCustomTool: (tool: CustomTool) => void;
  onBack: () => void;
  onRunTest: (automation: Automation) => void;
}

export function AutomationBuilder({
  automation: initialAutomation,
  customTools,
  onSaveAutomation,
  onSaveCustomTool,
  onBack,
  onRunTest,
}: AutomationBuilderProps) {
  const [automation, setAutomation] = useState<Automation>(initialAutomation);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(
    initialAutomation.nodes[0]?.id || null
  );

  // Modals
  const [configPanelOpen, setConfigPanelOpen] = useState(false);
  const [customToolDialogOpen, setCustomToolDialogOpen] = useState(false);

  // Sidebar collapse
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Connecting context (if user clicked + on a specific node)
  const [targetParentId, setTargetParentId] = useState<string | null>(null);
  const [targetBranchCondition, setTargetBranchCondition] = useState<
    "true" | "false" | undefined
  >(undefined);

  const selectedNode =
    automation.nodes.find((n) => n.id === selectedNodeId) || null;

  function handleNameChange(name: string) {
    setAutomation((prev) => ({ ...prev, name }));
  }

  function handleToggleEnabled() {
    setAutomation((prev) => ({ ...prev, enabled: !prev.enabled }));
  }

  function handleSelectNode(id: string | null) {
    setSelectedNodeId(id);
    if (id) {
      setConfigPanelOpen(true);
    } else {
      setConfigPanelOpen(false);
    }
  }

  function handleUpdateNodeConfig(nodeId: string, updates: Partial<WorkflowNode>) {
    setAutomation((prev) => ({
      ...prev,
      nodes: prev.nodes.map((n) => (n.id === nodeId ? { ...n, ...updates } : n)),
    }));
    toast.success("Step updated");
  }

  function handleDeleteNode(nodeId: string) {
    setAutomation((prev) => ({
      ...prev,
      nodes: prev.nodes.filter((n) => n.id !== nodeId),
      edges: prev.edges.filter((e) => e.from !== nodeId && e.to !== nodeId),
    }));
    if (selectedNodeId === nodeId) {
      setSelectedNodeId(null);
    }
    toast.success("Step removed from workflow");
  }

  function handleUpdateNodePosition(id: string, pos: { x: number; y: number }) {
    setAutomation((prev) => ({
      ...prev,
      nodes: prev.nodes.map((n) => (n.id === id ? { ...n, position: pos } : n)),
    }));
  }

  function handleAddChildNode(parentId: string, condition?: "true" | "false") {
    setTargetParentId(parentId);
    setTargetBranchCondition(condition);
    toast.info("Select an action from the left sidebar to connect as next step");
  }

  function handleAddNodeFromPicker(item: {
    type: NodeType;
    category: NodeCategory;
    title: string;
    description: string;
    customTool?: CustomTool;
  }) {
    // If selecting a trigger and a root trigger already exists, update/replace the root trigger!
    if (item.category === "trigger") {
      const existingTriggerIndex = automation.nodes.findIndex(
        (n) => n.category === "trigger"
      );

      if (existingTriggerIndex !== -1) {
        const existingTrigger = automation.nodes[existingTriggerIndex];
        setAutomation((prev) => ({
          ...prev,
          nodes: prev.nodes.map((n, idx) =>
            idx === existingTriggerIndex
              ? {
                  ...n,
                  type: item.type,
                  title: item.title,
                  description: item.description,
                  config: {},
                }
              : n
          ),
        }));
        setSelectedNodeId(existingTrigger.id);
        setConfigPanelOpen(true);
        setTargetParentId(null);
        setTargetBranchCondition(undefined);
        toast.success(`Workflow trigger updated to "${item.title}"`);
        return;
      }
    }

    const newId = `node-${Date.now()}`;
    const parentNode = targetParentId
      ? automation.nodes.find((n) => n.id === targetParentId)
      : selectedNodeId
      ? automation.nodes.find((n) => n.id === selectedNodeId)
      : automation.nodes[automation.nodes.length - 1];

    let posX = 260;
    let posY = 100;
    if (parentNode) {
      if (targetBranchCondition === "true") {
        posX = parentNode.position.x - 140;
        posY = parentNode.position.y + 130;
      } else if (targetBranchCondition === "false") {
        posX = parentNode.position.x + 140;
        posY = parentNode.position.y + 130;
      } else {
        posX = parentNode.position.x;
        posY = parentNode.position.y + 120;
      }
    }

    const defaultNodeConfig = item.customTool
      ? {
          toolId: item.customTool.id,
          url: item.customTool.url,
          method: item.customTool.method,
        }
      : item.type === "email_send" || item.type === "email_reply"
      ? {
          recipient: "{{email.from.address}}",
          template: "{{ai.reply}}",
        }
      : {};

    const newNode: WorkflowNode = {
      id: newId,
      type: item.type,
      category: item.category,
      title: item.title,
      description: item.description,
      config: defaultNodeConfig,
      position: { x: posX, y: posY },
      branch: targetBranchCondition,
    };

    const newEdges = [...automation.edges];
    if (parentNode) {
      newEdges.push({
        id: `e-${Date.now()}`,
        from: parentNode.id,
        to: newId,
        condition: targetBranchCondition,
        label: targetBranchCondition === "true" ? "Yes" : targetBranchCondition === "false" ? "No" : undefined,
      });
    }

    setAutomation((prev) => ({
      ...prev,
      nodes: [...prev.nodes, newNode],
      edges: newEdges,
    }));

    setSelectedNodeId(newId);
    setConfigPanelOpen(true);
    setTargetParentId(null);
    setTargetBranchCondition(undefined);

    toast.success(`Added "${newNode.title}" to workflow`);
  }

  function handleSave() {
    onSaveAutomation(automation);
    toast.success("Workflow saved successfully");
  }

  return (
    <div className="flex-1 flex flex-col w-full h-full bg-background overflow-hidden select-none">
      {/* Top Builder Navigation & Actions Toolbar */}
      <div className="h-13 border-b border-border/70 px-4 flex items-center justify-between gap-4 bg-card/60 backdrop-blur-md shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            onClick={onBack}
            className="size-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors"
            title="Back to automations list"
          >
            <ArrowLeft className="size-4" />
          </Button>

          <div className="w-[1px] h-4 bg-border/80" />

          <div className="flex items-center gap-2 min-w-0">
            <Input
              value={automation.name}
              onChange={(e) => handleNameChange(e.target.value)}
              className="h-8 text-sm font-semibold tracking-tight max-w-[240px] sm:max-w-xs border-transparent hover:border-border/60 focus:border-border focus:bg-background/80 px-2.5 rounded-lg transition-all"
              placeholder="Workflow Name"
            />

            <button
              type="button"
              onClick={handleToggleEnabled}
              className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border transition-all cursor-pointer shadow-2xs ${
                automation.enabled
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/25 hover:bg-emerald-500/15"
                  : "bg-muted/60 text-muted-foreground border-border/70 hover:bg-muted"
              }`}
              title="Click to toggle status"
            >
              <span
                className={`size-1.5 rounded-full ${
                  automation.enabled ? "bg-emerald-500 animate-pulse" : "bg-muted-foreground"
                }`}
              />
              {automation.enabled ? "Active" : "Paused"}
            </button>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onRunTest(automation)}
            className="h-8 text-xs gap-1.5 rounded-lg border-border/70 hover:bg-muted/60 text-foreground font-medium shadow-2xs"
          >
            <Play className="size-3.5 text-brand" /> Test Workflow
          </Button>

          <Button
            type="button"
            size="sm"
            onClick={handleSave}
            className="h-8 text-xs gap-1.5 rounded-lg bg-brand text-brand-fg hover:opacity-95 font-medium shadow-xs"
          >
            <Save className="size-3.5" /> Save Changes
          </Button>
        </div>
      </div>

      {/* Main Builder Area: Node Palette (Left) + Canvas (Center) + Config Sidebar (Right) */}
      <div className="flex-1 flex overflow-hidden relative">
        <NodePicker
          onSelectNode={handleAddNodeFromPicker}
          customTools={customTools}
          onOpenCreateTool={() => setCustomToolDialogOpen(true)}
          isCollapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        />

        <WorkflowCanvas
          nodes={automation.nodes}
          edges={automation.edges}
          selectedNodeId={selectedNodeId}
          onSelectNode={handleSelectNode}
          onDeleteNode={handleDeleteNode}
          onAddChildNode={handleAddChildNode}
          onUpdateNodePosition={handleUpdateNodePosition}
        />

        {/* Docked Node Config Inspector on the Right */}
        <NodeConfigPanel
          node={selectedNode}
          open={configPanelOpen}
          onOpenChange={(isOpen) => {
            setConfigPanelOpen(isOpen);
            if (!isOpen) {
              setSelectedNodeId(null);
            }
          }}
          onUpdateConfig={handleUpdateNodeConfig}
          onDeleteNode={handleDeleteNode}
        />
      </div>

      {/* Custom Tool Creator Modal */}
      <CustomToolDialog
        open={customToolDialogOpen}
        onOpenChange={setCustomToolDialogOpen}
        onSave={onSaveCustomTool}
      />
    </div>
  );
}
