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
    const { to, subject, body, template_id, variables } = await req.json();

    if (!to || !subject) {
      return new Response(JSON.stringify({ error: "Missing 'to' or 'subject'" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // If template_id provided, fetch template and replace variables
    let emailBody = body || "";
    if (template_id) {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, supabaseKey);

      const { data: template } = await supabase
        .from("templates")
        .select("body, subject")
        .eq("id", template_id)
        .single();

      if (template) {
        emailBody = template.body;
        // Replace variables like {{name}}, {{amount}}, etc.
        if (variables && typeof variables === "object") {
          for (const [key, value] of Object.entries(variables)) {
            emailBody = emailBody.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), String(value));
          }
        }
      }
    }

    // Get SMTP credentials from secrets
    const smtpHost = Deno.env.get("SMTP_HOST");
    const smtpPort = Deno.env.get("SMTP_PORT") || "587";
    const smtpUser = Deno.env.get("SMTP_USER");
    const smtpPass = Deno.env.get("SMTP_PASS");
    const smtpFrom = Deno.env.get("SMTP_FROM") || smtpUser;

    if (!smtpHost || !smtpUser || !smtpPass) {
      return new Response(
        JSON.stringify({ error: "SMTP not configured. Add SMTP_HOST, SMTP_USER, SMTP_PASS secrets." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Use Deno's built-in SMTP via fetch to a mail API, or use a simple SMTP approach
    // For production, we use a REST-based email sending approach
    // This implementation uses a generic HTTP mail API pattern
    const response = await fetch(`https://${smtpHost}/send`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${smtpPass}`,
      },
      body: JSON.stringify({
        from: smtpFrom,
        to,
        subject,
        html: emailBody,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Email send failed: ${errText}`);
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
