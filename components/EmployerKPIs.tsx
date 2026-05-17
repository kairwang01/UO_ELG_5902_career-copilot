import React from 'react';

interface KPIsProps {
    data: {
        activeJobs: number;
        totalApplicants: number;
        newApplicants: number;
        avgMatchScore: number;
    };
    t: (key: string) => string;
}

const KPICard: React.FC<{ title: string; value: string; icon: React.ReactNode; }> = ({ title, value, icon }) => (
    <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex items-center gap-4">
        <div className="bg-blue-100 text-blue-600 rounded-full p-3">
            {icon}
        </div>
        <div>
            <p className="text-2xl font-bold text-gray-900">{value}</p>
            <p className="text-sm font-medium text-gray-500">{title}</p>
        </div>
    </div>
);

const EmployerKPIs: React.FC<KPIsProps> = ({ data, t }) => {
    const { activeJobs, totalApplicants, newApplicants, avgMatchScore } = data;

    const kpis = [
        {
            title: t('kpi_active_jobs'),
            value: activeJobs.toString(),
            icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
        },
        {
            title: t('kpi_total_applicants'),
            value: totalApplicants.toString(),
            icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
        },
        {
            title: t('kpi_new_applicants'),
            value: newApplicants.toString(),
            icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
        },
        {
            title: t('kpi_avg_match_score'),
            value: `${avgMatchScore}%`,
            icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
        }
    ];

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {kpis.map(kpi => <KPICard key={kpi.title} {...kpi} />)}
        </div>
    );
};

export default EmployerKPIs;
