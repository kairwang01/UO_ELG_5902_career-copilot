/** Top-level marketing and workspace routes for the public site shell. */
export const SITE_ROUTES = {
  home: '/',
  employers: '/employers',
  sampleReport: '/sample-report',
  pricing: '/pricing',
  portal: '/portal',
  /** Resume analysis and signed-in candidate tools (avoid `/app` — conflicts with App.tsx on macOS). */
  workspace: '/workspace',
} as const;
