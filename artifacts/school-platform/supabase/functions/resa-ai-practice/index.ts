import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed." }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const openAiKey = Deno.env.get("OPENAI_API_KEY");

  if (!supabaseUrl || !supabaseAnonKey) {
    return jsonResponse({ error: "The school authentication service is not configured." }, 503);
  }

  const authorization = req.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) {
    return jsonResponse({ error: "Sign in to RESA before generating practice questions." }, 401);
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    return jsonResponse({ error: "Your sign-in session is invalid or expired. Please sign in again." }, 401);
  }

  if (!openAiKey) {
    return jsonResponse({
      error: "AI question generation is not activated yet. The school administrator must add the OPENAI_API_KEY secret in Supabase Edge Function secrets.",
    }, 503);
  }

  let input: { level?: unknown; subject?: unknown; count?: unknown; topic?: unknown; sourceText?: unknown };
  try {
    input = await req.json();
  } catch {
    return jsonResponse({ error: "Request body must be valid JSON." }, 400);
  }

  const level = typeof input.level === "string" ? input.level.trim().slice(0, 100) : "All levels";
  const subject = typeof input.subject === "string" ? input.subject.trim().slice(0, 100) : "General Studies";
  const topic = typeof input.topic === "string" ? input.topic.trim().slice(0, 120) : "";
  const sourceText = typeof input.sourceText === "string" ? input.sourceText.trim().slice(0, 12000) : "";
  const count = Number.isInteger(input.count) ? Math.min(30, Math.max(1, Number(input.count))) : 5;

  if (!level || !subject) return jsonResponse({ error: "Choose a class level and subject." }, 400);

  const systemPrompt = [
    "You are RESA's educational practice-question writer for Nigerian primary and secondary learners.",
    "Write original, age-appropriate multiple-choice revision questions. Do not reproduce copyrighted exam papers or claim questions are official WAEC, NECO, BECE, or JAMB questions.",
    "Use clear Nigerian/British English where appropriate. Ensure exactly one best answer, accurate facts, plausible distractors, and a helpful short explanation.",
    "Return only valid JSON with this exact shape: { questions: [{ prompt: string, options: string[], answer: integer, explanation: string, level: string, subject: string }] }.",
    "Each question must have exactly four options. The answer is the zero-based index of the correct option. Do not include markdown fences or extra properties.",
  ].join(" ");

  const userPrompt = [
    `Create exactly ${count} distinct questions.`,
    `Class/exam level: ${level}.`,
    `Subject: ${subject}.`,
    topic ? `Focus topic: ${topic}.` : "Choose a sensible range of core topics for this subject and level.",
    sourceText ? `Use this teacher-provided material as the primary source. Ground questions in it and avoid contradicting it:\n${sourceText}` : "No source material was provided; use established curriculum knowledge for this class level.",
    "Mix recall, understanding, and application. Do not repeat questions. Avoid duplicates and do not pad with unsupported facts.",
  ].join("\n");

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openAiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.4,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!response.ok) {
      console.error("OpenAI request failed with status:", response.status);
      if (response.status === 401) {
        return jsonResponse({ error: "The AI provider key is invalid. Please check the OPENAI_API_KEY secret." }, 502);
      }
      if (response.status === 429) {
        return jsonResponse({ error: "The AI provider is temporarily rate-limited or out of available quota. Please try later." }, 503);
      }
      return jsonResponse({ error: "The AI provider could not generate questions right now. Please try again later." }, 502);
    }

    const payload = await response.json();
    const content = payload?.choices?.[0]?.message?.content;
    if (typeof content !== "string") {
      return jsonResponse({ error: "The AI provider returned an empty response. Please try again." }, 502);
    }

    const parsed = JSON.parse(content);
    if (!Array.isArray(parsed.questions)) {
      return jsonResponse({ error: "The AI response did not contain a question list. Please try again." }, 502);
    }

    const questions = parsed.questions
      .slice(0, count)
      .filter((q: any) =>
        typeof q?.prompt === "string" &&
        Array.isArray(q?.options) &&
        q.options.length === 4 &&
        q.options.every((option: unknown) => typeof option === "string") &&
        Number.isInteger(q?.answer) &&
        q.answer >= 0 &&
        q.answer < 4 &&
        typeof q?.explanation === "string"
      )
      .map((q: any) => ({
        prompt: q.prompt.slice(0, 1200),
        options: q.options.map((option: string) => option.slice(0, 400)),
        answer: q.answer,
        explanation: q.explanation.slice(0, 1800),
        level: level,
        subject: subject,
      }));

    if (!questions.length) {
      return jsonResponse({ error: "The AI returned questions that did not pass format checks. Please try again." }, 502);
    }

    return jsonResponse({ questions, count: questions.length });
  } catch (error) {
    console.error("RESA AI practice generation failed:", error);
    return jsonResponse({ error: "Could not generate practice questions. Please try again." }, 502);
  }
});
