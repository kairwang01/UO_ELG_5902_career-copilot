/**
 * Server-side draft quality review — the "second pass" between the model and
 * the user.
 *
 * The client blocks exporting drafts that look unfinished ("Fix this draft
 * before exporting"), which protects the user from sending broken artifacts
 * but leaves them holding a charged, unusable result they must manually
 * regenerate. These helpers let the SERVER detect the same blocking defects
 * and retry once with a corrective instruction INSIDE the same charged call,
 * so the user almost always receives a finished draft on the first click.
 *
 * Checks mirror the client gates (components/tools/*Actions.tsx) and must stay
 * language-aware: drafts are now generated in any UI language, so "complete"
 * cannot mean "ends with an ASCII period".
 */

const hasCjkText = (text: string): boolean => /[぀-ヿ㐀-鿿가-힯]/.test(text);

const countWords = (text: string): number => text.trim().split(/\s+/).filter(Boolean).length;

/**
 * True when the text ends like a finished sentence in any supported script:
 * terminal punctuation (Latin, CJK, Arabic, Devanagari…) optionally followed
 * by closing quotes/brackets or markdown emphasis marks.
 */
export function hasFinishedEnding(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;
  // Strip trailing closers: quotes, brackets, markdown bold/italic markers.
  const stripped = trimmed.replace(/["'”’»›」』〉》)\]}*_`\s]+$/u, "");
  return /[.!?。！？…؟۔।]$/u.test(stripped);
}

/** Placeholder / template-instruction artifacts that mean "not a final draft". */
export function hasPlaceholderText(text: string): boolean {
  if (/\[[^\]\n]{2,}\]|\{\{[^}]+\}\}|<[^>\n]{2,}>/.test(text)) return true;
  if (/\b(?:Your Name|Your Address|Your Email|Your Phone Number|Company Name|Job Title|Hiring Manager Name)\b/i.test(text)) return true;
  if (/specific (?:action|project|achievement|skill area|reason)|measurable or clear outcome|relevant skill area/i.test(text)) return true;
  return false;
}

export interface ProseCheckOptions {
  /** Minimum word count for non-CJK text (default 0 = no minimum). */
  minWords?: number;
  /** Minimum character count for CJK text (default 0 = no minimum). */
  minCjkChars?: number;
  /** Require a finished sentence ending (default true). */
  requireEnding?: boolean;
}

/**
 * Blocking defects in a prose draft. Empty array = ship it.
 * Issue slugs intentionally match the client gates.
 */
export function proseDraftIssues(text: string | undefined | null, opts: ProseCheckOptions = {}): string[] {
  const normalized = String(text ?? "").replace(/\r/g, "\n").replace(/[ \t]+/g, " ").trim();
  if (!normalized) return ["empty"];

  const issues: string[] = [];
  if (hasCjkText(normalized)) {
    if (opts.minCjkChars && normalized.length < opts.minCjkChars) issues.push("too_short");
  } else if (opts.minWords && countWords(normalized) < opts.minWords) {
    issues.push("too_short");
  }
  if (hasPlaceholderText(normalized)) issues.push("placeholder");
  if (opts.requireEnding !== false && !hasFinishedEnding(normalized)) issues.push("unfinished_ending");
  return issues;
}

/**
 * Formatter-specific blocking defects — mirrors the client's
 * assessFormattedResume gate (lib/resumePreview.ts) for the checks that are
 * cheap and deterministic server-side. `expectedLanguage` is the language NAME
 * the user requested ("French", "Simplified Chinese", "English", …).
 */
export function formattedResumeIssues(text: string | undefined | null, expectedLanguage?: string): string[] {
  const cleaned = String(text ?? "").trim();
  if (!cleaned) return ["empty"];
  // requireEnding off: resumes legitimately end in a skills list or a date,
  // not a sentence — the client gate doesn't check endings here either.
  const issues = proseDraftIssues(cleaned, { minWords: 120, minCjkChars: 300, requireEnding: false });

  // Photo / image placeholder survived formatting.
  if (/写真|証明写真|顔写真|\[\s*(?:photo|写真|画像|image)\s*\]/i.test(cleaned)) issues.push("photo_placeholder");

  // A real (multi-row) markdown pipe table survived — plain-text export breaks.
  let consec = 0;
  for (const line of cleaned.split("\n")) {
    if ((line.match(/[|｜]/g) || []).length >= 2) {
      consec += 1;
      if (consec >= 2) { issues.push("pipe_table"); break; }
    } else consec = 0;
  }

  // Requested-language mismatch — the cheap, high-signal subset of the client
  // check: CJK targets must actually contain CJK text, and any non-English
  // target must not keep untranslated English section headers.
  const language = (expectedLanguage ?? "").toLowerCase();
  if (language && language !== "english" && !language.includes("same language")) {
    if (/^\s*(?:SUMMARY|PROFILE|OBJECTIVE|PERSONAL STATEMENT|EXPERIENCE|WORK EXPERIENCE|PROFESSIONAL EXPERIENCE|EMPLOYMENT HISTORY|PROJECTS|EDUCATION|SKILLS|CERTIFICATIONS|LANGUAGES)\s*$/im.test(cleaned)) {
      issues.push("language_mismatch");
    } else if (language.includes("chinese") || language.includes("japanese")) {
      const cjkChars = (cleaned.match(/[぀-ヿ㐀-鿿]/g) ?? []).length;
      if (cjkChars < 80) issues.push("language_mismatch");
    }
  }

  return [...new Set(issues)];
}

/**
 * Corrective addendum for the retry attempt. Appended to the ORIGINAL prompt
 * so all original context and rules still apply.
 */
export function correctiveInstruction(issues: string[]): string {
  // Issues may be prefixed with the failing field ("summary:unfinished_ending").
  const has = (slug: string) => issues.some((i) => i === slug || i.endsWith(`:${slug}`));
  const fields = [...new Set(issues.filter((i) => i.includes(":")).map((i) => i.split(":")[0]))];
  const fixes: string[] = [];
  if (fields.length > 0) fixes.push(`the failing parts were: ${fields.join(", ")}`);
  if (has("empty")) fixes.push("your previous attempt produced no usable text");
  if (has("too_short")) fixes.push("the draft was far too short to be usable");
  if (has("placeholder")) {
    fixes.push('placeholders or template instructions were left in (e.g. "[Company Name]", "{{...}}", "specific achievement") — replace every one with real content drawn from the provided context, or a natural neutral phrasing when a detail is unknown');
  }
  if (has("unfinished_ending")) {
    fixes.push("the draft was cut off mid-sentence — the final version must end with a complete closing sentence; if length is a concern, shorten the body rather than truncating the end");
  }
  if (has("photo_placeholder")) {
    fixes.push("a photo/image placeholder was left in — remove it entirely (plain-text resumes cannot carry images)");
  }
  if (has("pipe_table")) {
    fixes.push("markdown pipe tables were used — rewrite tabular content as plain lines or simple bullets; never emit | tables");
  }
  if (has("language_mismatch")) {
    fixes.push("part or all of the document was NOT written in the requested output language — rewrite the ENTIRE document, including every section header, in the requested language (keep proper nouns and technical terms as-is)");
  }
  return (
    "QUALITY REVIEW — your previous draft FAILED final review: " +
    fixes.join("; ") +
    ". Regenerate the COMPLETE, final, ready-to-use version now. " +
    "Every requirement above still applies. Return the full draft, not a diff or an apology."
  );
}
