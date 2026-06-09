/**
 * extractTextFromUrl — HTTPS Callable Cloud Function.
 *
 * Server-side port of geminiService.extractTextFromUrl(). The old client routed
 * user URLs through the public corsproxy.io; this version fetches server-side with
 * an SSRF allow-guard (no localhost / private ranges / cloud metadata endpoints),
 * then extracts the profile text with the LLM. The Gemini key stays server-side.
 *
 * Frontend integration (services/aiClient.ts):
 *   const fn = httpsCallable(getFunctions(), "extractTextFromUrl");
 *   const { data } = await fn({ url });  // → { extractedText }
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { Type } from "@google/genai";
import { requireAuth } from "../middleware/auth";
import { resolveProvider } from "../llm/models";
import { buildPrompt } from "../llm/prompts";

interface ExtractTextRequest {
  url: string;
  model?: string;
}

/**
 * Validates a user-supplied URL against SSRF abuse. Hostname-based guard covers the
 * obvious private/metadata targets; DNS-rebinding (a public host resolving to a
 * private IP) remains a residual risk — acceptable behind auth for this milestone.
 */
function assertSafeUrl(raw: string): URL {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    throw new HttpsError("invalid-argument", "Invalid URL.");
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") {
    throw new HttpsError("invalid-argument", "URL must use http or https.");
  }
  const host = u.hostname.toLowerCase();
  const blocked =
    host === "localhost" ||
    host === "0.0.0.0" ||
    host === "169.254.169.254" || // AWS/GCP metadata
    host === "metadata.google.internal" ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    /^127\./.test(host) ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host);
  if (blocked) {
    throw new HttpsError("invalid-argument", "This URL host is not allowed.");
  }
  return u;
}

export const extractTextFromUrlFunction = onCall({ invoker: "public" }, async (request) => {
  const uid = requireAuth(request);

  const { url, model } = (request.data ?? {}) as ExtractTextRequest;
  if (!url || typeof url !== "string") {
    throw new HttpsError("invalid-argument", "url is required.");
  }
  const safe = assertSafeUrl(url);

  let html: string;
  try {
    const resp = await fetch(safe.toString(), {
      redirect: "follow",
      signal: AbortSignal.timeout(10_000),
    });
    if (!resp.ok) throw new Error(`status ${resp.status}`);
    html = (await resp.text()).slice(0, 200_000); // cap to keep token cost bounded
  } catch {
    throw new HttpsError("unavailable", "Could not retrieve content from the provided URL.");
  }

  const provider = await resolveProvider(uid, model);
  const result = await provider.generate({
    prompt: buildPrompt("handler_extract_url", { html }),
    responseSchema: {
      type: Type.OBJECT,
      properties: { extractedText: { type: Type.STRING } },
      required: ["extractedText"],
    },
  });

  return result.raw as { extractedText: string };
});
