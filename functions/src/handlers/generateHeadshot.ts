/**
 * generateHeadshot — HTTPS Callable Cloud Function.
 *
 * Server-side port of geminiService.generateProfessionalHeadshot().
 * Uses the Gemini image model directly (not the text LLMProvider) and returns
 * base64-encoded image variations. The API key stays server-side.
 *
 * Frontend integration (services/aiClient.ts):
 *   const fn = httpsCallable(getFunctions(), "generateHeadshot");
 *   const { data } = await fn({ imageBase64 });  // → { images: string[] }
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { GoogleGenAI } from "@google/genai";
import { requireAuth } from "../middleware/auth";
import { ensurePlatformCaches, getGeminiApiKey } from "../config/env";

interface GenerateHeadshotRequest {
  imageBase64: string;
}

// ~6MB of base64 (≈4.5MB raw) upper bound to keep request size / cost sane.
const MAX_IMAGE_BASE64_LEN = 8_000_000;

export const generateHeadshotFunction = onCall({ invoker: "public" }, async (request) => {
  requireAuth(request);

  const { imageBase64 } = (request.data ?? {}) as GenerateHeadshotRequest;
  if (!imageBase64 || typeof imageBase64 !== "string") {
    throw new HttpsError("invalid-argument", "imageBase64 is required.");
  }
  if (imageBase64.length > MAX_IMAGE_BASE64_LEN) {
    throw new HttpsError("invalid-argument", "Image is too large.");
  }

  // Warm the platform-config cache so the key getter reads the admin-configured
  // Firestore value (this handler reads the key directly, not via resolveProvider).
  await ensurePlatformCaches();
  const ai = new GoogleGenAI({ apiKey: getGeminiApiKey() });
  let response;
  try {
    response = await ai.models.generateContent({
      model: "gemini-2.5-flash-image",
      contents: {
        parts: [
          { inlineData: { data: imageBase64, mimeType: "image/jpeg" } },
          {
            text:
              "Generate 3 variations of this image as a professional corporate headshot. " +
              "Maintain the person's identity. Provide a neutral, soft-focus background. " +
              "Ensure a professional and polished look.",
          },
        ],
      },
    });
  } catch (err) {
    // The image-generation model has no free-tier quota (limit 0) — without
    // billing enabled on the Gemini key every call 429s. Surface a clear message
    // instead of a bare 500 INTERNAL so the UI can explain it.
    const msg = ((err as { message?: string })?.message ?? "").toLowerCase();
    if (msg.includes("429") || msg.includes("quota") || msg.includes("resource_exhausted")) {
      throw new HttpsError(
        "resource-exhausted",
        "AI avatar generation is temporarily unavailable (image-generation quota reached). Please try again later.",
      );
    }
    throw new HttpsError(
      "internal",
      "Couldn't generate avatars from this photo. Try a clearer, front-facing image.",
    );
  }

  const images: string[] = [];
  for (const part of response.candidates?.[0]?.content?.parts ?? []) {
    if (part.inlineData?.data) images.push(part.inlineData.data);
  }
  if (images.length === 0) {
    throw new HttpsError("internal", "The AI did not return any images.");
  }
  return { images };
});
