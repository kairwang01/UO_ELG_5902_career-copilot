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

export const TOOL_REGISTRY: Record<string, ToolSpec> = {
  applyResumeImprovements: {
    creditKey: null,
    build: (p) => ({
      prompt:
        `Rewrite this resume applying these improvements:\n` +
        (p.improvements ?? []).map((imp: any) => `- ${imp.area}: ${imp.suggestion}`).join("\n") +
        `\n\nResume:\n${p.resumeText}`,
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
      prompt: `
        You are an expert career consultant specializing in international resume standards. Your task is to localize the following resume for the **${p.marketName}** job market.

        **Key Instructions:**
        1.  **Formatting & Structure:** Reformat the entire resume to strictly adhere to the professional standards, common layout, and ATS (Applicant Tracking System) best practices of **${p.marketName}**. This includes section order, date formats, and contact information conventions.
        2.  **Language & Tone:** Adapt the language, tone, and phrasing to be culturally appropriate and professional for **${p.marketName}**. If the target market's primary language is not English (e.g., Japan, Germany, France), translate the resume content accurately and professionally into the primary language of that country.
        3.  **Content Optimization:** Do not add or remove core experiences, but you may subtly rephrase bullet points to better align with the professional communication style of the target market.

        ${p.coverLetterText ? `**Cover Letter:** If a cover letter is provided below, incorporate it seamlessly into the final document, either before or after the resume as is standard in ${p.marketName}.\n\nCover Letter:\n${p.coverLetterText}` : ""}

        **Original Resume:**
        ${p.resumeText}

        Produce only the final, localized document text.
      `,
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
      prompt: `
        Analyze the resume against the job description.
        Extract the Candidate's Name (use "Candidate" if not found).
        Provide a compatibility score (0-100) and a brief summary.

        Resume: ${p.resumeText}
        Job Description: ${p.jobDescription}
      `,
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
    build: (p) => ({
      prompt: `
        Based on the provided resume for the ${p.marketName} market, perform a comprehensive job search and provide strategic advice.

        **Tasks:**
        1.  **Find Job Postings:** Search all popular internet sources (like LinkedIn, Indeed, company career pages) for relevant job postings published within the **last 2 weeks**. Find up to 15 roles.
        2.  **Provide Job Search Strategies:** Based on the resume and the current job market in ${p.marketName}, provide 3-5 actionable and personalized strategies for the user to improve their job search success.

        **Output Format:**
        Return a single JSON object with two keys:
        - "opportunities": An array of job posting objects (jobTitle, company, location, url, summary).
        - "jobSearchStrategies": An array of strings.

        **Resume:**
        ${p.resumeText}
      `,
      useGoogleSearch: true,
      responseSchema: {
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
      },
    }),
  },

  optimizeLinkedInProfile: {
    creditKey: "linkedin-optimizer",
    build: (p) => ({
      prompt: `Optimize LinkedIn profile for ${p.marketName} based on resume: ${p.resumeText}`,
      responseSchema: LINKEDIN_SCHEMA,
    }),
  },

  optimizeLinkedInProfileFromText: {
    creditKey: "linkedin-optimizer",
    build: (p) => ({
      prompt: `Optimize LinkedIn. Profile: ${p.profileText}\nResume: ${p.resumeText}\nCustom: ${p.customPrompt ?? ""}`,
      responseSchema: LINKEDIN_SCHEMA,
    }),
  },

  generateSkillBridgeProject: {
    creditKey: null,
    build: (p) => ({
      prompt: `Project to learn ${p.skill} for ${p.desiredRole}. Resume: ${p.resumeText}`,
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
      prompt: `Practice test for ${p.agileCertification} for ${p.agileRole}.`,
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
      prompt: `
        You are an expert salary negotiation coach. Analyze the user's situation and provide a comprehensive, data-driven negotiation strategy.
        - User's Job Title: ${p.jobTitle}
        - Company: ${p.company}
        - Location: ${p.location}
        - Current Offer (Base Salary): ${p.currentOffer} ${p.currency}
        - User's Resume Context: ${p.resumeText}

        Perform the following tasks using Google Search for the most up-to-date market data:
        1.  **Market Analysis:** Research the typical salary range for this role, company, and location. Provide a concise summary.
        2.  **Recommended Range:** Suggest a realistic target base salary range (min-max) for the user to counter-offer with. Explain your reasoning.
        3.  **Key Strengths:** Based on the user's resume and the job title, identify 3-5 key strengths they should leverage during negotiation.
        4.  **Negotiation Strategy:** Provide a clear, step-by-step negotiation strategy (3-5 steps).
        5.  **Counter-Offer Email Draft:** Write a professional, concise email draft for the user to send as a counter-offer.
        6.  **Objection Handlers:** Provide advice on how to handle 2-3 common objections.

        Return the result as a single JSON object.
      `,
      useGoogleSearch: true,
      // No responseSchema: googleSearch + free-text JSON, mirroring the old client.
    }),
  },

  analyzeEnglishProficiency: {
    creditKey: "english-pro",
    build: (p) => ({
      prompt: `Analyze English email: ${p.emailText}. Native: ${p.nativeLanguage}. Target: ${p.targetIeltsBand}`,
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
      prompt: `5 IELTS speaking topics for band ${p.targetIeltsBand}`,
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
      prompt: `Analyze spoken English: ${p.transcript}. Duration: ${p.durationSeconds}s. Target: ${p.targetIeltsBand}`,
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
      prompt: `Reading passage for IELTS band ${p.targetIeltsBand}`,
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
      prompt: `Analyze reading text: ${p.textToAnalyze}. Target: ${p.targetIeltsBand}`,
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
      prompt: `Evaluate reading answers. Text: ${p.originalText}. Q&A: ${JSON.stringify(p.questionsAndAnswers)}. User: ${JSON.stringify(p.userAnswers)}`,
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
      prompt: `Analyze listening. Original: ${p.originalText}. User: ${p.userTranscription}. Target: ${p.targetIeltsBand}`,
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
      prompt: `Vocab flashcards for IELTS band ${p.targetIeltsBand}`,
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
      prompt: `Write email. Scenario: ${p.scenario}. Details: ${JSON.stringify(p.details)}. Market: ${p.marketName}. Tone: ${p.tone}. Style: ${p.style}. Confidence: ${p.confidence}. Resume: ${p.resumeText}`,
      responseSchema: EMAIL_SCHEMA,
    }),
  },

  generateOutreachEmail: {
    creditKey: "email-crafter",
    build: (p) => ({
      prompt: `Write outreach email. Candidate: ${p.candidateResumeText}. Job: ${p.jobDescription}. Employer: ${JSON.stringify(p.employerProfile)}. Market: ${p.marketName}`,
      responseSchema: EMAIL_SCHEMA,
    }),
  },

  generatePortfolioWebsite: {
    creditKey: "website-builder",
    build: (p) => ({
      prompt: `Generate portfolio content from resume: ${p.resumeText}`,
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
      prompt: `Weekly summary for data: ${JSON.stringify(p.data)}`,
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
      prompt: `Job description for ${p.jobTitle} at ${p.companyName}. Responsibilities: ${p.keyResponsibilities}`,
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
      prompt: `Salary estimate for ${p.jobTitle} in ${p.location}.`,
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
      prompt: `Inclusivity check for: ${p.jobDescription}`,
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
      prompt: `Format job description: ${p.jobDescription}`,
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
      prompt: `Match resume to job. Resume: ${p.resumeText}. Job: ${p.jobDescription}`,
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
      prompt: `Networking strategy. Resume: ${p.resumeText}. Target: ${p.targetCompany}, ${p.targetRole}, ${p.targetLocation}. Market: ${p.marketName}`,
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
      prompt: `Performance review prep. Title: ${p.jobTitle}. Accomplishments: ${p.userAccomplishments}. Resume: ${p.resumeText}`,
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
      prompt: `Learning plan for ${p.skillToLearn}. Resume: ${p.resumeText}`,
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
      prompt: `Find relevant industry events (conferences, meetups, job fairs) for someone interested in '${p.fieldOfInterest}' in or near '${p.location}'. Also include relevant online/virtual events. For each event, provide the event name, date, location, a brief summary, the event type, and a URL. Return JSON with an "events" array.`,
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
      prompt: `
        You are an expert recruitment consultant working for "${p.agencyName || "Top Recruitment Agency"}".
        Create a "Blind Resume" from the text.
        1. Remove all PII (Name, Email, Phone, Address, Links). Replace Name with "Candidate".
        2. Format cleanly.
        3. Add header "Represented by: ${p.agencyName || "Agency"}".
        Output JSON with key "anonymizedText".

        Resume: ${p.resumeText}
      `,
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
      prompt: `
        Write a recruiter pitch email for candidate ${p.candidateName}.
        Resume: ${p.candidateResumeText}
        Context: ${p.jobDescription ? `Job Description:\n${p.jobDescription}` : "Pitch based on resume experience."}

        Include: Compelling Subject, Hook, 3 Bullet points of "Why", Call to Action.
        Output JSON with "subject" and "body".
      `,
      responseSchema: EMAIL_SCHEMA,
    }),
  },

  generateCandidatePrepKit: {
    creditKey: null,
    build: (p) => ({
      prompt: `
        Create interview prep kit.
        Resume: ${p.resumeText}
        Job: ${p.jobDescription}

        Identify: 3 Weak Spots, 3 Key Projects to Highlight, 5 Predicted Questions.
        Output JSON with keys: "weakSpots", "keyProjects", "predictedQuestions".
      `,
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
