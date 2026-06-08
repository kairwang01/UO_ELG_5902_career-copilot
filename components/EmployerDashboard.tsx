import React, { useState, useEffect, useCallback } from 'react';
import type { AppSession as Session } from '../lib/data';
import type { UserProfile } from '../types';
import JobPostForm from './JobPostForm';
import CompanyProfileForm from './CompanyProfileForm';
import CompanyLogo from './CompanyLogo';
import ApplicantFunnel from './ApplicantFunnel';
import TalentDiscovery from './TalentDiscovery';
import EmployerKPIs from './EmployerKPIs';
import TopPerformingJobsWidget from './TopPerformingJobsWidget';
import {
    listApplicationsForJobs,
    listEmployerJobsWithCounts,
    type JobPosting,
    type JobPostingWithCount,
} from '../lib/recruitingData';

interface EmployerDashboardProps {
    session: Session;
    profile: UserProfile;
    refreshProfile: () => Promise<void>;
    navigateToBusinessPricing: () => void;
    t: (key: string) => string;
}

const EmployerDashboard: React.FC<EmployerDashboardProps> = ({ session, profile, refreshProfile, navigateToBusinessPricing, t }) => {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [jobPostings, setJobPostings] = useState<JobPostingWithCount[]>([]);
    const [kpiData, setKpiData] = useState({ activeJobs: 0, totalApplicants: 0, newApplicants: 0, avgMatchScore: 0 });
    
    const [activeTab, setActiveTab] = useState<'dashboard' | 'discover'>('dashboard');
    const [currentView, setCurrentView] = useState<'dashboard' | 'funnel'>('dashboard');
    const [selectedJob, setSelectedJob] = useState<JobPosting | null>(null);

    const [modal, setModal] = useState<'none' | 'post_job' | 'edit_job' | 'edit_profile'>('none');
    const [jobForModal, setJobForModal] = useState<JobPosting | null>(null);

    const fetchDashboardData = useCallback(async () => {
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

            const formattedJobs: JobPostingWithCount[] = jobsWithCounts;
            setJobPostings(formattedJobs);
            
            try {
                const jobIds = jobsWithCounts.map(j => j.id);
                const allApplications = await listApplicationsForJobs(jobIds);

                const totalApplicants = allApplications.length || 0;
                const activeJobs = jobsWithCounts.filter(job => job.is_active).length;

                const sevenDaysAgo = new Date();
                sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
                const newApplicants = allApplications.filter(app => new Date(app.application_date) >= sevenDaysAgo).length || 0;
                
                const scoredApplications = allApplications.filter(app => app.compatibility_score !== null) || [];
                let avgMatchScore = 0;
                if (scoredApplications.length > 0) {
                    const totalScore = scoredApplications.reduce((sum, app) => sum + (app.compatibility_score!), 0);
                    avgMatchScore = Math.round(totalScore / scoredApplications.length);
                }
                
                setKpiData({ activeJobs, totalApplicants, newApplicants, avgMatchScore });

            } catch (kpiError) {
                console.warn("Could not load KPI data, but the job list is available:", kpiError);
                // Set KPIs to what we can calculate, but don't throw an error for the whole page.
                const activeJobs = jobsWithCounts.filter(job => job.is_active).length;
                const totalApplicants = formattedJobs.reduce((sum, job) => sum + job.applicant_count, 0);
                setKpiData({ activeJobs, totalApplicants, newApplicants: 0, avgMatchScore: 0 });
            }

        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to load dashboard data.");
        } finally {
            setLoading(false);
        }
    }, [session.user.id]);

    useEffect(() => {
        fetchDashboardData();
    }, [fetchDashboardData]);

    const handleViewApplicants = (job: JobPosting) => {
        setSelectedJob(job);
        setCurrentView('funnel');
    };
    
    const hasActiveSubscription = profile.subscription_status && !profile.subscription_status.startsWith('pending') && profile.subscription_status !== 'free';

    const renderDashboardOverview = () => {
         if (loading) return <div className="text-center p-8">{t('employer_dashboard_loading')}</div>;
         if (error) return <div className="bg-red-100 p-4 text-red-700 rounded-md">{error}</div>;

         return (
             <div className="space-y-6">
                 <EmployerKPIs data={kpiData} t={t} />
                 <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                     <div className="lg:col-span-2 space-y-4">
                         <h3 className="text-xl font-bold text-gray-800">{t('employer_dashboard_overview_title')}</h3>
                         {jobPostings.length === 0 ? (
                            <div className="text-center py-16 border-2 border-dashed border-gray-300 rounded-lg">
                                <h3 className="text-xl font-semibold text-gray-800">{t('employer_dashboard_welcome_title')}</h3>
                                <p className="mt-2 text-gray-500">{t('employer_dashboard_welcome_desc')}</p>
                                <button onClick={() => setModal('post_job')} className="mt-6 bg-blue-700 text-white font-bold py-2.5 px-6 rounded-lg shadow-md hover:bg-blue-800">
                                    {t('employer_dashboard_post_first_job_button')}
                                </button>
                            </div>
                         ) : (
                            jobPostings.map(job => (
                                <div key={job.id} className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm flex items-center justify-between flex-wrap gap-4">
                                    <div>
                                        <p className="font-bold text-lg text-gray-800">{job.title}</p>
                                        <p className="text-sm text-gray-500">{job.location} &bull; {t('employer_dashboard_posted_on')} {new Date(job.created_at).toLocaleDateString()}</p>
                                    </div>
                                    <div className="flex items-center gap-6">
                                        <button onClick={() => handleViewApplicants(job)} className="text-center group">
                                            <p className="text-2xl font-bold text-blue-600 group-hover:text-blue-800">{job.applicant_count}</p>
                                            <p className="text-xs text-gray-500 font-semibold group-hover:underline">{t('employer_dashboard_applicants_label')}</p>
                                        </button>
                                        <div className="flex items-center gap-2">
                                            <button onClick={() => { setJobForModal(job); setModal('edit_job'); }} className="text-sm py-2 px-4 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200">{t('employer_dashboard_edit_button')}</button>
                                        </div>
                                    </div>
                                </div>
                            ))
                         )}
                     </div>
                     <div className="lg:col-span-1 space-y-4">
                         <TopPerformingJobsWidget jobs={jobPostings} t={t} />
                     </div>
                 </div>
             </div>
         );
    };

    const renderCurrentView = () => {
        if (currentView === 'funnel' && selectedJob) {
            return <ApplicantFunnel job={selectedJob} onBack={() => { setCurrentView('dashboard'); setSelectedJob(null); }} t={t} />;
        }

        switch (activeTab) {
            case 'dashboard':
                return renderDashboardOverview();
            case 'discover':
                return <TalentDiscovery t={t} profile={profile} navigateToBusinessPricing={navigateToBusinessPricing} />;
            default:
                return renderDashboardOverview();
        }
    };

    return (
        <div className="animate-fade-in space-y-8">
            {modal === 'post_job' && <JobPostForm session={session} profile={profile} onClose={() => setModal('none')} onPostCreated={fetchDashboardData} t={t} />}
            {modal === 'edit_job' && jobForModal && <JobPostForm session={session} profile={profile} existingJob={jobForModal} onClose={() => setModal('none')} onPostCreated={fetchDashboardData} t={t} />}
            {modal === 'edit_profile' && <CompanyProfileForm session={session} existingProfile={profile} onClose={() => setModal('none')} onSave={refreshProfile} t={t} />}
            
            <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                 <div className="flex items-center gap-4">
                    <CompanyLogo url={profile.company_logo_url || null} size={64} />
                    <div>
                        <h1 className="text-3xl font-extrabold text-gray-900">{profile.company_name || "Your Company"}</h1>
                        <p className="text-gray-600">{t('employer_dashboard_title')}</p>
                    </div>
                </div>
                <div className="flex-shrink-0 flex items-center gap-3">
                    <button onClick={() => setModal('edit_profile')} className="font-semibold text-sm py-2 px-4 border border-gray-300 rounded-lg hover:bg-gray-100">{t('employer_dashboard_company_profile_button')}</button>
                    <button onClick={() => setModal('post_job')} className="font-bold text-sm text-white py-2 px-4 bg-blue-700 rounded-lg shadow-sm hover:bg-blue-800">{t('employer_dashboard_post_job_button')}</button>
                </div>
            </header>

            {!hasActiveSubscription && (
                <div className="p-4 bg-yellow-50 border-l-4 border-yellow-400 text-yellow-800">
                    <h4 className="font-bold">{t('employer_dashboard_subscription_inactive_title')}</h4>
                    <p>{t('employer_dashboard_subscription_inactive_desc')}</p>
                    <button onClick={navigateToBusinessPricing} className="mt-2 text-sm font-semibold underline">{t('employer_dashboard_view_plans_button')}</button>
                </div>
            )}
            
            <main>
                {currentView === 'dashboard' && (
                    <div className="border-b border-gray-200 mb-6">
                        <nav className="-mb-px flex space-x-6" aria-label="Tabs">
                            <button onClick={() => setActiveTab('dashboard')} className={`whitespace-nowrap py-3 px-1 border-b-2 font-semibold text-base ${activeTab === 'dashboard' ? 'border-blue-700 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-800'}`}>
                                {t('employer_dashboard_tab_dashboard')}
                            </button>
                             <button onClick={() => setActiveTab('discover')} className={`whitespace-nowrap py-3 px-1 border-b-2 font-semibold text-base ${activeTab === 'discover' ? 'border-blue-700 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-800'}`}>
                                {t('employer_dashboard_tab_discover')}
                            </button>
                        </nav>
                    </div>
                )}
                {renderCurrentView()}
            </main>
        </div>
    );
};

export default EmployerDashboard;
