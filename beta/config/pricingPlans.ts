export interface BetaPlanConfig {
  id: string;
  featureCount: number;
  recommended: boolean;
  isCustomPrice?: boolean;
}

export const jobseekerPlans: BetaPlanConfig[] = [
  { id: 'js_free', featureCount: 3, recommended: false },
  { id: 'js_essentials', featureCount: 3, recommended: true },
  { id: 'js_accelerator', featureCount: 3, recommended: false },
  { id: 'js_executive', featureCount: 3, recommended: false },
];

export const employerPlans: BetaPlanConfig[] = [
  { id: 'emp_single', featureCount: 3, recommended: false },
  { id: 'emp_starter', featureCount: 3, recommended: true },
  { id: 'emp_growth', featureCount: 3, recommended: false },
  { id: 'emp_team', featureCount: 3, recommended: false, isCustomPrice: true },
];

export const planKey = (id: string, field: 'name' | 'price' | 'desc' | `f${number}`) =>
  `beta_plan_${id}_${field}`;
