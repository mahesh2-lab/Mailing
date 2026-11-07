import type { ExecutionContext, WorkflowNode } from "@/lib/automation-workflow";
import { resolveVariables } from "@/lib/automation-workflow";

const LOGIC_NODE_TYPES = new Set([
  "logic_if_else",
  "logic_filter",
  "logic_delay",
  "logic_loop",
]);

export function isLogicNodeType(type: string): boolean {
  return LOGIC_NODE_TYPES.has(type);
}

export function executeLogicNode(
  node: WorkflowNode,
  ctx: ExecutionContext,
  log: (message: string) => void,
  enforceDelay = true,
): {
  output: Record<string, unknown>;
  branch?: "true" | "false";
  blocked?: boolean;
} {
  if (node.type === "logic_if_else") {
    const value = resolveVariables(
      String(node.config?.variable || "{{ai.category}}"),
      ctx,
    );
    const target = String(node.config?.value ?? "");
    const operator = String(node.config?.operator || "equals");
    let passed: boolean;
    switch (operator) {
      case "equals":
        passed = value.toLowerCase() === target.toLowerCase();
        break;
      case "contains":
        passed = value.toLowerCase().includes(target.toLowerCase());
        break;
      case "starts_with":
        passed = value.toLowerCase().startsWith(target.toLowerCase());
        break;
      case "not_equals":
        passed = value.toLowerCase() !== target.toLowerCase();
        break;
      case "is_empty":
        passed = value.trim() === "";
        break;
      default:
        throw new Error(`Unsupported condition operator: ${operator}`);
    }
    log(
      `Condition evaluated: "${value}" ${operator} "${target}" -> ${passed ? "TRUE" : "FALSE"}`,
    );
    ctx.variables["{{logic.conditionPassed}}"] = passed;
    return {
      output: {
        variableValue: value,
        targetValue: target,
        operator,
        conditionPassed: passed,
      },
      branch: passed ? "true" : "false",
    };
  }

  if (node.type === "logic_filter") {
    const condition = resolveVariables(
      String(node.config?.condition || ""),
      ctx,
    )
      .trim()
      .toLowerCase();
    const passed =
      condition !== "" &&
      condition !== "false" &&
      condition !== "0" &&
      condition !== "no";
    log(`Filter condition "${condition}" -> ${passed ? "PASS" : "STOP"}`);
    return { output: { conditionPassed: passed }, blocked: !passed };
  }

  if (node.type === "logic_delay") {
    const amount = Number(node.config?.amount ?? node.config?.minutes ?? 15);
    const unit = String(node.config?.unit || "minutes");
    const multiplier =
      unit === "hours" ? 3_600_000 : unit === "days" ? 86_400_000 : 60_000;
    const delayMs = amount * multiplier;
    if (!Number.isFinite(delayMs) || amount <= 0 || delayMs > 86_400_000) {
      throw new Error("Delay must be positive and no longer than 24 hours");
    }
    log(
      enforceDelay
        ? `Waiting ${amount} ${unit}`
        : `Delay of ${amount} ${unit} skipped in simulation`,
    );
    return { output: { delay: amount, unit, delayMs, enforced: enforceDelay } };
  }

  if (node.type === "logic_loop") {
    log("Loop marker reached (iteration bounded by execution loop guard).");
    return { output: { loop: true } };
  }

  throw new Error(`Unsupported logic node type: ${node.type}`);
}
