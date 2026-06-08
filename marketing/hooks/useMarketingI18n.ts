import { useMarketingI18nContext } from '../contexts/MarketingI18nContext';

/**
 * Beta pages share ONE localization state via MarketingI18nProvider.
 * Keys are prefixed with `beta_` in localization/*.json.
 */
export const useMarketingI18n = () => useMarketingI18nContext();
