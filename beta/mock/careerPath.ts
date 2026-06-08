export interface CareerPathPlan {
  currentRole: string;
  targetRole: string;
  bridgeRole: string;
  skillGaps: { skill: string; priority: 'high' | 'medium' }[];
  fourWeekPlan: { week: number; focus: string; tasks: string[] }[];
}

export const careerPathPlan: CareerPathPlan = {
  currentRole: 'Software Developer',
  targetRole: 'Product Manager',
  bridgeRole: 'Technical Product Owner',
  skillGaps: [
    { skill: 'User interview synthesis', priority: 'high' },
    { skill: 'Roadmap prioritization frameworks', priority: 'high' },
    { skill: 'Stakeholder communication', priority: 'medium' },
    { skill: 'Pricing & packaging basics', priority: 'medium' },
  ],
  fourWeekPlan: [
    {
      week: 1,
      focus: 'Evidence collection',
      tasks: ['Shadow 2 PM customer calls', 'Document 3 problems your team solved this quarter'],
    },
    {
      week: 2,
      focus: 'Portfolio bullets',
      tasks: ['Rewrite 4 resume bullets in STAR format', 'Add one discovery → delivery story'],
    },
    {
      week: 3,
      focus: 'Bridge role applications',
      tasks: ['Apply to 5 Technical PO roles', 'Tailor keywords per job description'],
    },
    {
      week: 4,
      focus: 'Interview prep',
      tasks: ['2 product sense drills', '1 mock stakeholder alignment scenario'],
    },
  ],
};
