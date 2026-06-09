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
import { GEMINI_API_KEY, KAIRLLM_API_KEY } from "../config/env";
import { deductCredits, refundCredits } from "../credits/deductCredits";
import { TOOL_CREDIT_COSTS } from "../credits/schema";

interface GenerateCoverLetterRequest {
  resumeText: string;
  jobDescription: string;
  marketName: string;
}

interface CoverLetter {
  letter: string;
}

const COVER_LETTER_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    letter: { type: Type.STRING },
  },
  required: ["letter"],
};

export const generateCoverLetterFunction = onCall({ secrets: [GEMINI_API_KEY, KAIRLLM_API_KEY] }, async (request) => {
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

  await deductCredits(uid, TOOL_CREDIT_COSTS["cover-letter"], "cover-letter");

  const prompt =
    `Write a professional cover letter tailored for the ${data.marketName} job market. ` +
    `Match the candidate's experience to the job requirements. ` +
    `Keep it concise (3–4 paragraphs), confident, and specific.\n\n` +
    `Resume:\n${data.resumeText}\n\nJob Description:\n${data.jobDescription}`;

  const provider = await resolveProvider(uid, (request.data as { model?: string })?.model);
  try {
    const result = await provider.generate({
      prompt,
      responseSchema: COVER_LETTER_SCHEMA,
    });

    return result.raw as CoverLetter;
  } catch (err) {
    await refundCredits(uid, TOOL_CREDIT_COSTS["cover-letter"]);
    throw err;
  }
});
