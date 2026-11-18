import { Router, type Request, type Response } from "express";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { prisma, pool } from "../db.js";
import { env } from "../env.js";
import { requireAuth, requireRole } from "../auth/middleware.js";

/**
 * Ports of the Supabase Edge Functions. External-provider functions
 * (WhatsApp/SMS/email/Razorpay/Hikvision) read credentials from
 * business_settings / env and degrade with a clear error when unconfigured.
 */
export const functionsRouter = Router();

const ok = (res: Response, body: unknown) => res.json(body);
const fail = (res: Response, message: string, status = 400) =>
  res.status(status).json({ error: message, success: false });

// ---------------------------------------------------------------------------
// manage-staff (admin user management)
// ---------------------------------------------------------------------------
async function manageStaff(req: Request, res: Response) {
  const { action, email, password, full_name, phone, role, user_id } = req.body ?? {};
  if (action === "create") {
    if (!email || !password || !full_name || !role) {
      return fail(res, "Missing required fields: email, password, full_name, role");
    }
    const existing = await pool.query("SELECT id FROM auth.users WHERE lower(email) = lower($1)", [email]);
    if (existing.rows.length) return fail(res, "A user with this email already exists");
    const hash = await bcrypt.hash(password, 10);
    const inserted = await pool.query(
      `INSERT INTO auth.users (email, password_hash, raw_user_meta_data) VALUES ($1, $2, $3) RETURNING id`,
      [email, hash, JSON.stringify({ full_name })]
    );
    const newUserId = inserted.rows[0].id;
    await prisma.profiles.updateMany({ where: { user_id: newUserId }, data: { full_name, phone: phone || null } });
    await pool.query(
      `INSERT INTO public.user_roles (user_id, role) VALUES ($1, $2) ON CONFLICT (user_id, role) DO NOTHING`,
      [newUserId, role]
    );
    return ok(res, { success: true, user_id: newUserId });
  }
  if (action === "update") {
    if (!user_id) return fail(res, "user_id is required");
    if (full_name !== undefined || phone !== undefined) {
      const updates: Record<string, unknown> = {};
      if (full_name !== undefined) updates.full_name = full_name;
      if (phone !== undefined) updates.phone = phone;
      await prisma.profiles.updateMany({ where: { user_id }, data: updates });
    }
    if (role) {
      const existing = await prisma.userRoles.findFirst({ where: { user_id } });
      if (existing) await prisma.userRoles.updateMany({ where: { user_id }, data: { role } });
      else await prisma.userRoles.create({ data: { user_id, role } });
    }
    if (password) {
      const hash = await bcrypt.hash(password, 10);
      await pool.query("UPDATE auth.users SET password_hash = $1, updated_at = now() WHERE id = $2", [hash, user_id]);
    }
    return ok(res, { success: true });
  }
  return fail(res, "Invalid action. Use 'create' or 'update'");
}
functionsRouter.post("/manage-staff", requireAuth, requireRole("admin"), manageStaff);

// ---------------------------------------------------------------------------
// settings helper
// ---------------------------------------------------------------------------
async function getSettings(): Promise<Record<string, unknown>> {
  const rows = await pool.query("SELECT * FROM public.business_settings ORDER BY created_at ASC LIMIT 1");
  return rows.rows[0] ?? {};
}

// ---------------------------------------------------------------------------
// send-whatsapp (+ Meta webhook verification on GET)
// ---------------------------------------------------------------------------
async function sendWhatsAppMessage(args: {
  to: string;
  message?: string;
  template_name?: string;
  template_params?: Record<string, string> | string[];
  conversation_id?: string;
  sender_id?: string;
}): Promise<{ success: boolean; error?: string; data?: unknown }> {
  const settings = await getSettings();
  const apiUrl = (settings.whatsapp_api_url as string) || "";
  const apiKey = (settings.whatsapp_api_key as string) || "";
  const phoneId = (settings.whatsapp_phone_id as string) || "";
  if (!apiUrl || !apiKey) {
    return { success: false, error: "WhatsApp API not configured. Go to Settings > WhatsApp to configure." };
  }
  const payload = args.template_name
    ? {
        messaging_product: "whatsapp",
        to: args.to,
        type: "template",
        template: {
          name: args.template_name,
          language: { code: "en" },
          components: args.template_params
            ? [{ type: "body", parameters: (Array.isArray(args.template_params) ? args.template_params : Object.values(args.template_params)).map((t) => ({ type: "text", text: String(t) })) }]
            : undefined,
        },
      }
    : { messaging_product: "whatsapp", to: args.to, type: "text", text: { body: args.message ?? "" } };

  const waRes = await fetch(`${apiUrl}/${phoneId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const waData = (await waRes.json().catch(() => ({}))) as Record<string, unknown>;
  if (!waRes.ok) {
    return { success: false, error: `WhatsApp API error [${waRes.status}]: ${JSON.stringify(waData)}` };
  }
  // record outbound message
  try {
    if (args.conversation_id) {
      await pool.query(
        `INSERT INTO public.whatsapp_messages (conversation_id, direction, content, created_at)
         VALUES ($1, 'outbound', $2, now())`,
        [args.conversation_id, args.message ?? `[template: ${args.template_name}]`]
      );
    }
  } catch (e) {
    console.warn("[send-whatsapp] failed to record message:", (e as Error).message);
  }
  return { success: true, data: waData };
}

functionsRouter.post("/send-whatsapp", requireAuth, async (req, res) => {
  try {
    const { to, message, template_name, template_params, conversation_id, sender_id } = req.body ?? {};
    if (!to) return fail(res, "Recipient phone number required");
    const result = await sendWhatsAppMessage({ to, message, template_name, template_params, conversation_id, sender_id });
    if (!result.success) return fail(res, result.error ?? "WhatsApp send failed");
    return ok(res, { success: true, data: result.data });
  } catch (e) {
    return fail(res, (e as Error).message, 500);
  }
});

// ---------------------------------------------------------------------------
// send-email / send-sms — provider stubs (log + succeed in dev)
// ---------------------------------------------------------------------------
functionsRouter.post("/send-email", requireAuth, async (req, res) => {
  const { to, subject } = req.body ?? {};
  console.log(`[send-email] to=${to} subject=${subject}`, JSON.stringify(req.body).slice(0, 400));
  if (!env.smtpUrl) {
    // Dev mode: pretend success but make it visible.
    return ok(res, { success: true, delivered: false, note: "SMTP_URL not configured — email logged to server console" });
  }
  // TODO: wire an SMTP/API provider (Resend, SES, …) here.
  return ok(res, { success: true, delivered: false });
});

functionsRouter.post("/send-sms", requireAuth, async (req, res) => {
  const { to } = req.body ?? {};
  console.log(`[send-sms] to=${to}`, JSON.stringify(req.body).slice(0, 400));
  return ok(res, { success: true, delivered: false, note: "SMS provider not configured — message logged to server console" });
});

// ---------------------------------------------------------------------------
// whatsapp-automation — fires the template configured for an event
// ---------------------------------------------------------------------------
functionsRouter.post("/whatsapp-automation", requireAuth, async (req, res) => {
  try {
    const { event_type, customer_phone, variables } = req.body ?? {};
    if (!event_type || !customer_phone) return fail(res, "event_type and customer_phone are required");
    const tpl = await pool.query(
      `SELECT * FROM public.templates WHERE event_type = $1 AND is_active = true LIMIT 1`,
      [event_type]
    );
    if (!tpl.rows.length) return ok(res, { skipped: true });
    const t = tpl.rows[0] as Record<string, string>;
    let body = t.body ?? t.content ?? "";
    for (const [k, v] of Object.entries((variables as Record<string, string>) ?? {})) {
      body = body.replaceAll(`{{${k}}}`, String(v));
    }
    const result = await sendWhatsAppMessage({ to: customer_phone, message: body, template_name: t.whatsapp_template_name });
    if (!result.success) return ok(res, { success: false, error: result.error });
    return ok(res, { success: true, channel: "whatsapp" });
  } catch (e) {
    return fail(res, (e as Error).message, 500);
  }
});

// ---------------------------------------------------------------------------
// whatsapp-webhook — inbound Meta webhook (verification + events)
// ---------------------------------------------------------------------------
functionsRouter.get("/whatsapp-webhook", async (req, res) => {
  const settings = await getSettings();
  const integrations = (settings.integrations as Record<string, string>) || {};
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];
  if (mode === "subscribe") {
    if (token && token === integrations.wa_verify_token) {
      res.status(200).send(String(challenge ?? ""));
      return;
    }
    res.status(403).send("Forbidden");
    return;
  }
  res.status(200).send("OK");
});

functionsRouter.post("/whatsapp-webhook", async (req, res) => {
  try {
    const body = req.body as Record<string, unknown>;
    const entries = (body.entry as Record<string, unknown>[]) ?? [];
    for (const entry of entries) {
      const changes = (entry.changes as Record<string, unknown>[]) ?? [];
      for (const change of changes) {
        const value = change.value as Record<string, unknown>;
        const messages = (value?.messages as Record<string, unknown>[]) ?? [];
        for (const msg of messages) {
          const from = String(msg.from ?? "");
          const text = ((msg.text as Record<string, unknown>)?.body as string) ?? "";
          // upsert conversation by phone
          const convo = await pool.query(
            `INSERT INTO public.whatsapp_conversations (phone, last_message_at)
             VALUES ($1, now())
             ON CONFLICT (phone) DO UPDATE SET last_message_at = now()
             RETURNING id`,
            [from]
          );
          await pool.query(
            `INSERT INTO public.whatsapp_messages (conversation_id, direction, content, created_at)
             VALUES ($1, 'inbound', $2, now())`,
            [convo.rows[0].id, text]
          );
        }
      }
    }
    res.json({ success: true });
  } catch (e) {
    fail(res, (e as Error).message, 500);
  }
});

// ---------------------------------------------------------------------------
// create-payment-link (Razorpay)
// ---------------------------------------------------------------------------
functionsRouter.post("/create-payment-link", requireAuth, async (req, res) => {
  try {
    const { amount, customer_name, customer_phone, customer_email, invoice_id, description } = req.body ?? {};
    if (!amount) return fail(res, "amount is required");
    if (!env.razorpayKeyId || !env.razorpayKeySecret) {
      return fail(res, "Razorpay not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in server/.env");
    }
    const rpRes = await fetch("https://api.razorpay.com/v1/payment_links", {
      method: "POST",
      headers: {
        Authorization: "Basic " + Buffer.from(`${env.razorpayKeyId}:${env.razorpayKeySecret}`).toString("base64"),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount: Math.round(Number(amount) * 100),
        currency: "INR",
        description: description ?? "Payment",
        customer: {
          name: customer_name,
          contact: customer_phone,
          email: customer_email,
        },
        notify: { sms: true, email: true },
      }),
    });
    const rpData = (await rpRes.json()) as Record<string, unknown>;
    if (!rpRes.ok) return fail(res, `Razorpay API error [${rpRes.status}]: ${JSON.stringify(rpData)}`, 500);
    try {
      await pool.query(
        `INSERT INTO public.payments (invoice_id, amount, payment_method, status, notes, created_at)
         VALUES ($1, $2, 'online', 'pending', $3, now())`,
        [invoice_id ?? null, amount, `Razorpay Link: ${rpData.short_url}`]
      );
    } catch (e) {
      console.warn("[create-payment-link] payment record insert failed:", (e as Error).message);
    }
    return ok(res, { success: true, payment_link_url: rpData.short_url, payment_link_id: rpData.id });
  } catch (e) {
    return fail(res, (e as Error).message, 500);
  }
});

// razorpay-webhook — verify signature, mark payment completed
functionsRouter.post("/razorpay-webhook", async (req, res) => {
  try {
    const signature = req.headers["x-razorpay-signature"] as string;
    if (env.razorpayWebhookSecret) {
      const expected = crypto
        .createHmac("sha256", env.razorpayWebhookSecret)
        .update(JSON.stringify(req.body))
        .digest("hex");
      if (signature !== expected) {
        res.status(400).json({ error: "Invalid signature" });
        return;
      }
    }
    const event = req.body as { event?: string; payload?: { payment_link?: { entity?: { id?: string; notes?: Record<string, string> } } } };
    if (event.event === "payment_link.paid") {
      const linkId = event.payload?.payment_link?.entity?.id;
      if (linkId) {
        await pool.query(
          `UPDATE public.payments SET status = 'completed', paid_at = now()
           WHERE notes LIKE $1 AND status = 'pending'`,
          [`%${linkId}%`]
        );
      }
    }
    res.json({ success: true });
  } catch (e) {
    fail(res, (e as Error).message, 500);
  }
});

// ---------------------------------------------------------------------------
// parse-offer-pdf — heuristic parser (replaces the AI extraction)
// ---------------------------------------------------------------------------
functionsRouter.post("/parse-offer-pdf", requireAuth, async (req, res) => {
  const { pdfText } = req.body ?? {};
  if (!pdfText) return fail(res, "pdfText is required (paste text content from PDF)");
  // Best-effort line parser: lines like "iPhone 16 128GB ... ₹52,000 ... 5%"
  const offers: Record<string, unknown>[] = [];
  const lines = String(pdfText).split(/\r?\n/);
  for (const line of lines) {
    const amountMatch = line.match(/(?:₹|rs\.?|inr)\s*([\d,]+(?:\.\d+)?)/i) || line.match(/([\d,]+(?:\.\d+)?)\s*(?:₹|rs\.?|inr)/i);
    const pctMatch = line.match(/(\d+(?:\.\d+)?)\s*%/);
    if (!amountMatch && !pctMatch) continue;
    const name = line.replace(/(?:₹|rs\.?|inr)\s*[\d,]+(?:\.\d+)?/gi, "").replace(/(\d+(?:\.\d+)?)\s*%/, "").trim().slice(0, 120);
    if (!name || name.length < 3) continue;
    offers.push({
      applicable_product: name,
      offer_type: pctMatch ? "percentage" : "instant_discount",
      discount_percentage: pctMatch ? Number(pctMatch[1]) : null,
      discount_amount: amountMatch ? Number(amountMatch[1].replace(/,/g, "")) : null,
      discount_description: line.trim().slice(0, 250),
    });
  }
  return ok(res, { success: true, offers, note: "Heuristic parser — review extracted offers before saving." });
});

// ---------------------------------------------------------------------------
// hikvision-sync / hikvision-webhook — device integration stubs
// ---------------------------------------------------------------------------
functionsRouter.post("/hikvision-sync", requireAuth, async (req, res) => {
  const action = req.body?.action ?? "sync";
  await pool.query(
    `INSERT INTO public.hikvision_sync_log (status, details, created_at) VALUES ($1, $2, now())`,
    ["stub", `hikvision-sync action=${action} (device integration not configured)`]
  ).catch(() => undefined);
  return fail(res, "Hikvision integration is not configured on this server. Configure device credentials in Settings.", 501);
});

functionsRouter.post("/hikvision-webhook", async (req, res) => {
  console.log("[hikvision-webhook] event:", JSON.stringify(req.body).slice(0, 500));
  res.json({ success: true });
});
