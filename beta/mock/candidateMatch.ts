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
}

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
  },
];
