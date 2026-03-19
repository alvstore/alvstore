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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { event_type, customer_phone, variables } = await req.json();

    if (!event_type || !customer_phone) {
      return new Response(
        JSON.stringify({ error: "event_type and customer_phone required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Look up automation template by event_type
    const { data: template } = await supabase
      .from("templates")
      .select("*")
      .eq("event_type", event_type)
      .limit(1)
      .maybeSingle();

    if (!template) {
      return new Response(
        JSON.stringify({ success: false, skipped: true, reason: `No template for event: ${event_type}` }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Replace variables in template body
    let messageBody = template.body || "";
    if (variables && typeof variables === "object") {
      for (const [key, value] of Object.entries(variables)) {
        messageBody = messageBody.replace(
          new RegExp(`\\{\\{${key}\\}\\}`, "g"),
          String(value)
        );
      }
    }

    if (!messageBody.trim()) {
      return new Response(
        JSON.stringify({ success: false, reason: "Empty message body after variable replacement" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get WhatsApp config
    const { data: settings } = await supabase
      .from("business_settings")
      .select("whatsapp_api_url, whatsapp_api_key, whatsapp_phone_id")
      .limit(1)
      .single();

    const phone = customer_phone.replace(/\D/g, "");
    let sent = false;
    let channel = "none";
    let waMessageId: string | null = null;

    // Try WhatsApp first
    if (settings?.whatsapp_api_url && settings?.whatsapp_api_key && settings?.whatsapp_phone_id) {
      try {
        const waResponse = await fetch(
          `${settings.whatsapp_api_url}/${settings.whatsapp_phone_id}/messages`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${settings.whatsapp_api_key}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              messaging_product: "whatsapp",
              to: phone,
              type: "text",
              text: { body: messageBody },
            }),
          }
        );

        const waData = await waResponse.json();
        if (waResponse.ok) {
          sent = true;
          channel = "whatsapp";
          waMessageId = waData?.messages?.[0]?.id || null;
        } else {
          console.error("WhatsApp API error:", waData);
        }
      } catch (waErr) {
        console.error("WhatsApp send failed:", waErr);
      }
    }

    // Fallback to SMS if WhatsApp failed
    if (!sent) {
      const smsApiUrl = Deno.env.get("SMS_API_URL");
      const smsApiKey = Deno.env.get("SMS_API_KEY");

      if (smsApiUrl && smsApiKey) {
        try {
          const smsSenderId = Deno.env.get("SMS_SENDER_ID") || "";
          const params = new URLSearchParams({
            apikey: smsApiKey,
            senderid: smsSenderId,
            number: phone,
            message: messageBody,
            format: "json",
          });

          const smsResponse = await fetch(`${smsApiUrl}?${params.toString()}`);
          if (smsResponse.ok) {
            sent = true;
            channel = "sms";
          }
        } catch (smsErr) {
          console.error("SMS fallback failed:", smsErr);
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: sent,
        channel,
        event_type,
        whatsapp_message_id: waMessageId,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Automation error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
