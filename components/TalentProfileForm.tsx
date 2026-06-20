import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2, ChevronDown, ChevronRight, Check, Loader2, Save, Sparkles, X, AlertTriangle, RotateCcw } from 'lucide-react';
import {
  TALENT_PROFILE_SCHEMA,
  emptyTalentProfile,
  isTalentProfileReady,
  sanitizeExtractedProfile,
  hasMeaningfulEntry,
  type TalentProfile,
  type FieldConfig,
  type Section,
} from '../lib/talentProfile';
import { loadTalentProfile, saveTalentProfile } from '../services/talentProfile';
import { extractTalentProfile } from '../services/aiClient';

interface TalentProfileFormProps {
  uid: string;
  /** Pre-seed name/email when the profile is brand new. */
  seed?: { name?: string; email?: string };
  /** The candidate's resume text, used to auto-fill the profile. */
  resumeText?: string;
  /** Rendered as a sticky footer action (e.g. "Save & apply"). */
  primaryLabel?: string;
  onPrimary?: (profile: TalentProfile) => void;
  onSaved?: (profile: TalentProfile) => void;
}

const inputCls =
  'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-600 dark:bg-slate-900 dark:text-gray-100';

const PREFILL_LANGUAGE_OPTIONS = [
  { value: 'en', label: 'English (recommended)', note: 'Best default for North America and most ATS/recruiter workflows.' },
  { value: 'fr', label: 'French', note: 'Useful for French or bilingual Canadian applications.' },
  { value: 'zh', label: 'Chinese (Simplified)', note: 'Useful when reviewing details before translating or localizing.' },
  { value: 'es', label: 'Spanish', note: 'Use when the target employer expects Spanish materials.' },
  { value: 'de', label: 'German', note: 'Use for German-language applications.' },
  { value: 'ja', label: 'Japanese', note: 'Use for Japanese-language applications.' },
  { value: 'vi', label: 'Vietnamese', note: 'Use for Vietnamese-language applications.' },
  { value: 'source', label: 'Keep resume language', note: 'Preserve the language used in the uploaded resume.' },
];

type PrefillReviewState = {
  before: TalentProfile;
  paths: string[];
  languageLabel: string;
};

type ValidationIssue = {
  path: string;
  message: string;
};

const cloneProfile = (profile: TalentProfile): TalentProfile => JSON.parse(JSON.stringify(profile)) as TalentProfile;

const hasVisibleValue = (value: unknown): boolean => {
  if (typeof value === 'string') return value.trim().length > 0;
  if (Array.isArray(value)) return value.some(hasVisibleValue);
  return false;
};

const getPathLabel = (path: string): string => {
  const [sectionId, maybeIndexOrKey, maybeKey] = path.split('.');
  const section = TALENT_PROFILE_SCHEMA.find((s) => s.id === sectionId);
  if (!section) return path;
  if (section.kind === 'skills') {
    const group = section.groups.find((g) => g.key === maybeIndexOrKey);
    return `${section.title} · ${group?.label ?? maybeIndexOrKey}`;
  }
  if (section.kind === 'object') {
    const field = section.fields.find((f) => f.key === maybeIndexOrKey);
    return `${section.title} · ${field?.label ?? maybeIndexOrKey}`;
  }
  const index = Number.parseInt(maybeIndexOrKey ?? '', 10);
  const field = section.fields.find((f) => f.key === maybeKey);
  return `${section.title} #${Number.isFinite(index) ? index + 1 : '?'} · ${field?.label ?? maybeKey ?? ''}`;
};

const parseFirstNumber = (value: unknown): number | null => {
  if (typeof value !== 'string') return null;
  const match = value.replace(',', '.').match(/\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : null;
};

const isValidIsoDate = (value: string): boolean => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
};

const isValidHttpUrl = (value: string): boolean => {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
};

const collectValidationIssues = (profile: TalentProfile): ValidationIssue[] => {
  const issues: ValidationIssue[] = [];
  const email = typeof profile.basic.email === 'string' ? profile.basic.email.trim() : '';
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    issues.push({ path: 'basic.email', message: 'Use a valid email address.' });
  }

  TALENT_PROFILE_SCHEMA.forEach((section) => {
    if (section.kind === 'object') {
      const data = (profile as any)[section.id] as Record<string, unknown>;
      section.fields.forEach((field) => {
        const value = data?.[field.key];
        if (field.type === 'date' && typeof value === 'string' && value.trim() && !isValidIsoDate(value.trim())) {
          issues.push({ path: `${section.id}.${field.key}`, message: 'Use YYYY-MM-DD.' });
        }
      });
      return;
    }
    if (section.kind !== 'list') return;
    const items = ((profile as any)[section.id] ?? []) as Record<string, unknown>[];
    items.forEach((item, index) => {
      section.fields.forEach((field) => {
        const value = item[field.key];
        const path = `${section.id}.${index}.${field.key}`;
        if (field.type === 'date' && typeof value === 'string' && value.trim() && !isValidIsoDate(value.trim())) {
          issues.push({ path, message: 'Use YYYY-MM-DD.' });
        }
        if ((field.key === 'url' || field.key === 'link') && typeof value === 'string' && value.trim() && !isValidHttpUrl(value.trim())) {
          issues.push({ path, message: 'Use a full http:// or https:// link.' });
        }
      });

      const start = typeof item.startDate === 'string' ? item.startDate.trim() : '';
      const end = typeof item.endDate === 'string' ? item.endDate.trim() : '';
      if (start && end && isValidIsoDate(start) && isValidIsoDate(end) && start > end) {
        issues.push({ path: `${section.id}.${index}.endDate`, message: 'End date should be after start date.' });
      }
      if (section.id === 'education') {
        const gpa = typeof item.gpa === 'string' ? item.gpa.trim() : '';
        const gpaScale = typeof item.gpaScale === 'string' ? item.gpaScale.trim() : '';
        const gpaNumber = parseFirstNumber(gpa);
        const scaleNumber = parseFirstNumber(gpaScale);
        if (gpa && gpaNumber === null) {
          issues.push({ path: `${section.id}.${index}.gpa`, message: 'Use a numeric GPA, such as 3.8.' });
        }
        if (gpaScale && scaleNumber === null) {
          issues.push({ path: `${section.id}.${index}.gpaScale`, message: 'Use a numeric scale, such as 4.0.' });
        }
        if (gpaNumber !== null && scaleNumber !== null && gpaNumber > scaleNumber) {
          issues.push({ path: `${section.id}.${index}.gpa`, message: 'GPA cannot be higher than the scale.' });
        }
      }
    });
  });

  return issues;
};

// ── Chip editor (chips fields + skill groups) ───────────────────────────────
const ChipEditor: React.FC<{
  values: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  suggestions?: string[];
}> = ({ values, onChange, placeholder, suggestions }) => {
  const [draft, setDraft] = useState('');
  const add = (v: string) => {
    const t = v.trim();
    if (t && !values.includes(t)) onChange([...values, t]);
    setDraft('');
  };
  const remaining = (suggestions ?? []).filter((s) => !values.includes(s));
  return (
    <div>
      <div className="flex flex-wrap gap-1.5">
        {values.map((v) => (
          <span key={v} className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
            {v}
            <button type="button" onClick={() => onChange(values.filter((x) => x !== v))} className="text-blue-400 hover:text-blue-700 dark:hover:text-blue-200" aria-label={`Remove ${v}`}>×</button>
          </span>
        ))}
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(draft); } }}
          placeholder={placeholder ?? 'Add…'}
          className="min-w-[120px] flex-1 border-none bg-transparent px-1 py-1 text-sm text-gray-900 focus:outline-none dark:text-gray-100"
        />
      </div>
      {remaining.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {remaining.slice(0, 12).map((s) => (
            <button key={s} type="button" onClick={() => add(s)} className="rounded-full border border-dashed border-gray-300 px-2 py-0.5 text-xs text-gray-500 hover:border-blue-400 hover:text-blue-600 dark:border-slate-600 dark:text-slate-400">
              + {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

// ── Single field renderer ───────────────────────────────────────────────────
const FieldInput: React.FC<{ field: FieldConfig; value: unknown; onChange: (v: unknown) => void }> = ({ field, value, onChange }) => {
  if (field.type === 'chips') {
    return <ChipEditor values={Array.isArray(value) ? (value as string[]) : []} onChange={onChange} placeholder={field.placeholder} suggestions={field.suggestions} />;
  }
  const str = typeof value === 'string' ? value : '';
  if (field.type === 'textarea') {
    return <textarea value={str} onChange={(e) => onChange(e.target.value)} placeholder={field.placeholder} rows={3} className={`${inputCls} resize-y`} />;
  }
  if (field.type === 'select') {
    return (
      <select value={str} onChange={(e) => onChange(e.target.value)} className={inputCls}>
        <option value="">Select…</option>
        {(field.options ?? []).map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    );
  }
  return <input type={field.type === 'date' ? 'date' : 'text'} value={str} onChange={(e) => onChange(e.target.value)} placeholder={field.placeholder} className={inputCls} />;
};

const FieldLabel: React.FC<{ field: FieldConfig }> = ({ field }) => (
  <label className="mb-1 block text-xs font-semibold text-gray-600 dark:text-gray-300">
    {field.label}{field.optional && <span className="ml-1 font-normal text-gray-400">(optional)</span>}
    {field.help && <span className="mt-0.5 block text-[11px] font-normal leading-4 text-gray-400 dark:text-slate-500">{field.help}</span>}
  </label>
);

const FieldGrid: React.FC<{
  fields: FieldConfig[];
  data: Record<string, unknown>;
  onField: (key: string, v: unknown) => void;
  pathFor?: (key: string) => string;
  highlightedPaths?: Set<string>;
  issueByPath?: Map<string, string>;
  onReviewPath?: (path: string) => void;
}> = ({ fields, data, onField, pathFor, highlightedPaths, issueByPath, onReviewPath }) => (
  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
    {fields.map((f) => {
      const path = pathFor?.(f.key) ?? f.key;
      const highlighted = highlightedPaths?.has(path) ?? false;
      const issue = issueByPath?.get(path);
      return (
        <div
          key={f.key}
          className={`${f.full || f.type === 'textarea' || f.type === 'chips' ? 'sm:col-span-2' : ''} rounded-lg ${
            issue
              ? 'border border-red-200 bg-red-50/60 p-2 dark:border-red-900/60 dark:bg-red-950/20'
              : highlighted
                ? 'border border-blue-200 bg-blue-50/70 p-2 dark:border-blue-900/60 dark:bg-blue-950/20'
                : ''
          }`}
        >
          <div className="flex items-start justify-between gap-2">
            <FieldLabel field={f} />
            {highlighted && onReviewPath && (
              <button type="button" onClick={() => onReviewPath(path)} className="text-[11px] font-semibold text-blue-600 hover:text-blue-800 dark:text-blue-300 dark:hover:text-blue-100">
                Reviewed
              </button>
            )}
          </div>
          <FieldInput field={f} value={data[f.key]} onChange={(v) => onField(f.key, v)} />
          {issue && <p className="mt-1 text-xs font-medium text-red-600 dark:text-red-300">{issue}</p>}
        </div>
      );
    })}
  </div>
);

// ── Main form ───────────────────────────────────────────────────────────────
const TalentProfileForm: React.FC<TalentProfileFormProps> = ({ uid, seed, resumeText, primaryLabel, onPrimary, onSaved }) => {
  const [profile, setProfile] = useState<TalentProfile>(emptyTalentProfile());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [prefilling, setPrefilling] = useState(false);
  const [prefillDialogOpen, setPrefillDialogOpen] = useState(false);
  const [prefillLanguage, setPrefillLanguage] = useState('en');
  const [prefillReview, setPrefillReview] = useState<PrefillReviewState | null>(null);
  const [prefillMsg, setPrefillMsg] = useState<{ kind: 'ok' | 'info' | 'error'; text: string } | null>(null);
  const [open, setOpen] = useState<Record<string, boolean>>({ basic: true, intention: true });
  const [loadError, setLoadError] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const markReviewPath = (path: string) => {
    setPrefillReview((state) => {
      if (!state) return null;
      const nextPaths = state.paths.filter((p) => p !== path);
      return nextPaths.length ? { ...state, paths: nextPaths } : null;
    });
  };

  const clearReviewPathsByPrefix = (prefix: string) => {
    setPrefillReview((state) => {
      if (!state) return null;
      const nextPaths = state.paths.filter((p) => !p.startsWith(prefix));
      return nextPaths.length ? { ...state, paths: nextPaths } : null;
    });
  };

  // Auto-fill from the candidate's resume. Fills ONLY empty fields / empty list
  // sections (never overwrites what the candidate already typed); skills are
  // unioned. The AI output is schema-coerced (sanitizeExtractedProfile) so dates
  // and select values populate correctly.
  const openPrefillDialog = () => {
    if (!resumeText || resumeText.trim().length < 40) {
      setPrefillMsg({ kind: 'info', text: 'Add or upload your resume first (the “Resume” tab), then prefill here.' });
      return;
    }
    setPrefillMsg(null);
    setPrefillDialogOpen(true);
  };

  const handlePrefill = async (targetLanguage: string) => {
    if (!resumeText || resumeText.trim().length < 40) {
      setPrefillMsg({ kind: 'info', text: 'Add or upload your resume first (the “Resume” tab), then prefill here.' });
      setPrefillDialogOpen(false);
      return;
    }
    setPrefilling(true);
    setPrefillMsg(null);
    try {
      const ex = sanitizeExtractedProfile(await extractTalentProfile(resumeText, { targetLanguage }));
      const before = cloneProfile(profile);
      // Decide which sections will actually receive data (from current state) so
      // we can expand exactly those — the user must see everything before saving.
      const touched = new Set<string>();
      const reviewPaths = new Set<string>();
      (['basic', 'intention', 'additional'] as const).forEach((id) => {
        const exObj = ex[id] as Record<string, string> | undefined;
        if (!exObj) return;
        Object.keys(exObj).forEach((k) => {
          const cur = (profile[id] as Record<string, string>)[k];
          if ((!cur || !String(cur).trim()) && hasVisibleValue(exObj[k])) {
            touched.add(id);
            reviewPaths.add(`${id}.${k}`);
          }
        });
      });
      (['education', 'experience', 'projects', 'awards', 'portfolio'] as const).forEach((id) => {
        const exList = ex[id] as Record<string, string | string[]>[] | undefined;
        if (exList && exList.length && !(profile[id] ?? []).some(hasMeaningfulEntry)) {
          touched.add(id);
          exList.forEach((item, index) => {
            Object.keys(item).forEach((key) => {
              if (hasVisibleValue(item[key])) reviewPaths.add(`${id}.${index}.${key}`);
            });
          });
        }
      });
      if (ex.skills) {
        Object.keys(ex.skills).forEach((g) => {
          const hasNewSkill = ((ex.skills as Record<string, string[]>)[g] ?? []).some((s) => !(profile.skills[g] ?? []).includes(s));
          if (hasNewSkill) {
            touched.add('skills');
            reviewPaths.add(`skills.${g}`);
          }
        });
      }

      setProfile((p) => {
        const next: TalentProfile = { ...p, basic: { ...p.basic }, intention: { ...p.intention }, additional: { ...p.additional }, skills: { ...p.skills } };
        (['basic', 'intention', 'additional'] as const).forEach((id) => {
          const exObj = ex[id] as Record<string, string> | undefined;
          if (!exObj) return;
          const cur = next[id] as Record<string, string>;
          Object.keys(exObj).forEach((k) => {
            if (!cur[k] || !String(cur[k]).trim()) cur[k] = exObj[k];
          });
        });
        (['education', 'experience', 'projects', 'awards', 'portfolio'] as const).forEach((id) => {
          const exList = ex[id] as Record<string, string | string[]>[] | undefined;
          if (exList && exList.length && !(next[id] ?? []).some(hasMeaningfulEntry)) next[id] = exList;
        });
        if (ex.skills) {
          Object.keys(ex.skills).forEach((g) => {
            next.skills[g] = Array.from(new Set([...(next.skills[g] ?? []), ...((ex.skills as Record<string, string[]>)[g] ?? [])]));
          });
        }
        return next;
      });
      if (touched.size) setOpen((o) => ({ ...o, ...Object.fromEntries([...touched].map((id) => [id, true])) }));
      const langLabel = PREFILL_LANGUAGE_OPTIONS.find((opt) => opt.value === targetLanguage)?.label ?? 'your selected language';
      if (reviewPaths.size) {
        setPrefillReview({ before, paths: [...reviewPaths], languageLabel: langLabel });
        setPrefillMsg({ kind: 'ok', text: `Drafted ${reviewPaths.size} fields from your resume in ${langLabel}. Review the highlighted fields before saving.` });
      } else {
        setPrefillReview(null);
        setPrefillMsg({ kind: 'info', text: 'No empty fields were filled. Your existing Talent Profile already has the matching resume details.' });
      }
    } catch (err) {
      setPrefillMsg({ kind: 'error', text: err instanceof Error ? err.message : 'Could not read your resume. Please fill the form manually.' });
    } finally {
      setPrefilling(false);
      setPrefillDialogOpen(false);
    }
  };

  useEffect(() => {
    let active = true;
    setLoading(true);
    setLoadError(false);
    loadTalentProfile(uid)
      .then((p) => {
        if (!active) return;
        // Seed name/email for a brand-new profile.
        if (!p.basic?.name && seed?.name) p.basic = { ...p.basic, name: seed.name };
        if (!p.basic?.email && seed?.email) p.basic = { ...p.basic, email: seed.email };
        setProfile(p);
        setLoading(false);
      })
      .catch(() => {
        // Don't render the form on a failed read — a save would clobber the real
        // profile with an empty one. Show a retry instead.
        if (active) { setLoadError(true); setLoading(false); }
      });
    return () => { active = false; };
    // Re-fetch only on identity change or explicit retry. The effect REPLACES the
    // in-memory profile via setProfile, so reacting to live seed.name/seed.email
    // changes (full_name can arrive late via the users/{uid} snapshot) would wipe
    // the candidate's unsaved section edits. The seed is first-load-only by design.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, reloadKey]);

  const ready = useMemo(() => isTalentProfileReady(profile), [profile]);
  const highlightedPaths = useMemo(() => new Set(prefillReview?.paths ?? []), [prefillReview]);
  const validationIssues = useMemo(() => collectValidationIssues(profile), [profile]);
  const issueByPath = useMemo(() => new Map(validationIssues.map((issue) => [issue.path, issue.message])), [validationIssues]);
  const hasBlockingValidation = validationIssues.length > 0;

  const acceptPrefillReview = () => {
    setPrefillReview(null);
    setPrefillMsg({ kind: 'ok', text: 'AI prefill marked as reviewed. Save when the details look correct.' });
  };

  const clearPrefillDraft = () => {
    if (!prefillReview) return;
    setProfile(cloneProfile(prefillReview.before));
    setPrefillReview(null);
    setSaveError(false);
    setPrefillMsg({ kind: 'info', text: 'AI prefill cleared. Your profile is back to the version before this draft.' });
  };

  const setObjectField = (sectionId: string, key: string, v: unknown) => {
    setProfile((p) => ({ ...p, [sectionId]: { ...(p as any)[sectionId], [key]: v } }));
    markReviewPath(`${sectionId}.${key}`);
  };
  const setSkill = (group: string, v: string[]) => {
    setProfile((p) => ({ ...p, skills: { ...p.skills, [group]: v } }));
    markReviewPath(`skills.${group}`);
  };
  const addItem = (sectionId: string) =>
    setProfile((p) => ({ ...p, [sectionId]: [...((p as any)[sectionId] as unknown[]), {}] }));
  const removeItem = (sectionId: string, i: number) => {
    setProfile((p) => ({ ...p, [sectionId]: ((p as any)[sectionId] as unknown[]).filter((_, idx) => idx !== i) }));
    clearReviewPathsByPrefix(`${sectionId}.`);
  };
  const setItemField = (sectionId: string, i: number, key: string, v: unknown) => {
    setProfile((p) => ({
      ...p,
      [sectionId]: ((p as any)[sectionId] as Record<string, unknown>[]).map((it, idx) => (idx === i ? { ...it, [key]: v } : it)),
    }));
    markReviewPath(`${sectionId}.${i}.${key}`);
  };

  const persist = async (markComplete: boolean): Promise<TalentProfile> => {
    if (hasBlockingValidation) {
      setPrefillMsg({ kind: 'error', text: 'Fix the highlighted validation issues before saving.' });
      throw new Error('Fix validation issues before saving.');
    }
    const next: TalentProfile = { ...profile, status: markComplete && ready ? 'complete' : profile.status };
    setSaving(true);
    setSaveError(false);
    try {
      await saveTalentProfile(uid, next);
      setProfile(next);
      setSavedAt(Date.now());
      onSaved?.(next);
    } catch (e) {
      // Surface the failure — a silent swallow leaves the form looking saved
      // while the server still holds the old profile (and the apply gate reads it).
      setSaveError(true);
      throw e;
    } finally {
      setSaving(false);
    }
    return next;
  };

  const toggle = (id: string) => setOpen((o) => ({ ...o, [id]: !o[id] }));

  if (loadError) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-16 text-center text-gray-500">
        <p>Couldn't load your Talent Profile. Check your connection and try again.</p>
        <button type="button" onClick={() => setReloadKey((k) => k + 1)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:border-slate-600 dark:text-gray-200 dark:hover:bg-slate-800">Retry</button>
      </div>
    );
  }
  if (loading) {
    return <div className="flex items-center justify-center py-16 text-gray-500"><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading your profile…</div>;
  }

  const renderSection = (section: Section) => {
    const isOpen = open[section.id] ?? false;
    let count = 0;
    if (section.kind === 'list') count = ((profile as any)[section.id] as unknown[]).length;
    return (
      <div key={section.id} className="rounded-xl border border-gray-200 bg-white dark:border-slate-700 dark:bg-slate-800">
        <button type="button" onClick={() => toggle(section.id)} className="flex w-full items-center justify-between px-5 py-4 text-left">
          <span className="flex items-center gap-2 text-base font-semibold text-gray-900 dark:text-gray-100">
            {section.title}
            {section.kind === 'list' && count > 0 && <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500 dark:bg-slate-700 dark:text-slate-300">{count}</span>}
          </span>
          {isOpen ? <ChevronDown className="h-5 w-5 text-gray-400" /> : <ChevronRight className="h-5 w-5 text-gray-400" />}
        </button>
        {isOpen && (
          <div className="border-t border-gray-100 px-5 py-5 dark:border-slate-700">
            {section.kind === 'object' && (
              <FieldGrid
                fields={section.fields}
                data={(profile as any)[section.id]}
                onField={(k, v) => setObjectField(section.id, k, v)}
                pathFor={(key) => `${section.id}.${key}`}
                highlightedPaths={highlightedPaths}
                issueByPath={issueByPath}
                onReviewPath={markReviewPath}
              />
            )}
            {section.kind === 'skills' && (
              <div className="space-y-5">
                {section.groups.map((g) => (
                  <div
                    key={g.key}
                    className={`rounded-lg ${highlightedPaths.has(`skills.${g.key}`) ? 'border border-blue-200 bg-blue-50/70 p-2 dark:border-blue-900/60 dark:bg-blue-950/20' : ''}`}
                  >
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <p className="text-xs font-semibold text-gray-600 dark:text-gray-300">{g.label}</p>
                      {highlightedPaths.has(`skills.${g.key}`) && (
                        <button type="button" onClick={() => markReviewPath(`skills.${g.key}`)} className="text-[11px] font-semibold text-blue-600 hover:text-blue-800 dark:text-blue-300 dark:hover:text-blue-100">
                          Reviewed
                        </button>
                      )}
                    </div>
                    <ChipEditor values={profile.skills[g.key] ?? []} onChange={(v) => setSkill(g.key, v)} placeholder={`Add ${g.label.toLowerCase()}…`} suggestions={g.suggestions} />
                  </div>
                ))}
              </div>
            )}
            {section.kind === 'list' && (
              <div className="space-y-4">
                {((profile as any)[section.id] as Record<string, unknown>[]).map((item, i) => (
                  <div key={i} className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-slate-600 dark:bg-slate-900/50">
                    <div className="mb-3 flex items-center justify-between">
                      <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                        {(item[section.itemTitleKey] as string) || `New ${section.itemLabel}`}
                      </span>
                      <button type="button" onClick={() => removeItem(section.id, i)} className="inline-flex items-center gap-1 text-xs font-medium text-gray-400 hover:text-red-600">
                        <Trash2 className="h-3.5 w-3.5" /> Remove
                      </button>
                    </div>
                    <FieldGrid
                      fields={section.fields}
                      data={item}
                      onField={(k, v) => setItemField(section.id, i, k, v)}
                      pathFor={(key) => `${section.id}.${i}.${key}`}
                      highlightedPaths={highlightedPaths}
                      issueByPath={issueByPath}
                      onReviewPath={markReviewPath}
                    />
                  </div>
                ))}
                <button type="button" onClick={() => addItem(section.id)} className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-gray-300 px-4 py-2 text-sm font-medium text-gray-600 hover:border-blue-400 hover:text-blue-600 dark:border-slate-600 dark:text-slate-300">
                  <Plus className="h-4 w-4" /> Add {section.itemLabel}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="mx-auto max-w-3xl pb-28">
      <div className="mb-5">
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Talent Profile</h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Fill this once. It pre-fills every job application and lets employers discover you. References are shown to employers as “available on request”.</p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button type="button" onClick={openPrefillDialog} disabled={prefilling} className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700 transition-colors hover:bg-blue-100 disabled:opacity-60 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-blue-300">
            {prefilling ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {prefilling ? 'Reading your resume…' : 'Prefill from my resume'}
          </button>
          {prefillMsg && (
            <span className={`text-xs ${prefillMsg.kind === 'error' ? 'text-red-600 dark:text-red-400' : prefillMsg.kind === 'ok' ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-500 dark:text-gray-400'}`}>
              {prefillMsg.text}
            </span>
          )}
        </div>
        <p className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium">
          {ready
            ? <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"><Check className="h-3.5 w-3.5" /> Ready to apply</span>
            : <span className="rounded-full bg-amber-50 px-2 py-1 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">Add your name, a target role, and one education or experience entry to be ready to apply.</span>}
          {savedAt && <span className="text-gray-400">Saved</span>}
        </p>
      </div>

      {prefillReview && (
        <div className="mb-4 rounded-xl border border-blue-200 bg-blue-50 p-4 dark:border-blue-900/60 dark:bg-blue-950/25">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="inline-flex items-center gap-1.5 text-sm font-bold text-blue-800 dark:text-blue-200">
                <Sparkles className="h-4 w-4" /> Review AI-filled fields
              </p>
              <p className="mt-1 text-sm leading-6 text-blue-900/80 dark:text-blue-100/80">
                {prefillReview.paths.length} highlighted field{prefillReview.paths.length === 1 ? '' : 's'} were drafted in {prefillReview.languageLabel}. Confirm each field, edit it, or clear the whole draft before saving.
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              <button type="button" onClick={acceptPrefillReview} className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700">
                <Check className="h-3.5 w-3.5" /> Accept all
              </button>
              <button type="button" onClick={clearPrefillDraft} className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-white px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-50 dark:border-blue-800 dark:bg-slate-900 dark:text-blue-200 dark:hover:bg-blue-950/40">
                <RotateCcw className="h-3.5 w-3.5" /> Clear draft
              </button>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {prefillReview.paths.slice(0, 8).map((path) => (
              <button key={path} type="button" onClick={() => markReviewPath(path)} className="rounded-full border border-blue-200 bg-white px-2.5 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100 dark:border-blue-800 dark:bg-slate-900 dark:text-blue-200 dark:hover:bg-blue-950/40">
                {getPathLabel(path)}
              </button>
            ))}
            {prefillReview.paths.length > 8 && <span className="rounded-full bg-blue-100 px-2.5 py-1 text-xs font-medium text-blue-700 dark:bg-blue-950/50 dark:text-blue-200">+{prefillReview.paths.length - 8} more</span>}
          </div>
        </div>
      )}

      {validationIssues.length > 0 && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900 dark:border-red-900/60 dark:bg-red-950/20 dark:text-red-100">
          <p className="inline-flex items-center gap-1.5 font-bold">
            <AlertTriangle className="h-4 w-4" /> Fix {validationIssues.length} validation issue{validationIssues.length === 1 ? '' : 's'} before saving
          </p>
          <ul className="mt-2 space-y-1">
            {validationIssues.slice(0, 5).map((issue) => (
              <li key={`${issue.path}:${issue.message}`}>{getPathLabel(issue.path)}: {issue.message}</li>
            ))}
            {validationIssues.length > 5 && <li>+{validationIssues.length - 5} more issues below.</li>}
          </ul>
        </div>
      )}

      {prefillDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4 py-6 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-xl border border-gray-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900">
            <div className="flex items-start justify-between gap-4 border-b border-gray-100 px-5 py-4 dark:border-slate-800">
              <div>
                <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-blue-600 dark:text-blue-300">
                  <Sparkles className="h-3.5 w-3.5" /> Resume prefill
                </p>
                <h3 className="mt-2 text-lg font-bold text-gray-950 dark:text-gray-50">Choose the draft language</h3>
                <p className="mt-1 text-sm leading-6 text-gray-500 dark:text-slate-400">
                  AI will extract facts from your resume and fill empty Talent Profile fields. It will not save automatically.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPrefillDialogOpen(false)}
                disabled={prefilling}
                className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-50 dark:hover:bg-slate-800 dark:hover:text-gray-200"
                aria-label="Close prefill dialog"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 px-5 py-5">
              <div>
                <label htmlFor="talent-profile-prefill-language" className="mb-1 block text-sm font-semibold text-gray-800 dark:text-gray-100">
                  Output language
                </label>
                <select
                  id="talent-profile-prefill-language"
                  value={prefillLanguage}
                  onChange={(e) => setPrefillLanguage(e.target.value)}
                  className={inputCls}
                  disabled={prefilling}
                >
                  {PREFILL_LANGUAGE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
                <p className="mt-2 text-xs leading-5 text-gray-500 dark:text-slate-400">
                  {PREFILL_LANGUAGE_OPTIONS.find((option) => option.value === prefillLanguage)?.note}
                </p>
              </div>

              <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100">
                Treat this as a first draft. Review names, dates, target role, achievements, skills, and any missing sections before saving or applying.
              </div>
            </div>

            <div className="flex flex-col-reverse gap-2 border-t border-gray-100 px-5 py-4 sm:flex-row sm:justify-end dark:border-slate-800">
              <button
                type="button"
                onClick={() => setPrefillDialogOpen(false)}
                disabled={prefilling}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-slate-600 dark:text-gray-200 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => { handlePrefill(prefillLanguage).catch(() => {}); }}
                disabled={prefilling}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
              >
                {prefilling ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                {prefilling ? 'Reading resume…' : 'Prefill draft'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-3">{TALENT_PROFILE_SCHEMA.map(renderSection)}</div>

      {/* Sticky action bar */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-gray-200 bg-white/95 px-4 py-3 backdrop-blur dark:border-slate-700 dark:bg-slate-900/95">
        <div className="mx-auto flex max-w-3xl items-center justify-end gap-3">
          {saveError && (
            <span className="mr-auto text-xs font-medium text-red-600 dark:text-red-400">
              Couldn't save. Check your connection and try again.
            </span>
          )}
          {!saveError && hasBlockingValidation && (
            <span className="mr-auto text-xs font-medium text-red-600 dark:text-red-400">
              Fix validation issues before saving.
            </span>
          )}
          <button type="button" onClick={() => { persist(true).catch(() => {}); }} disabled={saving || prefilling || hasBlockingValidation} className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60 dark:border-slate-600 dark:text-gray-200 dark:hover:bg-slate-800">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save
          </button>
          {onPrimary && (
            <button type="button" disabled={saving || prefilling || !ready || hasBlockingValidation} onClick={async () => { try { const p = await persist(true); onPrimary(p); } catch { /* error shown inline */ } }} className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50">
              {primaryLabel ?? 'Save & apply'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default TalentProfileForm;
