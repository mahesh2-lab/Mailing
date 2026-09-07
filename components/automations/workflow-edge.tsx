"use client";

import { memo } from "react";
import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  type EdgeProps,
} from "@xyflow/react";
import { X } from "lucide-react";

/**
 * Concrete edge colours. We avoid `var(--brand)` here because arrow markers are
 * rendered in a shared SVG <defs> where CSS custom properties don't reliably
 * resolve — a literal hex keeps both the line and its arrowhead visible.
 */
export const EDGE_COLORS = {
  default: "#2563eb", // brand
  true: "#10b981", // emerald
  false: "#f43f5e", // rose
} as const;

export function edgeColor(condition?: "true" | "false" | "default") {
  return condition === "true"
    ? EDGE_COLORS.true
    : condition === "false"
    ? EDGE_COLORS.false
    : EDGE_COLORS.default;
}

export interface WorkflowEdgeData {
  label?: string;
  condition?: "true" | "false" | "default";
  onDelete?: (edgeId: string) => void;
  [key: string]: unknown;
}

/**
 * Custom edge: a smooth bezier with an arrowhead, an optional branch label,
 * and a delete button that appears on hover. Colour is driven by the branch
 * condition so True/False paths read at a glance.
 */
function WorkflowEdgeComponent({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  selected,
  markerEnd,
}: EdgeProps) {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const edgeData = (data ?? {}) as WorkflowEdgeData;
  const condition = edgeData.condition;
  const stroke = edgeColor(condition);

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          stroke,
          strokeWidth: selected ? 2.5 : 1.75,
          opacity: selected ? 1 : 0.85,
        }}
      />
      <EdgeLabelRenderer>
        <div
          className="nodrag nopan group/edgelabel absolute flex items-center gap-1"
          style={{
            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            pointerEvents: "all",
          }}
        >
          {edgeData.label && (
            <span
              className={`rounded-full border px-1.5 py-0.5 text-[9px] font-semibold shadow-2xs backdrop-blur-sm ${
                condition === "true"
                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                  : condition === "false"
                  ? "border-rose-500/40 bg-rose-500/10 text-rose-600 dark:text-rose-400"
                  : "border-border bg-background/90 text-muted-foreground"
              }`}
            >
              {edgeData.label}
            </span>
          )}
          {edgeData.onDelete && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                edgeData.onDelete?.(id);
              }}
              title="Remove connection"
              className={`grid size-4 place-items-center rounded-full border border-border bg-background text-muted-foreground shadow-sm transition-opacity hover:border-destructive/50 hover:text-destructive focus:opacity-100 group-hover/edgelabel:opacity-100 ${
                selected ? "opacity-100" : "opacity-0"
              }`}
            >
              <X className="size-2.5" />
            </button>
          )}
        </div>
      </EdgeLabelRenderer>
    </>
  );
}

export const WorkflowEdge = memo(WorkflowEdgeComponent);
