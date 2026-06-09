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
    return 'Gemini API quota exceeded. Wait about 30 seconds and try again, or ask the project admin to check API key billing in Google AI Studio.';
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
    return 'AI request failed on the server. This is often a Gemini quota or API-key issue — wait 30s and retry, or check billing on the key in Google AI Studio.';
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
  const fn = httpsCallable<any, { questions: InterviewQuestion[] }>(firebaseFunctions, 'mockInterview');
  const res = await fn({ mode: 'generate', resumeText, jobDescription, marketName, model: currentModelId });
  return res.data.questions;
};

export const evaluateInterviewAnswer = async (question: string, answer: string, jobDescription: string): Promise<InterviewEvaluation> => {
  const fn = httpsCallable<any, InterviewEvaluation>(firebaseFunctions, 'mockInterview');
  const res = await fn({ mode: 'evaluate', question, answer, jobDescription, model: currentModelId });
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
  const fn = httpsCallable<any, { reply: string }>(firebaseFunctions, 'careerCoach');
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
    const fn = httpsCallable<any, AnalysisResult & { extractedText?: string }>(firebaseFunctions, 'analyzeResume');
    const res = await fn({ resumeText, resumeImages: resumeImages ?? undefined, marketName, model: currentModelId });
    return res.data;
  });
};

// Model selection — paid+ users can pick a model; the choice is gated server-side
// (free users always fall back to the default regardless of what's sent here).
const MODEL_STORAGE_KEY = 'preferred_ai_model';
let currentModelId: string | undefined =
  (typeof localStorage !== 'undefined' ? localStorage.getItem(MODEL_STORAGE_KEY) : null) || undefined;

export const getAiModel = (): string | undefined => currentModelId;
export const setAiModel = (id: string | undefined): void => {
  currentModelId = id;
  try {
    if (id) localStorage.setItem(MODEL_STORAGE_KEY, id);
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

/**
 * Calls the legacy per-tool callable on production (e.g. findOpportunities).
 * The consolidated aiProxy callable lacks Cloud Run invoker IAM for this deployer;
 * the 40 existing tool functions already have invoker access from the original deploy.
 */
async function callTool<T>(tool: string, payload: Record<string, unknown>): Promise<T> {
  try {
    const fn = httpsCallable<Record<string, unknown>, T>(firebaseFunctions, tool);
    const res = await fn({ ...payload, model: currentModelId });
    updateApiStatus('online');
    return res.data;
  } catch (err) {
    reportStatusFromError(err);
    throw new Error(formatCallableError(err));
  }
}

/** Same as callTool — legacy callables return groundingChunks inline when present. */
async function callToolWithGrounding<T>(tool: string, payload: Record<string, unknown>): Promise<T> {
  return callTool<T>(tool, payload);
}

// ---- Resume / cover letter / career path (dedicated callables) -------------
export const applyResumeImprovements = (resumeText: string, improvements: Improvement[]) =>
  callTool<{ updatedResumeText: string }>('applyResumeImprovements', { resumeText, improvements });

export const convertResumeFormat = (resumeText: string, marketName: string, coverLetterText?: string) =>
  callTool<FormattedResume>('convertResumeFormat', { resumeText, marketName, coverLetterText });

export const generateCoverLetter = async (resumeText: string, jobDescription: string, marketName: string): Promise<CoverLetter> => {
  const fn = httpsCallable<any, CoverLetter>(firebaseFunctions, 'generateCoverLetter');
  const res = await fn({ resumeText, jobDescription, marketName, model: currentModelId });
  return res.data;
};

export const generateCareerPath = async (resumeText: string, desiredRole: string, marketName: string, _session?: Session): Promise<CareerPathResult> => {
  const fn = httpsCallable<any, CareerPathResult>(firebaseFunctions, 'generateCareerPath');
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
