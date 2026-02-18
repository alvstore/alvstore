import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get WhatsApp config from business_settings
    const { data: settings } = await supabase.from("business_settings").select("whatsapp_api_url, whatsapp_api_key, whatsapp_phone_id").limit(1).single();
    if (!settings?.whatsapp_api_url || !settings?.whatsapp_api_key) {
      throw new Error("WhatsApp API not configured. Go to Settings > WhatsApp to configure.");
    }

    const { to, message, template_name, template_params, conversation_id, sender_id } = await req.json();
    if (!to) throw new Error("Recipient phone number required");

    let waResponse: any;

    if (template_name) {
      // Template message
      waResponse = await fetch(`${settings.whatsapp_api_url}/${settings.whatsapp_phone_id}/messages`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${settings.whatsapp_api_key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: to.replace(/\D/g, ""),
          type: "template",
          template: {
            name: template_name,
            language: { code: "en" },
            components: template_params ? [{ type: "body", parameters: template_params.map((p: string) => ({ type: "text", text: p })) }] : undefined,
          },
        }),
      });
    } else {
      // Text message
      if (!message) throw new Error("Message content required");
      waResponse = await fetch(`${settings.whatsapp_api_url}/${settings.whatsapp_phone_id}/messages`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${settings.whatsapp_api_key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: to.replace(/\D/g, ""),
          type: "text",
          text: { body: message },
        }),
      });
    }

    const waData = await waResponse.json();
    if (!waResponse.ok) {
      throw new Error(`WhatsApp API error [${waResponse.status}]: ${JSON.stringify(waData)}`);
    }

    const waMessageId = waData?.messages?.[0]?.id || null;

    // Store message in chat if conversation_id provided
    if (conversation_id && message) {
      await supabase.from("chat_messages").insert({
        conversation_id,
        sender_id: sender_id || null,
        content: message,
        channel: "whatsapp",
        whatsapp_message_id: waMessageId,
        delivery_status: "sent",
      });

      await supabase.from("chat_conversations").update({
        last_message: message,
        last_message_at: new Date().toISOString(),
      }).eq("id", conversation_id);
    }

    return new Response(JSON.stringify({
      success: true,
      whatsapp_message_id: waMessageId,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error: unknown) {
    console.error("WhatsApp send error:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
