import { db } from "@/src";
import { automations, automationRuns, emails } from "@/src/db/schema";
import { and, eq, sql } from "drizzle-orm";

import axios from "axios";
import { GoogleGenAI } from "@google/genai";
import { logger } from "@/lib/logger";

function getGeminiClient() {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  return new GoogleGenAI({ apiKey: key });
}

const MAX_TOTAL_STEPS = 100;
const MAX_VISITS_PER_NODE = 10;

export interface ExecutionContext {
  email?: {
    id: string;
    from: string;
    to: string[];
    subject: string;
    text: string;
    html: string;
    labels?: string[];
  };
  triggerSource: string;
  variables: Record<string, any>;
  steps: {
    nodeId: string;
    nodeTitle: string;
    nodeType: string;
    status: "success" | "failed" | "skipped";
    durationMs: number;
    input: Record<string, any>;
    output?: Record<string, any>;
    error?: string;
    logs?: string[];
  }[];
  userId: string;
}

interface WorkflowNode {
  id: string;
  type: string;
  category?: string;
  title: string;
  config?: Record<string, any>;
}

interface WorkflowEdge {
  id?: string;
  from: string;
  to: string;
  condition?: "true" | "false" | "default" | null;
}

/**
 * Substitute {{token}} placeholders in a single pass so that a resolved value
 * which itself contains braces is never re-substituted by a later key.
 */
export function resolveVariables(
  template: string,
  ctx: ExecutionContext,
): string {
  if (!template || typeof template !== "string") return template || "";

  const map: Record<string, any> = {
    "{{email.from.name}}":
      ctx.email?.from?.split("<")[0]?.trim() || ctx.email?.from || "Friend",
    "{{email.from.address}}":
      ctx.email?.from?.match(/<([^>]+)>/)?.[1] || ctx.email?.from || "",
    "{{email.subject}}": ctx.email?.subject || "",
    "{{email.text}}": ctx.email?.text || "",
    "{{email.id}}": ctx.email?.id || "",
    "{{date.now}}": new Date().toLocaleString(),
    ...ctx.variables,
  };

  return template.replace(/\{\{[^}]+\}\}/g, (token) => {
    if (Object.prototype.hasOwnProperty.call(map, token)) {
      const v = map[token];
      return v !== undefined && v !== null ? String(v) : "";
    }
    // Unknown token: leave it intact rather than blanking it out.
    return token;
  });
}
  
export function isSafeHttpUrl(raw: string): { ok: boolean; reason?: string } {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return { ok: false, reason: "Invalid URL" };
  }

  if (u.protocol !== "http:" && u.protocol !== "https:") {
    return { ok: false, reason: `Blocked protocol "${u.protocol}"` };
  }

  const host = u.hostname.toLowerCase().replace(/^\[|\]$/g, "");

  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host.endsWith(".internal")
  ) {
    return { ok: false, reason: `Blocked internal host "${host}"` };
  }

  // IPv6 loopback / link-local (fe80::/10) / unique-local (fc00::/7)
  if (
    host === "::1" ||
    host === "::" ||
    host.startsWith("fe8") ||
    host.startsWith("fe9") ||
    host.startsWith("fea") ||
    host.startsWith("feb") ||
    host.startsWith("fc") ||
    host.startsWith("fd")
  ) {
    return { ok: false, reason: `Blocked IPv6 host "${host}"` };
  }

  const m = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (m) {
    const a = Number(m[1]);
    const b = Number(m[2]);
    if (
      a === 0 ||
      a === 127 || // loopback
      a === 10 || // private
      (a === 169 && b === 254) || // link-local incl. 169.254.169.254 metadata
      (a === 172 && b >= 16 && b <= 31) || // private
      (a === 192 && b === 168) || // private
      (a === 100 && b >= 64 && b <= 127) // CGNAT
    ) {
      return { ok: false, reason: `Blocked private/reserved IP "${host}"` };
    }
  }

  return { ok: true };
}

/**
 * Evaluate a trigger node's filters (sender / subject) against an email.
 * Used by the webhook to decide which automations actually apply to an inbound
 * email, so we don't fire — or record noisy runs for — every automation.
 */
export function matchesTrigger(
  auto: { nodes?: any },
  email: { from?: string; subject?: string } | undefined,
): boolean {
  if (!email) return true;
  const nodes = (auto.nodes as WorkflowNode[]) || [];
  const trigger = nodes.find((n) => n.category === "trigger") || nodes[0];
  if (!trigger || !trigger.config) return true;

  const { filterFrom, filterSubject } = trigger.config;

  if (filterFrom && typeof filterFrom === "string" && filterFrom.trim()) {
    const from = (email.from || "").toLowerCase();
    const senders = filterFrom
      .toLowerCase()
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (senders.length && !senders.some((s) => from.includes(s))) return false;
  }

  if (
    filterSubject &&
    typeof filterSubject === "string" &&
    filterSubject.trim()
  ) {
    const subject = (email.subject || "").toLowerCase();
    const keywords = filterSubject
      .toLowerCase()
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (keywords.length && !keywords.some((k) => subject.includes(k)))
      return false;
  }

  return true;
}

export async function executeAutomation(
  automationId: string,
  triggerPayload: {
    email?: any;
    triggerSource?: string;
    simulated?: boolean;
    jobId?: string;
  },
) {
  const startTime = Date.now();
  const auto = await db.query.automations.findFirst({
    where: eq(automations.id, automationId),
  });

  if (!auto) {
    throw new Error(`Automation not found: ${automationId}`);
  }

  const nodes = ((auto.nodes as WorkflowNode[]) || []).filter(Boolean);
  const edges = ((auto.edges as WorkflowEdge[]) || []).filter(Boolean);
  const nodeById = new Map<string, WorkflowNode>(nodes.map((n) => [n.id, n]));

  const ctx: ExecutionContext = {
    email: triggerPayload.email,
    triggerSource: triggerPayload.triggerSource || "Manual Test Execution",
    variables: {},
    steps: [],
    userId: auto.userId,
  };

  if (ctx.email) {
    ctx.variables["{{email.from.name}}"] =
      ctx.email.from?.split("<")[0]?.trim() || ctx.email.from || "Friend";
    ctx.variables["{{email.from.address}}"] =
      ctx.email.from?.match(/<([^>]+)>/)?.[1] || ctx.email.from || "";
    ctx.variables["{{email.subject}}"] = ctx.email.subject || "";
    ctx.variables["{{email.text}}"] = ctx.email.text || "";
  }

  let executionFailed = false;
  let executionError: string | undefined;
  const executionLogs: string[] = [];

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

  addLog(`Starting workflow execution "${auto.name}" (ID: ${auto.id})`);
  addLog(
    `Trigger source: ${ctx.triggerSource} | Nodes: ${nodes.length} | Edges: ${edges.length}`,
  );
  if (ctx.email) {
    addLog(
      `Email context detected: "${ctx.email.subject || "No Subject"}" from <${ctx.email.from || "unknown"}>`,
    );
  }

  // Adjacency for graph traversal.
  const edgesByFrom = new Map<string, WorkflowEdge[]>();
  for (const e of edges) {
    if (!e.from || !e.to) continue;
    const list = edgesByFrom.get(e.from) || [];
    list.push(e);
    edgesByFrom.set(e.from, list);
  }

  // Track the branch a logic_if_else node took so we know which edge to follow.
  const branchTaken = new Map<string, "true" | "false">();
  // logic_filter / trigger gating can stop a path.
  const pathBlocked = new Set<string>();

  /**
   * Run a single node and record its step result. Returns false if a step error
   * aborted the run.
   */
  const runNode = async (
    node: WorkflowNode,
    stepIndex: number,
  ): Promise<boolean> => {
    const stepStart = Date.now();
    const input: Record<string, any> = { ...(node.config || {}) };
    let output: Record<string, any> = {};
    const stepLogs: string[] = [];

    const addStepLog = (msg: string) => {
      const ts = new Date().toISOString().split("T")[1].slice(0, 8);
      stepLogs.push(`[${ts}] ${msg}`);
      addLog(`[Step ${stepIndex}:${node.title}] ${msg}`);
    };

    addStepLog(`Executing node: ${node.title} (${node.type})`);

    try {
      if (node.category === "trigger") {
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
      } else if (node.type === "ai_classify") {
        const categories: string[] = node.config?.categories?.length
          ? node.config.categories
          : ["Billing", "General", "Support"];
        const textToAnalyze =
          `${ctx.email?.subject || ""} ${ctx.email?.text || ""}`.trim();
        let matchedCategory = categories[0];
        let confidence = 0.95;
        let classifiedByAI = false;

        addStepLog(
          `Running AI classification against categories: [${categories.join(", ")}]`,
        );

        const geminiClient = getGeminiClient();
        if (geminiClient && textToAnalyze) {
          try {
            addStepLog(
              "Calling Google Gemini (gemini-2.5-flash) for email classification...",
            );
            const prompt = `Classify this email into exactly one of these categories: [${categories.join(", ")}].\n\nSubject: ${ctx.email?.subject || ""}\nBody: ${ctx.email?.text || ""}\n\nRespond with ONLY the exact category name.`;
            const resp = await geminiClient.models.generateContent({
              model: "gemini-2.5-flash",
              contents: prompt,
              config: { temperature: 0.1 },
            });
            const predicted = resp.text?.trim() || "";
            const found = categories.find(
              (c) => c.toLowerCase() === predicted.toLowerCase(),
            );
            if (found) {
              matchedCategory = found;
              confidence = 0.99;
              classifiedByAI = true;
              addStepLog(
                `Gemini successfully classified as: "${matchedCategory}" (confidence: 99%)`,
              );
            } else {
              addStepLog(
                `Gemini returned "${predicted}", no exact category match; will fall back to heuristic`,
              );
            }
          } catch (aiErr: any) {
            addStepLog(
              `Gemini API call notice: ${aiErr.message || "Failed"}. Falling back to heuristic match.`,
            );
          }
        } else {
          addStepLog(
            "Gemini client not initialized or no text. Using keyword heuristic.",
          );
        }

        if (!classifiedByAI) {
          const lowerText = textToAnalyze.toLowerCase();
          for (const cat of categories) {
            if (lowerText.includes(cat.toLowerCase())) {
              matchedCategory = cat;
              addStepLog(
                `Keyword match identified category: "${matchedCategory}"`,
              );
              break;
            }
          }
        }

        ctx.variables["{{ai.category}}"] = matchedCategory;
        addStepLog(`Set variable {{ai.category}} = "${matchedCategory}"`);
        output = { classifiedCategory: matchedCategory, confidence };
      } else if (node.type === "ai_generate") {
        const promptInstruction = resolveVariables(
          node.config?.prompt || "Draft an acknowledgment reply",
          ctx,
        );
        let generated = `Thank you for contacting us regarding "${ctx.email?.subject || "your inquiry"}". We have received your message and will review it promptly.`;

        addStepLog(
          `Prompt instruction: "${promptInstruction.slice(0, 80)}..."`,
        );

        const geminiClient = getGeminiClient();
        if (geminiClient) {
          try {
            addStepLog("Calling Google Gemini to generate contextual reply...");
            const prompt = `You are an AI assistant for an email client.\nInstruction: ${promptInstruction}\n\nIncoming email:\nFrom: ${ctx.email?.from || "User"}\nSubject: ${ctx.email?.subject || ""}\nBody:\n${ctx.email?.text || ""}\n\nDraft a concise, professional reply. Return only the reply text:`;
            const resp = await geminiClient.models.generateContent({
              model: "gemini-2.5-flash",
              contents: prompt,
              config: { temperature: 0.3 },
            });
            if (resp.text?.trim()) {
              generated = resp.text.trim();
              addStepLog(`Gemini generated reply (${generated.length} chars)`);
            }
          } catch (aiErr: any) {
            addStepLog(
              `Gemini generation note: ${aiErr.message}. Using default template.`,
            );
          }
        } else {
          addStepLog(
            "Gemini API key not configured. Using standard template reply.",
          );
        }

        ctx.variables["{{ai.reply}}"] = generated;
        addStepLog("Set variable {{ai.reply}} with response text");
        output = { generatedReply: generated };
      } else if (node.type === "ai_summarize") {
        let summary = `Email from ${ctx.email?.from || "sender"} discussing: ${ctx.email?.subject || "General inquiry"}.`;

        const geminiClient = getGeminiClient();
        if (geminiClient && ctx.email?.text) {
          try {
            addStepLog("Calling Gemini to summarize email content...");
            const prompt = `Summarize this email in 1-2 bullet points:\nSubject: ${ctx.email?.subject}\nBody: ${ctx.email?.text}\n\nSummary:`;
            const resp = await geminiClient.models.generateContent({
              model: "gemini-2.5-flash",
              contents: prompt,
              config: { temperature: 0.2 },
            });
            if (resp.text?.trim()) {
              summary = resp.text.trim();
              addStepLog(`Generated summary: "${summary.slice(0, 60)}..."`);
            }
          } catch (aiErr: any) {
            addStepLog(`Gemini summary note: ${aiErr.message}`);
          }
        }

        ctx.variables["{{ai.summary}}"] = summary;
        output = { summary };
      } else if (node.type === "logic_if_else") {
        const rawVar = resolveVariables(
          node.config?.variable || "{{ai.category}}",
          ctx,
        );
        const targetVal = node.config?.value || "";
        const operator = node.config?.operator || "equals";

        let passed = false;
        if (operator === "equals")
          passed = rawVar.toLowerCase() === targetVal.toLowerCase();
        else if (operator === "contains")
          passed = rawVar.toLowerCase().includes(targetVal.toLowerCase());
        else if (operator === "starts_with")
          passed = rawVar.toLowerCase().startsWith(targetVal.toLowerCase());
        else if (operator === "not_equals")
          passed = rawVar.toLowerCase() !== targetVal.toLowerCase();
        else if (operator === "is_empty")
          passed = !rawVar || rawVar.trim() === "";

        branchTaken.set(node.id, passed ? "true" : "false");
        addStepLog(
          `Condition evaluated: "${rawVar}" ${operator} "${targetVal}" -> Result: ${passed ? "TRUE (branch: true)" : "FALSE (branch: false)"}`,
        );
        ctx.variables["{{logic.conditionPassed}}"] = passed;
        output = {
          variableValue: rawVar,
          targetValue: targetVal,
          operator,
          conditionPassed: passed,
        };
      } else if (node.type === "logic_filter") {
        const condition = resolveVariables(node.config?.condition || "", ctx)
          .trim()
          .toLowerCase();
        const passed =
          condition !== "" &&
          condition !== "false" &&
          condition !== "0" &&
          condition !== "no";
        addStepLog(
          `Filter condition "${condition}" -> ${passed ? "PASS (continue)" : "STOP (halt path)"}`,
        );
        if (!passed) pathBlocked.add(node.id);
        output = { conditionPassed: passed };
      } else if (node.type === "logic_delay") {
        const amount = node.config?.amount ?? node.config?.minutes ?? 15;
        const unit = node.config?.unit || "minutes";
        addStepLog(
          `Delay of ${amount} ${unit} requested. Delays are not enforced in synchronous execution; continuing immediately.`,
        );
        output = { delay: amount, unit, enforced: false };
      } else if (node.type === "logic_loop") {
        // Actual iteration is expressed via edges wired back into the graph and
        // is bounded by the walker's per-node visit cap. This node is a no-op marker.
        addStepLog(
          "Loop marker reached (iteration bounded by execution loop guard).",
        );
        output = { loop: true };
      } else if (node.type === "email_send" || node.type === "email_reply") {
        const recipient = resolveVariables(
          node.config?.recipient ||
            node.config?.to ||
            ctx.email?.from ||
            "test@heymahesh.in",
          ctx,
        );

        const emailSubject =
          node.type === "email_reply"
            ? ctx.email?.subject?.toLowerCase().startsWith("re:")
              ? ctx.email.subject
              : `Re: ${ctx.email?.subject || "Your Inquiry"}`
            : resolveVariables(
                node.config?.subject ||
                  (ctx.email?.subject
                    ? `Re: ${ctx.email.subject}`
                    : "Automated Response"),
                ctx,
              );

        const rawTemplate =
          node.config?.template ||
          node.config?.body ||
          (ctx.variables["{{ai.reply}}"]
            ? "{{ai.reply}}"
            : "Hi {{email.from.name}},\n\nThank you for reaching out. We have received your message and will get back to you shortly.\n\nBest regards,\nMailing Team");

        const templateBody = resolveVariables(rawTemplate, ctx);

        addStepLog(
          `Preparing dispatch to <${recipient}> with subject "${emailSubject}"`,
        );
        addStepLog(
          `Email body preview: "${templateBody.replace(/\n/g, " ").slice(0, 90)}..."`,
        );

        if (!triggerPayload.simulated) {
          try {
            addStepLog("Sending live email via internal API...");
            const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
            const res = await fetch(`${appUrl}/api/v1/messages`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "x-internal-token": process.env.INTERNAL_API_SECRET || "default-internal-secret-123",
              },
              body: JSON.stringify({
                userId: ctx.userId,
                to: [recipient],
                subject: emailSubject,
                text: templateBody,
                isDraft: node.type === "email_reply",
              }),
            });
            
            if (!res.ok) {
              const errData = await res.json().catch(() => ({}));
              throw new Error(errData.error || `HTTP error ${res.status}`);
            }
            
            addStepLog(
              `Email successfully delivered and stored via API to ${recipient}`,
            );
            output = {
              sentTo: recipient,
              subject: emailSubject,
              status: "delivered_via_api",
            };
          } catch (sendErr: any) {
            addStepLog(`API dispatch error: ${sendErr.message}`);
            output = {
              sentTo: recipient,
              subject: emailSubject,
              simulated: true,
              error: sendErr.message,
            };
          }
        } else {
          addStepLog(
            `Simulated dispatch to <${recipient}> (simulated test mode)`,
          );
          output = {
            sentTo: recipient,
            subject: emailSubject,
            status: "simulated_send_ok",
            text: templateBody,
          };
        }
      } else if (node.type === "email_add_label") {
        const labelToAdd = node.config?.label || "Automated";
        addStepLog(`Applying label "${labelToAdd}" to current thread`);
        if (ctx.email?.id) {
          try {
            const existing = await db.query.emails.findFirst({
              where: eq(emails.id, ctx.email.id),
            });
            if (existing) {
              const currentLabels = existing.labels || [];
              if (!currentLabels.includes(labelToAdd)) {
                await db
                  .update(emails)
                  .set({ labels: [...currentLabels, labelToAdd] })
                  .where(eq(emails.id, ctx.email.id));
                addStepLog(
                  `Updated database email record ${ctx.email.id} with label "${labelToAdd}"`,
                );
              }
            }
          } catch (lblErr: any) {
            addStepLog(`Label update notice: ${lblErr.message}`);
          }
        }
        output = { addedLabel: labelToAdd };
      } else if (node.type === "email_archive") {
        addStepLog("Moving email to Archive folder");
        if (ctx.email?.id) {
          try {
            await db
              .update(emails)
              .set({ folder: "archive" })
              .where(eq(emails.id, ctx.email.id));
            addStepLog(`Email ${ctx.email.id} marked as archived in database`);
          } catch {}
        }
        output = { archived: true };
      } else if (node.type === "email_star") {
        addStepLog("Marking email as Starred Priority");
        if (ctx.email?.id) {
          try {
            await db
              .update(emails)
              .set({ starred: true })
              .where(eq(emails.id, ctx.email.id));
            addStepLog(`Email ${ctx.email.id} starred`);
          } catch {}
        }
        output = { starred: true };
      } else if (node.type === "tool_http_request") {
        const url = resolveVariables(node.config?.url || "", ctx);
        const method = (node.config?.method || "POST").toUpperCase();
        addStepLog(`Preparing HTTP tool request: ${method} ${url}`);

        const safety = isSafeHttpUrl(url);
        if (!safety.ok) {
          addStepLog(`HTTP request rejected by SSRF guard: ${safety.reason}`);
          throw new Error(`Unsafe HTTP request URL: ${safety.reason}`);
        }

        let parsedBody: any = undefined;
        if (node.config?.body) {
          const resolvedBody = resolveVariables(node.config.body, ctx);
          try {
            parsedBody = JSON.parse(resolvedBody);
          } catch {
            addStepLog(
              "Request body is not valid JSON after variable resolution; sending as raw string.",
            );
            parsedBody = resolvedBody;
          }
        }

        if (url && !triggerPayload.simulated) {
          try {
            addStepLog(`Sending HTTP request to external endpoint ${url}...`);
            const response = await axios({
              url,
              method,
              data: parsedBody,
              timeout: 5000,
              maxRedirects: 0, // don't let a public URL redirect into an internal one
            });
            ctx.variables["{{tool.response}}"] = JSON.stringify(response.data);
            addStepLog(`HTTP request returned HTTP ${response.status} OK`);
            output = { status: response.status, data: response.data };
          } catch (reqErr: any) {
            addStepLog(`HTTP request failed: ${reqErr.message}`);
            output = { error: reqErr.message, simulatedFallback: true };
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
        addStepLog(`Node ${node.type} executed`);
        output = { processed: true };
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
      return true;
    } catch (stepErr: any) {
      executionFailed = true;
      executionError = stepErr.message;
      const stepDuration = Date.now() - stepStart;
      addStepLog(`Step failed with error: ${stepErr.message}`);

      ctx.steps.push({
        nodeId: node.id,
        nodeTitle: node.title,
        nodeType: node.type,
        status: "failed",
        durationMs: stepDuration,
        input,
        error: stepErr.message,
        logs: stepLogs,
      });
      return false;
    }
  };

  // Choose the starting node: the trigger, else the first node.
  const startNode = nodes.find((n) => n.category === "trigger") || nodes[0];

  if (startNode) {
    if (edges.length === 0) {
      // Legacy / linear workflows with no edges: execute in array order.
      addLog("No edges defined; executing nodes in linear order.");
      for (let i = 0; i < nodes.length; i++) {
        const ok = await runNode(nodes[i], i + 1);
        if (!ok) break;
        if (pathBlocked.has(nodes[i].id)) {
          addLog("Path halted by trigger/filter; stopping linear execution.");
          break;
        }
      }
    } else {
      // Edge-driven traversal honoring true/false branches, with loop guards.
      const queue: string[] = [startNode.id];
      const visitCounts = new Map<string, number>();
      let totalSteps = 0;

      while (queue.length > 0) {
        if (totalSteps >= MAX_TOTAL_STEPS) {
          executionFailed = true;
          executionError = `Workflow exceeded maximum step count (${MAX_TOTAL_STEPS}); aborted to prevent an infinite loop.`;
          addLog(executionError);
          break;
        }

        const nodeId = queue.shift()!;
        const node = nodeById.get(nodeId);
        if (!node) continue;

        const vc = (visitCounts.get(nodeId) || 0) + 1;
        visitCounts.set(nodeId, vc);
        if (vc > MAX_VISITS_PER_NODE) {
          addLog(
            `Loop guard: node "${node.title}" (${nodeId}) hit visit cap (${MAX_VISITS_PER_NODE}); stopping this path.`,
          );
          continue;
        }

        totalSteps++;
        const ok = await runNode(node, totalSteps);
        if (!ok) break; // hard step error aborts the whole run

        if (pathBlocked.has(nodeId)) {
          // Trigger/filter halted this path; do not follow outgoing edges.
          continue;
        }

        const outs = edgesByFrom.get(nodeId) || [];
        let nextEdges: WorkflowEdge[];
        if (node.type === "logic_if_else") {
          const taken = branchTaken.get(nodeId) || "false";
          const matching = outs.filter((e) => e.condition === taken);
          const unconditional = outs.filter(
            (e) => !e.condition || e.condition === "default",
          );
          nextEdges = matching.length ? matching : unconditional;
        } else {
          nextEdges = outs;
        }

        for (const e of nextEdges) {
          if (nodeById.has(e.to)) queue.push(e.to);
        }
      }
    }
  } else {
    addLog("Workflow has no nodes to execute.");
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

    // Update run metrics + real success rate from recorded runs.
    const currentCount = parseInt(auto.runCount || "0", 10) + 1;

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
        runCount: String(currentCount),
        successRate: String(successRate),
        lastRunAt: runRecord.startedAt,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(automations.id, auto.id));
  } catch (persistErr: any) {
    console.error(
      `[Automation:${auto.name}] Failed to persist run record:`,
      persistErr,
    );
  }

  return runRecord;
}
