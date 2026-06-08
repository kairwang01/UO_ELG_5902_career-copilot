import React, { useState } from 'react';
import {
  LayoutDashboard,
  Briefcase,
  FileText,
  Users,
  Building2,
  User,
  CreditCard,
  ChevronRight,
  Moon,
  Settings,
  Sparkles,
} from 'lucide-react';
import type { UserProfile } from '../../types';

export type PortalPage =
  | 'dashboard'
  | 'post-job'
  | 'job-listings'
  | 'talent-pool'
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
}

export function PortalSidebar({
  currentPage,
  onNavigate,
  onGoHome,
  profile,
  darkMode,
  onToggleDark,
}: PortalSidebarProps) {
  const [aiMode, setAiMode] = useState(true);

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

  const toggle = (on: boolean, onToggle: () => void) => (
    <button
      onClick={onToggle}
      className={`w-11 h-6 rounded-full transition-colors flex-shrink-0 ${on ? 'bg-[#1d4ed8]' : dm ? 'bg-gray-600' : 'bg-gray-300'}`}
    >
      <div
        className={`w-5 h-5 bg-white rounded-full shadow-sm transition-transform mt-0.5 ${on ? 'translate-x-5' : 'translate-x-0.5'}`}
      />
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
            <div className={`text-xs ${dm ? 'text-gray-400' : 'text-gray-500'}`}>HIRING PORTAL</div>
          </div>
        </div>
      </div>

      <div className="flex-1 px-4 space-y-1 overflow-y-auto">
        <div className={`text-xs font-semibold px-3 mb-2 ${dm ? 'text-gray-500' : 'text-gray-400'}`}>WORKSPACE</div>

        {navItem('dashboard', 'Dashboard', LayoutDashboard)}
        {navItem('post-job', 'Post a Job', Briefcase)}
        {navItem('job-listings', 'My Job Listings', FileText)}
        {navItem('talent-pool', 'Discover Talent', Users)}
        {navItem('agency-hub', 'Agency Hub', Building2)}

        <div className="pt-6 space-y-1">
          <div className={`text-xs font-semibold px-3 mb-2 ${dm ? 'text-gray-500' : 'text-gray-400'}`}>SETTINGS</div>
          {navItem('company-profile', 'Organization Profile', User)}
          {navItem('account-settings', 'Account Settings', Settings)}
          {navItem('billing', 'Billing & Plan', CreditCard)}
        </div>

        {/* Toggles */}
        <div className="pt-4 space-y-0.5">
          <div className="flex items-center justify-between px-3 py-2">
            <div className="flex items-center gap-2">
              <Sparkles className={`w-5 h-5 ${dm ? 'text-gray-400' : 'text-gray-600'}`} />
              <span className={`text-sm ${dm ? 'text-gray-300' : 'text-gray-700'}`}>AI Mode</span>
            </div>
            {toggle(aiMode, () => setAiMode(!aiMode))}
          </div>

          <div className="flex items-center justify-between px-3 py-2">
            <div className="flex items-center gap-2">
              <Moon className={`w-5 h-5 ${dm ? 'text-gray-400' : 'text-gray-600'}`} />
              <span className={`text-sm ${dm ? 'text-gray-300' : 'text-gray-700'}`}>Dark Mode</span>
            </div>
            {toggle(dm, onToggleDark)}
          </div>
        </div>
      </div>

      {/* User footer */}
      <div className={`p-4 border-t ${dm ? 'border-gray-700' : 'border-gray-200'}`}>
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
              {profile?.full_name || 'Employer'}
            </div>
            <div className={`text-xs ${dm ? 'text-gray-400' : 'text-gray-500'}`}>Employer Account</div>
          </div>
        </div>
      </div>
    </aside>
  );
}
