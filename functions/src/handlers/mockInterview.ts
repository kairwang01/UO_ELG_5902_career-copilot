/**
 * mockInterview — HTTPS Callable Cloud Function.
 *
 * Stateless interview simulator. Supports two modes:
 *
 *   mode = "generate": Given a resume + job description, return a set of
 *     interview questions tailored to the candidate.
 *
 *   mode = "evaluate": Given a question + the candidate's answer, return
 *     AI feedback on the response.
 *
 * (The frontend's startInterviewChat uses a stateful Gemini Chat session.
 *  This handler is stateless and Cloud-Function-friendly — the client holds
 *  conversation history and sends it back each turn if needed.)
 *
 * Flow: verify auth → deduct credits → call LLM → return result
 *
 * Frontend integration:
 *   const fn = httpsCallable(getFunctions(), "mockInterview");
 *   // Generate questions:
 *   const result = await fn({ mode: "generate", resumeText, jobDescription, marketName });
 *   // Evaluate an answer:
 *   const result = await fn({ mode: "evaluate", question, answer, jobDescription });
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { Type } from "@google/genai";
import { requireAuth } from "../middleware/auth";
import { getProvider } from "../llm/router";
import { deductCredits } from "../credits/deductCredits";
import { TOOL_CREDIT_COSTS } from "../credits/schema";

// ---------------------------------------------------------------------------
// Request / Response types
// ---------------------------------------------------------------------------

type MockInterviewMode = "generate" | "evaluate";

interface MockInterviewRequest {
  mode: MockInterviewMode;
  // generate mode
  resumeText?: string;
  jobDescription?: string;
  marketName?: string;
  // evaluate mode
  question?: string;
  answer?: string;
}

interface InterviewQuestion {
  question: string;
  category: string; // "behavioural" | "technical" | "situational" | "culture-fit"
  tip: string;      // brief hint on what the interviewer is looking for
}

interface GenerateResult {
  questions: InterviewQuestion[];
}

interface EvaluateResult {
  score: number;        // 0–100
  strengths: string[];
  improvements: string[];
  modelAnswer: string;  // a strong example answer
}

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const GENERATE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    questions: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          question:  { type: Type.STRING },
          category:  { type: Type.STRING },
          tip:       { type: Type.STRING },
        },
        required: ["question", "category", "tip"],
      },
    },
  },
  required: ["questions"],
};

const EVALUATE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    score:        { type: Type.NUMBER },
    strengths:    { type: Type.ARRAY, items: { type: Type.STRING } },
    improvements: { type: Type.ARRAY, items: { type: Type.STRING } },
    modelAnswer:  { type: Type.STRING },
  },
  required: ["score", "strengths", "improvements", "modelAnswer"],
};

// ---------------------------------------------------------------------------
// Cloud Function
// ---------------------------------------------------------------------------

export const mockInterviewFunction = onCall(async (request) => {
  const uid = requireAuth(request);
  const data = request.data as MockInterviewRequest;

  if (!data.mode || !["generate", "evaluate"].includes(data.mode)) {
    throw new HttpsError(
      "invalid-argument",
      'mode must be "generate" or "evaluate".'
    );
  }

  await deductCredits(uid, TOOL_CREDIT_COSTS["mock-interview"], "mock-interview");

  if (data.mode === "generate") {
    if (!data.resumeText?.trim()) {
      throw new HttpsError("invalid-argument", "resumeText is required for generate mode.");
    }
    if (!data.jobDescription?.trim()) {
      throw new HttpsError("invalid-argument", "jobDescription is required for generate mode.");
    }

    const prompt =
      `You are an experienced ${data.marketName ?? "Canadian"} hiring manager. ` +
      `Generate 8 interview questions for this candidate — mix of behavioural, technical, ` +
      `situational, and culture-fit questions. Tailor them to the job and the candidate's background.\n\n` +
      `Resume:\n${data.resumeText}\n\nJob Description:\n${data.jobDescription}`;

    const provider = getProvider();
    const result = await provider.generate({
      prompt,
      responseSchema: GENERATE_SCHEMA,
    });

    return result.raw as GenerateResult;

  } else {
    // evaluate mode
    if (!data.question?.trim()) {
      throw new HttpsError("invalid-argument", "question is required for evaluate mode.");
    }
    if (!data.answer?.trim()) {
      throw new HttpsError("invalid-argument", "answer is required for evaluate mode.");
    }

    const prompt =
      `You are an expert interview coach. Evaluate the candidate's answer to the interview question below.\n\n` +
      `Question: ${data.question}\n\n` +
      `Candidate's Answer: ${data.answer}\n\n` +
      (data.jobDescription ? `Job Context:\n${data.jobDescription}\n\n` : "") +
      `Score the answer 0–100, identify specific strengths and areas to improve, ` +
      `and provide a model answer that would score highly.`;

    const provider = getProvider();
    const result = await provider.generate({
      prompt,
      responseSchema: EVALUATE_SCHEMA,
    });

    return result.raw as EvaluateResult;
  }
});
