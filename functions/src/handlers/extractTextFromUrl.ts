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

  // LinkedIn (and most social profiles) hard-block server-side fetches: an
  // unauthenticated request gets a 999 anti-bot status, and even a browser-like
  // request just 301s to a login wall. There is no scrape path, so give a clear,
  // actionable message instead of a generic failure.
  const host = safe.hostname.toLowerCase();
  if (host === "linkedin.com" || host.endsWith(".linkedin.com")) {
    throw new HttpsError(
      "failed-precondition",
      "LinkedIn blocks automated profile import. Open your profile on LinkedIn, choose “More → Save to PDF”, then upload that PDF here — or paste your resume text below.",
    );
  }

  let html: string;
  try {
    let target = safe;
    let resp: Awaited<ReturnType<typeof fetch>> | undefined;
    // Follow redirects MANUALLY, re-validating each hop with assertSafeUrl — a
    // submitted-safe URL must not be able to 3xx-redirect us to an internal host
    // (e.g. the cloud metadata endpoint) that the initial guard never saw.
    for (let hop = 0; hop < 5; hop++) {
      resp = await fetch(target.toString(), {
        redirect: "manual",
        // A real browser User-Agent — many sites (incl. some résumé hosts) return
        // 403/999 to header-less requests but serve content to browser-like ones.
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9",
        },
        signal: AbortSignal.timeout(10_000),
      });
      if (resp.status >= 300 && resp.status < 400) {
        const loc = resp.headers.get("location");
        if (!loc) break;
        target = assertSafeUrl(new URL(loc, target).toString()); // throws if the hop host is blocked
        continue;
      }
      break;
    }
    if (!resp || !resp.ok) throw new Error(`status ${resp?.status ?? "none"}`);
    html = (await resp.text()).slice(0, 200_000); // cap to keep token cost bounded
  } catch (err) {
    if (err instanceof HttpsError) throw err; // surface host-not-allowed / LinkedIn guidance
    // A single bad URL (anti-bot block, login wall, timeout, DNS) is NOT a platform
    // outage — use failed-precondition so the global API-status banner stays green.
    throw new HttpsError(
      "failed-precondition",
      "Couldn't read that page — the site may block automated import or require a login. Try a public page, or paste your resume text below.",
    );
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
