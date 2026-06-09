/**
 * Cloud Functions entry point.
 *
 * All exported symbols from this file become callable/HTTP Cloud Functions.
 *
 * Phase A:  analyzeResume        — AI proxy, key server-side
 * Phase B:  mockInterview        — interview question generation + answer evaluation
 *           generateCoverLetter  — cover letter generation
 *           generateCareerPath   — career roadmap planning
 *           onUserCreated        — Auth trigger: provision users/{uid} on registration
 * Phase C:  createCheckout, stripeWebhook, publicApi
 */

import { setGlobalOptions } from "firebase-functions/v2/options";

// Region must match the frontend Functions client (lib/firebaseClient.ts → us-central1).
// Secrets are declared per-handler (onCall({ secrets: [...] })), not globally.
setGlobalOptions({
  region: "us-central1",
  memory: "512MiB",
  timeoutSeconds: 60,
  maxInstances: 10,
});

export { aiProxyFunction              as aiProxy               } from "./handlers/aiProxy";
export { generateHeadshotFunction     as generateHeadshot      } from "./handlers/generateHeadshot";
export { extractTextFromUrlFunction   as extractTextFromUrl    } from "./handlers/extractTextFromUrl";
export { careerCoachFunction          as careerCoach           } from "./handlers/careerCoach";
export { listModelsFunction           as listModels            } from "./handlers/listModels";
export { analyzeResumeFunction        as analyzeResume         } from "./handlers/analyzeResume";
export { mockInterviewFunction        as mockInterview         } from "./handlers/mockInterview";
export { generateCoverLetterFunction  as generateCoverLetter   } from "./handlers/generateCoverLetter";
export { generateCareerPathFunction   as generateCareerPath    } from "./handlers/generateCareerPath";
export { setSubscriptionStatusFunction as setSubscriptionStatus } from "./handlers/setSubscriptionStatus";
export { onUserCreatedFunction        as onUserCreated         } from "./handlers/onUserCreated";
