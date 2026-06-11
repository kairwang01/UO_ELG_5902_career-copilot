/**
 * Client feature flags.
 *
 * Web3 is an experimental, optional module (wallet identity + Proof-of-Talent
 * credential on Sepolia). The core product must never depend on it, so the
 * whole surface — Account wallet section and the Identity & Wallet workspace
 * view — hangs off this flag.
 *
 * Persistence is per-browser (localStorage) for now: it lets the team demo
 * with the module on or off without a deploy. Platform-wide persistence will
 * move to platform_config once the corresponding admin callable ships; this
 * module is the single read/write point so that swap is contained here.
 */

const WEB3_FLAG_KEY = 'feature_web3_enabled';
const FLAG_EVENT = 'featureflag:web3';

/**
 * Default OFF — Web3 is an experimental opt-in. Enable it from the admin
 * console (Web3 tab) for demos; the toggle persists per browser, so the
 * candidate-side surfaces appear in the same browser session immediately.
 */
const WEB3_DEFAULT = false;

export const isWeb3Enabled = (): boolean => {
  try {
    const raw = localStorage.getItem(WEB3_FLAG_KEY);
    if (raw === null) return WEB3_DEFAULT;
    return raw === 'true';
  } catch {
    return WEB3_DEFAULT;
  }
};

export const setWeb3Enabled = (enabled: boolean): void => {
  try { localStorage.setItem(WEB3_FLAG_KEY, String(enabled)); } catch { /* unavailable */ }
  window.dispatchEvent(new CustomEvent(FLAG_EVENT, { detail: enabled }));
};

/** Subscribe to flag changes (same-tab toggles + cross-tab storage events). */
export const onWeb3FlagChange = (handler: (enabled: boolean) => void): (() => void) => {
  const onCustom = () => handler(isWeb3Enabled());
  const onStorage = (e: StorageEvent) => {
    if (e.key === WEB3_FLAG_KEY) handler(isWeb3Enabled());
  };
  window.addEventListener(FLAG_EVENT, onCustom);
  window.addEventListener('storage', onStorage);
  return () => {
    window.removeEventListener(FLAG_EVENT, onCustom);
    window.removeEventListener('storage', onStorage);
  };
};
