
import React from 'react';

interface FeaturesProps {
    t: (key: string) => string;
}

const featureIcons = {
    analysis: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7 text-blue-600 dark:text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
      </svg>
    ),
    converter: (
       <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7 text-green-600 dark:text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 21h7a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v11m0 5l4.879-4.879m0 0a3 3 0 104.243-4.242 3 3 0 00-4.243 4.242z" />
       </svg>
    ),
    opportunity: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7 text-red-600 dark:text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
    ),
    interview: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7 text-teal-600 dark:text-teal-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
    ),
    career: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7 text-cyan-600 dark:text-cyan-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
    ),
    coverLetter: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7 text-yellow-600 dark:text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>
    ),
    networking: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7 text-sky-600 dark:text-sky-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M15 21v-1a6 6 0 00-5.173-5.97m0 0A5.98 5.98 0 009 9.757a4 4 0 118 0 5.98 5.98 0 00-2.827 5.273" /></svg>
    ),
    agile: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7 text-orange-600 dark:text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
    ),
    salary: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7 text-lime-600 dark:text-lime-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
    ),
    email: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7 text-pink-600 dark:text-pink-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487zm0 0L19.5 7.125" />
        </svg>
    ),
    english: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7 text-rose-600 dark:text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a2 2 0 01-2-2V7a2 2 0 012-2h2.586a1 1 0 01.707.293l2.414 2.414a1 1 0 01.293.707V8z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 14a2 2 0 01-2-2V7a2 2 0 012-2h2.586a1 1 0 01.707.293l2.414 2.414a1 1 0 01.293.707V14a2 2 0 01-2 2H3z" />
        </svg>
    ),
    website: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7 text-purple-600 dark:text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 20h5V4h-5" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 20h5V4H4" />
        </svg>
    ),
    performanceReview: ( <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7 text-amber-600 dark:text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg> ),
    learningPlan: ( <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7 text-violet-600 dark:text-violet-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M12 14l9-5-9-5-9 5 9 5z" /><path d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" /><path strokeLinecap="round" strokeLinejoin="round" d="M12 14l9-5-9-5-9 5 9 5zm0 0v6" /></svg> ),
    eventScout: ( <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7 text-fuchsia-600 dark:text-fuchsia-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg> ),
    verified_talent: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7 text-indigo-600 dark:text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-14L4 7v10l8 4m0-14v10" />
        </svg>
    ),
};

const featuresData = [
    // Resume & Application
    { key: 'analysis', icon: featureIcons.analysis, bgColor: 'bg-blue-100 dark:bg-blue-900/50' },
    { key: 'coverLetter', icon: featureIcons.coverLetter, bgColor: 'bg-yellow-100 dark:bg-yellow-900/50' },
    { key: 'converter', icon: featureIcons.converter, bgColor: 'bg-green-100 dark:bg-green-900/50' },
    // Job Search
    { key: 'opportunity', icon: featureIcons.opportunity, bgColor: 'bg-red-100 dark:bg-red-900/50' },
    // Interview & Negotiation
    { key: 'interview', icon: featureIcons.interview, bgColor: 'bg-teal-100 dark:bg-teal-900/50' },
    { key: 'salary', icon: featureIcons.salary, bgColor: 'bg-lime-100 dark:bg-lime-900/50' },
    // Career Growth
    { key: 'career', icon: featureIcons.career, bgColor: 'bg-cyan-100 dark:bg-cyan-900/50' },
    { key: 'performanceReview', icon: featureIcons.performanceReview, bgColor: 'bg-amber-100 dark:bg-amber-900/50' },
    { key: 'learningPlan', icon: featureIcons.learningPlan, bgColor: 'bg-violet-100 dark:bg-violet-900/50' },
    // Networking & Branding
    { key: 'networking', icon: featureIcons.networking, bgColor: 'bg-sky-100 dark:bg-sky-900/50' },
    { key: 'website', icon: featureIcons.website, bgColor: 'bg-purple-100 dark:bg-purple-900/50' },
    { key: 'eventScout', icon: featureIcons.eventScout, bgColor: 'bg-fuchsia-100 dark:bg-fuchsia-900/50' },
    // Professional Skills
    { key: 'agile', icon: featureIcons.agile, bgColor: 'bg-orange-100 dark:bg-orange-900/50' },
    { key: 'email', icon: featureIcons.email, bgColor: 'bg-pink-100 dark:bg-pink-900/50' },
    { key: 'english', icon: featureIcons.english, bgColor: 'bg-rose-100 dark:bg-rose-900/50' },
    // Unique Feature
    { key: 'verified_talent', icon: featureIcons.verified_talent, bgColor: 'bg-indigo-100 dark:bg-indigo-900/50' },
];

const Features: React.FC<FeaturesProps> = ({ t }) => {
  return (
    <section className="py-16 md:py-24 bg-gray-50 dark:bg-slate-900/50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-12 animate-slide-in-up">
          <h2 className="text-3xl md:text-4xl font-extrabold text-gray-900 dark:text-gray-100 tracking-tight">{t('features_title')}</h2>
          <p className="mt-4 text-lg text-gray-600 dark:text-gray-400 max-w-3xl mx-auto">{t('features_subtitle')}</p>
        </div>
        <div className="flex flex-wrap justify-center -m-4">
          {featuresData.map((feature, index) => (
            <div key={index} className="p-4 w-full sm:w-1/2 lg:w-1/3">
                <div className="h-full relative flex flex-col items-start p-6 bg-white dark:bg-slate-800 rounded-xl border border-gray-200/80 dark:border-slate-700/80 transition-all duration-300 hover:shadow-lg hover:border-blue-300/50 dark:hover:border-blue-500/50 hover:-translate-y-1 animate-slide-in-up" style={{animationDelay: `${index * 100}ms`}}>
                  <div className={`flex-shrink-0 ${feature.bgColor} p-3 rounded-full mb-4`}>
                    {feature.icon}
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">{t(`features_${feature.key}_title`)}</h3>
                  <p className="text-gray-600 dark:text-gray-400 flex-grow">{t(`features_${feature.key}_desc`)}</p>
                </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Features;