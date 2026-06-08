/**
 * Beta marketing shell is the default site entry.
 * Set VITE_BETA_REDESIGN=false to roll back to the legacy MVP homepage at /.
 */
export const BETA_REDESIGN_ENABLED =
  import.meta.env.VITE_BETA_REDESIGN !== 'false';

export const BETA_ROUTES = {
  home: '/',
  employers: '/employers',
  sampleReport: '/sample-report',
  pricing: '/pricing',
  portal: '/portal',
  /** MVP app shell when beta flag is on — production uses / when flag is off */
  mvpApp: '/app',
} as const;
