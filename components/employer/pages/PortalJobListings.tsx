import React, { useState } from 'react';
import {
  Briefcase,
  Users,
  TrendingUp,
  UserCheck,
  ThumbsUp,
  MapPin,
  Calendar,
  Edit,
  ChevronDown,
  ChevronUp,
  Search,
  AlertCircle,
} from 'lucide-react';
import { PortalTopBar } from '../PortalTopBar';
import type { JobPostingWithCount } from '../../../lib/recruitingData';
import type { PortalPage } from '../PortalSidebar';

interface PortalJobListingsProps {
  jobPostings: JobPostingWithCount[];
  kpiData: { activeJobs: number; totalApplicants: number; newApplicants: number };
  loading: boolean;
  error: string | null;
  darkMode: boolean;
  onEditJob: (job: JobPostingWithCount) => void;
  onViewApplicants: (job: JobPostingWithCount) => void;
  onNavigate: (page: PortalPage) => void;
  t?: (key: string) => string;
}

function StatCard({
  title,
  value,
  Icon,
  darkMode,
}: {
  title: string;
  value: string | number;
  Icon: React.ElementType;
  darkMode: boolean;
}) {
  const dm = darkMode;
  return (
    <div className={`rounded-xl border p-6 ${dm ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
      <div className={`w-12 h-12 rounded-lg mb-4 flex items-center justify-center ${dm ? 'bg-gray-700' : 'bg-blue-50'}`}>
        <Icon className="w-6 h-6 text-[#1d4ed8]" />
      </div>
      <div className={`text-3xl font-semibold mb-1 ${dm ? 'text-white' : 'text-gray-900'}`}>{value}</div>
      <div className={`text-sm ${dm ? 'text-gray-400' : 'text-gray-600'}`}>{title}</div>
    </div>
  );
}

export function PortalJobListings({
  jobPostings,
  kpiData,
  loading,
  error,
  darkMode,
  onEditJob,
  onViewApplicants,
  onNavigate,
  t: tProp,
}: PortalJobListingsProps) {
  const t = tProp ?? ((k: string) => k);
  const dm = darkMode;
  const [showExpired, setShowExpired] = useState(false);
  const [showAllActive, setShowAllActive] = useState(false);

  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'closed'>('all');

  const normalizedQuery = query.trim().toLowerCase();
  const activeJobs = jobPostings.filter((j) => j.is_active);
  const closedJobs = jobPostings.filter((j) => !j.is_active);
  const filteredJobs = jobPostings.filter((job) => {
    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'active' && job.is_active) ||
      (statusFilter === 'closed' && !job.is_active);
    const haystack = `${job.title} ${job.location ?? ''} ${job.company_name ?? ''}`.toLowerCase();
    return matchesStatus && (!normalizedQuery || haystack.includes(normalizedQuery));
  });
  const filteredActiveJobs = filteredJobs.filter((j) => j.is_active);
  const filteredClosedJobs = filteredJobs.filter((j) => !j.is_active);
  const displayedActive = showAllActive ? filteredActiveJobs : filteredActiveJobs.slice(0, 5);
  const activeWithApplicants = activeJobs.filter((j) => j.applicant_count > 0).length;
  const quietActiveJobs = activeJobs.filter((j) => j.applicant_count === 0).length;
  const avgApplicants = activeJobs.length > 0
    ? Math.round(activeJobs.reduce((sum, job) => sum + job.applicant_count, 0) / activeJobs.length)
    : 0;

  const statusLabel = (job: JobPostingWithCount) => (job.is_active ? t('portal_status_active') : t('portal_status_closed'));
  const statusStyle = (job: JobPostingWithCount) =>
    job.is_active
      ? 'bg-teal-50 text-teal-800 border-teal-200'
      : 'bg-gray-100 text-gray-700 border-gray-300';

  const JobRow: React.FC<{ job: JobPostingWithCount }> = ({ job }) => (
    <div
      className={`rounded-xl border p-5 hover:shadow-md transition-shadow ${
        dm ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
      }`}
    >
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex-1 min-w-0">
          <button
            onClick={() => onViewApplicants(job)}
            aria-label={t('portal_listings_view_applicants_aria').replace('{title}', job.title)}
            className={`text-xl font-semibold text-left hover:text-[#1d4ed8] transition-colors ${dm ? 'text-white' : 'text-gray-900'}`}
          >
            {job.title}
          </button>
          <div className={`flex items-center gap-4 text-sm mt-1 ${dm ? 'text-gray-400' : 'text-gray-600'}`}>
            <span className="flex items-center gap-1">
              <MapPin className="w-4 h-4" />
              {job.location || 'Remote'}
            </span>
            <span className="flex items-center gap-1">
              <Calendar className="w-4 h-4" />
              {t('employer_dashboard_posted_on')} {new Date(job.created_at).toLocaleDateString()}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-6 flex-shrink-0">
          <button
            onClick={() => onViewApplicants(job)}
            aria-label={t('portal_listings_view_applicants_aria').replace('{title}', job.title)}
            className="text-center group"
          >
            <div className={`text-3xl font-semibold ${dm ? 'text-white' : 'text-gray-900'}`}>
              {job.applicant_count}
            </div>
            <div className={`text-sm ${dm ? 'text-gray-400' : 'text-gray-600'} group-hover:text-[#1d4ed8] group-hover:underline transition-colors`}>
              {t('employer_dashboard_applicants_label')}
            </div>
          </button>

          <div className="flex flex-col gap-2">
            <button
              onClick={() => onEditJob(job)}
              aria-label={t('portal_listings_edit_aria').replace('{title}', job.title)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm border rounded-lg transition-colors ${
                dm ? 'border-gray-600 text-gray-300 hover:bg-gray-700' : 'border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
            >
              <Edit className="w-4 h-4" />
              {t('employer_dashboard_edit_button')}
            </button>
            <span className={`px-3 py-1 rounded-full text-xs font-medium border text-center ${statusStyle(job)}`}>
              {statusLabel(job)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <PortalTopBar title={t('portal_nav_job_listings')} darkMode={dm} />
      <div className="max-w-[1088px] mx-auto p-8 animate-view-fade">

        {loading && <p className={dm ? 'text-gray-400' : 'text-gray-500'}>Loading…</p>}
        {error && !loading && <p className="text-red-500 text-sm mb-6">{error}</p>}

        {/* Stats — all derived from existing job/application data, no placeholder pipeline counts. */}
        {!loading && (
          <div className="mb-8">
            <h2 className={`text-base font-semibold mb-4 ${dm ? 'text-white' : 'text-gray-900'}`}>{t('portal_listings_quick_stats')}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <StatCard title={t('portal_kpi_active_posts')} value={kpiData.activeJobs} Icon={Briefcase} darkMode={dm} />
              <StatCard title={t('kpi_total_applicants')} value={kpiData.totalApplicants} Icon={Users} darkMode={dm} />
              <StatCard title={t('portal_kpi_new_applicants_7d')} value={kpiData.newApplicants} Icon={TrendingUp} darkMode={dm} />
              <StatCard title={t('portal_listings_with_applicants')} value={activeWithApplicants} Icon={UserCheck} darkMode={dm} />
              <StatCard title={t('portal_listings_quiet_posts')} value={quietActiveJobs} Icon={AlertCircle} darkMode={dm} />
              <StatCard title={t('portal_listings_avg_applicants')} value={avgApplicants} Icon={ThumbsUp} darkMode={dm} />
            </div>
          </div>
        )}

        {!loading && (
          <div className={`mb-6 rounded-xl border p-4 ${dm ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <label className="relative flex-1">
                <span className="sr-only">{t('portal_listings_search_label')}</span>
                <Search className={`pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 ${dm ? 'text-gray-500' : 'text-gray-400'}`} />
                <input
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={t('portal_listings_search_placeholder')}
                  className={`w-full rounded-lg border py-2.5 pl-9 pr-3 text-sm outline-none transition focus:border-[#1d4ed8] focus:ring-2 focus:ring-blue-100 ${
                    dm
                      ? 'border-gray-600 bg-gray-700 text-white placeholder:text-gray-500 focus:ring-blue-900/40'
                      : 'border-gray-300 bg-white text-gray-900 placeholder:text-gray-400'
                  }`}
                />
              </label>
              <div className={`grid grid-cols-3 rounded-lg p-1 ${dm ? 'bg-gray-700' : 'bg-gray-100'}`} role="group" aria-label={t('portal_listings_filter_label')}>
                {([
                  ['all', t('portal_listings_filter_all')],
                  ['active', t('portal_listings_filter_active')],
                  ['closed', t('portal_listings_filter_closed')],
                ] as const).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => {
                      setStatusFilter(key);
                      setShowAllActive(false);
                    }}
                    className={`rounded-md px-3 py-2 text-sm font-semibold transition-colors ${
                      statusFilter === key
                        ? 'bg-white text-[#1d4ed8] shadow-sm dark:bg-gray-900 dark:text-blue-300'
                        : dm
                        ? 'text-gray-300 hover:text-white'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <p className={`mt-3 text-xs ${dm ? 'text-gray-500' : 'text-gray-500'}`}>
              {t('portal_listings_filter_result').replace('{n}', String(filteredJobs.length))}
            </p>
          </div>
        )}

        {/* Active listings */}
        {!loading && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className={`text-base font-semibold ${dm ? 'text-white' : 'text-gray-900'}`}>
                {t('portal_listings_active_recent')}
              </h2>
              <span className={`text-sm ${dm ? 'text-gray-400' : 'text-gray-600'}`}>
                {t('portal_listings_count_label').replace('{n}', String(filteredActiveJobs.length))}
              </span>
            </div>

            {filteredJobs.length === 0 ? (
              <div className={`rounded-xl border p-10 text-center ${dm ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
                <p className={`text-base font-semibold ${dm ? 'text-white' : 'text-gray-900'}`}>{t('portal_listings_no_results_title')}</p>
                <p className={`mt-2 text-sm ${dm ? 'text-gray-400' : 'text-gray-500'}`}>{t('portal_listings_no_results_desc')}</p>
                <button
                  type="button"
                  onClick={() => {
                    setQuery('');
                    setStatusFilter('all');
                  }}
                  className={`mt-4 px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                    dm ? 'border-gray-600 text-gray-300 hover:bg-gray-700' : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {t('portal_listings_clear_filters')}
                </button>
              </div>
            ) : filteredActiveJobs.length === 0 ? (
              <div className="text-center py-12">
                <p className={`text-sm mb-4 ${dm ? 'text-gray-400' : 'text-gray-500'}`}>{t('portal_listings_no_active')}</p>
                <button
                  onClick={() => onNavigate('post-job')}
                  className="px-5 py-2 bg-[#1d4ed8] text-white rounded-lg text-sm font-medium hover:bg-[#1a45c9] transition-colors"
                >
                  {t('portal_nav_post_job')}
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {displayedActive.map((job) => <JobRow key={job.id} job={job} />)}
              </div>
            )}

            {filteredActiveJobs.length > 5 && (
              <button
                onClick={() => setShowAllActive(!showAllActive)}
                className={`mt-4 w-full flex items-center justify-center gap-2 py-2 text-sm font-medium transition-colors ${
                  dm ? 'text-gray-400 hover:text-gray-200' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {showAllActive ? t('portal_listings_show_less') : t('portal_listings_show_more').replace('{n}', String(filteredActiveJobs.length - 5))}
                {showAllActive ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
            )}
          </div>
        )}

        {/* Closed/expired — collapsible */}
        {!loading && filteredClosedJobs.length > 0 && (
          <div className="mt-8">
            <button
              onClick={() => setShowExpired(!showExpired)}
              className={`w-full flex items-center justify-between p-4 border rounded-xl transition-colors ${
                dm ? 'bg-gray-800 border-gray-700 hover:bg-gray-700' : 'bg-white border-gray-200 hover:bg-gray-50'
              }`}
            >
              <div className="flex items-center gap-3">
                <h2 className={`text-base font-semibold ${dm ? 'text-white' : 'text-gray-900'}`}>
                  {t('portal_listings_expired')}
                </h2>
                <span className={`text-sm ${dm ? 'text-gray-400' : 'text-gray-600'}`}>({filteredClosedJobs.length})</span>
              </div>
              {showExpired
                ? <ChevronUp className={`w-5 h-5 ${dm ? 'text-gray-400' : 'text-gray-600'}`} />
                : <ChevronDown className={`w-5 h-5 ${dm ? 'text-gray-400' : 'text-gray-600'}`} />}
            </button>

            {showExpired && (
              <div className="mt-4 space-y-4">
                {filteredClosedJobs.map((job) => <JobRow key={job.id} job={job} />)}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
