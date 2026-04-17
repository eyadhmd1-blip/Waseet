// Supabase Edge Function — ai-price-suggest
// Deno runtime
// Called by: mobile/app/(client)/new-request.tsx
//
// ENV vars required (set in Supabase Dashboard → Edge Functions → Secrets):
//   ANTHROPIC_API_KEY  — Claude API key
//
// Request body: { category: string, description: string }
// Response:     { min: number, max: number, currency: "JOD" }

import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Fallback price ranges per category if AI is unavailable
const FALLBACK_RANGES: Record<string, [number, number]> = {
  electrical:       [15,  60],
  plumbing:         [10,  50],
  ac_repair:        [20,  80],
  carpentry:        [15,  70],
  painting:         [30, 150],
  appliance_repair: [10,  40],
  cleaning:         [20,  60],
  moving:           [40, 200],
  tutoring:         [10,  25],
  quran_teaching:   [ 8,  20],
  design:           [20, 100],
  // Car services
  car_repair:       [20,  80],
  car_electrical:   [15,  60],
  car_tires:        [10,  40],
  car_ac:           [20,  70],
  car_bodywork:     [50, 300],
  car_cleaning:     [10,  30],
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { category, description } = await req.json() as {
      category: string;
      description: string;
    };

    if (!category || !description) {
      return new Response(
        JSON.stringify({ error: "category and description are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");

    // ── Try Claude API ────────────────────────────────────────
    if (apiKey) {
      const prompt = `أنت خبير بتسعير الخدمات المنزلية في الأردن.
بناءً على تصنيف الخدمة والوصف التالي، أعطني نطاق السعر المناسب بالدينار الأردني.

التصنيف: ${category}
الوصف: ${description}

أجب فقط بـ JSON بهذا الشكل:
{"min": <رقم>, "max": <رقم>}

لا تضف أي نص آخر.`;

      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 64,
          messages: [{ role: "user", content: prompt }],
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const text = data.content?.[0]?.text ?? "";
        const match = text.match(/\{[^}]+\}/);
        if (match) {
          const parsed = JSON.parse(match[0]) as { min: number; max: number };
          if (parsed.min > 0 && parsed.max > parsed.min) {
            return new Response(
              JSON.stringify({ min: parsed.min, max: parsed.max, currency: "JOD" }),
              { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
        }
      }
    }

    // ── Fallback: static ranges ───────────────────────────────
    const [min, max] = FALLBACK_RANGES[category] ?? [10, 50];
    return new Response(
      JSON.stringify({ min, max, currency: "JOD" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err) {
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
