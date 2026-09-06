"use client";

import { useEffect, useCallback } from "react";
import {
  ReactFlow,
  Controls,
  Background,
  Handle,
  Position,
  NodeProps,
  Node,
  Edge,
  NodeChange,
  useNodesState,
  useEdgesState,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
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
  onConnectEdge?: (connection: { source: string; target: string }) => void;
}

// Custom Node wrapper to render our existing UI inside React Flow
const nodeTypes = {
  workflowNode: ({ data, selected, isConnectable }: NodeProps<Node<{
    node: WorkflowNode;
    onSelectNode: (id: string | null) => void;
    onDeleteNode: (id: string) => void;
    onAddChildNode: (parentId: string, condition?: "true" | "false") => void;
  }>>) => {
    return (
      <div className="relative w-64">
        {data.node.category !== "trigger" && (
          <Handle 
            type="target" 
            position={Position.Left} 
            isConnectable={isConnectable}
            className="w-2 h-4 rounded-sm border bg-muted-foreground" 
          />
        )}
        
        {/* Step Sequence Badge (above node) */}
        <div className="flex items-center gap-2 mb-1 absolute -top-6 left-0 w-full pointer-events-none">
          <span className="text-[9px] font-bold font-mono uppercase tracking-widest px-1.5 py-0.5 rounded bg-background/80 backdrop-blur-sm border border-border text-muted-foreground shadow-2xs">
            {data.node.category}
          </span>
          {data.node.branch && (
            <span
              className={`text-[9px] px-1.5 py-0.5 font-mono font-medium rounded border ${
                data.node.branch === "true"
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                  : "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30"
              }`}
            >
              {data.node.branch === "true" ? "True" : "False"}
            </span>
          )}
        </div>

        <WorkflowNodeCard
          node={data.node}
          selected={selected}
          onSelect={data.onSelectNode}
          onDelete={data.onDeleteNode}
          onAddChild={data.onAddChildNode}
        />
        
        <Handle 
          type="source" 
          position={Position.Right} 
          isConnectable={isConnectable}
          className="w-2 h-4 rounded-sm border bg-muted-foreground" 
        />
      </div>
    );
  }
};

export function WorkflowCanvas({
  nodes,
  edges,
  selectedNodeId,
  onSelectNode,
  onDeleteNode,
  onAddChildNode,
  onUpdateNodePosition,
  onConnectEdge,
}: WorkflowCanvasProps) {

  const [rfNodes, setRfNodes, onNodesChangeCore] = useNodesState<Node>([]);
  const [rfEdges, setRfEdges, onEdgesChangeCore] = useEdgesState<Edge>([]);

  // Sync external `nodes` to `rfNodes` while preserving React Flow internal properties (like `measured`)
  useEffect(() => {
    setRfNodes((currentRfNodes) => {
      const currentNodesMap = new Map(currentRfNodes.map(n => [n.id, n]));
      
      return nodes.map((node) => {
        const existingNode = currentNodesMap.get(node.id);
        const newNode: Node = {
          id: node.id,
          type: "workflowNode",
          position: node.position,
          data: {
            node,
            onSelectNode,
            onDeleteNode,
            onAddChildNode,
          },
          selected: selectedNodeId === node.id,
        };
        
        if (existingNode) {
          // Preserve React Flow's internal state (measured, dragging, etc.)
          return {
            ...existingNode,
            ...newNode,
            measured: existingNode.measured,
          };
        }
        return newNode;
      });
    });
  }, [nodes, selectedNodeId, onSelectNode, onDeleteNode, onAddChildNode, setRfNodes]);

  // Sync external `edges` to `rfEdges`
  useEffect(() => {
    setRfEdges(edges.map((edge) => ({
      id: edge.id,
      source: edge.from,
      target: edge.to,
      type: "default",
      label: edge.label,
      animated: true,
      style: { stroke: "hsl(var(--primary))", strokeWidth: 2, opacity: 0.6 },
      labelBgStyle: { fill: "hsl(var(--background))", stroke: "hsl(var(--border))" },
      labelStyle: { fill: "hsl(var(--foreground))", fontWeight: 500, fontSize: 11 },
    })));
  }, [edges, setRfEdges]);

  const onNodesChange = useCallback(
    (changes: NodeChange<Node>[]) => {
      // 1. Apply to internal React Flow state immediately for smooth dragging
      onNodesChangeCore(changes);
      
      // 2. Sync position back to parent so it saves properly
      if (onUpdateNodePosition) {
        changes.forEach((change) => {
          if (change.type === 'position' && change.position) {
             onUpdateNodePosition(change.id, { x: change.position.x, y: change.position.y });
          }
        });
      }
    },
    [onNodesChangeCore, onUpdateNodePosition]
  );

  return (
    <div className="flex-1 w-full h-full relative">
      <ReactFlow
        nodes={rfNodes}
        edges={rfEdges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChangeCore}
        onConnect={(params) => {
          if (onConnectEdge && params.source && params.target) {
            onConnectEdge({ source: params.source, target: params.target });
          }
        }}
        onPaneClick={() => onSelectNode(null)}
        fitView
        minZoom={0.2}
        maxZoom={2}
        className="bg-muted/10"
      >
        <Background gap={24} size={2} color="hsl(var(--muted-foreground))" style={{ opacity: 0.1 }} />
        <Controls 
          className="bg-card! border-border! shadow-sm! rounded-md! overflow-hidden" 
          position="bottom-left"
        />
      </ReactFlow>
    </div>
  );
}
