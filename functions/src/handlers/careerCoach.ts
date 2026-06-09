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
import { resolveProvider } from "../llm/models";
import { GEMINI_API_KEY, KAIRLLM_API_KEY } from "../config/env";

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
}

const BASE_INSTRUCTION =
  "You are 'Alex', an empathetic and encouraging AI career coach. Your tone is warm, " +
  "friendly, and professional yet conversational. Avoid being overly robotic. Use natural " +
  "language, ask clarifying questions, and use markdown for formatting like **bolding** key terms.";

export const careerCoachFunction = onCall({ secrets: [GEMINI_API_KEY, KAIRLLM_API_KEY] }, async (request) => {
  const uid = requireAuth(request);

  const data = (request.data ?? {}) as CareerCoachRequest;
  if (!Array.isArray(data.messages) || data.messages.length === 0) {
    throw new HttpsError("invalid-argument", "messages is required.");
  }

  let systemInstruction = BASE_INSTRUCTION;
  if (data.role === "candidate") {
    systemInstruction =
      "You are 'Alex', an empathetic and expert AI career coach for a job seeker. Your tone is warm, " +
      "friendly, and professional yet conversational. Ask clarifying questions, offer encouragement, and " +
      "use markdown (**bolding**, lists) where appropriate. Here is the user's resume for context if they " +
      `ask questions related to it:\n\n${data.resumeText ?? ""}`;
  } else if (data.role === "employer") {
    systemInstruction =
      "You are 'Alex', a professional and insightful AI HR assistant for an employer. Your tone is helpful, " +
      "collaborative, and professional yet conversational. Use markdown (**bolding**, lists) where appropriate. " +
      `Here is the employer's company profile for context: Name: ${data.companyName || "N/A"}, ` +
      `Website: ${data.companyWebsite || "N/A"}, Description: ${data.companyDescription || "N/A"}`;
  }

  // Keep the last 20 turns to bound prompt size.
  const transcript =
    data.messages
      .slice(-20)
      .map((m) => `${m.role === "user" ? "User" : "Alex"}: ${m.content}`)
      .join("\n") + "\nAlex:";

  const provider = await resolveProvider(uid, data.model);
  const result = await provider.generate({ system: systemInstruction, prompt: transcript });
  return { reply: result.text };
});
