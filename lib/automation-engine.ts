import { db } from "@/src";
import { automations, automationRuns, customTools, emails } from "@/src/db/schema";
import { and, eq, sql } from "drizzle-orm";

import { logger } from "@/lib/logger";
import { isSafeHttpUrl, requestSafeHttp } from "@/lib/safe-http-request";
import { executeAiNode } from "@/lib/automation-ai-nodes";
import { executeLogicNode, isLogicNodeType } from "@/lib/automation-logic-nodes";
import type { ExecutionContext, WorkflowEdge, WorkflowNode } from "@/lib/automation-workflow";
import { matchesTrigger, resolveVariables } from "@/lib/automation-workflow";
import { runWorkflowGraph, type WorkflowGraphState } from "@/lib/automation-graph";
import { decrypt } from "@/src/lib/crypto";
import { getResendClient } from "@/lib/resend";
import { automationQueue } from "@/lib/queue";
export { isSafeHttpUrl } from "@/lib/safe-http-request";
export { matchesTrigger, resolveVariables } from "@/lib/automation-workflow";
export type { ExecutionContext } from "@/lib/automation-workflow";

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error";
}

async function forwardAttachments(userId: string, emailId: string, attachments: { id: string; filename: string }[]) {
  if (!attachments.length) return [];
  const resend = await getResendClient(userId);
  if (!resend) throw new Error("Resend is not configured to fetch forwarded attachments");
  return Promise.all(attachments.map(async ({ id, filename }) => {
    const { data, error } = await resend.emails.receiving.attachments.get({ emailId, id });
    if (error || !data) throw new Error(`Failed to fetch forwarded attachment: ${filename}`);
    const attachment = data as { content?: string; download_url?: string; content_type?: string };
    let content = attachment.content;
    if (!content && attachment.download_url) {
      const safety = isSafeHttpUrl(attachment.download_url);
      if (!safety.ok) throw new Error(`Unsafe attachment URL: ${safety.reason}`);
      const response = await requestSafeHttp(attachment.download_url, "GET", undefined, {}, "arraybuffer");
      content = Buffer.from(response.data as ArrayBuffer).toString("base64");
    }
    if (!content) throw new Error(`Attachment content unavailable: ${filename}`);
    return { filename, content, type: attachment.content_type || "application/octet-stream" };
  }));
}

export async function executeAutomation(
  automationId: string,
  triggerPayload: {
    email?: ExecutionContext["email"];
    triggerSource?: string;
    simulated?: boolean;
    jobId?: string;
    webhook?: unknown;
    resumeState?: {
      startedAt: number;
      variables: Record<string, unknown>;
      steps: ExecutionContext["steps"];
      logs: string[];
      graph: WorkflowGraphState;
      branches: [string, "true" | "false"][];
      blocked: string[];
    };
  },
) {
  const simulated = triggerPayload.simulated !== false;
  const resume = triggerPayload.resumeState;
  const startTime = resume?.startedAt || Date.now();
  const auto = await db.query.automations.findFirst({
    where: eq(automations.id, automationId),
  });

  if (!auto) {
    throw new Error(`Automation not found: ${automationId}`);
  }

  const nodes = ((auto.nodes as WorkflowNode[]) || []).filter(Boolean);
  const edges = ((auto.edges as WorkflowEdge[]) || []).filter(Boolean);

  const ctx: ExecutionContext = {
    email: triggerPayload.email,
    triggerSource: triggerPayload.triggerSource || "Manual Test Execution",
    variables: resume?.variables || {},
    steps: resume?.steps || [],
    userId: auto.userId,
    webhook: triggerPayload.webhook,
  };

  if (!resume && ctx.email) {
    ctx.variables["{{email.from.name}}"] =
      ctx.email.from?.split("<")[0]?.trim() || ctx.email.from || "Friend";
    ctx.variables["{{email.from.address}}"] =
      ctx.email.from?.match(/<([^>]+)>/)?.[1] || ctx.email.from || "";
    ctx.variables["{{email.subject}}"] = ctx.email.subject || "";
    ctx.variables["{{email.text}}"] = ctx.email.text || "";
  }
  if (!resume && triggerPayload.webhook !== undefined) {
    ctx.variables["{{webhook.payload}}"] = JSON.stringify(triggerPayload.webhook);
  }

  let executionFailed = false;
  let executionError: string | undefined;
  const executionLogs: string[] = resume?.logs || [];

  const jobLogger = logger.child({
    automationId: auto.id,
    jobId: triggerPayload.jobId || "sync",
  });

  const addLog = (msg: string) => {
    const timestamp = new Date().toISOString().split("T")[1].slice(0, 8);
    const line = `[${timestamp}] ${msg}`;
    executionLogs.push(line);
    jobLogger.info(msg);
  };

  addLog(`${resume ? "Resuming" : "Starting"} workflow execution "${auto.name}" (ID: ${auto.id})`);
  addLog(
    `Trigger source: ${ctx.triggerSource} | Nodes: ${nodes.length} | Edges: ${edges.length}`,
  );
  if (ctx.email) {
    addLog(
      `Email context detected: "${ctx.email.subject || "No Subject"}" from <${ctx.email.from || "unknown"}>`,
    );
  }

  // Track the branch a logic_if_else node took so we know which edge to follow.
  const branchTaken = new Map<string, "true" | "false">(resume?.branches || []);
  // logic_filter / trigger gating can stop a path.
  const pathBlocked = new Set<string>(resume?.blocked || []);
  let requestedDelayMs = 0;

  /**
   * Run a single node and record its step result. Returns false if a step error
   * aborted the run.
   */
  const runNode = async (
    node: WorkflowNode,
    stepIndex: number,
  ): Promise<boolean | "paused"> => {
    const stepStart = Date.now();
    const input: Record<string, unknown> = { ...(node.config || {}) };
    let output: Record<string, unknown> = {};
    const stepLogs: string[] = [];

    const addStepLog = (msg: string) => {
      const ts = new Date().toISOString().split("T")[1].slice(0, 8);
      stepLogs.push(`[${ts}] ${msg}`);
      addLog(`[Step ${stepIndex}:${node.title}] ${msg}`);
    };

    addStepLog(`Executing node: ${node.title} (${node.type})`);

    try {
      if (node.category === "trigger") {
        const supportedLiveTrigger = node.type === "trigger_email_received" || node.type === "trigger_schedule" || node.type === "trigger_webhook";
        if (!simulated && !supportedLiveTrigger) {
          throw new Error(`Unsupported live trigger type: ${node.type}`);
        }
        if (!simulated && node.type === "trigger_email_received" && !ctx.email) {
          throw new Error("Live email trigger is missing its email context");
        }
        if (!simulated && node.type === "trigger_webhook" && ctx.webhook === undefined) throw new Error("Webhook trigger is missing its payload");
        const matched = matchesTrigger({ nodes: [node] }, ctx.email);
        if (!matched) {
          addStepLog(
            `Trigger filters did not match this email; downstream steps will be skipped`,
          );
          pathBlocked.add(node.id);
          output = { matched: false };
        } else {
          addStepLog(`Trigger condition satisfied for ${node.type}`);
          output = {
            matched: true,
            triggered: true,
            source: ctx.triggerSource,
          };
        }
      } else if (["ai_classify", "ai_generate", "ai_summarize", "ai_extract", "ai_decision"].includes(node.type)) {
        output = await executeAiNode(node, ctx, addStepLog);
        if (node.type === "ai_decision") branchTaken.set(node.id, output.branch as "true" | "false");
      } else if (isLogicNodeType(node.type)) {
        const result = executeLogicNode(node, ctx, addStepLog, !simulated);
        output = result.output;
        if (result.branch) branchTaken.set(node.id, result.branch);
        if (result.blocked) pathBlocked.add(node.id);
        if (node.type === "logic_delay" && !simulated) {
          requestedDelayMs = Number(result.output.delayMs);
        }
      } else if (node.type === "email_send" || node.type === "email_reply" || node.type === "email_forward") {
        const recipient = resolveVariables(
          String(node.config?.forwardTo || node.config?.recipient ||
            node.config?.to ||
            ctx.email?.from ||
            ""),
          ctx,
        );
        if (!recipient.trim()) throw new Error("Email action has no recipient configured");

        const emailSubject =
          node.type === "email_reply"
            ? ctx.email?.subject?.toLowerCase().startsWith("re:")
              ? ctx.email.subject
              : `Re: ${ctx.email?.subject || "Your Inquiry"}`
            : resolveVariables(
                String(node.config?.subject ||
                  (ctx.email?.subject
                    ? `${node.type === "email_forward" ? "Fwd" : "Re"}: ${ctx.email.subject}`
                    : "Automated Response")),
                ctx,
              );

        const rawTemplate = String(
          node.config?.template ||
          node.config?.body ||
          (ctx.variables["{{ai.reply}}"]
            ? "{{ai.reply}}"
            : "Hi {{email.from.name}},\n\nThank you for reaching out. We have received your message and will get back to you shortly.\n\nBest regards,\nMailing Team"),
        );

        const templateBody = node.type === "email_forward"
          ? `---------- Forwarded message ----------\nFrom: ${ctx.email?.from || ""}\nSubject: ${ctx.email?.subject || ""}\n\n${ctx.email?.text || ""}`
          : resolveVariables(rawTemplate, ctx);

        if (node.type === "email_forward" && !ctx.email) throw new Error("Email forward requires an email context");

        addStepLog(
          `Preparing dispatch to <${recipient}> with subject "${emailSubject}"`,
        );
        addStepLog(
          `Email body preview: "${templateBody.replace(/\n/g, " ").slice(0, 90)}..."`,
        );

        if (!simulated) {
          try {
            addStepLog("Sending live email via internal API...");
            const internalSecret = process.env.INTERNAL_API_SECRET;
            if (!internalSecret) throw new Error("INTERNAL_API_SECRET is not configured");
            const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
            const res = await fetch(`${appUrl}/api/v1/messages`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "x-internal-token": internalSecret,
              },
              body: JSON.stringify({
                userId: ctx.userId,
                to: [recipient],
                subject: emailSubject,
                text: templateBody,
                isDraft: node.type === "email_reply",
                ...(node.type === "email_forward" ? { attachments: await forwardAttachments(ctx.userId, ctx.email?.id || "", ctx.email?.attachments || []) } : {}),
              }),
            });
            
            if (!res.ok) {
              const errData = await res.json().catch(() => ({}));
              throw new Error(errData.error || `HTTP error ${res.status}`);
            }
            
            addStepLog(node.type === "email_reply"
              ? `Reply draft saved via API for ${recipient}`
              : `Email successfully sent via API to ${recipient}`);
            output = {
              sentTo: recipient,
              subject: emailSubject,
              status: node.type === "email_reply" ? "drafted_via_api" : "delivered_via_api",
            };
          } catch (sendErr: unknown) {
            const message = `Email dispatch failed: ${errorMessage(sendErr)}`;
            addStepLog(message);
            throw new Error(message, { cause: sendErr });
          }
        } else {
          addStepLog(
            `Simulated dispatch to <${recipient}> (simulated test mode)`,
          );
          output = {
            sentTo: recipient,
            subject: emailSubject,
            status: node.type === "email_reply" ? "simulated_reply_draft" : "simulated_send_ok",
            text: templateBody,
          };
        }
      } else if (node.type === "email_add_label") {
        const labelToAdd = String(node.config?.label || "Automated");
        addStepLog(`Applying label "${labelToAdd}" to current thread`);
        if (simulated) {
          output = { addedLabel: labelToAdd, simulated: true };
        } else if (ctx.email?.id) {
          const existing = await db.query.emails.findFirst({
            where: and(eq(emails.id, ctx.email.id), eq(emails.userId, ctx.userId)),
          });
          if (!existing) throw new Error("Email not found for automation user");
          const currentLabels = existing.labels || [];
          if (!currentLabels.includes(labelToAdd)) {
            const [updated] = await db
                .update(emails)
                .set({ labels: [...currentLabels, labelToAdd] })
                .where(and(eq(emails.id, ctx.email.id), eq(emails.userId, ctx.userId)))
                .returning({ id: emails.id });
            if (!updated) throw new Error("Email label update did not affect a message");
            addStepLog(`Updated database email record ${ctx.email.id} with label "${labelToAdd}"`);
          }
          output = { addedLabel: labelToAdd };
        } else {
          throw new Error("Email label action requires an email context");
        }
      } else if (node.type === "email_archive") {
        addStepLog("Moving email to Archive folder");
        if (simulated) {
          output = { archived: true, simulated: true };
        } else if (ctx.email?.id) {
          const [updated] = await db
            .update(emails)
            .set({ folder: "archive" })
            .where(and(eq(emails.id, ctx.email.id), eq(emails.userId, ctx.userId)))
            .returning({ id: emails.id });
          if (!updated) throw new Error("Email not found for automation user");
          addStepLog(`Email ${ctx.email.id} marked as archived in database`);
          output = { archived: true };
        } else {
          throw new Error("Archive action requires an email context");
        }
      } else if (node.type === "email_star") {
        addStepLog("Marking email as Starred Priority");
        if (simulated) {
          output = { starred: true, simulated: true };
        } else if (ctx.email?.id) {
          const [updated] = await db
            .update(emails)
            .set({ starred: true })
            .where(and(eq(emails.id, ctx.email.id), eq(emails.userId, ctx.userId)))
            .returning({ id: emails.id });
          if (!updated) throw new Error("Email not found for automation user");
          addStepLog(`Email ${ctx.email.id} starred`);
          output = { starred: true };
        } else {
          throw new Error("Star action requires an email context");
        }
      } else if (node.type === "tool_http_request" || node.type === "tool_webhook" || node.type === "tool_custom") {
        let config = node.config || {};
        if (node.type === "tool_custom") {
          const toolId = String(config.toolId || "");
          const [tool] = await db.select().from(customTools).where(and(eq(customTools.id, toolId), eq(customTools.userId, ctx.userId))).limit(1);
          if (!tool) throw new Error("Saved custom tool not found for automation owner");
          const authValue = tool.authValue ? (tool.authValue.startsWith("enc:v1:") ? await decrypt(tool.authValue.slice(7)) : tool.authValue) : "";
          const headers = await Promise.all((tool.headers || []).map(async ({ key, value }) => ({
            key,
            value: value.startsWith("enc:v1:") ? await decrypt(value.slice(7)) : value,
          })));
          config = { url: tool.url, method: tool.method, body: tool.bodyTemplate || "", authType: tool.authType, authValue, headers };
        }
        const url = resolveVariables(String(config.url || ""), ctx);
        const method = String(config.method || "POST").toUpperCase();
        addStepLog(`Preparing HTTP tool request: ${method} ${url}`);

        const safety = isSafeHttpUrl(url);
        if (!safety.ok) {
          addStepLog(`HTTP request rejected by SSRF guard: ${safety.reason}`);
          throw new Error(`Unsafe HTTP request URL: ${safety.reason}`);
        }

        let parsedBody: unknown;
        if (config.body) {
          const resolvedBody = resolveVariables(String(config.body), ctx);
          try {
            parsedBody = JSON.parse(resolvedBody);
          } catch {
            addStepLog(
              "Request body is not valid JSON after variable resolution; sending as raw string.",
            );
            parsedBody = resolvedBody;
          }
        }

        if (url && !simulated) {
          try {
            addStepLog(`Sending HTTP request to external endpoint ${url}...`);
            const headers: Record<string, string> = {};
            for (const item of (config.headers as { key: string; value: string }[] | undefined) || []) headers[item.key] = resolveVariables(item.value, ctx);
            const authValue = resolveVariables(String(config.authValue || ""), ctx);
            if (config.authType === "bearer") headers.Authorization = `Bearer ${authValue}`;
            else if (config.authType === "basic") headers.Authorization = `Basic ${Buffer.from(authValue).toString("base64")}`;
            else if (config.authType === "header" && authValue) headers["x-api-key"] = authValue;
            const response = await requestSafeHttp(url, method, parsedBody, headers);
            ctx.variables["{{tool.response}}"] = JSON.stringify(response.data);
            addStepLog(`HTTP request returned HTTP ${response.status} OK`);
            output = { status: response.status, data: response.data };
          } catch (reqErr: unknown) {
            const message = `HTTP request failed: ${errorMessage(reqErr)}`;
            addStepLog(message);
            throw new Error(message, { cause: reqErr });
          }
        } else {
          addStepLog(
            `HTTP request simulated: ${method} ${url} -> status 200 OK`,
          );
          output = {
            url,
            method,
            simulated: true,
            status: 200,
            response: "OK",
          };
        }
      } else {
        throw new Error(`Unsupported automation node type: ${node.type}`);
      }

      const stepDuration = Date.now() - stepStart;
      addStepLog(`Completed step ${node.title} in ${stepDuration}ms`);

      ctx.steps.push({
        nodeId: node.id,
        nodeTitle: node.title,
        nodeType: node.type,
        status: "success",
        durationMs: stepDuration,
        input,
        output,
        logs: stepLogs,
      });
      return requestedDelayMs > 0 ? "paused" : true;
    } catch (stepErr: unknown) {
      executionFailed = true;
      executionError = errorMessage(stepErr);
      const stepDuration = Date.now() - stepStart;
      addStepLog(`Step failed with error: ${executionError}`);

      ctx.steps.push({
        nodeId: node.id,
        nodeTitle: node.title,
        nodeType: node.type,
        status: "failed",
        durationMs: stepDuration,
        input,
        error: executionError,
        logs: stepLogs,
      });
      return false;
    }
  };

  const traversal = await runWorkflowGraph(
    nodes,
    edges,
    runNode,
    (nodeId) => pathBlocked.has(nodeId),
    (nodeId) => branchTaken.get(nodeId),
    addLog,
    resume?.graph,
  );
  if (traversal.paused && traversal.state) {
    try {
      await automationQueue.add("execute-automation", {
        automationId,
        triggerPayload: {
          email: ctx.email,
          webhook: ctx.webhook,
          triggerSource: ctx.triggerSource,
          simulated: false,
          resumeState: {
            startedAt: startTime,
            variables: ctx.variables,
            steps: ctx.steps,
            logs: executionLogs,
            graph: traversal.state,
            branches: [...branchTaken],
            blocked: [...pathBlocked],
          },
        },
      }, { delay: requestedDelayMs });
      return { id: triggerPayload.jobId || "", automationId, status: "waiting", steps: ctx.steps };
    } catch (error) {
      executionFailed = true;
      executionError = `Failed to schedule workflow continuation: ${errorMessage(error)}`;
      addLog(executionError);
    }
  }
  if (traversal.failed) {
    executionFailed = true;
    executionError = traversal.error || executionError;
  }
  const totalDuration = Date.now() - startTime;
  const runId = crypto.randomUUID();
  addLog(
    `Workflow execution finished in ${totalDuration}ms with status: ${executionFailed ? "FAILED" : "SUCCESS"}`,
  );

  const runRecord = {
    id: runId,
    automationId: auto.id,
    automationName: auto.name,
    status: executionFailed ? "failed" : "success",
    triggerSource: ctx.triggerSource,
    startedAt: new Date(startTime).toISOString(),
    durationMs: String(totalDuration),
    steps: ctx.steps,
    logs: executionLogs,
    error: executionError,
  };

  try {
    await db.insert(automationRuns).values({
      id: runRecord.id,
      userId: auto.userId,
      automationId: runRecord.automationId,
      automationName: runRecord.automationName,
      status: runRecord.status,
      triggerSource: runRecord.triggerSource,
      startedAt: runRecord.startedAt,
      durationMs: runRecord.durationMs,
      steps: runRecord.steps,
      error: runRecord.error,
    });

    // Count after insert so concurrent executions don't overwrite each other.
    const [{ total }] = await db
      .select({ total: sql<number>`count(*)` })
      .from(automationRuns)
      .where(eq(automationRuns.automationId, auto.id));
    const [{ succeeded }] = await db
      .select({ succeeded: sql<number>`count(*)` })
      .from(automationRuns)
      .where(
        and(
          eq(automationRuns.automationId, auto.id),
          eq(automationRuns.status, "success"),
        ),
      );

    const successRate =
      Number(total) > 0
        ? Math.round((Number(succeeded) / Number(total)) * 100)
        : 100;

    await db
      .update(automations)
      .set({
        runCount: String(Number(total)),
        successRate: String(successRate),
        lastRunAt: runRecord.startedAt,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(automations.id, auto.id));
  } catch (persistErr: unknown) {
    jobLogger.error({ error: errorMessage(persistErr) }, "Failed to persist automation run");
  }

  return runRecord;
}
