const fetchTranslation = async (langFile: string) => {
    try {
        const response = await fetch(`/localization/${langFile}`);
        if (!response.ok) {
            console.error(`Could not load ${langFile}, falling back to English.`);
            // If the requested language file is not found, try fetching the English one as a fallback.
            if (langFile !== 'en.json') {
                return fetchTranslation('en.json');
            }
            throw new Error(`Failed to load translation file: ${langFile}`);
        }
        return response.json();
    } catch (error) {
        console.error('Error fetching translation file, falling back to English', error);
        // If there's a network error or even English fails, return an empty object to prevent app crash.
        if (langFile !== 'en.json') {
            return fetchTranslation('en.json');
        }
        return {};
    }
};

export const getTranslations = (lang: string): Promise<{ [key: string]: string }> => {
    const langFileMap: { [key: string]: string } = {
        ja: 'ja.json',
        vi: 'vi.json',
        de: 'de.json',
        fr: 'fr.json',
    };
    const fileName = langFileMap[lang] || 'en.json';
    return fetchTranslation(fileName);
};
