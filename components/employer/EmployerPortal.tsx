import React, { useState, useEffect, useCallback } from 'react';
import type { Session } from '@supabase/supabase-js';
import type { UserProfile } from '../../types';
import type { Database } from '../../lib/supabaseClient';
import { supabase } from '../../lib/supabaseClient';
import { data } from '../../lib/data';
import ApplicantFunnel from '../ApplicantFunnel';
import { PortalSidebar, type PortalPage } from './PortalSidebar';
import { PortalTopBar } from './PortalTopBar';
import { PortalDashboard } from './pages/PortalDashboard';
import { PortalJobListings } from './pages/PortalJobListings';
import { PortalPostJob } from './pages/PortalPostJob';
import { PortalTalentPool } from './pages/PortalTalentPool';
import { PortalOrgProfile } from './pages/PortalOrgProfile';
import { PortalAccountSettings } from './pages/PortalAccountSettings';
import { PortalBilling } from './pages/PortalBilling';

type JobPosting = Database['public']['Tables']['job_postings']['Row'];
type JobPostingWithCount = JobPosting & { applicant_count: number };

interface KpiData {
  activeJobs: number;
  totalApplicants: number;
  newApplicants: number;
  avgMatchScore: number;
}

interface EmployerPortalProps {
  session: Session;
  profile: UserProfile;
  refreshProfile: () => Promise<void>;
  navigateToBusinessPricing: () => void;
  onGoHome: () => void;
  t: (key: string) => string;
  initialPage?: PortalPage;
  isAIMode: boolean;
  onToggleAIMode: () => void;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  currentLang: string;
  onLanguageChange: (lang: string) => void;
}

export const EmployerPortal: React.FC<EmployerPortalProps> = ({
  session,
  profile,
  refreshProfile,
  navigateToBusinessPricing,
  onGoHome,
  t,
  initialPage = 'dashboard',
  isAIMode,
  onToggleAIMode,
  theme,
  onToggleTheme,
  currentLang,
  onLanguageChange,
}) => {
  const [currentPage, setCurrentPage] = useState<PortalPage>(initialPage);
  const darkMode = theme === 'dark';

  const [jobPostings, setJobPostings] = useState<JobPostingWithCount[]>([]);
  const [kpiData, setKpiData] = useState<KpiData>({ activeJobs: 0, totalApplicants: 0, newApplicants: 0, avgMatchScore: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // For edit-job flow: which job to edit, back to which page
  const [jobToEdit, setJobToEdit] = useState<JobPostingWithCount | null>(null);
  // For applicant funnel
  const [jobForFunnel, setJobForFunnel] = useState<JobPosting | null>(null);
  // Previous page before entering post-job/funnel views
  const [prevPage, setPrevPage] = useState<PortalPage>('dashboard');

  // Keep page in sync when initialPage changes (deep-link from homepage)
  useEffect(() => {
    setCurrentPage(initialPage);
  }, [initialPage]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: jobsWithCounts, error: jobsError } = await supabase
        .from('job_postings')
        .select('*, job_applications(count)')
        .eq('employer_id', session.user.id)
        .order('created_at', { ascending: false });

      if (jobsError) throw jobsError;

      if (!jobsWithCounts || jobsWithCounts.length === 0) {
        setJobPostings([]);
        setKpiData({ activeJobs: 0, totalApplicants: 0, newApplicants: 0, avgMatchScore: 0 });
        setLoading(false);
        return;
      }

      const formatted: JobPostingWithCount[] = jobsWithCounts.map((job) => ({
        ...job,
        applicant_count: Array.isArray(job.job_applications) ? job.job_applications[0]?.count ?? 0 : 0,
      }));
      setJobPostings(formatted);

      // KPI details
      try {
        const jobIds = jobsWithCounts.map((j) => j.id);
        const { data: allApps, error: appsError } = await supabase
          .from('job_applications')
          .select('application_date, compatibility_score')
          .in('job_id', jobIds);

        if (appsError) throw appsError;

        const activeJobs = jobsWithCounts.filter((j) => j.is_active).length;
        const totalApplicants = allApps?.length || 0;

        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - 7);
        const newApplicants = allApps?.filter((a) => new Date(a.application_date) >= cutoff).length || 0;

        const scored = allApps?.filter((a) => a.compatibility_score !== null) || [];
        const avgMatchScore = scored.length > 0
          ? Math.round(scored.reduce((s, a) => s + (a.compatibility_score ?? 0), 0) / scored.length)
          : 0;

        setKpiData({ activeJobs, totalApplicants, newApplicants, avgMatchScore });
      } catch {
        // KPI fetch failed — derive from job list
        const activeJobs = jobsWithCounts.filter((j) => j.is_active).length;
        const totalApplicants = formatted.reduce((s, j) => s + j.applicant_count, 0);
        setKpiData({ activeJobs, totalApplicants, newApplicants: 0, avgMatchScore: 0 });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data.');
    } finally {
      setLoading(false);
    }
  }, [session.user.id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const navigate = (page: PortalPage) => {
    // Clear edit/funnel state when navigating via sidebar
    setJobToEdit(null);
    setJobForFunnel(null);
    setCurrentPage(page);
  };

  const handleEditJob = (job: JobPostingWithCount) => {
    setJobToEdit(job);
    setPrevPage(currentPage);
    setCurrentPage('post-job');
  };

  const handleViewApplicants = (job: JobPostingWithCount) => {
    setJobForFunnel(job);
    setPrevPage(currentPage);
  };

  const handlePostJobSaved = async () => {
    await fetchData();
    setJobToEdit(null);
    navigate('job-listings');
  };

  const handlePostJobCancel = () => {
    setJobToEdit(null);
    setCurrentPage(prevPage);
  };

  const handleSelectPlan = async (planKey: string) => {
    const { error } = await data.profiles.update(session.user.id, {
      subscription_status: `pending_biz_${planKey}`,
    });
    if (error) { console.error('Failed to update plan:', error.message); return; }
    await refreshProfile();
  };

  const getPageTitle = () => {
    switch (currentPage) {
      case 'dashboard': return 'Dashboard';
      case 'post-job': return jobToEdit ? 'Edit Job Posting' : 'Post a Job';
      case 'job-listings': return 'My Job Listings';
      case 'talent-pool': return 'Discover Talent';
      case 'agency-hub': return 'Agency Hub';
      case 'company-profile': return 'Organization Profile';
      case 'account-settings': return 'Account Settings';
      case 'billing': return 'Billing & Plan';
      default: return 'Dashboard';
    }
  };

  // Applicant funnel takes over the whole main area
  if (jobForFunnel) {
    return (
      <div className={`flex h-screen ${darkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
        <PortalSidebar
          currentPage={prevPage}
          onNavigate={navigate}
          onGoHome={onGoHome}
          profile={profile}
          darkMode={darkMode}
          onToggleDark={onToggleTheme}
          isAIMode={isAIMode}
          onToggleAIMode={onToggleAIMode}
          currentLang={currentLang}
          onLanguageChange={onLanguageChange}
        />
        <main className="flex-1 overflow-y-auto">
          <PortalTopBar title={`Applicants — ${jobForFunnel.title}`} darkMode={darkMode} />
          <div className="max-w-[1088px] mx-auto p-8">
            <ApplicantFunnel
              job={jobForFunnel}
              onBack={() => { setJobForFunnel(null); setCurrentPage(prevPage); }}
              t={t}
            />
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className={`flex h-screen ${darkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
      <PortalSidebar
        currentPage={currentPage}
        onNavigate={navigate}
        onGoHome={onGoHome}
        profile={profile}
        darkMode={darkMode}
        onToggleDark={onToggleTheme}
        isAIMode={isAIMode}
        onToggleAIMode={onToggleAIMode}
        currentLang={currentLang}
        onLanguageChange={onLanguageChange}
      />

      <main className="flex-1 overflow-y-auto">
        {currentPage === 'dashboard' && (
          <PortalDashboard
            jobPostings={jobPostings}
            kpiData={kpiData}
            loading={loading}
            error={error}
            darkMode={darkMode}
            onNavigate={navigate}
            companyName={profile.company_name || ''}
          />
        )}

        {currentPage === 'post-job' && (
          <PortalPostJob
            session={session}
            profile={profile}
            darkMode={darkMode}
            existingJob={jobToEdit}
            onSaved={handlePostJobSaved}
            onCancel={handlePostJobCancel}
            t={t}
          />
        )}

        {currentPage === 'job-listings' && (
          <PortalJobListings
            jobPostings={jobPostings}
            kpiData={kpiData}
            loading={loading}
            error={error}
            darkMode={darkMode}
            onEditJob={handleEditJob}
            onViewApplicants={handleViewApplicants}
            onNavigate={navigate}
          />
        )}

        {currentPage === 'talent-pool' && (
          <PortalTalentPool
            profile={profile}
            darkMode={darkMode}
            navigateToBusinessPricing={navigateToBusinessPricing}
            t={t}
          />
        )}

        {currentPage === 'agency-hub' && (
          <>
            <PortalTopBar title="Agency Hub" darkMode={darkMode} />
            <div className="max-w-[1088px] mx-auto p-8">
              <p className={darkMode ? 'text-gray-400' : 'text-gray-600'}>Coming soon.</p>
            </div>
          </>
        )}

        {currentPage === 'company-profile' && (
          <PortalOrgProfile
            session={session}
            profile={profile}
            darkMode={darkMode}
            onSaved={refreshProfile}
            t={t}
          />
        )}

        {currentPage === 'account-settings' && (
          <PortalAccountSettings
            session={session}
            darkMode={darkMode}
            onSubscriptionChange={refreshProfile}
            navigateToPricing={navigateToBusinessPricing}
            t={t}
          />
        )}

        {currentPage === 'billing' && (
          <PortalBilling
            profile={profile}
            darkMode={darkMode}
            activeJobs={kpiData.activeJobs}
            onSelectPlan={handleSelectPlan}
            navigateToBusinessPricing={navigateToBusinessPricing}
            t={t}
          />
        )}
      </main>
    </div>
  );
};

export type { PortalPage };
