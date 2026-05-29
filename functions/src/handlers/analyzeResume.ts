/**
 * analyzeResume — HTTPS Callable Cloud Function.
 *
 * Secure replacement for the client-side geminiService.analyzeResume().
 * The Gemini API key never leaves the server.
 *
 * Flow: verify auth → call LLM → return result
 *
 * NOTE: Credit deduction is intentionally omitted in Phase A.
 *       Phase B (B2/B3) will add: deductCredits(uid, cost) BEFORE the LLM call.
 *       The TODO below marks the exact insertion point.
 *
 * Frontend integration:
 *   import { getFunctions, httpsCallable } from "firebase/functions";
 *   const fn = httpsCallable(getFunctions(), "analyzeResume");
 *   const result = await fn({ resumeText, marketName });
 *
 * Request shape: AnalyzeResumeRequest (see below)
 * Response shape: AnalysisResult (mirrors types.ts in the repo root)
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { Type } from "@google/genai";
import { requireAuth } from "../middleware/auth";
import { getProvider } from "../llm/router";

// ---------------------------------------------------------------------------
// Request / Response types
// (These mirror the types in the repo root types.ts.
//  If the frontend types change, update these in sync.)
// ---------------------------------------------------------------------------

interface ResumeImage {
  mimeType: string;
  data: string; // base64 encoded
}

interface AnalyzeResumeRequest {
  /** Plain text content of the resume. Provide this OR resumeImages — not both. */
  resumeText?: string;
  /** Base64-encoded resume images for multimodal analysis. */
  resumeImages?: ResumeImage[];
  /** Target job market, e.g. "Canada", "United States". Required. */
  marketName: string;
}

interface Improvement {
  area: string;
  suggestion: string;
}

interface AnalysisResult {
  score: number;
  summary: string;
  strengths: string[];
  improvements: Improvement[];
  keywords: string[];
  extractedText?: string;
}

// ---------------------------------------------------------------------------
// Gemini response schema — mirrors the schema in the frontend geminiService.ts
// ---------------------------------------------------------------------------
const ANALYSIS_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    score: { type: Type.NUMBER },
    summary: { type: Type.STRING },
    strengths: { type: Type.ARRAY, items: { type: Type.STRING } },
    improvements: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          area: { type: Type.STRING },
          suggestion: { type: Type.STRING },
        },
        required: ["area", "suggestion"],
      },
    },
    keywords: { type: Type.ARRAY, items: { type: Type.STRING } },
    extractedText: { type: Type.STRING },
  },
  required: ["score", "summary", "strengths", "improvements", "keywords"],
};

// ---------------------------------------------------------------------------
// Cloud Function
// ---------------------------------------------------------------------------
export const analyzeResumeFunction = onCall(async (request) => {
  // Step 1: Verify authentication
  // requireAuth throws HttpsError("unauthenticated") if the caller is not signed in.
  const uid = requireAuth(request);

  // Step 2: Validate input
  const data = request.data as AnalyzeResumeRequest;

  if (!data.marketName) {
    throw new HttpsError("invalid-argument", "marketName is required.");
  }

  const hasText = Boolean(data.resumeText?.trim());
  const hasImages = Array.isArray(data.resumeImages) && data.resumeImages.length > 0;

  if (!hasText && !hasImages) {
    throw new HttpsError(
      "invalid-argument",
      "Provide either resumeText or resumeImages."
    );
  }

  // Step 3: TODO — deduct credits before the LLM call (Phase B / B2-B3).
  // Insert here: await deductCredits(uid, TOOL_CREDIT_COSTS.RESUME_ANALYSIS);
  // The uid is available; cost table is in config/credits.ts on the frontend.
  void uid; // suppress unused-variable warning until Phase B wires this up

  // Step 4: Build the prompt
  const basePrompt = `Analyze this resume for the ${data.marketName} market. Provide a score (0-100), summary, strengths, improvements (area + suggestion), and keywords.`;

  let prompt: string;
  let parts: Array<{ inlineData: { mimeType: string; data: string } }> | undefined;

  if (hasImages) {
    // Multimodal: Gemini transcribes the images and analyzes
    prompt = `${basePrompt} Transcribe and analyze the resume from the provided images.`;
    parts = data.resumeImages!.map((img) => ({
      inlineData: { mimeType: img.mimeType, data: img.data },
    }));
  } else {
    // Text-only path
    prompt = `${basePrompt}\n\nResume:\n${data.resumeText}`;
  }

  // Step 5: Call the LLM through the router
  // Router returns GeminiProvider in Phase A; Phase B upgrades this to cascade routing.
  const provider = getProvider();
  const result = await provider.generate({
    prompt,
    parts,
    responseSchema: ANALYSIS_SCHEMA,
  });

  // Step 6: Return the structured result
  return result.raw as AnalysisResult;
});
