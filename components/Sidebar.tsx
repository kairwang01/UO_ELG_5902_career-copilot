
import React from 'react';
import {
  LayoutDashboard,
  Wrench,
  FileText,
  Globe,
  CreditCard,
  CalendarCheck,
  ChevronRight,
  User as UserIcon,
  MessageSquare,
  Zap,
  ChevronDown,
  ShieldCheck,
  Briefcase,
  ClipboardList
} from 'lucide-react';
import type { UserProfile } from '../types';
import { ALL_TOOLS_CONFIG } from '../constants/tools';
import LanguageSwitcher from './LanguageSwitcher';
import { isWeb3Enabled, onWeb3FlagChange } from '../config/featureFlags';

type SidebarView = 'dashboard' | 'toolkit' | 'resume' | 'jobs' | 'applications' | 'interview' | 'plan' | 'portfolio' | 'account' | 'credentials';

interface SidebarProps {
  activeView: SidebarView;
  onViewChange: (view: SidebarView) => void;
  profile: UserProfile | null;
  credits: number;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  onLogout: () => void;
  activeTool: string | null;
  onToolSelect: (tool: string | null) => void;
  t: (key: string) => string;
  currentLang: string;
  onLanguageChange: (lang: string) => void;
  /** Rendered inside the mobile drawer overlay (always visible, fills the drawer height). */
  mobile?: boolean;
}

const Sidebar: React.FC<SidebarProps> = ({
  activeView,
  onViewChange,
  profile,
  credits,
  activeTool,
  onToolSelect,
  t,
  currentLang,
  onLanguageChange,
  mobile = false,
}) => {
  // Default collapsed: the full tool list is long, so the sidebar leads with a single
  // "Browse all tools" entry (the dedicated gallery) and keeps the quick-list one tap away.
  const [isToolkitExpanded, setIsToolkitExpanded] = React.useState(false);
  // Identity & Wallet is part of the experimental Web3 module — hidden when the flag is off.
  const [web3Enabled, setWeb3Enabled] = React.useState(isWeb3Enabled());
  React.useEffect(() => onWeb3FlagChange(setWeb3Enabled), []);

  const allWorkspaceItems: { id: SidebarView; label: string; icon: React.ElementType }[] = [
    { id: 'dashboard', label: t('ws_nav_dashboard'), icon: LayoutDashboard },
    { id: 'resume', label: t('ws_nav_resume'), icon: FileText },
    { id: 'jobs', label: t('ws_nav_jobs'), icon: Briefcase },
    { id: 'applications', label: t('ws_nav_applications'), icon: ClipboardList },
    { id: 'interview', label: t('ws_nav_interview'), icon: MessageSquare },
    { id: 'plan', label: t('ws_nav_plan'), icon: CalendarCheck },
    { id: 'portfolio', label: t('ws_nav_portfolio'), icon: Globe },
    { id: 'credentials', label: t('ws_nav_credentials'), icon: ShieldCheck },
  ];
  const workspaceItems = web3Enabled
    ? allWorkspaceItems
    : allWorkspaceItems.filter((item) => item.id !== 'credentials');

  // Turn a raw subscription_status (e.g. "pending_essentials") into a readable label.
  const formatPlanStatus = (status?: string | null): string => {
    if (!status || status === 'free') return t('ws_plan_free');
    const pending = status.startsWith('pending_');
    const planKey = status.replace('pending_biz_', '').replace('pending_', '');
    const name = planKey.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
    return pending ? t('ws_plan_pending').replace('{plan}', name) : name;
  };

  return (
    <aside
      className={`${
        mobile ? 'flex w-72 max-w-[85vw] h-full' : 'hidden lg:flex w-64 h-screen sticky top-0'
      } flex-shrink-0 bg-white dark:bg-slate-900 border-r border-gray-200 dark:border-slate-800 flex-col`}
    >
      {/* Brand */}
      <div className="p-6 border-b border-gray-100 dark:border-slate-800 flex items-center gap-3">
        <div className="bg-blue-600 p-2 rounded-xl text-white shadow-lg shadow-blue-500/20">
            <Zap className="h-6 w-6" />
        </div>
        <div>
            <h1 className="text-xl font-bold tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400">
                Career Studio
            </h1>
            <p className="text-[10px] uppercase tracking-widest text-gray-400 dark:text-slate-500 font-bold">Career Workbench</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-4 space-y-6 scrollbar-thin scrollbar-thumb-gray-200 dark:scrollbar-thumb-slate-800">
        
        {/* Workspace Section */}
        <div className="space-y-1">
            <h3 className="px-4 text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-widest mb-2">{t('ws_section_workspace')}</h3>
            {workspaceItems.map((item) => {
                const isActive = activeView === item.id;
                return (
                    <button
                        key={item.id}
                        onClick={() => {
                            onViewChange(item.id);
                            onToolSelect(null);
                        }}
                        aria-current={isActive ? 'page' : undefined}
                        className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group ${
                        isActive
                            ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400 border border-blue-100 dark:border-blue-800/50'
                            : 'text-gray-600 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-800/50 hover:text-gray-900 dark:hover:text-slate-100'
                        }`}
                    >
                        <item.icon className={`h-4.5 w-4.5 transition-transform group-hover:scale-110 ${isActive ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400 dark:text-slate-500'}`} />
                        <span className="flex-1 text-left">{item.label}</span>
                        {isActive && <ChevronRight className="h-3.5 w-3.5 opacity-50" />}
                    </button>
                );
            })}
        </div>

        {/* AI Toolkit Section */}
        <div className="space-y-1">
            <div className="flex items-center justify-between px-4 mb-2">
                <h3 className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-widest">{t('ws_section_tools')} <span className="text-gray-300 dark:text-slate-600">· {ALL_TOOLS_CONFIG.length}</span></h3>
                <button 
                    onClick={() => setIsToolkitExpanded(!isToolkitExpanded)}
                    aria-expanded={isToolkitExpanded}
                    aria-controls="sidebar-tool-list"
                    aria-label={isToolkitExpanded ? t('ws_tools_collapse') : t('ws_tools_expand')}
                    className="p-1 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-md transition-colors"
                >
                    <ChevronDown className={`h-3 w-3 text-gray-400 transition-transform duration-200 ${isToolkitExpanded ? 'rotate-180' : ''}`} />
                </button>
            </div>
            
            {/* Dedicated tools gallery — declutters the sidebar; the quick-list stays
                one tap away via the chevron above. */}
            <button
                onClick={() => { onViewChange('toolkit'); onToolSelect(null); }}
                className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group ${
                    activeView === 'toolkit'
                        ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400 border border-blue-100 dark:border-blue-800/50'
                        : 'text-gray-600 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-800/50 hover:text-gray-900 dark:hover:text-slate-100'
                }`}
            >
                <Wrench className={`h-4.5 w-4.5 transition-transform group-hover:scale-110 ${activeView === 'toolkit' ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400 dark:text-slate-500'}`} />
                <span className="flex-1 text-left">{t('ws_browse_all_tools')}</span>
                <ChevronRight className="h-3.5 w-3.5 opacity-50" />
            </button>

            {isToolkitExpanded && (
                <div id="sidebar-tool-list" className="space-y-0.5 animate-panel-expand">
                    {ALL_TOOLS_CONFIG.map((tool) => {
                        const isToolActive = activeTool === tool.key;

                        return (
                            <button
                                key={tool.key}
                                onClick={() => {
                                    onViewChange('toolkit');
                                    onToolSelect(tool.key);
                                }}
                                className={`w-full flex items-center gap-3 px-4 py-2 rounded-xl text-[11px] font-medium transition-all ${
                                    isToolActive
                                        ? 'text-blue-600 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-900/10'
                                        : 'text-gray-500 dark:text-slate-500 hover:text-gray-800 dark:hover:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800/30'
                                }`}
                            >
                                <div className={`flex-shrink-0 transition-transform duration-200 ${isToolActive ? 'scale-110' : 'group-hover:scale-110'}`}>
                                    {React.cloneElement(tool.icon, { className: 'h-3.5 w-3.5' })}
                                </div>
                                <span className="truncate">{t(`tool_${tool.key.replace(/-/g, '_')}_title`)}</span>
                            </button>
                        );
                    })}
                </div>
            )}
        </div>

        {/* Language switcher — lets users change language after sign-in */}
        <LanguageSwitcher onLanguageChange={onLanguageChange} currentLang={currentLang} />
      </nav>

      {/* Credits & Footer */}
      <div className="p-4 border-t border-gray-100 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-900/50">
        <div className="flex items-center gap-3 mb-4 px-2">
            <div className="h-8 w-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400">
                <CreditCard className="h-4 w-4" />
            </div>
            <div>
                <p className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase">{t('ws_credits_label')}</p>
                <p className="text-xs font-bold text-gray-900 dark:text-white tracking-tight">
                    {credits.toLocaleString()} CR
                </p>
            </div>
        </div>

        <div className="mt-1 pt-3 flex items-center gap-3 border-t border-gray-200/50 dark:border-slate-800/50">
            {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt={t('ws_profile_avatar_alt')} className="h-7 w-7 rounded-lg object-cover" />
            ) : (
                <div className="h-7 w-7 rounded-lg bg-gray-200 dark:bg-slate-800 flex items-center justify-center">
                    <UserIcon className="h-3.5 w-3.5 text-gray-500" />
                </div>
            )}
            <div className="flex-1 min-w-0">
                <p className="text-[11px] font-bold text-gray-900 dark:text-white truncate">
                    {profile?.full_name || profile?.company_name || t('ws_profile_fallback')}
                </p>
                <div className="flex items-center gap-1.5">
                    <div className="h-1 w-1 rounded-full bg-green-500 animate-pulse"></div>
                    <p className="text-[9px] text-gray-400 truncate uppercase tracking-tight">
                        {formatPlanStatus(profile?.subscription_status)}
                    </p>
                </div>
            </div>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
