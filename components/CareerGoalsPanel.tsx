import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Target } from 'lucide-react';
import { useJobPreferences, saveJobPreferences, prefsSummaryLine } from '../hooks/useJobPreferences';
import type { JobPreferences } from '../hooks/useJobPreferences';

interface CareerGoalsPanelProps {
  t?: (key: string) => string;
}

type StatusOption = {
  value: JobPreferences['status'];
  labelKey: string;
  labelEn: string;
  dot: string;
};

const STATUS_OPTIONS: StatusOption[] = [
  { value: 'active',      labelKey: 'goals_status_active',      labelEn: 'Actively looking',       dot: 'bg-green-500' },
  { value: 'open',        labelKey: 'goals_status_open',        labelEn: 'Open to opportunities',  dot: 'bg-blue-500' },
  { value: 'browsing',    labelKey: 'goals_status_browsing',    labelEn: 'Just browsing',           dot: 'bg-amber-500' },
  { value: 'not_looking', labelKey: 'goals_status_not_looking', labelEn: 'Not looking',            dot: 'bg-gray-400' },
];

const DEFAULT_PREFS: JobPreferences = {
  status: 'open',
  roles: '',
  locations: '',
  salaryMin: '',
  availability: '',
};

const CareerGoalsPanel: React.FC<CareerGoalsPanelProps> = ({ t: tProp }) => {
  // Identity fallback — returns the English label for the key when no t() provided
  const t = tProp ?? ((key: string) => {
    const map: Record<string, string> = {
      goals_panel_title:      'Career Goals',
      goals_panel_desc:       'Set your job-seeking preferences to guide your AI job search.',
      goals_status_active:    'Actively looking',
      goals_status_open:      'Open to opportunities',
      goals_status_browsing:  'Just browsing',
      goals_status_not_looking: 'Not looking',
      goals_label_roles:      'Target roles',
      goals_placeholder_roles: 'e.g. Frontend Engineer, Full-stack',
      goals_label_locations:  'Preferred locations',
      goals_placeholder_locations: 'e.g. Ottawa, Remote',
      goals_label_salary:     'Minimum salary',
      goals_placeholder_salary: 'e.g. 80k CAD',
      goals_label_availability: 'Availability',
      goals_placeholder_availability: 'e.g. 2 weeks notice',
      goals_save_button:      'Save',
      goals_saved_flash:      'Saved ✓',
      goals_feeds_ai:         'These preferences guide your AI job search.',
      goals_no_prefs:         'No preferences set yet.',
    };
    return map[key] ?? key;
  });

  const { prefs: storedPrefs, save } = useJobPreferences();
  const [isExpanded, setIsExpanded] = useState(!storedPrefs);
  const [form, setForm] = useState<JobPreferences>(storedPrefs ?? DEFAULT_PREFS);
  const [savedFlash, setSavedFlash] = useState(false);

  const handleSave = () => {
    save(form);
    setSavedFlash(true);
    setIsExpanded(false);
    setTimeout(() => setSavedFlash(false), 2000);
  };

  const summary = storedPrefs ? prefsSummaryLine(storedPrefs) : null;

  return (
    <section className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm overflow-hidden">
      {/* Header / collapsed row */}
      <button
        type="button"
        onClick={() => setIsExpanded((v) => !v)}
        className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left"
        aria-expanded={isExpanded}
      >
        <div className="flex items-center gap-2 min-w-0">
          <Target className="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
          <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">{t('goals_panel_title')}</span>
          {!isExpanded && storedPrefs && (
            <span className="ml-2 flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 truncate">
              {/* Status dot + label */}
              {(() => {
                const opt = STATUS_OPTIONS.find((o) => o.value === storedPrefs.status);
                return opt ? (
                  <>
                    <span className={`inline-block h-2 w-2 rounded-full ${opt.dot}`} />
                    <span>{t(opt.labelKey)}</span>
                  </>
                ) : null;
              })()}
              {summary && <span className="text-gray-400 dark:text-gray-500">·</span>}
              {summary && <span className="truncate">{summary}</span>}
            </span>
          )}
          {!isExpanded && !storedPrefs && (
            <span className="ml-2 text-xs text-gray-400 dark:text-gray-500">{t('goals_no_prefs')}</span>
          )}
        </div>
        {isExpanded ? (
          <ChevronUp className="h-4 w-4 shrink-0 text-gray-400 dark:text-gray-500" />
        ) : (
          <ChevronDown className="h-4 w-4 shrink-0 text-gray-400 dark:text-gray-500" />
        )}
      </button>

      {/* Expanded form */}
      {isExpanded && (
        <div className="px-5 pb-5 border-t border-slate-100 dark:border-slate-700">
          <p className="mt-3 mb-4 text-sm text-gray-600 dark:text-gray-300">{t('goals_panel_desc')}</p>

          {/* Status segmented control */}
          <div className="mb-4">
            <div className="flex flex-wrap gap-2">
              {STATUS_OPTIONS.map((opt) => {
                const isActive = form.status === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, status: opt.value }))}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition-colors
                      ${isActive
                        ? 'border-blue-300 dark:border-blue-600 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                        : 'border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-600 dark:text-gray-300 hover:bg-slate-50 dark:hover:bg-slate-600'
                      }`}
                  >
                    <span className={`h-2 w-2 rounded-full ${opt.dot}`} />
                    {t(opt.labelKey)}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Text inputs */}
          <div className="grid gap-3 sm:grid-cols-2">
            {/* Target roles */}
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('goals_label_roles')}
              </label>
              <input
                type="text"
                value={form.roles}
                onChange={(e) => setForm((f) => ({ ...f, roles: e.target.value }))}
                placeholder={t('goals_placeholder_roles')}
                className="w-full rounded-md border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-1.5 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/40"
              />
            </div>

            {/* Preferred locations */}
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('goals_label_locations')}
              </label>
              <input
                type="text"
                value={form.locations}
                onChange={(e) => setForm((f) => ({ ...f, locations: e.target.value }))}
                placeholder={t('goals_placeholder_locations')}
                className="w-full rounded-md border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-1.5 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/40"
              />
            </div>

            {/* Minimum salary */}
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('goals_label_salary')}
              </label>
              <input
                type="text"
                value={form.salaryMin}
                onChange={(e) => setForm((f) => ({ ...f, salaryMin: e.target.value }))}
                placeholder={t('goals_placeholder_salary')}
                className="w-full rounded-md border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-1.5 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/40"
              />
            </div>

            {/* Availability */}
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('goals_label_availability')}
              </label>
              <input
                type="text"
                value={form.availability}
                onChange={(e) => setForm((f) => ({ ...f, availability: e.target.value }))}
                placeholder={t('goals_placeholder_availability')}
                className="w-full rounded-md border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-1.5 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/40"
              />
            </div>
          </div>

          {/* Footer */}
          <div className="mt-4 flex items-center justify-between gap-3">
            <p className="text-xs text-gray-500 dark:text-gray-400">{t('goals_feeds_ai')}</p>
            <button
              type="button"
              onClick={handleSave}
              className="inline-flex items-center gap-1.5 rounded-md bg-blue-700 hover:bg-blue-800 px-4 py-1.5 text-sm font-semibold text-white transition-colors"
            >
              {savedFlash ? t('goals_saved_flash') : t('goals_save_button')}
            </button>
          </div>
        </div>
      )}
    </section>
  );
};

export default CareerGoalsPanel;
