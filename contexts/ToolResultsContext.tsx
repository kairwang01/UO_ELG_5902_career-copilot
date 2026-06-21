/**
 * ToolResultsContext — exposes the active tool's saved-result API to whichever
 * tool ToolRunner is rendering, so individual tools don't each need session /
 * profile props threaded in. The provider (mounted once per active tool) owns
 * the load/persist/clear lifecycle; tools call useToolResults<T>() to hydrate
 * their result on open and persist it after a run.
 *
 * Tier gating: only candidate paid plans can save (canSave). Free users get a
 * no-op persist and never load anything — the real enforcement is in
 * firestore.rules; canSave just drives UX (badges / upgrade hints / skip write).
 */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import {
  canSaveResults,
  clearToolResult,
  loadToolResult,
  saveToolResult,
  type SavedToolResult,
} from '../services/toolResults';

interface ToolResultsValue {
  toolKey: string;
  /** True when the current user's plan may persist results (candidate paid tiers). */
  canSave: boolean;
  /** The saved result for this tool, or null. Untyped here; consumers cast via the generic hook. */
  saved: SavedToolResult | null;
  /** False until the initial load attempt has resolved (so tools don't flash the form first). */
  savedLoaded: boolean;
  /** Persist a fresh result (no-op for free tier or signed-out). */
  persist: (result: unknown) => void;
  /** Discard the saved result (local + cloud). */
  clear: () => void;
}

const ToolResultsContext = createContext<ToolResultsValue | null>(null);

/** Typed accessor. Outside a provider it returns an inert default so a tool can
 *  be rendered standalone without crashing. */
export function useToolResults<T = unknown>(): {
  toolKey: string;
  canSave: boolean;
  saved: SavedToolResult<T> | null;
  savedLoaded: boolean;
  persist: (result: T) => void;
  clear: () => void;
} {
  const ctx = useContext(ToolResultsContext);
  if (!ctx) {
    return { toolKey: '', canSave: false, saved: null, savedLoaded: true, persist: () => {}, clear: () => {} };
  }
  return {
    toolKey: ctx.toolKey,
    canSave: ctx.canSave,
    saved: ctx.saved as SavedToolResult<T> | null,
    savedLoaded: ctx.savedLoaded,
    persist: ctx.persist as (result: T) => void,
    clear: ctx.clear,
  };
}

interface ProviderProps {
  toolKey: string;
  uid: string | null;
  subscriptionStatus: string | null;
  children: ReactNode;
}

export const ToolResultsProvider: React.FC<ProviderProps> = ({ toolKey, uid, subscriptionStatus, children }) => {
  const canSave = canSaveResults(subscriptionStatus) && !!uid;
  const [saved, setSaved] = useState<SavedToolResult | null>(null);
  const [savedLoaded, setSavedLoaded] = useState(false);

  // Load the saved result when the tool (or user) changes. Free users skip the
  // read entirely (nothing to load) and resolve immediately.
  useEffect(() => {
    let alive = true;
    setSaved(null);
    setSavedLoaded(false);
    if (!uid || !canSave || !toolKey) {
      setSavedLoaded(true);
      return () => { alive = false; };
    }
    loadToolResult(uid, toolKey).then((r) => {
      if (!alive) return;
      setSaved(r);
      setSavedLoaded(true);
    });
    return () => { alive = false; };
  }, [uid, toolKey, canSave]);

  const persist = useCallback((result: unknown) => {
    if (!uid || !canSave || !toolKey) return;
    // Optimistically reflect the save so the badge updates immediately.
    setSaved({ result, savedAt: Date.now() });
    void saveToolResult(uid, toolKey, result);
  }, [uid, toolKey, canSave]);

  const clear = useCallback(() => {
    setSaved(null);
    if (uid && toolKey) void clearToolResult(uid, toolKey);
  }, [uid, toolKey]);

  const value = useMemo<ToolResultsValue>(
    () => ({ toolKey, canSave, saved, savedLoaded, persist, clear }),
    [toolKey, canSave, saved, savedLoaded, persist, clear],
  );

  // For a paid user, hold the tool's first paint until we know whether a saved
  // result exists — otherwise the input form flashes before the cached result
  // hydrates. Free users (canSave=false) render immediately.
  if (canSave && !savedLoaded) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-5 w-5 animate-spin text-slate-400" aria-hidden="true" />
      </div>
    );
  }

  return <ToolResultsContext.Provider value={value}>{children}</ToolResultsContext.Provider>;
};
