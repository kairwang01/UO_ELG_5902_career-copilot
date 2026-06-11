/**
 * aiClient — the single frontend entry point for AI features.
 *
 * Every AI call goes through a Cloud Function: the Gemini key stays server-side
 * and credits are deducted server-side. There is no browser-side Gemini SDK or
 * VITE_API_KEY anymore (services/geminiService.ts was retired once every feature
 * here was migrated).
 *
 * - Long-tail tools  → httpsCallable("aiProxy", { tool, payload })
 * - Resume analysis / cover letter / career path / mock interview / headshot /
 *   URL extraction / career-coach chat → their dedicated callables
 */

import { httpsCallable } from 'firebase/functions';
import { firebaseFunctions } from '../lib/firebaseClient';
import type {
  AnalysisResult, ResumeImage,
  FormattedResume, CoverLetter, LinkedInOptimization, CareerPathResult,
  AgilePracticeTestResult, SalaryNegotiationResult, EnglishProResult,
  ProfessionalEmailResult, OpportunityResult, PortfolioContent,
  InclusivitySuggestion, CandidateMatchAnalysis, NetworkingStrategyResult,
  SkillBridgeProject, Improvement, PerformanceReviewResult, LearningPlanResult,
  EventScoutResult, UserProfile, SpokenEnglishAnalysisResult,
  EnglishReadingAnalysisResult, EnglishListeningAnalysisResult, ReadingEvaluation,
  ComprehensionQuestion, ReadingPracticePassage, VocabularyFlashcard, CandidatePrepKit,
} from '../types';
import type { AppSession as Session } from '../lib/data';

// API status indicator — driven by callable outcomes (replaces the old client
// geminiService status hook). CareerApp registers an updater on mount.
type ApiStatus = 'online' | 'degraded' | 'offline';
let updateApiStatus: (status: ApiStatus, error?: string) => void = () => {};
export const setApiStatusUpdater = (updater: (status: ApiStatus, error?: string) => void) => {
  updateApiStatus = updater;
};

/** Turns Firebase callable errors into user-readable text (avoids bare "INTERNAL"). */
export function formatCallableError(err: unknown): string {
  const e = err as { code?: string; message?: string; details?: unknown };
  const code = e?.code ?? '';
  const message = e?.message ?? '';
  const lower = message.toLowerCase();
  const detailsStr = JSON.stringify(e?.details ?? '').toLowerCase();

  const isQuota =
    code === 'functions/resource-exhausted' ||
    lower.includes('resource_exhausted') ||
    lower.includes('quota') ||
    detailsStr.includes('quota') ||
    detailsStr.includes('resource_exhausted');

  if (isQuota) {
    return 'The platform AI service is temporarily rate-limited or out of quota. Wait ~30s and retry. Business admins can verify the configured model key and billing in Admin.';
  }
  if (code === 'functions/unauthenticated') {
    return 'Please sign in to use AI features.';
  }
  if (code === 'functions/permission-denied' || lower.includes('not authenticated')) {
    return 'AI service access denied. Ask the project owner to grant Cloud Run invoker on new functions.';
  }
  if (code === 'functions/not-found') {
    return message || 'User profile not found. Sign out and sign back in.';
  }
  if (code === 'functions/internal' && (lower === 'internal' || message === 'INTERNAL')) {
    return 'AI request failed on the server. Retry in ~30s. Business admins can verify the configured model key in Admin.';
  }
  return message || 'An error occurred while calling the AI service.';
}

function reportStatusFromError(err: any): void {
  const code = err?.code ?? '';
  const message = err?.message ?? '';
  const lower = message.toLowerCase();
  const friendly = formatCallableError(err);

  if (code === 'functions/resource-exhausted' || lower.includes('resource_exhausted') || lower.includes('quota')) {
    updateApiStatus('degraded', friendly);
  } else if (code === 'functions/unauthenticated') {
    updateApiStatus('offline', friendly);
  } else if (code === 'functions/permission-denied' || lower.includes('not authenticated')) {
    updateApiStatus('offline', friendly);
  } else if (code === 'functions/not-found') {
    updateApiStatus('offline', friendly);
  } else if (code === 'functions/internal') {
    updateApiStatus('degraded', friendly);
  } else if (code === 'functions/unavailable' || lower.includes('network') || lower.includes('failed to fetch')) {
    updateApiStatus('offline', 'Network connection issue. Please check your internet connection.');
  }
}

/** Surfaces callable failures to the status banner and rethrows for local UI error text. */
async function callDedicated<T>(fn: () => Promise<T>): Promise<T> {
  try {
    const result = await fn();
    updateApiStatus('online');
    return result;
  } catch (err) {
    reportStatusFromError(err);
    throw new Error(formatCallableError(err));
  }
}

// ---- Mock interview (stateless callable) -----------------------------------
export interface InterviewQuestion { question: string; category: string; tip: string }
export interface InterviewEvaluation { score: number; strengths: string[]; improvements: string[]; modelAnswer: string }

export const generateInterviewQuestions = async (resumeText: string, jobDescription: string, marketName: string): Promise<InterviewQuestion[]> => {
  const fn = httpsCallable<any, { questions: InterviewQuestion[] }>(firebaseFunctions, 'mockInterview', { timeout: 190_000 });
  const res = await fn({ mode: 'generate', resumeText, jobDescription, marketName, model: currentModelId });
  return res.data.questions;
};

export const evaluateInterviewAnswer = async (question: string, answer: string, jobDescription: string): Promise<InterviewEvaluation> => {
  const fn = httpsCallable<any, InterviewEvaluation>(firebaseFunctions, 'mockInterview', { timeout: 190_000 });
  const res = await fn({ mode: 'evaluate', question, answer, jobDescription, model: currentModelId });
  return res.data;
};

export interface InterviewSessionReport {
  overallScore: number;
  verdict: string; // "Strong Hire" | "Hire" | "Leaning Hire" | "Leaning No Hire" | "No Hire"
  summary: string;
  strengths: string[];
  improvements: string[];
  perQuestion: { question: string; score: number; feedback: string }[];
}

/** Teaser returned to non-included tiers: full report is stored server-side behind a credit unlock. */
export interface LockedSessionReport {
  locked: true;
  reportId: string;
  unlockCredits: number;
  preview: { overallScore: number; firstStrength: string; perQuestionCount: number };
}

export type SessionEvalResult = ({ locked: false } & InterviewSessionReport) | LockedSessionReport;

/** Holistic end-of-interview report over the full timed transcript (free within the session — charged at generate).
 *  Paid tiers receive the full report (locked:false); other tiers receive a locked teaser envelope. */
export const evaluateInterviewSession = async (
  qa: { question: string; answer: string }[],
  jobDescription: string,
  resumeText: string,
): Promise<SessionEvalResult> => {
  const fn = httpsCallable<any, SessionEvalResult>(firebaseFunctions, 'mockInterview', { timeout: 190_000 });
  const res = await fn({ mode: 'evaluate_session', qa, jobDescription, resumeText, model: currentModelId });
  return res.data;
};

/** Pays the one-time unlock price for a stored locked report (idempotent for already-unlocked reports). */
export const unlockInterviewReport = async (reportId: string): Promise<{ locked: false } & InterviewSessionReport> => {
  const fn = httpsCallable<any, { locked: false } & InterviewSessionReport>(firebaseFunctions, 'mockInterview', { timeout: 190_000 });
  const res = await fn({ mode: 'unlock_report', reportId });
  return res.data;
};

// ---- Career coach chat (stateless callable) --------------------------------
export interface CoachMessage { role: 'user' | 'model'; content: string }

export const careerCoach = async (payload: {
  messages: CoachMessage[];
  role?: 'candidate' | 'employer' | null;
  resumeText?: string;
  companyName?: string | null;
  companyWebsite?: string | null;
  companyDescription?: string | null;
}): Promise<string> => {
  const fn = httpsCallable<any, { reply: string }>(firebaseFunctions, 'careerCoach', { timeout: 190_000 });
  const res = await fn({ ...payload, model: currentModelId });
  return res.data.reply;
};

// ---- Resume analysis (dedicated callable) ----------------------------------
export const analyzeResume = async (
  resumeText: string,
  resumeImages: ResumeImage[] | null,
  marketName: string,
): Promise<AnalysisResult & { extractedText?: string }> => {
  return callDedicated(async () => {
    const fn = httpsCallable<any, AnalysisResult & { extractedText?: string }>(firebaseFunctions, 'analyzeResume', { timeout: 190_000 });
    const res = await fn({ resumeText, resumeImages: resumeImages ?? undefined, marketName, model: currentModelId });
    return res.data;
  });
};

// Model routing is platform-managed. The only client override is the business
// custom endpoint, represented by the reserved "custom" id.
const MODEL_STORAGE_KEY = 'preferred_ai_model';
const _stored = typeof localStorage !== 'undefined' ? localStorage.getItem(MODEL_STORAGE_KEY) : null;
let currentModelId: string | undefined = _stored === 'custom' ? 'custom' : undefined;

export const setAiModel = (id: string | undefined): void => {
  currentModelId = id === 'custom' ? 'custom' : undefined;
  try {
    if (currentModelId) localStorage.setItem(MODEL_STORAGE_KEY, currentModelId);
    else localStorage.removeItem(MODEL_STORAGE_KEY);
  } catch { /* localStorage may be unavailable */ }
};

export interface ModelOption { id: string; label: string; minTier: 'free' | 'paid' | 'business' | 'premium' }

/** Shape returned by the listModels callable. */
export interface ListModelsResult {
  tier: 'free' | 'paid' | 'business' | string;
  defaultModelId: string;
  models: ModelOption[];
  isBusiness?: boolean;
}

const DEFAULT_MODEL_OPTIONS: ModelOption[] = [
  { id: 'gemini', label: 'Gemini (default)', minTier: 'free' },
];

/** Returns the models the current user is allowed to select, plus the default. */
export const listModels = async (): Promise<ListModelsResult> => {
  try {
    const fn = httpsCallable<Record<string, never>, ListModelsResult>(firebaseFunctions, 'listModels');
    const res = await fn({});
    return res.data;
  } catch {
    // listModels is a new callable whose Cloud Run invoker may not be set yet.
    return { tier: 'free', defaultModelId: 'gemini', models: DEFAULT_MODEL_OPTIONS, isBusiness: false };
  }
};

// ---- Business custom LLM config --------------------------------------------

export interface SetBusinessLlmConfigPayload {
  base_url: string;
  api_key: string;
  model: string;
}

export type BusinessLlmConfigResult =
  | { configured: false }
  | { configured: true; base_url: string; model: string; api_key_masked: string };

/** Saves the business-tier custom LLM endpoint. Throws for non-business users or bad input. */
export const setBusinessLlmConfig = async (payload: SetBusinessLlmConfigPayload): Promise<{ success: true }> => {
  const fn = httpsCallable<SetBusinessLlmConfigPayload, { success: true }>(firebaseFunctions, 'setBusinessLlmConfig');
  const res = await fn(payload);
  return res.data;
};

/** Retrieves the saved business-tier custom LLM config (api_key_masked only — raw key is never returned). */
export const getBusinessLlmConfig = async (): Promise<BusinessLlmConfigResult> => {
  const fn = httpsCallable<Record<string, never>, BusinessLlmConfigResult>(firebaseFunctions, 'getBusinessLlmConfig');
  const res = await fn({});
  return res.data;
};

// ---- Employer talent discovery (server-side; resumes never reach the browser) --

export interface DiscoveredCandidate {
  id: string;
  nft_staked: boolean;
  compatibilityScore: number;
  summary: string;
  strengths: string[];
  potentialGaps: string[];
  suggestedQuestions: string[];
}

export interface DiscoverTalentResult {
  candidates: DiscoveredCandidate[];
  scanned?: number;
  eligible?: number;
}

/**
 * Server-side talent search. Without a jobDescription it returns the verified
 * (staked) rail; with one it returns AI-scored matches. Candidate resume text
 * stays on the server — clients are rules-blocked from reading other profiles.
 */
export const discoverTalent = (jobDescription?: string): Promise<DiscoverTalentResult> =>
  callDedicated(async () => {
    const fn = httpsCallable<{ jobDescription?: string }, DiscoverTalentResult>(firebaseFunctions, 'discoverTalent');
    const res = await fn(jobDescription ? { jobDescription } : {});
    return res.data;
  });

// ---- Employer applicant funnel (server-side; resumes never reach the browser) --

export interface JobApplicant {
  id: string;
  candidate_name: string;
  application_date: string | null;
  status: string;
  compatibility_score: number;
  summary: string;
  strengths: string[];
  potentialGaps: string[];
  suggestedQuestions: string[];
}

export interface ListJobApplicantsResult {
  applicants: JobApplicant[];
}

/**
 * Returns the applicants for a job the caller owns, each with a server-computed
 * match analysis. Resume text stays on the server (clients are rules-blocked
 * from reading other profiles); viewing applicants is free (no wallet unlock).
 */
export const listJobApplicants = (jobId: string): Promise<ListJobApplicantsResult> =>
  callDedicated(async () => {
    const fn = httpsCallable<{ jobId: string }, ListJobApplicantsResult>(firebaseFunctions, 'listJobApplicants', { timeout: 190_000 });
    const res = await fn({ jobId });
    return res.data;
  });

/**
 * Dispatches a long-tail tool through the consolidated `aiProxy` callable, which
 * applies tier-gated model routing (Gemini / KairLLM / DeepSeek / custom). The
 * legacy per-tool functions are Gemini-only and ignore the selected model — this
 * is why selecting KairLLM/DeepSeek used to have no effect. aiProxy returns
 * `{ data, text, groundingChunks }`; the parsed result is `.data`.
 */
async function callTool<T>(tool: string, payload: Record<string, unknown>): Promise<T> {
  try {
    const fn = httpsCallable<
      { tool: string; payload: Record<string, unknown>; model?: string },
      { data?: T; text?: string; groundingChunks?: unknown }
    >(firebaseFunctions, 'aiProxy', { timeout: 190_000 });
    const res = await fn({ tool, payload, model: currentModelId });
    updateApiStatus('online');
    return (res.data?.data ?? (res.data as unknown)) as T;
  } catch (err) {
    reportStatusFromError(err);
    throw new Error(formatCallableError(err));
  }
}

/** Like callTool, but merges aiProxy's separate groundingChunks back into the result. */
async function callToolWithGrounding<T>(tool: string, payload: Record<string, unknown>): Promise<T> {
  try {
    const fn = httpsCallable<
      { tool: string; payload: Record<string, unknown>; model?: string },
      { data?: Record<string, unknown>; text?: string; groundingChunks?: unknown }
    >(firebaseFunctions, 'aiProxy', { timeout: 190_000 });
    const res = await fn({ tool, payload, model: currentModelId });
    updateApiStatus('online');
    const parsed = res.data?.data;
    if (parsed === undefined || parsed === null) {
      throw new Error('The AI returned an empty or unparseable response. Please try again.');
    }
    return { ...(parsed as object), groundingChunks: res.data?.groundingChunks } as T;
  } catch (err) {
    reportStatusFromError(err);
    throw new Error(formatCallableError(err));
  }
}

// ---- Resume / cover letter / career path (dedicated callables) -------------
export const applyResumeImprovements = (resumeText: string, improvements: Improvement[]) =>
  callTool<{ updatedResumeText: string }>('applyResumeImprovements', { resumeText, improvements });

export const convertResumeFormat = (resumeText: string, marketName: string, coverLetterText?: string) =>
  callTool<FormattedResume>('convertResumeFormat', { resumeText, marketName, coverLetterText });

export const generateCoverLetter = async (resumeText: string, jobDescription: string, marketName: string): Promise<CoverLetter> => {
  const fn = httpsCallable<any, CoverLetter>(firebaseFunctions, 'generateCoverLetter', { timeout: 190_000 });
  const res = await fn({ resumeText, jobDescription, marketName, model: currentModelId });
  return res.data;
};

export const generateCareerPath = async (resumeText: string, desiredRole: string, marketName: string, _session?: Session): Promise<CareerPathResult> => {
  const fn = httpsCallable<any, CareerPathResult>(firebaseFunctions, 'generateCareerPath', { timeout: 190_000 });
  const res = await fn({ resumeText, desiredRole, marketName, model: currentModelId });
  return res.data;
};

// ---- Matching / opportunities ---------------------------------------------
export const calculateCompatibility = (resumeText: string, jobDescription: string) =>
  callTool<{ compatibilityScore: number; summary: string; candidateName?: string }>('calculateCompatibility', { resumeText, jobDescription });

export const findOpportunities = (resumeText: string, marketName: string, _session: Session | null) =>
  callToolWithGrounding<OpportunityResult>('findOpportunities', { resumeText, marketName });

// ---- LinkedIn --------------------------------------------------------------
export const optimizeLinkedInProfile = (resumeText: string, marketName: string) =>
  callTool<LinkedInOptimization>('optimizeLinkedInProfile', { resumeText, marketName });

export const optimizeLinkedInProfileFromText = (profileText: string, resumeText: string, marketName: string, customPrompt?: string, _additionalUrl?: string) =>
  callTool<LinkedInOptimization>('optimizeLinkedInProfileFromText', { profileText, resumeText, marketName, customPrompt });

// ---- Career path helpers ---------------------------------------------------
export const generateSkillBridgeProject = (resumeText: string, desiredRole: string, skill: string) =>
  callTool<SkillBridgeProject>('generateSkillBridgeProject', { resumeText, desiredRole, skill });

// ---- Agile -----------------------------------------------------------------
export const generateAgilePracticeTest = (agileRole: string, agileCertification: string) =>
  callTool<AgilePracticeTestResult>('generateAgilePracticeTest', { agileRole, agileCertification });

// ---- Salary ----------------------------------------------------------------
export const generateSalaryNegotiationStrategy = (resumeText: string, jobTitle: string, company: string, location: string, currentOffer: string, currency: string) =>
  callToolWithGrounding<SalaryNegotiationResult & { groundingChunks: any[] | undefined }>('generateSalaryNegotiationStrategy', { resumeText, jobTitle, company, location, currentOffer, currency });

// ---- EnglishPro ------------------------------------------------------------
export const analyzeEnglishProficiency = (emailText: string, nativeLanguage: string, targetIeltsBand: string) =>
  callTool<EnglishProResult>('analyzeEnglishProficiency', { emailText, nativeLanguage, targetIeltsBand });

export const generateSpeakingTopics = (targetIeltsBand: string) =>
  callTool<{ topics: string[] }>('generateSpeakingTopics', { targetIeltsBand });

export const analyzeSpokenEnglish = (transcript: string, durationSeconds: number, targetIeltsBand: string) =>
  callTool<SpokenEnglishAnalysisResult>('analyzeSpokenEnglish', { transcript, durationSeconds, targetIeltsBand });

export const generateReadingPracticePassage = (targetIeltsBand: string) =>
  callTool<ReadingPracticePassage>('generateReadingPracticePassage', { targetIeltsBand });

export const analyzeEnglishReading = (textToAnalyze: string, targetIeltsBand: string) =>
  callTool<EnglishReadingAnalysisResult>('analyzeEnglishReading', { textToAnalyze, targetIeltsBand });

export const evaluateReadingComprehension = (originalText: string, questionsAndAnswers: ComprehensionQuestion[], userAnswers: string[]) =>
  callTool<ReadingEvaluation[]>('evaluateReadingComprehension', { originalText, questionsAndAnswers, userAnswers });

export const analyzeEnglishListening = (originalText: string, userTranscription: string, targetIeltsBand: string) =>
  callTool<EnglishListeningAnalysisResult>('analyzeEnglishListening', { originalText, userTranscription, targetIeltsBand });

export const generateVocabularyFlashcards = (targetIeltsBand: string) =>
  callTool<{ cards: VocabularyFlashcard[] }>('generateVocabularyFlashcards', { targetIeltsBand });

// ---- Email -----------------------------------------------------------------
export const generateProfessionalEmail = (resumeText: string, scenario: string, details: { [key: string]: string }, marketName: string, tone: number, style: number, confidence: number) =>
  callTool<ProfessionalEmailResult>('generateProfessionalEmail', { resumeText, scenario, details, marketName, tone, style, confidence });

export const generateOutreachEmail = (candidateResumeText: string, jobDescription: string, employerProfile: UserProfile, marketName: string) =>
  callTool<ProfessionalEmailResult>('generateOutreachEmail', { candidateResumeText, jobDescription, employerProfile, marketName });

// ---- Portfolio -------------------------------------------------------------
export const generatePortfolioWebsite = (resumeText: string) =>
  callTool<PortfolioContent>('generatePortfolioWebsite', { resumeText });

// ---- Dashboard / employer helpers ------------------------------------------
export const generateWeeklySummary = (data: any) =>
  callTool<{ summary: string }>('generateWeeklySummary', { data });

export const generateJobDescription = (jobTitle: string, keyResponsibilities: string, companyName: string, companyDescription: string) =>
  callTool<{ jobDescription: string }>('generateJobDescription', { jobTitle, keyResponsibilities, companyName, companyDescription });

export const analyzeSalary = (jobTitle: string, location: string, jobDescription: string) =>
  callTool<{ yearlySalary: string; monthlySalary: string }>('analyzeSalary', { jobTitle, location, jobDescription });

export const checkInclusivity = (jobDescription: string) =>
  callTool<{ suggestions: InclusivitySuggestion[] }>('checkInclusivity', { jobDescription });

export const formatJobDescription = (jobDescription: string) =>
  callTool<{ formattedDescription: string; jobTitle: string | null; location: string | null }>('formatJobDescription', { jobDescription });

export const analyzeCandidateMatch = (resumeText: string, jobDescription: string) =>
  callTool<CandidateMatchAnalysis>('analyzeCandidateMatch', { resumeText, jobDescription });

// ---- Networking / performance / learning -----------------------------------
export const generateNetworkingStrategy = (resumeText: string, targetCompany: string, targetRole: string, targetLocation: string, marketName: string) =>
  callTool<NetworkingStrategyResult>('generateNetworkingStrategy', { resumeText, targetCompany, targetRole, targetLocation, marketName });

export const generatePerformanceReviewPrep = (resumeText: string, userAccomplishments: string, jobTitle: string) =>
  callTool<PerformanceReviewResult>('generatePerformanceReviewPrep', { resumeText, userAccomplishments, jobTitle });

export const generateLearningPlan = (resumeText: string, skillToLearn: string, marketName: string) =>
  callTool<LearningPlanResult>('generateLearningPlan', { resumeText, skillToLearn, marketName });

export const findIndustryEvents = (fieldOfInterest: string, location: string) =>
  callToolWithGrounding<EventScoutResult>('findIndustryEvents', { fieldOfInterest, location });

// ---- Agency ----------------------------------------------------------------
export const anonymizeResume = (resumeText: string, agencyName?: string) =>
  callTool<{ anonymizedText: string }>('anonymizeResume', { resumeText, agencyName });

export const generateClientPitchEmail = (candidateResumeText: string, candidateName: string, jobDescription?: string) =>
  callTool<{ subject: string; body: string }>('generateClientPitchEmail', { candidateResumeText, candidateName, jobDescription });

export const generateCandidatePrepKit = (resumeText: string, jobDescription: string) =>
  callTool<CandidatePrepKit>('generateCandidatePrepKit', { resumeText, jobDescription });

// ---- Image generation & URL extraction (dedicated callables) ---------------
export const generateProfessionalHeadshot = async (imageBase64: string): Promise<string[]> => {
  // Legacy production name is generateProfessionalHeadshot (IAM already set).
  const fn = httpsCallable<any, { images: string[] }>(firebaseFunctions, 'generateProfessionalHeadshot');
  const res = await fn({ imageBase64 });
  return res.data.images;
};

export const extractTextFromUrl = async (url: string): Promise<{ extractedText: string }> => {
  const fn = httpsCallable<any, { extractedText: string }>(firebaseFunctions, 'extractTextFromUrl');
  const res = await fn({ url, model: currentModelId });
  return res.data;
};
