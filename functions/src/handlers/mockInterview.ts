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
import * as admin from "firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { requireAuth } from "../middleware/auth";
import { resolveProvider, tierFromSubscription } from "../llm/models";
import { deductCredits, meterToolRun, refundCredits } from "../credits/deductCredits";
import { TOOL_CREDIT_COSTS } from "../credits/schema";
import { buildPrompt } from "../llm/prompts";
import {
  ensurePlatformCaches,
  getMockInterviewMinTier,
  getMiReportUnlockCredits,
} from "../config/env";

if (!admin.apps.length) {
  admin.initializeApp();
}
const db = admin.firestore();

/** users/{uid}/interview_reports — server-only storage for locked session
 *  reports (no firestore.rules block needed: default-deny keeps clients out;
 *  access is exclusively through this callable). */
const REPORTS_SUBCOLLECTION = "interview_reports";

// ---------------------------------------------------------------------------
// Request / Response types
// ---------------------------------------------------------------------------

type MockInterviewMode = "generate" | "evaluate" | "evaluate_session" | "unlock_report";

interface MockInterviewRequest {
  mode: MockInterviewMode;
  // generate mode
  resumeText?: string;
  jobDescription?: string;
  marketName?: string;
  // evaluate mode
  question?: string;
  answer?: string;
  // evaluate_session mode: the full timed-interview transcript
  qa?: Array<{ question: string; answer: string }>;
  // unlock_report mode
  reportId?: string;
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

const SESSION_EVAL_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    overallScore: { type: Type.NUMBER },
    verdict:      { type: Type.STRING }, // "Strong Hire" | "Hire" | "Leaning Hire" | "Leaning No Hire" | "No Hire"
    summary:      { type: Type.STRING },
    strengths:    { type: Type.ARRAY, items: { type: Type.STRING } },
    improvements: { type: Type.ARRAY, items: { type: Type.STRING } },
    perQuestion: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          question: { type: Type.STRING },
          score:    { type: Type.NUMBER },
          feedback: { type: Type.STRING },
        },
        required: ["question", "score", "feedback"],
      },
    },
  },
  required: ["overallScore", "verdict", "summary", "strengths", "improvements", "perQuestion"],
};

// ---------------------------------------------------------------------------
// Cloud Function
// ---------------------------------------------------------------------------

export const mockInterviewFunction = onCall({ invoker: "public", timeoutSeconds: 180 }, async (request) => {
  const uid = requireAuth(request);
  const data = request.data as MockInterviewRequest;
  const modelId = (request.data as { model?: string })?.model;

  if (!data.mode || !["generate", "evaluate", "evaluate_session", "unlock_report"].includes(data.mode)) {
    throw new HttpsError(
      "invalid-argument",
      'mode must be "generate", "evaluate", "evaluate_session" or "unlock_report".'
    );
  }

  // Validate the per-mode required fields BEFORE charging, so a malformed request
  // never burns the mock-interview credits.
  if (data.mode === "generate") {
    if (!data.resumeText?.trim()) {
      throw new HttpsError("invalid-argument", "resumeText is required for generate mode.");
    }
    if (!data.jobDescription?.trim()) {
      throw new HttpsError("invalid-argument", "jobDescription is required for generate mode.");
    }
  } else if (data.mode === "evaluate") {
    if (!data.question?.trim()) {
      throw new HttpsError("invalid-argument", "question is required for evaluate mode.");
    }
    if (!data.answer?.trim()) {
      throw new HttpsError("invalid-argument", "answer is required for evaluate mode.");
    }
  } else if (data.mode === "evaluate_session") {
    // evaluate_session: a bounded, well-formed transcript
    if (!Array.isArray(data.qa) || data.qa.length === 0 || data.qa.length > 20) {
      throw new HttpsError("invalid-argument", "qa must be a non-empty array of up to 20 {question, answer} items.");
    }
    for (const item of data.qa) {
      if (typeof item?.question !== "string" || !item.question.trim() || typeof item?.answer !== "string") {
        throw new HttpsError("invalid-argument", "Each qa item needs a question string and an answer string.");
      }
      if (item.question.length > 2000 || item.answer.length > 8000) {
        throw new HttpsError("invalid-argument", "qa item too long.");
      }
    }
  } else {
    // unlock_report
    if (typeof data.reportId !== "string" || !data.reportId.trim() || data.reportId.length > 128) {
      throw new HttpsError("invalid-argument", "reportId is required for unlock_report mode.");
    }
  }

  // Warm the cache so admin prompt/quota overrides apply even on a cold instance.
  await ensurePlatformCaches();

  // ── Tier gate (服务分级 — the simulation is a paid feature by default; the
  //    post-MVP "which tier" decision is platform_config/quotas.mi_min_tier,
  //    a config flip rather than a deploy). Applies to BOTH generate and
  //    evaluate_session so the report generation can't be farmed via the API.
  if (data.mode === "generate" || data.mode === "evaluate_session") {
    if (getMockInterviewMinTier() === "paid") {
      const userSnap = await db.collection("users").doc(uid).get();
      const tier = tierFromSubscription(userSnap.data()?.subscription_status as string | undefined);
      if (tier !== "paid") {
        throw new HttpsError(
          "permission-denied",
          "MI_PAID_ONLY: The timed mock interview is available on paid plans. Upgrade to unlock it."
        );
      }
    }
  }

  if (data.mode === "generate") {
    // Charge ONCE per interview session — at question generation, not per answer
    // evaluation (evaluate turns within the same session are free).
    const metered = await meterToolRun(uid, "mock-interview", TOOL_CREDIT_COSTS["mock-interview"]);

    const prompt = buildPrompt("handler_mock_interview_generate", {
      marketName: data.marketName ?? "Canadian",
      resumeText: data.resumeText,
      jobDescription: data.jobDescription,
    });

    const provider = await resolveProvider(uid, modelId);
    try {
      const result = await provider.generate({
        prompt,
        responseSchema: GENERATE_SCHEMA,
      });

      return result.raw as GenerateResult;
    } catch (err) {
      await refundCredits(uid, metered.creditCost);
      // A plain Error reaches the client as a bare "INTERNAL" with no detail. Wrap
      // it so the failure message survives (preserve a meaningful HttpsError code).
      if (err instanceof HttpsError) throw err;
      const message = err instanceof Error ? err.message : "Mock interview generation failed.";
      throw new HttpsError("internal", message);
    }

  } else if (data.mode === "evaluate") {
    // evaluate mode (required fields already validated above, before charging)
    const jobContextBlock = data.jobDescription ? `Job Context:\n${data.jobDescription}\n\n` : "";
    const prompt = buildPrompt("handler_mock_interview_eval", {
      question: data.question,
      answer: data.answer,
      jobContextBlock,
    });

    const provider = await resolveProvider(uid, modelId);
    const result = await provider.generate({
      prompt,
      responseSchema: EVALUATE_SCHEMA,
    });

    return result.raw as EvaluateResult;
  } else if (data.mode === "evaluate_session") {
    // evaluate_session — holistic end-of-interview report. Free within the
    // session: the single mock-interview charge happened at generate time.
    const jobContextBlock = data.jobDescription ? `Job Context:\n${data.jobDescription}\n\n` : "";
    const resumeBlock = data.resumeText?.trim() ? `Candidate Resume:\n${data.resumeText}\n\n` : "";
    const transcript = (data.qa as Array<{ question: string; answer: string }>)
      .map((item, i) =>
        `Q${i + 1}: ${item.question}\nA${i + 1}: ${item.answer.trim() || "(no answer — the candidate skipped this question)"}`)
      .join("\n\n");

    const prompt = buildPrompt("handler_mock_interview_session_eval", {
      jobContextBlock,
      resumeBlock,
      transcript,
    });

    const provider = await resolveProvider(uid, modelId);
    const result = await provider.generate({
      prompt,
      responseSchema: SESSION_EVAL_SCHEMA,
    });

    const report = result.raw as Record<string, unknown>;

    // ── Report entitlement (the monetization point). Paid tiers get the full
    //    report included. Other tiers (reachable only once mi_min_tier is
    //    flipped to 'free' post-MVP) get a TEASER: the report is persisted
    //    server-side and a locked envelope returns the overall score + one
    //    strength — the verdict and full breakdown sit behind an expensive
    //    credit unlock (the upsell anchor: upgrading looks cheap next to it).
    const entSnap = await db.collection("users").doc(uid).get();
    const entTier = tierFromSubscription(entSnap.data()?.subscription_status as string | undefined);
    if (entTier === "paid") {
      return { locked: false, ...report };
    }

    const unlockCredits = getMiReportUnlockCredits();
    const docRef = await db
      .collection("users").doc(uid)
      .collection(REPORTS_SUBCOLLECTION)
      .add({
        report,
        unlocked: false,
        created_at: FieldValue.serverTimestamp(),
      });

    const strengths = Array.isArray(report.strengths) ? (report.strengths as string[]) : [];
    const perQuestion = Array.isArray(report.perQuestion) ? report.perQuestion : [];
    return {
      locked: true,
      reportId: docRef.id,
      unlockCredits,
      preview: {
        overallScore: typeof report.overallScore === "number" ? report.overallScore : 0,
        firstStrength: strengths[0] ?? "",
        perQuestionCount: perQuestion.length,
      },
    };
  } else {
    // unlock_report — a non-included user pays the (steep) one-time price for
    // a stored report. Idempotent: an already-unlocked report returns free.
    const reportRef = db
      .collection("users").doc(uid)
      .collection(REPORTS_SUBCOLLECTION)
      .doc(data.reportId!.trim());
    const snap = await reportRef.get();
    if (!snap.exists) {
      throw new HttpsError("not-found", "Report not found.");
    }
    const stored = snap.data() as { report: Record<string, unknown>; unlocked?: boolean };
    if (!stored.unlocked) {
      const price = getMiReportUnlockCredits();
      if (price > 0) {
        await deductCredits(uid, price, "mock-interview-report-unlock");
      }
      try {
        await reportRef.update({ unlocked: true, unlocked_at: FieldValue.serverTimestamp() });
      } catch (err) {
        // Couldn't persist the unlock — reverse the charge so the user is never
        // billed for a report that stayed locked.
        if (price > 0) await refundCredits(uid, price);
        throw err;
      }
    }
    return { locked: false, ...stored.report };
  }
});
