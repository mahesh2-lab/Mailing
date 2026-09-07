"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Play, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Automation,
  CustomTool,
  NodeCategory,
  NodePickerItem,
  NodeType,
  WorkflowEdge,
  WorkflowNode,
} from "./automation-types";
import { NodePicker } from "./node-picker";
import { WorkflowCanvas } from "./workflow-canvas";
import { NodeConfigPanel } from "./node-config-panel";
import { CustomToolDialog } from "./custom-tool-dialog";
import { toast } from "sonner";
import { generateId } from "@/lib/utils";

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

  // Sidebar collapse - start collapsed on mobile viewports
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined" && window.innerWidth < 768) {
      setSidebarCollapsed(true);
    }
  }, []);

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

  const handleSelectNode = useCallback((id: string | null) => {
    setSelectedNodeId(id);
    setConfigPanelOpen(Boolean(id));
  }, []);

  function handleUpdateNodeConfig(nodeId: string, updates: Partial<WorkflowNode>) {
    setAutomation((prev) => ({
      ...prev,
      nodes: prev.nodes.map((n) => (n.id === nodeId ? { ...n, ...updates } : n)),
    }));
  }

  const handleDeleteNode = useCallback((nodeId: string) => {
    setAutomation((prev) => ({
      ...prev,
      nodes: prev.nodes.filter((n) => n.id !== nodeId),
      edges: prev.edges.filter((e) => e.from !== nodeId && e.to !== nodeId),
    }));
    setSelectedNodeId((current) => (current === nodeId ? null : current));
    toast.success("Step removed from workflow");
  }, []);

  const handleUpdateNodePosition = useCallback(
    (id: string, pos: { x: number; y: number }) => {
      setAutomation((prev) => ({
        ...prev,
        nodes: prev.nodes.map((n) => (n.id === id ? { ...n, position: pos } : n)),
      }));
    },
    []
  );

  const handleConnectEdge = useCallback(
    (connection: { source: string; target: string }) => {
      setAutomation((prev) => {
        // Prevent duplicate edges between the same pair of nodes.
        const exists = prev.edges.some(
          (e) => e.from === connection.source && e.to === connection.target
        );
        if (exists) return prev;

        const newEdge: WorkflowEdge = {
          id: generateId(),
          from: connection.source,
          to: connection.target,
        };

        toast.success("Nodes connected");
        return { ...prev, edges: [...prev.edges, newEdge] };
      });
    },
    []
  );

  const handleDeleteEdge = useCallback((edgeId: string) => {
    setAutomation((prev) => {
      if (!prev.edges.some((e) => e.id === edgeId)) return prev;
      return { ...prev, edges: prev.edges.filter((e) => e.id !== edgeId) };
    });
  }, []);

  const handleAddChildNode = useCallback(
    (parentId: string, condition?: "true" | "false") => {
      setTargetParentId(parentId);
      setTargetBranchCondition(condition);
      toast.info("Select an action from the left sidebar to connect as next step");
    },
    []
  );

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

    const newId = generateId();
    const parentNode = targetParentId
      ? automation.nodes.find((n) => n.id === targetParentId)
      : selectedNodeId
      ? automation.nodes.find((n) => n.id === selectedNodeId)
      : automation.nodes[automation.nodes.length - 1];

    let posX = 260;
    let posY = 100;
    if (parentNode) {
      if (targetBranchCondition === "true") {
        posX = parentNode.position.x + 320;
        posY = parentNode.position.y - 100;
      } else if (targetBranchCondition === "false") {
        posX = parentNode.position.x + 320;
        posY = parentNode.position.y + 100;
      } else {
        posX = parentNode.position.x + 320;
        posY = parentNode.position.y;
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
        id: generateId(),
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

  const handleDropNode = useCallback(
    (item: NodePickerItem, position: { x: number; y: number }) => {
      // If dropping a trigger and a trigger already exists, update/replace it!
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
                    position,
                  }
                : n
            ),
          }));
          setSelectedNodeId(existingTrigger.id);
          setConfigPanelOpen(true);
          toast.success(`Trigger updated to "${item.title}"`);
          return;
        }
      }

      const newId = generateId();
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
        position,
      };

      setAutomation((prev) => ({
        ...prev,
        nodes: [...prev.nodes, newNode],
      }));

      setSelectedNodeId(newId);
      setConfigPanelOpen(true);
      toast.success(`Added "${newNode.title}" to workflow`);
    },
    [automation.nodes]
  );

  function handleSave() {
    onSaveAutomation(automation);
    toast.success("Workflow saved successfully");
  }

  return (
    <div className="flex-1 flex flex-col w-full h-full bg-background overflow-hidden select-none">
      {/* Top Builder Navigation & Actions Toolbar */}
      <div className="h-14 border-b border-border/60 px-3 sm:px-4 flex items-center justify-between gap-2 sm:gap-4 bg-background/70 backdrop-blur-2xl shrink-0 shadow-sm relative z-10">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            onClick={onBack}
            className="size-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-all shadow-xs shrink-0"
            title="Back to automations list"
          >
            <ArrowLeft className="size-4" />
          </Button>

          <div className="w-px h-5 bg-border/80 shrink-0" />

          <div className="flex items-center gap-2 min-w-0 flex-1">
            <Input
              value={automation.name}
              onChange={(e) => handleNameChange(e.target.value)}
              className="h-8 text-xs sm:text-sm font-semibold tracking-tight w-full max-w-37.5 sm:max-w-xs border-transparent hover:border-border/60 focus:border-brand/50 focus:bg-background/80 px-2 sm:px-2.5 rounded-lg transition-all bg-transparent truncate"
              placeholder="Workflow Name"
            />

            <button
              type="button"
              onClick={handleToggleEnabled}
              className={`hidden sm:inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border transition-all duration-300 cursor-pointer shadow-xs shrink-0 ${
                automation.enabled
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20"
                  : "bg-muted/60 text-muted-foreground border-border/80 hover:bg-muted hover:text-foreground"
              }`}
              title="Click to toggle status"
            >
              <span className="relative flex h-2 w-2">
                {automation.enabled && (
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                )}
                <span
                  className={`relative inline-flex rounded-full h-2 w-2 ${
                    automation.enabled ? "bg-emerald-500" : "bg-muted-foreground"
                  }`}
                ></span>
              </span>
              {automation.enabled ? "Active" : "Paused"}
            </button>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onRunTest(automation)}
            className="h-8 text-xs gap-1 sm:gap-1.5 px-2.5 sm:px-3 rounded-lg border-border/70 hover:bg-muted/80 text-foreground font-semibold shadow-xs transition-colors"
          >
            <Play className="size-3.5 text-brand" /> Test
          </Button>

          <Button
            type="button"
            size="sm"
            onClick={handleSave}
            className="h-8 text-xs gap-1 sm:gap-1.5 px-2.5 sm:px-3 rounded-lg bg-brand text-brand-fg hover:opacity-90 font-semibold shadow-md transition-opacity"
          >
            <Save className="size-3.5" /> Save
          </Button>
        </div>
      </div>

      {/* Main Builder Area: Node Palette (Left) + Full Canvas (Center) + Floating Overlay Config */}
      <div className="flex-1 flex w-full overflow-hidden relative">
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
          onConnectEdge={handleConnectEdge}
          onDeleteEdge={handleDeleteEdge}
          onDropNode={handleDropNode}
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
