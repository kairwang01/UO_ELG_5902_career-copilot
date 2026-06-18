export type ApplicationStatusGroup = 'applied' | 'interview' | 'offer' | 'hired' | 'rejected';

export interface ApplicationPipelineStage {
  status: string;
  labelKey: string;
  group: Exclude<ApplicationStatusGroup, 'rejected'>;
  optional?: boolean;
}

export const APPLICATION_PIPELINE_STAGES = [
  {
    status: 'Applied',
    labelKey: 'applications_status_applied',
    group: 'applied',
  },
  {
    status: 'Group Interview',
    labelKey: 'applications_status_group_interview',
    group: 'interview',
  },
  {
    status: 'First Interview',
    labelKey: 'applications_status_first_interview',
    group: 'interview',
  },
  {
    status: 'Second Interview',
    labelKey: 'applications_status_second_interview',
    group: 'interview',
  },
  {
    status: 'Decision Maker Interview',
    labelKey: 'applications_status_decision_maker_interview',
    group: 'interview',
  },
  {
    status: 'HR Interview',
    labelKey: 'applications_status_hr_interview',
    group: 'interview',
  },
  {
    status: 'Offer',
    labelKey: 'applications_status_offer',
    group: 'offer',
  },
  {
    status: 'Hiring Evaluation',
    labelKey: 'applications_status_hiring_evaluation',
    group: 'offer',
  },
  {
    status: 'Intent Letter',
    labelKey: 'applications_status_intent_letter',
    group: 'offer',
    optional: true,
  },
  {
    status: 'Offer Confirmed',
    labelKey: 'applications_status_offer_confirmed',
    group: 'offer',
  },
  {
    status: 'Tripartite Agreement',
    labelKey: 'applications_status_tripartite_agreement',
    group: 'offer',
  },
  {
    status: 'Signed',
    labelKey: 'applications_status_signed',
    group: 'hired',
  },
] as const satisfies readonly ApplicationPipelineStage[];

export type ApplicationPipelineStatus =
  | ApplicationPipelineStageStatus
  | 'Rejected';

export type ApplicationPipelineStageStatus = (typeof APPLICATION_PIPELINE_STAGES)[number]['status'];

export type ApplicationProgressGroupId = 'applied' | 'interview' | 'offer' | 'signing';

export interface ApplicationProgressGroup {
  id: ApplicationProgressGroupId;
  labelKey: string;
  statuses: readonly ApplicationPipelineStageStatus[];
  noteKey?: string;
}

export const APPLICATION_PROGRESS_GROUPS = [
  {
    id: 'applied',
    labelKey: 'applications_progress_group_applied',
    statuses: ['Applied'],
  },
  {
    id: 'interview',
    labelKey: 'applications_progress_group_interview',
    statuses: [
      'Group Interview',
      'First Interview',
      'Second Interview',
      'Decision Maker Interview',
      'HR Interview',
    ],
  },
  {
    id: 'offer',
    labelKey: 'applications_progress_group_offer',
    statuses: [
      'Offer',
      'Hiring Evaluation',
      'Intent Letter',
      'Offer Confirmed',
    ],
    noteKey: 'applications_progress_offer_note',
  },
  {
    id: 'signing',
    labelKey: 'applications_progress_group_signing',
    statuses: ['Tripartite Agreement', 'Signed'],
  },
] as const satisfies readonly ApplicationProgressGroup[];

export type ApplicationFilterGroup = 'All' | ApplicationStatusGroup;

export const APPLICATION_FILTER_GROUPS: ApplicationFilterGroup[] = [
  'All',
  'applied',
  'interview',
  'offer',
  'hired',
  'rejected',
];

export const APPLICATION_FILTER_LABEL_KEYS: Record<ApplicationFilterGroup, string> = {
  All: 'applications_filter_all',
  applied: 'applications_filter_applied',
  interview: 'applications_filter_interview',
  offer: 'applications_filter_offer',
  hired: 'applications_filter_hired',
  rejected: 'applications_filter_rejected',
};

const STAGE_BY_STATUS = new Map<string, ApplicationPipelineStage>(
  APPLICATION_PIPELINE_STAGES.map((stage) => [stage.status, stage]),
);

const STATUS_ALIASES: Record<string, ApplicationPipelineStatus> = {
  applied: 'Applied',
  apply: 'Applied',
  submitted: 'Applied',
  'resume submitted': 'Applied',
  '投递简历': 'Applied',
  '已投递': 'Applied',
  interviewing: 'First Interview',
  interview: 'First Interview',
  'interview-stage': 'First Interview',
  'interview stage': 'First Interview',
  '面试中': 'First Interview',
  'group interview': 'Group Interview',
  '集体面试': 'Group Interview',
  'first interview': 'First Interview',
  '初试': 'First Interview',
  'second interview': 'Second Interview',
  '复试': 'Second Interview',
  'decision maker interview': 'Decision Maker Interview',
  'hiring manager interview': 'Decision Maker Interview',
  '用人决策者面试': 'Decision Maker Interview',
  'hr interview': 'HR Interview',
  'hr面试': 'HR Interview',
  offer: 'Offer',
  '录用评估中': 'Hiring Evaluation',
  'hiring evaluation': 'Hiring Evaluation',
  'intent letter': 'Intent Letter',
  '确认意向书': 'Intent Letter',
  'offer confirmed': 'Offer Confirmed',
  accepted: 'Offer Confirmed',
  '确认offer': 'Offer Confirmed',
  '确认OFFER': 'Offer Confirmed',
  'tripartite agreement': 'Tripartite Agreement',
  '三方协议': 'Tripartite Agreement',
  signed: 'Signed',
  hired: 'Signed',
  '签约': 'Signed',
  '已录用': 'Signed',
  rejected: 'Rejected',
  closed: 'Rejected',
  declined: 'Rejected',
  '未通过': 'Rejected',
};

export function normalizeApplicationStatus(status: unknown): ApplicationPipelineStatus {
  const value = String(status ?? '').trim();
  if (!value) return 'Applied';

  const direct = APPLICATION_PIPELINE_STAGES.find((stage) => stage.status === value);
  if (direct) return direct.status;
  if (value === 'Rejected') return 'Rejected';

  const normalized = value.toLowerCase();
  return STATUS_ALIASES[normalized] ?? 'Applied';
}

export function getApplicationStatusGroup(status: unknown): ApplicationStatusGroup {
  const normalized = normalizeApplicationStatus(status);
  if (normalized === 'Rejected') return 'rejected';
  return STAGE_BY_STATUS.get(normalized)?.group ?? 'applied';
}

export function getApplicationStatusIndex(status: unknown): number {
  const normalized = normalizeApplicationStatus(status);
  return APPLICATION_PIPELINE_STAGES.findIndex((stage) => stage.status === normalized);
}

export function getApplicationProgressGroupIndex(status: unknown): number {
  const normalized = normalizeApplicationStatus(status);
  if (normalized === 'Rejected') return -1;
  return APPLICATION_PROGRESS_GROUPS.findIndex((group) =>
    group.statuses.some((stageStatus) => stageStatus === normalized),
  );
}

export function getNextApplicationPipelineStatus(status: unknown): ApplicationPipelineStageStatus | null {
  const current = getApplicationStatusIndex(status);
  if (current < 0 || current >= APPLICATION_PIPELINE_STAGES.length - 1) return null;
  return APPLICATION_PIPELINE_STAGES[current + 1].status;
}

export function getApplicationStatusLabelKey(status: unknown): string {
  const normalized = normalizeApplicationStatus(status);
  if (normalized === 'Rejected') return 'applications_status_rejected';
  return STAGE_BY_STATUS.get(normalized)?.labelKey ?? 'applications_status_applied';
}

export function isApplicationRejectedStatus(status: unknown): boolean {
  return normalizeApplicationStatus(status) === 'Rejected';
}

export function isApplicationHiredStatus(status: unknown): boolean {
  return getApplicationStatusGroup(status) === 'hired';
}

export function isApplicationClosedStatus(status: unknown): boolean {
  const group = getApplicationStatusGroup(status);
  return group === 'hired' || group === 'rejected';
}

export function isApplicationInterviewStatus(status: unknown): boolean {
  return getApplicationStatusGroup(status) === 'interview';
}

/**
 * True when the candidate's relationship with the employer is deep enough to review
 * the company: reached the interview, offer, or hired group. Mirrors the server-side
 * write gate in functions/src/handlers/companyReviews.ts.
 */
export function isApplicationReviewEligible(status: unknown): boolean {
  const group = getApplicationStatusGroup(status);
  return group === 'interview' || group === 'offer' || group === 'hired';
}

export function applicationMatchesFilter(status: unknown, filter: ApplicationFilterGroup): boolean {
  if (filter === 'All') return true;
  return getApplicationStatusGroup(status) === filter;
}
