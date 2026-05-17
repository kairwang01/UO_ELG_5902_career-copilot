import React from 'react';

interface VerifiedTalentSectionProps {
    t: (key: string) => string;
}

interface BenefitCardProps {
    icon: React.ReactNode;
    title: string;
    description: string;
}

const BenefitCard: React.FC<BenefitCardProps> = ({ icon, title, description }) => (
    <div className="flex items-start space-x-4">
        <div className="flex-shrink-0 bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-400 rounded-lg p-3">
            {icon}
        </div>
        <div>
            <h4 className="font-bold text-lg text-gray-900 dark:text-gray-100">{title}</h4>
            <p className="mt-1 text-gray-600 dark:text-gray-400">{description}</p>
        </div>
    </div>
);


const VerifiedTalentSection: React.FC<VerifiedTalentSectionProps> = ({ t }) => {
    return (
        <section className="py-16 md:py-24 bg-gray-50 dark:bg-slate-900/50">
            <div className="max-w-6xl mx-auto px-4 sm:px-6">
                <div className="text-center mb-12 animate-slide-in-up">
                    <h2 className="text-3xl md:text-4xl font-extrabold text-gray-900 dark:text-gray-100 tracking-tight">
                        {t('verified_talent_section_title')}
                    </h2>
                    <p className="mt-4 text-lg text-gray-600 dark:text-gray-400 max-w-3xl mx-auto">
                        {t('verified_talent_section_subtitle')}
                    </p>
                </div>
                
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                    {/* For Candidates */}
                    <div className="bg-white dark:bg-slate-800 p-8 rounded-xl border border-gray-200/80 dark:border-slate-700/80 shadow-lg space-y-6 animate-slide-in-up" style={{ animationDelay: '100ms' }}>
                        <h3 className="text-2xl font-bold text-center text-blue-700 dark:text-blue-400">{t('verified_talent_section_candidates_title')}</h3>
                        <div className="space-y-6">
                             <BenefitCard 
                                icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v.01" /></svg>}
                                title={t('verified_talent_section_candidates_benefit1_title')}
                                description={t('verified_talent_section_candidates_benefit1_desc')}
                            />
                            <BenefitCard 
                                icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" /></svg>}
                                title={t('verified_talent_section_candidates_benefit2_title')}
                                description={t('verified_talent_section_candidates_benefit2_desc')}
                            />
                            <BenefitCard 
                                icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>}
                                title={t('verified_talent_section_candidates_benefit3_title')}
                                description={t('verified_talent_section_candidates_benefit3_desc')}
                            />
                        </div>
                    </div>
                     {/* For Employers */}
                    <div className="bg-white dark:bg-slate-800 p-8 rounded-xl border border-gray-200/80 dark:border-slate-700/80 shadow-lg space-y-6 animate-slide-in-up" style={{ animationDelay: '200ms' }}>
                        <h3 className="text-2xl font-bold text-center text-green-700 dark:text-green-400">{t('verified_talent_section_employers_title')}</h3>
                         <div className="space-y-6">
                             <BenefitCard 
                                icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" /></svg>}
                                title={t('verified_talent_section_employers_benefit1_title')}
                                description={t('verified_talent_section_employers_benefit1_desc')}
                            />
                            <BenefitCard 
                                icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0A5.002 5.002 0 0115 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>}
                                title={t('verified_talent_section_employers_benefit2_title')}
                                description={t('verified_talent_section_employers_benefit2_desc')}
                            />
                            <BenefitCard 
                                icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 20.417l4.5-4.5M12 14a4 4 0 100-8 4 4 0 000 8z" /></svg>}
                                title={t('verified_talent_section_employers_benefit3_title')}
                                description={t('verified_talent_section_employers_benefit3_desc')}
                            />
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
};

export default VerifiedTalentSection;
