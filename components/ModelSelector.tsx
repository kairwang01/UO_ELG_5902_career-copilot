import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  listModels,
  getAiModel,
  setAiModel,
  getBusinessLlmConfig,
  setBusinessLlmConfig,
  type ModelOption,
} from '../services/aiClient';

/**
 * ModelSelector — full model picker (kept for backward-compat imports).
 * Now only used internally; the public surface exposed to Account.tsx is
 * `BusinessCustomApi` — the isolated BYOA config form for business users.
 *
 * The general model dropdown has been removed from all user-facing UI
 * (model routing is admin-controlled server-side). Business users retain
 * the ability to configure and activate their own custom LLM endpoint.
 */

interface ConfigFormState {
  base_url: string;
  api_key: string;
  model: string;
}

const EMPTY_FORM: ConfigFormState = { base_url: '', api_key: '', model: '' };

const ModelSelector: React.FC<{ className?: string; t?: (key: string) => string }> = ({ className, t }) => {
  const [models, setModels] = useState<ModelOption[]>([]);
  const [selected, setSelected] = useState<string>(getAiModel() ?? '');
  const [isBusiness, setIsBusiness] = useState(false);
  const [ready, setReady] = useState(false);

  // Config-form state (business tier only)
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<ConfigFormState>(EMPTY_FORM);
  const [maskedKey, setMaskedKey] = useState<string | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [formMsg, setFormMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const formLoadedRef = useRef(false);

  // Load models on mount
  useEffect(() => {
    let active = true;
    listModels()
      .then(({ models: ms, defaultModelId, isBusiness: biz }) => {
        if (!active) return;
        setModels(ms);
        setIsBusiness(!!biz);
        const stored = getAiModel();
        if (stored && !ms.some((m) => m.id === stored)) {
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

  // Load existing business config when the form opens (once per mount)
  const openForm = useCallback(async () => {
    setShowForm(true);
    setFormMsg(null);
    if (formLoadedRef.current) return;
    formLoadedRef.current = true;
    setFormLoading(true);
    try {
      const cfg = await getBusinessLlmConfig();
      if (cfg.configured) {
        setForm({ base_url: cfg.base_url, api_key: '', model: cfg.model });
        setMaskedKey(cfg.api_key_masked);
      }
    } catch {
      // Non-fatal — form just stays blank
    } finally {
      setFormLoading(false);
    }
  }, []);

  const handleSelectChange = useCallback((value: string) => {
    setSelected(value);
    setAiModel(value);
    if (value === 'custom') {
      openForm();
    } else {
      setShowForm(false);
    }
  }, [openForm]);

  const handleFormSave = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setFormMsg(null);

    // Basic validation — never log the raw key
    if (!form.base_url.startsWith('https://')) {
      setFormMsg({ type: 'error', text: 'Base URL must start with https://' });
      return;
    }
    if (!form.api_key && !maskedKey) {
      setFormMsg({ type: 'error', text: 'API key is required.' });
      return;
    }
    if (!form.model.trim()) {
      setFormMsg({ type: 'error', text: 'Model name is required.' });
      return;
    }

    setFormLoading(true);
    try {
      await setBusinessLlmConfig({
        base_url: form.base_url.trim(),
        api_key: form.api_key,   // raw key sent only over the secure callable, never logged or displayed
        model: form.model.trim(),
      });
      // Clear the raw key from state immediately after a successful save
      setForm((prev) => ({ ...prev, api_key: '' }));
      setMaskedKey(null); // server will have the new masked value; refresh on next open
      formLoadedRef.current = false;
      setFormMsg({ type: 'success', text: 'Custom LLM config saved.' });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Save failed. Check your inputs and try again.';
      setFormMsg({ type: 'error', text: msg });
    } finally {
      setFormLoading(false);
    }
  }, [form, maskedKey]);

  // Free tier (or still loading) → nothing to show
  if (!ready || models.length <= 1) return null;

  const label = t ? t('ai_model_label') : 'AI Model';

  const isCustomSelected = selected === 'custom';

  return (
    <div className={className}>
      <label className="block text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-slate-400 mb-1">
        {label}
      </label>

      <div className="flex items-center gap-1.5">
        <select
          value={selected}
          onChange={(e) => handleSelectChange(e.target.value)}
          className="flex-1 text-sm rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-800 dark:text-gray-200 px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {models.map((m) => (
            <option key={m.id} value={m.id}>{m.label}</option>
          ))}
        </select>

        {/* "Configure" affordance: only for business users when custom is selected */}
        {isBusiness && isCustomSelected && (
          <button
            type="button"
            onClick={() => (showForm ? setShowForm(false) : openForm())}
            title="Configure custom LLM endpoint"
            className="flex-shrink-0 text-[10px] font-semibold px-2 py-1.5 rounded-lg border border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-800/40 transition-colors"
          >
            {showForm ? 'Hide' : 'Configure'}
          </button>
        )}
      </div>

      {/* Inline config form — only rendered for business users with custom model */}
      {isBusiness && isCustomSelected && showForm && (
        <form
          onSubmit={handleFormSave}
          className="mt-2.5 rounded-xl border border-blue-200 dark:border-blue-800/60 bg-blue-50/60 dark:bg-blue-950/30 p-3 flex flex-col gap-2.5"
        >
          <p className="text-[10px] font-bold uppercase tracking-wide text-blue-600 dark:text-blue-400">
            Custom LLM Endpoint
          </p>

          {/* Base URL */}
          <div>
            <label className="block text-[10px] font-semibold text-gray-500 dark:text-slate-400 mb-0.5">
              API Base URL
            </label>
            <input
              type="url"
              required
              placeholder="https://api.example.com/v1"
              value={form.base_url}
              onChange={(e) => setForm((prev) => ({ ...prev, base_url: e.target.value }))}
              disabled={formLoading}
              className="w-full text-xs rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-800 dark:text-gray-200 px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60"
            />
          </div>

          {/* API key */}
          <div>
            <label className="block text-[10px] font-semibold text-gray-500 dark:text-slate-400 mb-0.5">
              API Key{maskedKey && !form.api_key ? (
                <span className="ml-1.5 font-normal text-gray-400 dark:text-slate-500">
                  (current: {maskedKey})
                </span>
              ) : null}
            </label>
            <input
              type="password"
              autoComplete="new-password"
              placeholder={maskedKey ? 'Enter new key to replace' : 'sk-…'}
              value={form.api_key}
              onChange={(e) => setForm((prev) => ({ ...prev, api_key: e.target.value }))}
              disabled={formLoading}
              className="w-full text-xs rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-800 dark:text-gray-200 px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60"
            />
          </div>

          {/* Model name */}
          <div>
            <label className="block text-[10px] font-semibold text-gray-500 dark:text-slate-400 mb-0.5">
              Model Name
            </label>
            <input
              type="text"
              required
              placeholder="e.g. gpt-4o or meta-llama/llama-3-8b"
              value={form.model}
              onChange={(e) => setForm((prev) => ({ ...prev, model: e.target.value }))}
              disabled={formLoading}
              className="w-full text-xs rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-800 dark:text-gray-200 px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60"
            />
          </div>

          {/* Inline feedback */}
          {formMsg && (
            <p className={`text-[10px] font-medium leading-snug ${
              formMsg.type === 'success'
                ? 'text-green-600 dark:text-green-400'
                : 'text-red-600 dark:text-red-400'
            }`}>
              {formMsg.text}
            </p>
          )}

          <button
            type="submit"
            disabled={formLoading}
            className="self-end text-[11px] font-semibold px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600 text-white transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {formLoading ? 'Saving…' : 'Save'}
          </button>
        </form>
      )}
    </div>
  );
};

export default ModelSelector;

/**
 * BusinessCustomApi — focused BYOA config form for business-tier users.
 *
 * Checks the user's tier via listModels(). If isBusiness is false the component
 * renders nothing. Otherwise it shows the inline form that lets the user set their
 * custom LLM endpoint (base URL + API key + model name) and activates model id
 * 'custom' via setAiModel once the config is saved.
 *
 * Usage in Account.tsx:
 *   <BusinessCustomApi className="mt-10 max-w-md" t={t} />
 */
export const BusinessCustomApi: React.FC<{ className?: string; t?: (key: string) => string }> = ({ className, t: _t }) => {
  const [isBusiness, setIsBusiness] = useState(false);
  const [ready, setReady] = useState(false);

  const [form, setForm] = useState<ConfigFormState>(EMPTY_FORM);
  const [maskedKey, setMaskedKey] = useState<string | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [formMsg, setFormMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const formLoadedRef = useRef(false);

  useEffect(() => {
    let active = true;
    listModels()
      .then(({ isBusiness: biz }) => {
        if (!active) return;
        setIsBusiness(!!biz);
        setReady(true);
      })
      .catch(() => { setReady(true); });
    return () => { active = false; };
  }, []);

  // Load existing config once on mount
  useEffect(() => {
    if (!isBusiness || formLoadedRef.current) return;
    formLoadedRef.current = true;
    setFormLoading(true);
    getBusinessLlmConfig()
      .then((cfg) => {
        if (cfg.configured) {
          setForm({ base_url: cfg.base_url, api_key: '', model: cfg.model });
          setMaskedKey(cfg.api_key_masked);
          // Restore the active custom selection so callers see 'custom' as current model.
          setAiModel('custom');
        }
      })
      .catch(() => { /* Non-fatal — form stays blank */ })
      .finally(() => setFormLoading(false));
  }, [isBusiness]);

  const handleFormSave = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setFormMsg(null);

    if (!form.base_url.startsWith('https://')) {
      setFormMsg({ type: 'error', text: 'Base URL must start with https://' });
      return;
    }
    if (!form.api_key && !maskedKey) {
      setFormMsg({ type: 'error', text: 'API key is required.' });
      return;
    }
    if (!form.model.trim()) {
      setFormMsg({ type: 'error', text: 'Model name is required.' });
      return;
    }

    setFormLoading(true);
    try {
      await setBusinessLlmConfig({
        base_url: form.base_url.trim(),
        api_key: form.api_key,
        model: form.model.trim(),
      });
      setForm((prev) => ({ ...prev, api_key: '' }));
      setMaskedKey(null);
      formLoadedRef.current = false;
      // Activate 'custom' so aiClient sends model='custom' to the server.
      setAiModel('custom');
      setFormMsg({ type: 'success', text: 'Custom LLM config saved.' });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Save failed. Check your inputs and try again.';
      setFormMsg({ type: 'error', text: msg });
    } finally {
      setFormLoading(false);
    }
  }, [form, maskedKey]);

  if (!ready || !isBusiness) return null;

  return (
    <div className={className}>
      <h2 className="text-xl font-semibold text-gray-700 dark:text-gray-300 border-b dark:border-slate-700 pb-2">
        Custom AI Endpoint
      </h2>

      <form
        onSubmit={handleFormSave}
        className="mt-4 rounded-xl border border-blue-200 dark:border-blue-800/60 bg-blue-50/60 dark:bg-blue-950/30 p-4 flex flex-col gap-3"
      >
        <p className="text-[10px] font-bold uppercase tracking-wide text-blue-600 dark:text-blue-400">
          Bring Your Own LLM Endpoint
        </p>

        {/* Base URL */}
        <div>
          <label className="block text-xs font-semibold text-gray-600 dark:text-slate-400 mb-1">
            API Base URL
          </label>
          <input
            type="url"
            required
            placeholder="https://api.example.com/v1"
            value={form.base_url}
            onChange={(e) => setForm((prev) => ({ ...prev, base_url: e.target.value }))}
            disabled={formLoading}
            className="w-full text-sm rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-800 dark:text-gray-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60"
          />
        </div>

        {/* API key */}
        <div>
          <label className="block text-xs font-semibold text-gray-600 dark:text-slate-400 mb-1">
            API Key{maskedKey && !form.api_key ? (
              <span className="ml-1.5 font-normal text-gray-400 dark:text-slate-500">
                (current: {maskedKey})
              </span>
            ) : null}
          </label>
          <input
            type="password"
            autoComplete="new-password"
            placeholder={maskedKey ? 'Enter new key to replace' : 'sk-…'}
            value={form.api_key}
            onChange={(e) => setForm((prev) => ({ ...prev, api_key: e.target.value }))}
            disabled={formLoading}
            className="w-full text-sm rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-800 dark:text-gray-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60"
          />
        </div>

        {/* Model name */}
        <div>
          <label className="block text-xs font-semibold text-gray-600 dark:text-slate-400 mb-1">
            Model Name
          </label>
          <input
            type="text"
            required
            placeholder="e.g. gpt-4o or meta-llama/llama-3-8b"
            value={form.model}
            onChange={(e) => setForm((prev) => ({ ...prev, model: e.target.value }))}
            disabled={formLoading}
            className="w-full text-sm rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-800 dark:text-gray-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60"
          />
        </div>

        {/* Feedback */}
        {formMsg && (
          <p className={`text-xs font-medium leading-snug ${
            formMsg.type === 'success'
              ? 'text-green-600 dark:text-green-400'
              : 'text-red-600 dark:text-red-400'
          }`}>
            {formMsg.text}
          </p>
        )}

        <button
          type="submit"
          disabled={formLoading}
          className="self-end text-sm font-semibold px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600 text-white transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {formLoading ? 'Saving…' : 'Save configuration'}
        </button>
      </form>
    </div>
  );
};
