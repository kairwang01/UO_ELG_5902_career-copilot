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
      className={`rounded-xl border p-5 flex items-center gap-4 ${
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
}: PortalDashboardProps) {
  const dm = darkMode;
  const { activeJobs, totalApplicants, newApplicants, avgMatchScore } = kpiData;

  return (
    <>
      <PortalTopBar title="Dashboard" darkMode={dm} />
      <div className="max-w-[1088px] mx-auto p-8">
        <div className="mb-8">
          <p className={`text-lg font-medium ${dm ? 'text-white' : 'text-gray-900'}`}>
            Welcome back{companyName ? `, ${companyName}` : ''}!
          </p>
          <p className={dm ? 'text-gray-400' : 'text-gray-500'}>
            Here's what's happening with your job postings.
          </p>
        </div>

        {/* KPIs — real data from EmployerDashboard.fetchDashboardData */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <KpiCard title="Active Job Posts" value={activeJobs.toString()} Icon={Briefcase} darkMode={dm} />
          <KpiCard title="Total Applicants" value={totalApplicants.toString()} Icon={Users} darkMode={dm} />
          <KpiCard title="New Applicants (7d)" value={newApplicants.toString()} Icon={TrendingUp} darkMode={dm} />
          <div
            className={`rounded-xl border p-5 flex items-center gap-4 ${
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
              <p className={`text-sm ${dm ? 'text-gray-400' : 'text-gray-500'}`}>Avg Match Score</p>
              {avgMatchScore === 0 && (
                <p className={`text-xs mt-0.5 ${dm ? 'text-gray-500' : 'text-gray-400'}`}>No scored applicants yet</p>
              )}
            </div>
          </div>
        </div>

        {/* Quick actions — 6-button grid matching design */}
        <div className={`rounded-xl border p-6 mb-8 ${dm ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
          <h2 className={`text-base font-semibold mb-4 ${dm ? 'text-white' : 'text-gray-900'}`}>Quick Actions</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <button
              onClick={() => onNavigate('post-job')}
              className="flex items-center gap-3 px-4 py-3 bg-[#1d4ed8] text-white rounded-lg hover:bg-[#1a45c9] text-sm font-medium transition-colors"
            >
              <Plus className="w-5 h-5" />
              <span>Post a Job</span>
            </button>
            <button
              onClick={() => onNavigate('job-listings')}
              className={`flex items-center gap-3 px-4 py-3 border rounded-lg text-sm font-medium transition-colors ${
                dm ? 'border-gray-600 text-gray-300 hover:bg-gray-700' : 'border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
            >
              <Users className="w-5 h-5" />
              <span>View Applicants</span>
            </button>
            <button
              onClick={() => onNavigate('talent-pool')}
              className={`flex items-center gap-3 px-4 py-3 border rounded-lg text-sm font-medium transition-colors ${
                dm ? 'border-gray-600 text-gray-300 hover:bg-gray-700' : 'border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
            >
              <Users className="w-5 h-5" />
              <span>Discover Talent</span>
            </button>
            <button
              onClick={() => onNavigate('company-profile')}
              className={`flex items-center gap-3 px-4 py-3 border rounded-lg text-sm font-medium transition-colors ${
                dm ? 'border-gray-600 text-gray-300 hover:bg-gray-700' : 'border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
            >
              <User className="w-5 h-5" />
              <span>Organization Profile</span>
            </button>
            <button
              onClick={() => onNavigate('billing')}
              className={`flex items-center gap-3 px-4 py-3 border rounded-lg text-sm font-medium transition-colors ${
                dm ? 'border-gray-600 text-gray-300 hover:bg-gray-700' : 'border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
            >
              <CreditCard className="w-5 h-5" />
              <span>Billing &amp; Plan</span>
            </button>
            <button
              onClick={() => onNavigate('agency-hub')}
              className={`flex items-center gap-3 px-4 py-3 border rounded-lg text-sm font-medium transition-colors ${
                dm ? 'border-gray-600 text-gray-300 hover:bg-gray-700' : 'border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
            >
              <Building2 className="w-5 h-5" />
              <span>Agency Hub</span>
            </button>
          </div>
        </div>

        {/* Job Overview + Action Required — lg:col-span-2 + 1 layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Job Overview — derived from live jobPostings */}
          <div className={`lg:col-span-2 rounded-xl border p-6 ${dm ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
            <h2 className={`text-lg font-semibold mb-4 ${dm ? 'text-white' : 'text-gray-900'}`}>Job Overview</h2>
            {jobPostings.length === 0 ? (
              <p className={`text-sm ${dm ? 'text-gray-400' : 'text-gray-500'}`}>No job postings yet.</p>
            ) : (() => {
              const active = jobPostings.filter((j) => j.is_active);
              const topPerformer = [...active].sort((a, b) => b.applicant_count - a.applicant_count)[0];
              const lowActivity = [...active].sort((a, b) => a.applicant_count - b.applicant_count)[0];
              const expiringSoon = [...active].sort(
                (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
              )[0];
              const highlights = [
                topPerformer && {
                  category: 'Top performing job',
                  jobTitle: topPerformer.title,
                  metric: `${topPerformer.applicant_count} applicant${topPerformer.applicant_count !== 1 ? 's' : ''}`,
                },
                lowActivity && lowActivity.id !== topPerformer?.id && {
                  category: 'Low activity job',
                  jobTitle: lowActivity.title,
                  metric: `${lowActivity.applicant_count} applicant${lowActivity.applicant_count !== 1 ? 's' : ''}`,
                },
                expiringSoon && {
                  category: 'Oldest active posting',
                  jobTitle: expiringSoon.title,
                  metric: `Posted ${new Date(expiringSoon.created_at).toLocaleDateString()}`,
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
            <h2 className={`text-lg font-semibold mb-4 ${dm ? 'text-white' : 'text-gray-900'}`}>Action Required</h2>
            <div className="space-y-3">
              {[
                { message: 'Review new applicants', page: 'job-listings' as PortalPage, action: 'Review now' },
                { message: 'Complete your company profile', page: 'company-profile' as PortalPage, action: 'Go to profile' },
                { message: 'Check billing & plan', page: 'billing' as PortalPage, action: 'View plan' },
              ].map(({ message, page, action }) => (
                <div
                  key={page}
                  className={`flex items-center justify-between p-4 rounded-lg border ${
                    dm ? 'border-gray-700 bg-gray-700' : 'border-gray-200 bg-white'
                  }`}
                >
                  <p className={`text-sm ${dm ? 'text-gray-200' : 'text-gray-900'}`}>{message}</p>
                  <button
                    onClick={() => onNavigate(page)}
                    className="flex items-center gap-1 text-sm text-[#1d4ed8] font-medium ml-3 flex-shrink-0"
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
            Recent Job Postings
          </h2>

          {loading && (
            <p className={dm ? 'text-gray-400' : 'text-gray-500'}>Loading…</p>
          )}

          {error && !loading && (
            <p className="text-red-500 text-sm">{error}</p>
          )}

          {!loading && !error && jobPostings.length === 0 && (
            <div className="text-center py-10">
              <p className={`text-sm mb-4 ${dm ? 'text-gray-400' : 'text-gray-500'}`}>
                No job postings yet.
              </p>
              <button
                onClick={() => onNavigate('post-job')}
                className="px-5 py-2 bg-[#1d4ed8] text-white rounded-lg text-sm font-medium hover:bg-[#1a45c9] transition-colors"
              >
                Post your first job
              </button>
            </div>
          )}

          {!loading && !error && jobPostings.slice(0, 5).map((job) => (
            <div
              key={job.id}
              className={`flex items-center justify-between py-4 border-b last:border-0 ${
                dm ? 'border-gray-700' : 'border-gray-100'
              }`}
            >
              <div>
                <p className={`font-semibold text-sm ${dm ? 'text-white' : 'text-gray-900'}`}>{job.title}</p>
                <p className={`text-xs mt-0.5 ${dm ? 'text-gray-400' : 'text-gray-500'}`}>
                  {job.location} &bull; Posted {new Date(job.created_at).toLocaleDateString()}
                </p>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-center">
                  <p className="text-xl font-bold text-[#1d4ed8]">{job.applicant_count}</p>
                  <p className={`text-xs ${dm ? 'text-gray-400' : 'text-gray-500'}`}>applicants</p>
                </div>
                <span
                  className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                    job.is_active
                      ? 'bg-teal-50 text-teal-800 border border-teal-200'
                      : 'bg-gray-100 text-gray-600 border border-gray-200'
                  }`}
                >
                  {job.is_active ? 'Active' : 'Closed'}
                </span>
              </div>
            </div>
          ))}

          {!loading && jobPostings.length > 5 && (
            <button
              onClick={() => onNavigate('job-listings')}
              className={`mt-4 text-sm font-medium text-[#1d4ed8] hover:underline`}
            >
              See all {jobPostings.length} listings →
            </button>
          )}
        </div>
      </div>
    </>
  );
}
