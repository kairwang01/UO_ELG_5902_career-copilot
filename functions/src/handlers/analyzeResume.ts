/**
 * analyzeResume — HTTPS Callable Cloud Function.
 *
 * Secure replacement for the client-side geminiService.analyzeResume().
 * The Gemini API key never leaves the server.
 *
 * Flow: verify auth → deduct credits → call LLM → return result
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
import { resolveProvider } from "../llm/models";
import { meterToolRun, refundCredits } from "../credits/deductCredits";
import { TOOL_CREDIT_COSTS } from "../credits/schema";
import { buildPrompt } from "../llm/prompts";
import { ensurePlatformCaches } from "../config/env";

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
  /** Client-generated idempotency key for one user action. */
  requestId?: string;
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
export const analyzeResumeFunction = onCall({ invoker: "public", timeoutSeconds: 180 }, async (request) => {
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

  // Step 3: Deduct credits BEFORE the LLM call — atomic, server-side, un-bypassable.
  // If the user has insufficient credits, this throws and the LLM is never called.
  const metered = await meterToolRun(uid, "resume-analysis", TOOL_CREDIT_COSTS["resume-analysis"], {
    requestId: data.requestId,
  });

  // Warm the cache so an admin prompt override applies even on a cold instance.
  await ensurePlatformCaches();

  // Step 4: Build the prompt
  let prompt: string;
  let parts: Array<{ inlineData: { mimeType: string; data: string } }> | undefined;

  if (hasImages) {
    // Multimodal: Gemini transcribes the images and analyzes
    prompt = buildPrompt("handler_resume_analysis_image", { marketName: data.marketName });
    parts = data.resumeImages!.map((img) => ({
      inlineData: { mimeType: img.mimeType, data: img.data },
    }));
  } else {
    // Text-only path: instruction template rendered, then resume appended exactly as before
    const basePrompt = buildPrompt("handler_resume_analysis", { marketName: data.marketName });
    prompt = `${basePrompt}\n\nResume:\n${data.resumeText}`;
  }

  // Step 5: Call the LLM through the router
  // Router returns GeminiProvider in Phase A; Phase B upgrades this to cascade routing.
  const provider = await resolveProvider(uid, (request.data as { model?: string })?.model);
  try {
    const result = await provider.generate({
      prompt,
      parts,
      responseSchema: ANALYSIS_SCHEMA,
    });

    // Step 6: Return the structured result
    return result.raw as AnalysisResult;
  } catch (err) {
    // Model call failed after charging — refund so the user isn't billed for nothing.
    await refundCredits(uid, metered.creditCost);
    const message = err instanceof Error ? err.message : "Resume analysis failed.";
    throw new HttpsError("internal", message);
  }
});
