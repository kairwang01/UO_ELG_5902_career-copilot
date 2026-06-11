import React from 'react';

interface ToolLibraryProps {
  t: (key: string) => string;
}

const tools = [
  {
    name: 'AI Resume Analysis',
    description: 'Get an instant score and detailed feedback tailored for your target job market, ensuring ATS compliance.',
    result: 'Score · ATS risks · priority fixes',
  },
  {
    name: 'AI Cover Letter Generator',
    description: 'Create compelling cover letters in seconds, tailored to the job description and your resume.',
    result: 'Role-fit draft · proof points · tone check',
  },
  {
    name: 'Resume Localizer',
    description: 'Automatically format and translate your resume to local standards, perfect for your target market.',
    result: 'Local format · translation · market rules',
  },
  {
    name: 'AI Opportunity Finder',
    description: 'Discover curated job opportunities with a detailed analysis of how your skills match the role requirements.',
    result: 'Matches · skill gaps · apply priority',
  },
  {
    name: 'AI Mock Interview',
    description: 'Conquer interviews with confidence. Our AI simulator provides tailored questions and instant feedback on your answers.',
    result: 'Questions · STAR feedback · next drill',
  },
  {
    name: 'AI Salary Negotiation Coach',
    description: 'Receive a data-driven negotiation strategy, including market analysis and scripts, to secure the compensation you deserve.',
    result: 'Market range · scripts · objections',
  },
  {
    name: 'Career Path Analysis',
    description: "Get a clear, personalized roadmap to your dream role, identifying skill gaps, actionable steps, and bridge roles.",
    result: 'Gap map · bridge roles · weekly path',
  },
  {
    name: 'Performance Review Prep',
    description: 'Walk into your performance review with confidence using AI-generated talking points based on your accomplishments.',
    result: 'Talking points · wins · growth asks',
  },
  {
    name: 'Personalized Learning Plan',
    description: 'Get a custom, week-by-week learning plan for any skill, complete with resources and mini-projects to track your progress.',
    result: 'Weeks · resources · mini-projects',
  },
  {
    name: 'Strategic Networking',
    description: 'Receive actionable suggestions to improve your LinkedIn profile and generate outreach messages.',
    result: 'Profile edits · targets · outreach',
  },
  {
    name: 'Professional Showcase',
    description: 'Build a stunning, professional showcase website in minutes to display your credentials and projects.',
    result: 'Profile site · projects · credentials',
  },
  {
    name: 'Industry Event Scout',
    description: 'Find relevant industry conferences, webinars, and meetups in your area or online to boost your network and knowledge.',
    result: 'Events · dates · networking angle',
  },
  {
    name: 'Agile Certification Prep',
    description: 'Ace your Agile certification exams with practice tests, detailed explanations, and expert passing tips.',
    result: 'Practice tests · explanations · tips',
  },
  {
    name: 'AI Email Crafter',
    description: 'Generate professional emails for thank-yous, follow-ups, and networking, all personalized with your resume data.',
    result: 'Thank-you · follow-up · networking',
  },
  {
    name: 'English Pro Coach',
    description: 'Assess and improve your professional English with feedback on grammar, vocabulary, and tone for global workplace communication.',
    result: 'Grammar · vocabulary · tone',
  },
];

const ToolMark: React.FC<{ index: number }> = ({ index }) => {
  const fills = ['bg-blue-700', 'bg-emerald-600', 'bg-amber-500'];
  return (
    <div
      className="h-11 w-11 rounded-[var(--site-radius)] border border-[var(--site-border)] bg-[var(--site-surface-muted)] p-2"
      aria-hidden="true"
    >
      <div className="flex h-full flex-col justify-between">
        <div className={`h-1.5 rounded-full ${fills[index % fills.length]}`} />
        <div className="space-y-1">
          <div className="h-1 rounded-full bg-slate-300" />
          <div className="h-1 w-2/3 rounded-full bg-slate-300" />
        </div>
      </div>
    </div>
  );
};

export const ToolLibrary: React.FC<ToolLibraryProps> = ({ t }) => (
  <section id="toolkit-section" className="py-12 sm:py-[var(--site-section)]">
    <div className="max-w-6xl mx-auto px-4 sm:px-6">
      <div className="max-w-3xl mb-8">
        <p className="text-sm font-medium text-[var(--site-action)] mb-3">{t('site_tool_library_label')}</p>
        <h2 className="text-xl sm:text-2xl font-semibold">{t('site_tool_library_title')}</h2>
        <p className="mt-3 text-[var(--site-text-muted)]">
          {t('site_tool_library_desc')}
        </p>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {tools.map((tool, index) => (
          <article
            key={tool.name}
            className="rounded-[var(--site-radius)] border border-[var(--site-border)] bg-[var(--site-surface)] p-5"
          >
            <div className="flex items-start gap-4">
              <ToolMark index={index} />
              <div className="min-w-0">
                <h3 className="font-semibold leading-snug">{tool.name}</h3>
                <p className="mt-2 text-sm text-[var(--site-text-muted)] leading-relaxed">{tool.description}</p>
              </div>
            </div>
            <div className="mt-4 rounded-[var(--site-radius)] border border-[var(--site-border)] bg-[var(--site-surface-muted)] px-3 py-2 text-xs font-medium text-[var(--site-text-muted)]">
              {tool.result}
            </div>
          </article>
        ))}
      </div>
    </div>
  </section>
);
