"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Controls,
  ControlButton,
  Background,
  BackgroundVariant,
  Handle,
  Position,
  MarkerType,
  useReactFlow,
  useViewport,
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
import {
  NODE_DRAG_MIME,
  type NodePickerItem,
  type WorkflowEdge as WorkflowEdgeType,
  type WorkflowNode,
} from "./automation-types";
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
  onDropNode?: (item: NodePickerItem, position: { x: number; y: number }) => void;
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
    <div className="relative w-64 outline-none focus:outline-none">
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
        <span className="rounded-sm border border-border bg-background/80 px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-widest text-muted-foreground shadow-2xs backdrop-blur-sm">
          {node.category}
        </span>
        {node.branch && node.branch !== "main" && (
          <span
            className={`rounded-sm border px-1.5 py-0.5 font-mono text-[9px] font-medium ${
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
  onDropNode,
}: WorkflowCanvasProps) {
  const { screenToFlowPosition } = useReactFlow();
  const [isDragOver, setIsDragOver] = useState(false);

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

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setIsDragOver(true);
  }, []);

  const onDragLeave = useCallback((event: React.DragEvent) => {
    if (!event.currentTarget.contains(event.relatedTarget as Element)) {
      setIsDragOver(false);
    }
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      setIsDragOver(false);
      const rawData = event.dataTransfer.getData(NODE_DRAG_MIME);
      if (!rawData) return;
      try {
        const item = JSON.parse(rawData) as NodePickerItem;
        const flowPosition = screenToFlowPosition({
          x: event.clientX,
          y: event.clientY,
        });
        // Center the 256px wide card on cursor
        const position = {
          x: Math.round(flowPosition.x - 128),
          y: Math.round(flowPosition.y - 28),
        };
        onDropNode?.(item, position);
      } catch (err) {
        console.error("Failed to parse dropped node data:", err);
      }
    },
    [screenToFlowPosition, onDropNode]
  );

  return (
    <div
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className={`relative h-full w-full flex-1 transition-colors duration-200 ${
        isDragOver ? "ring-2 ring-inset ring-brand/40 bg-brand/[0.02]" : ""
      }`}
    >
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
        defaultViewport={{ x: 0, y: 0, zoom: 1 }}
        fitView
        fitViewOptions={{ padding: 0.25, minZoom: 1, maxZoom: 1 }}
        minZoom={0.2}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
        className="bg-muted/10 [&_.react-flow\_\_node]:!outline-none [&_.react-flow\_\_node]:!shadow-none [&_.react-flow\_\_node:focus]:!outline-none [&_.react-flow\_\_node:focus-visible]:!outline-none [&_.react-flow\_\_node.selected]:!outline-none [&_.react-flow\_\_node.selected]:!shadow-none"
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
        >
          <ZoomLevelIndicator />
        </Controls>
      </ReactFlow>
    </div>
  );
}

function ZoomLevelIndicator() {
  const { zoom } = useViewport();
  const { zoomTo } = useReactFlow();
  const zoomPercent = Math.round(zoom * 100);

  return (
    <ControlButton
      onClick={() => zoomTo(1, { duration: 250 })}
      title="Zoom level. Click to reset to 100%"
      className="!font-mono !text-[10px] !font-medium"
    >
      {zoomPercent}%
    </ControlButton>
  );
}

export function WorkflowCanvas(props: WorkflowCanvasProps) {
  return (
    <ReactFlowProvider>
      <CanvasInner {...props} />
    </ReactFlowProvider>
  );
}
