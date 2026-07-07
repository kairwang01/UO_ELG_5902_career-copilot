/**
 * careerCoach — HTTPS Callable Cloud Function.
 *
 * Server-side port of the CareerCoachBot chat. The client keeps the conversation
 * history and sends it back each turn; the server holds the Gemini key and the
 * role-specific system instruction. (Callables don't stream, so the reply is
 * returned whole rather than token-by-token.)
 *
 * No credit charge — this is a free support assistant.
 *
 * Frontend integration (services/aiClient.ts):
 *   const fn = httpsCallable(getFunctions(), "careerCoach");
 *   const { data } = await fn({ messages, role, resumeText, companyName, ... });
 *   // → { reply }
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { requireAuth } from "../middleware/auth";
import { recordObservedToolRun } from "../admin/usageLog";
import { resolveProvider } from "../llm/models";
import { buildPrompt } from "../llm/prompts";
import { chatLanguageProtocol } from "../llm/languageProtocol";
import { ensurePlatformCaches } from "../config/env";

interface CoachMessage {
  role: "user" | "model";
  content: string;
}

interface CareerCoachRequest {
  messages: CoachMessage[];
  role?: "candidate" | "employer" | null;
  resumeText?: string;
  companyName?: string;
  companyWebsite?: string;
  companyDescription?: string;
  /** Optional model id (tier-gated server-side). */
  model?: string;
  /** UI language hint for ambiguous first messages, e.g. "zh", "en". */
  outputLanguage?: string;
}

export const careerCoachFunction = onCall({ invoker: "public", timeoutSeconds: 180 }, async (request) => {
  const uid = requireAuth(request);

  const data = (request.data ?? {}) as CareerCoachRequest;
  if (!Array.isArray(data.messages) || data.messages.length === 0) {
    throw new HttpsError("invalid-argument", "messages is required.");
  }

  // Observability only — uncharged tool, never capped (see recordObservedToolRun).
  void recordObservedToolRun(uid, "career-coach");

  // Warm the cache so an admin prompt override applies even on a cold instance.
  await ensurePlatformCaches();

  let systemInstruction: string;
  if (data.role === "candidate") {
    systemInstruction = buildPrompt("handler_career_coach_candidate", {
      resumeText: data.resumeText ?? "",
    });
  } else if (data.role === "employer") {
    systemInstruction = buildPrompt("handler_career_coach_employer", {
      companyName: data.companyName || "N/A",
      companyWebsite: data.companyWebsite || "N/A",
      companyDescription: data.companyDescription || "N/A",
    });
  } else {
    systemInstruction = buildPrompt("handler_career_coach_base", {});
  }

  // Appended AFTER the (possibly admin-overridden) template so language
  // behaviour is consistent even when an override predates this protocol.
  systemInstruction += "\n\n" + chatLanguageProtocol({ outputLanguage: data.outputLanguage });

  // Keep the last 20 turns to bound prompt size.
  const transcript =
    data.messages
      .slice(-20)
      .map((m) => `${m.role === "user" ? "User" : "Alex"}: ${m.content}`)
      .join("\n") + "\nAlex:";

  const provider = await resolveProvider(uid, data.model, "careerCoach");
  const result = await provider.generate({ system: systemInstruction, prompt: transcript });
  return { reply: result.text };
});
