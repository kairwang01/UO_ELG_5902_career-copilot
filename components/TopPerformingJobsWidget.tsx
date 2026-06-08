import React from 'react';
import type { JobPostingWithCount } from '../lib/recruitingData';

interface TopPerformingJobsWidgetProps {
    jobs: JobPostingWithCount[];
    t: (key: string) => string;
}

const TopPerformingJobsWidget: React.FC<TopPerformingJobsWidgetProps> = ({ jobs, t }) => {
    const topJobs = [...jobs]
        .sort((a, b) => b.applicant_count - a.applicant_count)
        .slice(0, 5);

    return (
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm h-full">
            <h3 className="text-lg font-bold text-gray-800 mb-4">{t('widget_top_jobs_title')}</h3>
            {topJobs.length > 0 ? (
                <div className="space-y-4">
                    {topJobs.map(job => (
                        <div key={job.id}>
                            <div className="flex justify-between items-center text-sm mb-1">
                                <p className="font-semibold text-gray-800 truncate">{job.title}</p>
                                <p className="font-bold text-blue-600">{job.applicant_count} {t('widget_top_jobs_applicants')}</p>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2">
                                <div className="bg-blue-600 h-2 rounded-full" style={{ width: `${(job.applicant_count / (topJobs[0].applicant_count || 1)) * 100}%` }}></div>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <p className="text-sm text-gray-500 text-center mt-8">{t('widget_top_jobs_placeholder')}</p>
            )}
        </div>
    );
};

export default TopPerformingJobsWidget;
