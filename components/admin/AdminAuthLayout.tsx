import React from 'react';
import { Link } from 'react-router-dom';
import { SITE_ROUTES } from '../../config/site';

interface AdminAuthLayoutProps {
  /** Right-panel heading (e.g. "Sign in", "Access denied"). */
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}

/**
 * Enterprise admin auth shell — split brand rail + form column.
 * Light, neutral palette (Okta / Stripe Dashboard / GCP Console pattern).
 */
const AdminAuthLayout: React.FC<AdminAuthLayoutProps> = ({ title, subtitle, children }) => (
  <div className="min-h-screen bg-[#f0f2f5] flex flex-col lg:flex-row">
    {/* Brand rail */}
    <aside
      className="lg:w-[420px] xl:w-[460px] shrink-0 bg-[#0f2744] text-white flex flex-col justify-between px-8 py-10 lg:px-10 lg:py-12"
      aria-hidden={false}
    >
      <div>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
          </div>
          <div>
            <p className="text-base font-semibold tracking-tight">Career CoPilot</p>
            <p className="text-xs text-blue-200/80 font-medium">Administration Console</p>
          </div>
        </div>

        <p className="mt-10 text-sm leading-relaxed text-blue-100/90 max-w-sm">
          Internal operations portal for platform configuration, usage monitoring, and user support.
        </p>

        <ul className="mt-8 space-y-3 text-sm text-blue-100/75">
          {[
            'API keys and model configuration',
            'Usage quotas and daily limits',
            'User accounts, credits, and audit trail',
          ].map((item) => (
            <li key={item} className="flex items-start gap-2.5">
              <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-blue-300 shrink-0" aria-hidden />
              {item}
            </li>
          ))}
        </ul>
      </div>

      <p className="text-[11px] text-blue-200/50 mt-10">
        © {new Date().getFullYear()} Career CoPilot · Internal use only
      </p>
    </aside>

    {/* Form column */}
    <main className="flex-1 flex flex-col min-h-0">
      <div className="flex-1 flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-[400px]">
          <header className="mb-8">
            <h1 className="text-2xl font-semibold text-gray-900 tracking-tight">{title}</h1>
            {subtitle && <p className="mt-2 text-sm text-gray-600 leading-relaxed">{subtitle}</p>}
          </header>
          {children}
        </div>
      </div>

      <footer className="px-6 sm:px-10 py-5 border-t border-gray-200/80 bg-white/60 text-center sm:text-left">
        <p className="text-xs text-gray-500">
          Authorized personnel only. Activity may be monitored and recorded.
        </p>
        <p className="mt-1.5 text-xs">
          <Link to={SITE_ROUTES.home} className="text-blue-700 hover:text-blue-800 hover:underline">
            Return to public site
          </Link>
        </p>
      </footer>
    </main>
  </div>
);

export default AdminAuthLayout;
