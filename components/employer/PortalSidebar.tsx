import React from 'react';
import {
  LayoutDashboard,
  Briefcase,
  FileText,
  Users,
  Building2,
  User,
  CreditCard,
  ChevronRight,
  Settings,
  BookmarkCheck,
} from 'lucide-react';
import type { UserProfile } from '../../types';
import LanguageSwitcher from '../LanguageSwitcher';

export type PortalPage =
  | 'dashboard'
  | 'post-job'
  | 'job-listings'
  | 'talent-pool'
  | 'shortlist'
  | 'agency-hub'
  | 'company-profile'
  | 'account-settings'
  | 'billing';

interface PortalSidebarProps {
  currentPage: PortalPage;
  onNavigate: (page: PortalPage) => void;
  onGoHome: () => void;
  profile: UserProfile | null;
  darkMode: boolean;
  onToggleDark: () => void;
  currentLang: string;
  onLanguageChange: (lang: string) => void;
  t: (key: string) => string;
}

export function PortalSidebar({
  currentPage,
  onNavigate,
  onGoHome,
  profile,
  darkMode,
  currentLang,
  onLanguageChange,
  t,
}: PortalSidebarProps) {

  const dm = darkMode;
  const navItem = (page: PortalPage, label: string, Icon: React.ElementType) => (
    <button
      key={page}
      onClick={() => onNavigate(page)}
      className={`flex items-center gap-3 px-3 py-2 rounded-lg w-full text-sm ${
        currentPage === page
          ? 'text-[#1d4ed8] bg-blue-50 border border-blue-200'
          : dm
          ? 'text-gray-300 hover:bg-gray-700'
          : 'text-gray-600 hover:bg-gray-50'
      }`}
    >
      <Icon className="w-5 h-5 flex-shrink-0" />
      <span className="flex-1 text-left">{label}</span>
      {currentPage === page && <ChevronRight className="w-4 h-4" />}
    </button>
  );

  return (
    <aside
      className={`w-64 flex-shrink-0 flex flex-col h-screen border-r ${
        dm ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
      }`}
    >
      {/* Logo — clicking goes back to the business homepage */}
      <div className="p-6">
        <div className="flex gap-3">
          <button onClick={onGoHome} className="flex-shrink-0 group self-center" aria-label="Back to Career CoPilot home">
            <svg className="w-10 h-10 transition-opacity group-hover:opacity-80" fill="none" viewBox="0 0 32 32">
              <path
                d="M12 16H20M12 21.3333H20M22.6667 28H9.33333C8.62609 28 7.94781 27.719 7.44771 27.219C6.94762 26.7189 6.66667 26.0406 6.66667 25.3333V6.66667C6.66667 5.95942 6.94762 5.28115 7.44771 4.78105C7.94781 4.28095 8.62609 4 9.33333 4H16.7813C17.1349 4.00008 17.474 4.1406 17.724 4.39067L24.9427 11.6093C25.1927 11.8593 25.3333 12.1984 25.3333 12.552V25.3333C25.3333 26.0406 25.0524 26.7189 24.5523 27.219C24.0522 27.719 23.3739 28 22.6667 28Z"
                stroke="#1D4ED8"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
              />
            </svg>
          </button>
          <div className="flex flex-col justify-center">
            <button onClick={onGoHome} className="group text-left">
              <div className={`font-semibold text-sm ${dm ? 'text-white' : 'text-gray-900'} group-hover:text-[#1d4ed8] transition-colors`}>
                Career CoPilot
              </div>
            </button>
            <div className={`text-xs ${dm ? 'text-gray-400' : 'text-gray-500'}`}>{t('portal_subtitle')}</div>
          </div>
        </div>
      </div>

      <div className="flex-1 px-4 space-y-2 overflow-y-auto">
        <div className={`text-xs font-semibold px-3 mb-2 ${dm ? 'text-gray-500' : 'text-gray-400'}`}>{t('portal_nav_workspace_group')}</div>

        {navItem('dashboard', t('portal_nav_dashboard'), LayoutDashboard)}
        {navItem('post-job', t('portal_nav_post_job'), Briefcase)}
        {navItem('job-listings', t('portal_nav_job_listings'), FileText)}
        {navItem('talent-pool', t('portal_nav_discover'), Users)}
        {navItem('shortlist', t('portal_nav_shortlist'), BookmarkCheck)}
        {navItem('agency-hub', t('portal_nav_agency_hub'), Building2)}

        <div className="pt-6 space-y-2">
          <div className={`text-xs font-semibold px-3 mb-2 ${dm ? 'text-gray-500' : 'text-gray-400'}`}>{t('portal_nav_settings_group')}</div>
          {navItem('company-profile', t('portal_nav_org_profile'), User)}
          {navItem('account-settings', t('portal_nav_account'), Settings)}
          {navItem('billing', t('portal_nav_billing'), CreditCard)}
        </div>

        {/* Language switcher — lets users change language after sign-in.
            (The AI-Mode toggle was removed per the 2026-06-09 requirements:
            model behaviour is governed by admins, not per-user toggles.) */}
        <div className="pt-4 space-y-0.5">
          <LanguageSwitcher onLanguageChange={onLanguageChange} currentLang={currentLang} />
        </div>
      </div>

      {/* User footer */}
      <div className={`p-4 space-y-1 border-t ${dm ? 'border-gray-700' : 'border-gray-200'}`}>
        {/* Credits row */}
        <div className="flex items-center gap-3 px-3 py-2">
          <CreditCard className="w-5 h-5 text-[#1d4ed8]" />
          <div>
            <div className={`text-xs ${dm ? 'text-gray-400' : 'text-gray-500'}`}>{t('portal_credits_label')}</div>
            <div className={`font-semibold ${dm ? 'text-white' : 'text-gray-900'}`}>{(profile?.credits ?? 0).toLocaleString()} CR</div>
          </div>
        </div>
        <div className="flex items-center gap-3 px-3 py-2">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${dm ? 'bg-gray-700' : 'bg-blue-100'}`}>
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt="" className="w-10 h-10 rounded-full object-cover" />
            ) : (
              <User className={`w-5 h-5 ${dm ? 'text-gray-300' : 'text-blue-600'}`} />
            )}
          </div>
          <div className="min-w-0">
            <div className={`text-sm font-semibold truncate ${dm ? 'text-white' : 'text-gray-900'}`}>
              {profile?.full_name || t('portal_business_fallback_name')}
            </div>
            <div className={`text-xs ${dm ? 'text-gray-400' : 'text-gray-500'}`}>{t('portal_business_account')}</div>
          </div>
        </div>
      </div>
    </aside>
  );
}
