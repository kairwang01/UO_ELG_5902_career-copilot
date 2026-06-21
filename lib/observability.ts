/**
 * Front-end error/performance monitoring (Sentry), env-gated.
 *
 * No-op unless VITE_SENTRY_DSN is set, and Sentry is dynamically imported only then —
 * so dev, CI, and any DSN-less prod build pay zero bundle/runtime cost. Wire a DSN in
 * the host env to activate (SCRUM-39).
 */
type ImportMetaEnvLike = { VITE_SENTRY_DSN?: string; VITE_SENTRY_TRACES_RATE?: string; MODE?: string };

const env = ((import.meta as unknown as { env?: ImportMetaEnvLike }).env) ?? {};

export async function initObservability(): Promise<void> {
  const dsn = env.VITE_SENTRY_DSN;
  if (!dsn) return; // unconfigured → no-op
  try {
    const Sentry = await import('@sentry/react');
    Sentry.init({
      dsn,
      environment: env.MODE ?? 'production',
      // Conservative perf sampling; override via VITE_SENTRY_TRACES_RATE.
      tracesSampleRate: Number(env.VITE_SENTRY_TRACES_RATE ?? 0.1),
      // Don't ship PII to the error backend — this app handles resumes/contact data.
      sendDefaultPii: false,
    });
  } catch {
    // Monitoring must never break app boot.
  }
}
