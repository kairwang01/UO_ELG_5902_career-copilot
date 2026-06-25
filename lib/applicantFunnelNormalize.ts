import type { ApplicationStatusHistoryEvent, JobApplicant } from '../services/aiClient';

type ScreenerAnswer = JobApplicant['screener_answers'][number];

export function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    : [];
}

function normalizeScreenerAnswers(value: unknown): ScreenerAnswer[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object' && !Array.isArray(item))
    .map((item) => ({
      question_id: typeof item.question_id === 'string' ? item.question_id : '',
      prompt: typeof item.prompt === 'string' ? item.prompt : '',
      answer: typeof item.answer === 'string' ? item.answer : '',
    }))
    .filter((item) => item.question_id || item.prompt || item.answer);
}

function normalizeStatusHistory(value: unknown): ApplicationStatusHistoryEvent[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((event): event is Record<string, unknown> => Boolean(event) && typeof event === 'object' && !Array.isArray(event))
    .map((event) => ({
      id: typeof event.id === 'string' ? event.id : null,
      action: typeof event.action === 'string' ? event.action : null,
      from_status: typeof event.from_status === 'string' ? event.from_status : '',
      to_status: typeof event.to_status === 'string' ? event.to_status : '',
      reason: typeof event.reason === 'string' ? event.reason : null,
      candidate_note: typeof event.candidate_note === 'string' ? event.candidate_note : null,
      skipped_statuses: stringArray(event.skipped_statuses),
      created_at: typeof event.created_at === 'string' ? event.created_at : null,
    }));
}

export function normalizeApplicantForFunnel(applicant: JobApplicant): JobApplicant {
  const raw = applicant as unknown as Record<string, unknown>;
  return {
    ...applicant,
    candidate_name: typeof raw.candidate_name === 'string' ? raw.candidate_name : '',
    application_date: typeof raw.application_date === 'string' ? raw.application_date : null,
    status: typeof raw.status === 'string' ? raw.status : 'Submitted',
    compatibility_score: typeof raw.compatibility_score === 'number' && Number.isFinite(raw.compatibility_score)
      ? raw.compatibility_score
      : 0,
    summary: typeof raw.summary === 'string' ? raw.summary : '',
    strengths: stringArray(raw.strengths),
    potentialGaps: stringArray(raw.potentialGaps),
    suggestedQuestions: stringArray(raw.suggestedQuestions),
    status_history: normalizeStatusHistory(raw.status_history),
    screener_answers: normalizeScreenerAnswers(raw.screener_answers),
  };
}
