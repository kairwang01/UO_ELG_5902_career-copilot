
import React, { useRef } from 'react';
import type { Session } from '@supabase/supabase-js';
import type { UserProfile } from '../types';

interface BusinessPageProps {
    onPostJobClick: () => void;
    onSignInClick: () => void;
    session: Session | null;
    profile: UserProfile | null;
    onSelectBusinessPlan: (planKey: string) => void;
    t: (key: string) => string;
    onBack: () => void;
}

const FeatureCard: React.FC<{ icon: React.ReactNode; title: string; description: string; }> = ({ icon, title, description }) => (
    <div className="flex flex-col items-start p-6 bg-white dark:bg-slate-800 rounded-xl border border-gray-200/80 dark:border-slate-700/80 shadow-sm transition-all duration-300 hover:shadow-lg hover:border-blue-300/50 dark:hover:border-blue-500/50 hover:-translate-y-1">
        <div className="flex-shrink-0 bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-400 p-3 rounded-full mb-4">
            {icon}
        </div>
        <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">{title}</h3>
        <p className="text-gray-600 dark:text-gray-400">{description}</p>
    </div>
);

const PricingCard: React.FC<{ title: string; price: string; description: string; features: string[]; isFeatured?: boolean; onSelect: () => void; }> = ({ title, price, description, features, isFeatured = false, onSelect }) => (
    <div className={`relative flex flex-col p-8 rounded-2xl border shadow-lg ${isFeatured ? 'bg-gray-900 dark:bg-slate-900 text-white border-blue-700 dark:border-blue-600' : 'bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100 border-gray-200 dark:border-slate-700'}`}>
        {isFeatured && <div className="absolute top-0 -translate-y-1/2 bg-gradient-to-r from-blue-600 to-indigo-700 px-4 py-1.5 text-sm font-semibold uppercase tracking-wider text-white rounded-full shadow-md">Most Popular</div>}
        <h3 className="text-xl font-bold">{title}</h3>
        <p className={`mt-2 text-sm ${isFeatured ? 'text-gray-300' : 'text-gray-600 dark:text-gray-400'}`}>{description}</p>
        <div className="mt-4 flex items-baseline">
            <span className="text-5xl font-extrabold tracking-tight">{price}</span>
        </div>
        <ul role="list" className="mt-8 space-y-4 text-sm leading-6">
            {features.map((feature, index) => (
                <li key={index} className="flex gap-x-3">
                    <svg xmlns="http://www.w3.org/2000/svg" className={`h-6 w-6 flex-none ${isFeatured ? 'text-blue-400' : 'text-blue-600 dark:text-blue-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                    <span>{feature}</span>
                </li>
            ))}
        </ul>
        <button onClick={onSelect} className={`mt-10 block w-full text-center rounded-lg px-6 py-3 text-sm font-semibold leading-6 shadow-sm transition-all duration-300 ${isFeatured ? 'bg-blue-600 text-white hover:bg-blue-500' : 'bg-white dark:bg-slate-700 text-blue-600 dark:text-white ring-1 ring-inset ring-blue-200 dark:ring-slate-600 hover:ring-blue-300 dark:hover:bg-slate-600'}`}>
            Get Started
        </button>
    </div>
);


const BusinessPage: React.FC<BusinessPageProps> = ({ onPostJobClick: onSelectPlan, onSignInClick, session, onSelectBusinessPlan, t, onBack }) => {
    
    const pricingSectionRef = useRef<HTMLDivElement>(null);

    const handleGetStarted = (planKey: string) => {
        if (session) {
            onSelectBusinessPlan(planKey);
        } else {
            onSelectPlan();
        }
    };
    
    return (
        <div className="animate-fade-in relative">
            {session && onBack && (
                <button 
                    onClick={onBack} 
                    className="absolute top-4 left-4 z-10 text-sm font-semibold text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-1 transition-colors bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm px-3 py-1.5 rounded-full border border-gray-200 dark:border-slate-700 shadow-sm"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                    Back to Dashboard
                </button>
            )}

            {/* Hero Section */}
            <section className="py-20 md:py-32 bg-gray-50 dark:bg-slate-900/50 rounded-lg">
                <div className="max-w-4xl mx-auto text-center">
                    <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tighter text-gray-900 dark:text-gray-100">
                        {t('business_hero_title_part1')} <span className="text-blue-700 dark:text-blue-500">{t('business_hero_title_part2')}</span>, {t('business_hero_title_part3')}.
                    </h1>
                    <p className="mt-6 text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
                        {t('business_hero_subtitle')}
                    </p>
                    <div className="mt-8">
                         {!session ? (
                            <div className="flex flex-col sm:flex-row gap-4 justify-center">
                                <button onClick={onSelectPlan} className="bg-blue-700 text-white font-bold py-3 px-8 rounded-lg shadow-lg hover:bg-blue-800 transition-all duration-300 ease-in-out transform hover:-translate-y-1">
                                    {t('business_hero_get_started_button')}
                                </button>
                                <button onClick={onSignInClick} className="bg-white dark:bg-slate-800 text-gray-800 dark:text-gray-200 font-bold py-3 px-8 rounded-lg shadow-md border border-gray-200 dark:border-slate-700 hover:bg-gray-100 dark:hover:bg-slate-700 hover:border-gray-300 dark:hover:border-slate-600 transition-all duration-300">
                                    {t('business_hero_signin_button')}
                                </button>
                            </div>
                        ) : (
                            <button onClick={() => pricingSectionRef.current?.scrollIntoView({ behavior: 'smooth' })} className="bg-blue-700 text-white font-bold py-3 px-8 rounded-lg shadow-lg hover:bg-blue-800 transition-all duration-300 ease-in-out transform hover:-translate-y-1">
                                {t('business_hero_view_pricing_button')}
                            </button>
                        )}
                    </div>
                </div>
            </section>

            {/* Features Section */}
            <section className="py-16 md:py-24">
                <div className="max-w-6xl mx-auto px-4 sm:px-6">
                    <div className="text-center mb-12">
                        <h2 className="text-3xl md:text-4xl font-extrabold text-gray-900 dark:text-gray-100 tracking-tight">{t('business_features_title')}</h2>
                        <p className="mt-4 text-lg text-gray-600 dark:text-gray-400 max-w-3xl mx-auto">{t('business_features_subtitle')}</p>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
                        <FeatureCard 
                            icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>}
                            title={t('business_feature_1_title')}
                            description={t('business_feature_1_desc')}
                        />
                         <FeatureCard 
                            icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>}
                            title={t('business_feature_2_title')}
                            description={t('business_feature_2_desc')}
                        />
                        <FeatureCard 
                            icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2h10a2 2 0 002-2v-1a2 2 0 012-2h1.945M7.705 11a7 7 0 00-5.452-2.322M10 21h4m-2 0v-4" /></svg>}
                            title={t('business_feature_3_title')}
                            description={t('business_feature_3_desc')}
                        />
                        <FeatureCard 
                            icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9V3m-9 9h18" /></svg>}
                            title={t('business_feature_4_title')}
                            description={t('business_feature_4_desc')}
                        />
                    </div>
                </div>
            </section>
            
            {/* Pricing Section */}
            <section ref={pricingSectionRef} id="business-pricing-section" className="py-16 md:py-24 bg-gray-50 dark:bg-slate-900/50">
                <div className="max-w-4xl mx-auto px-4 sm:px-6">
                     <div className="text-center mb-12">
                        <h2 className="text-3xl md:text-4xl font-extrabold text-gray-900 dark:text-gray-100 tracking-tight">{t('business_pricing_title')}</h2>
                        <p className="mt-4 text-lg text-gray-600 dark:text-gray-400 max-w-3xl mx-auto">{t('business_pricing_subtitle')}</p>
                    </div>
                    <div className="isolate mx-auto grid max-w-md grid-cols-1 gap-8 lg:max-w-none lg:grid-cols-2">
                        <PricingCard 
                            title={t('plan_single_post_name')}
                            price="$299"
                            description={t('business_plan_1_desc')}
                            features={[t('plan_single_post_feature_1'), t('plan_single_post_feature_2'), t('plan_single_post_feature_3')]}
                            onSelect={() => handleGetStarted('single_post')}
                        />
                         <PricingCard 
                            title={t('plan_job_pack_name')}
                            price="$999"
                            description={t('business_plan_2_desc')}
                            features={[t('plan_job_pack_feature_1'), t('plan_job_pack_feature_2'), t('plan_job_pack_feature_3'), t('plan_job_pack_feature_4')]}
                            isFeatured={true}
                            onSelect={() => handleGetStarted('job_pack')}
                        />
                    </div>
                </div>
            </section>
        </div>
    );
};

export default BusinessPage;
