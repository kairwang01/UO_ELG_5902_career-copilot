import { useState, useEffect, useCallback } from 'react';
import { getTranslations } from '../localization';

type Translations = { [key: string]: string };

export const useLocalization = (initialLanguage?: string) => {
    const [language, setLanguage] = useState(initialLanguage || (navigator.language.split('-')[0]) || 'en');
    const [translations, setTranslations] = useState<Translations>({});
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

    const t = (key: string): string => {
        return translations[key] || key; // Return key as fallback
    };

    return { t, isLoaded, currentLang: language, changeLanguage };
};
