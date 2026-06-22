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
  BookmarkCheck,
  Settings,
  LogOut,
  Sun,
  Moon,
} from 'lucide-react';
import type { UserProfile } from '../../types';
import LanguageSwitcher from '../LanguageSwitcher';
import BrandLogo from '../BrandLogo';

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
  onSignOut: () => void;
  profile: UserProfile | null;
  darkMode: boolean;
  onToggleDark: () => void;
  currentLang: string;
  onLanguageChange: (lang: string) => void;
  t: (key: string) => string;
  /** Rendered inside the mobile drawer overlay (always visible, fills the drawer height). */
  mobile?: boolean;
}

export function PortalSidebar({
  currentPage,
  onNavigate,
  onGoHome,
  onSignOut,
  profile,
  darkMode,
  onToggleDark,
  currentLang,
  onLanguageChange,
  t,
  mobile = false,
}: PortalSidebarProps) {

  const dm = darkMode;
  const navItem = (page: PortalPage, label: string, Icon: React.ElementType) => (
    <button
      key={page}
      onClick={() => onNavigate(page)}
      aria-current={currentPage === page ? 'page' : undefined}
      className={`flex items-center gap-3 px-3 py-2 rounded-lg w-full text-sm transition-colors ${
        currentPage === page
          ? 'bg-blue-50 text-blue-700 border border-blue-100 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800/50'
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
      className={`${
        mobile ? 'flex w-72 max-w-[85vw] h-full' : 'hidden lg:flex w-64 h-screen'
      } flex-shrink-0 flex-col border-r ${
        dm ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
      }`}
    >
      {/* Logo — clicking goes back to the business homepage */}
      <div className="p-6">
        <button
          onClick={onGoHome}
          className="group flex min-w-0 text-left transition-opacity hover:opacity-85"
          aria-label={t('portal_back_home_aria')}
        >
          <BrandLogo size="md" surface={dm ? 'dark' : 'light'} subtitle={t('portal_subtitle')} />
        </button>
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
          {/* Personal "Account Settings" lives in the top-right account menu only — the
              same single access point the candidate workspace uses (no sidebar duplicate). */}
          {navItem('billing', t('portal_nav_billing'), CreditCard)}
        </div>

        {/* Language switcher — lets users change language after sign-in. */}
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
        {/* My Profile — single profile access point (no duplicate top-right menu). */}
        <button
          type="button"
          onClick={() => onNavigate('account-settings')}
          className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors ${
            currentPage === 'account-settings'
              ? (dm ? 'bg-gray-700/50' : 'bg-blue-50')
              : (dm ? 'hover:bg-gray-700/40' : 'hover:bg-gray-100')
          }`}
        >
          <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${dm ? 'bg-gray-700' : 'bg-blue-100'}`}>
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt="" className="w-10 h-10 rounded-full object-cover" />
            ) : (
              <User className={`w-5 h-5 ${dm ? 'text-gray-300' : 'text-blue-600'}`} />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className={`text-sm font-semibold truncate ${dm ? 'text-white' : 'text-gray-900'}`}>
              {profile?.full_name || t('portal_business_fallback_name')}
            </div>
            <div className={`text-xs ${dm ? 'text-gray-400' : 'text-gray-500'}`}>{t('portal_nav_account')}</div>
          </div>
          <Settings className="w-4 h-4 shrink-0 text-gray-400" />
        </button>
        <div className="mt-1 grid grid-cols-2 gap-1">
          <button
            type="button"
            onClick={onToggleDark}
            className={`inline-flex items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-semibold transition-colors ${dm ? 'text-gray-300 hover:bg-gray-700/40' : 'text-gray-600 hover:bg-gray-100'}`}
          >
            {dm ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            {dm ? t('menu_light_mode') : t('menu_dark_mode')}
          </button>
          <button
            type="button"
            onClick={onSignOut}
            className={`inline-flex items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-semibold transition-colors ${dm ? 'text-red-400 hover:bg-red-900/20' : 'text-red-600 hover:bg-red-50'}`}
          >
            <LogOut className="w-4 h-4" />
            {t('menu_sign_out')}
          </button>
        </div>
      </div>
    </aside>
  );
}
