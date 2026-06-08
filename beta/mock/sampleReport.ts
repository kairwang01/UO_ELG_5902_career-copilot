export interface ResumeGap {
  id: string;
  label: string;
  severity: 'ready' | 'gap' | 'risk';
  detail: string;
}

export interface SampleReport {
  candidateName: string;
  targetRole: string;
  atsReadiness: number;
  roleFit: number;
  missingKeywords: string[];
  matchedKeywords: string[];
  gaps: ResumeGap[];
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
  gaps: [
    {
      id: '1',
      label: 'Product discovery evidence',
      severity: 'gap',
      detail: 'Resume lists features shipped but not how customer problems were validated.',
    },
    {
      id: '2',
      label: 'Quantified business impact',
      severity: 'gap',
      detail: 'Only one bullet includes a metric. PM screens typically expect 3+ outcomes with numbers.',
    },
    {
      id: '3',
      label: 'ATS formatting',
      severity: 'ready',
      detail: 'Single column, standard headings, no tables — parses cleanly in Greenhouse and Lever.',
    },
    {
      id: '4',
      label: 'Title alignment',
      severity: 'risk',
      detail: 'Current title "Software Developer" undersells product work; recruiters may filter you out before review.',
    },
  ],
  bridgeRoles: ['Technical Product Owner', 'Associate PM (B2B SaaS)'],
  nextAction: 'Rewrite top 3 bullets under current role using STAR format with one metric each.',
  rewriteSuggestion:
    'Led discovery for billing workflow redesign; interviewed 12 customers, prioritized backlog with eng + design, and reduced support tickets 18% in Q2.',
};
