import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { getAuthSession } from "@/src/lib/require-auth";

const SYSTEM_INSTRUCTION = `
You are an expert Workflow Architect for an email automation SaaS platform called Mailing.
Convert user natural language instructions into a valid, executable automation workflow DAG.

The workflow consists of:
1. "name": A concise, professional title (e.g. "Lead Qualification & CRM Sync")
2. "description": A short explanation of the workflow
3. "nodes": An array of workflow nodes.
   - The first node MUST ALWAYS have category "trigger".
     Allowed trigger types:
     - "trigger_email_received" (Incoming email, config options: { filterSubject?: string, filterFrom?: string })
     - "trigger_email_sent" (Sent email)
     - "trigger_email_replied" (Reply received)
     - "trigger_schedule" (Schedule/cron, config: { cron?: string })
     - "trigger_webhook" (Inbound HTTP webhook)
   - Subsequent nodes are actions, logic, or tools:
     - "ai_classify": (category: "ai", config: { categories: string[] })
     - "ai_generate": (category: "ai", config: { prompt: string })
     - "ai_extract": (category: "ai", config: { schema: string })
     - "ai_summarize": (category: "ai", config: {})
     - "logic_if_else": (category: "logic", config: { variable: string, operator: "equals" | "contains" | "starts_with" | "not_equals", value: string })
     - "logic_filter": (category: "logic", config: { condition: string })
     - "logic_delay": (category: "logic", config: { minutes: number })
     - "email_send": (category: "email", config: { to?: string, subject?: string, body?: string })
     - "email_reply": (category: "email", config: { template?: string })
     - "email_forward": (category: "email", config: { forwardTo?: string })
     - "email_add_label": (category: "email", config: { label?: string })
     - "email_archive": (category: "email", config: {})
     - "email_star": (category: "email", config: {})
     - "tool_http_request": (category: "tool", config: { method: "GET"|"POST"|"PUT"|"DELETE", url: string, headers?: string, body?: string })

4. "edges": Directed connections between steps:
   - [{ id: "e1", from: "node-1", to: "node-2" }, ...]

Nodes format:
{
  "id": "node-1",
  "type": "<valid_type>",
  "category": "trigger" | "logic" | "ai" | "email" | "tool",
  "title": "<Concise Action Title>",
  "description": "<Short step description>",
  "config": { ... },
  "position": { "x": 260, "y": 40 + (index * 120) }
}

Respond ONLY with valid JSON matching:
{
  "name": string,
  "description": string,
  "nodes": [...],
  "edges": [...]
}
`;

export async function POST(request: Request) {
  try {
    const session = await getAuthSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { prompt } = await request.json();

    if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
      return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { 
          error: "GEMINI_API_KEY is not configured in .env. Please add GEMINI_API_KEY=your_key to your .env file." 
        }, 
        { status: 503 }
      );
    }

    const ai = new GoogleGenAI({ apiKey });

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Create an automation workflow for the following requirement:\n\n"${prompt}"`,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        temperature: 0.2,
      },
    });

    const text = response.text?.trim() || "{}";
    const parsed = JSON.parse(text);

    if (!parsed.nodes || !Array.isArray(parsed.nodes) || parsed.nodes.length === 0) {
      throw new Error("AI did not generate valid nodes");
    }

    // Ensure first node is a trigger
    if (parsed.nodes[0] && parsed.nodes[0].category !== "trigger") {
      parsed.nodes[0].category = "trigger";
      if (!parsed.nodes[0].type.startsWith("trigger")) {
        parsed.nodes[0].type = "trigger_email_received";
      }
    }

    return NextResponse.json({ data: parsed });
  } catch (error: any) {
    console.error("Gemini workflow generation error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to generate workflow via AI" },
      { status: 500 }
    );
  }
}
