
// FIX: Corrected the Supabase Edge Functions type reference to use a working CDN to resolve "Cannot find name 'Deno'" errors.
/// <reference types="https://unpkg.com/@supabase/functions-js@2.4.1/src/edge-runtime.d.ts" />

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
// FIX: Import GoogleGenAI SDK to follow best practices instead of using direct fetch.
import { GoogleGenAI } from 'https://esm.sh/@google/genai@0.14.0';

const PRIMARY_MODEL = Deno.env.get('GEMINI_PRIMARY_MODEL') || 'gemini-3-flash-preview';
const FALLBACK_MODEL = Deno.env.get('GEMINI_FALLBACK_MODEL') || 'gemini-flash-latest';

const isQuotaError = (error: any): boolean => {
  const message = (error?.message || '').toLowerCase();
  return message.includes('resource_exhausted') || message.includes('quota exceeded') || error?.status === 429;
};

// FIX: Added a robust JSON extraction function to handle markdown and other formatting inconsistencies from the AI.
const extractJson = (str: string): any => {
    // Find JSON string within markdown ```json ... ```
    const match = str.match(/```json\s*([\s\S]*?)\s*```/);
    let jsonStr = (match && match[1]) ? match[1].trim() : str.trim();
    
    // Find the start of the first JSON object or array
    const firstBracket = jsonStr.indexOf('{');
    const firstSquare = jsonStr.indexOf('[');
    
    let start = -1;
    if (firstBracket === -1) start = firstSquare;
    else if (firstSquare === -1) start = firstBracket;
    else start = Math.min(firstBracket, firstSquare);
  
    if (start === -1) {
      throw new Error('No JSON object or array found in the AI response.');
    }
  
    // Trim leading non-JSON characters
    jsonStr = jsonStr.substring(start);
  
    try {
      return JSON.parse(jsonStr);
    } catch (e) {
      // Attempt to fix common errors like trailing commas
      try {
        const fixedJsonStr = jsonStr.replace(/,(\s*[\]}])/g, '$1');
        return JSON.parse(fixedJsonStr); 
      } catch (finalError) {
          console.error("Final JSON parsing attempt failed after fixing trailing commas.", finalError);
          throw new Error("The AI returned a response that could not be parsed as JSON.");
      }
    }
};

const callGeminiServer = async (geminiApiKey: string, prompt: string) => {
    // FIX: Initialize GoogleGenAI with a named API key parameter as per guidelines.
    const ai = new GoogleGenAI({ apiKey: geminiApiKey });

    // Ask the model to format the response as JSON
    const updatedPrompt = `${prompt}. Respond ONLY with a valid JSON object. Do not include markdown formatting like \`\`\`json.`;
    
    let response;
    try {
      response = await ai.models.generateContent({
          model: PRIMARY_MODEL,
          contents: updatedPrompt,
          config: {
              responseMimeType: 'application/json',
          }
      });
    } catch (firstError: any) {
      if (isQuotaError(firstError) && FALLBACK_MODEL !== PRIMARY_MODEL) {
        response = await ai.models.generateContent({
          model: FALLBACK_MODEL,
          contents: updatedPrompt,
          config: {
            responseMimeType: 'application/json',
          }
        });
      } else {
        throw firstError;
      }
    }

    // FIX: Use response.text property to extract content from GenerateContentResponse as per guidelines.
    if (!response.text) {
        throw new Error("Received an empty response from the AI model.");
    }
    
    // FIX: Use the robust extractJson function to prevent parsing errors.
    return extractJson(response.text);
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, // Use service role key for admin-level access
    );
    
    const geminiApiKey = Deno.env.get('API_KEY');
    if (!geminiApiKey) {
        throw new Error('Gemini API key is not configured in the function environment.');
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Missing or invalid authentication token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const apiKey = authHeader.split(' ')[1];

    const { data: userId, error: keyError } = await supabaseClient.rpc('verify_api_key', { p_api_key: apiKey });
    
    if (keyError || !userId) {
       return new Response(JSON.stringify({ error: 'Invalid API Key' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    const { endpoint, payload } = await req.json();

    let result;
    switch (endpoint) {
      case 'analyzeResume': {
        const { resumeText, marketName } = payload;
        const prompt = `Analyze this resume for the ${marketName} market. Provide a JSON response with score (0-100), summary, strengths, improvements (as an array of objects with 'area' and 'suggestion' keys), and keywords (as an array of strings). Resume: ${resumeText}`;
        result = await callGeminiServer(geminiApiKey, prompt);
        break;
      }
      
      case 'generateCoverLetter': {
        const { resumeText: clResume, jobDescription } = payload;
        const prompt = `Write a professional cover letter for the provided job description based on the resume. Provide a JSON response with one key: "letter", which contains the full text of the cover letter. Resume: ${clResume}\nJob: ${jobDescription}`;
        result = await callGeminiServer(geminiApiKey, prompt);
        break;
      }

      default:
        return new Response(JSON.stringify({ error: `Unknown endpoint: ${endpoint}` }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
