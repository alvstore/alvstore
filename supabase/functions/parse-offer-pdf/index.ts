import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { pdfText } = await req.json();
    if (!pdfText || typeof pdfText !== "string" || pdfText.length < 20) {
      return new Response(JSON.stringify({ error: "pdfText is required (paste text content from PDF)" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "AI key not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const systemPrompt = `You are an Apple product offer parser. Extract structured offer data from the provided text.
Return a JSON array of offers. Each offer object must have:
- offer_type: one of "card_emi", "card_fs", "loan", "trade_in", "iphone_for_life", "cashback", "instant_discount", "other"
- bank_name: bank or partner name (e.g. "HDFC", "ICICI", "Bajaj")
- applicable_category: one of "iPhone", "Mac", "iPad", "Watch", "AirPods", "Accessories", or "All"
- applicable_product: specific product keyword if mentioned (e.g. "iPhone 16 Pro"), or null for category-wide
- discount_amount: numeric discount in INR (0 if not a fixed amount)
- discount_description: brief human-readable description of the offer
- start_date: ISO date string if mentioned, or null
- end_date: ISO date string if mentioned, or null

Only return the JSON array, no other text.`;

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Parse the following Apple offer document text:\n\n${pdfText.slice(0, 15000)}` },
        ],
        temperature: 0.1,
      }),
    });

    if (!aiRes.ok) {
      const errText = await aiRes.text();
      return new Response(JSON.stringify({ error: "AI request failed", details: errText }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiRes.json();
    const content = aiData.choices?.[0]?.message?.content || "";

    // Extract JSON array from response
    let offers = [];
    try {
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        offers = JSON.parse(jsonMatch[0]);
      }
    } catch {
      return new Response(JSON.stringify({ error: "Failed to parse AI response", raw: content }), {
        status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true, offers }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
