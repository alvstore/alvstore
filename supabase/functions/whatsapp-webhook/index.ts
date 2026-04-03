import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  // GET — Meta webhook verification
  if (req.method === "GET") {
    const url = new URL(req.url);
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");

    if (mode === "subscribe") {
      const { data: settings } = await supabase
        .from("business_settings")
        .select("integrations")
        .limit(1)
        .single();
      const integrations = (settings?.integrations as Record<string, string>) || {};
      const expectedToken = integrations["wa_verify_token"];

      if (token === expectedToken) {
        console.log("Webhook verified successfully");
        return new Response(challenge, { status: 200 });
      }
      console.log("Webhook verification failed — token mismatch");
      return new Response("Forbidden", { status: 403 });
    }
    return new Response("OK", { status: 200 });
  }

  // POST — Incoming messages / status updates
  try {
    const body = await req.json();
    console.log("Webhook payload:", JSON.stringify(body).slice(0, 500));

    // TODO: Validate X-Hub-Signature-256 with App Secret (Phase 2 hardening)
    // For now, process all valid-looking payloads

    const entries = body?.entry || [];
    for (const entry of entries) {
      const changes = entry?.changes || [];
      for (const change of changes) {
        const value = change?.value;
        if (!value) continue;

        // Handle incoming messages
        if (value.messages && value.messages.length > 0) {
          for (const msg of value.messages) {
            const fromNumber = msg.from;
            const messageType = msg.type || "text";
            const messageBody =
              msg.text?.body ||
              msg.caption ||
              `[${messageType}]`;
            const waTimestamp = msg.timestamp
              ? new Date(parseInt(msg.timestamp) * 1000).toISOString()
              : new Date().toISOString();

            // Find or create conversation
            let { data: convo } = await supabase
              .from("whatsapp_conversations")
              .select("id, lead_id")
              .eq("phone_number", fromNumber)
              .eq("status", "open")
              .limit(1)
              .single();

            // Look up lead by phone
            let leadId: string | null = null;
            const { data: lead } = await supabase
              .from("leads")
              .select("id")
              .or(`phone.eq.${fromNumber},phone.eq.+${fromNumber}`)
              .limit(1)
              .single();

            if (lead) {
              leadId = lead.id;
            } else {
              // Create draft lead
              const { data: newLead } = await supabase
                .from("leads")
                .insert({ name: `WhatsApp ${fromNumber}`, phone: fromNumber, source: "whatsapp", status: "new" })
                .select("id")
                .single();
              if (newLead) leadId = newLead.id;
            }

            if (!convo) {
              const { data: newConvo } = await supabase
                .from("whatsapp_conversations")
                .insert({ phone_number: fromNumber, lead_id: leadId, status: "open" })
                .select("id")
                .single();
              convo = newConvo;
            }

            // Insert message
            await supabase.from("whatsapp_messages").insert({
              wa_message_id: msg.id,
              conversation_id: convo?.id,
              lead_id: leadId,
              direction: "inbound",
              type: messageType,
              body: messageBody,
              media_url: msg.image?.url || msg.document?.url || msg.video?.url || null,
              status: "received",
              timestamp: waTimestamp,
            });

            // Update conversation last message
            if (convo?.id) {
              await supabase
                .from("whatsapp_conversations")
                .update({ last_message_at: waTimestamp })
                .eq("id", convo.id);
            }

            // Create notification for admins
            const { data: admins } = await supabase
              .from("user_roles")
              .select("user_id")
              .eq("role", "admin");

            if (admins) {
              const notifications = admins.map((a: any) => ({
                user_id: a.user_id,
                type: "whatsapp",
                title: "New WhatsApp Message",
                body: `From ${fromNumber}: ${messageBody.slice(0, 100)}`,
                metadata: { conversation_id: convo?.id, lead_id: leadId },
              }));
              await supabase.from("notification_feed").insert(notifications);
            }
          }
        }

        // Handle status updates
        if (value.statuses && value.statuses.length > 0) {
          for (const status of value.statuses) {
            const waMessageId = status.id;
            const newStatus = status.status; // sent, delivered, read, failed
            await supabase
              .from("whatsapp_messages")
              .update({ status: newStatus })
              .eq("wa_message_id", waMessageId);
          }
        }
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("Webhook error:", error);
    // Always return 200 to Meta to prevent retries
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
