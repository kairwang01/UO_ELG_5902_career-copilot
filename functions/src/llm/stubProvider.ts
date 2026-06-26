/**
 * Deterministic LLM stub for E2E tests (SCRUM-42).
 *
 * Activated ONLY when E2E_LLM_STUB=true (set by the Playwright/emulator harness),
 * so it can never run in production. resolveProvider() short-circuits to this before
 * any real provider/key work, so a happy-path tool run returns instantly, for free,
 * with schema-valid output instead of calling Gemini/KAIRLLM.
 */
import type { LLMProvider, LLMRequest, LLMResult } from "./LLMProvider";

export function llmStubEnabled(): boolean {
  return process.env.E2E_LLM_STUB === "true";
}

/**
 * Synthesizes a minimal value that satisfies a Gemini responseSchema node, so the
 * stub works for ANY tool's schema (object/array/string/number/boolean), not just one.
 */
function arrayLengthForKey(key: string): number {
  if ([
    "contactSuggestions",
    "experienceSuggestions",
    "keyStrengths",
    "negotiationStrategy",
    "objectionHandlers",
    "learningPhases",
  ].includes(key)) return 3;

  if ([
    "events",
    "opportunities",
    "jobSearchStrategies",
    "strengthsToHighlight",
    "talkingPoints",
    "growthAreaDiscussionPoints",
    "suggestedProjects",
    "commonObjectionsAndResponses",
    "keyActivities",
  ].includes(key)) return 2;

  return 1;
}

function numberForKey(key: string, index: number): number {
  if (key === "baseMin") return 85000;
  if (key === "baseMax") return 105000;
  if (key === "compatibilityScore") return 86;
  if (key === "correctAnswerIndex") return 0;
  if (/score|band|rating/i.test(key)) return 82 + index;
  if (/count/i.test(key)) return 4 + index;
  return 75 + index;
}

function sampleStringForKey(key: string, index: number): string {
  const label = `Sample ${index + 1}`;

  switch (key) {
    case "letter":
      return [
        "Dear Hiring Team,\n\nSample Works caught my attention because the team is building practical career software for candidates who need clearer next steps. My recent work combines product judgment, React delivery, and careful user-flow testing, so I can contribute to both the interface details and the reliability behind them.\n\nIn my last project, I rebuilt a career workspace around guided tools, saved results, and faster task switching. I worked through edge states, loading feedback, empty states, and form recovery so users could move from resume review to outreach without losing context. That mix of execution and product thinking matches the role's need for someone who can turn ambiguous requirements into polished workflows.\n\nI would welcome the chance to discuss how my background can support the team. Thank you for considering my application, and I look forward to speaking with you.",
      ].join("");
    case "body":
      return "Hi Alex,\n\nThank you for the Sample Works conversation today. I appreciated learning how the team balances candidate guidance with practical hiring workflows. My background in React interfaces, product operations, and structured QA maps well to the work we discussed, and I would be glad to share a short walkthrough of the career-tool improvements I recently shipped.\n\nBest,\nKair.";
    case "subject":
      return "Thank you for the Sample Works conversation";
    case "headline":
      return "Product-minded frontend engineer building reliable career tools";
    case "summary":
      return "Sample profile summary for a product-minded frontend engineer who turns ambiguous career workflows into usable, tested software. I combine React implementation, Firebase-backed data flows, and practical product judgment to improve onboarding, resume tools, outreach flows, and interview preparation. My strongest work is translating user friction into small interface decisions that make complex job-search tasks feel clear, accountable, and ready to use.";
    case "suggestion":
      return `${label} rewrite: Reframed the experience around shipped outcomes, user workflow ownership, and cross-functional delivery, with emphasis on React implementation, QA evidence, and candidate-facing product impact.`;
    case "strategySummary":
      return "Sample networking plan focused on warm, credible conversations with people near the hiring workflow. Start with alumni and product engineers, then expand to recruiters after collecting context about the team's current priorities. Keep each message short, connect it to shipped career-tool work, and ask for one practical insight before requesting a referral conversation.";
    case "reason":
      return `${label} reason: This contact is close to the product workflow and can explain how hiring teams evaluate career-platform experience.`;
    case "outreachMessage":
      return `Hi Alex, I saw your work on candidate-facing product flows at Sample Works and found it closely related to my recent React and Firebase career-tool project. I would value one practical insight on what your team looks for when evaluating frontend engineers for this kind of product.`;
    case "marketAnalysisSummary":
      return "Sample market read for Toronto frontend roles shows a strong band for engineers who combine React delivery, data-backed product thinking, and reliable QA habits. The current offer is workable, but the candidate can credibly ask for an adjustment by tying the request to shipped interface improvements, Firebase workflow ownership, and readiness to contribute quickly.";
    case "explanation":
      return "Sample range rationale based on local market bands, hands-on React delivery, Firebase workflow ownership, and the risk reduction created by a candidate who can ship polished user-facing tools with test evidence.";
    case "counterOfferEmailDraft":
      return "Hi Alex,\n\nThank you again for the offer and for the time the team invested throughout the process. I am excited about the role and the chance to contribute to Sample Works. Based on the scope we discussed, my React product delivery experience, and current Toronto market data, I would like to explore a base salary in the 95,000 to 105,000 CAD range. If there is flexibility, I would be ready to move forward quickly.\n\nBest,\nKair.";
    case "response":
      return `${label} response: I understand the budget constraint, and I would be open to discussing a phased review or signing adjustment if base flexibility is limited.`;
    case "formattedText":
    case "updatedResumeText":
      return [
        "Kair Wang",
        "Toronto, ON | kair@example.com | https://example.com/sample",
        "",
        "Professional Summary",
        "Product-minded frontend engineer with experience building career technology workflows, React interfaces, Firebase-backed features, and QA evidence for candidate-facing tools.",
        "",
        "Experience",
        "Sample Career CoPilot - Frontend Engineer",
        "- Built guided resume, outreach, interview, and planning tools with saved results and clear recovery states.",
        "- Improved loading, empty, and error states across the workspace so users could complete tasks without losing context.",
        "- Added deterministic smoke coverage for tool execution, result rendering, and persistence behavior.",
        "",
        "Projects",
        "Sample Career Workspace Polish",
        "- Refined navigation, tool cards, quality gates, and download flows for a production-style job-search workspace.",
        "",
        "Skills",
        "React, TypeScript, Firebase, Firestore, Playwright, product QA, workflow design.",
      ].join("\n");
    case "currency":
      return "CAD";
    case "url":
      return "https://example.com/sample";
    case "company":
      return "Sample Works";
    case "jobTitle":
      return "Frontend Engineer";
    case "location":
      return "Toronto, ON";
    case "contactType":
      return ["Alumni product engineer", "Hiring team recruiter", "Frontend platform lead"][index] ?? "Product contact";
    case "objection":
      return ["The salary band is fixed", "We need internal approval", "The offer is already competitive"][index] ?? "Budget concern";
    case "phaseTitle":
      return ["Foundation", "Applied practice", "Portfolio proof"][index] ?? "Next phase";
    case "duration":
      return ["2 weeks", "3 weeks", "4 weeks"][index] ?? "2 weeks";
    case "skill":
      return "Advanced React product delivery";
    case "title":
      return `${label} result`;
    case "eventName":
      return `${label} Career Tech Meetup`;
    case "eventType":
      return index % 2 === 0 ? "meetup" : "conference";
    case "date":
      return "2026-07-15";
    case "keyActivities":
      return `${label} activity: Build a small React feature, review it with a checklist, and record the before-and-after user flow.`;
    case "milestone":
      return `${label} milestone: Ship a tested portfolio feature with a short product note and QA evidence.`;
    case "feedback":
      return "Sample feedback: The answer is clear and actionable, with one useful improvement around making the tradeoff more explicit.";
    case "question":
      return `${label} question about product tradeoffs and delivery evidence?`;
    case "answer":
      return `${label} answer explaining the decision, the user impact, and the verification step in concise language.`;
    default:
      if (/email/i.test(key)) return "kair@example.com";
      if (/phone/i.test(key)) return "+1 555 010 1234";
      if (/name/i.test(key)) return "Kair Wang";
      if (/description|definition|example|activity|milestone|point|accomplishment|strength|strategy|project|course/i.test(key)) {
        return `${label}: Practical career-product work with React, Firebase, user-flow QA, and clear evidence of shipped improvements.`;
      }
      return `${label} ${key}`;
  }
}

function synthFromSchema(schema: unknown, key = "value", index = 0): unknown {
  if (!schema || typeof schema !== "object") return `Sample ${key}`;
  const node = schema as { type?: string; properties?: Record<string, unknown>; items?: unknown };
  const type = String(node.type ?? "").toUpperCase();
  if (type === "OBJECT" || node.properties) {
    const out: Record<string, unknown> = {};
    const props = node.properties ?? {};
    for (const k of Object.keys(props)) out[k] = synthFromSchema(props[k], k, index);
    return out;
  }
  if (type === "ARRAY" || node.items) {
    return Array.from({ length: arrayLengthForKey(key) }, (_, itemIndex) => synthFromSchema(node.items, key, itemIndex));
  }
  if (type === "NUMBER" || type === "INTEGER") return numberForKey(key, index);
  if (type === "BOOLEAN") return true;
  return sampleStringForKey(key, index);
}

class StubProvider implements LLMProvider {
  readonly name = "e2e-stub";

  async generate(req: LLMRequest): Promise<LLMResult> {
    const raw = req.responseSchema ? synthFromSchema(req.responseSchema) : undefined;
    const text = raw ? JSON.stringify(raw) : "Sample stubbed response for E2E.";
    return { text, raw: raw ?? text, model: "e2e-stub" };
  }
}

export function makeStubProvider(): LLMProvider {
  return new StubProvider();
}
