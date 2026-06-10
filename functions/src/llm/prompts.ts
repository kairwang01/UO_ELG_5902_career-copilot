/**
 * Prompt templates for every AI tool in the registry.
 *
 * Each entry is keyed by the tool's registry name and holds the verbatim
 * template from toolRegistry.ts with `${expr}` replaced by `{{varName}}`.
 * Admins may override any template by storing a non-empty string in
 * Firestore platform_config/prompts.<toolKey>.
 *
 * Available {{placeholders}} per key:
 *
 *  applyResumeImprovements:
 *    {{improvementsBlock}}   — mapped list of "- area: suggestion" lines
 *    {{resumeText}}          — resume plain text
 *
 *  convertResumeFormat:
 *    {{marketName}}          — target job market name
 *    {{coverLetterBlock}}    — conditional cover-letter section (empty when not provided)
 *    {{resumeText}}          — resume plain text
 *
 *  calculateCompatibility:
 *    {{resumeText}}          — resume plain text
 *    {{jobDescription}}      — job description text
 *
 *  findOpportunities:
 *    {{marketName}}          — target job market name
 *    {{resumeText}}          — resume plain text
 *
 *  optimizeLinkedInProfile:
 *    {{marketName}}          — target job market name
 *    {{resumeText}}          — resume plain text
 *
 *  optimizeLinkedInProfileFromText:
 *    {{profileText}}         — existing LinkedIn profile text
 *    {{resumeText}}          — resume plain text
 *    {{customPrompt}}        — optional custom instructions (empty string if not set)
 *
 *  generateSkillBridgeProject:
 *    {{skill}}               — skill to learn
 *    {{desiredRole}}         — target job role
 *    {{resumeText}}          — resume plain text
 *
 *  generateAgilePracticeTest:
 *    {{agileCertification}}  — certification name (e.g. PSM I)
 *    {{agileRole}}           — target agile role
 *
 *  generateSalaryNegotiationStrategy:
 *    {{jobTitle}}            — job title
 *    {{company}}             — company name
 *    {{location}}            — job location
 *    {{currentOffer}}        — base salary offer number
 *    {{currency}}            — currency code
 *    {{resumeText}}          — resume plain text
 *
 *  analyzeEnglishProficiency:
 *    {{emailText}}           — email text to analyze
 *    {{nativeLanguage}}      — user's native language
 *    {{targetIeltsBand}}     — target IELTS band
 *
 *  generateSpeakingTopics:
 *    {{targetIeltsBand}}     — target IELTS band
 *
 *  analyzeSpokenEnglish:
 *    {{transcript}}          — spoken transcript
 *    {{durationSeconds}}     — recording duration in seconds
 *    {{targetIeltsBand}}     — target IELTS band
 *
 *  generateReadingPracticePassage:
 *    {{targetIeltsBand}}     — target IELTS band
 *
 *  analyzeEnglishReading:
 *    {{textToAnalyze}}       — text to analyze
 *    {{targetIeltsBand}}     — target IELTS band
 *
 *  evaluateReadingComprehension:
 *    {{originalText}}        — passage text
 *    {{questionsAndAnswers}} — JSON-stringified Q&A array
 *    {{userAnswers}}         — JSON-stringified user answers array
 *
 *  analyzeEnglishListening:
 *    {{originalText}}        — original passage text
 *    {{userTranscription}}   — user's transcription attempt
 *    {{targetIeltsBand}}     — target IELTS band
 *
 *  generateVocabularyFlashcards:
 *    {{targetIeltsBand}}     — target IELTS band
 *
 *  generateProfessionalEmail:
 *    {{scenario}}            — email scenario
 *    {{details}}             — JSON-stringified details object
 *    {{marketName}}          — target job market name
 *    {{tone}}                — email tone
 *    {{style}}               — email style
 *    {{confidence}}          — user confidence level
 *    {{resumeText}}          — resume plain text
 *
 *  generateOutreachEmail:
 *    {{candidateResumeText}} — candidate resume plain text
 *    {{jobDescription}}      — job description text
 *    {{employerProfile}}     — JSON-stringified employer profile
 *    {{marketName}}          — target job market name
 *
 *  generatePortfolioWebsite:
 *    {{resumeText}}          — resume plain text
 *
 *  generateWeeklySummary:
 *    {{data}}                — JSON-stringified weekly data object
 *
 *  generateJobDescription:
 *    {{jobTitle}}            — job title
 *    {{companyName}}         — company name
 *    {{keyResponsibilities}} — key responsibilities text
 *
 *  analyzeSalary:
 *    {{jobTitle}}            — job title
 *    {{location}}            — location
 *
 *  checkInclusivity:
 *    {{jobDescription}}      — job description text
 *
 *  formatJobDescription:
 *    {{jobDescription}}      — job description text
 *
 *  analyzeCandidateMatch:
 *    {{resumeText}}          — resume plain text
 *    {{jobDescription}}      — job description text
 *
 *  generateNetworkingStrategy:
 *    {{resumeText}}          — resume plain text
 *    {{targetCompany}}       — target company name
 *    {{targetRole}}          — target role
 *    {{targetLocation}}      — target location
 *    {{marketName}}          — target job market name
 *
 *  generatePerformanceReviewPrep:
 *    {{jobTitle}}            — job title
 *    {{userAccomplishments}} — user-provided accomplishments text
 *    {{resumeText}}          — resume plain text
 *
 *  generateLearningPlan:
 *    {{skillToLearn}}        — skill to learn
 *    {{resumeText}}          — resume plain text
 *
 *  findIndustryEvents:
 *    {{fieldOfInterest}}     — field of interest
 *    {{location}}            — location
 *
 *  anonymizeResume:
 *    {{agencyName}}          — recruiting agency name (fallback: "Top Recruitment Agency" / "Agency")
 *    {{agencyNameOrDefault}} — agency name for header line (fallback: "Agency")
 *    {{resumeText}}          — resume plain text
 *
 *  generateClientPitchEmail:
 *    {{candidateName}}       — candidate name
 *    {{candidateResumeText}} — candidate resume plain text
 *    {{jobDescriptionBlock}} — conditional job-description section
 *
 *  generateCandidatePrepKit:
 *    {{resumeText}}          — resume plain text
 *    {{jobDescription}}      — job description text
 *
 *  handler_resume_analysis:
 *    {{marketName}}          — target job market name
 *    (text-only path; dynamic resume content appended after render)
 *
 *  handler_resume_analysis_image:
 *    {{marketName}}          — target job market name
 *    (multimodal path; Gemini transcribes images + appended instruction)
 *
 *  handler_mock_interview_generate:
 *    {{marketName}}          — hiring manager market (default: "Canadian")
 *    {{resumeText}}          — candidate resume plain text
 *    {{jobDescription}}      — job description text
 *
 *  handler_mock_interview_eval:
 *    {{question}}            — interview question
 *    {{answer}}              — candidate's answer
 *    {{jobContextBlock}}     — optional "Job Context:\n<text>\n\n" section (empty if none)
 *
 *  handler_career_coach_base:
 *    (no placeholders — pure system instruction)
 *
 *  handler_career_coach_candidate:
 *    {{resumeText}}          — candidate's resume plain text (may be empty string)
 *
 *  handler_career_coach_employer:
 *    {{companyName}}         — company name (default: "N/A")
 *    {{companyWebsite}}      — company website (default: "N/A")
 *    {{companyDescription}}  — company description (default: "N/A")
 *
 *  handler_cover_letter:
 *    {{marketName}}          — target job market name
 *    {{resumeText}}          — resume plain text
 *    {{jobDescription}}      — job description text
 *
 *  handler_career_path:
 *    {{marketName}}          — target job market name
 *    {{desiredRole}}         — desired target role
 *    {{resumeText}}          — resume plain text
 *
 *  handler_extract_url:
 *    {{html}}                — fetched HTML content (capped at 200k chars)
 */

import { getPromptOverride } from "../admin/platformConfig";

// ---------------------------------------------------------------------------
// Verbatim templates (${expr} → {{varName}}, content unchanged)
// ---------------------------------------------------------------------------

export const PROMPT_TEMPLATES: Record<string, string> = {
  applyResumeImprovements:
    `Rewrite this resume applying these improvements:\n` +
    `{{improvementsBlock}}` +
    `\n\nResume:\n{{resumeText}}`,

  convertResumeFormat: `
        You are an expert career consultant specializing in international resume standards. Your task is to localize the following resume for the **{{marketName}}** job market.

        **Key Instructions:**
        1.  **Formatting & Structure:** Reformat the entire resume to strictly adhere to the professional standards, common layout, and ATS (Applicant Tracking System) best practices of **{{marketName}}**. This includes section order, date formats, and contact information conventions.
        2.  **Language & Tone:** Adapt the language, tone, and phrasing to be culturally appropriate and professional for **{{marketName}}**. If the target market's primary language is not English (e.g., Japan, Germany, France), translate the resume content accurately and professionally into the primary language of that country.
        3.  **Content Optimization:** Do not add or remove core experiences, but you may subtly rephrase bullet points to better align with the professional communication style of the target market.

        {{coverLetterBlock}}

        **Original Resume:**
        {{resumeText}}

        Produce only the final, localized document text.

        --- COUNTRY FORMAT RULES ---
        Apply the following country-specific conventions when {{marketName}} matches:

        **United States / Canada:** 1–2 page reverse-chronological resume. Omit photo, age, and marital status. Open each bullet with a strong action verb. Quantify achievements wherever possible (%, $, headcount). Include a dedicated Skills section. ATS-friendly plain section headers.

        **United Kingdom:** 2-page CV format. Open with a 'Personal Statement' (3–4 lines). No photo. Use British spelling (e.g. "organised", "programme"). Reverse-chronological work history.

        **Germany:** Lebenslauf — tabular/structured CV layout. Include a professional passport-style photo (top-right). Personal details block: full name, date and place of birth, nationality, marital status. End with handwritten-style signature line and date. Formal, concise register. List education before work experience if recently graduated.

        **France:** CV, 1 page preferred (2 max for senior profiles). Photo common (top-right). Include 'État civil' block: name, date/place of birth, nationality. Formal register. Reverse-chronological. Hobbies/interests section acceptable.

        **Japan:** 履歴書 (rirekisho) structure. Standardised personal-data header including photo box. Education and work history in strict chronological order (oldest first) in table format. Include 志望動機 (motivation statement) section. Use polite humble register (丁寧語/謙譲語). Append a 職務経歴書-style achievements summary for mid-senior candidates. Dates in Japanese era or YYYY/MM format.

        **Vietnam:** 1–2 pages. Photo common. Personal details (DOB, gender, address) accepted. Emphasise certifications, technical skills, and English proficiency level explicitly (e.g. "IELTS 6.5"). Reverse-chronological.

        **Singapore / Australia:** Western-style professional resume. No photo. 2–3 pages acceptable (AU). Include a work-rights / visa status line when the candidate is not a citizen or permanent resident. Reverse-chronological. ATS-friendly formatting.
        --- END COUNTRY FORMAT RULES ---
      `,

  calculateCompatibility: `
        Analyze the resume against the job description.
        Extract the Candidate's Name (use "Candidate" if not found).
        Provide a compatibility score (0-100) and a brief summary.

        Resume: {{resumeText}}
        Job Description: {{jobDescription}}
      `,

  findOpportunities: `
        Based on the provided resume for the {{marketName}} market, perform a comprehensive job search and provide strategic advice.

        **Tasks:**
        1.  **Find Job Postings:** Search all popular internet sources (like LinkedIn, Indeed, company career pages) for relevant job postings published within the **last 2 weeks**. Find up to 15 roles.
        2.  **Provide Job Search Strategies:** Based on the resume and the current job market in {{marketName}}, provide 3-5 actionable and personalized strategies for the user to improve their job search success.

        **Output Format:**
        Return a single JSON object with two keys:
        - "opportunities": An array of job posting objects (jobTitle, company, location, url, summary).
        - "jobSearchStrategies": An array of strings.

        **Resume:**
        {{resumeText}}
      `,

  findOpportunitiesOffline: `
        Based on the provided resume for the {{marketName}} market, suggest realistic job targets and job search strategies.
        Do not claim these are live job postings. Do not invent application URLs; use "#" for each URL.

        **Output Format:**
        Return a single JSON object with two keys:
        - "opportunities": Up to 8 suggested target roles (jobTitle, company, location, url, summary).
        - "jobSearchStrategies": 3-5 personalized strategies.

        **Resume:**
        {{resumeText}}
      `,

  optimizeLinkedInProfile: `Optimize LinkedIn profile for {{marketName}} based on resume: {{resumeText}}`,

  optimizeLinkedInProfileFromText: `Optimize LinkedIn. Profile: {{profileText}}\nResume: {{resumeText}}\nCustom: {{customPrompt}}`,

  generateSkillBridgeProject: `Project to learn {{skill}} for {{desiredRole}}. Resume: {{resumeText}}`,

  generateAgilePracticeTest: `Practice test for {{agileCertification}} for {{agileRole}}.`,

  generateSalaryNegotiationStrategy: `
        You are an expert salary negotiation coach. Analyze the user's situation and provide a comprehensive, data-driven negotiation strategy.
        - User's Job Title: {{jobTitle}}
        - Company: {{company}}
        - Location: {{location}}
        - Current Offer (Base Salary): {{currentOffer}} {{currency}}
        - User's Resume Context: {{resumeText}}

        Perform the following tasks using Google Search for the most up-to-date market data:
        1.  **Market Analysis:** Research the typical salary range for this role, company, and location. Provide a concise summary.
        2.  **Recommended Range:** Suggest a realistic target base salary range (min-max) for the user to counter-offer with. Explain your reasoning.
        3.  **Key Strengths:** Based on the user's resume and the job title, identify 3-5 key strengths they should leverage during negotiation.
        4.  **Negotiation Strategy:** Provide a clear, step-by-step negotiation strategy (3-5 steps).
        5.  **Counter-Offer Email Draft:** Write a professional, concise email draft for the user to send as a counter-offer.
        6.  **Objection Handlers:** Provide advice on how to handle 2-3 common objections.

        Return the result as a single JSON object.
      `,

  analyzeEnglishProficiency: `Analyze English email: {{emailText}}. Native: {{nativeLanguage}}. Target: {{targetIeltsBand}}`,

  generateSpeakingTopics: `5 IELTS speaking topics for band {{targetIeltsBand}}`,

  analyzeSpokenEnglish: `Analyze spoken English: {{transcript}}. Duration: {{durationSeconds}}s. Target: {{targetIeltsBand}}`,

  generateReadingPracticePassage: `Reading passage for IELTS band {{targetIeltsBand}}`,

  analyzeEnglishReading: `Analyze reading text: {{textToAnalyze}}. Target: {{targetIeltsBand}}`,

  evaluateReadingComprehension: `Evaluate reading answers. Text: {{originalText}}. Q&A: {{questionsAndAnswers}}. User: {{userAnswers}}`,

  analyzeEnglishListening: `Analyze listening. Original: {{originalText}}. User: {{userTranscription}}. Target: {{targetIeltsBand}}`,

  generateVocabularyFlashcards: `Vocab flashcards for IELTS band {{targetIeltsBand}}`,

  generateProfessionalEmail: `Write email. Scenario: {{scenario}}. Details: {{details}}. Market: {{marketName}}. Tone: {{tone}}. Style: {{style}}. Confidence: {{confidence}}. Resume: {{resumeText}}`,

  generateOutreachEmail: `Write outreach email. Candidate: {{candidateResumeText}}. Job: {{jobDescription}}. Employer: {{employerProfile}}. Market: {{marketName}}`,

  generatePortfolioWebsite: `Generate portfolio content from resume: {{resumeText}}`,

  generateWeeklySummary: `Weekly summary for data: {{data}}`,

  generateJobDescription: `Job description for {{jobTitle}} at {{companyName}}. Responsibilities: {{keyResponsibilities}}`,

  analyzeSalary: `Salary estimate for {{jobTitle}} in {{location}}.`,

  checkInclusivity: `Inclusivity check for: {{jobDescription}}`,

  formatJobDescription: `Format job description: {{jobDescription}}`,

  analyzeCandidateMatch: `Match resume to job. Resume: {{resumeText}}. Job: {{jobDescription}}`,

  generateNetworkingStrategy: `Networking strategy. Resume: {{resumeText}}. Target: {{targetCompany}}, {{targetRole}}, {{targetLocation}}. Market: {{marketName}}`,

  generatePerformanceReviewPrep: `Performance review prep. Title: {{jobTitle}}. Accomplishments: {{userAccomplishments}}. Resume: {{resumeText}}`,

  generateLearningPlan: `Learning plan for {{skillToLearn}}. Resume: {{resumeText}}`,

  findIndustryEvents: `Find relevant industry events (conferences, meetups, job fairs) for someone interested in '{{fieldOfInterest}}' in or near '{{location}}'. Also include relevant online/virtual events. For each event, provide the event name, date, location, a brief summary, the event type, and a URL. Return JSON with an "events" array.`,

  anonymizeResume: `
        You are an expert recruitment consultant working for "{{agencyName}}".
        Create a "Blind Resume" from the text.
        1. Remove all PII (Name, Email, Phone, Address, Links). Replace Name with "Candidate".
        2. Format cleanly.
        3. Add header "Represented by: {{agencyNameOrDefault}}".
        Output JSON with key "anonymizedText".

        Resume: {{resumeText}}
      `,

  generateClientPitchEmail: `
        Write a recruiter pitch email for candidate {{candidateName}}.
        Resume: {{candidateResumeText}}
        Context: {{jobDescriptionBlock}}

        Include: Compelling Subject, Hook, 3 Bullet points of "Why", Call to Action.
        Output JSON with "subject" and "body".
      `,

  generateCandidatePrepKit: `
        Create interview prep kit.
        Resume: {{resumeText}}
        Job: {{jobDescription}}

        Identify: 3 Weak Spots, 3 Key Projects to Highlight, 5 Predicted Questions.
        Output JSON with keys: "weakSpots", "keyProjects", "predictedQuestions".
      `,

  // -------------------------------------------------------------------------
  // Dedicated-handler prompts (one key per distinct prompt/systemInstruction)
  // -------------------------------------------------------------------------

  handler_resume_analysis:
    `Analyze this resume for the {{marketName}} market. Provide a score (0-100), summary, strengths, improvements (area + suggestion), and keywords.`,

  handler_resume_analysis_image:
    `Analyze this resume for the {{marketName}} market. Provide a score (0-100), summary, strengths, improvements (area + suggestion), and keywords. Transcribe and analyze the resume from the provided images.`,

  handler_mock_interview_generate:
    `You are an experienced {{marketName}} hiring manager. ` +
    `Generate 8 interview questions for this candidate — mix of behavioural, technical, ` +
    `situational, and culture-fit questions. Tailor them to the job and the candidate's background.\n\n` +
    `Resume:\n{{resumeText}}\n\nJob Description:\n{{jobDescription}}`,

  handler_mock_interview_eval:
    `You are an expert interview coach. Evaluate the candidate's answer to the interview question below.\n\n` +
    `Question: {{question}}\n\n` +
    `Candidate's Answer: {{answer}}\n\n` +
    `{{jobContextBlock}}` +
    `Score the answer 0–100, identify specific strengths and areas to improve, ` +
    `and provide a model answer that would score highly.`,

  handler_career_coach_base:
    `You are 'Alex', an empathetic and encouraging AI career coach. Your tone is warm, ` +
    `friendly, and professional yet conversational. Avoid being overly robotic. Use natural ` +
    `language, ask clarifying questions, and use markdown for formatting like **bolding** key terms.`,

  handler_career_coach_candidate:
    `You are 'Alex', an empathetic and expert AI career coach for a job seeker. Your tone is warm, ` +
    `friendly, and professional yet conversational. Ask clarifying questions, offer encouragement, and ` +
    `use markdown (**bolding**, lists) where appropriate. Here is the user's resume for context if they ` +
    `ask questions related to it:\n\n{{resumeText}}`,

  handler_career_coach_employer:
    `You are 'Alex', a professional and insightful AI HR assistant for an employer. Your tone is helpful, ` +
    `collaborative, and professional yet conversational. Use markdown (**bolding**, lists) where appropriate. ` +
    `Here is the employer's company profile for context: Name: {{companyName}}, ` +
    `Website: {{companyWebsite}}, Description: {{companyDescription}}`,

  handler_cover_letter:
    `Write a professional cover letter tailored for the {{marketName}} job market. ` +
    `Match the candidate's experience to the job requirements. ` +
    `Keep it concise (3–4 paragraphs), confident, and specific.\n\n` +
    `Resume:\n{{resumeText}}\n\nJob Description:\n{{jobDescription}}`,

  handler_career_path:
    `You are a career counsellor specialising in the {{marketName}} job market. ` +
    `Create a detailed, realistic career roadmap for the candidate to transition into the role of "{{desiredRole}}". ` +
    `Identify skill gaps, provide a phased roadmap with actionable steps and resources, ` +
    `suggest bridge roles if a direct transition is unrealistic, and give an honest summary.\n\n` +
    `Resume:\n{{resumeText}}`,

  handler_extract_url:
    `Extract the main professional profile or resume text from the following HTML. ` +
    `Ignore navigation, ads, and scripts.\nHTML Content: {{html}}`,
};

// ---------------------------------------------------------------------------
// Renderer
// ---------------------------------------------------------------------------

/**
 * Replace every {{key}} (with optional surrounding whitespace) with the
 * string representation of vars[key]. Unknown placeholders → empty string.
 */
export function renderPrompt(
  template: string,
  vars: Record<string, unknown>
): string {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key: string) =>
    String(vars[key] ?? "")
  );
}

// ---------------------------------------------------------------------------
// Template resolver (default → Firestore override)
// ---------------------------------------------------------------------------

/**
 * Returns the Firestore override for `key` if one exists and is non-empty,
 * otherwise the built-in PROMPT_TEMPLATES entry.
 * Emits a console.warn if the key is completely unknown.
 */
export function getPromptTemplate(key: string): string {
  const override = getPromptOverride(key);
  if (override !== undefined && override.trim() !== "") {
    return override;
  }
  const builtin = PROMPT_TEMPLATES[key];
  if (builtin === undefined) {
    console.warn(`[prompts] Unknown prompt key: "${key}"`);
    return "";
  }
  return builtin;
}

// ---------------------------------------------------------------------------
// Primary builder
// ---------------------------------------------------------------------------

/** Resolve the template for `key` (Firestore override or built-in) and render it. */
export function buildPrompt(
  key: string,
  vars: Record<string, unknown>
): string {
  return renderPrompt(getPromptTemplate(key), vars);
}

// ---------------------------------------------------------------------------
// Admin helpers
// ---------------------------------------------------------------------------

/** All registered prompt keys (for admin UI listing). */
export function listPromptKeys(): string[] {
  return Object.keys(PROMPT_TEMPLATES);
}

/** The built-in (default) template for a key, regardless of any override. */
export function getPromptDefault(key: string): string {
  return PROMPT_TEMPLATES[key] ?? "";
}
