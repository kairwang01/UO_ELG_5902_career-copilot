import * as admin from "firebase-admin";
import { Timestamp } from "firebase-admin/firestore";

export type TalentValue = string | string[];
export type TalentRecord = Record<string, TalentValue>;

export interface TalentProfileSnapshot {
  status: "draft" | "complete";
  updated_at?: string;
  basic: TalentRecord;
  intention: TalentRecord;
  education: TalentRecord[];
  experience: TalentRecord[];
  projects: TalentRecord[];
  skills: Record<string, string[]>;
  awards: TalentRecord[];
  portfolio: TalentRecord[];
  references: TalentRecord[];
  additional: TalentRecord;
}

const MAX_STRING = 2000;
const MAX_ITEMS = 8;
const MAX_CHIPS = 24;

const SECTION_KEYS = {
  basic: ["name", "preferredName", "email", "phone", "country", "city"],
  intention: [
    "targetRole",
    "roleCategory",
    "targetCities",
    "businessInterests",
    "acceptRelocation",
    "acceptRemoteInterview",
    "availableStartDate",
    "internshipDuration",
    "weeklyAvailability",
  ],
  education: [
    "degree",
    "school",
    "location",
    "faculty",
    "major",
    "startDate",
    "endDate",
    "gpa",
    "gpaScale",
    "ranking",
    "researchDirection",
    "relevantCourses",
    "thesis",
  ],
  experience: [
    "company",
    "role",
    "location",
    "category",
    "workMode",
    "startDate",
    "endDate",
    "workContent",
    "collaboration",
    "tools",
    "outcome",
    "metrics",
  ],
  projects: [
    "name",
    "role",
    "type",
    "teamSize",
    "status",
    "startDate",
    "endDate",
    "link",
    "background",
    "responsibilities",
    "process",
    "result",
    "metrics",
  ],
  awards: ["name", "type", "date", "organization", "description"],
  portfolio: ["name", "type", "url", "description"],
  references: ["identity", "relationship", "organization"],
  additional: ["careerDirection", "overallStrengths", "aiToolExperience"],
};

const SKILL_GROUPS = ["projectManagement", "product", "tools", "technical", "ai", "languages"];

function cleanString(value: unknown): string {
  return typeof value === "string" ? value.trim().slice(0, MAX_STRING) : "";
}

function cleanArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    .map((item) => item.trim().slice(0, 160))
    .slice(0, MAX_CHIPS);
}

function cleanValue(value: unknown): TalentValue | undefined {
  if (Array.isArray(value)) {
    const arr = cleanArray(value);
    return arr.length ? arr : undefined;
  }
  const str = cleanString(value);
  return str ? str : undefined;
}

function cleanRecord(value: unknown, keys: string[]): TalentRecord {
  const src = value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
  const out: TalentRecord = {};
  for (const key of keys) {
    const clean = cleanValue(src[key]);
    if (clean !== undefined) out[key] = clean;
  }
  return out;
}

function cleanList(value: unknown, keys: string[]): TalentRecord[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => cleanRecord(item, keys))
    .filter((item) => Object.keys(item).length > 0)
    .slice(0, MAX_ITEMS);
}

function cleanSkills(value: unknown): Record<string, string[]> {
  const src = value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
  const out: Record<string, string[]> = {};
  for (const key of SKILL_GROUPS) {
    const arr = cleanArray(src[key]);
    if (arr.length) out[key] = arr;
  }
  return out;
}

function toIso(value: unknown): string | undefined {
  if (value && typeof (value as { toDate?: unknown }).toDate === "function") {
    return (value as Timestamp).toDate().toISOString();
  }
  return typeof value === "string" && value.trim() ? value.trim().slice(0, 80) : undefined;
}

function hasRecordContent(record: TalentRecord): boolean {
  return Object.keys(record).length > 0;
}

function hasProfileContent(profile: TalentProfileSnapshot): boolean {
  return (
    hasRecordContent(profile.basic) ||
    hasRecordContent(profile.intention) ||
    profile.education.length > 0 ||
    profile.experience.length > 0 ||
    profile.projects.length > 0 ||
    Object.keys(profile.skills).length > 0 ||
    profile.awards.length > 0 ||
    profile.portfolio.length > 0 ||
    profile.references.length > 0 ||
    hasRecordContent(profile.additional)
  );
}

export function normalizeTalentProfile(data: admin.firestore.DocumentData | undefined): TalentProfileSnapshot | null {
  if (!data) return null;
  const profile: TalentProfileSnapshot = {
    status: data.status === "complete" ? "complete" : "draft",
    updated_at: toIso(data.updated_at),
    basic: cleanRecord(data.basic, SECTION_KEYS.basic),
    intention: cleanRecord(data.intention, SECTION_KEYS.intention),
    education: cleanList(data.education, SECTION_KEYS.education),
    experience: cleanList(data.experience, SECTION_KEYS.experience),
    projects: cleanList(data.projects, SECTION_KEYS.projects),
    skills: cleanSkills(data.skills),
    awards: cleanList(data.awards, SECTION_KEYS.awards),
    portfolio: cleanList(data.portfolio, SECTION_KEYS.portfolio),
    references: cleanList(data.references, SECTION_KEYS.references),
    additional: cleanRecord(data.additional, SECTION_KEYS.additional),
  };
  return hasProfileContent(profile) ? profile : null;
}

function formatValue(value: TalentValue): string {
  return Array.isArray(value) ? value.join(", ") : value;
}

function pushRecord(lines: string[], title: string, record: TalentRecord, excludedKeys = new Set<string>()) {
  const values = Object.entries(record)
    .filter(([key]) => !excludedKeys.has(key))
    .map(([key, value]) => `${key}: ${formatValue(value)}`);
  if (values.length) lines.push(`${title}: ${values.join("; ")}`);
}

function pushList(lines: string[], title: string, list: TalentRecord[]) {
  list.forEach((item, index) => {
    const values = Object.entries(item).map(([key, value]) => `${key}: ${formatValue(value)}`);
    if (values.length) lines.push(`${title} ${index + 1}: ${values.join("; ")}`);
  });
}

export function talentProfileToMatchText(profile: TalentProfileSnapshot | null): string {
  if (!profile) return "";
  const lines: string[] = [];
  pushRecord(lines, "Job intention", profile.intention);
  pushRecord(lines, "Basic profile", profile.basic, new Set(["email", "phone"]));
  pushList(lines, "Education", profile.education);
  pushList(lines, "Experience", profile.experience);
  pushList(lines, "Project", profile.projects);
  for (const [group, values] of Object.entries(profile.skills)) {
    if (values.length) lines.push(`Skills ${group}: ${values.join(", ")}`);
  }
  pushList(lines, "Award", profile.awards);
  pushList(lines, "Portfolio", profile.portfolio);
  pushRecord(lines, "Summary", profile.additional);
  return lines.join("\n").slice(0, 20_000);
}

/** Combined ceiling on the per-candidate context handed to the match LLM. The
 *  resume (write-capped at 200k) and the structured profile (≤20k) were being
 *  concatenated with no joint cap → up to ~220k chars/candidate × the parallel
 *  match fan-out. A match judgement does not need 200k chars of resume. */
export const MAX_MATCH_CONTEXT_CHARS = 80_000;

/** Combine resume text + structured-profile match text into one capped context.
 *  The structured profile is preserved in full; the resume is truncated to fit. */
export function buildCandidateMatchContext(resumeText: string, profileText: string): string {
  const profilePart = profileText ? `Structured Talent Profile:\n${profileText}` : "";
  const resumeBudget = Math.max(0, MAX_MATCH_CONTEXT_CHARS - profilePart.length - 2);
  return [resumeText.trim().slice(0, resumeBudget), profilePart].filter(Boolean).join("\n\n");
}
