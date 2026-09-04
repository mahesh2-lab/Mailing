import { db } from "@/src";
import { automations, automationRuns, emails } from "@/src/db/schema";
import { eq } from "drizzle-orm";
import { resend } from "@/lib/resend";
import axios from "axios";
import { GoogleGenAI } from "@google/genai";

function getGeminiClient() {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  return new GoogleGenAI({ apiKey: key });
}

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
}

function resolveVariables(template: string, ctx: ExecutionContext): string {
  if (!template || typeof template !== "string") return template || "";
  let result = template;
  
  const map: Record<string, any> = {
    "{{email.from.name}}": ctx.email?.from?.split("<")[0]?.trim() || ctx.email?.from || "Friend",
    "{{email.from.address}}": ctx.email?.from?.match(/<([^>]+)>/)?.[1] || ctx.email?.from || "",
    "{{email.subject}}": ctx.email?.subject || "",
    "{{email.text}}": ctx.email?.text || "",
    "{{email.id}}": ctx.email?.id || "",
    "{{date.now}}": new Date().toLocaleString(),
    ...ctx.variables,
  };

  for (const [k, v] of Object.entries(map)) {
    result = result.split(k).join(v !== undefined && v !== null ? String(v) : "");
  }
  return result;
}

export async function executeAutomation(
  automationId: string,
  triggerPayload: {
    email?: any;
    triggerSource?: string;
    simulated?: boolean;
  }
) {
  const startTime = Date.now();
  const auto = await db.query.automations.findFirst({
    where: eq(automations.id, automationId),
  });

  if (!auto) {
    throw new Error(`Automation not found: ${automationId}`);
  }

  const nodes = (auto.nodes as any[]) || [];
  const edges = (auto.edges as any[]) || [];

  const ctx: ExecutionContext = {
    email: triggerPayload.email,
    triggerSource: triggerPayload.triggerSource || "Manual Test Execution",
    variables: {},
    steps: [],
  };

  if (ctx.email) {
    ctx.variables["{{email.from.name}}"] = ctx.email.from?.split("<")[0]?.trim() || ctx.email.from || "Friend";
    ctx.variables["{{email.from.address}}"] = ctx.email.from?.match(/<([^>]+)>/)?.[1] || ctx.email.from || "";
    ctx.variables["{{email.subject}}"] = ctx.email.subject || "";
    ctx.variables["{{email.text}}"] = ctx.email.text || "";
  }

  let executionFailed = false;
  let executionError: string | undefined;
  const executionLogs: string[] = [];

  const addLog = (msg: string) => {
    const timestamp = new Date().toISOString().split("T")[1].slice(0, 8);
    const line = `[${timestamp}] ${msg}`;
    executionLogs.push(line);
    console.log(`[Automation:${auto.name}] ${line}`);
  };

  addLog(`Starting workflow execution "${auto.name}" (ID: ${auto.id})`);
  addLog(`Trigger source: ${ctx.triggerSource} | Total steps: ${nodes.length}`);
  if (ctx.email) {
    addLog(`Email context detected: "${ctx.email.subject || 'No Subject'}" from <${ctx.email.from || 'unknown'}>`);
  }

  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    const stepStart = Date.now();
    const input: Record<string, any> = { ...node.config };
    let output: Record<string, any> = {};
    const stepLogs: string[] = [];

    const addStepLog = (msg: string) => {
      const ts = new Date().toISOString().split("T")[1].slice(0, 8);
      const entry = `[${ts}] ${msg}`;
      stepLogs.push(entry);
      addLog(`[Step ${i + 1}:${node.title}] ${msg}`);
    };

    addStepLog(`Executing node: ${node.title} (${node.type})`);

    try {
      if (node.category === "trigger") {
        if (node.type === "trigger_email_received" && node.config?.filterSubject && ctx.email?.subject) {
          const keywords = node.config.filterSubject.toLowerCase().split(",").map((s: string) => s.trim());
          const matches = keywords.some((k: string) => ctx.email?.subject?.toLowerCase().includes(k));
          addStepLog(`Evaluated subject filter [${node.config.filterSubject}] against "${ctx.email.subject}": ${matches ? "MATCHED" : "NO MATCH"}`);
          output = { matched: matches, filter: node.config.filterSubject };
        } else {
          addStepLog(`Trigger condition satisfied for ${node.type}`);
          output = { triggered: true, source: ctx.triggerSource };
        }
      } else if (node.type === "ai_classify") {
        const categories: string[] = node.config?.categories || ["Billing", "General", "Support"];
        const textToAnalyze = `${ctx.email?.subject || ""} ${ctx.email?.text || ""}`.trim();
        let matchedCategory = categories[0];
        let confidence = 0.95;

        addStepLog(`Running AI classification against categories: [${categories.join(", ")}]`);

        const geminiClient = getGeminiClient();
        if (geminiClient && textToAnalyze) {
          try {
            addStepLog("Calling Google Gemini (gemini-2.5-flash) for email classification...");
            const prompt = `Classify this email into exactly one of these categories: [${categories.join(", ")}].\n\nSubject: ${ctx.email?.subject || ""}\nBody: ${ctx.email?.text || ""}\n\nRespond with ONLY the exact category name.`;
            const resp = await geminiClient.models.generateContent({
              model: "gemini-2.5-flash",
              contents: prompt,
              config: { temperature: 0.1 },
            });
            const predicted = resp.text?.trim() || "";
            const found = categories.find((c) => c.toLowerCase() === predicted.toLowerCase());
            if (found) {
              matchedCategory = found;
              confidence = 0.99;
              addStepLog(`Gemini successfully classified as: "${matchedCategory}" (confidence: 99%)`);
            } else {
              addStepLog(`Gemini returned "${predicted}", using closest match`);
            }
          } catch (aiErr: any) {
            addStepLog(`Gemini API call notice: ${aiErr.message || "Failed"}. Falling back to heuristic match.`);
          }
        } else {
          addStepLog("Gemini client not initialized or no text. Using keyword heuristic.");
        }

        if (matchedCategory === categories[0]) {
          const lowerText = textToAnalyze.toLowerCase();
          for (const cat of categories) {
            if (lowerText.includes(cat.toLowerCase())) {
              matchedCategory = cat;
              addStepLog(`Keyword match identified category: "${matchedCategory}"`);
              break;
            }
          }
        }

        ctx.variables["{{ai.category}}"] = matchedCategory;
        addStepLog(`Set variable {{ai.category}} = "${matchedCategory}"`);
        output = { classifiedCategory: matchedCategory, confidence };
      } else if (node.type === "ai_generate") {
        const promptInstruction = resolveVariables(node.config?.prompt || "Draft an acknowledgment reply", ctx);
        let generated = `Thank you for contacting us regarding "${ctx.email?.subject || "your inquiry"}". We have received your message and will review it promptly.`;

        addStepLog(`Prompt instruction: "${promptInstruction.slice(0, 80)}..."`);

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
            addStepLog(`Gemini generation note: ${aiErr.message}. Using default template.`);
          }
        } else {
          addStepLog("Gemini API key not configured. Using standard template reply.");
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
        const rawVar = resolveVariables(node.config?.variable || "{{ai.category}}", ctx);
        const targetVal = node.config?.value || "";
        const operator = node.config?.operator || "equals";

        let passed = false;
        if (operator === "equals") passed = rawVar.toLowerCase() === targetVal.toLowerCase();
        else if (operator === "contains") passed = rawVar.toLowerCase().includes(targetVal.toLowerCase());
        else if (operator === "starts_with") passed = rawVar.toLowerCase().startsWith(targetVal.toLowerCase());
        else if (operator === "not_equals") passed = rawVar.toLowerCase() !== targetVal.toLowerCase();

        addStepLog(`Condition evaluated: "${rawVar}" ${operator} "${targetVal}" -> Result: ${passed ? "TRUE (Branch main/true)" : "FALSE (Branch false)"}`);
        ctx.variables["{{logic.conditionPassed}}"] = passed;
        output = { variableValue: rawVar, targetValue: targetVal, conditionPassed: passed };
      } else if (node.type === "email_send" || node.type === "email_reply") {
        const recipient = resolveVariables(
          node.config?.recipient || node.config?.to || ctx.email?.from || "test@heymahesh.in",
          ctx
        );

        const emailSubject = node.type === "email_reply" 
          ? (ctx.email?.subject?.toLowerCase().startsWith("re:") ? ctx.email.subject : `Re: ${ctx.email?.subject || "Your Inquiry"}`)
          : resolveVariables(node.config?.subject || (ctx.email?.subject ? `Re: ${ctx.email.subject}` : "Automated Response"), ctx);
        
        // Smart fallback: If template is not explicitly set, use {{ai.reply}} if an AI node ran, or an intelligent message
        const rawTemplate = node.config?.template || node.config?.body || (
          ctx.variables["{{ai.reply}}"]
            ? "{{ai.reply}}"
            : "Hi {{email.from.name}},\n\nThank you for reaching out. We have received your message and will get back to you shortly.\n\nBest regards,\nMailing Team"
        );

        const templateBody = resolveVariables(rawTemplate, ctx);

        addStepLog(`Preparing dispatch to <${recipient}> with subject "${emailSubject}"`);
        addStepLog(`Email body preview: "${templateBody.replace(/\n/g, " ").slice(0, 90)}..."`);

        if (!triggerPayload.simulated && process.env.RESEND_API_KEY) {
          try {
            addStepLog("Sending live email via Resend API...");
            await resend.emails.send({
              from: "Mahesh <mahesh@heymahesh.in>",
              to: [recipient],
              subject: emailSubject,
              text: templateBody,
            });
            addStepLog(`Email successfully delivered via Resend to ${recipient}`);
            output = { sentTo: recipient, subject: emailSubject, status: "delivered_via_resend" };
          } catch (sendErr: any) {
            addStepLog(`Resend API dispatch error: ${sendErr.message}`);
            output = { sentTo: recipient, subject: emailSubject, simulated: true, error: sendErr.message };
          }
        } else {
          addStepLog(`Simulated dispatch to <${recipient}> (simulated test mode)`);
          output = { sentTo: recipient, subject: emailSubject, status: "simulated_send_ok", text: templateBody };
        }
      } else if (node.type === "email_add_label") {
        const labelToAdd = node.config?.label || "Automated";
        addStepLog(`Applying label "${labelToAdd}" to current thread`);
        if (ctx.email?.id) {
          try {
            const existing = await db.query.emails.findFirst({ where: eq(emails.id, ctx.email.id) });
            if (existing) {
              const currentLabels = existing.labels || [];
              if (!currentLabels.includes(labelToAdd)) {
                await db.update(emails).set({ labels: [...currentLabels, labelToAdd] }).where(eq(emails.id, ctx.email.id));
                addStepLog(`Updated database email record ${ctx.email.id} with label "${labelToAdd}"`);
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
            await db.update(emails).set({ folder: "archive" }).where(eq(emails.id, ctx.email.id));
            addStepLog(`Email ${ctx.email.id} marked as archived in database`);
          } catch {}
        }
        output = { archived: true };
      } else if (node.type === "email_star") {
        addStepLog("Marking email as Starred Priority");
        if (ctx.email?.id) {
          try {
            await db.update(emails).set({ starred: true }).where(eq(emails.id, ctx.email.id));
            addStepLog(`Email ${ctx.email.id} starred`);
          } catch {}
        }
        output = { starred: true };
      } else if (node.type === "tool_http_request") {
        const url = resolveVariables(node.config?.url || "", ctx);
        const method = (node.config?.method || "POST").toUpperCase();
        addStepLog(`Preparing HTTP tool request: ${method} ${url}`);
        if (url && !triggerPayload.simulated) {
          try {
            addStepLog(`Sending HTTP request to external endpoint ${url}...`);
            const response = await axios({
              url,
              method,
              data: node.config?.body ? JSON.parse(resolveVariables(node.config.body, ctx)) : undefined,
              timeout: 5000,
            });
            ctx.variables["{{tool.response}}"] = JSON.stringify(response.data);
            addStepLog(`HTTP request returned HTTP ${response.status} OK`);
            output = { status: response.status, data: response.data };
          } catch (reqErr: any) {
            addStepLog(`HTTP request failed: ${reqErr.message}`);
            output = { error: reqErr.message, simulatedFallback: true };
          }
        } else {
          addStepLog(`HTTP request simulated: ${method} ${url} -> status 200 OK`);
          output = { url, method, simulated: true, status: 200, response: "OK" };
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
      break;
    }
  }

  const totalDuration = Date.now() - startTime;
  const runId = `run-${Date.now().toString().slice(-6)}`;
  addLog(`Workflow execution finished in ${totalDuration}ms with status: ${executionFailed ? "FAILED" : "SUCCESS"}`);

  // Record execution run in database
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

  await db.insert(automationRuns).values({
    id: runRecord.id,
    automationId: runRecord.automationId,
    automationName: runRecord.automationName,
    status: runRecord.status,
    triggerSource: runRecord.triggerSource,
    startedAt: runRecord.startedAt,
    durationMs: runRecord.durationMs,
    steps: runRecord.steps,
    error: runRecord.error,
  });

  // Update automation run metrics
  const currentCount = parseInt(auto.runCount || "0", 10) + 1;
  await db.update(automations).set({
    runCount: String(currentCount),
    lastRunAt: runRecord.startedAt,
    updatedAt: new Date().toISOString(),
  }).where(eq(automations.id, auto.id));

  return runRecord;
}
