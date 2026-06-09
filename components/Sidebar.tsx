
import React from 'react';
import {
  LayoutDashboard,
  Wrench,
  FileText,
  Globe,
  Settings,
  CreditCard,
  CalendarCheck,
  ChevronRight,
  LogOut,
  Moon,
  Sun,
  User as UserIcon,
  MessageSquare,
  Zap,
  ChevronDown,
  ShieldCheck,
  Briefcase
} from 'lucide-react';
import type { UserProfile } from '../types';
import { ALL_TOOLS_CONFIG } from '../constants/tools';
import { useToast } from './Toast';
import LanguageSwitcher from './LanguageSwitcher';
import ModelSelector from './ModelSelector';

type SidebarView = 'dashboard' | 'toolkit' | 'resume' | 'jobs' | 'interview' | 'plan' | 'portfolio' | 'account' | 'credentials';

interface SidebarProps {
  activeView: SidebarView;
  onViewChange: (view: SidebarView) => void;
  profile: UserProfile | null;
  credits: number;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  onLogout: () => void;
  isAIMode: boolean;
  onToggleAIMode: () => void;
  activeTool: string | null;
  onToolSelect: (tool: string | null) => void;
  t: (key: string) => string;
  currentLang: string;
  onLanguageChange: (lang: string) => void;
}

const Sidebar: React.FC<SidebarProps> = ({
  activeView,
  onViewChange,
  profile,
  credits,
  theme,
  onToggleTheme,
  onLogout,
  isAIMode,
  onToggleAIMode,
  activeTool,
  onToolSelect,
  t,
  currentLang,
  onLanguageChange,
}) => {
  const [isToolkitExpanded, setIsToolkitExpanded] = React.useState(true);
  const { addToast } = useToast();

  const workspaceItems: { id: SidebarView; label: string; icon: React.ElementType }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'resume', label: 'Resume', icon: FileText },
    { id: 'jobs', label: 'Jobs', icon: Briefcase },
    { id: 'interview', label: 'Interview', icon: MessageSquare },
    { id: 'plan', label: 'Plan', icon: CalendarCheck },
    { id: 'portfolio', label: 'Showcase', icon: Globe },
    { id: 'credentials', label: 'Identity & Wallet', icon: ShieldCheck },
  ];

  // Turn a raw subscription_status (e.g. "pending_essentials") into a readable label.
  const formatPlanStatus = (status?: string | null): string => {
    if (!status || status === 'free') return 'Free Plan';
    const pending = status.startsWith('pending_');
    const planKey = status.replace('pending_biz_', '').replace('pending_', '');
    const name = planKey.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
    return pending ? `${name} (payment pending)` : name;
  };

  return (
    <aside className="w-64 flex-shrink-0 bg-white dark:bg-slate-900 border-r border-gray-200 dark:border-slate-800 flex flex-col h-screen sticky top-0">
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
            <h3 className="px-4 text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-widest mb-2">Workspace</h3>
            {workspaceItems.map((item) => {
                const isActive = activeView === item.id;
                return (
                    <button
                        key={item.id}
                        onClick={() => {
                            onViewChange(item.id);
                            onToolSelect(null);
                        }}
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
                <h3 className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-widest">Assisted Tools</h3>
                <button 
                    onClick={() => setIsToolkitExpanded(!isToolkitExpanded)}
                    className="p-1 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-md transition-colors"
                >
                    <ChevronDown className={`h-3 w-3 text-gray-400 transition-transform duration-200 ${isToolkitExpanded ? 'rotate-180' : ''}`} />
                </button>
            </div>
            
            {isToolkitExpanded && (
                <div className="space-y-0.5 animate-fade-in">
                    {ALL_TOOLS_CONFIG.map((tool) => {
                        const isToolActive = activeTool === tool.key;
                        // Tools are credit-based: anyone can open them and the run cost is
                        // charged in credits. The only gate is AI Mode being on.
                        const toolRequiresAI = !isAIMode && tool.aiDependent !== false;

                        return (
                            <button
                                key={tool.key}
                                onClick={() => {
                                    if (toolRequiresAI) {
                                        addToast('Enable assisted tools to use this feature.', 'info');
                                        return;
                                    }
                                    onViewChange('toolkit');
                                    onToolSelect(tool.key);
                                }}
                                className={`w-full flex items-center gap-3 px-4 py-2 rounded-xl text-[11px] font-medium transition-all ${
                                    isToolActive
                                        ? 'text-blue-600 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-900/10'
                                        : 'text-gray-500 dark:text-slate-500 hover:text-gray-800 dark:hover:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800/30'
                                } ${toolRequiresAI ? 'opacity-50' : ''}`}
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

        {/* Support & Settings */}
        <div className="space-y-1">
            <h3 className="px-4 text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-widest mb-2">Settings</h3>
            <button
                onClick={() => {
                    onViewChange('account');
                    onToolSelect(null);
                }}
                className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group ${
                activeView === 'account'
                    ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400 border border-blue-100 dark:border-blue-800/50'
                    : 'text-gray-600 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-800/50 hover:text-gray-900 dark:hover:text-slate-100'
                }`}
            >
                <Settings className={`h-4.5 w-4.5 transition-transform group-hover:scale-110 ${activeView === 'account' ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400 dark:text-slate-500'}`} />
                <span className="flex-1 text-left">Account Settings</span>
                {activeView === 'account' && <ChevronRight className="h-3.5 w-3.5 opacity-50" />}
            </button>
        </div>

        {/* AI Mode Toggle in Sidebar */}
        <div className="pt-2">
             <div className="px-4 py-3 bg-gray-50 dark:bg-slate-800/50 rounded-xl border border-gray-100 dark:border-slate-800/50">
                <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                        <MessageSquare className="h-3 w-3" />
                        Assistance
                    </span>
                    <button
                        onClick={onToggleAIMode}
                        className={`relative inline-flex h-4 w-8 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${isAIMode ? 'bg-blue-600' : 'bg-gray-300 dark:bg-slate-600'}`}
                    >
                        <span className={`inline-block h-2.5 w-2.5 transform rounded-full bg-white transition ${isAIMode ? 'translate-x-4.5' : 'translate-x-1'}`} />
                    </button>
                </div>
                <p className="text-[9px] text-gray-500 dark:text-slate-500">
                    {isAIMode ? "Assisted tools are enabled" : "Assisted tools are restricted"}
                </p>
                {/* Model picker — only renders for paid+ users (server-gated). */}
                <ModelSelector className="mt-3" />
             </div>
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
                <p className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase">Credits</p>
                <p className="text-xs font-bold text-gray-900 dark:text-white tracking-tight">
                    {credits.toLocaleString()} CR
                </p>
            </div>
        </div>

        <div className="flex flex-col gap-0.5">
            <button 
                onClick={onToggleTheme}
                className="flex items-center gap-3 px-3 py-1.5 rounded-lg text-xs text-gray-600 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-800 transition-colors"
            >
                {theme === 'light' ? <Moon className="h-3.5 w-3.5" /> : <Sun className="h-3.5 w-3.5" />}
                <span>{theme === 'light' ? 'Dark Mode' : 'Light Mode'}</span>
            </button>
            <button 
                onClick={onLogout}
                className="flex items-center gap-3 px-3 py-1.5 rounded-lg text-xs text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
            >
                <LogOut className="h-3.5 w-3.5" />
                <span>Sign Out</span>
            </button>
        </div>

        <div className="mt-3 pt-3 flex items-center gap-3 border-t border-gray-200/50 dark:border-slate-800/50">
            {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt="Profile" className="h-7 w-7 rounded-lg object-cover" />
            ) : (
                <div className="h-7 w-7 rounded-lg bg-gray-200 dark:bg-slate-800 flex items-center justify-center">
                    <UserIcon className="h-3.5 w-3.5 text-gray-500" />
                </div>
            )}
            <div className="flex-1 min-w-0">
                <p className="text-[11px] font-bold text-gray-900 dark:text-white truncate">
                    {profile?.full_name || profile?.company_name || 'My Profile'}
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
