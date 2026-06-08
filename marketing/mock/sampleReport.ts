export interface ResumeIssue {
  id: string;
  issue: string;
  severity: 'ready' | 'gap' | 'risk';
  whyItMatters: string;
  fix: string;
}

export interface SampleReport {
  candidateName: string;
  targetRole: string;
  atsReadiness: number;
  roleFit: number;
  missingKeywords: string[];
  matchedKeywords: string[];
  issues: ResumeIssue[];
  bridgeRoles: string[];
  nextAction: string;
  rewriteSuggestion: string;
}

export const sampleReport: SampleReport = {
  candidateName: 'Alex Chen',
  targetRole: 'Product Manager',
  atsReadiness: 72,
  roleFit: 68,
  missingKeywords: ['roadmap prioritization', 'stakeholder alignment', 'OKRs', 'user research synthesis'],
  matchedKeywords: ['cross-functional', 'Agile', 'SQL', 'A/B testing', 'Jira'],
  issues: [
    {
      id: '1',
      issue: 'Product discovery evidence missing',
      severity: 'gap',
      whyItMatters: 'PM recruiters scan for how you validated problems before building — feature lists alone read as engineering handoff.',
      fix: 'Add one bullet: customer interviews conducted, insight gathered, and decision made.',
    },
    {
      id: '2',
      issue: 'Only one quantified outcome',
      severity: 'gap',
      whyItMatters: 'PM screens expect 3+ metrics across impact, scope, and collaboration — sparse numbers signal junior framing.',
      fix: 'Convert top 3 bullets to STAR with one metric each (%, $, time saved, users affected).',
    },
    {
      id: '3',
      issue: 'ATS formatting passes',
      severity: 'ready',
      whyItMatters: 'Single-column layout parses in Greenhouse and Lever — you will not be auto-rejected on format.',
      fix: 'Keep structure; do not add tables, text boxes, or multi-column sections.',
    },
    {
      id: '4',
      issue: 'Title says Software Developer',
      severity: 'risk',
      whyItMatters: 'Keyword filters for "Product Manager" may exclude you before a human reads the resume.',
      fix: 'Use "Software Developer · Product-focused" or lead with bridge title "Technical Product Owner".',
    },
  ],
  bridgeRoles: ['Technical Product Owner', 'Associate PM (B2B SaaS)'],
  nextAction: 'Rewrite top 3 bullets under current role using STAR format with one metric each.',
  rewriteSuggestion:
    'Led discovery for billing workflow redesign; interviewed 12 customers, prioritized backlog with eng + design, and reduced support tickets 18% in Q2.',
};
