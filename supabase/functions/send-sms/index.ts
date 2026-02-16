import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { phone, message, template_id, variables } = await req.json();

    if (!phone) {
      return new Response(JSON.stringify({ error: "Missing 'phone'" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let smsMessage = message || "";

    // If template_id provided, fetch template and replace variables
    if (template_id) {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, supabaseKey);

      const { data: template } = await supabase
        .from("templates")
        .select("body")
        .eq("id", template_id)
        .single();

      if (template) {
        smsMessage = template.body;
        if (variables && typeof variables === "object") {
          for (const [key, value] of Object.entries(variables)) {
            smsMessage = smsMessage.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), String(value));
          }
        }
      }
    }

    if (!smsMessage) {
      return new Response(JSON.stringify({ error: "No message content" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get SMS API credentials from secrets
    const smsApiUrl = Deno.env.get("SMS_API_URL");
    const smsApiKey = Deno.env.get("SMS_API_KEY");
    const smsSenderId = Deno.env.get("SMS_SENDER_ID");
    const smsDltEntityId = Deno.env.get("SMS_DLT_ENTITY_ID");

    if (!smsApiUrl || !smsApiKey) {
      return new Response(
        JSON.stringify({ error: "SMS not configured. Add SMS_API_URL, SMS_API_KEY secrets." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generic SMS API call (adapt to your specific SMS provider)
    const params = new URLSearchParams({
      apikey: smsApiKey,
      senderid: smsSenderId || "",
      number: phone,
      message: smsMessage,
      format: "json",
    });

    if (smsDltEntityId) {
      params.append("dlt_entity_id", smsDltEntityId);
    }

    const response = await fetch(`${smsApiUrl}?${params.toString()}`);
    const result = await response.text();

    return new Response(JSON.stringify({ success: true, result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
