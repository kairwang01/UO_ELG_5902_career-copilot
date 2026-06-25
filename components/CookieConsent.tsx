import React, { useState, useEffect, useRef } from 'react';

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
    const bannerRef = useRef<HTMLDivElement | null>(null);

    // Only show the banner if the visitor has not made a choice yet.
    useEffect(() => {
        if (!consentAlreadyGiven()) {
            setVisible(true);
        }
    }, []);

    useEffect(() => {
        if (!visible) return undefined;

        const setReservedSpace = () => {
            const isSmUp = typeof window !== 'undefined'
                ? window.matchMedia('(min-width: 640px)').matches
                : false;
            // In the workspace/portal shell the banner moves to the top-right from
            // sm upward, so bottom sticky bars only need reserved space on mobile.
            const bottomPositioned = !avoidSidebar || !isSmUp;
            const height = bottomPositioned ? (bannerRef.current?.offsetHeight ?? 0) : 0;
            const next = height > 0 ? `${height + 16}px` : '0px';
            document.documentElement.style.setProperty('--cookie-consent-bottom-space', next);
        };

        setReservedSpace();
        const resizeObserver = typeof ResizeObserver !== 'undefined' && bannerRef.current
            ? new ResizeObserver(setReservedSpace)
            : null;
        resizeObserver?.observe(bannerRef.current as Element);
        window.addEventListener('resize', setReservedSpace);

        return () => {
            resizeObserver?.disconnect();
            window.removeEventListener('resize', setReservedSpace);
            document.documentElement.style.removeProperty('--cookie-consent-bottom-space');
        };
    }, [avoidSidebar, visible]);

    if (!visible) return null;

    const decide = (value: 'accepted' | 'declined') => {
        writeConsent(value);
        setVisible(false);
    };

    const positionClass = avoidSidebar
        ? 'fixed inset-x-3 bottom-[calc(0.75rem+env(safe-area-inset-bottom))] z-50 sm:inset-x-auto sm:bottom-auto sm:left-auto sm:right-4 sm:top-[calc(4.25rem+env(safe-area-inset-top))] sm:w-[min(26rem,calc(100vw-18rem))] sm:max-w-[calc(100vw-1.5rem)]'
        : 'fixed inset-x-3 bottom-[calc(0.75rem+env(safe-area-inset-bottom))] z-50 sm:inset-x-auto sm:left-6 sm:right-auto sm:bottom-[calc(1.5rem+env(safe-area-inset-bottom))] sm:w-[28rem] sm:max-w-[calc(100vw-3rem)] lg:w-[30rem]';
    const panelClass = avoidSidebar
        ? 'rounded-xl border border-slate-200 bg-white/95 text-slate-700 shadow-lg shadow-slate-900/10 backdrop-blur dark:border-slate-700 dark:bg-slate-900/95 dark:text-slate-200'
        : 'rounded-2xl border border-slate-700 bg-slate-950/95 text-gray-200 shadow-2xl shadow-slate-950/25 backdrop-blur';
    const secondaryButtonClass = avoidSidebar
        ? 'pointer-events-auto min-h-8 rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:ring-offset-2 focus:ring-offset-white dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800 dark:focus:ring-offset-slate-900'
        : 'pointer-events-auto min-h-10 rounded-lg border border-slate-600 px-3 py-2 text-sm font-medium text-gray-300 transition-colors hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:ring-offset-2 focus:ring-offset-slate-950';
    const primaryButtonClass = avoidSidebar
        ? 'pointer-events-auto min-h-8 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-slate-900'
        : 'pointer-events-auto min-h-10 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:ring-offset-2 focus:ring-offset-slate-950';

    return (
        <div
            ref={bannerRef}
            className={`${positionClass} pointer-events-none`}
            role="region"
            aria-live="polite"
            aria-label="Cookie consent"
            data-qa="cookie-consent-banner"
        >
            <div className={`pointer-events-none ${panelClass} ${avoidSidebar ? 'p-2.5 sm:p-3' : 'p-3 sm:p-4'}`}>
                <div className={`${avoidSidebar ? 'space-y-2 sm:flex sm:items-center sm:gap-3 sm:space-y-0' : ''}`}>
                    <p className={`${avoidSidebar ? 'min-w-0 flex-1 text-[11px] leading-5 text-slate-600 dark:text-slate-300' : 'text-xs leading-5 sm:text-sm'}`}>
                        {t('cookie_consent_message')}{' '}
                        <a
                            href="/privacy.html"
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`${avoidSidebar ? 'text-blue-700 hover:text-blue-800 dark:text-blue-300 dark:hover:text-blue-200' : 'text-blue-400 hover:text-blue-300'} pointer-events-auto underline`}
                        >
                            {t('cookie_consent_learn_more')}
                        </a>
                    </p>
                    <div className={`${avoidSidebar ? 'grid grid-cols-2 gap-2 sm:shrink-0' : 'mt-3 grid grid-cols-2 gap-2 sm:flex sm:justify-end'}`}>
                        <button
                            type="button"
                            onClick={() => decide('declined')}
                            className={secondaryButtonClass}
                        >
                            {t('cookie_consent_decline')}
                        </button>
                        <button
                            type="button"
                            onClick={() => decide('accepted')}
                            className={primaryButtonClass}
                        >
                            {t('cookie_consent_accept')}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CookieConsent;
