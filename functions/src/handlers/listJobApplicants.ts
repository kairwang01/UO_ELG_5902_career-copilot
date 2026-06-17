/**
 * listJobApplicants — server-side applicant funnel for a single job posting.
 *
 * WHY THIS EXISTS: firestore.rules deliberately block clients from reading other
 * users' profiles (owner-only reads protect resume_text PII). The old
 * ApplicantFunnel flow (getCandidateProfilesByIds → per-applicant client-side
 * analyzeCandidateMatch) therefore died with "Missing or insufficient
 * permissions" — and would have shipped each applicant's full resume to the
 * employer's browser if it hadn't.
 *
 * This callable keeps resumes server-side: it verifies the caller owns the job,
 * reads applications + candidate resumes with the Admin SDK, runs the
 * analyzeCandidateMatch prompt per applicant ON THE SERVER, and returns only
 * SAFE match data (no resume_text, no email, no contact info).
 *
 * Viewing your own applicants is FREE — applicants opted in by applying. The
 * wallet-unlock paywall (UnlockTalentModal) is for proactive talent discovery
 * (strangers), not for people who chose to apply to you. This mirrors
 * discoverTalent.ts's security model but for the inbound-applicant path.
 *
 * Cost note: each applicant with a resume is one LLM call. MATCH_CANDIDATE_CAP
 * bounds provider spend per request; applicants beyond the cap (or without a
 * resume) still appear in the list with score 0 and no analysis.
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { requireAuth } from "../middleware/auth";
import { resolveProvider } from "../llm/models";
import { ensurePlatformCaches } from "../config/env";
import { TOOL_REGISTRY } from "../llm/toolRegistry";
import {
  normalizeTalentProfile,
  talentProfileToMatchText,
  type TalentProfileSnapshot,
} from "../utils/talentProfile";

if (!admin.apps.length) {
  admin.initializeApp();
}
const db = admin.firestore();

/** Hard per-request cap — each analyzed applicant is one LLM call. */
const MATCH_CANDIDATE_CAP = 25;

interface SafeApplicant {
  id: string;
  candidate_name: string;
  application_date: string | null;
  status: string;
  compatibility_score: number;
  summary: string;
  strengths: string[];
  potentialGaps: string[];
  suggestedQuestions: string[];
  talent_profile: TalentProfileSnapshot | null;
}

interface ApplicationRow {
  application_id: string;
  candidate_id: string;
  candidate_name: string;
  application_date: string | null;
  status: string;
}

/** Mirrors aiProxy/discoverTalent lenient JSON parsing (markdown fences, trailing commas). */
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

function isoFromTimestamp(value: unknown): string | null {
  if (value && typeof (value as { toDate?: unknown }).toDate === "function") {
    return (value as admin.firestore.Timestamp).toDate().toISOString();
  }
  return null;
}

function emptyApplicant(a: ApplicationRow, talentProfile: TalentProfileSnapshot | null): SafeApplicant {
  return {
    id: a.application_id,
    candidate_name: a.candidate_name,
    application_date: a.application_date,
    status: a.status,
    compatibility_score: 0,
    summary: "",
    strengths: [],
    potentialGaps: [],
    suggestedQuestions: [],
    talent_profile: talentProfile,
  };
}

export const listJobApplicantsFunction = onCall({ invoker: "public" }, async (request) => {
  const uid = requireAuth(request);

  const raw = (request.data ?? {}) as { jobId?: unknown };
  const jobId = typeof raw.jobId === "string" ? raw.jobId.trim() : "";
  if (!jobId) {
    throw new HttpsError("invalid-argument", "jobId is required.");
  }

  // 1. Verify the caller owns this job posting (authorization). employer_id is
  //    read from the authoritative job_postings doc — never trusted from input.
  const jobSnap = await db.collection("job_postings").doc(jobId).get();
  if (!jobSnap.exists) {
    throw new HttpsError("not-found", "Job posting not found.");
  }
  const job = jobSnap.data()!;
  if (job.employer_id !== uid) {
    throw new HttpsError("permission-denied", "You do not own this job posting.");
  }
  const jobDescription = typeof job.description === "string" ? job.description.trim() : "";

  // 2. Read applications for this job (Admin SDK). Name/date/status live on the
  //    application doc, so the candidate user doc is only needed for resume_text.
  const appsSnap = await db
    .collection("job_applications")
    .where("job_id", "==", jobId)
    .where("employer_id", "==", uid)
    .get();

  if (appsSnap.empty) {
    return { applicants: [] as SafeApplicant[] };
  }

  const applications: ApplicationRow[] = appsSnap.docs
    .map((d) => {
      const data = d.data();
      return {
        application_id: d.id,
        candidate_id: typeof data.candidate_id === "string" ? data.candidate_id : "",
        candidate_name: typeof data.candidate_name === "string" ? data.candidate_name : "Candidate",
        application_date: isoFromTimestamp(data.application_date),
        status: typeof data.status === "string" ? data.status : "Applied",
      };
    })
    .filter((a) => a.candidate_id);

  // 3. Fetch candidate docs + Talent Profiles (Admin SDK). Resume text never
  //    leaves the server; structured Talent Profiles are returned only for this
  //    job-owning employer and are also used as match context.
  //
  //    We also read the live name here: candidate_name on the application is a
  //    snapshot frozen at apply time, and a write race during user provisioning
  //    can leave it empty (→ "Unnamed Candidate" in the UI). Reading full_name
  //    live recovers the name for both existing and future applications.
  const liveNameById = new Map<string, string>();
  const talentProfileById = new Map<string, TalentProfileSnapshot | null>();
  const candidateContextById = new Map<string, string>();
  await Promise.all(
    Array.from(new Set(applications.map((a) => a.candidate_id))).map(async (cid) => {
      const [snap, talentSnap] = await Promise.all([
        db.collection("users").doc(cid).get(),
        db.collection("talent_profiles").doc(cid).get(),
      ]);
      const data = snap.exists ? snap.data() : undefined;
      const text = data?.resume_text;
      const resumeText = typeof text === "string" ? text : "";
      const talentProfile = normalizeTalentProfile(talentSnap.exists ? talentSnap.data() : undefined);
      talentProfileById.set(cid, talentProfile);
      const profileText = talentProfileToMatchText(talentProfile);
      candidateContextById.set(
        cid,
        [resumeText.trim(), profileText ? `Structured Talent Profile:\n${profileText}` : ""]
          .filter(Boolean)
          .join("\n\n"),
      );
      const fullName = typeof data?.full_name === "string" ? data.full_name.trim() : "";
      const email = typeof data?.email === "string" ? data.email.trim() : "";
      liveNameById.set(cid, fullName || email);
    }),
  );

  // Backfill empty/whitespace snapshot names from the live profile name (or email).
  for (const a of applications) {
    if (!a.candidate_name.trim()) {
      a.candidate_name = liveNameById.get(a.candidate_id) || a.candidate_name;
    }
  }

  // 4. Run analyzeCandidateMatch per applicant ON THE SERVER. Applicants without
  //    resume/profile context (or beyond the cap) are returned unanalyzed rather
  //    than dropped.
  await ensurePlatformCaches();
  const spec = TOOL_REGISTRY["analyzeCandidateMatch"];
  if (!spec) {
    throw new HttpsError("internal", "analyzeCandidateMatch is not registered.");
  }
  const provider = await resolveProvider(uid, undefined);

  const strArr = (v: unknown): string[] =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === "string").slice(0, 10) : [];

  const analyzable =
    jobDescription.length > 0
      ? applications.filter((a) => (candidateContextById.get(a.candidate_id) ?? "").trim().length > 0)
      : [];
  const pool = analyzable.slice(0, MATCH_CANDIDATE_CAP);
  const poolIds = new Set(pool.map((a) => a.application_id));

  const analyzed = await Promise.all(
    pool.map(async (a): Promise<SafeApplicant> => {
      try {
        const llmRequest = spec.build({ resumeText: candidateContextById.get(a.candidate_id)!, jobDescription });
        const result = await provider.generate(llmRequest);
        const parsed = (result.raw !== undefined ? result.raw : tryParseJson(result.text)) as
          | Record<string, unknown>
          | undefined;
        if (!parsed || typeof parsed.score !== "number") {
          return emptyApplicant(a, talentProfileById.get(a.candidate_id) ?? null);
        }
        return {
          id: a.application_id,
          candidate_name: a.candidate_name,
          application_date: a.application_date,
          status: a.status,
          compatibility_score: Math.max(0, Math.min(100, Math.round(parsed.score as number))),
          summary: typeof parsed.summary === "string" ? parsed.summary.slice(0, 2000) : "",
          strengths: strArr(parsed.strengths),
          potentialGaps: strArr(parsed.potentialGaps),
          suggestedQuestions: strArr(parsed.suggestedQuestions),
          talent_profile: talentProfileById.get(a.candidate_id) ?? null,
        };
      } catch (e) {
        console.error(`listJobApplicants: match failed for candidate ${a.candidate_id}:`, e);
        return emptyApplicant(a, talentProfileById.get(a.candidate_id) ?? null);
      }
    }),
  );

  const unanalyzed = applications
    .filter((a) => !poolIds.has(a.application_id))
    .map((a) => emptyApplicant(a, talentProfileById.get(a.candidate_id) ?? null));

  const applicants = [...analyzed, ...unanalyzed].sort(
    (x, y) => y.compatibility_score - x.compatibility_score,
  );

  return { applicants };
});
