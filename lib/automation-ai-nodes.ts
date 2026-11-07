import { GoogleGenAI } from "@google/genai";
import type { ExecutionContext, WorkflowNode } from "@/lib/automation-workflow";
import { resolveVariables } from "@/lib/automation-workflow";

function getGeminiClient() {
  const key = process.env.GEMINI_API_KEY;
  return key ? new GoogleGenAI({ apiKey: key }) : null;
}

function categoriesFor(node: WorkflowNode): string[] {
  const configured = node.config?.categories;
  const categories = Array.isArray(configured)
    ? configured.filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    : [];
  return categories.length ? categories : ["Billing", "General", "Support"];
}

export async function executeAiNode(
  node: WorkflowNode,
  ctx: ExecutionContext,
  log: (message: string) => void,
): Promise<Record<string, unknown>> {
  const gemini = getGeminiClient();

  if (node.type === "ai_classify") {
    const categories = categoriesFor(node);
    const text = `${ctx.email?.subject || ""} ${ctx.email?.text || ""}`.trim();
    let category = categories[0];
    let confidence = 0.95;
    let classifiedByAI = false;
    log(`Running AI classification against categories: [${categories.join(", ")}]`);

    if (gemini && text) {
      try {
        const response = await gemini.models.generateContent({
          model: "gemini-2.5-flash",
          contents: `Classify this email into exactly one of these categories: [${categories.join(", ")}].\n\nSubject: ${ctx.email?.subject || ""}\nBody: ${ctx.email?.text || ""}\n\nRespond with ONLY the exact category name.`,
          config: { temperature: 0.1 },
        });
        const predicted = response.text?.trim().toLowerCase();
        const match = categories.find((value) => value.toLowerCase() === predicted);
        if (match) {
          category = match;
          confidence = 0.99;
          classifiedByAI = true;
          log(`Gemini successfully classified as: "${category}" (confidence: 99%)`);
        } else {
          log("Gemini returned no exact category match; using keyword fallback.");
        }
      } catch (error: unknown) {
        log(`Gemini classification failed; using keyword fallback: ${error instanceof Error ? error.message : "Unknown error"}`);
      }
    } else {
      log("Gemini is unavailable or the email has no text. Using keyword classification.");
    }

    if (!classifiedByAI) {
      const lowerText = text.toLowerCase();
      const match = categories.find((value) => lowerText.includes(value.toLowerCase()));
      if (match) {
        category = match;
        log(`Keyword match identified category: "${category}"`);
      }
    }
    ctx.variables["{{ai.category}}"] = category;
    return { classifiedCategory: category, confidence };
  }

  if (node.type === "ai_generate") {
    const promptInstruction = String(node.config?.prompt || "Draft an acknowledgment reply");
    let generated = `Thank you for contacting us regarding "${ctx.email?.subject || "your inquiry"}". We have received your message and will review it promptly.`;
    log(`Prompt instruction: "${promptInstruction.slice(0, 80)}..."`);
    if (gemini) {
      try {
        const response = await gemini.models.generateContent({
          model: "gemini-2.5-flash",
          contents: `You are an AI assistant for an email client.\nInstruction: ${promptInstruction}\n\nIncoming email:\nFrom: ${ctx.email?.from || "User"}\nSubject: ${ctx.email?.subject || ""}\nBody:\n${ctx.email?.text || ""}\n\nDraft a concise, professional reply. Return only the reply text:`,
          config: { temperature: 0.3 },
        });
        if (response.text?.trim()) generated = response.text.trim();
      } catch (error: unknown) {
        log(`Gemini generation failed; using the default reply: ${error instanceof Error ? error.message : "Unknown error"}`);
      }
    } else {
      log("Gemini API key not configured. Using standard template reply.");
    }
    ctx.variables["{{ai.reply}}"] = generated;
    return { generatedReply: generated };
  }

  if (node.type === "ai_summarize") {
    let summary = `Email from ${ctx.email?.from || "sender"} discussing: ${ctx.email?.subject || "General inquiry"}.`;
    if (gemini && ctx.email?.text) {
      try {
        const response = await gemini.models.generateContent({
          model: "gemini-2.5-flash",
          contents: `Summarize this email in 1-2 bullet points:\nSubject: ${ctx.email.subject}\nBody: ${ctx.email.text}\n\nSummary:`,
          config: { temperature: 0.2 },
        });
        if (response.text?.trim()) summary = response.text.trim();
      } catch (error: unknown) {
        log(`Gemini summary failed; using a basic summary: ${error instanceof Error ? error.message : "Unknown error"}`);
      }
    }
    ctx.variables["{{ai.summary}}"] = summary;
    return { summary };
  }

  if (node.type === "ai_extract") {
    const schema = String(node.config?.schema || "{}");
    const source = `${ctx.email?.subject || ""}\n${ctx.email?.text || ""}`.trim();
    if (!source) throw new Error("AI extraction requires email content");
    if (!gemini) throw new Error("GEMINI_API_KEY is required for AI extraction");
    const response = await gemini.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Extract data from this email as JSON matching this schema. Return JSON only.\nSchema: ${schema}\nEmail:\n${source}`,
      config: { temperature: 0.1, responseMimeType: "application/json" },
    });
    let extracted: unknown;
    try { extracted = JSON.parse(response.text || ""); }
    catch { throw new Error("AI extraction returned invalid JSON"); }
    ctx.variables["{{ai.extracted}}"] = JSON.stringify(extracted);
    return { extracted };
  }

  if (node.type === "ai_decision") {
    const value = resolveVariables(String(node.config?.variable || "{{ai.category}}"), ctx);
    const target = String(node.config?.value ?? "");
    const passed = value.toLowerCase() === target.toLowerCase();
    ctx.variables["{{ai.decision}}"] = passed;
    log(`AI decision condition: "${value}" equals "${target}" -> ${passed}`);
    return { decision: passed, branch: passed ? "true" : "false" };
  }

  throw new Error(`Unsupported AI node type: ${node.type}`);
}
