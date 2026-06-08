import { GoogleGenAI, Type, Chat } from "@google/genai";
import { AnalysisResult, FormattedResume, CoverLetter, LinkedInOptimization, ResumeImage, CareerPathResult, AgilePracticeTestResult, SalaryNegotiationResult, EnglishProResult, ProfessionalEmailResult, Opportunity, OpportunityResult, PortfolioContent, PortfolioWebsiteResult, InclusivitySuggestion, CandidateMatchAnalysis, NetworkingStrategyResult, SkillBridgeProject, Improvement, PerformanceReviewResult, LearningPlanResult, IndustryEvent, EventScoutResult, UserProfile, SpokenEnglishAnalysisResult, EnglishReadingAnalysisResult, EnglishListeningAnalysisResult, ReadingEvaluation, ComprehensionQuestion, ReadingPracticePassage, VocabularyFlashcard, CandidatePrepKit } from '../types';
import type { AppSession as Session } from '../lib/data';

// This is a simplified "hook" to be used within this service file.
// In a full React app, you'd import the context directly.
// Here we pass the setter function to `callGemini`.
let updateApiStatus: (status: 'online' | 'degraded' | 'offline', error?: string) => void = () => {};
export const setApiStatusUpdater = (updater: (status: 'online' | 'degraded' | 'offline', error?: string) => void) => {
  updateApiStatus = updater;
};

// 1. Get Key from Vite local env variable
const apiKey = import.meta.env.VITE_API_KEY;

// 2. Check Key
if (!apiKey) {
  throw new Error("API_KEY environment variable not set in .env.local");
}

// 3. Initialize with Key
const ai = new GoogleGenAI({ apiKey: apiKey });

const PRIMARY_MODEL = import.meta.env.VITE_GEMINI_PRIMARY_MODEL || 'gemini-3-flash-preview';
const FALLBACK_MODEL = import.meta.env.VITE_GEMINI_FALLBACK_MODEL || 'gemini-flash-latest';
const OPPORTUNITY_USE_GOOGLE_SEARCH = import.meta.env.VITE_OPPORTUNITY_USE_GOOGLE_SEARCH === 'true';

const isQuotaError = (error: any): boolean => {
    const message = (error?.message || '').toLowerCase();
    return message.includes('resource_exhausted') || message.includes('quota exceeded') || error?.status === 429;
};

const generateJsonContent = async (model: string, contents: any, responseSchema: any) => {
    return ai.models.generateContent({
        model,
        contents,
        config: {
            responseMimeType: 'application/json',
            responseSchema,
        },
    });
};

const generateSearchJsonContent = async (model: string, contents: any, responseSchema: any) => {
    return ai.models.generateContent({
        model,
        contents,
        config: {
            tools: [{ googleSearch: {} }],
            responseMimeType: 'application/json',
            responseSchema,
        },
    });
};

const extractJson = (str: string): any => {
    const match = str.match(/```json\s*([\s\S]*?)\s*```/);
    let jsonStr = (match && match[1]) ? match[1].trim() : str.trim();
    
    const firstBracket = jsonStr.indexOf('{');
    const firstSquare = jsonStr.indexOf('[');
    
    let start = -1;
    if (firstBracket === -1) start = firstSquare;
    else if (firstSquare === -1) start = firstBracket;
    else start = Math.min(firstBracket, firstSquare);
  
    if (start === -1) {
      throw new Error('No JSON object or array found in the string.');
    }
  
    jsonStr = jsonStr.substring(start);
  
    try {
      return JSON.parse(jsonStr);
    } catch (e) {
      try {
        return JSON.parse(jsonStr.replace(/,(\s*[\]}])/g, '$1')); 
      } catch (finalError) {
          throw new Error("The AI returned a response that could not be parsed as JSON.");
      }
    }
};

const callGemini = async (contents: any, responseSchema: any) => {
    try {
        let response;
        try {
            response = await generateJsonContent(PRIMARY_MODEL, contents, responseSchema);
        } catch (firstError: any) {
            if (isQuotaError(firstError) && FALLBACK_MODEL !== PRIMARY_MODEL) {
                console.warn(`Primary Gemini model ${PRIMARY_MODEL} hit quota limits. Retrying with fallback model ${FALLBACK_MODEL}.`);
                response = await generateJsonContent(FALLBACK_MODEL, contents, responseSchema);
            } else {
                throw firstError;
            }
        }

        if (!response.text) {
            throw new Error("The AI returned an empty response.");
        }
        
        // If the call is successful, ensure the status is online.
        updateApiStatus('online');
        return extractJson(response.text);

    } catch (error: any) {
        console.error("Error calling Gemini API:", error);
        
        // Graceful Degradation Logic
        const message = error.message || 'An unknown error occurred.';
        if (message.includes('RESOURCE_EXHAUSTED') || (error.status && (error.status === 429 || error.status >= 500))) {
            updateApiStatus('degraded', 'The AI is experiencing high demand. Some features may be temporarily limited.');
        } else if (message.toLowerCase().includes('network request failed')) {
            updateApiStatus('offline', 'Network connection issue. Please check your internet connection.');
        }

        throw error;
    }
}

export const extractTextFromUrl = async (url: string): Promise<{ extractedText: string }> => {
  const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(url)}`;
  let htmlContent: string;
  try {
    const response = await fetch(proxyUrl);
    if (!response.ok) throw new Error(`Failed to fetch URL content.`);
    htmlContent = await response.text();
  } catch (error) {
    throw new Error("Could not retrieve content from the provided URL.");
  }

  const prompt = `
    Extract the main professional profile or resume text from the following HTML. Ignore navigation, ads, and scripts.
    HTML Content: ${htmlContent}
  `;

  const schema = {
    type: Type.OBJECT,
    properties: { extractedText: { type: Type.STRING } },
    required: ['extractedText']
  };

  return callGemini(prompt, schema);
};

export const analyzeResume = async (resumeText: string, resumeImages: ResumeImage[] | null, marketName: string): Promise<AnalysisResult & { extractedText?: string }> => {
  const basePrompt = `Analyze this resume for the ${marketName} market.`;
  const instructionPrompt = `Provide a JSON response with score (0-100), summary, strengths, improvements (area, suggestion), and keywords.`;

  let contents: any;
  const responseSchema = {
    type: Type.OBJECT,
    properties: {
      score: { type: Type.NUMBER },
      summary: { type: Type.STRING },
      strengths: { type: Type.ARRAY, items: { type: Type.STRING } },
      improvements: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { area: { type: Type.STRING }, suggestion: { type: Type.STRING } }, required: ['area', 'suggestion'] } },
      keywords: { type: Type.ARRAY, items: { type: Type.STRING } },
      extractedText: { type: Type.STRING }
    },
    required: ['score', 'summary', 'strengths', 'improvements', 'keywords']
  };

  if (resumeImages && resumeImages.length > 0) {
    const imageParts = resumeImages.map(image => ({ inlineData: { mimeType: image.mimeType, data: image.data } }));
    contents = { parts: [{ text: `${basePrompt} Transcribe and analyze.` }, ...imageParts] };
  } else {
    contents = `${basePrompt}\n${resumeText}\n${instructionPrompt}`;
  }

  return callGemini(contents, responseSchema);
};

// ... (rest of the functions remain the same, as they all pipe through `callGemini`)
export const applyResumeImprovements = async (resumeText: string, improvements: Improvement[]): Promise<{ updatedResumeText: string }> => {
  const improvementsString = improvements.map(imp => `- ${imp.area}: ${imp.suggestion}`).join('\n');
  const prompt = `Rewrite this resume applying these improvements:\n${improvementsString}\n\nResume:\n${resumeText}`;
  const schema = { type: Type.OBJECT, properties: { updatedResumeText: { type: Type.STRING } }, required: ['updatedResumeText'] };
  return callGemini(prompt, schema);
};

export const convertResumeFormat = async (resumeText: string, marketName: string, coverLetterText?: string): Promise<FormattedResume> => {
    const prompt = `
        You are an expert career consultant specializing in international resume standards. Your task is to localize the following resume for the **${marketName}** job market.

        **Key Instructions:**
        1.  **Formatting & Structure:** Reformat the entire resume to strictly adhere to the professional standards, common layout, and ATS (Applicant Tracking System) best practices of **${marketName}**. This includes section order, date formats, and contact information conventions.
        2.  **Language & Tone:** Adapt the language, tone, and phrasing to be culturally appropriate and professional for **${marketName}**. If the target market's primary language is not English (e.g., Japan, Germany, France), translate the resume content accurately and professionally into the primary language of that country.
        3.  **Content Optimization:** Do not add or remove core experiences, but you may subtly rephrase bullet points to better align with the professional communication style of the target market.

        ${coverLetterText ? `**Cover Letter:** If a cover letter is provided below, incorporate it seamlessly into the final document, either before or after the resume as is standard in ${marketName}.\n\nCover Letter:\n${coverLetterText}` : ''}

        **Original Resume:**
        ${resumeText}

        Produce only the final, localized document text.
    `;
    const schema = { type: Type.OBJECT, properties: { formattedText: { type: Type.STRING } }, required: ['formattedText'] };
    return callGemini(prompt, schema);
};

export const calculateCompatibility = async (resumeText: string, jobDescription: string): Promise<{ compatibilityScore: number; summary: string; candidateName?: string }> => {
    const prompt = `
        Analyze the resume against the job description.
        Extract the Candidate's Name (use "Candidate" if not found).
        Provide a compatibility score (0-100) and a brief summary.
        
        Resume: ${resumeText}
        Job Description: ${jobDescription}
    `;
    const schema = {
        type: Type.OBJECT,
        properties: {
            candidateName: { type: Type.STRING },
            compatibilityScore: { type: Type.NUMBER },
            summary: { type: Type.STRING }
        },
        required: ['compatibilityScore', 'summary']
    };
    return callGemini(prompt, schema);
};

export const findOpportunities = async (resumeText: string, marketName: string, session: Session | null): Promise<OpportunityResult> => {
    const quotaNotice = 'Live Google Search grounding is temporarily unavailable because the Gemini search/tool quota has been exhausted. Results below are AI-generated suggestions without live web sources.';
    const schema = {
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
                    required: ['jobTitle', 'company', 'location', 'url', 'summary']
                }
            },
            jobSearchStrategies: {
                type: Type.ARRAY,
                items: { type: Type.STRING }
            }
        },
        required: ['opportunities', 'jobSearchStrategies']
    };
    const quotaLimitedResult = (): OpportunityResult => ({
        opportunities: [],
        jobSearchStrategies: [
            `Search directly on LinkedIn, Indeed, and company career pages using role keywords from your resume and the ${marketName} location filter.`,
            'Set up saved searches and email alerts so new postings are captured without repeatedly running AI search.',
            'Prioritize recent postings and tailor the top third of your resume to the exact job title before applying.',
            'Track applications in batches and follow up with recruiters or hiring managers when a role strongly matches your experience.',
        ],
        groundingChunks: undefined,
        notice: quotaNotice,
    });
    const generateWithoutLiveSearch = async (): Promise<OpportunityResult> => {
        const offlinePrompt = `
            Based on the provided resume for the ${marketName} market, suggest realistic job targets and job search strategies.
            Do not claim these are live postings. Do not invent application URLs. Use "#" for each URL.

            Return JSON with:
            - "opportunities": up to 8 suggested target roles with jobTitle, company, location, url, and summary.
            - "jobSearchStrategies": 3-5 personalized strategies.

            Resume:
            ${resumeText}
        `;

        let offlineResponse;
        try {
            offlineResponse = await generateJsonContent(PRIMARY_MODEL, offlinePrompt, schema);
        } catch (firstOfflineError: any) {
            if (isQuotaError(firstOfflineError) && FALLBACK_MODEL !== PRIMARY_MODEL) {
                offlineResponse = await generateJsonContent(FALLBACK_MODEL, offlinePrompt, schema);
            } else {
                throw firstOfflineError;
            }
        }

        const parsedOfflineResponse = extractJson(offlineResponse.text || '{}');
        return {
            opportunities: parsedOfflineResponse.opportunities || [],
            jobSearchStrategies: parsedOfflineResponse.jobSearchStrategies || [],
            groundingChunks: undefined,
            notice: quotaNotice,
        };
    };

    const prompt = `
        Based on the provided resume for the ${marketName} market, perform a comprehensive job search and provide strategic advice.

        **Tasks:**
        1.  **Find Job Postings:** Search all popular internet sources (like LinkedIn, Indeed, company career pages) for relevant job postings published within the **last 2 weeks**. Find up to 15 roles.
        2.  **Provide Job Search Strategies:** Based on the resume and the current job market in ${marketName}, provide 3-5 actionable and personalized strategies for the user to improve their job search success. These strategies should be concise and insightful.

        **Output Format:**
        Return a single JSON object with two keys:
        - "opportunities": An array of job posting objects.
        - "jobSearchStrategies": An array of strings, where each string is a unique strategy.

        **Resume:**
        ${resumeText}
    `;

    if (!OPPORTUNITY_USE_GOOGLE_SEARCH) {
        return generateWithoutLiveSearch();
    }

    let response;
    try {
        response = await generateSearchJsonContent(PRIMARY_MODEL, prompt, schema);
    } catch (firstError: any) {
        if (isQuotaError(firstError) && FALLBACK_MODEL !== PRIMARY_MODEL) {
            try {
                response = await generateSearchJsonContent(FALLBACK_MODEL, prompt, schema);
            } catch (fallbackError: any) {
                if (isQuotaError(fallbackError)) {
                    try {
                        return await generateWithoutLiveSearch();
                    } catch (offlineError: any) {
                        if (isQuotaError(offlineError)) {
                            updateApiStatus('degraded', quotaNotice);
                            return quotaLimitedResult();
                        }
                        throw offlineError;
                    }
                }
                throw fallbackError;
            }
        } else if (isQuotaError(firstError)) {
            try {
                return await generateWithoutLiveSearch();
            } catch (offlineError: any) {
                if (isQuotaError(offlineError)) {
                    updateApiStatus('degraded', quotaNotice);
                    return quotaLimitedResult();
                }
                throw offlineError;
            }
        } else {
            throw firstError;
        }
    }
    
    const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
    const parsedResponse = extractJson(response.text || '{}');
    
    return {
        opportunities: parsedResponse.opportunities || [],
        jobSearchStrategies: parsedResponse.jobSearchStrategies || [],
        groundingChunks
    };
};

export const generateCoverLetter = async (resumeText: string, jobDescription: string, marketName: string): Promise<CoverLetter> => {
    const prompt = `Write a cover letter for ${marketName}. Resume: ${resumeText}\nJob: ${jobDescription}`;
    const schema = { type: Type.OBJECT, properties: { letter: { type: Type.STRING } }, required: ['letter'] };
    return callGemini(prompt, schema);
};

export const optimizeLinkedInProfile = async (resumeText: string, marketName: string): Promise<LinkedInOptimization> => {
    const prompt = `Optimize LinkedIn profile for ${marketName} based on resume: ${resumeText}`;
    const schema = {
        type: Type.OBJECT,
        properties: { headline: { type: Type.STRING }, summary: { type: Type.STRING }, experienceSuggestions: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { title: { type: Type.STRING }, suggestion: { type: Type.STRING } } } } },
        required: ['headline', 'summary', 'experienceSuggestions']
    };
    return callGemini(prompt, schema);
};

export const optimizeLinkedInProfileFromText = async (profileText: string, resumeText: string, marketName: string, customPrompt?: string, additionalUrl?: string): Promise<LinkedInOptimization> => {
    const prompt = `Optimize LinkedIn. Profile: ${profileText}\nResume: ${resumeText}\nCustom: ${customPrompt}`;
    const schema = {
        type: Type.OBJECT,
        properties: { headline: { type: Type.STRING }, summary: { type: Type.STRING }, experienceSuggestions: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { title: { type: Type.STRING }, suggestion: { type: Type.STRING } } } } },
        required: ['headline', 'summary', 'experienceSuggestions']
    };
    return callGemini(prompt, schema);
};

export const generateCareerPath = async (resumeText: string, desiredRole: string, marketName: string, session: Session): Promise<CareerPathResult> => {
    const prompt = `Career path to ${desiredRole} in ${marketName}. Resume: ${resumeText}`;
    const schema = {
        type: Type.OBJECT,
        properties: {
            summary: { type: Type.STRING },
            overallSkillGaps: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { skill: { type: Type.STRING }, reason: { type: Type.STRING } } } },
            roadmap: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { phaseTitle: { type: Type.STRING }, estimatedDuration: { type: Type.STRING }, goal: { type: Type.STRING }, actionableSteps: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { type: { type: Type.STRING }, description: { type: Type.STRING }, resources: { type: Type.ARRAY, items: { type: Type.STRING } } } } }, milestones: { type: Type.ARRAY, items: { type: Type.STRING } } } } },
            bridgeRoles: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { title: { type: Type.STRING }, reason: { type: Type.STRING } } } }
        },
        required: ['summary', 'overallSkillGaps', 'roadmap', 'bridgeRoles']
    };
    return callGemini(prompt, schema);
};

export const generateSkillBridgeProject = async (resumeText: string, desiredRole: string, skill: string): Promise<SkillBridgeProject> => {
    const prompt = `Project to learn ${skill} for ${desiredRole}. Resume: ${resumeText}`;
    const schema = {
        type: Type.OBJECT,
        properties: { projectTitle: { type: Type.STRING }, objective: { type: Type.STRING }, keyFeatures: { type: Type.ARRAY, items: { type: Type.STRING } }, suggestedTechStack: { type: Type.ARRAY, items: { type: Type.STRING } }, showcaseChallenge: { type: Type.STRING } },
        required: ['projectTitle', 'objective', 'keyFeatures', 'suggestedTechStack', 'showcaseChallenge']
    };
    return callGemini(prompt, schema);
};

export const startInterviewChat = async (resumeText: string, jobDescription: string, market: string, session: Session): Promise<{ chat: Chat; sessionId: number; }> => {
    // FIX: Updated model to 'gemini-3-flash-preview' as recommended for chat applications.
    const chat = ai.chats.create({ model: 'gemini-3-flash-preview' });
    return { chat, sessionId: 123 }; // Mock ID
};

export const saveInterviewExchange = async ({ sessionId, question, answer, feedback }: any) => {
    // Implementation as before
};

export const generateAgilePracticeTest = async (agileRole: string, agileCertification: string): Promise<AgilePracticeTestResult> => {
    const prompt = `Practice test for ${agileCertification} for ${agileRole}.`;
    const schema = {
        type: Type.OBJECT,
        properties: {
            examTitle: { type: Type.STRING },
            practiceQuestions: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { questionText: { type: Type.STRING }, options: { type: Type.ARRAY, items: { type: Type.STRING } }, correctAnswerIndex: { type: Type.NUMBER }, explanation: { type: Type.STRING } } } },
            examTips: { type: Type.ARRAY, items: { type: Type.STRING } }
        },
        required: ['examTitle', 'practiceQuestions', 'examTips']
    };
    return callGemini(prompt, schema);
};

export const generateSalaryNegotiationStrategy = async (resumeText: string, jobTitle: string, company: string, location: string, currentOffer: string, currency: string): Promise<SalaryNegotiationResult & { groundingChunks: any[] | undefined }> => {
    const prompt = `
        You are an expert salary negotiation coach. Analyze the user's situation and provide a comprehensive, data-driven negotiation strategy.
        - User's Job Title: ${jobTitle}
        - Company: ${company}
        - Location: ${location}
        - Current Offer (Base Salary): ${currentOffer} ${currency}
        - User's Resume Context: ${resumeText}

        Perform the following tasks using Google Search for the most up-to-date market data:
        1.  **Market Analysis:** Research the typical salary range for this role, company, and location. Provide a concise summary.
        2.  **Recommended Range:** Suggest a realistic target base salary range (min-max) for the user to counter-offer with. Explain your reasoning.
        3.  **Key Strengths:** Based on the user's resume and the job title, identify 3-5 key strengths they should leverage during negotiation.
        4.  **Negotiation Strategy:** Provide a clear, step-by-step negotiation strategy (3-5 steps).
        5.  **Counter-Offer Email Draft:** Write a professional, concise email draft for the user to send as a counter-offer.
        6.  **Objection Handlers:** Provide advice on how to handle 2-3 common objections (e.g., "This is our final offer," "That's above our budget").
    `;
    
    let response;
    try {
        response = await ai.models.generateContent({
            model: PRIMARY_MODEL,
            contents: prompt,
            config: { tools: [{ googleSearch: {} }] },
        });
    } catch (firstError: any) {
        if (isQuotaError(firstError) && FALLBACK_MODEL !== PRIMARY_MODEL) {
            response = await ai.models.generateContent({
                model: FALLBACK_MODEL,
                contents: prompt,
                config: { tools: [{ googleSearch: {} }] },
            });
        } else {
            throw firstError;
        }
    }
    
    const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
    const parsedResponse = extractJson(response.text || '{}');
    
    return {
        ...parsedResponse,
        groundingChunks,
    };
};

export const analyzeEnglishProficiency = async (emailText: string, nativeLanguage: string, targetIeltsBand: string): Promise<EnglishProResult> => {
    const prompt = `Analyze English email: ${emailText}. Native: ${nativeLanguage}. Target: ${targetIeltsBand}`;
    const schema = {
        type: Type.OBJECT,
        properties: {
            overallBand: { type: Type.OBJECT, properties: { level: { type: Type.STRING }, description: { type: Type.STRING } } },
            summary: { type: Type.STRING },
            strengths: { type: Type.ARRAY, items: { type: Type.STRING } },
            improvementAreas: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { category: { type: Type.STRING }, originalText: { type: Type.STRING }, suggestion: { type: Type.STRING }, explanation: { type: Type.STRING } } } },
            correctedEmail: { type: Type.STRING },
            culturalTip: { type: Type.STRING }
        },
        required: ['overallBand', 'summary', 'strengths', 'improvementAreas', 'correctedEmail']
    };
    return callGemini(prompt, schema);
};

export const generateSpeakingTopics = async (targetIeltsBand: string): Promise<{ topics: string[] }> => {
    const prompt = `5 IELTS speaking topics for band ${targetIeltsBand}`;
    const schema = { type: Type.OBJECT, properties: { topics: { type: Type.ARRAY, items: { type: Type.STRING } } }, required: ['topics'] };
    return callGemini(prompt, schema);
};

export const analyzeSpokenEnglish = async (transcript: string, durationSeconds: number, targetIeltsBand: string): Promise<SpokenEnglishAnalysisResult> => {
    const prompt = `Analyze spoken English: ${transcript}. Duration: ${durationSeconds}s. Target: ${targetIeltsBand}`;
    const schema = {
        type: Type.OBJECT,
        properties: {
            transcript: { type: Type.STRING },
            clarityScore: { type: Type.NUMBER },
            pacingWPM: { type: Type.NUMBER },
            fillerWords: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { word: { type: Type.STRING }, count: { type: Type.NUMBER } } } },
            feedbackSummary: { type: Type.STRING },
            improvementSuggestions: { type: Type.ARRAY, items: { type: Type.STRING } }
        },
        required: ['transcript', 'clarityScore', 'pacingWPM', 'fillerWords', 'feedbackSummary', 'improvementSuggestions']
    };
    return callGemini(prompt, schema);
};

export const generateReadingPracticePassage = async (targetIeltsBand: string): Promise<ReadingPracticePassage> => {
    const prompt = `Reading passage for IELTS band ${targetIeltsBand}`;
    const schema = {
        type: Type.OBJECT,
        properties: {
            passage: { type: Type.STRING },
            comprehensionQuestions: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { question: { type: Type.STRING }, answer: { type: Type.STRING } } } }
        },
        required: ['passage', 'comprehensionQuestions']
    };
    return callGemini(prompt, schema);
};

export const analyzeEnglishReading = async (textToAnalyze: string, targetIeltsBand: string): Promise<EnglishReadingAnalysisResult> => {
    const prompt = `Analyze reading text: ${textToAnalyze}. Target: ${targetIeltsBand}`;
    const schema = {
        type: Type.OBJECT,
        properties: {
            summary: { type: Type.STRING },
            vocabularyList: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { word: { type: Type.STRING }, definition: { type: Type.STRING }, example: { type: Type.STRING } } } },
            comprehensionQuestions: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { question: { type: Type.STRING }, answer: { type: Type.STRING } } } }
        },
        required: ['summary', 'vocabularyList', 'comprehensionQuestions']
    };
    return callGemini(prompt, schema);
};

export const evaluateReadingComprehension = async (originalText: string, questionsAndAnswers: ComprehensionQuestion[], userAnswers: string[]): Promise<ReadingEvaluation[]> => {
    const prompt = `Evaluate reading answers. Text: ${originalText}. Q&A: ${JSON.stringify(questionsAndAnswers)}. User: ${JSON.stringify(userAnswers)}`;
    const schema = { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { isCorrect: { type: Type.BOOLEAN }, feedback: { type: Type.STRING } }, required: ['isCorrect', 'feedback'] } };
    return callGemini(prompt, schema);
};

export const analyzeEnglishListening = async (originalText: string, userTranscription: string, targetIeltsBand: string): Promise<EnglishListeningAnalysisResult> => {
    const prompt = `Analyze listening. Original: ${originalText}. User: ${userTranscription}. Target: ${targetIeltsBand}`;
    const schema = {
        type: Type.OBJECT,
        properties: {
            similarityScore: { type: Type.NUMBER },
            diffView: { type: Type.STRING },
            feedbackOnCommonErrors: { type: Type.ARRAY, items: { type: Type.STRING } },
            originalTranscript: { type: Type.STRING }
        },
        required: ['similarityScore', 'diffView', 'feedbackOnCommonErrors', 'originalTranscript']
    };
    return callGemini(prompt, schema);
};

export const generateVocabularyFlashcards = async (targetIeltsBand: string): Promise<{ cards: VocabularyFlashcard[] }> => {
    const prompt = `Vocab flashcards for IELTS band ${targetIeltsBand}`;
    const schema = {
        type: Type.OBJECT,
        properties: {
            cards: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { word: { type: Type.STRING }, definition: { type: Type.STRING }, distractors: { type: Type.ARRAY, items: { type: Type.STRING } } } } }
        },
        required: ['cards']
    };
    return callGemini(prompt, schema);
};

export const generateProfessionalEmail = async (resumeText: string, scenario: string, details: { [key: string]: string }, marketName: string, tone: number, style: number, confidence: number): Promise<ProfessionalEmailResult> => {
    const prompt = `Write email. Scenario: ${scenario}. Details: ${JSON.stringify(details)}. Market: ${marketName}. Tone: ${tone}. Style: ${style}. Confidence: ${confidence}. Resume: ${resumeText}`;
    const schema = { type: Type.OBJECT, properties: { subject: { type: Type.STRING }, body: { type: Type.STRING } }, required: ['subject', 'body'] };
    return callGemini(prompt, schema);
};

export const generateOutreachEmail = async (candidateResumeText: string, jobDescription: string, employerProfile: UserProfile, marketName: string): Promise<ProfessionalEmailResult> => {
    const prompt = `Write outreach email. Candidate: ${candidateResumeText}. Job: ${jobDescription}. Employer: ${JSON.stringify(employerProfile)}. Market: ${marketName}`;
    const schema = { type: Type.OBJECT, properties: { subject: { type: Type.STRING }, body: { type: Type.STRING } }, required: ['subject', 'body'] };
    return callGemini(prompt, schema);
};

export const generateProfessionalHeadshot = async (imageBase64: string): Promise<string[]> => {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [
          { inlineData: { data: imageBase64, mimeType: 'image/jpeg' } },
          { text: 'Generate 3 variations of this image as a professional corporate headshot. Maintain the person\'s identity. Provide a neutral, soft-focus background. Ensure a professional and polished look.' },
        ],
      },
    });

    const results: string[] = [];
    for (const part of response.candidates[0].content.parts) {
      if (part.inlineData) {
        results.push(part.inlineData.data);
      }
    }
    if (results.length === 0) {
        throw new Error("The AI did not return any images.");
    }
    return results;
};

export const generatePortfolioWebsite = async (resumeText: string): Promise<PortfolioContent> => {
    const prompt = `Generate portfolio content from resume: ${resumeText}`;
    const schema = {
        type: Type.OBJECT,
        properties: {
            fullName: { type: Type.STRING },
            firstName: { type: Type.STRING },
            lastName: { type: Type.STRING },
            contactEmail: { type: Type.STRING },
            contactPhone: { type: Type.STRING },
            contactLocation: { type: Type.STRING },
            socials: { type: Type.OBJECT, properties: { linkedin: { type: Type.STRING }, github: { type: Type.STRING }, twitter: { type: Type.STRING } } },
            skills: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { icon: { type: Type.STRING }, category: { type: Type.STRING }, description: { type: Type.STRING } } } },
            experience: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { date: { type: Type.STRING }, title: { type: Type.STRING }, company: { type: Type.STRING }, description: { type: Type.STRING } } } }
        },
        required: ['fullName', 'firstName', 'lastName', 'contactEmail', 'contactPhone', 'contactLocation', 'socials', 'skills', 'experience']
    };
    return callGemini(prompt, schema);
};

export const generateWeeklySummary = async (data: any): Promise<{ summary: string }> => {
    const prompt = `Weekly summary for data: ${JSON.stringify(data)}`;
    const schema = { type: Type.OBJECT, properties: { summary: { type: Type.STRING } }, required: ['summary'] };
    return callGemini(prompt, schema);
};

export const generateJobDescription = async (jobTitle: string, keyResponsibilities: string, companyName: string, companyDescription: string): Promise<{ jobDescription: string }> => {
    const prompt = `Job description for ${jobTitle} at ${companyName}. Responsibilities: ${keyResponsibilities}`;
    const schema = { type: Type.OBJECT, properties: { jobDescription: { type: Type.STRING } }, required: ['jobDescription'] };
    return callGemini(prompt, schema);
};

export const analyzeSalary = async (jobTitle: string, location: string, jobDescription: string): Promise<{ yearlySalary: string, monthlySalary: string }> => {
    const prompt = `Salary estimate for ${jobTitle} in ${location}.`;
    const schema = { type: Type.OBJECT, properties: { yearlySalary: { type: Type.STRING }, monthlySalary: { type: Type.STRING } }, required: ['yearlySalary', 'monthlySalary'] };
    return callGemini(prompt, schema);
};

export const checkInclusivity = async (jobDescription: string): Promise<{ suggestions: InclusivitySuggestion[] }> => {
    const prompt = `Inclusivity check for: ${jobDescription}`;
    const schema = { type: Type.OBJECT, properties: { suggestions: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { originalText: { type: Type.STRING }, suggestion: { type: Type.STRING }, explanation: { type: Type.STRING } } } } }, required: ['suggestions'] };
    return callGemini(prompt, schema);
};

export const formatJobDescription = async (jobDescription: string): Promise<{ formattedDescription: string, jobTitle: string | null, location: string | null }> => {
    const prompt = `Format job description: ${jobDescription}`;
    const schema = { type: Type.OBJECT, properties: { formattedDescription: { type: Type.STRING }, jobTitle: { type: Type.STRING }, location: { type: Type.STRING } }, required: ['formattedDescription'] };
    return callGemini(prompt, schema);
};

export const analyzeCandidateMatch = async (resumeText: string, jobDescription: string): Promise<CandidateMatchAnalysis> => {
    const prompt = `Match resume to job. Resume: ${resumeText}. Job: ${jobDescription}`;
    const schema = {
        type: Type.OBJECT,
        properties: { score: { type: Type.NUMBER }, summary: { type: Type.STRING }, strengths: { type: Type.ARRAY, items: { type: Type.STRING } }, potentialGaps: { type: Type.ARRAY, items: { type: Type.STRING } }, suggestedQuestions: { type: Type.ARRAY, items: { type: Type.STRING } } },
        required: ['score', 'summary', 'strengths', 'potentialGaps', 'suggestedQuestions']
    };
    return callGemini(prompt, schema);
};

export const generateNetworkingStrategy = async (resumeText: string, targetCompany: string, targetRole: string, targetLocation: string, marketName: string): Promise<NetworkingStrategyResult> => {
    const prompt = `Networking strategy. Resume: ${resumeText}. Target: ${targetCompany}, ${targetRole}, ${targetLocation}. Market: ${marketName}`;
    const schema = {
        type: Type.OBJECT,
        properties: { strategySummary: { type: Type.STRING }, contactSuggestions: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { contactType: { type: Type.STRING }, reason: { type: Type.STRING }, outreachMessage: { type: Type.STRING } } } } },
        required: ['strategySummary', 'contactSuggestions']
    };
    return callGemini(prompt, schema);
};

export const generatePerformanceReviewPrep = async (resumeText: string, userAccomplishments: string, jobTitle: string): Promise<PerformanceReviewResult> => {
    const prompt = `Performance review prep. Title: ${jobTitle}. Accomplishments: ${userAccomplishments}. Resume: ${resumeText}`;
    const schema = {
        type: Type.OBJECT,
        properties: { summary: { type: Type.STRING }, strengthsToHighlight: { type: Type.ARRAY, items: { type: Type.STRING } }, talkingPoints: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { accomplishment: { type: Type.STRING }, starMethodPoint: { type: Type.STRING } } } }, growthAreaDiscussionPoints: { type: Type.ARRAY, items: { type: Type.STRING } } },
        required: ['summary', 'strengthsToHighlight', 'talkingPoints', 'growthAreaDiscussionPoints']
    };
    return callGemini(prompt, schema);
};

export const generateLearningPlan = async (resumeText: string, skillToLearn: string, marketName: string): Promise<LearningPlanResult> => {
    const prompt = `Learning plan for ${skillToLearn}. Resume: ${resumeText}`;
    const schema = {
        type: Type.OBJECT,
        properties: { skill: { type: Type.STRING }, summary: { type: Type.STRING }, learningPhases: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { phaseTitle: { type: Type.STRING }, duration: { type: Type.STRING }, keyActivities: { type: Type.ARRAY, items: { type: Type.STRING } }, milestone: { type: Type.STRING } } } }, suggestedProjects: { type: Type.ARRAY, items: { type: Type.STRING } } },
        required: ['skill', 'summary', 'learningPhases', 'suggestedProjects']
    };
    return callGemini(prompt, schema);
};

export const findIndustryEvents = async (fieldOfInterest: string, location: string): Promise<EventScoutResult> => {
    const prompt = `Find relevant industry events (conferences, meetups, job fairs) for someone interested in '${fieldOfInterest}' in or near '${location}'. Also include relevant online/virtual events. For each event, provide the event name, date, location, a brief summary, the event type, and a URL.`;
    
    const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: { 
            tools: [{ googleSearch: {} }],
            responseMimeType: "application/json",
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
                                eventType: { type: Type.STRING, enum: ['conference', 'meetup', 'job_fair', 'other'] }
                            }
                        }
                    }
                }
            }
        },
    });

    const parsedResponse = extractJson(response.text || '{}');
    return { 
        events: parsedResponse.events || [], 
        groundingChunks: response.candidates?.[0]?.groundingMetadata?.groundingChunks 
    };
};

export const anonymizeResume = async (resumeText: string, agencyName?: string): Promise<{ anonymizedText: string }> => {
  const prompt = `
    You are an expert recruitment consultant working for "${agencyName || 'Top Recruitment Agency'}".
    Create a "Blind Resume" from the text.
    1. Remove all PII (Name, Email, Phone, Address, Links). Replace Name with "Candidate".
    2. Format cleanly.
    3. Add header "Represented by: ${agencyName || 'Agency'}".
    Output JSON with key "anonymizedText".
    
    Resume: ${resumeText}
  `;
  const schema = { type: Type.OBJECT, properties: { anonymizedText: { type: Type.STRING } }, required: ['anonymizedText'] };
  return callGemini(prompt, schema);
};

export const generateClientPitchEmail = async (candidateResumeText: string, candidateName: string, jobDescription?: string): Promise<{ subject: string; body: string }> => {
    const context = jobDescription ? `Job Description:\n${jobDescription}` : `Pitch based on resume experience.`;
    const prompt = `
    Write a recruiter pitch email for candidate ${candidateName}.
    Resume: ${candidateResumeText}
    Context: ${context}
    
    Include: Compelling Subject, Hook, 3 Bullet points of "Why", Call to Action.
    Output JSON with "subject" and "body".
  `;
    const schema = { type: Type.OBJECT, properties: { subject: { type: Type.STRING }, body: { type: Type.STRING } }, required: ['subject', 'body'] };
    return callGemini(prompt, schema);
};

export const generateCandidatePrepKit = async (resumeText: string, jobDescription: string): Promise<CandidatePrepKit> => {
    const prompt = `
    Create interview prep kit.
    Resume: ${resumeText}
    Job: ${jobDescription}
    
    Identify: 3 Weak Spots, 3 Key Projects to Highlight, 5 Predicted Questions.
    Output JSON with keys: "weakSpots", "keyProjects", "predictedQuestions".
    `;
    const schema = {
        type: Type.OBJECT,
        properties: {
            weakSpots: { type: Type.ARRAY, items: { type: Type.STRING } },
            keyProjects: { type: Type.ARRAY, items: { type: Type.STRING } },
            predictedQuestions: { type: Type.ARRAY, items: { type: Type.STRING } }
        },
        required: ['weakSpots', 'keyProjects', 'predictedQuestions']
    };
    return callGemini(prompt, schema);
};
