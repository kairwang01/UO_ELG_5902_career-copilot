import React from 'react';
import { Briefcase, Users, TrendingUp, BarChart2 } from 'lucide-react';
import { PortalTopBar } from '../PortalTopBar';
import type { Database } from '../../../lib/supabaseClient';
import type { PortalPage } from '../PortalSidebar';

type JobPostingWithCount = Database['public']['Tables']['job_postings']['Row'] & {
  applicant_count: number;
};

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
          <KpiCard title="Avg Match Score" value={avgMatchScore > 0 ? `${avgMatchScore}%` : '—'} Icon={BarChart2} darkMode={dm} />
        </div>

        {/* Quick actions */}
        <div className={`rounded-xl border p-6 mb-8 ${dm ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
          <h2 className={`text-base font-semibold mb-4 ${dm ? 'text-white' : 'text-gray-900'}`}>Quick Actions</h2>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => onNavigate('post-job')}
              className="flex items-center gap-2 px-4 py-2 bg-[#1d4ed8] text-white rounded-lg hover:bg-[#1a45c9] text-sm font-medium transition-colors"
            >
              <Briefcase className="w-4 h-4" />
              Post a Job
            </button>
            <button
              onClick={() => onNavigate('talent-pool')}
              className={`flex items-center gap-2 px-4 py-2 border rounded-lg text-sm font-medium transition-colors ${
                dm ? 'border-gray-600 text-gray-300 hover:bg-gray-700' : 'border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
            >
              <Users className="w-4 h-4" />
              Discover Talent
            </button>
            <button
              onClick={() => onNavigate('job-listings')}
              className={`flex items-center gap-2 px-4 py-2 border rounded-lg text-sm font-medium transition-colors ${
                dm ? 'border-gray-600 text-gray-300 hover:bg-gray-700' : 'border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
            >
              <BarChart2 className="w-4 h-4" />
              View Listings
            </button>
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
