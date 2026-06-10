/**
 * discoverTalent — server-side employer talent search.
 *
 * WHY THIS EXISTS: firestore.rules deliberately block clients from reading other
 * users' profiles (owner-only reads protect resume_text PII). The old client-side
 * flow (listCandidateProfilesWithResume → per-candidate aiProxy match) therefore
 * died with "Missing or insufficient permissions" — and would have shipped every
 * candidate's full resume to the employer's browser if it hadn't.
 *
 * This callable keeps resumes server-side: it reads candidates with the Admin SDK,
 * runs the analyzeCandidateMatch prompt per candidate ON THE SERVER, and returns
 * only SAFE fields (no resume_text, no email, no contact info). Unlocking a full
 * profile remains a separate, payment-gated flow.
 *
 * Modes:
 *   { }                          → verified rail: nft_staked candidates, no AI run
 *   { jobDescription: string }   → match: scores up to MATCH_CANDIDATE_CAP candidates
 *
 * Cost: analyzeCandidateMatch is a free helper (creditKey null) — consistent with
 * the previous client-side behaviour. The cap bounds provider spend per search.
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { requireAuth } from "../middleware/auth";
import { resolveProvider } from "../llm/models";
import { ensurePlatformCaches } from "../config/env";
import { TOOL_REGISTRY } from "../llm/toolRegistry";

if (!admin.apps.length) {
  admin.initializeApp();
}
const db = admin.firestore();

const MAX_JD_CHARS = 20_000;
/** Hard per-search cap — each matched candidate is one LLM call. */
const MATCH_CANDIDATE_CAP = 8;
const VERIFIED_LIST_CAP = 10;
const CANDIDATE_SCAN_LIMIT = 60;
const MIN_RESUME_CHARS = 80;

interface SafeCandidateMatch {
  id: string;
  nft_staked: boolean;
  compatibilityScore: number;
  summary: string;
  strengths: string[];
  potentialGaps: string[];
  suggestedQuestions: string[];
}

interface CandidateRow {
  id: string;
  resume_text: string;
  nft_staked: boolean;
}

/** Mirrors aiProxy's lenient JSON parsing (markdown fences, trailing commas). */
function tryParseJson(str: string): unknown {
  let s = str.trim();
  const fence = s.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  if (fence) s = fence[1].trim();
  try {
    return JSON.parse(s);
  } catch {
    try {
      return JSON.parse(s.replace(/,(\s*[\]}])/g, "$1"));
    } catch {
      return undefined;
    }
  }
}

function toSafe(c: CandidateRow, parsed: {
  score?: number;
  summary?: string;
  strengths?: unknown;
  potentialGaps?: unknown;
  suggestedQuestions?: unknown;
}): SafeCandidateMatch {
  const strArr = (v: unknown): string[] =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === "string").slice(0, 10) : [];
  return {
    id: c.id,
    nft_staked: c.nft_staked,
    compatibilityScore: typeof parsed.score === "number" ? Math.max(0, Math.min(100, Math.round(parsed.score))) : 0,
    summary: typeof parsed.summary === "string" ? parsed.summary.slice(0, 2000) : "",
    strengths: strArr(parsed.strengths),
    potentialGaps: strArr(parsed.potentialGaps),
    suggestedQuestions: strArr(parsed.suggestedQuestions),
  };
}

export const discoverTalentFunction = onCall({ invoker: "public" }, async (request) => {
  const uid = requireAuth(request);

  // Business-only gate: this endpoint reads candidate resumes server-side, so it
  // must never be callable by candidate accounts.
  const meSnap = await db.collection("users").doc(uid).get();
  const role = meSnap.exists ? (meSnap.data()?.role as string | undefined) : undefined;
  if (role !== "employer" && role !== "agency") {
    throw new HttpsError("permission-denied", "Talent discovery is available to business accounts only.");
  }

  const raw = (request.data ?? {}) as { jobDescription?: unknown };
  const jobDescription = typeof raw.jobDescription === "string" ? raw.jobDescription.trim() : "";
  if (jobDescription.length > MAX_JD_CHARS) {
    throw new HttpsError("invalid-argument", `jobDescription must be ≤ ${MAX_JD_CHARS} characters.`);
  }

  // Admin-SDK candidate scan (clients are rules-blocked from this read by design).
  const snap = await db
    .collection("users")
    .where("role", "==", "candidate")
    .limit(CANDIDATE_SCAN_LIMIT)
    .get();

  const withResume: CandidateRow[] = snap.docs
    .map((d) => {
      const data = d.data();
      return {
        id: d.id,
        resume_text: typeof data.resume_text === "string" ? data.resume_text : "",
        nft_staked: data.nft_staked === true,
      };
    })
    .filter((c) => c.resume_text.trim().length >= MIN_RESUME_CHARS);

  // Verified-rail listing: no AI, no resume content leaves the server.
  if (!jobDescription) {
    const verified = withResume
      .filter((c) => c.nft_staked)
      .slice(0, VERIFIED_LIST_CAP)
      .map((c) => toSafe(c, {}));
    return { candidates: verified, eligible: withResume.length };
  }

  // Match mode — one LLM call per candidate, hard-capped.
  await ensurePlatformCaches();
  const spec = TOOL_REGISTRY["analyzeCandidateMatch"];
  if (!spec) {
    throw new HttpsError("internal", "analyzeCandidateMatch is not registered.");
  }
  const provider = await resolveProvider(uid, undefined);

  const pool = withResume.slice(0, MATCH_CANDIDATE_CAP);
  const settled = await Promise.allSettled(
    pool.map(async (c) => {
      const llmRequest = spec.build({ resumeText: c.resume_text, jobDescription });
      const result = await provider.generate(llmRequest);
      const parsed = (result.raw !== undefined ? result.raw : tryParseJson(result.text)) as
        | Record<string, unknown>
        | undefined;
      if (!parsed || typeof parsed.score !== "number") {
        throw new Error(`unparseable match result for candidate ${c.id}`);
      }
      return toSafe(c, parsed as Parameters<typeof toSafe>[1]);
    }),
  );

  const candidates = settled
    .filter((s): s is PromiseFulfilledResult<SafeCandidateMatch> => s.status === "fulfilled")
    .map((s) => s.value)
    .sort((a, b) => b.compatibilityScore - a.compatibilityScore);

  const failures = settled.length - candidates.length;
  if (failures > 0) {
    console.warn(`discoverTalent: ${failures}/${settled.length} candidate matches failed`);
  }

  return { candidates, scanned: pool.length, eligible: withResume.length };
});
