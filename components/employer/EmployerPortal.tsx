import React, { useState, useEffect, useCallback, useRef } from 'react';
import type { AppSession as Session } from '../../lib/data';
import type { UserProfile } from '../../types';
import { data } from '../../lib/data';
import AgencyHub from '../AgencyHub';
import ApplicantFunnel from '../ApplicantFunnel';
import { PortalSidebar, type PortalPage } from './PortalSidebar';
import { PortalTopBar } from './PortalTopBar';
import { PortalAccountMenuProvider } from './PortalAccountMenuContext';
import { PortalDashboard } from './pages/PortalDashboard';
import { PortalJobListings } from './pages/PortalJobListings';
import { PortalPostJob } from './pages/PortalPostJob';
import { PortalTalentPool } from './pages/PortalTalentPool';
import { PortalOrgProfile } from './pages/PortalOrgProfile';
import { PortalAccountSettings } from './pages/PortalAccountSettings';
import { PortalBilling } from './pages/PortalBilling';
import { PortalShortlist } from './pages/PortalShortlist';
import {
  listApplicationsForJobs,
  listEmployerJobsWithCounts,
  type JobPosting,
  type JobPostingWithCount,
} from '../../lib/recruitingData';
import { useToast } from '../Toast';

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
  onSignOut: () => void;
  t: (key: string) => string;
  initialPage?: PortalPage;
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
  onSignOut,
  t,
  initialPage = 'dashboard',
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
  const [planSaving, setPlanSaving] = useState(false);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const { addToast } = useToast();
  const mainRef = useRef<HTMLElement | null>(null);
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
      const jobsWithCounts = await listEmployerJobsWithCounts(session.user.id);

      if (jobsWithCounts.length === 0) {
        setJobPostings([]);
        setKpiData({ activeJobs: 0, totalApplicants: 0, newApplicants: 0, avgMatchScore: 0 });
        setLoading(false);
        return;
      }

      const formatted: JobPostingWithCount[] = jobsWithCounts;
      setJobPostings(formatted);

      // KPI details
      try {
        const jobIds = jobsWithCounts.map((j) => j.id);
        const allApps = await listApplicationsForJobs(jobIds, session.user.id);

        const activeJobs = jobsWithCounts.filter((j) => j.is_active).length;
        const totalApplicants = allApps.length || 0;

        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - 7);
        const newApplicants = allApps.filter((a) => new Date(a.application_date) >= cutoff).length || 0;

        const scored = allApps.filter((a) => a.compatibility_score !== null) || [];
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

  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0, behavior: 'auto' });
  }, [currentPage, jobForFunnel?.id]);

  const navigate = (page: PortalPage) => {
    // Clear edit/funnel state when navigating via sidebar
    setJobToEdit(null);
    setJobForFunnel(null);
    setIsMobileNavOpen(false);
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
    addToast(jobToEdit ? t('portal_toast_job_updated') : t('portal_toast_job_posted'), 'success');
    await fetchData();
    setJobToEdit(null);
    navigate('job-listings');
  };

  const handlePostJobCancel = () => {
    setJobToEdit(null);
    setCurrentPage(prevPage);
  };

  const handleSelectPlan = async (planKey: string) => {
    if (planSaving) return;
    setPlanSaving(true);
    try {
      const { error } = await data.profiles.update(session.user.id, {
        subscription_status: `pending_biz_${planKey}`,
      });
      if (error) {
        addToast(t('portal_toast_plan_update_failed').replace('{error}', error.message), 'error');
        return;
      }
      await refreshProfile();
      addToast(t('portal_toast_plan_updated'), 'success');
    } finally {
      setPlanSaving(false);
    }
  };

  const getPageTitle = () => {
    switch (currentPage) {
      case 'dashboard': return t('portal_nav_dashboard');
      case 'post-job': return jobToEdit ? t('portal_title_edit_job') : t('portal_nav_post_job');
      case 'job-listings': return t('portal_nav_job_listings');
      case 'talent-pool': return t('portal_nav_discover');
      case 'shortlist': return t('portal_nav_shortlist');
      case 'agency-hub': return t('portal_nav_agency_hub');
      case 'company-profile': return t('portal_nav_org_profile');
      case 'account-settings': return t('portal_nav_account');
      case 'billing': return t('portal_nav_billing');
      default: return t('portal_nav_dashboard');
    }
  };

  // Shared props for the AccountMenu rendered in every PortalTopBar
  const accountMenuProps = {
    profile,
    email: session.user.email ?? '',
    theme,
    onToggleTheme,
    onAccount: () => navigate('account-settings'),
    onSignOut,
    t,
    onOpenMobileNav: () => setIsMobileNavOpen(true),
  };

  const sidebarProps = {
    onNavigate: navigate,
    onGoHome,
    profile,
    darkMode,
    onToggleDark: onToggleTheme,
    currentLang,
    onLanguageChange,
    t,
  };

  // Slide-over nav for narrow screens — the sidebar itself is hidden below lg.
  const renderMobileNavDrawer = (page: PortalPage) =>
    isMobileNavOpen ? (
      <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label={t('portal_open_navigation')}>
        <div
          className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in"
          onClick={() => setIsMobileNavOpen(false)}
          aria-hidden="true"
        />
        <div className="absolute inset-y-0 left-0 animate-slide-in-left">
          <PortalSidebar {...sidebarProps} currentPage={page} mobile />
        </div>
      </div>
    ) : null;

  // Applicant funnel takes over the whole main area
  if (jobForFunnel) {
    return (
      <PortalAccountMenuProvider value={accountMenuProps}>
        <div className={`flex h-screen w-full ${darkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
          <PortalSidebar {...sidebarProps} currentPage={prevPage} />
          {renderMobileNavDrawer(prevPage)}
          <main ref={mainRef} className="flex-1 overflow-y-auto">
            <PortalTopBar title={`${t('portal_title_applicants_for')} — ${jobForFunnel.title}`} darkMode={darkMode} />
            <div className="max-w-[1088px] mx-auto p-8 animate-view-fade">
              <ApplicantFunnel
                job={jobForFunnel}
                onBack={() => { setJobForFunnel(null); setCurrentPage(prevPage); }}
                t={t}
              />
            </div>
          </main>
        </div>
      </PortalAccountMenuProvider>
    );
  }

  return (
    <PortalAccountMenuProvider value={accountMenuProps}>
      <div className={`flex h-screen w-full ${darkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
        <PortalSidebar {...sidebarProps} currentPage={currentPage} />
        {renderMobileNavDrawer(currentPage)}

        <main ref={mainRef} className="flex-1 overflow-y-auto">
          {currentPage === 'dashboard' && (
            <PortalDashboard
              jobPostings={jobPostings}
              kpiData={kpiData}
              loading={loading}
              error={error}
              darkMode={darkMode}
              onNavigate={navigate}
              companyName={profile.company_name || ''}
              t={t}
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
              t={t}
            />
          )}

          {currentPage === 'talent-pool' && (
            <PortalTalentPool
              profile={profile}
              darkMode={darkMode}
              onPostJob={() => navigate('post-job')}
              onOpenShortlist={() => navigate('shortlist')}
              navigateToBusinessPricing={navigateToBusinessPricing}
              t={t}
            />
          )}

          {currentPage === 'shortlist' && (
            <PortalShortlist
              session={session}
              darkMode={darkMode}
              t={t}
              onNavigate={navigate}
            />
          )}

          {currentPage === 'agency-hub' && (
            <>
              <PortalTopBar title={t('portal_nav_agency_hub')} darkMode={darkMode} />
              <div className={`max-w-[1088px] mx-auto p-8 animate-view-fade ${darkMode ? 'text-white' : ''}`}>
                <AgencyHub session={session} profile={profile} t={t} />
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
              planSaving={planSaving}
              navigateToBusinessPricing={navigateToBusinessPricing}
              t={t}
            />
          )}
        </main>
      </div>
    </PortalAccountMenuProvider>
  );
};

export type { PortalPage };
