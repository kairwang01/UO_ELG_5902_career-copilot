import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2, ChevronDown, ChevronRight, Check, Loader2, Save, Sparkles } from 'lucide-react';
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

const FieldGrid: React.FC<{ fields: FieldConfig[]; data: Record<string, unknown>; onField: (key: string, v: unknown) => void }> = ({ fields, data, onField }) => (
  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
    {fields.map((f) => (
      <div key={f.key} className={f.full || f.type === 'textarea' || f.type === 'chips' ? 'sm:col-span-2' : ''}>
        <FieldLabel field={f} />
        <FieldInput field={f} value={data[f.key]} onChange={(v) => onField(f.key, v)} />
      </div>
    ))}
  </div>
);

// ── Main form ───────────────────────────────────────────────────────────────
const TalentProfileForm: React.FC<TalentProfileFormProps> = ({ uid, seed, resumeText, primaryLabel, onPrimary, onSaved }) => {
  const [profile, setProfile] = useState<TalentProfile>(emptyTalentProfile());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [prefilling, setPrefilling] = useState(false);
  const [prefillMsg, setPrefillMsg] = useState<{ kind: 'ok' | 'info' | 'error'; text: string } | null>(null);
  const [open, setOpen] = useState<Record<string, boolean>>({ basic: true, intention: true });
  const [loadError, setLoadError] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  // Auto-fill from the candidate's resume. Fills ONLY empty fields / empty list
  // sections (never overwrites what the candidate already typed); skills are
  // unioned. The AI output is schema-coerced (sanitizeExtractedProfile) so dates
  // and select values populate correctly.
  const handlePrefill = async () => {
    if (!resumeText || resumeText.trim().length < 40) {
      setPrefillMsg({ kind: 'info', text: 'Add or upload your resume first (the “Resume” tab), then prefill here.' });
      return;
    }
    setPrefilling(true);
    setPrefillMsg(null);
    try {
      const ex = sanitizeExtractedProfile(await extractTalentProfile(resumeText));
      // Decide which sections will actually receive data (from current state) so
      // we can expand exactly those — the user must see everything before saving.
      const touched = new Set<string>();
      (['basic', 'intention', 'additional'] as const).forEach((id) => {
        const exObj = ex[id] as Record<string, string> | undefined;
        if (exObj && Object.keys(exObj).some((k) => { const cur = (profile[id] as Record<string, string>)[k]; return !cur || !String(cur).trim(); })) touched.add(id);
      });
      (['education', 'experience', 'projects', 'awards', 'portfolio'] as const).forEach((id) => {
        const exList = ex[id] as Record<string, string | string[]>[] | undefined;
        if (exList && exList.length && !(profile[id] ?? []).some(hasMeaningfulEntry)) touched.add(id);
      });
      if (ex.skills && Object.keys(ex.skills).some((g) => ((ex.skills as Record<string, string[]>)[g] ?? []).some((s) => !(profile.skills[g] ?? []).includes(s)))) touched.add('skills');

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
      setPrefillMsg({ kind: 'ok', text: 'Filled from your resume — please review and edit each section before saving.' });
    } catch (err) {
      setPrefillMsg({ kind: 'error', text: err instanceof Error ? err.message : 'Could not read your resume. Please fill the form manually.' });
    } finally {
      setPrefilling(false);
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

  const setObjectField = (sectionId: string, key: string, v: unknown) =>
    setProfile((p) => ({ ...p, [sectionId]: { ...(p as any)[sectionId], [key]: v } }));
  const setSkill = (group: string, v: string[]) =>
    setProfile((p) => ({ ...p, skills: { ...p.skills, [group]: v } }));
  const addItem = (sectionId: string) =>
    setProfile((p) => ({ ...p, [sectionId]: [...((p as any)[sectionId] as unknown[]), {}] }));
  const removeItem = (sectionId: string, i: number) =>
    setProfile((p) => ({ ...p, [sectionId]: ((p as any)[sectionId] as unknown[]).filter((_, idx) => idx !== i) }));
  const setItemField = (sectionId: string, i: number, key: string, v: unknown) =>
    setProfile((p) => ({
      ...p,
      [sectionId]: ((p as any)[sectionId] as Record<string, unknown>[]).map((it, idx) => (idx === i ? { ...it, [key]: v } : it)),
    }));

  const persist = async (markComplete: boolean): Promise<TalentProfile> => {
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
              <FieldGrid fields={section.fields} data={(profile as any)[section.id]} onField={(k, v) => setObjectField(section.id, k, v)} />
            )}
            {section.kind === 'skills' && (
              <div className="space-y-5">
                {section.groups.map((g) => (
                  <div key={g.key}>
                    <p className="mb-2 text-xs font-semibold text-gray-600 dark:text-gray-300">{g.label}</p>
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
                    <FieldGrid fields={section.fields} data={item} onField={(k, v) => setItemField(section.id, i, k, v)} />
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
          <button type="button" onClick={handlePrefill} disabled={prefilling} className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700 transition-colors hover:bg-blue-100 disabled:opacity-60 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-blue-300">
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

      <div className="space-y-3">{TALENT_PROFILE_SCHEMA.map(renderSection)}</div>

      {/* Sticky action bar */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-gray-200 bg-white/95 px-4 py-3 backdrop-blur dark:border-slate-700 dark:bg-slate-900/95">
        <div className="mx-auto flex max-w-3xl items-center justify-end gap-3">
          {saveError && (
            <span className="mr-auto text-xs font-medium text-red-600 dark:text-red-400">
              Couldn't save. Check your connection and try again.
            </span>
          )}
          <button type="button" onClick={() => { persist(true).catch(() => {}); }} disabled={saving || prefilling} className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60 dark:border-slate-600 dark:text-gray-200 dark:hover:bg-slate-800">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save
          </button>
          {onPrimary && (
            <button type="button" disabled={saving || prefilling || !ready} onClick={async () => { try { const p = await persist(true); onPrimary(p); } catch { /* error shown inline */ } }} className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50">
              {primaryLabel ?? 'Save & apply'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default TalentProfileForm;
