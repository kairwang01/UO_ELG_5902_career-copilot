import React from 'react';
import {
  BarChart2,
  BookmarkCheck,
  Briefcase,
  Building2,
  CheckCircle2,
  ChevronRight,
  CreditCard,
  Plus,
  Search,
  TrendingUp,
  User,
  Users,
} from 'lucide-react';
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

const formatTranslation = (
  template: string,
  values: Record<string, string | number>,
) =>
  Object.entries(values).reduce(
    (text, [key, value]) => text.replace(`{${key}}`, String(value)),
    template,
  );

function KpiCard({
  title,
  value,
  Icon,
  darkMode,
  loading = false,
}: {
  title: string;
  value: string;
  Icon: React.ElementType;
  darkMode: boolean;
  loading?: boolean;
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
      <div className="min-w-0">
        <p className={`text-2xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'} ${loading ? 'animate-pulse' : ''}`}>
          {loading ? '—' : value}
        </p>
        <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>{title}</p>
      </div>
    </div>
  );
}

function PipelineStep({
  label,
  value,
  description,
  Icon,
  state,
  darkMode,
  onClick,
  actionLabel,
}: {
  label: string;
  value: string;
  description: string;
  Icon: React.ElementType;
  state: 'done' | 'active' | 'idle';
  darkMode: boolean;
  onClick: () => void;
  actionLabel: string;
}) {
  const stateClass =
    state === 'done'
      ? darkMode
        ? 'border-emerald-800 bg-emerald-900/20'
        : 'border-emerald-200 bg-emerald-50'
      : state === 'active'
        ? darkMode
          ? 'border-blue-800 bg-blue-900/20'
          : 'border-blue-200 bg-blue-50'
        : darkMode
          ? 'border-gray-700 bg-gray-900/30'
          : 'border-gray-200 bg-white';
  const iconClass =
    state === 'done'
      ? 'text-emerald-600 dark:text-emerald-300'
      : state === 'active'
        ? 'text-[#1d4ed8]'
        : darkMode
          ? 'text-gray-400'
          : 'text-gray-500';

  return (
    <button
      type="button"
      onClick={onClick}
      className={`group flex min-h-[148px] flex-col rounded-xl border p-4 text-left transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-400/40 ${stateClass}`}
    >
      <div className="flex items-start justify-between gap-3">
        <span className={`flex h-10 w-10 items-center justify-center rounded-lg ${darkMode ? 'bg-gray-800' : 'bg-white'} ${iconClass}`}>
          <Icon className="h-5 w-5" />
        </span>
        {state === 'done' && <CheckCircle2 className="h-5 w-5 text-emerald-500" />}
      </div>
      <div className="mt-4 min-w-0">
        <p className={`text-sm font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>{label}</p>
        <p className={`mt-1 text-lg font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>{value}</p>
        <p className={`mt-2 line-clamp-2 text-xs leading-5 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
          {description}
        </p>
      </div>
      <span className="mt-auto inline-flex items-center gap-1 pt-4 text-xs font-semibold text-[#1d4ed8]">
        {actionLabel}
        <ChevronRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
      </span>
    </button>
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
  const activePostings = jobPostings.filter((job) => job.is_active);
  const jobsWithoutApplicants = activePostings.filter((job) => job.applicant_count === 0).length;
  const hasCompanyProfile = companyName.trim().length > 0;

  const pipelineSteps = [
    {
      label: t('portal_pipeline_publish_label'),
      value: formatTranslation(t('portal_pipeline_active_roles'), { count: activeJobs }),
      description: t('portal_pipeline_publish_desc'),
      Icon: Briefcase,
      state: activeJobs > 0 ? 'done' : 'active',
      page: 'post-job' as PortalPage,
      actionLabel: activeJobs > 0 ? t('portal_action_manage_roles') : t('portal_action_start_posting'),
    },
    {
      label: t('portal_pipeline_applicants_label'),
      value: formatTranslation(t('portal_pipeline_applicant_count'), { count: totalApplicants }),
      description: jobsWithoutApplicants > 0
        ? formatTranslation(t('portal_pipeline_zero_applicants_desc'), { count: jobsWithoutApplicants })
        : t('portal_pipeline_applicants_desc'),
      Icon: Users,
      state: totalApplicants > 0 ? 'done' : activeJobs > 0 ? 'active' : 'idle',
      page: 'job-listings' as PortalPage,
      actionLabel: t('portal_action_review_now'),
    },
    {
      label: t('portal_pipeline_screen_label'),
      value: avgMatchScore > 0
        ? formatTranslation(t('portal_pipeline_match_score'), { score: avgMatchScore })
        : t('portal_pipeline_match_waiting'),
      description: t('portal_pipeline_screen_desc'),
      Icon: BarChart2,
      state: avgMatchScore > 0 ? 'done' : totalApplicants > 0 ? 'active' : 'idle',
      page: 'job-listings' as PortalPage,
      actionLabel: t('portal_action_review_now'),
    },
    {
      label: t('portal_pipeline_engage_label'),
      value: t('portal_pipeline_engage_value'),
      description: t('portal_pipeline_engage_desc'),
      Icon: BookmarkCheck,
      state: totalApplicants > 0 ? 'active' : 'idle',
      page: 'shortlist' as PortalPage,
      actionLabel: t('portal_action_open_shortlist'),
    },
  ] as const;

  const priorityActions = [
    activeJobs === 0
      ? {
          msg: t('portal_priority_publish_first'),
          page: 'post-job' as PortalPage,
          action: t('portal_action_start_posting'),
          Icon: Plus,
        }
      : newApplicants > 0
        ? {
            msg: formatTranslation(t('portal_priority_review_new'), { count: newApplicants }),
            page: 'job-listings' as PortalPage,
            action: t('portal_action_review_now'),
            Icon: Users,
          }
        : totalApplicants > 0
          ? {
              msg: t('portal_priority_screen_candidates'),
              page: 'job-listings' as PortalPage,
              action: t('portal_action_review_now'),
              Icon: BarChart2,
            }
          : {
              msg: t('portal_priority_source_candidates'),
              page: 'talent-pool' as PortalPage,
              action: t('portal_action_open_discover'),
              Icon: Search,
            },
    !hasCompanyProfile && {
      msg: t('portal_action_complete_profile'),
      page: 'company-profile' as PortalPage,
      action: t('portal_action_go_to_profile'),
      Icon: User,
    },
    {
      msg: t('portal_action_check_billing'),
      page: 'billing' as PortalPage,
      action: t('portal_action_view_plan'),
      Icon: CreditCard,
    },
  ].filter(Boolean) as {
    msg: string;
    page: PortalPage;
    action: string;
    Icon: React.ElementType;
  }[];

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
      page: 'shortlist' as PortalPage,
      title: t('portal_nav_shortlist'),
      description: t('portal_action_shortlist_desc'),
      Icon: BookmarkCheck,
    },
    {
      page: 'agency-hub' as PortalPage,
      title: t('portal_nav_agency_hub'),
      description: t('portal_action_agency_desc'),
      Icon: Building2,
    },
    {
      page: 'company-profile' as PortalPage,
      title: t('portal_nav_org_profile'),
      description: t('portal_action_profile_desc'),
      Icon: User,
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
          <KpiCard title={t('portal_kpi_active_posts')} value={activeJobs.toString()} Icon={Briefcase} darkMode={dm} loading={loading} />
          <KpiCard title={t('kpi_total_applicants')} value={totalApplicants.toString()} Icon={Users} darkMode={dm} loading={loading} />
          <KpiCard title={t('portal_kpi_new_applicants_7d')} value={newApplicants.toString()} Icon={TrendingUp} darkMode={dm} loading={loading} />
          <div
            className={`rounded-xl border p-5 flex items-center gap-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${
              dm ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
            }`}
          >
            <div className={`rounded-lg p-3 ${dm ? 'bg-gray-700' : 'bg-blue-50'}`}>
              <BarChart2 className="w-6 h-6 text-[#1d4ed8]" />
            </div>
            <div>
              <p className={`text-2xl font-bold ${dm ? 'text-white' : 'text-gray-900'} ${loading ? 'animate-pulse' : ''}`}>
                {loading ? '—' : avgMatchScore > 0 ? `${avgMatchScore}%` : '—'}
              </p>
              <p className={`text-sm ${dm ? 'text-gray-400' : 'text-gray-500'}`}>{t('kpi_avg_match_score')}</p>
              {!loading && avgMatchScore === 0 && (
                <p className={`text-xs mt-0.5 ${dm ? 'text-gray-500' : 'text-gray-400'}`}>{t('portal_kpi_no_scored')}</p>
              )}
            </div>
          </div>
        </div>

        <div className={`rounded-xl border p-6 mb-8 ${dm ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className={`text-base font-semibold ${dm ? 'text-white' : 'text-gray-900'}`}>{t('portal_pipeline_title')}</h2>
              <p className={`mt-1 text-sm ${dm ? 'text-gray-400' : 'text-gray-500'}`}>{t('portal_pipeline_desc')}</p>
            </div>
            <span className={`inline-flex w-fit rounded-full border px-3 py-1 text-xs font-semibold ${
              activeJobs > 0 && totalApplicants > 0
                ? dm ? 'border-emerald-800 bg-emerald-900/20 text-emerald-300' : 'border-emerald-200 bg-emerald-50 text-emerald-700'
                : dm ? 'border-amber-800 bg-amber-900/20 text-amber-300' : 'border-amber-200 bg-amber-50 text-amber-800'
            }`}>
              {activeJobs > 0 && totalApplicants > 0 ? t('portal_pipeline_ready') : t('portal_pipeline_needs_attention')}
            </span>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            {pipelineSteps.map((step) => (
              <PipelineStep
                key={step.label}
                label={step.label}
                value={step.value}
                description={step.description}
                Icon={step.Icon}
                state={step.state}
                darkMode={dm}
                onClick={() => onNavigate(step.page)}
                actionLabel={step.actionLabel}
              />
            ))}
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

          {/* Action Required — data-aware prompts wired to navigation */}
          <div className={`rounded-xl border p-6 ${dm ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
            <h2 className={`text-lg font-semibold mb-4 ${dm ? 'text-white' : 'text-gray-900'}`}>{t('portal_dashboard_action_required')}</h2>
            <div className="space-y-3">
              {priorityActions.map(({ msg, page, action, Icon }) => (
                <div
                  key={page}
                  className={`flex items-center justify-between gap-3 p-4 rounded-lg border ${
                    dm ? 'border-gray-700 bg-gray-700' : 'border-gray-200 bg-white'
                  }`}
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg ${dm ? 'bg-gray-800 text-blue-300' : 'bg-blue-50 text-[#1d4ed8]'}`}>
                      <Icon className="h-4 w-4" />
                    </span>
                    <p className={`text-sm ${dm ? 'text-gray-200' : 'text-gray-900'}`}>{msg}</p>
                  </div>
                  <button
                    onClick={() => onNavigate(page)}
                    className="flex flex-shrink-0 items-center gap-1 text-sm text-[#1d4ed8] font-medium"
                  >
                    {action}
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
                  className={`px-2 py-0.5 rounded-full text-xs font-medium border ${
                    job.is_active
                      ? dm ? 'bg-teal-900/30 text-teal-300 border-teal-800' : 'bg-teal-50 text-teal-800 border-teal-200'
                      : dm ? 'bg-gray-700 text-gray-300 border-gray-600' : 'bg-gray-100 text-gray-600 border-gray-200'
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
