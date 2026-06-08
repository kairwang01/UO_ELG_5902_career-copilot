import { useLocalization } from '../../hooks/useLocalization';

/** Beta pages share the main localization pipeline — keys prefixed with `beta_`. */
export const useBetaI18n = () => {
  const { t, isLoaded, currentLang, changeLanguage } = useLocalization();
  return { t, isLoaded, currentLang, changeLanguage };
};
