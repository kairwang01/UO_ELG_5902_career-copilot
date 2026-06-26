import React from 'react';
import {
  Award,
  BarChart3,
  BookOpenCheck,
  BriefcaseBusiness,
  CalendarDays,
  FileSearch,
  Languages,
  Mail,
  Mic,
  Network,
  PenLine,
  TrendingUp,
  Wallet,
  type LucideIcon,
} from 'lucide-react';

interface ToolLibraryProps {
  t: (key: string) => string;
}

const tools = [
  {
    name: 'Resume Readiness Report',
    description: 'Review market fit, ATS risks, and formatting issues against the job markets you are targeting.',
    result: 'Score · ATS risks · priority fixes',
    icon: FileSearch,
  },
  {
    name: 'Cover Letter Builder',
    description: 'Create role-specific cover letters from the job description and the proof points in your resume.',
    result: 'Role-fit draft · proof points · tone check',
    icon: PenLine,
  },
  {
    name: 'Resume Localizer',
    description: 'Format and translate your resume for local hiring standards in your target market.',
    result: 'Local format · translation · market rules',
    icon: Languages,
  },
  {
    name: 'Opportunity Finder',
    description: 'Discover curated job opportunities with a detailed analysis of how your skills match the role requirements.',
    result: 'Matches · skill gaps · apply priority',
    icon: BriefcaseBusiness,
  },
  {
    name: 'Mock Interview',
    description: 'Practice with tailored questions and review feedback on structure, clarity, and role fit.',
    result: 'Questions · STAR feedback · next drill',
    icon: Mic,
  },
  {
    name: 'Salary Negotiation Coach',
    description: 'Receive a data-driven negotiation strategy, including market analysis and scripts, to secure the compensation you deserve.',
    result: 'Market range · scripts · objections',
    icon: Wallet,
  },
  {
    name: 'Career Path Analysis',
    description: "Get a clear, personalized roadmap to your dream role, identifying skill gaps, actionable steps, and bridge roles.",
    result: 'Gap map · bridge roles · weekly path',
    icon: TrendingUp,
  },
  {
    name: 'Performance Review Prep',
    description: 'Walk into your performance review with clear talking points based on your accomplishments.',
    result: 'Talking points · wins · growth asks',
    icon: BarChart3,
  },
  {
    name: 'Personalized Learning Plan',
    description: 'Get a custom, week-by-week learning plan for any skill, complete with resources and mini-projects to track your progress.',
    result: 'Weeks · resources · mini-projects',
    icon: BookOpenCheck,
  },
  {
    name: 'Strategic Networking',
    description: 'Receive actionable suggestions to improve your LinkedIn profile and generate outreach messages.',
    result: 'Profile edits · targets · outreach',
    icon: Network,
  },
  {
    name: 'Professional Showcase',
    description: 'Build a clean showcase website for your credentials, projects, and proof-of-work.',
    result: 'Profile site · projects · credentials',
    icon: Award,
  },
  {
    name: 'Industry Event Scout',
    description: 'Find relevant industry conferences, webinars, and meetups in your area or online to boost your network and knowledge.',
    result: 'Events · dates · networking angle',
    icon: CalendarDays,
  },
  {
    name: 'Agile Certification Prep',
    description: 'Prepare for Agile certification exams with practice tests, explanations, and review notes.',
    result: 'Practice tests · explanations · tips',
    icon: Award,
  },
  {
    name: 'Email Drafting',
    description: 'Draft professional thank-yous, follow-ups, and networking notes with your resume context.',
    result: 'Thank-you · follow-up · networking',
    icon: Mail,
  },
  {
    name: 'English Pro Coach',
    description: 'Assess and improve your professional English with feedback on grammar, vocabulary, and tone for global workplace communication.',
    result: 'Grammar · vocabulary · tone',
    icon: BookOpenCheck,
  },
];

const ToolMark: React.FC<{ icon: LucideIcon; index: number }> = ({ icon: Icon, index }) => {
  const tones = [
    'bg-blue-50 text-blue-700 border-blue-100',
    'bg-emerald-50 text-emerald-700 border-emerald-100',
    'bg-amber-50 text-amber-700 border-amber-100',
  ];
  return (
    <div
      className={`flex h-11 w-11 items-center justify-center rounded-[var(--site-radius)] border ${tones[index % tones.length]}`}
      aria-hidden="true"
    >
      <Icon className="h-5 w-5" />
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
              <ToolMark icon={tool.icon} index={index} />
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
