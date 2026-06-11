import React from 'react';
import { Briefcase, Users, TrendingUp, BarChart2, Plus, User, CreditCard, Building2, ChevronRight } from 'lucide-react';
import { PortalTopBar } from '../PortalTopBar';
import type { JobPostingWithCount } from '../../../lib/recruitingData';
import type { PortalPage } from '../PortalSidebar';

interface KpiData {
  activeJobs: number;
  totalApplicants: number;
  newApplicants: number;
  avgMatchScore: number;
}

interface PortalDashboardProps {
  jobPostings: JobPostingWithCount[];
  kpiData: KpiData;
  loading: boolean;
  error: string | null;
  darkMode: boolean;
  onNavigate: (page: PortalPage) => void;
  companyName: string;
  t: (key: string) => string;
}

function KpiCard({
  title,
  value,
  Icon,
  darkMode,
}: {
  title: string;
  value: string;
  Icon: React.ElementType;
  darkMode: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-5 flex items-center gap-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${
        darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
      }`}
    >
      <div className={`rounded-lg p-3 ${darkMode ? 'bg-gray-700' : 'bg-blue-50'}`}>
        <Icon className="w-6 h-6 text-[#1d4ed8]" />
      </div>
      <div>
        <p className={`text-2xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>{value}</p>
        <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>{title}</p>
      </div>
    </div>
  );
}

export function PortalDashboard({
  jobPostings,
  kpiData,
  loading,
  error,
  darkMode,
  onNavigate,
  companyName,
  t,
}: PortalDashboardProps) {
  const dm = darkMode;
  const { activeJobs, totalApplicants, newApplicants, avgMatchScore } = kpiData;
  const quickActions = [
    {
      page: 'post-job' as PortalPage,
      title: t('portal_nav_post_job'),
      description: t('portal_action_post_job_desc'),
      Icon: Plus,
      primary: true,
    },
    {
      page: 'job-listings' as PortalPage,
      title: t('portal_dashboard_view_applicants'),
      description: t('portal_action_view_applicants_desc'),
      Icon: Users,
    },
    {
      page: 'talent-pool' as PortalPage,
      title: t('portal_nav_discover'),
      description: t('portal_action_discover_desc'),
      Icon: Briefcase,
    },
    {
      page: 'company-profile' as PortalPage,
      title: t('portal_nav_org_profile'),
      description: t('portal_action_profile_desc'),
      Icon: User,
    },
    {
      page: 'billing' as PortalPage,
      title: t('portal_nav_billing'),
      description: t('portal_action_billing_desc'),
      Icon: CreditCard,
    },
    {
      page: 'agency-hub' as PortalPage,
      title: t('portal_nav_agency_hub'),
      description: t('portal_action_agency_desc'),
      Icon: Building2,
    },
  ];

  return (
    <>
      <PortalTopBar title={t('portal_nav_dashboard')} darkMode={dm} />
      <div className="max-w-[1088px] mx-auto p-8 animate-view-fade">
        <div className="mb-8">
          <p className={`text-lg font-medium ${dm ? 'text-white' : 'text-gray-900'}`}>
            {companyName
              ? t('portal_dashboard_welcome_named').replace('{name}', companyName)
              : t('portal_dashboard_welcome')}
          </p>
          <p className={dm ? 'text-gray-400' : 'text-gray-500'}>
            {t('portal_dashboard_subtitle')}
          </p>
        </div>

        {/* KPIs — real data from EmployerDashboard.fetchDashboardData */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <KpiCard title={t('portal_kpi_active_posts')} value={activeJobs.toString()} Icon={Briefcase} darkMode={dm} />
          <KpiCard title={t('kpi_total_applicants')} value={totalApplicants.toString()} Icon={Users} darkMode={dm} />
          <KpiCard title={t('portal_kpi_new_applicants_7d')} value={newApplicants.toString()} Icon={TrendingUp} darkMode={dm} />
          <div
            className={`rounded-xl border p-5 flex items-center gap-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${
              dm ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
            }`}
          >
            <div className={`rounded-lg p-3 ${dm ? 'bg-gray-700' : 'bg-blue-50'}`}>
              <BarChart2 className="w-6 h-6 text-[#1d4ed8]" />
            </div>
            <div>
              <p className={`text-2xl font-bold ${dm ? 'text-white' : 'text-gray-900'}`}>
                {avgMatchScore > 0 ? `${avgMatchScore}%` : '—'}
              </p>
              <p className={`text-sm ${dm ? 'text-gray-400' : 'text-gray-500'}`}>{t('kpi_avg_match_score')}</p>
              {avgMatchScore === 0 && (
                <p className={`text-xs mt-0.5 ${dm ? 'text-gray-500' : 'text-gray-400'}`}>{t('portal_kpi_no_scored')}</p>
              )}
            </div>
          </div>
        </div>

        {/* Quick actions */}
        <div className={`rounded-xl border p-6 mb-8 ${dm ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
          <h2 className={`text-base font-semibold mb-4 ${dm ? 'text-white' : 'text-gray-900'}`}>{t('portal_dashboard_quick_actions')}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {quickActions.map(({ page, title, description, Icon, primary }) => (
              <button
                key={page}
                type="button"
                onClick={() => onNavigate(page)}
                className={`group flex min-h-[96px] items-start gap-3 rounded-xl border p-4 text-left transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-400/40 ${
                  primary
                    ? 'border-blue-600 bg-[#1d4ed8] text-white shadow-sm shadow-blue-600/20 hover:bg-[#1a45c9]'
                    : dm
                    ? 'border-gray-700 bg-gray-900/30 text-gray-200 hover:border-gray-600 hover:bg-gray-700/60'
                    : 'border-gray-200 bg-white text-gray-900 hover:border-blue-200 hover:bg-blue-50/40'
                }`}
              >
                <span
                  className={`mt-0.5 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg ${
                    primary ? 'bg-white/15' : dm ? 'bg-gray-700' : 'bg-blue-50'
                  }`}
                >
                  <Icon className={`h-5 w-5 ${primary ? 'text-white' : 'text-[#1d4ed8]'}`} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold">{title}</span>
                  <span className={`mt-1 block text-xs leading-5 ${primary ? 'text-blue-50' : dm ? 'text-gray-400' : 'text-gray-500'}`}>
                    {description}
                  </span>
                </span>
                <ChevronRight className={`mt-1 h-4 w-4 flex-shrink-0 transition-transform group-hover:translate-x-0.5 ${primary ? 'text-white' : 'text-[#1d4ed8]'}`} />
              </button>
            ))}
          </div>
        </div>

        {/* Job Overview + Action Required — lg:col-span-2 + 1 layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Job Overview — derived from live jobPostings */}
          <div className={`lg:col-span-2 rounded-xl border p-6 ${dm ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
            <h2 className={`text-lg font-semibold mb-4 ${dm ? 'text-white' : 'text-gray-900'}`}>{t('portal_dashboard_job_overview')}</h2>
            {jobPostings.length === 0 ? (
              <p className={`text-sm ${dm ? 'text-gray-400' : 'text-gray-500'}`}>{t('portal_dashboard_no_postings')}</p>
            ) : (() => {
              const active = jobPostings.filter((j) => j.is_active);
              const topPerformer = [...active].sort((a, b) => b.applicant_count - a.applicant_count)[0];
              const lowActivity = [...active].sort((a, b) => a.applicant_count - b.applicant_count)[0];
              const expiringSoon = [...active].sort(
                (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
              )[0];
              const applicantsLabel = (n: number) =>
                `${n} ${t('employer_dashboard_applicants_label')}`;
              const highlights = [
                topPerformer && {
                  category: t('portal_overview_top_performing'),
                  jobTitle: topPerformer.title,
                  metric: applicantsLabel(topPerformer.applicant_count),
                },
                lowActivity && lowActivity.id !== topPerformer?.id && {
                  category: t('portal_overview_low_activity'),
                  jobTitle: lowActivity.title,
                  metric: applicantsLabel(lowActivity.applicant_count),
                },
                expiringSoon && {
                  category: t('portal_overview_oldest_posting'),
                  jobTitle: expiringSoon.title,
                  metric: `${t('employer_dashboard_posted_on')} ${new Date(expiringSoon.created_at).toLocaleDateString()}`,
                },
              ].filter(Boolean) as { category: string; jobTitle: string; metric: string }[];
              return (
                <div className="space-y-4">
                  {highlights.map((h, i) => (
                    <div key={i} className={`border rounded-lg p-4 ${dm ? 'border-gray-700' : 'border-gray-200'}`}>
                      <div className={`text-xs font-medium mb-2 ${dm ? 'text-gray-400' : 'text-gray-600'}`}>{h.category}</div>
                      <div className={`font-semibold mb-1 ${dm ? 'text-white' : 'text-gray-900'}`}>{h.jobTitle}</div>
                      <div className={`text-sm ${dm ? 'text-gray-400' : 'text-gray-600'}`}>{h.metric}</div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>

          {/* Action Required — static prompts wired to navigation */}
          <div className={`rounded-xl border p-6 ${dm ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
            <h2 className={`text-lg font-semibold mb-4 ${dm ? 'text-white' : 'text-gray-900'}`}>{t('portal_dashboard_action_required')}</h2>
            <div className="space-y-3">
              {([
                { msgKey: 'portal_action_review_applicants', page: 'job-listings' as PortalPage, actionKey: 'portal_action_review_now' },
                { msgKey: 'portal_action_complete_profile', page: 'company-profile' as PortalPage, actionKey: 'portal_action_go_to_profile' },
                { msgKey: 'portal_action_check_billing', page: 'billing' as PortalPage, actionKey: 'portal_action_view_plan' },
              ] as const).map(({ msgKey, page, actionKey }) => (
                <div
                  key={page}
                  className={`flex items-center justify-between p-4 rounded-lg border ${
                    dm ? 'border-gray-700 bg-gray-700' : 'border-gray-200 bg-white'
                  }`}
                >
                  <p className={`text-sm ${dm ? 'text-gray-200' : 'text-gray-900'}`}>{t(msgKey)}</p>
                  <button
                    onClick={() => onNavigate(page)}
                    className="flex items-center gap-1 text-sm text-[#1d4ed8] font-medium ml-3 flex-shrink-0"
                  >
                    {t(actionKey)}
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Recent job postings — real data */}
        <div className={`rounded-xl border p-6 ${dm ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
          <h2 className={`text-base font-semibold mb-4 ${dm ? 'text-white' : 'text-gray-900'}`}>
            {t('portal_dashboard_recent_postings')}
          </h2>

          {loading && (
            <div role="status" aria-live="polite" className="space-y-3">
              <p className={dm ? 'text-gray-400' : 'text-gray-500'}>{t('portal_loading_data')}</p>
              {[0, 1, 2].map((item) => (
                <div
                  key={item}
                  className={`h-16 rounded-lg border p-4 ${dm ? 'border-gray-700 bg-gray-900/40' : 'border-gray-100 bg-gray-50'}`}
                >
                  <div className={`h-3 w-1/3 rounded-full ${dm ? 'bg-gray-700' : 'bg-gray-200'}`} />
                  <div className={`mt-3 h-2 w-1/2 rounded-full ${dm ? 'bg-gray-700' : 'bg-gray-200'}`} />
                </div>
              ))}
            </div>
          )}

          {error && !loading && (
            <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300">
              {error}
            </div>
          )}

          {!loading && !error && jobPostings.length === 0 && (
            <div className="text-center py-10">
              <p className={`text-sm mb-4 ${dm ? 'text-gray-400' : 'text-gray-500'}`}>
                {t('portal_dashboard_no_postings')}
              </p>
              <button
                onClick={() => onNavigate('post-job')}
                className="px-5 py-2 bg-[#1d4ed8] text-white rounded-lg text-sm font-medium hover:bg-[#1a45c9] transition-colors"
              >
                {t('employer_dashboard_post_first_job_button')}
              </button>
            </div>
          )}

          {!loading && !error && jobPostings.slice(0, 5).map((job) => (
            <div
              key={job.id}
              className={`flex flex-col gap-3 py-4 border-b last:border-0 sm:flex-row sm:items-center sm:justify-between ${
                dm ? 'border-gray-700' : 'border-gray-100'
              }`}
            >
              <div className="min-w-0">
                <p className={`font-semibold text-sm ${dm ? 'text-white' : 'text-gray-900'}`}>{job.title}</p>
                <p className={`text-xs mt-0.5 ${dm ? 'text-gray-400' : 'text-gray-500'}`}>
                  {job.location} &bull; {t('employer_dashboard_posted_on')} {new Date(job.created_at).toLocaleDateString()}
                </p>
              </div>
              <div className="flex items-center justify-between gap-4 sm:justify-end">
                <div className="text-center">
                  <p className="text-xl font-bold text-[#1d4ed8]">{job.applicant_count}</p>
                  <p className={`text-xs ${dm ? 'text-gray-400' : 'text-gray-500'}`}>{t('employer_dashboard_applicants_label')}</p>
                </div>
                <span
                  className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                    job.is_active
                      ? 'bg-teal-50 text-teal-800 border border-teal-200'
                      : 'bg-gray-100 text-gray-600 border border-gray-200'
                  }`}
                >
                  {job.is_active ? t('portal_status_active') : t('portal_status_closed')}
                </span>
              </div>
            </div>
          ))}

          {!loading && jobPostings.length > 5 && (
            <button
              onClick={() => onNavigate('job-listings')}
              className={`mt-4 text-sm font-medium text-[#1d4ed8] hover:underline`}
            >
              {t('portal_dashboard_see_all').replace('{n}', jobPostings.length.toString())}
            </button>
          )}
        </div>
      </div>
    </>
  );
}
