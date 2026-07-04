/**
 * generateCoverLetter — HTTPS Callable Cloud Function.
 *
 * Server-side port of geminiService.generateCoverLetter().
 * Flow: verify auth → deduct credits → call LLM → return result
 *
 * Frontend integration:
 *   const fn = httpsCallable(getFunctions(), "generateCoverLetter");
 *   const result = await fn({ resumeText, jobDescription, marketName });
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { Type } from "@google/genai";
import { requireAuth } from "../middleware/auth";
import { resolveProvider } from "../llm/models";
import { meterToolRun, refundCredits } from "../credits/deductCredits";
import { TOOL_CREDIT_COSTS } from "../credits/schema";
import { buildPrompt } from "../llm/prompts";
import { ensurePlatformCaches } from "../config/env";

interface GenerateCoverLetterRequest {
  resumeText: string;
  jobDescription: string;
  marketName: string;
  /** UI/output language requested by the user, e.g. "zh", "en", "fr". */
  outputLanguage?: string;
  requestId?: string;
}

interface CoverLetter {
  letter: string;
}

const outputLanguageName = (value?: string): string => {
  const normalized = String(value ?? "").toLowerCase();
  if (normalized.startsWith("zh")) return "Simplified Chinese";
  if (normalized.startsWith("fr")) return "French";
  if (normalized.startsWith("de")) return "German";
  if (normalized.startsWith("ja")) return "Japanese";
  if (normalized.startsWith("vi")) return "Vietnamese";
  if (normalized.startsWith("ar")) return "Arabic";
  if (normalized.startsWith("es")) return "Spanish";
  if (normalized.startsWith("ko")) return "Korean";
  return "English";
};

export const COVER_LETTER_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    letter: { type: Type.STRING },
  },
  required: ["letter"],
};

export const generateCoverLetterFunction = onCall({ invoker: "public", timeoutSeconds: 180 }, async (request) => {
  const uid = requireAuth(request);

  const data = request.data as GenerateCoverLetterRequest;

  if (!data.resumeText?.trim()) {
    throw new HttpsError("invalid-argument", "resumeText is required.");
  }
  if (!data.jobDescription?.trim()) {
    throw new HttpsError("invalid-argument", "jobDescription is required.");
  }
  if (!data.marketName?.trim()) {
    throw new HttpsError("invalid-argument", "marketName is required.");
  }

  const metered = await meterToolRun(uid, "cover-letter", TOOL_CREDIT_COSTS["cover-letter"], {
    requestId: data.requestId,
  });

  // Warm the cache so an admin prompt override applies even on a cold instance.
  await ensurePlatformCaches();

  // When the user asked for a specific UI/output language, instruct the model to
  // write in it (this overrides the market's default business language). Left
  // blank when unset, so behaviour is unchanged for callers that omit it.
  const outputLanguageInstruction = data.outputLanguage
    ? `Write the cover letter entirely in ${outputLanguageName(data.outputLanguage)}, regardless of the ${data.marketName} market's default business language. Keep proper nouns (employer names, product names, URLs, programming languages, frameworks) in their original form.`
    : "";

  const prompt = buildPrompt("handler_cover_letter", {
    marketName: data.marketName,
    resumeText: data.resumeText,
    jobDescription: data.jobDescription,
    outputLanguageInstruction,
  });

  try {
    // resolveProvider builds the provider (and reads the API key) — keep it inside
    // the try so a missing-key/build failure also triggers the refund below.
    const provider = await resolveProvider(uid, (request.data as { model?: string })?.model);
    const result = await provider.generate({
      prompt,
      responseSchema: COVER_LETTER_SCHEMA,
    });

    return result.raw as CoverLetter;
  } catch (err) {
    await refundCredits(uid, metered.creditCost);
    // A plain Error reaches the client as a bare "INTERNAL" with no detail. Wrap
    // it so the failure message survives (preserve a meaningful HttpsError code).
    if (err instanceof HttpsError) throw err;
    const message = err instanceof Error ? err.message : "Cover letter generation failed.";
    throw new HttpsError("internal", message);
  }
});
