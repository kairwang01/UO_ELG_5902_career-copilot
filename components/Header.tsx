
import React, { useState, useEffect, useRef } from 'react';
import type { AppSession as Session } from '@/lib/data';
import { data } from '@/lib/data';
import { Menu, X } from 'lucide-react';
import Avatar from './Avatar';
import type { UserProfile } from '../types';
import LanguageSwitcher from './LanguageSwitcher';
import ThemeToggle from './ThemeToggle';
import { useSettings } from '../contexts/SettingsContext';

interface HeaderProps {
    session: Session | null;
    profile: UserProfile | null;
    onSetView: (view: 'home' | 'auth' | 'account' | 'business' | 'agency', authView?: 'sign_in' | 'sign_up' | 'forgot_password') => void;
    navigateToPricing: () => void;
    t: (key: string) => string;
    changeLanguage: (lang: string) => void;
    currentLang: string;
    theme: 'light' | 'dark';
    toggleTheme: () => void;
    view: 'home' | 'auth' | 'account' | 'business' | 'agency';
    credits: number;
}

const Web3StatusIndicator: React.FC<{ profile: UserProfile, t: (key: string) => string }> = ({ profile, t }) => {
    let status: { icon: React.ReactNode; text: string; } | null = null;

    const TalentCrystalIcon = ({ color, pulse, glow }: { color: string, pulse?: boolean, glow?: boolean }) => (
        <div className={`${pulse ? 'animate-crystal-glow' : ''} ${glow && !pulse ? 'static-crystal-glow' : ''}`}>
            <svg className={`w-7 h-7 ${color}`} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                <path d="M12.3831 2.25C12.1931 2.06 11.8069 2.06 11.6169 2.25L5.75977 8.10714C5.66477 8.20214 5.61691 8.33314 5.61691 8.47214V15.5279C5.61691 15.6669 5.66477 15.7979 5.75977 15.8929L11.6169 21.75C11.8069 21.94 12.1931 21.94 12.3831 21.75L18.2402 15.8929C18.3352 15.7979 18.3831 15.6669 18.3831 15.5279V8.47214C18.3831 8.33314 18.3352 8.20214 18.2402 8.10714L12.3831 2.25Z" />
            </svg>
        </div>
    );
     const TalentCrystalCheckIcon = ({ color, pulse, glow }: { color: string, pulse?: boolean, glow?: boolean }) => (
        <div className="relative">
            <TalentCrystalIcon color={color} pulse={pulse} glow={glow} />
             <div className="absolute -top-1 -right-1 bg-green-500 rounded-full p-0.5 border-2 border-white dark:border-gray-950">
                 <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={4} d="M5 13l4 4L19 7" />
                </svg>
            </div>
        </div>
    );

    if (!profile.wallet_address) {
        status = { icon: <TalentCrystalIcon color="text-gray-400 dark:text-gray-500" />, text: t('header_web3_connect_wallet') };
    } else if (!profile.nft_minted) {
        status = { icon: <TalentCrystalIcon color="text-amber-500 dark:text-amber-400" glow={true} />, text: t('header_web3_mint_nft') };
    } else if (!profile.nft_staked) {
        status = { icon: <TalentCrystalIcon color="text-amber-500 dark:text-amber-400" pulse={true} />, text: t('header_web3_stake_nft') };
    } else {
        status = { icon: <TalentCrystalCheckIcon color="text-amber-500 dark:text-amber-400" pulse={true} />, text: t('header_web3_staked') };
    }

    if (!status) return null;

    return (
        <span className="flex items-center" title={status.text}>
            {status.icon}
        </span>
    );
};

const TalentVaultAccess: React.FC<{ profile: UserProfile; onSetView: (view: 'business') => void, t: (key: string) => string }> = ({ profile, onSetView, t }) => {
    const hasAccess = profile.subscription_status === 'job_pack';
    
    const KeyIcon = ({ active }: { active: boolean }) => (
         <svg xmlns="http://www.w3.org/2000/svg" className={`h-6 w-6 ${active ? 'text-yellow-500' : 'text-gray-400 dark:text-gray-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7h1a2 2 0 012 2v5a2 2 0 01-2 2h-1m-6 4H9a2 2 0 01-2-2v-5a2 2 0 012-2h2a2 2 0 012 2v5a2 2 0 01-2 2z" />
         </svg>
    );

    const tooltip = hasAccess ? t('header_vault_access_granted') : t('header_vault_access_denied');

    return (
        <span 
            title={tooltip} 
            onClick={(e) => {
                if (!hasAccess) {
                    e.stopPropagation();
                    onSetView('business');
                }
            }} 
            className={`flex items-center transition-opacity ${!hasAccess ? 'hover:opacity-80 cursor-pointer' : ''}`}
        >
            <KeyIcon active={hasAccess} />
        </span>
    );
};


const Header: React.FC<HeaderProps> = ({ session, profile, onSetView, navigateToPricing, t, changeLanguage, currentLang, theme, toggleTheme, view, credits }) => {
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);
    const mobileMenuRef = useRef<HTMLDivElement>(null);
    const { isAIMode, toggleAIMode } = useSettings();
    
    const handleNavClick = (e: React.MouseEvent<HTMLAnchorElement | HTMLButtonElement>, targetId: string) => {
        e.preventDefault();
        setIsMobileMenuOpen(false);
        onSetView('home');
        setTimeout(() => {
            const element = document.getElementById(targetId);
            if (element) {
              element.scrollIntoView({ behavior: 'smooth' });
            }
        }, 100);
    };

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsMenuOpen(false);
            }
            if (mobileMenuRef.current && !mobileMenuRef.current.contains(event.target as Node)) {
                setIsMobileMenuOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [menuRef]);

    return (
        <header className="sticky top-0 z-50 w-full bg-white/80 dark:bg-gray-950/80 backdrop-blur-lg border-b border-gray-200/80 dark:border-slate-800/80 transition-colors duration-300">
            <div className="max-w-6xl mx-auto px-4 sm:px-6">
                <div className="flex items-center justify-between h-20">
                    {/* Site branding */}
                    <div className="flex-shrink-0 mr-4">
                        <button onClick={() => onSetView('home')} className="flex items-center" aria-label="Career CoPilot">
                            <svg className="w-8 h-8 text-blue-700 dark:text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            <span className="ml-2 text-xl font-bold text-gray-800 dark:text-gray-100 hidden sm:block">Career CoPilot</span>
                        </button>
                    </div>

                    {/* Site navigation */}
                    {!session && view === 'home' && (
                        <nav className="hidden md:flex md:grow">
                            <ul className="flex grow justify-center flex-wrap items-center">
                                <li><a href="#features-section" onClick={(e) => handleNavClick(e, 'features-section')} className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white px-3 lg:px-5 py-2 flex items-center transition duration-150 ease-in-out font-medium">{t('nav_features')}</a></li>
                                <li><a href="#verified-talent-section" onClick={(e) => handleNavClick(e, 'verified-talent-section')} className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white px-3 lg:px-5 py-2 flex items-center transition duration-150 ease-in-out font-medium">{t('nav_verified_talent')}</a></li>
                                <li><a href="#pricing-section" onClick={(e) => handleNavClick(e, 'pricing-section')} className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white px-3 lg:px-5 py-2 flex items-center transition duration-150 ease-in-out font-medium">{t('nav_pricing')}</a></li>
                                <li>
                                    <button onClick={() => onSetView('business')} className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white px-3 lg:px-5 py-2 flex items-center transition duration-150 ease-in-out font-medium">
                                        {t('nav_for_business')}
                                    </button>
                                </li>
                            </ul>
                        </nav>
                    )}

                    {/* Right side of header */}
                    <div className="flex items-center space-x-2 sm:space-x-4">
                        <ThemeToggle theme={theme} toggleTheme={toggleTheme} />
                        {session && profile ? (
                            <div className="relative" ref={menuRef}>
                                <button
                                    onClick={() => setIsMenuOpen(!isMenuOpen)}
                                    className="flex items-center space-x-2 p-1 rounded-full focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                                    aria-haspopup="true"
                                    aria-expanded={isMenuOpen}
                                >
                                    {profile.role === 'candidate' ? (
                                        <Web3StatusIndicator profile={profile} t={t} />
                                    ) : (
                                        <TalentVaultAccess profile={profile} onSetView={() => onSetView('business')} t={t} />
                                    )}
                                    <Avatar url={profile.avatar_url} size={40} />
                                </button>
                                {isMenuOpen && (
                                    <div
                                        className="origin-top-right absolute right-0 mt-2 w-64 rounded-md shadow-lg bg-white dark:bg-slate-700 ring-1 ring-black ring-opacity-5 focus:outline-none animate-fade-in"
                                        role="menu"
                                        aria-orientation="vertical"
                                        aria-labelledby="user-menu-button"
                                    >
                                        <div className="px-4 py-3">
                                            <p className="text-sm text-gray-900 dark:text-gray-100 font-semibold truncate">{profile.full_name || session.user.email}</p>
                                            <p className="text-xs text-gray-500 dark:text-gray-400 capitalize">{profile.role}</p>
                                        </div>
                                         <div className="px-4 py-3 border-t border-gray-100 dark:border-slate-600">
                                            <div className="flex justify-between items-center">
                                                 <div>
                                                    <p className="text-xs text-gray-500 dark:text-gray-400">Credit Balance</p>
                                                    <p className="text-lg font-bold text-blue-600 dark:text-blue-400">
                                                        {credits}
                                                    </p>
                                                </div>
                                                 <button onClick={() => { navigateToPricing(); setIsMenuOpen(false); }} className="text-xs bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 font-semibold px-2 py-1 rounded-full hover:bg-blue-200 dark:hover:bg-blue-800">
                                                    Buy More
                                                </button>
                                            </div>
                                        </div>
                                        {profile.role === 'candidate' && profile.wallet_address && (
                                            <div className="px-4 py-3 border-t border-gray-100 dark:border-slate-600">
                                                <p className="text-xs text-gray-500 dark:text-gray-400">{t('header_vault_earnings')}</p>
                                                <p className="text-lg font-bold text-green-600 dark:text-green-500">
                                                    {(profile.nft_earnings || 0).toFixed(4)} ETH
                                                </p>
                                            </div>
                                        )}
                                        <div className="py-1 border-t border-gray-100 dark:border-slate-600" role="none">
                                            {/* Employers have no side nav, so the menu is their only way back to the dashboard or plans. */}
                                            {profile.role === 'employer' && (
                                                <>
                                                    <button onClick={() => { onSetView('home'); setIsMenuOpen(false); }} className="w-full text-left text-gray-700 dark:text-gray-200 block px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-slate-600 font-medium" role="menuitem">
                                                        Dashboard
                                                    </button>
                                                    <button onClick={() => { onSetView('business'); setIsMenuOpen(false); }} className="w-full text-left text-gray-700 dark:text-gray-200 block px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-slate-600" role="menuitem">
                                                        Plans &amp; Pricing
                                                    </button>
                                                </>
                                            )}
                                            <div className="px-4 py-2 flex items-center justify-between hover:bg-gray-100 dark:hover:bg-slate-600">
                                                <span className="text-sm text-gray-700 dark:text-gray-200 font-medium">AI Features</span>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); toggleAIMode(); }}
                                                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${isAIMode ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-600'}`}
                                                >
                                                    <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition ${isAIMode ? 'translate-x-5' : 'translate-x-1'}`} />
                                                </button>
                                            </div>
                                            <button onClick={() => { onSetView('agency'); setIsMenuOpen(false); }} className="w-full text-left text-gray-700 dark:text-gray-200 block px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-slate-600 font-medium" role="menuitem">
                                                Agency Portal
                                            </button>
                                            <button onClick={() => { onSetView('account'); setIsMenuOpen(false); }} className="w-full text-left text-gray-700 dark:text-gray-200 block px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-slate-600" role="menuitem">Account Settings</button>
                                            <button onClick={async () => { setIsMenuOpen(false); await data.auth.signOut('local'); }} className="w-full text-left text-gray-700 dark:text-gray-200 block px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-slate-600" role="menuitem">
                                                Sign out
                                            </button>
                                        </div>
                                        <LanguageSwitcher onLanguageChange={changeLanguage} currentLang={currentLang} />
                                    </div>
                                )}
                            </div>
                        ) : (
                            <>
                                <div className="hidden sm:flex items-center space-x-2">
                                    <button onClick={() => onSetView('auth', 'sign_in')} className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white px-4 py-2 flex items-center transition duration-150 ease-in-out font-semibold">
                                        {t('auth_sign_in')}
                                    </button>
                                    <button onClick={() => onSetView('auth', 'sign_up')} className="bg-blue-700 text-white font-semibold py-2 px-5 rounded-lg shadow-md hover:bg-blue-800 transition-colors">
                                        {t('auth_get_started')}
                                    </button>
                                </div>
                                <div className="md:hidden flex items-center ml-2" ref={mobileMenuRef}>
                                    <button 
                                        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} 
                                        className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white p-2 focus:outline-none"
                                        aria-label="Toggle mobile menu"
                                    >
                                        {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
                                    </button>
                                    
                                    {isMobileMenuOpen && (
                                        <div className="origin-top-right absolute right-4 top-20 w-56 rounded-md shadow-lg bg-white dark:bg-slate-800 ring-1 ring-black ring-opacity-5 focus:outline-none animate-fade-in p-2 flex flex-col space-y-1">
                                            {view === 'home' && (
                                                <>
                                                    <a href="#features-section" onClick={(e) => handleNavClick(e, 'features-section')} className="text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-slate-700 px-3 py-2 rounded-md font-medium transition-colors">{t('nav_features')}</a>
                                                    <a href="#verified-talent-section" onClick={(e) => handleNavClick(e, 'verified-talent-section')} className="text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-slate-700 px-3 py-2 rounded-md font-medium transition-colors">{t('nav_verified_talent')}</a>
                                                    <a href="#pricing-section" onClick={(e) => handleNavClick(e, 'pricing-section')} className="text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-slate-700 px-3 py-2 rounded-md font-medium transition-colors">{t('nav_pricing')}</a>
                                                    <button onClick={() => { onSetView('business'); setIsMobileMenuOpen(false); }} className="text-left text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-slate-700 px-3 py-2 rounded-md font-medium transition-colors w-full">{t('nav_for_business')}</button>
                                                    <div className="border-t border-gray-200 dark:border-slate-700 my-1"></div>
                                                </>
                                            )}
                                            <button onClick={() => { onSetView('auth', 'sign_in'); setIsMobileMenuOpen(false); }} className="text-left text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-slate-700 px-3 py-2 rounded-md font-medium transition-colors w-full">{t('auth_sign_in')}</button>
                                            <button onClick={() => { onSetView('auth', 'sign_up'); setIsMobileMenuOpen(false); }} className="text-center bg-blue-700 text-white font-semibold py-2 px-3 rounded-lg shadow-sm hover:bg-blue-800 transition-colors w-full mt-2">{t('auth_get_started')}</button>
                                        </div>
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </header>
    );
};

export default Header;
