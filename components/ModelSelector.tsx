import React, { useEffect, useState } from 'react';
import { listModels, getAiModel, setAiModel, type ModelOption } from '../services/aiClient';

/**
 * AI model picker. Calls listModels() — which returns only the models the user's
 * tier allows — and renders a dropdown. Free users get a single model back, so the
 * picker hides itself. Selection is persisted (localStorage) and re-enforced
 * server-side on every call, so this is purely a convenience control.
 */
const ModelSelector: React.FC<{ className?: string; t?: (key: string) => string }> = ({ className, t }) => {
  const [models, setModels] = useState<ModelOption[]>([]);
  const [selected, setSelected] = useState<string>(getAiModel() ?? '');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    listModels()
      .then(({ models, defaultModelId }) => {
        if (!active) return;
        setModels(models);
        const stored = getAiModel();
        // Drop a stored model the user can no longer access (e.g. after a downgrade).
        if (stored && !models.some((m) => m.id === stored)) {
          setAiModel(undefined);
          setSelected(defaultModelId);
        } else {
          setSelected(stored ?? defaultModelId);
        }
        setReady(true);
      })
      .catch(() => { /* signed out / offline — keep hidden */ });
    return () => { active = false; };
  }, []);

  // Free tier returns a single model → nothing to choose.
  if (!ready || models.length <= 1) return null;

  const label = t ? t('ai_model_label') : 'AI Model';

  return (
    <div className={className}>
      <label className="block text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-slate-400 mb-1">
        {label}
      </label>
      <select
        value={selected}
        onChange={(e) => { setSelected(e.target.value); setAiModel(e.target.value); }}
        className="w-full text-sm rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-800 dark:text-gray-200 px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        {models.map((m) => (
          <option key={m.id} value={m.id}>{m.label}</option>
        ))}
      </select>
    </div>
  );
};

export default ModelSelector;
