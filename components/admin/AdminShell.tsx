import React from 'react';
import { Link } from 'react-router-dom';
import { SITE_ROUTES } from '../../config/site';
import BrandLogo from '../BrandLogo';

export interface AdminNavItem {
  id: string;
  label: string;
}

interface AdminShellProps {
  activeTab: string;
  tabs: AdminNavItem[];
  onTabChange: (id: string) => void;
  userEmail?: string | null;
  lastRefreshed?: Date | null;
  loading?: boolean;
  onRefresh: () => void;
  onSignOut: () => void;
  children: React.ReactNode;
}

const AdminShell: React.FC<AdminShellProps> = ({
  activeTab,
  tabs,
  onTabChange,
  userEmail,
  lastRefreshed,
  loading,
  onRefresh,
  onSignOut,
  children,
}) => {
  const activeLabel = tabs.find((t) => t.id === activeTab)?.label ?? 'Console';

  return (
    <div className="h-screen overflow-hidden bg-[#f0f2f5] flex">
      {/* Sidebar */}
      <aside className="hidden md:flex sticky top-0 h-screen w-60 lg:w-64 shrink-0 flex-col bg-[#0f2744] text-white">
        <div className="px-5 py-6 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <BrandLogo size="sm" surface="dark" subtitle="Admin Console" />
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto" aria-label="Admin navigation">
          {tabs.map((tb) => {
            const active = tb.id === activeTab;
            return (
              <button
                key={tb.id}
                type="button"
                onClick={() => onTabChange(tb.id)}
                className={`w-full text-left px-3 py-2.5 rounded-md text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-white/30 ${
                  active
                    ? 'bg-white/15 text-white'
                    : 'text-blue-100/80 hover:bg-white/10 hover:text-white'
                }`}
                aria-current={active ? 'page' : undefined}
              >
                {tb.label}
              </button>
            );
          })}
        </nav>

        <div className="px-5 py-4 border-t border-white/10 text-[11px] text-blue-200/50">
          Internal use only
        </div>
      </aside>

      {/* Main column */}
      <div className="flex-1 flex h-screen flex-col min-w-0 overflow-hidden">
        {/* Top bar */}
        <header className="sticky top-0 z-10 bg-white border-b border-gray-200 shadow-sm">
          <div className="px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
            <div className="min-w-0">
              <h1 className="text-base font-semibold text-gray-900 truncate">{activeLabel}</h1>
              {lastRefreshed && (
                <p className="text-[11px] text-gray-500 mt-0.5 hidden sm:block">
                  Last updated {lastRefreshed.toLocaleTimeString()}
                </p>
              )}
            </div>

            <div className="flex items-center gap-2 sm:gap-3 shrink-0">
              {/* Mobile nav */}
              <select
                className="md:hidden text-sm border border-gray-300 rounded-md px-2 py-1.5 bg-white text-gray-700"
                value={activeTab}
                onChange={(e) => onTabChange(e.target.value)}
                aria-label="Section"
              >
                {tabs.map((tb) => (
                  <option key={tb.id} value={tb.id}>
                    {tb.label}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={onRefresh}
                disabled={loading}
                title="Refresh"
                aria-label="Refresh"
                className="p-2 rounded-md text-gray-500 hover:text-gray-800 hover:bg-gray-100 disabled:opacity-40 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-600"
              >
                <svg
                  className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  <polyline points="23 4 23 10 17 10" />
                  <polyline points="1 20 1 14 7 14" />
                  <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                </svg>
              </button>

              <span
                className="hidden sm:block text-xs text-gray-600 max-w-[160px] truncate border-l border-gray-200 pl-3"
                title={userEmail ?? ''}
              >
                {userEmail}
              </span>

              <button
                type="button"
                onClick={onSignOut}
                className="text-xs font-medium text-gray-600 hover:text-gray-900 px-2.5 py-1.5 rounded-md hover:bg-gray-100 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-600"
              >
                Sign out
              </button>
            </div>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 overflow-auto">
          <div className="max-w-6xl mx-auto space-y-6">{children}</div>
        </main>

        <footer className="px-6 py-3 border-t border-gray-200 bg-white text-xs text-gray-500 flex flex-wrap items-center justify-between gap-2">
          <span>Authorized personnel only</span>
          <Link to={SITE_ROUTES.home} className="text-blue-700 hover:underline">
            Public site
          </Link>
        </footer>
      </div>
    </div>
  );
};

export default AdminShell;
