"use client";

import { useCallback, useEffect, useMemo } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Controls,
  Background,
  BackgroundVariant,
  Handle,
  Position,
  MarkerType,
  type NodeProps,
  type Node,
  type Edge,
  type NodeChange,
  type EdgeChange,
  type Connection,
  type IsValidConnection,
  useNodesState,
  useEdgesState,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { WorkflowEdge as WorkflowEdgeType, WorkflowNode } from "./automation-types";
import { WorkflowNodeCard } from "./workflow-node";
import { WorkflowEdge, edgeColor } from "./workflow-edge";

interface WorkflowCanvasProps {
  nodes: WorkflowNode[];
  edges: WorkflowEdgeType[];
  selectedNodeId: string | null;
  onSelectNode: (id: string | null) => void;
  onDeleteNode: (id: string) => void;
  onAddChildNode: (parentId: string, condition?: "true" | "false") => void;
  onUpdateNodePosition?: (id: string, pos: { x: number; y: number }) => void;
  onConnectEdge?: (connection: { source: string; target: string }) => void;
  onDeleteEdge?: (edgeId: string) => void;
}

type WorkflowNodeData = {
  node: WorkflowNode;
  onSelectNode: (id: string | null) => void;
  onDeleteNode: (id: string) => void;
  onAddChildNode: (parentId: string, condition?: "true" | "false") => void;
};

const HANDLE_CLASS =
  "!w-2.5 !h-2.5 !rounded-full !border-2 !border-background !bg-brand transition-transform hover:!scale-125";

/** Custom node that renders the existing card UI inside a React Flow node. */
function WorkflowFlowNode({ data, selected, isConnectable }: NodeProps<Node<WorkflowNodeData>>) {
  const { node } = data;

  return (
    <div className="relative w-64">
      {node.category !== "trigger" && (
        <Handle
          type="target"
          position={Position.Left}
          isConnectable={isConnectable}
          className={HANDLE_CLASS}
        />
      )}

      {/* Category / branch badge above the node */}
      <div className="pointer-events-none absolute -top-6 left-0 mb-1 flex w-full items-center gap-2">
        <span className="rounded border border-border bg-background/80 px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-widest text-muted-foreground shadow-2xs backdrop-blur-sm">
          {node.category}
        </span>
        {node.branch && node.branch !== "main" && (
          <span
            className={`rounded border px-1.5 py-0.5 font-mono text-[9px] font-medium ${
              node.branch === "true"
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                : "border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400"
            }`}
          >
            {node.branch === "true" ? "True" : "False"}
          </span>
        )}
      </div>

      <WorkflowNodeCard
        node={node}
        selected={Boolean(selected)}
        onSelect={data.onSelectNode}
        onDelete={data.onDeleteNode}
        onAddChild={data.onAddChildNode}
      />

      <Handle
        type="source"
        position={Position.Right}
        isConnectable={isConnectable}
        className={HANDLE_CLASS}
      />
    </div>
  );
}

function CanvasInner({
  nodes,
  edges,
  selectedNodeId,
  onSelectNode,
  onDeleteNode,
  onAddChildNode,
  onUpdateNodePosition,
  onConnectEdge,
  onDeleteEdge,
}: WorkflowCanvasProps) {
  const [rfNodes, setRfNodes, onNodesChangeCore] = useNodesState<Node<WorkflowNodeData>>([]);
  const [rfEdges, setRfEdges, onEdgesChangeCore] = useEdgesState<Edge>([]);

  const nodeTypes = useMemo(() => ({ workflowNode: WorkflowFlowNode }), []);
  const edgeTypes = useMemo(() => ({ workflow: WorkflowEdge }), []);

  // Sync parent `nodes` -> React Flow nodes, preserving RF internal state
  // (measured dimensions, dragging flags) so nodes don't jump on every render.
  useEffect(() => {
    setRfNodes((current) => {
      const byId = new Map(current.map((n) => [n.id, n]));
      return nodes.map((node) => {
        const existing = byId.get(node.id);
        const next: Node<WorkflowNodeData> = {
          id: node.id,
          type: "workflowNode",
          position: node.position,
          data: { node, onSelectNode, onDeleteNode, onAddChildNode },
          selected: selectedNodeId === node.id,
        };
        return existing ? { ...existing, ...next, measured: existing.measured } : next;
      });
    });
  }, [nodes, selectedNodeId, onSelectNode, onDeleteNode, onAddChildNode, setRfNodes]);

  // Sync parent `edges` -> React Flow edges.
  useEffect(() => {
    setRfEdges(
      edges.map((edge) => ({
        id: edge.id,
        source: edge.from,
        target: edge.to,
        type: "workflow",
        selectable: true,
        markerEnd: {
          type: MarkerType.ArrowClosed,
          width: 18,
          height: 18,
          color: edgeColor(edge.condition),
        },
        data: {
          label: edge.label,
          condition: edge.condition,
          onDelete: onDeleteEdge,
        },
      }))
    );
  }, [edges, onDeleteEdge, setRfEdges]);

  const onNodesChange = useCallback(
    (changes: NodeChange<Node<WorkflowNodeData>>[]) => {
      onNodesChangeCore(changes);
      if (!onUpdateNodePosition) return;
      for (const change of changes) {
        // Only persist once the drag completes to avoid flooding parent state.
        if (change.type === "position" && change.position && change.dragging === false) {
          onUpdateNodePosition(change.id, { x: change.position.x, y: change.position.y });
        }
      }
    },
    [onNodesChangeCore, onUpdateNodePosition]
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange<Edge>[]) => {
      onEdgesChangeCore(changes);
      if (!onDeleteEdge) return;
      for (const change of changes) {
        if (change.type === "remove") onDeleteEdge(change.id);
      }
    },
    [onEdgesChangeCore, onDeleteEdge]
  );

  const onConnect = useCallback(
    (connection: Connection) => {
      if (onConnectEdge && connection.source && connection.target) {
        onConnectEdge({ source: connection.source, target: connection.target });
      }
    },
    [onConnectEdge]
  );

  // Reject self-loops and duplicate connections at the interaction layer.
  const isValidConnection: IsValidConnection = useCallback(
    (connection) => {
      if (!connection.source || !connection.target) return false;
      if (connection.source === connection.target) return false;
      return !edges.some((e) => e.from === connection.source && e.to === connection.target);
    },
    [edges]
  );

  return (
    <div className="relative h-full w-full flex-1">
      <ReactFlow
        nodes={rfNodes}
        edges={rfEdges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        isValidConnection={isValidConnection}
        onPaneClick={() => onSelectNode(null)}
        defaultEdgeOptions={{ type: "workflow" }}
        connectionLineStyle={{ stroke: edgeColor(), strokeWidth: 2 }}
        deleteKeyCode={["Backspace", "Delete"]}
        fitView
        fitViewOptions={{ padding: 0.25 }}
        minZoom={0.2}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
        className="bg-muted/10"
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={24}
          size={2}
          className="text-muted-foreground/20"
        />
        <Controls
          className="!rounded-md !border-border !bg-card !shadow-sm [&_button]:!border-border [&_button]:!bg-card [&_button]:!text-foreground [&_button:hover]:!bg-muted"
          position="bottom-left"
          showInteractive={false}
        />
      </ReactFlow>
    </div>
  );
}

export function WorkflowCanvas(props: WorkflowCanvasProps) {
  return (
    <ReactFlowProvider>
      <CanvasInner {...props} />
    </ReactFlowProvider>
  );
}
