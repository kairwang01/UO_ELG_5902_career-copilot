import React, { useState, useEffect } from 'react';

interface CookieConsentProps {
    t: (key: string) => string;
}

const CONSENT_COOKIE = 'cookie_consent';
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

const writeConsent = (value: 'accepted' | 'declined') => {
    try {
        document.cookie = `${CONSENT_COOKIE}=${value}; path=/; max-age=${ONE_YEAR_SECONDS}; SameSite=Lax`;
    } catch (error) {
        console.error('Could not save cookie consent preference:', error);
    }
};

const consentAlreadyGiven = (): boolean => {
    try {
        return document.cookie.split(';').some(c => c.trim().startsWith(`${CONSENT_COOKIE}=`));
    } catch {
        return false;
    }
};

const CookieConsent: React.FC<CookieConsentProps> = ({ t }) => {
    const [visible, setVisible] = useState(false);

    // Only show the banner if the visitor has not made a choice yet.
    useEffect(() => {
        if (!consentAlreadyGiven()) {
            setVisible(true);
        }
    }, []);

    if (!visible) return null;

    const decide = (value: 'accepted' | 'declined') => {
        writeConsent(value);
        setVisible(false);
    };

    return (
        <div
            className="fixed bottom-0 inset-x-0 z-50 p-4 sm:p-6"
            role="dialog"
            aria-live="polite"
            aria-label="Cookie consent"
        >
            <div className="max-w-5xl mx-auto bg-slate-900/95 backdrop-blur border border-slate-700 text-gray-200 rounded-xl shadow-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-4">
                <p className="text-sm leading-relaxed flex-1">
                    {t('cookie_consent_message')}{' '}
                    <a
                        href="/privacy.html"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-400 underline hover:text-blue-300"
                    >
                        {t('cookie_consent_learn_more')}
                    </a>
                </p>
                <div className="flex items-center gap-3 shrink-0">
                    <button
                        onClick={() => decide('declined')}
                        className="px-4 py-2 text-sm font-medium rounded-lg border border-slate-600 text-gray-300 hover:bg-slate-800 transition-colors"
                    >
                        {t('cookie_consent_decline')}
                    </button>
                    <button
                        onClick={() => decide('accepted')}
                        className="px-5 py-2 text-sm font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                    >
                        {t('cookie_consent_accept')}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CookieConsent;
