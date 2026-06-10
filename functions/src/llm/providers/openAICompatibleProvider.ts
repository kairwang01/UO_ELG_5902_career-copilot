/**
 * OpenAICompatibleProvider — implements LLMProvider against any OpenAI-compatible
 * Chat Completions API (base URL + Bearer key + model). Used for the KAIRLLM
 * "auto" gateway today, and reusable for Qwen / DeepSeek / GPT / a user's custom
 * provider later — they all speak the same wire format.
 *
 * Supports: text generation, JSON output (response_format: json_object + parse),
 * and multimodal images (OpenAI vision content parts). Google-Search grounding is
 * Gemini-only, so useGoogleSearch is ignored here (no groundingChunks returned).
 */

import { LLMProvider, LLMRequest, LLMResult } from "../LLMProvider";

function extractJson(str: string): unknown {
  const match = str.match(/```json\s*([\s\S]*?)\s*```/);
  let jsonStr = (match?.[1] ?? str).trim();
  const b = jsonStr.indexOf("{");
  const a = jsonStr.indexOf("[");
  const start = b === -1 ? a : a === -1 ? b : Math.min(a, b);
  if (start === -1) throw new Error("No JSON object or array found in the AI response.");
  jsonStr = jsonStr.substring(start);
  try {
    return JSON.parse(jsonStr);
  } catch {
    try {
      return JSON.parse(jsonStr.replace(/,(\s*[\]}])/g, "$1"));
    } catch {
      throw new Error("The AI returned a response that could not be parsed as JSON.");
    }
  }
}

export class OpenAICompatibleProvider implements LLMProvider {
  readonly name: string;

  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly model: string;

  constructor(opts: { name?: string; baseUrl: string; apiKey: string; model: string }) {
    this.name = opts.name ?? "openai-compatible";
    this.baseUrl = opts.baseUrl.replace(/\/$/, "");
    this.apiKey = opts.apiKey;
    this.model = opts.model;
  }

  async generate(req: LLMRequest): Promise<LLMResult> {
    // Build the user message content — multimodal if image parts are present.
    let userContent: unknown;
    const images = (req.parts ?? []).filter((p) => p.inlineData);
    if (images.length > 0) {
      userContent = [
        { type: "text", text: req.prompt },
        ...images.map((p) => ({
          type: "image_url",
          image_url: { url: `data:${p.inlineData!.mimeType};base64,${p.inlineData!.data}` },
        })),
      ];
    } else if (req.responseSchema) {
      // Nudge the model toward strict JSON (no schema translation needed).
      userContent = `${req.prompt}\n\nRespond with ONLY a single valid JSON value. No prose, no markdown fences.`;
    } else {
      userContent = req.prompt;
    }

    const messages: Array<Record<string, unknown>> = [];
    if (req.system) messages.push({ role: "system", content: req.system });
    messages.push({ role: "user", content: userContent });

    const body: Record<string, unknown> = { model: this.model, messages };
    if (req.responseSchema) body.response_format = { type: "json_object" };
    if (req.temperature !== undefined) body.temperature = req.temperature;
    if (req.maxOutputTokens !== undefined) body.max_tokens = req.maxOutputTokens;

    const resp = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(60_000),
    });

    if (!resp.ok) {
      const detail = await resp.text().catch(() => "");
      throw new Error(`LLM provider error ${resp.status}: ${detail.slice(0, 500)}`);
    }

    const json: any = await resp.json();
    const text: string = json?.choices?.[0]?.message?.content ?? "";
    if (!text) throw new Error("The AI returned an empty response.");

    const raw = req.responseSchema ? extractJson(text) : undefined;

    return {
      text,
      raw,
      model: json?.model ?? this.model,
      usage: {
        inputTokens: json?.usage?.prompt_tokens,
        outputTokens: json?.usage?.completion_tokens,
      },
    };
  }
}
