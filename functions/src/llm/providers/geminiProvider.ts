/**
 * Gemini provider — implements LLMProvider using the @google/genai SDK.
 *
 * This is a server-side port of the core logic from the frontend's
 * services/geminiService.ts.  The API key is read from the environment
 * (config/env.ts) and NEVER exposed to the browser.
 *
 * Supported features:
 *   - Text-only generation
 *   - Multimodal generation (inline images via LLMRequest.parts)
 *   - Structured JSON output (via LLMRequest.responseSchema)
 *
 * Phase B: the router will select between GeminiProvider("gemini-3-flash-preview")
 * for free-tier tasks and GeminiProvider("gemini-3-pro-preview") for heavy reasoning.
 */

import { GoogleGenAI } from "@google/genai";
import { LLMProvider, LLMRequest, LLMResult } from "../LLMProvider";
import { getGeminiApiKey, getGeminiModel } from "../../config/env";

/**
 * Default model — read from the GEMINI_MODEL environment variable.
 * Never hardcoded; change functions/.env to switch models without touching code.
 *
 * Examples:
 *   GEMINI_MODEL=gemini-2.0-flash        → free tier (local dev default)
 *   GEMINI_MODEL=gemini-3-pro-preview    → paid tier (production / paid testing)
 *
 * Phase B: router.ts will pass the model per-task (free → paid cascade),
 * so DEFAULT_MODEL will only be used as the fallback for direct provider calls.
 */
const DEFAULT_MODEL = getGeminiModel();

/**
 * Extracts a JSON value from a string that may be wrapped in a markdown
 * code fence (```json ... ```) or contain leading prose.
 *
 * Ported from frontend services/geminiService.ts extractJson() so both sides
 * handle malformed responses the same way.
 */
function extractJson(str: string): unknown {
  const match = str.match(/```json\s*([\s\S]*?)\s*```/);
  let jsonStr = (match?.[1] ?? str).trim();

  const firstBracket = jsonStr.indexOf("{");
  const firstSquare = jsonStr.indexOf("[");

  let start = -1;
  if (firstBracket === -1) start = firstSquare;
  else if (firstSquare === -1) start = firstBracket;
  else start = Math.min(firstBracket, firstSquare);

  if (start === -1) {
    throw new Error("No JSON object or array found in the AI response.");
  }

  jsonStr = jsonStr.substring(start);

  try {
    return JSON.parse(jsonStr);
  } catch {
    try {
      // Strip trailing commas before closing brackets (common Gemini quirk)
      return JSON.parse(jsonStr.replace(/,(\s*[\]}])/g, "$1"));
    } catch {
      throw new Error(
        "The AI returned a response that could not be parsed as JSON."
      );
    }
  }
}

export class GeminiProvider implements LLMProvider {
  readonly name = "gemini";

  private readonly ai: GoogleGenAI;
  private readonly model: string;

  constructor(model: string = DEFAULT_MODEL) {
    this.ai = new GoogleGenAI({ apiKey: getGeminiApiKey() });
    this.model = model;
  }

  async generate(req: LLMRequest): Promise<LLMResult> {
    // Build the contents payload
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let contents: any;

    if (req.parts && req.parts.length > 0) {
      // Multimodal request: combine text prompt with inline data parts
      const textPart = { text: req.prompt };
      const binaryParts = req.parts
        .filter((p) => p.inlineData)
        .map((p) => ({ inlineData: p.inlineData! }));
      contents = { parts: [textPart, ...binaryParts] };
    } else {
      // Text-only: prepend system instruction if provided
      contents = req.system
        ? `${req.system}\n\n${req.prompt}`
        : req.prompt;
    }

    // Build the config object
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const config: Record<string, any> = {};
    if (req.responseSchema) {
      config.responseMimeType = "application/json";
      config.responseSchema = req.responseSchema;
    }
    if (req.useGoogleSearch) {
      config.tools = [{ googleSearch: {} }];
    }
    if (req.temperature !== undefined) {
      config.temperature = req.temperature;
    }

    const response = await this.ai.models.generateContent({
      model: this.model,
      contents,
      ...(Object.keys(config).length > 0 ? { config } : {}),
    });

    if (!response.text) {
      throw new Error("Gemini returned an empty response.");
    }

    const text = response.text;
    const raw = req.responseSchema ? extractJson(text) : undefined;
    const groundingChunks = req.useGoogleSearch
      ? response.candidates?.[0]?.groundingMetadata?.groundingChunks
      : undefined;

    return {
      text,
      raw,
      model: this.model,
      groundingChunks,
      usage: {
        inputTokens: response.usageMetadata?.promptTokenCount,
        outputTokens: response.usageMetadata?.candidatesTokenCount,
      },
    };
  }
}
