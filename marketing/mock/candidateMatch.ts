export interface RoleRequirement {
  label: string;
  required: boolean;
  met: boolean;
  evidence?: string;
}

export interface CandidateMatch {
  id: string;
  name: string;
  roleFit: number;
  skillsMatched: string[];
  missingSkills: string[];
  resumeEvidence: string;
  availability: string;
  location: string;
  recommendedAction: 'shortlist' | 'review' | 'pass';
  matchReasons: string[];
  roleRequirements: RoleRequirement[];
}

export const jobRoleTitle = 'Senior Frontend Engineer';

export const roleRequirementsSummary: RoleRequirement[] = [
  { label: 'React + TypeScript (3+ yrs)', required: true, met: true },
  { label: 'Design systems at scale', required: true, met: true },
  { label: 'Accessibility (WCAG AA)', required: true, met: true },
  { label: 'GraphQL', required: false, met: false },
  { label: 'Team lead experience', required: false, met: true },
];

export const candidateMatches: CandidateMatch[] = [
  {
    id: 'c1',
    name: 'Jordan Lee',
    roleFit: 84,
    skillsMatched: ['React', 'TypeScript', 'design systems', 'accessibility'],
    missingSkills: ['GraphQL'],
    resumeEvidence: 'Led component library used by 4 product teams; WCAG AA audit owner.',
    availability: 'Available in 2 weeks',
    location: 'Toronto, ON (remote OK)',
    recommendedAction: 'shortlist',
    matchReasons: [
      'Shipped design-system work at scale — matches senior frontend scope',
      'Resume shows cross-team adoption metrics',
      'GraphQL gap is trainable for this role',
    ],
    roleRequirements: [
      { label: 'React + TypeScript (3+ yrs)', required: true, met: true, evidence: '6 yrs React; led TS migration' },
      { label: 'Design systems at scale', required: true, met: true, evidence: 'Built library for 4 teams' },
      { label: 'Accessibility (WCAG AA)', required: true, met: true, evidence: 'Audit owner, 0 P1 a11y bugs at launch' },
      { label: 'GraphQL', required: false, met: false },
      { label: 'Team lead experience', required: false, met: true, evidence: 'Mentored 3 juniors' },
    ],
  },
  {
    id: 'c2',
    name: 'Samira Okonkwo',
    roleFit: 76,
    skillsMatched: ['Python', 'data pipelines', 'SQL'],
    missingSkills: ['React', 'product collaboration'],
    resumeEvidence: 'Built ETL reducing report latency 40%; no frontend delivery examples.',
    availability: 'Immediate',
    location: 'Remote — UTC+1',
    recommendedAction: 'review',
    matchReasons: [
      'Strong data fundamentals',
      'Role is 60% frontend — gap may slow ramp',
    ],
    roleRequirements: [
      { label: 'React + TypeScript (3+ yrs)', required: true, met: false },
      { label: 'Design systems at scale', required: true, met: false },
      { label: 'Accessibility (WCAG AA)', required: true, met: false },
      { label: 'GraphQL', required: false, met: true, evidence: 'Built GraphQL API layer' },
      { label: 'Team lead experience', required: false, met: false },
    ],
  },
];
