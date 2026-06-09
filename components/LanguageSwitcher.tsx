import React from 'react';

export const SUPPORTED_LANGUAGES = [
    { code: 'en', name: 'English' },
    { code: 'fr', name: 'Français' },
    { code: 'zh', name: '中文' },
    { code: 'ja', name: '日本語' },
    { code: 'de', name: 'Deutsch' },
    { code: 'vi', name: 'Tiếng Việt' },
];

interface LanguageSwitcherProps {
    onLanguageChange: (langCode: string) => void;
    currentLang: string;
}

const LanguageSwitcher: React.FC<LanguageSwitcherProps> = ({ onLanguageChange, currentLang }) => {
    
    const handleSelectLanguage = (langCode: string) => {
        try {
            localStorage.setItem('preferred_language', langCode);
            onLanguageChange(langCode);
        } catch (error) {
            console.error('Error saving language preference to local storage:', error);
            alert(`Error updating language preference.`);
        }
    };

    return (
        <div className="px-4 py-2 border-t border-gray-100 dark:border-slate-600 text-sm text-gray-700 dark:text-gray-200">
            <label htmlFor="language-select" className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Language</label>
            <select
                id="language-select"
                onChange={(e) => handleSelectLanguage(e.target.value)}
                className="w-full p-1.5 border border-gray-200 dark:border-slate-500 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-slate-600 text-gray-800 dark:text-gray-100"
                value={currentLang}
            >
                {SUPPORTED_LANGUAGES.map(lang => (
                    <option key={lang.code} value={lang.code}>
                        {lang.name}
                    </option>
                ))}
            </select>
        </div>
    );
};

export default LanguageSwitcher;
