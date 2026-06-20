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
// API keys are plain env vars from functions/.env (test-phase; no Secret Manager bindings).
setGlobalOptions({
  region: "us-central1",
  memory: "512MiB",
  timeoutSeconds: 60,
  maxInstances: 10,
});

export { aiProxyFunction              as aiProxy               } from "./handlers/aiProxy";
export { discoverTalentFunction       as discoverTalent        } from "./handlers/discoverTalent";
export { onApplicationStatusChangeFunction as onApplicationStatusChange } from "./handlers/notifications";
export { generateHeadshotFunction     as generateHeadshot      } from "./handlers/generateHeadshot";
export { generateHeadshotFunction     as generateProfessionalHeadshot } from "./handlers/generateHeadshot";
export { extractTextFromUrlFunction   as extractTextFromUrl    } from "./handlers/extractTextFromUrl";
export { careerCoachFunction          as careerCoach           } from "./handlers/careerCoach";
export { listModelsFunction           as listModels            } from "./handlers/listModels";
export { analyzeResumeFunction        as analyzeResume         } from "./handlers/analyzeResume";
export { mockInterviewFunction        as mockInterview         } from "./handlers/mockInterview";
export { generateCoverLetterFunction  as generateCoverLetter   } from "./handlers/generateCoverLetter";
export { generateCareerPathFunction   as generateCareerPath    } from "./handlers/generateCareerPath";
export { setSubscriptionStatusFunction as setSubscriptionStatus } from "./handlers/setSubscriptionStatus";
export { grantMonthlyCreditsFunction  as grantMonthlyCredits   } from "./handlers/grantMonthlyCredits";
export { onUserCreatedFunction        as onUserCreated         } from "./handlers/onUserCreated";
export { createJobApplicationFunction as createJobApplication  } from "./handlers/jobApplications";
export { updateApplicationStatusFunction as updateApplicationStatus } from "./handlers/updateApplicationStatus";
export { listJobApplicantsFunction    as listJobApplicants     } from "./handlers/listJobApplicants";
export { getApplicantResumeFileFunction as getApplicantResumeFile } from "./handlers/getApplicantResumeFile";
export { getApplicantResumeTextFunction as getApplicantResumeText } from "./handlers/getApplicantResumeText";
export { adminGetDashboardFunction    as adminGetDashboard     } from "./handlers/adminPortal";
export { adminGetLlmConfigFunction   as adminGetLlmConfig     } from "./handlers/adminPortal";
export { adminUpdateLlmConfigFunction as adminUpdateLlmConfig } from "./handlers/adminPortal";
export { adminGetQuotasFunction      as adminGetQuotas        } from "./handlers/adminPortal";
export { adminUpdateQuotasFunction   as adminUpdateQuotas     } from "./handlers/adminPortal";
export { adminListUsersFunction      as adminListUsers        } from "./handlers/adminPortal";
export { adminGetUserReportFunction  as adminGetUserReport    } from "./handlers/adminPortal";
export { adminAdjustCreditsFunction  as adminAdjustCredits    } from "./handlers/adminPortal";
export { adminSetSubscriptionFunction as adminSetSubscription } from "./handlers/adminPortal";
export { adminSetAdminFunction       as adminSetAdmin         } from "./handlers/adminPortal";
export { adminListAdminsFunction     as adminListAdmins       } from "./handlers/adminPortal";
export { adminCheckAccessFunction    as adminCheckAccess      } from "./handlers/adminPortal";
export { adminGetAuditLogFunction    as adminGetAuditLog      } from "./handlers/adminPortal";
export { adminInviteAdminFunction    as adminInviteAdmin      } from "./handlers/adminPortal";
export { adminSetAdminRoleFunction   as adminSetAdminRole     } from "./handlers/adminPortal";
export { adminRemoveAdminFunction    as adminRemoveAdmin      } from "./handlers/adminPortal";
export { adminWhoAmIFunction         as adminWhoAmI           } from "./handlers/adminPortal";
export { setBusinessLlmConfigFunction as setBusinessLlmConfig } from "./handlers/businessLlm";
export { getBusinessLlmConfigFunction as getBusinessLlmConfig } from "./handlers/businessLlm";
export { adminListModelsFunction       as adminListModels      } from "./handlers/adminModels";
export { adminUpsertModelFunction      as adminUpsertModel     } from "./handlers/adminModels";
export { adminDeleteModelFunction      as adminDeleteModel     } from "./handlers/adminModels";
export { adminSetDefaultModelFunction  as adminSetDefaultModel } from "./handlers/adminModels";
export { createCompanyReviewFunction   as createCompanyReview  } from "./handlers/companyReviews";
export { listCompanyReviewsFunction    as listCompanyReviews   } from "./handlers/companyReviews";
export { onCompanyReviewWrittenFunction as onCompanyReviewWritten } from "./handlers/companyReviews";
export { onApplicationStatusEventCreatedFunction as onApplicationStatusEventCreated } from "./handlers/responsiveness";
export { adminGetPromptsFunction            as adminGetPrompts           } from "./handlers/adminPrompts";
export { adminUpdatePromptFunction          as adminUpdatePrompt         } from "./handlers/adminPrompts";
export { adminResetPromptFunction           as adminResetPrompt          } from "./handlers/adminPrompts";
export { adminSavePromptDraftFunction       as adminSavePromptDraft      } from "./handlers/adminPrompts";
export { adminPublishPromptFunction         as adminPublishPrompt        } from "./handlers/adminPrompts";
export { adminRollbackPromptFunction        as adminRollbackPrompt       } from "./handlers/adminPrompts";
export { adminListPromptVersionsFunction    as adminListPromptVersions   } from "./handlers/adminPrompts";
export { adminTestModelFunction             as adminTestModel            } from "./handlers/adminTestModel";
export { createJobPostingFunction           as createJobPosting          } from "./handlers/jobPostings";
export { updateJobPostingFunction           as updateJobPosting          } from "./handlers/jobPostings";
export { setJobPostingActiveFunction        as setJobPostingActive       } from "./handlers/jobPostings";
export { scheduleInterviewFunction          as scheduleInterview         } from "./handlers/interviews";
export { updateInterviewFunction            as updateInterview           } from "./handlers/interviews";
export { confirmInterviewFunction           as confirmInterview          } from "./handlers/interviews";
export { upsertScorecardFunction            as upsertScorecard           } from "./handlers/scorecards";
export { createCheckoutSessionFunction      as createCheckoutSession     } from "./handlers/stripeBilling";
export { stripeWebhookFunction              as stripeWebhook             } from "./handlers/stripeBilling";
