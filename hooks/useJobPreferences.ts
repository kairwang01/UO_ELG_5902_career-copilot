import { useState } from 'react';

export interface JobPreferences {
  status: 'active' | 'open' | 'browsing' | 'not_looking';
  roles: string;        // comma-separated free text, e.g. "Frontend Engineer, Full-stack"
  locations: string;    // e.g. "Ottawa, Remote"
  salaryMin: string;    // free text, e.g. "80k CAD"
  availability: string; // e.g. "2 weeks notice"
}

const KEY = 'job_preferences';

export function loadJobPreferences(): JobPreferences | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as JobPreferences) : null;
  } catch {
    return null;
  }
}

export function saveJobPreferences(p: JobPreferences): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch { /* storage unavailable */ }
}

const STATUS_LABELS: Record<JobPreferences['status'], string> = {
  active: 'Actively looking',
  open: 'Open to opportunities',
  browsing: 'Just browsing',
  not_looking: 'Not looking',
};

/** Renders the preferences as a prompt block the AI job search prepends to the resume. */
export function preferencesToPromptBlock(p: JobPreferences): string {
  const statusLabel = STATUS_LABELS[p.status] ?? p.status;
  const lines: string[] = [
    'CANDIDATE JOB PREFERENCES (use these to filter and rank results):',
    `- Job-seeking status: ${statusLabel}`,
  ];
  if (p.roles.trim()) lines.push(`- Target roles: ${p.roles.trim()}`);
  if (p.locations.trim()) lines.push(`- Preferred locations: ${p.locations.trim()}`);
  if (p.salaryMin.trim()) lines.push(`- Minimum salary expectation: ${p.salaryMin.trim()}`);
  if (p.availability.trim()) lines.push(`- Availability: ${p.availability.trim()}`);
  return lines.join('\n');
}

/** One-line summary for display (roles · locations · salaryMin). */
export function prefsSummaryLine(p: JobPreferences): string {
  const parts: string[] = [];
  if (p.roles.trim()) parts.push(p.roles.trim());
  if (p.locations.trim()) parts.push(p.locations.trim());
  if (p.salaryMin.trim()) parts.push(p.salaryMin.trim());
  return parts.join(' · ');
}

/** React hook — wraps load/save with local state. */
export function useJobPreferences(): { prefs: JobPreferences | null; save: (p: JobPreferences) => void } {
  const [prefs, setPrefs] = useState<JobPreferences | null>(() => loadJobPreferences());

  const save = (p: JobPreferences) => {
    saveJobPreferences(p);
    setPrefs(p);
  };

  return { prefs, save };
}
