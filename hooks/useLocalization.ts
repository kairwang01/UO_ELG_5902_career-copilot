import { useState, useEffect, useCallback } from 'react';
import { getTranslations } from '../localization';

type Translations = { [key: string]: string };

export const useLocalization = (initialLanguage?: string) => {
    const [language, setLanguage] = useState(initialLanguage || (navigator.language.split('-')[0]) || 'en');
    const [translations, setTranslations] = useState<Translations>({});
    // English is loaded once as a fallback so a key missing in the active language
    // shows English copy instead of the raw key (e.g. newly-added strings that
    // haven't been translated to de/fr/ja/vi yet).
    const [fallback, setFallback] = useState<Translations>({});
    const [isLoaded, setIsLoaded] = useState(false);

    const changeLanguage = useCallback((newLang: string) => {
        if (newLang) {
            setLanguage(newLang);
        }
    }, []);

    useEffect(() => {
        let isMounted = true;
        const fetchTranslations = async () => {
            setIsLoaded(false);
            const loadedTranslations = await getTranslations(language);
            if (isMounted) {
                setTranslations(loadedTranslations);
                setIsLoaded(true);
            }
        };
        fetchTranslations();
        return () => {
            isMounted = false;
        };
    }, [language]);

    // Load the English dictionary once as the universal fallback.
    useEffect(() => {
        let isMounted = true;
        getTranslations('en').then((en) => { if (isMounted) setFallback(en); });
        return () => { isMounted = false; };
    }, []);

    // IMPORTANT: t must be referentially stable. Many components put `t` in
    // useCallback/useEffect dependency arrays; an unmemoized `t` gets a new
    // identity on EVERY render of the consumer, which re-fires those effects.
    // In OpportunityFinder this chained into an auto-rerun of the credit-charging
    // AI search on every credits update (deduct → live snapshot → re-render →
    // new t → effect refires → deduct again …) — an infinite credit drain.
    const t = useCallback((key: string): string => {
        return translations[key] || fallback[key] || key; // active lang → English → key
    }, [translations, fallback]);

    return { t, isLoaded, currentLang: language, changeLanguage };
};
