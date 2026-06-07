/**
 * Cloud Functions entry point.
 *
 * All exported symbols from this file become callable/HTTP Cloud Functions.
 *
 * Phase A:  analyzeResume        — AI proxy, key server-side
 * Phase B:  mockInterview        — interview question generation + answer evaluation
 *           generateCoverLetter  — cover letter generation
 *           generateCareerPath   — career roadmap planning
 * Phase C:  createCheckout, stripeWebhook, publicApi
 */

export { analyzeResumeFunction        as analyzeResume        } from "./handlers/analyzeResume";
export { mockInterviewFunction        as mockInterview        } from "./handlers/mockInterview";
export { generateCoverLetterFunction  as generateCoverLetter  } from "./handlers/generateCoverLetter";
export { generateCareerPathFunction   as generateCareerPath   } from "./handlers/generateCareerPath";
