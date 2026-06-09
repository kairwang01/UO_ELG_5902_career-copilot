/**
 * AI tool registry — the server-side source of truth for every generic AI tool.
 *
 * Each entry maps an operation name (the `tool` field the frontend sends to the
 * aiProxy callable) to:
 *   - creditKey: which TOOL_CREDIT_COSTS entry to charge (null = no charge — a
 *                helper / sub-step / employer-or-agency op not in the candidate
 *                credit table). This mapping is a PRODUCT decision; tune freely.
 *   - build:     a pure function turning the request payload into an LLMRequest
 *                (prompt + optional responseSchema + flags). Prompts/schemas are
 *                ported verbatim from the old client services/geminiService.ts.
 *
 * Operations intentionally NOT here (handled elsewhere):
 *   - analyzeResume / generateCoverLetter / generateCareerPath / mockInterview
 *     → dedicated handlers (auth + credit + secret already wired).
 *   - generateProfessionalHeadshot (image output) and extractTextFromUrl (SSRF-
 *     sensitive server fetch) → still client-side; tracked Phase B follow-ups.
 */

import { Type } from "@google/genai";
import { LLMRequest } from "./LLMProvider";
import { buildPrompt } from "./prompts";
import { getOpportunityUseGoogleSearch } from "../config/env";

export interface ToolSpec {
  /** Key into TOOL_CREDIT_COSTS, or null for a free helper/sub-step. */
  creditKey: string | null;
  /** Pure payload → LLMRequest builder. */
  build: (payload: any) => LLMRequest; // eslint-disable-line @typescript-eslint/no-explicit-any
}

// Reused schemas ------------------------------------------------------------
const EMAIL_SCHEMA = {
  type: Type.OBJECT,
  properties: { subject: { type: Type.STRING }, body: { type: Type.STRING } },
  required: ["subject", "body"],
};

const LINKEDIN_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    headline: { type: Type.STRING },
    summary: { type: Type.STRING },
    experienceSuggestions: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: { title: { type: Type.STRING }, suggestion: { type: Type.STRING } },
      },
    },
  },
  required: ["headline", "summary", "experienceSuggestions"],
};

const OPPORTUNITY_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    opportunities: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          jobTitle: { type: Type.STRING },
          company: { type: Type.STRING },
          location: { type: Type.STRING },
          url: { type: Type.STRING },
          summary: { type: Type.STRING },
        },
        required: ["jobTitle", "company", "location", "url", "summary"],
      },
    },
    jobSearchStrategies: { type: Type.ARRAY, items: { type: Type.STRING } },
  },
  required: ["opportunities", "jobSearchStrategies"],
};

export const TOOL_REGISTRY: Record<string, ToolSpec> = {
  applyResumeImprovements: {
    creditKey: null,
    build: (p) => ({
      prompt: buildPrompt("applyResumeImprovements", {
        improvementsBlock: (p.improvements ?? [])
          .map((imp: any) => `- ${imp.area}: ${imp.suggestion}`)
          .join("\n"),
        resumeText: p.resumeText,
      }),
      responseSchema: {
        type: Type.OBJECT,
        properties: { updatedResumeText: { type: Type.STRING } },
        required: ["updatedResumeText"],
      },
    }),
  },

  convertResumeFormat: {
    creditKey: "resume-formatter",
    build: (p) => ({
      prompt: buildPrompt("convertResumeFormat", {
        marketName: p.marketName,
        coverLetterBlock: p.coverLetterText
          ? `**Cover Letter:** If a cover letter is provided below, incorporate it seamlessly into the final document, either before or after the resume as is standard in ${p.marketName}.\n\nCover Letter:\n${p.coverLetterText}`
          : "",
        resumeText: p.resumeText,
      }),
      responseSchema: {
        type: Type.OBJECT,
        properties: { formattedText: { type: Type.STRING } },
        required: ["formattedText"],
      },
    }),
  },

  calculateCompatibility: {
    creditKey: null,
    build: (p) => ({
      prompt: buildPrompt("calculateCompatibility", {
        resumeText: p.resumeText,
        jobDescription: p.jobDescription,
      }),
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          candidateName: { type: Type.STRING },
          compatibilityScore: { type: Type.NUMBER },
          summary: { type: Type.STRING },
        },
        required: ["compatibilityScore", "summary"],
      },
    }),
  },

  findOpportunities: {
    creditKey: "opportunity-finder",
    build: (p) => {
      const useGoogleSearch = getOpportunityUseGoogleSearch();
      return {
        prompt: buildPrompt(
          useGoogleSearch ? "findOpportunities" : "findOpportunitiesOffline",
          {
            marketName: p.marketName,
            resumeText: p.resumeText,
          }
        ),
        useGoogleSearch,
        responseSchema: OPPORTUNITY_SCHEMA,
      };
    },
  },

  optimizeLinkedInProfile: {
    creditKey: "linkedin-optimizer",
    build: (p) => ({
      prompt: buildPrompt("optimizeLinkedInProfile", {
        marketName: p.marketName,
        resumeText: p.resumeText,
      }),
      responseSchema: LINKEDIN_SCHEMA,
    }),
  },

  optimizeLinkedInProfileFromText: {
    creditKey: "linkedin-optimizer",
    build: (p) => ({
      prompt: buildPrompt("optimizeLinkedInProfileFromText", {
        profileText: p.profileText,
        resumeText: p.resumeText,
        customPrompt: p.customPrompt ?? "",
      }),
      responseSchema: LINKEDIN_SCHEMA,
    }),
  },

  generateSkillBridgeProject: {
    creditKey: null,
    build: (p) => ({
      prompt: buildPrompt("generateSkillBridgeProject", {
        skill: p.skill,
        desiredRole: p.desiredRole,
        resumeText: p.resumeText,
      }),
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          projectTitle: { type: Type.STRING },
          objective: { type: Type.STRING },
          keyFeatures: { type: Type.ARRAY, items: { type: Type.STRING } },
          suggestedTechStack: { type: Type.ARRAY, items: { type: Type.STRING } },
          showcaseChallenge: { type: Type.STRING },
        },
        required: ["projectTitle", "objective", "keyFeatures", "suggestedTechStack", "showcaseChallenge"],
      },
    }),
  },

  generateAgilePracticeTest: {
    creditKey: "agile-coach",
    build: (p) => ({
      prompt: buildPrompt("generateAgilePracticeTest", {
        agileCertification: p.agileCertification,
        agileRole: p.agileRole,
      }),
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          examTitle: { type: Type.STRING },
          practiceQuestions: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                questionText: { type: Type.STRING },
                options: { type: Type.ARRAY, items: { type: Type.STRING } },
                correctAnswerIndex: { type: Type.NUMBER },
                explanation: { type: Type.STRING },
              },
            },
          },
          examTips: { type: Type.ARRAY, items: { type: Type.STRING } },
        },
        required: ["examTitle", "practiceQuestions", "examTips"],
      },
    }),
  },

  generateSalaryNegotiationStrategy: {
    creditKey: "salary-negotiation",
    build: (p) => ({
      prompt: buildPrompt("generateSalaryNegotiationStrategy", {
        jobTitle: p.jobTitle,
        company: p.company,
        location: p.location,
        currentOffer: p.currentOffer,
        currency: p.currency,
        resumeText: p.resumeText,
      }),
      useGoogleSearch: true,
      // No responseSchema: googleSearch + free-text JSON, mirroring the old client.
    }),
  },

  analyzeEnglishProficiency: {
    creditKey: "english-pro",
    build: (p) => ({
      prompt: buildPrompt("analyzeEnglishProficiency", {
        emailText: p.emailText,
        nativeLanguage: p.nativeLanguage,
        targetIeltsBand: p.targetIeltsBand,
      }),
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          overallBand: { type: Type.OBJECT, properties: { level: { type: Type.STRING }, description: { type: Type.STRING } } },
          summary: { type: Type.STRING },
          strengths: { type: Type.ARRAY, items: { type: Type.STRING } },
          improvementAreas: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                category: { type: Type.STRING },
                originalText: { type: Type.STRING },
                suggestion: { type: Type.STRING },
                explanation: { type: Type.STRING },
              },
            },
          },
          correctedEmail: { type: Type.STRING },
          culturalTip: { type: Type.STRING },
        },
        required: ["overallBand", "summary", "strengths", "improvementAreas", "correctedEmail"],
      },
    }),
  },

  generateSpeakingTopics: {
    creditKey: null,
    build: (p) => ({
      prompt: buildPrompt("generateSpeakingTopics", {
        targetIeltsBand: p.targetIeltsBand,
      }),
      responseSchema: {
        type: Type.OBJECT,
        properties: { topics: { type: Type.ARRAY, items: { type: Type.STRING } } },
        required: ["topics"],
      },
    }),
  },

  analyzeSpokenEnglish: {
    creditKey: "english-pro",
    build: (p) => ({
      prompt: buildPrompt("analyzeSpokenEnglish", {
        transcript: p.transcript,
        durationSeconds: p.durationSeconds,
        targetIeltsBand: p.targetIeltsBand,
      }),
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          transcript: { type: Type.STRING },
          clarityScore: { type: Type.NUMBER },
          pacingWPM: { type: Type.NUMBER },
          fillerWords: {
            type: Type.ARRAY,
            items: { type: Type.OBJECT, properties: { word: { type: Type.STRING }, count: { type: Type.NUMBER } } },
          },
          feedbackSummary: { type: Type.STRING },
          improvementSuggestions: { type: Type.ARRAY, items: { type: Type.STRING } },
        },
        required: ["transcript", "clarityScore", "pacingWPM", "fillerWords", "feedbackSummary", "improvementSuggestions"],
      },
    }),
  },

  generateReadingPracticePassage: {
    creditKey: null,
    build: (p) => ({
      prompt: buildPrompt("generateReadingPracticePassage", {
        targetIeltsBand: p.targetIeltsBand,
      }),
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          passage: { type: Type.STRING },
          comprehensionQuestions: {
            type: Type.ARRAY,
            items: { type: Type.OBJECT, properties: { question: { type: Type.STRING }, answer: { type: Type.STRING } } },
          },
        },
        required: ["passage", "comprehensionQuestions"],
      },
    }),
  },

  analyzeEnglishReading: {
    creditKey: "english-pro",
    build: (p) => ({
      prompt: buildPrompt("analyzeEnglishReading", {
        textToAnalyze: p.textToAnalyze,
        targetIeltsBand: p.targetIeltsBand,
      }),
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          summary: { type: Type.STRING },
          vocabularyList: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: { word: { type: Type.STRING }, definition: { type: Type.STRING }, example: { type: Type.STRING } },
            },
          },
          comprehensionQuestions: {
            type: Type.ARRAY,
            items: { type: Type.OBJECT, properties: { question: { type: Type.STRING }, answer: { type: Type.STRING } } },
          },
        },
        required: ["summary", "vocabularyList", "comprehensionQuestions"],
      },
    }),
  },

  evaluateReadingComprehension: {
    creditKey: null,
    build: (p) => ({
      prompt: buildPrompt("evaluateReadingComprehension", {
        originalText: p.originalText,
        questionsAndAnswers: JSON.stringify(p.questionsAndAnswers),
        userAnswers: JSON.stringify(p.userAnswers),
      }),
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: { isCorrect: { type: Type.BOOLEAN }, feedback: { type: Type.STRING } },
          required: ["isCorrect", "feedback"],
        },
      },
    }),
  },

  analyzeEnglishListening: {
    creditKey: "english-pro",
    build: (p) => ({
      prompt: buildPrompt("analyzeEnglishListening", {
        originalText: p.originalText,
        userTranscription: p.userTranscription,
        targetIeltsBand: p.targetIeltsBand,
      }),
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          similarityScore: { type: Type.NUMBER },
          diffView: { type: Type.STRING },
          feedbackOnCommonErrors: { type: Type.ARRAY, items: { type: Type.STRING } },
          originalTranscript: { type: Type.STRING },
        },
        required: ["similarityScore", "diffView", "feedbackOnCommonErrors", "originalTranscript"],
      },
    }),
  },

  generateVocabularyFlashcards: {
    creditKey: null,
    build: (p) => ({
      prompt: buildPrompt("generateVocabularyFlashcards", {
        targetIeltsBand: p.targetIeltsBand,
      }),
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          cards: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                word: { type: Type.STRING },
                definition: { type: Type.STRING },
                distractors: { type: Type.ARRAY, items: { type: Type.STRING } },
              },
            },
          },
        },
        required: ["cards"],
      },
    }),
  },

  generateProfessionalEmail: {
    creditKey: "email-crafter",
    build: (p) => ({
      prompt: buildPrompt("generateProfessionalEmail", {
        scenario: p.scenario,
        details: JSON.stringify(p.details),
        marketName: p.marketName,
        tone: p.tone,
        style: p.style,
        confidence: p.confidence,
        resumeText: p.resumeText,
      }),
      responseSchema: EMAIL_SCHEMA,
    }),
  },

  generateOutreachEmail: {
    creditKey: "email-crafter",
    build: (p) => ({
      prompt: buildPrompt("generateOutreachEmail", {
        candidateResumeText: p.candidateResumeText,
        jobDescription: p.jobDescription,
        employerProfile: JSON.stringify(p.employerProfile),
        marketName: p.marketName,
      }),
      responseSchema: EMAIL_SCHEMA,
    }),
  },

  generatePortfolioWebsite: {
    creditKey: "website-builder",
    build: (p) => ({
      prompt: buildPrompt("generatePortfolioWebsite", {
        resumeText: p.resumeText,
      }),
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          fullName: { type: Type.STRING },
          firstName: { type: Type.STRING },
          lastName: { type: Type.STRING },
          contactEmail: { type: Type.STRING },
          contactPhone: { type: Type.STRING },
          contactLocation: { type: Type.STRING },
          socials: {
            type: Type.OBJECT,
            properties: { linkedin: { type: Type.STRING }, github: { type: Type.STRING }, twitter: { type: Type.STRING } },
          },
          skills: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: { icon: { type: Type.STRING }, category: { type: Type.STRING }, description: { type: Type.STRING } },
            },
          },
          experience: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: { date: { type: Type.STRING }, title: { type: Type.STRING }, company: { type: Type.STRING }, description: { type: Type.STRING } },
            },
          },
        },
        required: ["fullName", "firstName", "lastName", "contactEmail", "contactPhone", "contactLocation", "socials", "skills", "experience"],
      },
    }),
  },

  generateWeeklySummary: {
    creditKey: null,
    build: (p) => ({
      prompt: buildPrompt("generateWeeklySummary", {
        data: JSON.stringify(p.data),
      }),
      responseSchema: {
        type: Type.OBJECT,
        properties: { summary: { type: Type.STRING } },
        required: ["summary"],
      },
    }),
  },

  generateJobDescription: {
    creditKey: null,
    build: (p) => ({
      prompt: buildPrompt("generateJobDescription", {
        jobTitle: p.jobTitle,
        companyName: p.companyName,
        keyResponsibilities: p.keyResponsibilities,
      }),
      responseSchema: {
        type: Type.OBJECT,
        properties: { jobDescription: { type: Type.STRING } },
        required: ["jobDescription"],
      },
    }),
  },

  analyzeSalary: {
    creditKey: null,
    build: (p) => ({
      prompt: buildPrompt("analyzeSalary", {
        jobTitle: p.jobTitle,
        location: p.location,
      }),
      responseSchema: {
        type: Type.OBJECT,
        properties: { yearlySalary: { type: Type.STRING }, monthlySalary: { type: Type.STRING } },
        required: ["yearlySalary", "monthlySalary"],
      },
    }),
  },

  checkInclusivity: {
    creditKey: null,
    build: (p) => ({
      prompt: buildPrompt("checkInclusivity", {
        jobDescription: p.jobDescription,
      }),
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          suggestions: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: { originalText: { type: Type.STRING }, suggestion: { type: Type.STRING }, explanation: { type: Type.STRING } },
            },
          },
        },
        required: ["suggestions"],
      },
    }),
  },

  formatJobDescription: {
    creditKey: null,
    build: (p) => ({
      prompt: buildPrompt("formatJobDescription", {
        jobDescription: p.jobDescription,
      }),
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          formattedDescription: { type: Type.STRING },
          jobTitle: { type: Type.STRING },
          location: { type: Type.STRING },
        },
        required: ["formattedDescription"],
      },
    }),
  },

  analyzeCandidateMatch: {
    creditKey: null,
    build: (p) => ({
      prompt: buildPrompt("analyzeCandidateMatch", {
        resumeText: p.resumeText,
        jobDescription: p.jobDescription,
      }),
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          score: { type: Type.NUMBER },
          summary: { type: Type.STRING },
          strengths: { type: Type.ARRAY, items: { type: Type.STRING } },
          potentialGaps: { type: Type.ARRAY, items: { type: Type.STRING } },
          suggestedQuestions: { type: Type.ARRAY, items: { type: Type.STRING } },
        },
        required: ["score", "summary", "strengths", "potentialGaps", "suggestedQuestions"],
      },
    }),
  },

  generateNetworkingStrategy: {
    creditKey: "networking-assistant",
    build: (p) => ({
      prompt: buildPrompt("generateNetworkingStrategy", {
        resumeText: p.resumeText,
        targetCompany: p.targetCompany,
        targetRole: p.targetRole,
        targetLocation: p.targetLocation,
        marketName: p.marketName,
      }),
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          strategySummary: { type: Type.STRING },
          contactSuggestions: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: { contactType: { type: Type.STRING }, reason: { type: Type.STRING }, outreachMessage: { type: Type.STRING } },
            },
          },
        },
        required: ["strategySummary", "contactSuggestions"],
      },
    }),
  },

  generatePerformanceReviewPrep: {
    creditKey: "performance-review-prep",
    build: (p) => ({
      prompt: buildPrompt("generatePerformanceReviewPrep", {
        jobTitle: p.jobTitle,
        userAccomplishments: p.userAccomplishments,
        resumeText: p.resumeText,
      }),
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          summary: { type: Type.STRING },
          strengthsToHighlight: { type: Type.ARRAY, items: { type: Type.STRING } },
          talkingPoints: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: { accomplishment: { type: Type.STRING }, starMethodPoint: { type: Type.STRING } },
            },
          },
          growthAreaDiscussionPoints: { type: Type.ARRAY, items: { type: Type.STRING } },
        },
        required: ["summary", "strengthsToHighlight", "talkingPoints", "growthAreaDiscussionPoints"],
      },
    }),
  },

  generateLearningPlan: {
    creditKey: "skill-learning-plan",
    build: (p) => ({
      prompt: buildPrompt("generateLearningPlan", {
        skillToLearn: p.skillToLearn,
        resumeText: p.resumeText,
      }),
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          skill: { type: Type.STRING },
          summary: { type: Type.STRING },
          learningPhases: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                phaseTitle: { type: Type.STRING },
                duration: { type: Type.STRING },
                keyActivities: { type: Type.ARRAY, items: { type: Type.STRING } },
                milestone: { type: Type.STRING },
              },
            },
          },
          suggestedProjects: { type: Type.ARRAY, items: { type: Type.STRING } },
        },
        required: ["skill", "summary", "learningPhases", "suggestedProjects"],
      },
    }),
  },

  findIndustryEvents: {
    creditKey: "industry-event-scout",
    build: (p) => ({
      prompt: buildPrompt("findIndustryEvents", {
        fieldOfInterest: p.fieldOfInterest,
        location: p.location,
      }),
      useGoogleSearch: true,
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          events: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                eventName: { type: Type.STRING },
                date: { type: Type.STRING },
                location: { type: Type.STRING },
                url: { type: Type.STRING },
                summary: { type: Type.STRING },
                eventType: { type: Type.STRING, enum: ["conference", "meetup", "job_fair", "other"] },
              },
            },
          },
        },
      },
    }),
  },

  anonymizeResume: {
    creditKey: null,
    build: (p) => ({
      prompt: buildPrompt("anonymizeResume", {
        agencyName: p.agencyName || "Top Recruitment Agency",
        agencyNameOrDefault: p.agencyName || "Agency",
        resumeText: p.resumeText,
      }),
      responseSchema: {
        type: Type.OBJECT,
        properties: { anonymizedText: { type: Type.STRING } },
        required: ["anonymizedText"],
      },
    }),
  },

  generateClientPitchEmail: {
    creditKey: null,
    build: (p) => ({
      prompt: buildPrompt("generateClientPitchEmail", {
        candidateName: p.candidateName,
        candidateResumeText: p.candidateResumeText,
        jobDescriptionBlock: p.jobDescription
          ? `Job Description:\n${p.jobDescription}`
          : "Pitch based on resume experience.",
      }),
      responseSchema: EMAIL_SCHEMA,
    }),
  },

  generateCandidatePrepKit: {
    creditKey: null,
    build: (p) => ({
      prompt: buildPrompt("generateCandidatePrepKit", {
        resumeText: p.resumeText,
        jobDescription: p.jobDescription,
      }),
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          weakSpots: { type: Type.ARRAY, items: { type: Type.STRING } },
          keyProjects: { type: Type.ARRAY, items: { type: Type.STRING } },
          predictedQuestions: { type: Type.ARRAY, items: { type: Type.STRING } },
        },
        required: ["weakSpots", "keyProjects", "predictedQuestions"],
      },
    }),
  },
};
