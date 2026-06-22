import React, { useState, useEffect } from 'react';

interface CookieConsentProps {
    t: (key: string) => string;
    avoidSidebar?: boolean;
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

const CookieConsent: React.FC<CookieConsentProps> = ({ t, avoidSidebar = false }) => {
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

    const sidebarOffsetClass = avoidSidebar ? 'lg:left-[17.5rem]' : '';

    return (
        <div
            className={`fixed inset-x-3 bottom-[calc(0.75rem+env(safe-area-inset-bottom))] z-50 sm:inset-x-auto sm:left-6 sm:right-auto sm:bottom-[calc(1.5rem+env(safe-area-inset-bottom))] sm:w-[28rem] sm:max-w-[calc(100vw-3rem)] lg:w-[30rem] ${sidebarOffsetClass}`}
            role="dialog"
            aria-live="polite"
            aria-label="Cookie consent"
        >
            <div className="rounded-2xl border border-slate-700 bg-slate-950/95 p-3 text-gray-200 shadow-2xl shadow-slate-950/25 backdrop-blur sm:p-4">
                <p className="text-xs leading-5 sm:text-sm">
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
                <div className="mt-3 grid grid-cols-2 gap-2 sm:flex sm:justify-end">
                    <button
                        onClick={() => decide('declined')}
                        className="min-h-10 rounded-lg border border-slate-600 px-3 py-2 text-sm font-medium text-gray-300 transition-colors hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:ring-offset-2 focus:ring-offset-slate-950"
                    >
                        {t('cookie_consent_decline')}
                    </button>
                    <button
                        onClick={() => decide('accepted')}
                        className="min-h-10 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:ring-offset-2 focus:ring-offset-slate-950"
                    >
                        {t('cookie_consent_accept')}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CookieConsent;
