import React from 'react';

interface AudienceProps {
    t: (key: string) => string;
}

// Icons are co-located for simplicity, mirroring the structure in Features.tsx
const icons = {
    career: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
    ),
    opportunity: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
    ),
    linkedin: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M16 8v8m-4-5v5m-4-2v2m-2 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
    ),
    converter: (
       <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 21h7a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v11m0 5l4.879-4.879m0 0a3 3 0 104.243-4.242 3 3 0 00-4.243 4.242z" />
       </svg>
    ),
    interview: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
    ),
    english: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a2 2 0 01-2-2V7a2 2 0 012-2h2.586a1 1 0 01.707.293l2.414 2.414a1 1 0 01.293.707V8z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 14a2 2 0 01-2-2V7a2 2 0 012-2h2.586a1 1 0 01.707.293l2.414 2.414a1 1 0 01.293.707V14a2 2 0 01-2 2H3z" />
        </svg>
    ),
    website: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 20h5V4h-5" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 20h5V4H4" />
        </svg>
    ),
    coverLetter: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>
    ),
    analysis: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
      </svg>
    ),
};


const successStories = [
  {
    imageSrc: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=400&auto=format&fit=crop',
    name: 'Ana Silva',
    title: 'New Immigrant',
    quote: "Career CoPilot's localizer and interview coach were game-changers. I went from getting no replies to landing three interviews in two weeks.",
    topTools: [
      { name: 'Resume Localizer', icon: icons.converter },
      { name: 'AI Mock Interview', icon: icons.interview },
      { name: 'English Pro Coach', icon: icons.english },
    ],
  },
  {
    imageSrc: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?q=80&w=400&auto=format&fit=crop',
    name: 'Ben Carter',
    title: 'Career Switcher',
    quote: "The Career Path tool showed me exactly how to leverage my skills for a new role in tech. I felt confident and prepared for the change.",
    topTools: [
      { name: 'Career Path Analysis', icon: icons.career },
      { name: 'AI Opportunity Finder', icon: icons.opportunity },
      { name: 'LinkedIn Optimizer', icon: icons.linkedin },
    ],
  },
  {
    imageSrc: 'https://images.unsplash.com/photo-1521119989659-a83eee488004?q=80&w=400&auto=format&fit=crop',
    name: 'Chloe Davis',
    title: 'Recent Graduate',
    quote: "As a new grad, building a portfolio was daunting. The AI Website Builder created a stunning site from my resume in minutes. It was a huge advantage!",
    topTools: [
      { name: 'AI Portfolio Website Builder', icon: icons.website },
      { name: 'AI Cover Letter Generator', icon: icons.coverLetter },
      { name: 'AI Resume Analysis', icon: icons.analysis },
    ],
  },
  {
    imageSrc: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=400&auto=format&fit=crop',
    name: 'David Chen',
    title: 'Experienced Professional',
    quote: "The AI analysis optimized my senior-level resume for modern ATS, immediately increasing my visibility to top-tier recruiters.",
    topTools: [
      { name: 'AI Resume Analysis', icon: icons.analysis },
      { name: 'LinkedIn Optimizer', icon: icons.linkedin },
      { name: 'AI Opportunity Finder', icon: icons.opportunity },
    ],
  },
];

const Audience: React.FC<AudienceProps> = ({ t }) => {
  return (
    <section className="py-16 md:py-24 bg-gray-50 dark:bg-slate-900/50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-12 animate-slide-in-up">
          <h2 className="text-3xl md:text-4xl font-extrabold text-gray-900 dark:text-gray-100 tracking-tight">{t('audience_title')}</h2>
          <p className="mt-4 text-lg text-gray-600 dark:text-gray-400 max-w-3xl mx-auto">{t('audience_subtitle')}</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {successStories.map((story, index) => (
            <div key={story.name} className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-gray-200/80 dark:border-slate-700/80 overflow-hidden flex flex-col sm:flex-row transition-transform duration-300 transform hover:-translate-y-2 animate-slide-in-up" style={{animationDelay: `${index * 100}ms`}}>
              <img src={story.imageSrc} alt={story.name} className="w-full sm:w-1/3 h-48 sm:h-auto object-cover object-center" />
              <div className="p-6 flex flex-col justify-between">
                <div>
                    <p className="text-sm font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wide">{story.title}</p>
                    <blockquote className="mt-2 text-gray-700 dark:text-gray-300 italic border-l-4 border-blue-200 dark:border-blue-700 pl-4">
                        "{story.quote}"
                    </blockquote>
                    <p className="mt-3 font-bold text-gray-900 dark:text-gray-100 text-right">- {story.name}</p>
                </div>
                <div className="mt-4 pt-4 border-t border-gray-200 dark:border-slate-700">
                  <h4 className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-2">Top Tools Used:</h4>
                  <div className="flex flex-wrap gap-x-4 gap-y-2">
                    {story.topTools.map(tool => (
                      <div key={tool.name} className="flex items-center text-xs text-gray-700 dark:text-gray-300">
                        <span className="text-blue-600 dark:text-blue-400 mr-1.5">{tool.icon}</span>
                        {tool.name}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Audience;
