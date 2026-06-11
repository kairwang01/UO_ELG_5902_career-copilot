import { useState, useEffect, useCallback } from 'react';
import { getTranslations } from '../localization';

type Translations = { [key: string]: string };

const LANGUAGE_STORAGE_KEY = 'preferred_language';
const LANGUAGE_CHANGE_EVENT = 'career-copilot-language-change';

const readStoredLanguage = () => {
    if (typeof localStorage === 'undefined') return null;
    try {
        return localStorage.getItem(LANGUAGE_STORAGE_KEY);
    } catch {
        return null;
    }
};

const getBrowserLanguage = () => {
    if (typeof navigator === 'undefined') return 'en';
    return navigator.language.split('-')[0] || 'en';
};

const resolveInitialLanguage = (initialLanguage?: string) =>
    initialLanguage || readStoredLanguage() || getBrowserLanguage() || 'en';

export const useLocalization = (initialLanguage?: string) => {
    const [language, setLanguage] = useState(() => resolveInitialLanguage(initialLanguage));
    const [translations, setTranslations] = useState<Translations>({});
    // English is loaded once as a fallback so a key missing in the active language
    // shows English copy instead of the raw key (e.g. newly-added strings that
    // haven't been translated to de/fr/ja/vi yet).
    const [fallback, setFallback] = useState<Translations>({});
    const [isLoaded, setIsLoaded] = useState(false);

    const changeLanguage = useCallback((newLang: string) => {
        if (!newLang) return;
        setLanguage((current) => (current === newLang ? current : newLang));
        try {
            localStorage.setItem(LANGUAGE_STORAGE_KEY, newLang);
        } catch {
            /* Preference persistence is non-critical; keep the in-memory switch. */
        }
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent(LANGUAGE_CHANGE_EVENT, { detail: { language: newLang } }));
        }
    }, []);

    useEffect(() => {
        if (typeof window === 'undefined') return;

        const handleLanguageEvent = (event: Event) => {
            const lang = (event as CustomEvent<{ language?: string }>).detail?.language;
            if (lang) {
                setLanguage((current) => (current === lang ? current : lang));
            }
        };
        const handleStorageEvent = (event: StorageEvent) => {
            if (event.key === LANGUAGE_STORAGE_KEY && event.newValue) {
                setLanguage((current) => (current === event.newValue ? current : event.newValue || current));
            }
        };

        window.addEventListener(LANGUAGE_CHANGE_EVENT, handleLanguageEvent);
        window.addEventListener('storage', handleStorageEvent);
        return () => {
            window.removeEventListener(LANGUAGE_CHANGE_EVENT, handleLanguageEvent);
            window.removeEventListener('storage', handleStorageEvent);
        };
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
