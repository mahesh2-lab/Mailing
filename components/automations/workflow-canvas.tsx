"use client";

import { useMemo } from "react";
import {
  ArrowDown,
  ChevronDown,
  GitBranch,
  Plus,
  Trash2,
  Settings,
  Sparkles,
  MoreHorizontal,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { WorkflowEdge, WorkflowNode } from "./automation-types";
import { WorkflowNodeCard } from "./workflow-node";

interface WorkflowCanvasProps {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  selectedNodeId: string | null;
  onSelectNode: (id: string | null) => void;
  onDeleteNode: (id: string) => void;
  onAddChildNode: (parentId: string, condition?: "true" | "false") => void;
  onUpdateNodePosition?: (id: string, pos: { x: number; y: number }) => void;
}

export function WorkflowCanvas({
  nodes,
  edges,
  selectedNodeId,
  onSelectNode,
  onDeleteNode,
  onAddChildNode,
}: WorkflowCanvasProps) {
  // Sort or sequence nodes based on edge dependencies or order
  const orderedNodes = useMemo(() => {
    if (nodes.length === 0) return [];
    
    // Build adjacency list
    const incomingCount = new Map<string, number>();
    const childrenMap = new Map<string, { to: string; condition?: string; label?: string }[]>();

    nodes.forEach((n) => {
      incomingCount.set(n.id, 0);
      childrenMap.set(n.id, []);
    });

    edges.forEach((e) => {
      incomingCount.set(e.to, (incomingCount.get(e.to) || 0) + 1);
      const list = childrenMap.get(e.from) || [];
      list.push({ to: e.to, condition: e.condition, label: e.label });
      childrenMap.set(e.from, list);
    });

    // Root nodes (triggers, or no incoming edge)
    const roots = nodes.filter((n) => (incomingCount.get(n.id) || 0) === 0);
    const visited = new Set<string>();
    const result: WorkflowNode[] = [];

    function traverse(nodeId: string) {
      if (visited.has(nodeId)) return;
      visited.add(nodeId);
      const node = nodes.find((n) => n.id === nodeId);
      if (node) result.push(node);

      const children = childrenMap.get(nodeId) || [];
      children.forEach((c) => traverse(c.to));
    }

    roots.forEach((r) => traverse(r.id));
    // Append any disconnected nodes
    nodes.forEach((n) => {
      if (!visited.has(n.id)) result.push(n);
    });

    return result;
  }, [nodes, edges]);

  return (
    <div
      onClick={() => onSelectNode(null)}
      className="flex-1 overflow-y-auto bg-muted/20 select-none p-6 sm:p-10 flex flex-col items-center min-h-full"
    >
      <div className="w-full max-w-xl flex flex-col items-center py-6">
        {orderedNodes.map((node, index) => {
          const isSelected = selectedNodeId === node.id;
          const isTrigger = node.category === "trigger" || index === 0;
          const isIfElse = node.type === "logic_if_else";

          return (
            <div
              key={node.id}
              className="w-full flex flex-col items-center relative group"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Step Sequence Badge (above node) */}
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[10px] font-bold font-mono uppercase tracking-widest px-2 py-0.5 rounded-full bg-background border border-border text-muted-foreground shadow-2xs">
                  Step {index + 1} • {node.category}
                </span>
                {node.branch && (
                  <Badge
                    variant="outline"
                    className={`text-[9px] px-1.5 py-0 h-4 font-mono font-medium rounded-full ${
                      node.branch === "true"
                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                        : "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30"
                    }`}
                  >
                    Branch: {node.branch === "true" ? "Yes / True" : "No / False"}
                  </Badge>
                )}
              </div>

              {/* Node Card - clean full width inside the max-w-xl container */}
              <div className="w-full max-w-md">
                <WorkflowNodeCard
                  node={node}
                  selected={isSelected}
                  onSelect={onSelectNode}
                  onDelete={onDeleteNode}
                  onAddChild={onAddChildNode}
                />
              </div>

              {/* Connecting Vertical Line & Action Insertion Button */}
              {index < orderedNodes.length - 1 ? (
                <div className="flex flex-col items-center my-3 relative py-2">
                  <div className="w-[2px] h-8 bg-border transition-colors group-hover:bg-brand/50" />
                  <button
                    type="button"
                    onClick={() => onAddChildNode(node.id)}
                    className="size-7 rounded-full bg-background border border-border hover:border-brand hover:bg-brand hover:text-brand-fg text-muted-foreground shadow-xs grid place-items-center transition-all cursor-pointer hover:scale-110 my-1"
                    title="Insert step below"
                  >
                    <Plus className="size-3.5" />
                  </button>
                  <div className="w-[2px] h-8 bg-border transition-colors group-hover:bg-brand/50" />
                  <ArrowDown className="size-3.5 text-muted-foreground -mt-1" />
                </div>
              ) : (
                /* Bottom terminator + Add Step button */
                <div className="flex flex-col items-center mt-4">
                  <div className="w-[2px] h-6 bg-border" />
                  {isIfElse ? (
                    <div className="flex gap-3 mt-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="xs"
                        onClick={() => onAddChildNode(node.id, "true")}
                        className="text-xs h-8 border-emerald-500/40 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 gap-1.5"
                      >
                        <Plus className="size-3.5" /> Add True Step
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="xs"
                        onClick={() => onAddChildNode(node.id, "false")}
                        className="text-xs h-8 border-rose-500/40 text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 gap-1.5"
                      >
                        <Plus className="size-3.5" /> Add False Step
                      </Button>
                    </div>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => onAddChildNode(node.id)}
                      className="text-xs h-8 border-dashed border-border hover:border-brand hover:text-brand gap-1.5 mt-2 bg-background shadow-xs"
                    >
                      <Plus className="size-3.5" /> Add Next Step
                    </Button>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {orderedNodes.length === 0 && (
          <div className="text-center py-16 text-muted-foreground">
            <p className="text-sm font-medium">No steps in this automation.</p>
            <p className="text-xs mt-1">Pick a trigger from the left sidebar to start.</p>
          </div>
        )}
      </div>
    </div>
  );
}
