export interface CaseSnapshot {
  id: string;
  tagKey: string;
  titleKey: string;
  outcomeKey: string;
  metricKey: string;
}

export const caseSnapshots: CaseSnapshot[] = [
  {
    id: 'cs1',
    tagKey: 'beta_case_tag_switcher',
    titleKey: 'beta_case_switcher_title',
    outcomeKey: 'beta_case_switcher_outcome',
    metricKey: 'beta_case_switcher_metric',
  },
  {
    id: 'cs2',
    tagKey: 'beta_case_tag_newcomer',
    titleKey: 'beta_case_newcomer_title',
    outcomeKey: 'beta_case_newcomer_outcome',
    metricKey: 'beta_case_newcomer_metric',
  },
  {
    id: 'cs3',
    tagKey: 'beta_case_tag_employer',
    titleKey: 'beta_case_employer_title',
    outcomeKey: 'beta_case_employer_outcome',
    metricKey: 'beta_case_employer_metric',
  },
];
