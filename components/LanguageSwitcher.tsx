import React from 'react';
import { Check, ChevronDown, Languages } from 'lucide-react';

export const SUPPORTED_LANGUAGES = [
    { code: 'en', name: 'English' },
    { code: 'fr', name: 'Français' },
    { code: 'zh', name: '中文' },
    { code: 'ja', name: '日本語' },
    { code: 'de', name: 'Deutsch' },
    { code: 'vi', name: 'Tiếng Việt' },
    { code: 'ar', name: 'العربية' },
];

interface LanguageSwitcherProps {
    onLanguageChange: (langCode: string) => void;
    currentLang: string;
    variant?: 'default' | 'footer';
}

const LanguageSwitcher: React.FC<LanguageSwitcherProps> = ({ onLanguageChange, currentLang, variant = 'default' }) => {
    const [isOpen, setIsOpen] = React.useState(false);
    const currentLanguage = SUPPORTED_LANGUAGES.find((lang) => lang.code === currentLang) ?? SUPPORTED_LANGUAGES[0];

    const handleSelectLanguage = (langCode: string) => {
        onLanguageChange(langCode);
        setIsOpen(false);
    };

    if (variant === 'footer') {
        return (
            <div className="flex items-center gap-3 px-2 py-3 border-t border-gray-200/50 dark:border-slate-800/50">
                <div className="h-8 w-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 dark:text-slate-300">
                    <Languages className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                    <label id="language-select-label" className="block text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase">
                        Language
                    </label>
                    <div
                        className="relative mt-1"
                        onBlur={(event) => {
                            if (!event.currentTarget.contains(event.relatedTarget)) setIsOpen(false);
                        }}
                    >
                        <button
                            type="button"
                            aria-labelledby="language-select-label"
                            aria-haspopup="listbox"
                            aria-expanded={isOpen}
                            onClick={() => setIsOpen((open) => !open)}
                            className="flex w-full items-center justify-between rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-left text-xs font-semibold text-gray-800 outline-none transition-colors focus:border-slate-400 focus:ring-2 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-slate-500 dark:focus:ring-slate-700"
                        >
                            <span>{currentLanguage.name}</span>
                            <ChevronDown className={`h-3.5 w-3.5 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                        </button>
                        {isOpen && (
                            <div
                                role="listbox"
                                aria-labelledby="language-select-label"
                                className="absolute bottom-full z-20 mb-1 w-full overflow-hidden rounded-xl border border-gray-200 bg-white p-1 shadow-lg dark:border-slate-700 dark:bg-slate-900"
                            >
                                {SUPPORTED_LANGUAGES.map((lang) => {
                                    const isSelected = lang.code === currentLang;
                                    return (
                                        <button
                                            key={lang.code}
                                            type="button"
                                            role="option"
                                            aria-selected={isSelected}
                                            onMouseDown={(event) => event.preventDefault()}
                                            onClick={() => handleSelectLanguage(lang.code)}
                                            className={`flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-xs font-semibold ${
                                                isSelected
                                                    ? 'bg-slate-100 text-slate-950 dark:bg-slate-800 dark:text-white'
                                                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-950 dark:text-slate-300 dark:hover:bg-slate-800/70 dark:hover:text-white'
                                            }`}
                                        >
                                            <span>{lang.name}</span>
                                            {isSelected && <Check className="h-3.5 w-3.5 text-slate-500 dark:text-slate-300" />}
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    }

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
