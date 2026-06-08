import { useBetaI18nContext } from '../contexts/BetaI18nContext';

/**
 * Beta pages share ONE localization state via BetaI18nProvider.
 * Keys are prefixed with `beta_` in localization/*.json.
 */
export const useBetaI18n = () => useBetaI18nContext();
