import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { crypto } from "https://deno.land/std@0.168.0/crypto/mod.ts";
import { encode as hexEncode } from "https://deno.land/std@0.168.0/encoding/hex.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-razorpay-signature",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const WEBHOOK_SECRET = Deno.env.get("RAZORPAY_WEBHOOK_SECRET");
    if (!WEBHOOK_SECRET) throw new Error("RAZORPAY_WEBHOOK_SECRET not configured");

    const body = await req.text();
    const signature = req.headers.get("x-razorpay-signature") || "";

    // Verify webhook signature using Web Crypto
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey("raw", encoder.encode(WEBHOOK_SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(body));
    const expectedSig = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, "0")).join("");
    if (signature !== expectedSig) {
      console.error("Invalid webhook signature");
      return new Response(JSON.stringify({ error: "Invalid signature" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const event = JSON.parse(body);
    const eventType = event.event;

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    if (eventType === "payment.captured" || eventType === "payment_link.paid") {
      const payment = event.payload?.payment?.entity;
      const paymentLinkId = event.payload?.payment_link?.entity?.id || payment?.notes?.payment_link_id;
      const invoiceId = payment?.notes?.invoice_id || event.payload?.payment_link?.entity?.notes?.invoice_id;
      const amountPaise = payment?.amount || 0;
      const amount = amountPaise / 100;

      // Update payment record
      if (paymentLinkId) {
        await supabase.from("payments").update({
          status: "completed",
          reference_id: payment?.id || paymentLinkId,
        }).eq("reference_id", paymentLinkId);
      }

      // Update invoice paid amount
      if (invoiceId) {
        const { data: inv } = await supabase.from("invoices").select("paid_amount, total").eq("id", invoiceId).single();
        if (inv) {
          const newPaid = (inv.paid_amount || 0) + amount;
          const paymentStatus = newPaid >= (inv.total || 0) ? "paid" : "partial";
          await supabase.from("invoices").update({
            paid_amount: newPaid,
            payment_status: paymentStatus,
            status: paymentStatus === "paid" ? "paid" : undefined,
          }).eq("id", invoiceId);
        }
      }

      // Audit log
      await supabase.from("finance_audit_log").insert({
        action: "RAZORPAY_PAYMENT_RECEIVED",
        entity_type: "payment",
        entity_id: payment?.id,
        details: `Razorpay ${eventType}: ₹${amount} received. Invoice: ${invoiceId || "N/A"}`,
      });

      console.log(`Processed ${eventType}: ₹${amount}`);
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: unknown) {
    console.error("Webhook error:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
