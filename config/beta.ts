/**
 * Beta redesign feature flag.
 * MVP (June 17): leave unset or false — production uses state-based App.tsx only.
 * Beta preview: VITE_BETA_REDESIGN=true
 */
export const BETA_REDESIGN_ENABLED =
  import.meta.env.VITE_BETA_REDESIGN === 'true';

export const BETA_ROUTES = {
  home: '/',
  employers: '/employers',
  sampleReport: '/sample-report',
  pricing: '/pricing',
  portal: '/portal',
  /** MVP app shell when beta flag is on — production uses / when flag is off */
  mvpApp: '/app',
} as const;
