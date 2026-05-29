/**
 * Cloud Functions entry point.
 *
 * All exported symbols from this file become callable/HTTP Cloud Functions.
 * Add new handlers here as they are implemented.
 *
 * Phase A:  analyzeResume (AI proxy — auth verified, key server-side)
 * Phase B:  mockInterview, careerPath, coverLetter, ... (replicate the pattern)
 * Phase C:  createCheckout, stripeWebhook, publicApi
 */

export { analyzeResumeFunction as analyzeResume } from "./handlers/analyzeResume";
