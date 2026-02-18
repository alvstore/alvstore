import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const RAZORPAY_KEY_ID = Deno.env.get("RAZORPAY_KEY_ID");
    const RAZORPAY_KEY_SECRET = Deno.env.get("RAZORPAY_KEY_SECRET");
    if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
      throw new Error("Razorpay credentials not configured");
    }

    const { amount, customer_name, customer_email, customer_phone, invoice_id, description } = await req.json();
    if (!amount || amount <= 0) throw new Error("Invalid amount");

    // Create Razorpay payment link
    const auth = btoa(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`);
    const rpRes = await fetch("https://api.razorpay.com/v1/payment_links", {
      method: "POST",
      headers: {
        "Authorization": `Basic ${auth}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount: Math.round(amount * 100), // paise
        currency: "INR",
        description: description || `Payment for Invoice`,
        customer: {
          name: customer_name || undefined,
          email: customer_email || undefined,
          contact: customer_phone || undefined,
        },
        notify: { sms: !!customer_phone, email: !!customer_email },
        callback_url: "",
        callback_method: "get",
        notes: { invoice_id: invoice_id || "" },
      }),
    });

    const rpData = await rpRes.json();
    if (!rpRes.ok) {
      throw new Error(`Razorpay API error [${rpRes.status}]: ${JSON.stringify(rpData)}`);
    }

    // Store payment record in DB
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    if (invoice_id) {
      // Get invoice to find customer_id
      const { data: inv } = await supabase.from("invoices").select("customer_id").eq("id", invoice_id).single();
      
      await supabase.from("payments").insert({
        amount,
        payment_method: "online",
        type: "invoice",
        status: "pending",
        reference_id: rpData.id,
        customer_id: inv?.customer_id || null,
        notes: `Razorpay Link: ${rpData.short_url}`,
      });
    }

    return new Response(JSON.stringify({
      success: true,
      payment_link_url: rpData.short_url,
      payment_link_id: rpData.id,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error: unknown) {
    console.error("Error creating payment link:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
