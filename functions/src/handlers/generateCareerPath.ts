/**
 * generateCareerPath — HTTPS Callable Cloud Function.
 *
 * Server-side port of geminiService.generateCareerPath().
 * Flow: verify auth → deduct credits → call LLM → return result
 *
 * Frontend integration:
 *   const fn = httpsCallable(getFunctions(), "generateCareerPath");
 *   const result = await fn({ resumeText, desiredRole, marketName });
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { Type } from "@google/genai";
import { requireAuth } from "../middleware/auth";
import { getProvider } from "../llm/router";
import { deductCredits } from "../credits/deductCredits";
import { TOOL_CREDIT_COSTS } from "../credits/schema";

// ---------------------------------------------------------------------------
// Request / Response types  (mirror types.ts in repo root)
// ---------------------------------------------------------------------------

interface GenerateCareerPathRequest {
  resumeText: string;
  desiredRole: string;
  marketName: string;
}

interface SkillGap {
  skill: string;
  reason: string;
}

interface ActionableStep {
  type: string;         // "course" | "certification" | "project" | "networking" | "self-study"
  description: string;
  resources: string[];
}

interface RoadmapPhase {
  phaseTitle: string;
  estimatedDuration: string;
  goal: string;
  actionableSteps: ActionableStep[];
  milestones: string[];
}

interface BridgeRole {
  title: string;
  reason: string;
}

interface CareerPathResult {
  summary: string;
  overallSkillGaps: SkillGap[];
  roadmap: RoadmapPhase[];
  bridgeRoles: BridgeRole[];
}

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const CAREER_PATH_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    summary: { type: Type.STRING },
    overallSkillGaps: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          skill:  { type: Type.STRING },
          reason: { type: Type.STRING },
        },
        required: ["skill", "reason"],
      },
    },
    roadmap: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          phaseTitle:         { type: Type.STRING },
          estimatedDuration:  { type: Type.STRING },
          goal:               { type: Type.STRING },
          actionableSteps: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                type:        { type: Type.STRING },
                description: { type: Type.STRING },
                resources:   { type: Type.ARRAY, items: { type: Type.STRING } },
              },
              required: ["type", "description", "resources"],
            },
          },
          milestones: { type: Type.ARRAY, items: { type: Type.STRING } },
        },
        required: ["phaseTitle", "estimatedDuration", "goal", "actionableSteps", "milestones"],
      },
    },
    bridgeRoles: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          title:  { type: Type.STRING },
          reason: { type: Type.STRING },
        },
        required: ["title", "reason"],
      },
    },
  },
  required: ["summary", "overallSkillGaps", "roadmap", "bridgeRoles"],
};

// ---------------------------------------------------------------------------
// Cloud Function
// ---------------------------------------------------------------------------

export const generateCareerPathFunction = onCall(async (request) => {
  const uid = requireAuth(request);

  const data = request.data as GenerateCareerPathRequest;

  if (!data.resumeText?.trim()) {
    throw new HttpsError("invalid-argument", "resumeText is required.");
  }
  if (!data.desiredRole?.trim()) {
    throw new HttpsError("invalid-argument", "desiredRole is required.");
  }
  if (!data.marketName?.trim()) {
    throw new HttpsError("invalid-argument", "marketName is required.");
  }

  await deductCredits(uid, TOOL_CREDIT_COSTS["career-path"], "career-path");

  const prompt =
    `You are a career counsellor specialising in the ${data.marketName} job market. ` +
    `Create a detailed, realistic career roadmap for the candidate to transition into the role of "${data.desiredRole}". ` +
    `Identify skill gaps, provide a phased roadmap with actionable steps and resources, ` +
    `suggest bridge roles if a direct transition is unrealistic, and give an honest summary.\n\n` +
    `Resume:\n${data.resumeText}`;

  const provider = getProvider();
  const result = await provider.generate({
    prompt,
    responseSchema: CAREER_PATH_SCHEMA,
  });

  return result.raw as CareerPathResult;
});
