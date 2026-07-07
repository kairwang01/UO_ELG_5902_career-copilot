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
import { coverLetterLanguageProtocol } from "../llm/languageProtocol";
import { correctiveInstruction, proseDraftIssues } from "../llm/draftQuality";
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

  // The letter's language follows the user's explicit choice (the product
  // keeps per-language versions); the shared protocol also covers reading
  // resumes/JDs written in any language and cross-language keyword mirroring.
  const outputLanguageInstruction = coverLetterLanguageProtocol({
    outputLanguage: data.outputLanguage,
    marketName: data.marketName,
  });

  const prompt = buildPrompt("handler_cover_letter", {
    marketName: data.marketName,
    resumeText: data.resumeText,
    jobDescription: data.jobDescription,
    outputLanguageInstruction,
  });

  try {
    // resolveProvider builds the provider (and reads the API key) — keep it inside
    // the try so a missing-key/build failure also triggers the refund below.
    const provider = await resolveProvider(uid, (request.data as { model?: string })?.model, "generateCoverLetter");
    let result = await provider.generate({
      prompt,
      responseSchema: COVER_LETTER_SCHEMA,
    });

    // Internal second-pass review: if the draft would trip the client's export
    // gate (unfinished/placeholder/too short), retry ONCE with a corrective
    // instruction — same charged call, so the user isn't billed twice and
    // almost never sees "Fix this draft before exporting".
    const firstIssues = proseDraftIssues((result.raw as CoverLetter | undefined)?.letter, {
      minWords: 90,
      minCjkChars: 220,
    });
    if (firstIssues.length > 0) {
      console.warn(`[coverLetter] draft failed review (${firstIssues.join(",")}) — retrying once`);
      try {
        const retry = await provider.generate({
          prompt: `${prompt}\n\n${correctiveInstruction(firstIssues)}`,
          responseSchema: COVER_LETTER_SCHEMA,
        });
        const retryIssues = proseDraftIssues((retry.raw as CoverLetter | undefined)?.letter, {
          minWords: 90,
          minCjkChars: 220,
        });
        if (retryIssues.length < firstIssues.length) result = retry;
      } catch {
        // Keep the first draft; the client gate remains the final safety net.
      }
    }

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
