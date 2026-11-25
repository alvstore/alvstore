import { isDatabaseUnavailable } from "../lib/api-errors.js";
import { asyncHandler } from "../lib/async-handler.js";
import { Router, type Request, type Response } from "express";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { prisma, pool } from "../db.js";
import { env } from "../env.js";
import { resolveHikvisionCredentials } from "../lib/hikvision-config.js";
import { handlePublicLeadRequest } from "../lib/public-lead.js";
import { isValidAppRole, replaceUserRole } from "../lib/user-roles.js";
import { requireAuth, requireRole } from "../auth/middleware.js";

/**
 * Full ports of the former Supabase Edge Functions.
 *
 * External providers read credentials from business_settings (WhatsApp) or
 * server env (SMTP / SMS / Razorpay / Hik-Partner / AI gateway). When a
 * provider is not configured the routes respond exactly like the original
 * functions did (clear JSON error), so the UI can surface it.
 *
 * Mounted at /api/functions (frontend reaches it via /api/backend/functions).
 */
export const functionsRouter = Router();

const ok = (res: Response, body: unknown) => res.json(body);
const fail = (res: Response, message: string, status = 400) =>
  res.status(status).json({ error: message, success: false });

/** Raw request body captured by the express.json verify hook (app.ts). */
function rawBody(req: Request): string {
  const raw = (req as Request & { rawBody?: Buffer }).rawBody;
  return raw ? raw.toString("utf8") : JSON.stringify(req.body ?? {});
}

// ---------------------------------------------------------------------------
// manage-staff (admin user management)
// ---------------------------------------------------------------------------
async function manageStaff(req: Request, res: Response) {
  const { action, email, password, full_name, phone, role, user_id } = req.body ?? {};
  if (action === "create") {
    if (!email || !password || !full_name || !role) {
      return fail(res, "Missing required fields: email, password, full_name, role");
    }
    if (!isValidAppRole(role)) {
      return fail(res, `Invalid role: ${String(role)}`);
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
    await replaceUserRole(pool, newUserId, role);
    return ok(res, { success: true, user_id: newUserId });
  }
  if (action === "update") {
    if (!user_id) return fail(res, "user_id is required");
    if (role !== undefined && !isValidAppRole(role)) {
      return fail(res, `Invalid role: ${String(role)}`);
    }
    if (full_name !== undefined || phone !== undefined) {
      const updates: Record<string, unknown> = {};
      if (full_name !== undefined) updates.full_name = full_name;
      if (phone !== undefined) updates.phone = phone;
      await prisma.profiles.updateMany({ where: { user_id }, data: updates });
    }
    if (role) {
      await replaceUserRole(pool, user_id, role);
    }
    if (password) {
      const hash = await bcrypt.hash(password, 10);
      await pool.query("UPDATE auth.users SET password_hash = $1, updated_at = now() WHERE id = $2", [hash, user_id]);
    }
    return ok(res, { success: true });
  }
  return fail(res, "Invalid action. Use 'create' or 'update'");
}
functionsRouter.post("/manage-staff", requireAuth, requireRole("admin"), asyncHandler(manageStaff));

// ---------------------------------------------------------------------------
// public-lead (anonymous website Write to us -> CRM lead + admin alert)
// ---------------------------------------------------------------------------
functionsRouter.post("/public-lead", asyncHandler((req, res) => handlePublicLeadRequest(req, res)));

// ---------------------------------------------------------------------------
// settings helper
// ---------------------------------------------------------------------------
async function getSettings(): Promise<Record<string, unknown>> {
  const rows = await pool.query("SELECT * FROM public.business_settings ORDER BY created_at ASC LIMIT 1");
  return rows.rows[0] ?? {};
}

/** Replace {{var}} placeholders (the original functions' templating). */
function applyVariables(text: string, variables: unknown): string {
  let out = text;
  if (variables && typeof variables === "object") {
    for (const [key, value] of Object.entries(variables as Record<string, unknown>)) {
      out = out.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), String(value));
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// shared WhatsApp sender (config from business_settings)
// ---------------------------------------------------------------------------
async function sendWhatsAppMessage(args: {
  to: string;
  message?: string;
  template_name?: string;
  template_params?: Record<string, string> | string[];
}): Promise<{ success: boolean; error?: string; waMessageId?: string | null; data?: unknown }> {
  const settings = await getSettings();
  const apiUrl = (settings.whatsapp_api_url as string) || "";
  const apiKey = (settings.whatsapp_api_key as string) || "";
  const phoneId = (settings.whatsapp_phone_id as string) || "";
  if (!apiUrl || !apiKey) {
    return { success: false, error: "WhatsApp API not configured. Go to Settings > WhatsApp to configure." };
  }
  const to = String(args.to).replace(/\D/g, "");
  let payload: Record<string, unknown>;
  if (args.template_name) {
    const params = args.template_params
      ? (Array.isArray(args.template_params) ? args.template_params : Object.values(args.template_params)).map((t) => ({ type: "text", text: String(t) }))
      : undefined;
    payload = {
      messaging_product: "whatsapp",
      to,
      type: "template",
      template: {
        name: args.template_name,
        language: { code: "en" },
        components: params ? [{ type: "body", parameters: params }] : undefined,
      },
    };
  } else {
    if (!args.message) return { success: false, error: "Message content required" };
    payload = { messaging_product: "whatsapp", to, type: "text", text: { body: args.message } };
  }

  const waRes = await fetch(`${apiUrl}/${phoneId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const waData = (await waRes.json().catch(() => ({}))) as { messages?: { id?: string }[] } & Record<string, unknown>;
  if (!waRes.ok) {
    return { success: false, error: `WhatsApp API error [${waRes.status}]: ${JSON.stringify(waData)}` };
  }
  return { success: true, waMessageId: waData?.messages?.[0]?.id ?? null, data: waData };
}

// ---------------------------------------------------------------------------
// shared SMS sender (env-configured generic provider)
// ---------------------------------------------------------------------------
async function sendSmsMessage(args: { phone: string; message: string }): Promise<{ success: boolean; error?: string; result?: string }> {
  const { smsApiUrl, smsApiKey, smsSenderId, smsDltEntityId } = env;
  if (!smsApiUrl || !smsApiKey) {
    return { success: false, error: "SMS not configured. Add SMS_API_URL, SMS_API_KEY to server/.env." };
  }
  const params = new URLSearchParams({
    apikey: smsApiKey,
    senderid: smsSenderId,
    number: args.phone,
    message: args.message,
    format: "json",
  });
  if (smsDltEntityId) params.append("dlt_entity_id", smsDltEntityId);
  const response = await fetch(`${smsApiUrl}?${params.toString()}`);
  const result = await response.text();
  if (!response.ok) return { success: false, error: `SMS API error [${response.status}]: ${result.slice(0, 300)}` };
  return { success: true, result };
}

// ---------------------------------------------------------------------------
// send-whatsapp — POST sends; GET handles Meta webhook verification
// ---------------------------------------------------------------------------
functionsRouter.get("/send-whatsapp", asyncHandler(async (req, res) => {
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
}));

functionsRouter.post("/send-whatsapp", requireAuth, asyncHandler(async (req, res) => {
  try {
    const { to, message, template_name, template_params, conversation_id, sender_id } = req.body ?? {};
    if (!to) return fail(res, "Recipient phone number required");
    const result = await sendWhatsAppMessage({ to, message, template_name, template_params });
    if (!result.success) return fail(res, result.error ?? "WhatsApp send failed");

    // Record outbound message in the chat tables (as the original did)
    if (conversation_id && message) {
      try {
        await pool.query(
          `INSERT INTO public.chat_messages (conversation_id, sender_id, content, channel, whatsapp_message_id, delivery_status)
           VALUES ($1, $2, $3, 'whatsapp', $4, 'sent')`,
          [conversation_id, sender_id ?? null, message, result.waMessageId]
        );
        await pool.query(
          `UPDATE public.chat_conversations SET last_message = $1, last_message_at = now() WHERE id = $2`,
          [message, conversation_id]
        );
      } catch (e) {
    if (isDatabaseUnavailable(e)) throw e;
        console.warn("[send-whatsapp] failed to record chat message:", (e as Error).message);
      }
    }
    return ok(res, { success: true, whatsapp_message_id: result.waMessageId });
  } catch (e) {
    if (isDatabaseUnavailable(e)) throw e;
    return fail(res, (e as Error).message, 500);
  }
}));

// ---------------------------------------------------------------------------
// send-email — template support + SMTP (generic HTTP mail API pattern)
// ---------------------------------------------------------------------------
functionsRouter.post("/send-email", requireAuth, asyncHandler(async (req, res) => {
  try {
    const { to, subject, body, template_id, variables } = req.body ?? {};
    if (!to || !subject) return fail(res, "Missing 'to' or 'subject'");

    let emailBody = body || "";
    if (template_id) {
      const tpl = await pool.query("SELECT body, subject FROM public.templates WHERE id = $1 LIMIT 1", [template_id]);
      if (tpl.rows.length) emailBody = applyVariables(tpl.rows[0].body ?? "", variables);
    }

    const { smtpHost, smtpPort, smtpUser, smtpPass, smtpFrom } = env;
    if (!smtpHost || !smtpUser || !smtpPass) {
      return fail(res, "SMTP not configured. Add SMTP_HOST, SMTP_USER, SMTP_PASS to server/.env", 500);
    }
    void smtpPort; // port is implicit in the generic HTTP mail API pattern

    const response = await fetch(`https://${smtpHost}/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${smtpPass}` },
      body: JSON.stringify({ from: smtpFrom || smtpUser, to, subject, html: emailBody }),
    });
    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Email send failed: ${errText}`);
    }
    return ok(res, { success: true });
  } catch (e) {
    if (isDatabaseUnavailable(e)) throw e;
    return fail(res, (e as Error).message, 500);
  }
}));

// ---------------------------------------------------------------------------
// send-sms — template support + generic SMS provider
// ---------------------------------------------------------------------------
functionsRouter.post("/send-sms", requireAuth, asyncHandler(async (req, res) => {
  try {
    const { phone, message, template_id, variables } = req.body ?? {};
    if (!phone) return fail(res, "Missing 'phone'");

    let smsMessage = message || "";
    if (template_id) {
      const tpl = await pool.query("SELECT body FROM public.templates WHERE id = $1 LIMIT 1", [template_id]);
      if (tpl.rows.length) smsMessage = applyVariables(tpl.rows[0].body ?? "", variables);
    }
    if (!smsMessage) return fail(res, "No message content");

    const result = await sendSmsMessage({ phone, message: smsMessage });
    if (!result.success) return fail(res, result.error ?? "SMS send failed", 500);
    return ok(res, { success: true, result: result.result });
  } catch (e) {
    if (isDatabaseUnavailable(e)) throw e;
    return fail(res, (e as Error).message, 500);
  }
}));

// ---------------------------------------------------------------------------
// whatsapp-automation — fires the template configured for an event,
// WhatsApp first, SMS fallback (faithful port)
// ---------------------------------------------------------------------------
functionsRouter.post("/whatsapp-automation", requireAuth, asyncHandler(async (req, res) => {
  try {
    const { event_type, customer_phone, variables } = req.body ?? {};
    if (!event_type || !customer_phone) return fail(res, "event_type and customer_phone required");

    const tpl = await pool.query("SELECT * FROM public.templates WHERE event_type = $1 LIMIT 1", [event_type]);
    if (!tpl.rows.length) {
      return ok(res, { success: false, skipped: true, reason: `No template for event: ${event_type}` });
    }
    const messageBody = applyVariables(tpl.rows[0].body ?? "", variables);
    if (!messageBody.trim()) {
      return ok(res, { success: false, reason: "Empty message body after variable replacement" });
    }

    const phone = String(customer_phone).replace(/\D/g, "");
    let sent = false;
    let channel = "none";
    let waMessageId: string | null = null;

    // Try WhatsApp first
    const settings = await getSettings();
    if (settings.whatsapp_api_url && settings.whatsapp_api_key && settings.whatsapp_phone_id) {
      const waResult = await sendWhatsAppMessage({ to: phone, message: messageBody });
      if (waResult.success) {
        sent = true;
        channel = "whatsapp";
        waMessageId = waResult.waMessageId ?? null;
      } else {
        console.error("[whatsapp-automation] WhatsApp API error:", waResult.error);
      }
    }

    // Fallback to SMS
    if (!sent) {
      const smsResult = await sendSmsMessage({ phone, message: messageBody });
      if (smsResult.success) {
        sent = true;
        channel = "sms";
      } else if (smsResult.error && !smsResult.error.startsWith("SMS not configured")) {
        console.error("[whatsapp-automation] SMS fallback failed:", smsResult.error);
      }
    }

    return ok(res, { success: sent, channel, event_type, whatsapp_message_id: waMessageId });
  } catch (e) {
    if (isDatabaseUnavailable(e)) throw e;
    return fail(res, (e as Error).message, 500);
  }
}));

// ---------------------------------------------------------------------------
// whatsapp-webhook — inbound Meta webhook (verification + events)
// ---------------------------------------------------------------------------
async function verifyMetaWebhook(req: Request, res: Response) {
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
}
functionsRouter.get("/whatsapp-webhook", verifyMetaWebhook);

functionsRouter.post("/whatsapp-webhook", asyncHandler(async (req, res) => {
  // Always return 200 to Meta to prevent retries
  try {
    const body = req.body as Record<string, unknown>;
    const entries = (body?.entry as Record<string, unknown>[]) ?? [];
    for (const entry of entries) {
      const changes = (entry?.changes as Record<string, unknown>[]) ?? [];
      for (const change of changes) {
        const value = change?.value as Record<string, unknown> | undefined;
        if (!value) continue;

        // Incoming messages
        const messages = (value.messages as Record<string, unknown>[]) ?? [];
        for (const msg of messages) {
          const fromNumber = String(msg.from ?? "");
          const messageType = (msg.type as string) || "text";
          const messageBody =
            ((msg.text as Record<string, unknown>)?.body as string) ||
            (msg.caption as string) ||
            `[${messageType}]`;
          const waTimestamp = msg.timestamp
            ? new Date(parseInt(msg.timestamp as string, 10) * 1000).toISOString()
            : new Date().toISOString();

          // Find open conversation
          const convoRes = await pool.query(
            `SELECT id, lead_id FROM public.whatsapp_conversations WHERE phone_number = $1 AND status = 'open' LIMIT 1`,
            [fromNumber]
          );
          let convo = convoRes.rows[0] as { id: string; lead_id: string | null } | undefined;

          // Look up lead by phone, else create a draft lead
          let leadId: string | null = null;
          const leadRes = await pool.query("SELECT id FROM public.leads WHERE phone = $1 OR phone = $2 LIMIT 1", [fromNumber, `+${fromNumber}`]);
          if (leadRes.rows.length) {
            leadId = leadRes.rows[0].id;
          } else {
            const newLead = await pool.query(
              `INSERT INTO public.leads (name, phone, source, status) VALUES ($1, $2, 'whatsapp', 'new') RETURNING id`,
              [`WhatsApp ${fromNumber}`, fromNumber]
            );
            leadId = newLead.rows[0]?.id ?? null;
          }

          if (!convo) {
            const newConvo = await pool.query(
              `INSERT INTO public.whatsapp_conversations (phone_number, lead_id, status) VALUES ($1, $2, 'open') RETURNING id`,
              [fromNumber, leadId]
            );
            convo = { id: newConvo.rows[0].id, lead_id: leadId };
          }

          // Insert message
          await pool.query(
            `INSERT INTO public.whatsapp_messages (wa_message_id, conversation_id, lead_id, direction, type, body, media_url, status, timestamp)
             VALUES ($1, $2, $3, 'inbound', $4, $5, $6, 'received', $7)`,
            [
              msg.id ?? null,
              convo.id,
              leadId,
              messageType,
              messageBody,
              ((msg.image as Record<string, unknown>)?.url as string) ||
                ((msg.document as Record<string, unknown>)?.url as string) ||
                ((msg.video as Record<string, unknown>)?.url as string) ||
                null,
              waTimestamp,
            ]
          );

          await pool.query("UPDATE public.whatsapp_conversations SET last_message_at = $1 WHERE id = $2", [waTimestamp, convo.id]);

          // Notify admins
          const admins = await pool.query("SELECT user_id FROM public.user_roles WHERE role = 'admin'");
          for (const a of admins.rows) {
            await pool.query(
              `INSERT INTO public.notification_feed (user_id, type, title, body, metadata)
               VALUES ($1, 'whatsapp', 'New WhatsApp Message', $2, $3)`,
              [a.user_id, `From ${fromNumber}: ${messageBody.slice(0, 100)}`, JSON.stringify({ conversation_id: convo.id, lead_id: leadId })]
            );
          }
        }

        // Status updates (sent / delivered / read / failed)
        const statuses = (value.statuses as Record<string, unknown>[]) ?? [];
        for (const status of statuses) {
          await pool.query("UPDATE public.whatsapp_messages SET status = $1 WHERE wa_message_id = $2", [status.status, status.id]);
        }
      }
    }
    res.json({ success: true });
  } catch (e) {
    if (isDatabaseUnavailable(e)) throw e;
    console.error("[whatsapp-webhook] error:", e);
    res.json({ success: true });
  }
}));

// ---------------------------------------------------------------------------
// create-payment-link (Razorpay)
// ---------------------------------------------------------------------------
functionsRouter.post("/create-payment-link", requireAuth, asyncHandler(async (req, res) => {
  try {
    const { amount, customer_name, customer_email, customer_phone, invoice_id, description } = req.body ?? {};
    if (!amount || Number(amount) <= 0) return fail(res, "Invalid amount");
    if (!env.razorpayKeyId || !env.razorpayKeySecret) {
      return fail(res, "Razorpay credentials not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in server/.env");
    }

    const rpRes = await fetch("https://api.razorpay.com/v1/payment_links", {
      method: "POST",
      headers: {
        Authorization: "Basic " + Buffer.from(`${env.razorpayKeyId}:${env.razorpayKeySecret}`).toString("base64"),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount: Math.round(Number(amount) * 100), // paise
        currency: "INR",
        description: description || "Payment for Invoice",
        customer: {
          name: customer_name || undefined,
          email: customer_email || undefined,
          contact: customer_phone || undefined,
        },
        notify: { sms: !!customer_phone, email: !!customer_email },
        notes: { invoice_id: invoice_id || "" },
      }),
    });
    const rpData = (await rpRes.json()) as Record<string, unknown>;
    if (!rpRes.ok) return fail(res, `Razorpay API error [${rpRes.status}]: ${JSON.stringify(rpData)}`);

    // Store payment record (reference_id lets the webhook find it again)
    if (invoice_id) {
      try {
        const inv = await pool.query("SELECT customer_id FROM public.invoices WHERE id = $1", [invoice_id]);
        await pool.query(
          `INSERT INTO public.payments (amount, payment_method, type, status, reference_id, customer_id, notes)
           VALUES ($1, 'online', 'invoice', 'pending', $2, $3, $4)`,
          [amount, rpData.id, inv.rows[0]?.customer_id ?? null, `Razorpay Link: ${rpData.short_url}`]
        );
      } catch (e) {
    if (isDatabaseUnavailable(e)) throw e;
        console.warn("[create-payment-link] payment record insert failed:", (e as Error).message);
      }
    }

    return ok(res, { success: true, payment_link_url: rpData.short_url, payment_link_id: rpData.id });
  } catch (e) {
    if (isDatabaseUnavailable(e)) throw e;
    return fail(res, (e as Error).message, 500);
  }
}));

// ---------------------------------------------------------------------------
// razorpay-webhook — verify signature, mark payment completed, update invoice
// ---------------------------------------------------------------------------
functionsRouter.post("/razorpay-webhook", asyncHandler(async (req, res) => {
  try {
    if (!env.razorpayWebhookSecret) return fail(res, "RAZORPAY_WEBHOOK_SECRET not configured", 500);

    const signature = (req.headers["x-razorpay-signature"] as string) || "";
    const expected = crypto.createHmac("sha256", env.razorpayWebhookSecret).update(rawBody(req)).digest("hex");
    if (signature.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
      return fail(res, "Invalid signature", 401);
    }

    const event = req.body as {
      event?: string;
      payload?: {
        payment?: { entity?: { id?: string; amount?: number; notes?: Record<string, string> } };
        payment_link?: { entity?: { id?: string; notes?: Record<string, string> } };
      };
    };
    const eventType = event.event;

    if (eventType === "payment.captured" || eventType === "payment_link.paid") {
      const payment = event.payload?.payment?.entity;
      const paymentLinkId = event.payload?.payment_link?.entity?.id || payment?.notes?.payment_link_id;
      const invoiceId = payment?.notes?.invoice_id || event.payload?.payment_link?.entity?.notes?.invoice_id;
      const amount = (payment?.amount || 0) / 100;

      if (paymentLinkId) {
        await pool.query(
          "UPDATE public.payments SET status = 'completed', reference_id = $1 WHERE reference_id = $2",
          [payment?.id || paymentLinkId, paymentLinkId]
        );
      }

      if (invoiceId) {
        const invRes = await pool.query("SELECT paid_amount, total FROM public.invoices WHERE id = $1", [invoiceId]);
        const inv = invRes.rows[0];
        if (inv) {
          const newPaid = Number(inv.paid_amount || 0) + amount;
          const paymentStatus = newPaid >= Number(inv.total || 0) ? "paid" : "partial";
          await pool.query(
            "UPDATE public.invoices SET paid_amount = $1, payment_status = $2, status = CASE WHEN $2 = 'paid' THEN 'paid' ELSE status END, updated_at = now() WHERE id = $3",
            [newPaid, paymentStatus, invoiceId]
          );
        }
      }

      await pool.query(
        `INSERT INTO public.finance_audit_log (action, entity_type, entity_id, details)
         VALUES ('RAZORPAY_PAYMENT_RECEIVED', 'payment', $1, $2)`,
        [payment?.id ?? null, `Razorpay ${eventType}: ₹${amount} received. Invoice: ${invoiceId || "N/A"}`]
      ).catch((e) => console.warn("[razorpay-webhook] audit log failed:", (e as Error).message));

      console.log(`[razorpay-webhook] Processed ${eventType}: ₹${amount}`);
    }

    res.json({ success: true });
  } catch (e) {
    if (isDatabaseUnavailable(e)) throw e;
    fail(res, (e as Error).message, 500);
  }
}));

// ---------------------------------------------------------------------------
// parse-offer-pdf — AI extraction when a gateway is configured,
// heuristic parser otherwise (the original used a hosted AI gateway)
// ---------------------------------------------------------------------------
const OFFER_PARSER_PROMPT = `You are an Apple product offer parser. Extract structured offer data from the provided text.
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

functionsRouter.post("/parse-offer-pdf", requireAuth, asyncHandler(async (req, res) => {
  try {
    const { pdfText } = req.body ?? {};
    if (!pdfText || typeof pdfText !== "string" || pdfText.length < 20) {
      return fail(res, "pdfText is required (paste text content from PDF)");
    }

    // Preferred: OpenAI-compatible AI gateway (set AI_GATEWAY_URL + AI_GATEWAY_KEY)
    if (env.aiGatewayUrl && env.aiGatewayKey) {
      const aiRes = await fetch(`${env.aiGatewayUrl.replace(/\/$/, "")}/v1/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${env.aiGatewayKey}` },
        body: JSON.stringify({
          model: env.aiModel,
          messages: [
            { role: "system", content: OFFER_PARSER_PROMPT },
            { role: "user", content: `Parse the following Apple offer document text:\n\n${pdfText.slice(0, 15000)}` },
          ],
          temperature: 0.1,
        }),
      });
      if (!aiRes.ok) {
        const errText = await aiRes.text();
        return fail(res, `AI request failed: ${errText.slice(0, 300)}`, 502);
      }
      const aiData = (await aiRes.json()) as { choices?: { message?: { content?: string } }[] };
      const content = aiData.choices?.[0]?.message?.content || "";
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (!jsonMatch) return fail(res, "Failed to parse AI response", 422);
      return ok(res, { success: true, offers: JSON.parse(jsonMatch[0]) });
    }

    // Fallback: heuristic parser (no external dependency)
    const offers: Record<string, unknown>[] = [];
    const lines = pdfText.split(/\r?\n/);
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
    return ok(res, { success: true, offers, note: "Heuristic parser — set AI_GATEWAY_URL/AI_GATEWAY_KEY for AI extraction. Review extracted offers before saving." });
  } catch (e) {
    if (isDatabaseUnavailable(e)) throw e;
    return fail(res, (e as Error).message, 500);
  }
}));

// ═══════════════════════════════════════════════════════════════════════════
// hikvision-sync — Hik-Partner Cloud integration (full port)
// ═══════════════════════════════════════════════════════════════════════════

type HikAny = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

interface HppToken { accessToken: string; areaDomain: string; expireTime: number }

async function getHikvisionCredentials() {
  const settings = await getSettings();
  const integrations = (settings.integrations as Record<string, unknown> | undefined) || {};
  return resolveHikvisionCredentials(integrations, env);
}

async function getHppToken(): Promise<HppToken> {
  const { appKey, secretKey } = await getHikvisionCredentials();
  if (!appKey || !secretKey) {
    throw new Error(
      "Hik-Partner Pro API credentials are missing. Configure App Key and Secret Key in Settings → Hikvision or server/.env."
    );
  }

  const resp = await fetch("https://api.hik-partner.com/api/hpcgw/v1/token/get", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ appKey, secretKey }),
  });
  if (!resp.ok) throw new Error(`Token request failed: HTTP ${resp.status}`);
  const result = (await resp.json()) as HikAny;
  if (result.errorCode !== "0" || !result.data?.accessToken) throw new Error(`Token error: ${result.errorCode}`);
  return { accessToken: result.data.accessToken, areaDomain: result.data.areaDomain, expireTime: result.data.expireTime };
}

async function cloudApi(areaDomain: string, accessToken: string, path: string, body: unknown): Promise<HikAny> {
  console.log(`[cloudApi] POST ${path}`);
  const resp = await fetch(`${areaDomain}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30000),
  });
  const respText = await resp.text();
  console.log(`[cloudApi] Response status: ${resp.status}, body: ${respText.substring(0, 500)}`);
  let result: HikAny;
  try { result = JSON.parse(respText); } catch {
    throw new Error(`Cloud API returned non-JSON: ${respText.substring(0, 200)}`);
  }
  if (result.errorCode && result.errorCode !== "0") {
    throw new Error(`Cloud API error ${result.errorCode}: ${result.errorMessage || result.message || ""}`);
  }
  return result;
}

// V2.15.0 transparent API: POST {areaDomain}/api/hpcgw/v1/device/transparent/{isapi_uri}
// Header: X-Devserial: {deviceSerial}; body is the direct ISAPI JSON body.
async function transparentApi(
  areaDomain: string, accessToken: string, deviceSerial: string,
  isapiPath: string, isapiBody: unknown
): Promise<HikAny> {
  const cleanPath = isapiPath.startsWith("/") ? isapiPath.substring(1) : isapiPath;
  const url = `${areaDomain}/api/hpcgw/v1/device/transparent/${cleanPath}`;
  console.log(`[transparentApi] POST ${isapiPath} -> device ${deviceSerial}`);

  const resp = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
      "X-Devserial": deviceSerial,
    },
    body: JSON.stringify(isapiBody),
    signal: AbortSignal.timeout(30000),
  });

  const respText = await resp.text();
  console.log(`[transparentApi] Response status: ${resp.status}, body: ${respText.substring(0, 1000)}`);

  let result: HikAny;
  try { result = JSON.parse(respText); } catch {
    throw new Error(`Transparent API returned non-JSON (HTTP ${resp.status}): ${respText.substring(0, 300)}`);
  }
  if (result.errorCode && result.errorCode !== "0") {
    throw new Error(`Transparent API failed: ${result.errorCode} - ${result.errorMessage || result.message || JSON.stringify(result).substring(0, 200)}`);
  }
  let isapiResp = result.data?.body || result.data?.response || result.data || result;
  if (typeof isapiResp === "string") {
    try { isapiResp = JSON.parse(isapiResp); } catch { /* keep string */ }
  }
  return isapiResp;
}

async function getAllSites(areaDomain: string, accessToken: string) {
  const allSites: Array<{ id: string; siteName: string }> = [];
  let page = 1;
  let hasMore = true;
  while (hasMore) {
    const result = await cloudApi(areaDomain, accessToken, "/api/hpcgw/v1/site/search", { page, pageSize: 100 });
    const rows = result.data?.rows || [];
    for (const site of rows) allSites.push({ id: site.id, siteName: site.siteName });
    hasMore = page < (result.data?.totalPage || 1);
    page++;
  }
  return allSites;
}

async function getDeviceSerial(body: HikAny): Promise<string> {
  let serial = body.device_serial;
  if (!serial && body.device_id) {
    const dev = await pool.query("SELECT ip_address, device_serial FROM public.hikvision_devices WHERE id = $1", [body.device_id]);
    serial = dev.rows[0]?.device_serial || dev.rows[0]?.ip_address;
  }
  return serial || "";
}

async function logSync(deviceId: string | null, action: string, status: string, syncType?: string, records?: number, error?: string) {
  await pool.query(
    `INSERT INTO public.hikvision_sync_log (device_id, action, status, sync_type, records_synced, error_message)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [deviceId, action, status, syncType || null, records || 0, error || null]
  ).catch((e) => console.warn("[hikvision] sync log failed:", (e as Error).message));
}

function buildDedupeKey(deviceSerial: string, serialNo?: string, employeeNo?: string, eventTime?: string, status?: string, verifyMode?: string): string {
  if (serialNo) return `${deviceSerial}:${serialNo}`;
  return `${deviceSerial}:${employeeNo || ""}:${eventTime || ""}:${status || ""}:${verifyMode || ""}`;
}

/** Convert raw attendance logs → attendance_records (first event = check-in, last = check-out) */
async function convertToAttendanceRecord(employeeId: string, eventTime: string, deviceSerial: string, source: string): Promise<void> {
  const eventDate = eventTime.substring(0, 10);
  const existing = await pool.query(
    "SELECT id, check_in, check_out FROM public.attendance_records WHERE employee_id = $1 AND date = $2 LIMIT 1",
    [employeeId, eventDate]
  );
  if (!existing.rows.length) {
    await pool.query(
      `INSERT INTO public.attendance_records (employee_id, date, check_in, source, device_id, notes)
       VALUES ($1, $2, $3, 'biometric', $4, $5)`,
      [employeeId, eventDate, eventTime, deviceSerial, `Auto via ${source}`]
    );
  } else {
    const rec = existing.rows[0];
    if (!rec.check_out && eventTime > (rec.check_in?.toISOString?.() ?? String(rec.check_in ?? ""))) {
      await pool.query("UPDATE public.attendance_records SET check_out = $1 WHERE id = $2", [eventTime, rec.id]);
    }
  }
}

/** Upsert a device↔ERP employee mapping row. */
async function upsertEmployeeMapping(args: {
  code: string; name: string; deviceId: string | null; erpEmployeeId?: string | null; cardNumber?: string | null;
}) {
  await pool.query(
    `INSERT INTO public.hikvision_employee_mapping (device_employee_code, device_employee_name, device_id, erp_employee_id, card_number, synced_at)
     VALUES ($1, $2, $3, $4, $5, now())
     ON CONFLICT (device_employee_code, device_id) DO UPDATE
       SET device_employee_name = EXCLUDED.device_employee_name,
           card_number = COALESCE(EXCLUDED.card_number, hikvision_employee_mapping.card_number),
           erp_employee_id = COALESCE(EXCLUDED.erp_employee_id, hikvision_employee_mapping.erp_employee_id),
           synced_at = now()`,
    [args.code, args.name, args.deviceId, args.erpEmployeeId ?? null, args.cardNumber ?? null]
  );
}

/** Insert/update a hikvision_attendance_logs row, deduped by dedupe_key. Returns true when stored. */
async function storeAttendanceLog(args: {
  deviceId: string | null; employeeCode: string; employeeName: string; erpEmployeeId: string | null;
  deviceSerial: string; deviceName: string; eventTime: string; eventType: string; rawData: unknown;
  dedupeKey: string; sourceMode: string; attStatus?: string; verifyMode?: string; serialNo?: string;
}): Promise<boolean> {
  try {
    const r = await pool.query(
      `INSERT INTO public.hikvision_attendance_logs
         (device_id, employee_code, employee_name, employee_id, device_ip, device_name, event_time, event_type,
          raw_data, dedupe_key, source_mode, attendance_status, verify_mode, event_serial_no)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
       ON CONFLICT (dedupe_key) DO NOTHING`,
      [
        args.deviceId, args.employeeCode, args.employeeName, args.erpEmployeeId, args.deviceSerial, args.deviceName,
        args.eventTime, args.eventType, JSON.stringify(args.rawData ?? {}), args.dedupeKey, args.sourceMode,
        args.attStatus || null, args.verifyMode || null, args.serialNo || null,
      ]
    );
    return (r.rowCount ?? 0) > 0;
  } catch (e) {
    if (isDatabaseUnavailable(e)) throw e;
    console.warn("[hikvision] attendance log insert error:", (e as Error).message);
    return false;
  }
}

// ISAPI: sync employees from device (UserInfo/Search)
async function isapiSyncEmployees(
  areaDomain: string, accessToken: string, deviceSerial: string, deviceId: string
): Promise<{ success: boolean; records_synced: number; method: string }> {
  let totalSynced = 0;
  let searchPos = 0;
  const pageSize = 30;
  let hasMore = true;

  while (hasMore) {
    const result = await transparentApi(
      areaDomain, accessToken, deviceSerial,
      "/ISAPI/AccessControl/UserInfo/Search?format=json",
      { UserInfoSearchCond: { searchID: `sync-${Date.now()}`, searchResultPosition: searchPos, maxResults: pageSize } }
    );

    const searchResult = result?.UserInfoSearch || result;
    const totalMatches = parseInt(searchResult?.totalMatches || searchResult?.numOfMatches || "0", 10);
    const users: HikAny[] = searchResult?.UserInfo || [];

    if (users.length === 0) {
      if (searchPos === 0) throw new Error("Device returned 0 users via ISAPI UserInfo/Search");
      break;
    }

    for (const user of users) {
      const employeeCode = user.employeeNo || user.employeeID || "";
      const employeeName = user.name || user.userName || "";
      if (!employeeCode) continue;

      await upsertEmployeeMapping({
        code: employeeCode, name: employeeName, deviceId,
        cardNumber: user.numOfCard ? String(user.numOfCard) : null,
      });

      const existingEmp = await pool.query("SELECT id FROM public.employees WHERE device_employee_code = $1 LIMIT 1", [employeeCode]);
      let erpId: string | null = existingEmp.rows[0]?.id ?? null;
      if (!erpId && employeeName) {
        const newEmp = await pool.query(
          `INSERT INTO public.employees (name, device_employee_code, role, status) VALUES ($1, $2, 'staff', 'active') RETURNING id`,
          [employeeName, employeeCode]
        );
        erpId = newEmp.rows[0]?.id ?? null;
      }
      if (erpId) {
        await pool.query(
          "UPDATE public.hikvision_employee_mapping SET erp_employee_id = $1 WHERE device_employee_code = $2 AND device_id = $3",
          [erpId, employeeCode, deviceId]
        );
      }
      totalSynced++;
    }

    searchPos += users.length;
    hasMore = searchPos < totalMatches;
  }

  return { success: true, records_synced: totalSynced, method: "isapi_passthrough" };
}

// MQ polling: attendance via cloud message queue
async function pollMqAttendance(
  areaDomain: string, accessToken: string, deviceSerial: string, deviceId: string
): Promise<{ success: boolean; records_synced: number; method: string; details: string[] }> {
  const details: string[] = [];

  try {
    await cloudApi(areaDomain, accessToken, "/api/hpcgw/v1/mq/subscribe", { subType: 1, subMode: "all" });
    details.push("MQ subscription OK");
  } catch (e) {
    if (isDatabaseUnavailable(e)) throw e;
    details.push(`MQ subscribe warning: ${(e as Error).message}`);
  }

  // V2.15.0: wait 3s after subscribe before first poll
  await new Promise((resolve) => setTimeout(resolve, 3000));
  details.push("Waited 3s after subscribe");

  const mappings = await pool.query("SELECT * FROM public.hikvision_employee_mapping WHERE device_id = $1", [deviceId]);
  const mappingMap = new Map<string, HikAny>(mappings.rows.map((m) => [m.device_employee_code, m]));
  const device = await pool.query("SELECT name FROM public.hikvision_devices WHERE id = $1", [deviceId]);
  const deviceName = device.rows[0]?.name || "";

  let totalSynced = 0;
  let totalMessages = 0;
  let pollAttempts = 0;

  while (pollAttempts < 5) {
    pollAttempts++;
    try {
      const msgResult = await cloudApi(areaDomain, accessToken, "/api/hpcgw/v1/mq/messages", {});
      const messages = msgResult.data?.list || msgResult.data?.rows || [];
      details.push(`Poll #${pollAttempts}: ${messages.length} messages`);
      if (messages.length === 0) {
        if (pollAttempts < 3) {
          await new Promise((resolve) => setTimeout(resolve, 2000));
          continue;
        }
        break;
      }
      totalMessages += messages.length;

      for (const msg of messages) {
        try {
          const alarmData: HikAny = typeof msg.alarmData === "string" ? JSON.parse(msg.alarmData) : (msg.alarmData || {});
          const msgDevSerial = msg.deviceSerial || alarmData.deviceSerial || "";
          if (deviceSerial && msgDevSerial && msgDevSerial !== deviceSerial) continue;

          const acsEvent = alarmData.AccessControllerEvent || alarmData.ACSEvent || {};
          const eventType = alarmData.eventType || msg.formatType || "";
          const isAccessEvent = eventType.toLowerCase().includes("accesscontroller") ||
            eventType.toLowerCase().includes("acs") || acsEvent.employeeNoString || acsEvent.name;
          if (!isAccessEvent) continue;

          const employeeCode = acsEvent.employeeNoString || acsEvent.employeeNo?.toString() || "";
          const employeeName = acsEvent.name || "";
          const eventTime = alarmData.dateTime || acsEvent.time || acsEvent.dateTime || msg.alarmTime;
          if (!eventTime || !employeeCode) continue;

          const attStatus = acsEvent.attendanceStatus || "";
          const verifyMode = acsEvent.currentVerifyMode || "";
          const serialNo = acsEvent.serialNo?.toString() || "";
          const dedupeKey = buildDedupeKey(msgDevSerial || deviceSerial, serialNo, employeeCode, eventTime, attStatus, verifyMode);

          let mapping = mappingMap.get(employeeCode);
          if (!mapping && employeeCode) {
            await upsertEmployeeMapping({ code: employeeCode, name: employeeName, deviceId });
            const m = await pool.query("SELECT * FROM public.hikvision_employee_mapping WHERE device_employee_code = $1 AND device_id = $2", [employeeCode, deviceId]);
            mapping = m.rows[0];
            if (mapping) mappingMap.set(employeeCode, mapping);
          }

          const stored = await storeAttendanceLog({
            deviceId, employeeCode, employeeName, erpEmployeeId: mapping?.erp_employee_id || null,
            deviceSerial: msgDevSerial || deviceSerial, deviceName, eventTime, eventType: "access",
            rawData: alarmData, dedupeKey, sourceMode: "polling", attStatus, verifyMode, serialNo,
          });
          if (stored) {
            totalSynced++;
            if (mapping?.erp_employee_id) {
              await convertToAttendanceRecord(mapping.erp_employee_id, eventTime, msgDevSerial || deviceSerial, "mq_poll");
            }
          }
        } catch { /* skip event */ }
      }

      const batchId = msgResult.data?.batchId;
      if (batchId) {
        try { await cloudApi(areaDomain, accessToken, "/api/hpcgw/v1/mq/offset", { batchId }); details.push(`Acked batch ${batchId}`); } catch { /* ignore */ }
      }
    } catch (e) {
    if (isDatabaseUnavailable(e)) throw e;
      details.push(`Poll #${pollAttempts} error: ${(e as Error).message}`);
      break;
    }
  }

  await pool.query("UPDATE public.hikvision_devices SET last_sync_at = now() WHERE id = $1", [deviceId]);
  details.push(`Total: ${totalMessages} messages, ${totalSynced} synced`);
  return { success: true, records_synced: totalSynced, method: "cloud_mq", details };
}

// ISAPI backfill: historical attendance from device AcsEvent search
async function backfillAttendance(
  areaDomain: string, accessToken: string, deviceSerial: string, deviceId: string,
  startTime: string, endTime: string
): Promise<{ success: boolean; records_synced: number; method: string; details: string[] }> {
  const details: string[] = [];
  const mappings = await pool.query("SELECT * FROM public.hikvision_employee_mapping WHERE device_id = $1", [deviceId]);
  const mappingMap = new Map<string, HikAny>(mappings.rows.map((m) => [m.device_employee_code, m]));
  const device = await pool.query("SELECT name FROM public.hikvision_devices WHERE id = $1", [deviceId]);
  const deviceName = device.rows[0]?.name || "";

  let totalSynced = 0;
  let searchPos = 0;
  const pageSize = 30;
  let hasMore = true;
  let pageNum = 0;

  while (hasMore) {
    pageNum++;
    details.push(`Fetching page ${pageNum} (pos ${searchPos})...`);

    const result = await transparentApi(
      areaDomain, accessToken, deviceSerial,
      "/ISAPI/AccessControl/AcsEvent?format=json",
      {
        AcsEventCond: {
          searchID: `backfill-${Date.now()}`,
          searchResultPosition: searchPos,
          maxResults: pageSize,
          startTime, endTime,
          eventAttribute: "attendance",
          picEnable: false,
        },
      }
    );

    const searchResult = result?.AcsEvent || result;
    const totalMatches = parseInt(searchResult?.totalMatches || "0", 10);
    const events: HikAny[] = searchResult?.InfoList || [];
    const responseStatus = searchResult?.responseStatusStrg || "";
    details.push(`Page ${pageNum}: ${events.length} events, total matches: ${totalMatches}, status: ${responseStatus}`);

    if (events.length === 0) break;

    for (const evt of events) {
      const employeeCode = evt.employeeNoString || evt.employeeNo?.toString() || "";
      const employeeName = evt.name || "";
      const eventTime = evt.time || evt.dateTime || "";
      const attStatus = evt.attendanceStatus || "";
      const verifyMode = evt.currentVerifyMode || "";
      const serialNo = evt.serialNo?.toString() || "";
      if (!eventTime || !employeeCode) continue;

      const dedupeKey = buildDedupeKey(deviceSerial, serialNo, employeeCode, eventTime, attStatus, verifyMode);

      let mapping = mappingMap.get(employeeCode);
      if (!mapping && employeeCode) {
        await upsertEmployeeMapping({ code: employeeCode, name: employeeName, deviceId });
        const m = await pool.query("SELECT * FROM public.hikvision_employee_mapping WHERE device_employee_code = $1 AND device_id = $2", [employeeCode, deviceId]);
        mapping = m.rows[0];
        if (mapping) mappingMap.set(employeeCode, mapping);
      }

      const stored = await storeAttendanceLog({
        deviceId, employeeCode, employeeName, erpEmployeeId: mapping?.erp_employee_id || null,
        deviceSerial, deviceName, eventTime, eventType: "attendance",
        rawData: evt, dedupeKey, sourceMode: "backfill", attStatus, verifyMode, serialNo,
      });
      if (stored) {
        totalSynced++;
        if (mapping?.erp_employee_id) {
          await convertToAttendanceRecord(mapping.erp_employee_id, eventTime, deviceSerial, "backfill");
        }
      }
    }

    searchPos += events.length;
    hasMore = searchPos < totalMatches && responseStatus !== "OK";
  }

  await pool.query("UPDATE public.hikvision_devices SET last_sync_at = now() WHERE id = $1", [deviceId]);
  details.push(`Complete: ${totalSynced} records synced`);
  return { success: true, records_synced: totalSynced, method: "isapi_backfill", details };
}

// Fallback: extract employees from attendance logs
async function syncEmployeesFromLogs(deviceId: string): Promise<{ success: boolean; records_synced: number; method: string }> {
  const logs = await pool.query(
    `SELECT employee_code, employee_name FROM public.hikvision_attendance_logs
     WHERE device_id = $1 AND employee_code IS NOT NULL AND employee_code <> ''`,
    [deviceId]
  );

  const uniqueEmployees = new Map<string, string>();
  for (const log of logs.rows) {
    if (log.employee_code && !uniqueEmployees.has(log.employee_code)) {
      uniqueEmployees.set(log.employee_code, log.employee_name || `Employee ${log.employee_code}`);
    }
  }

  let synced = 0;
  for (const [empCode, empName] of uniqueEmployees) {
    await upsertEmployeeMapping({ code: empCode, name: empName, deviceId });

    const existingEmp = await pool.query("SELECT id FROM public.employees WHERE device_employee_code = $1 LIMIT 1", [empCode]);
    let erpId: string | null = existingEmp.rows[0]?.id ?? null;
    if (!erpId && empName) {
      const newEmp = await pool.query(
        `INSERT INTO public.employees (name, device_employee_code, role, status) VALUES ($1, $2, 'staff', 'active') RETURNING id`,
        [empName, empCode]
      );
      erpId = newEmp.rows[0]?.id ?? null;
    }
    if (erpId) {
      await pool.query(
        "UPDATE public.hikvision_employee_mapping SET erp_employee_id = $1 WHERE device_employee_code = $2 AND device_id = $3",
        [erpId, empCode, deviceId]
      );
    }
    synced++;
  }

  return { success: true, records_synced: synced, method: "attendance_logs_fallback" };
}

// Demo test: end-to-end pipeline validation with mock data
async function runDemoTest(deviceId: string | null): Promise<HikAny> {
  const results: HikAny = { steps: [], errors: [], attendance_logs_created: 0, attendance_records_created: 0 };

  const testEmployeeCode = "DEMO-001";
  const testEmployeeName = "Demo Test Employee";

  const existingEmp = await pool.query("SELECT id FROM public.employees WHERE device_employee_code = $1 LIMIT 1", [testEmployeeCode]);
  let testEmployeeId: string | null = existingEmp.rows[0]?.id ?? null;
  if (testEmployeeId) {
    results.steps.push("Found existing demo employee");
  } else {
    try {
      const newEmp = await pool.query(
        `INSERT INTO public.employees (name, device_employee_code, role, status) VALUES ($1, $2, 'staff', 'active') RETURNING id`,
        [testEmployeeName, testEmployeeCode]
      );
      testEmployeeId = newEmp.rows[0].id;
      results.steps.push("Created demo employee: " + testEmployeeId);
    } catch (e) {
    if (isDatabaseUnavailable(e)) throw e;
      results.errors.push(`Failed to create test employee: ${(e as Error).message}`);
      return results;
    }
  }

  if (deviceId) {
    await upsertEmployeeMapping({ code: testEmployeeCode, name: testEmployeeName, deviceId, erpEmployeeId: testEmployeeId });
    results.steps.push("Employee mapping upserted");
  }

  const today = new Date();
  const dateStr = today.toISOString().substring(0, 10);
  const mockEvents = [
    { time: `${dateStr}T09:00:00+05:30`, status: "checkIn", serial: "100001" },
    { time: `${dateStr}T09:01:00+05:30`, status: "checkIn", serial: "100002" }, // near-dupe
    { time: `${dateStr}T13:00:00+05:30`, status: "breakOut", serial: "100003" },
    { time: `${dateStr}T17:00:00+05:30`, status: "checkOut", serial: "100004" },
    { time: `${dateStr}T17:01:00+05:30`, status: "checkOut", serial: "100005" }, // near-dupe
  ];

  const deviceSerial = "DEMO-DEVICE-001";
  let logsCreated = 0;
  for (const evt of mockEvents) {
    const stored = await storeAttendanceLog({
      deviceId, employeeCode: testEmployeeCode, employeeName: testEmployeeName, erpEmployeeId: testEmployeeId,
      deviceSerial, deviceName: "Demo Device", eventTime: evt.time, eventType: "attendance",
      rawData: { demo: true, AccessControllerEvent: { employeeNoString: testEmployeeCode, attendanceStatus: evt.status, serialNo: evt.serial } },
      dedupeKey: buildDedupeKey(deviceSerial, evt.serial), sourceMode: "demo-test",
      attStatus: evt.status, verifyMode: "faceRecognition", serialNo: evt.serial,
    });
    if (stored) logsCreated++;
    else results.errors.push("Log insert error (see server console)");
  }
  results.attendance_logs_created = logsCreated;
  results.steps.push(`Inserted ${logsCreated}/5 attendance logs (deduped)`);

  if (testEmployeeId) {
    const existing = await pool.query(
      "SELECT id FROM public.attendance_records WHERE employee_id = $1 AND date = $2 LIMIT 1",
      [testEmployeeId, dateStr]
    );
    if (existing.rows.length) {
      await pool.query("UPDATE public.attendance_records SET check_out = $1 WHERE id = $2", [`${dateStr}T17:00:00+05:30`, existing.rows[0].id]);
      results.steps.push("Updated existing attendance record with check-out");
      results.attendance_records_created = 1;
    } else {
      try {
        await pool.query(
          `INSERT INTO public.attendance_records (employee_id, date, check_in, check_out, source, device_id, notes)
           VALUES ($1, $2, $3, $4, 'biometric', $5, 'Demo test — auto-created')`,
          [testEmployeeId, dateStr, `${dateStr}T09:00:00+05:30`, `${dateStr}T17:00:00+05:30`, deviceSerial]
        );
        results.attendance_records_created = 1;
        results.steps.push("Created attendance record (check-in 9:00, check-out 17:00)");
      } catch (e) {
    if (isDatabaseUnavailable(e)) throw e;
        results.errors.push(`Attendance record error: ${(e as Error).message}`);
      }
    }
  }

  const verifyLogs = await pool.query(
    `SELECT id, event_time, attendance_status, dedupe_key FROM public.hikvision_attendance_logs
     WHERE employee_code = $1 AND source_mode = 'demo-test' ORDER BY event_time`,
    [testEmployeeCode]
  );
  results.verification = { logs_in_db: verifyLogs.rows.length, logs: verifyLogs.rows };

  const verifyRecord = await pool.query(
    "SELECT id, date, check_in, check_out, source FROM public.attendance_records WHERE employee_id = $1 AND date = $2 LIMIT 1",
    [testEmployeeId, dateStr]
  );
  results.verification.attendance_record = verifyRecord.rows[0] || null;

  results.steps.push("Verification complete");
  results.success = results.errors.length === 0;
  return results;
}

functionsRouter.post("/hikvision-sync", requireAuth, requireRole("admin"), asyncHandler(async (req, res) => {
  try {
    const body = req.body ?? {};
    const { action, device_id } = body;
    console.log(`\n========== ACTION: ${action} | device_id: ${device_id} ==========`);
    const device_serial = await getDeviceSerial(body);

    // ACTION: demo-test — end-to-end pipeline test with mock data
    if (action === "demo-test") {
      try {
        const result = await runDemoTest(device_id || null);
        await logSync(device_id || null, "demo_test", result.success ? "success" : "error", "demo", result.attendance_logs_created);
        return ok(res, result);
      } catch (e) {
    if (isDatabaseUnavailable(e)) throw e;
        return ok(res, { success: false, error: (e as Error).message });
      }
    }

    // ACTION: credential-status — report non-secret config status
    if (action === "credential-status") {
      const creds = await getHikvisionCredentials();
      return ok(res, {
        success: true,
        configured: Boolean(creds.appKey && creds.secretKey),
        source: creds.source,
        hasDbCredentials: creds.hasDbCredentials,
        hasEnvFallback: creds.hasEnvCredentials,
        hasWebhookSecret: creds.hasWebhookSecret,
      });
    }

    // ACTION: test-credentials — validate configured secrets (DB or env fallback)
    if (action === "test-credentials") {
      try {
        const tokenInfo = await getHppToken();
        return ok(res, {
          success: true, areaDomain: tokenInfo.areaDomain, expireTime: tokenInfo.expireTime,
          message: "Credentials are valid. Token acquired.",
        });
      } catch (e) {
    if (isDatabaseUnavailable(e)) throw e;
        return ok(res, { success: false, error: (e as Error).message });
      }
    }

    // ACTION: test — cloud device check
    if (action === "test") {
      try {
        const { accessToken, areaDomain } = await getHppToken();
        const sites = await getAllSites(areaDomain, accessToken);

        let found: HikAny | null = null;
        for (const site of sites) {
          try {
            const result = await cloudApi(areaDomain, accessToken, "/api/hpcgw/v1/device/list", { siteId: site.id, page: 1, pageSize: 100 });
            found = (result.data?.rows || []).find((d: HikAny) => d.deviceSerial === device_serial);
            if (found) { found._siteId = site.id; break; }
          } catch { /* continue */ }
        }

        if (found) {
          const isOnline = String(found.deviceOnlineStatus) === "1";
          await logSync(device_id, "test_connection", "success", "device_info");
          return ok(res, { success: true, status: isOnline ? "online" : "offline", device: { deviceName: found.deviceName, deviceModel: found.deviceModel, isOnline }, method: "cloud_api" });
        }
        return ok(res, { success: false, error: `Device ${device_serial} not found in any site` });
      } catch (e) {
    if (isDatabaseUnavailable(e)) throw e;
        const errMsg = (e as Error).message;
        await logSync(device_id, "test_connection", "error", "device_info", 0, errMsg);
        return ok(res, { success: false, error: errMsg });
      }
    }

    // ACTION: site-search
    if (action === "site-search") {
      try {
        const { accessToken, areaDomain } = await getHppToken();
        const sites = await getAllSites(areaDomain, accessToken);
        return ok(res, { success: true, sites });
      } catch (e) {
    if (isDatabaseUnavailable(e)) throw e;
        return ok(res, { success: false, error: (e as Error).message });
      }
    }

    // ACTION: list-devices / list-cloud-devices
    if (action === "list-devices" || action === "list-cloud-devices") {
      try {
        const { accessToken, areaDomain } = await getHppToken();
        const sites = await getAllSites(areaDomain, accessToken);
        const allDevices: HikAny[] = [];
        const siteResults: Array<{ siteId: string; siteName: string; deviceCount: number }> = [];

        for (const site of sites) {
          try {
            const result = await cloudApi(areaDomain, accessToken, "/api/hpcgw/v1/device/list", { siteId: site.id, page: 1, pageSize: 100 });
            const devices = result.data?.rows || [];
            for (const d of devices) { d._siteName = site.siteName; d._siteId = site.id; allDevices.push(d); }
            siteResults.push({ siteId: site.id, siteName: site.siteName, deviceCount: devices.length });
          } catch { /* continue */ }
        }

        if (action === "list-cloud-devices" && body.import_devices) {
          let imported = 0;
          for (const d of allDevices) {
            try {
              // No unique constraint on device_serial — select-then-upsert manually
              const existing = await pool.query("SELECT id FROM public.hikvision_devices WHERE device_serial = $1 LIMIT 1", [d.deviceSerial]);
              if (existing.rows.length) {
                await pool.query(
                  `UPDATE public.hikvision_devices SET name = $1, device_model = $2, status = $3, site_id = $4, site_name = $5 WHERE id = $6`,
                  [d.deviceName || d.deviceSerial, d.deviceModel || null, String(d.deviceOnlineStatus) === "1" ? "active" : "inactive", d._siteId || null, d._siteName || null, existing.rows[0].id]
                );
              } else {
                await pool.query(
                  `INSERT INTO public.hikvision_devices (name, device_serial, device_model, ip_address, status, site_id, site_name)
                   VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                  [d.deviceName || d.deviceSerial, d.deviceSerial, d.deviceModel || null, d.deviceSerial, String(d.deviceOnlineStatus) === "1" ? "active" : "inactive", d._siteId || null, d._siteName || null]
                );
              }
              imported++;
            } catch (e) {
    if (isDatabaseUnavailable(e)) throw e;
              console.warn("[hikvision] device import error:", (e as Error).message);
            }
          }
          return ok(res, { success: true, devices: allDevices, imported, sites: siteResults });
        }

        return ok(res, { success: true, devices: allDevices, sites: siteResults });
      } catch (e) {
    if (isDatabaseUnavailable(e)) throw e;
        return ok(res, { success: false, error: (e as Error).message });
      }
    }

    // ACTION: sync-employees (ISAPI + logs fallback)
    if (action === "sync-employees") {
      try {
        const { accessToken, areaDomain } = await getHppToken();

        try {
          const result = await isapiSyncEmployees(areaDomain, accessToken, device_serial, device_id);
          await logSync(device_id, "sync_employees_isapi", "success", "employee", result.records_synced);
          return ok(res, result);
        } catch (isapiErr) {
    if (isDatabaseUnavailable(isapiErr)) throw isapiErr;
          console.log(`[sync-employees] ISAPI failed: ${(isapiErr as Error).message}, falling back to logs...`);
          await logSync(device_id, "sync_employees_isapi_failed", "info", "employee", 0, (isapiErr as Error).message);
        }

        const result = await syncEmployeesFromLogs(device_id);
        await logSync(device_id, "sync_employees_from_logs", "success", "employee", result.records_synced);
        return ok(res, result);
      } catch (e) {
    if (isDatabaseUnavailable(e)) throw e;
        const errMsg = (e as Error).message;
        await logSync(device_id, "sync_employees_failed", "error", "employee", 0, errMsg);
        return ok(res, { success: false, error: errMsg });
      }
    }

    // ACTION: sync / sync-attendance — MQ polling
    if (action === "sync" || action === "sync-attendance") {
      try {
        const { accessToken, areaDomain } = await getHppToken();
        const result = await pollMqAttendance(areaDomain, accessToken, device_serial, device_id);
        await logSync(device_id, "sync_attendance_mq", "success", "attendance", result.records_synced);
        return ok(res, result);
      } catch (e) {
    if (isDatabaseUnavailable(e)) throw e;
        const errMsg = (e as Error).message;
        await logSync(device_id, "sync_attendance_failed", "error", "attendance", 0, errMsg);
        return ok(res, { success: false, error: errMsg });
      }
    }

    // ACTION: backfill-attendance — ISAPI AcsEvent search
    if (action === "backfill-attendance") {
      try {
        const { start_time, end_time } = body;
        if (!start_time || !end_time) return fail(res, "start_time and end_time are required");

        const { accessToken, areaDomain } = await getHppToken();
        const result = await backfillAttendance(areaDomain, accessToken, device_serial, device_id, start_time, end_time);
        await logSync(device_id, "backfill_attendance", "success", "attendance", result.records_synced);
        return ok(res, result);
      } catch (e) {
    if (isDatabaseUnavailable(e)) throw e;
        const errMsg = (e as Error).message;
        await logSync(device_id, "backfill_attendance_failed", "error", "attendance", 0, errMsg);
        return ok(res, { success: false, error: errMsg });
      }
    }

    // ACTION: full-sync — employees + attendance
    if (action === "full-sync") {
      const results: Record<string, HikAny> = {};
      const { accessToken, areaDomain } = await getHppToken();

      try {
        try {
          results["sync-employees"] = await isapiSyncEmployees(areaDomain, accessToken, device_serial, device_id);
        } catch {
          results["sync-employees"] = await syncEmployeesFromLogs(device_id);
        }
        await logSync(device_id, "full_sync_employees", "success", "employee", results["sync-employees"].records_synced);
      } catch (e) {
    if (isDatabaseUnavailable(e)) throw e;
        results["sync-employees"] = { success: false, error: (e as Error).message };
      }

      try {
        results["sync-attendance"] = await pollMqAttendance(areaDomain, accessToken, device_serial, device_id);
        await logSync(device_id, "full_sync_attendance", "success", "attendance", results["sync-attendance"].records_synced);
      } catch (e) {
    if (isDatabaseUnavailable(e)) throw e;
        results["sync-attendance"] = { success: false, error: (e as Error).message };
      }

      const allSuccess = Object.values(results).every((r) => r.success);
      await logSync(device_id, "full_sync", allSuccess ? "success" : "partial", "full_sync");
      return ok(res, { success: allSuccess, results });
    }

    // ACTION: auto-map
    if (action === "auto-map") {
      try {
        const unmapped = await pool.query("SELECT * FROM public.hikvision_employee_mapping WHERE erp_employee_id IS NULL");
        let mapped = 0;
        for (const m of unmapped.rows) {
          const emp = await pool.query("SELECT id FROM public.employees WHERE device_employee_code = $1 LIMIT 1", [m.device_employee_code]);
          if (emp.rows.length) {
            await pool.query("UPDATE public.hikvision_employee_mapping SET erp_employee_id = $1 WHERE id = $2", [emp.rows[0].id, m.id]);
            mapped++;
          }
        }
        return ok(res, { success: true, mapped });
      } catch (e) {
    if (isDatabaseUnavailable(e)) throw e;
        return ok(res, { success: false, error: (e as Error).message });
      }
    }

    // ACTION: manual-add-employee
    if (action === "manual-add-employee") {
      try {
        const { employee_code, employee_name, erp_employee_id } = body;
        if (!employee_code) return fail(res, "employee_code is required");
        const name = employee_name || `Employee ${employee_code}`;

        await upsertEmployeeMapping({ code: employee_code, name, deviceId: device_id || null, erpEmployeeId: erp_employee_id || null });

        if (erp_employee_id) {
          await pool.query("UPDATE public.employees SET device_employee_code = $1 WHERE id = $2", [employee_code, erp_employee_id]);
        } else {
          const emp = await pool.query("SELECT id FROM public.employees WHERE name ILIKE $1 LIMIT 1", [`%${name}%`]);
          if (emp.rows.length) {
            await pool.query(
              "UPDATE public.hikvision_employee_mapping SET erp_employee_id = $1 WHERE device_employee_code = $2 AND device_id IS NOT DISTINCT FROM $3",
              [emp.rows[0].id, employee_code, device_id || null]
            );
            await pool.query("UPDATE public.employees SET device_employee_code = $1 WHERE id = $2", [employee_code, emp.rows[0].id]);
          }
        }

        await logSync(device_id, "manual_add_employee", "success", "employee", 1);
        return ok(res, { success: true, message: `Employee ${name} (${employee_code}) mapped` });
      } catch (e) {
    if (isDatabaseUnavailable(e)) throw e;
        return ok(res, { success: false, error: (e as Error).message });
      }
    }

    return fail(res, "Invalid action");
  } catch (e) {
    if (isDatabaseUnavailable(e)) throw e;
    console.error(`[hikvision-sync FATAL] ${(e as Error).message}`);
    return fail(res, (e as Error).message, 500);
  }
}));

// ---------------------------------------------------------------------------
// hikvision-webhook — inbound Hik-Partner event receiver (full port)
// ---------------------------------------------------------------------------
async function verifyHikSignature(bodyText: string, timestamp: string, batchId: string, signature: string): Promise<boolean> {
  const { webhookSignSecret } = await getHikvisionCredentials();
  if (!webhookSignSecret) {
    console.warn("[hikvision-webhook] No HIK_WEBHOOK_SIGN_SECRET configured, skipping signature check");
    return true;
  }
  const expected = crypto.createHmac("sha256", webhookSignSecret).update(`${timestamp}.${batchId}`).digest("hex");
  if (expected.length !== signature.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature.toLowerCase()));
}

// GET: Hik-Partner webhook verification (challenge echo)
functionsRouter.get("/hikvision-webhook", (req, res) => {
  const challenge = (req.query.challenge as string) || (req.query.echostr as string) || "";
  res.status(200).type("text/plain").send(challenge);
});

functionsRouter.post("/hikvision-webhook", asyncHandler(async (req, res) => {
  try {
    const bodyText = rawBody(req);
    const timestamp = (req.headers["x-hook-timestamp"] as string) || "";
    const batchId = (req.headers["x-hook-batch-id"] as string) || "";
    const signature = (req.headers["x-hook-signature"] as string) || "";

    console.log(`[hikvision-webhook] POST | timestamp: ${timestamp} | batchId: ${batchId} | sig: ${signature ? "present" : "none"}`);

    if (signature) {
      const valid = await verifyHikSignature(bodyText, timestamp, batchId, signature);
      if (!valid) {
        console.error("[hikvision-webhook] Invalid signature — rejecting");
        return fail(res, "Invalid signature", 403);
      }
    }

    let payload: HikAny;
    try { payload = JSON.parse(bodyText); } catch {
      return fail(res, "Invalid JSON");
    }

    const events: HikAny[] = Array.isArray(payload) ? payload : (payload.params?.events || payload.events || [payload]);
    console.log(`[hikvision-webhook] Processing ${events.length} events`);

    let processed = 0;
    let skipped = 0;

    for (const event of events) {
      try {
        let alarmData: HikAny = event;
        if (typeof event.alarmData === "string") {
          try { alarmData = JSON.parse(event.alarmData); } catch { alarmData = event; }
        } else if (event.alarmData) {
          alarmData = event.alarmData;
        }

        const deviceSerial = event.deviceSerial || alarmData.deviceSerial || "";
        const acsEvent = alarmData.AccessControllerEvent || alarmData.ACSEvent || {};
        const eventType = alarmData.eventType || event.formatType || "";

        const isAccessEvent = eventType.toLowerCase().includes("accesscontroller") ||
          eventType.toLowerCase().includes("acs") || acsEvent.employeeNoString || acsEvent.name;
        if (!isAccessEvent) { skipped++; continue; }

        const employeeCode = acsEvent.employeeNoString || acsEvent.employeeNo?.toString() || "";
        const employeeName = acsEvent.name || "";
        const eventTime = alarmData.dateTime || acsEvent.time || acsEvent.dateTime || event.alarmTime;
        if (!eventTime || !employeeCode) { skipped++; continue; }

        const attStatus = acsEvent.attendanceStatus || "";
        const verifyMode = acsEvent.currentVerifyMode || "";
        const serialNo = acsEvent.serialNo?.toString() || "";
        const dedupeKey = buildDedupeKey(deviceSerial, serialNo, employeeCode, eventTime, attStatus, verifyMode);

        console.log(`[hikvision-webhook] Event: emp=${employeeCode} time=${eventTime} status=${attStatus} device=${deviceSerial}`);

        // Resolve device + employee mapping
        const deviceRec = await pool.query("SELECT id, name FROM public.hikvision_devices WHERE device_serial = $1 LIMIT 1", [deviceSerial]);
        const deviceId = deviceRec.rows[0]?.id ?? null;
        const mapping = await pool.query(
          "SELECT erp_employee_id FROM public.hikvision_employee_mapping WHERE device_employee_code = $1 AND device_id = $2 LIMIT 1",
          [employeeCode, deviceId ?? "00000000-0000-0000-0000-000000000000"]
        );
        const erpEmployeeId = mapping.rows[0]?.erp_employee_id ?? null;

        const stored = await storeAttendanceLog({
          deviceId, employeeCode, employeeName, erpEmployeeId,
          deviceSerial, deviceName: deviceRec.rows[0]?.name || "", eventTime, eventType: "attendance",
          rawData: alarmData, dedupeKey, sourceMode: "webhook", attStatus, verifyMode, serialNo,
        });
        if (stored) processed++;
        else { skipped++; continue; }

        // Auto-create/update attendance record if mapped
        if (erpEmployeeId) {
          await convertToAttendanceRecord(erpEmployeeId, eventTime, deviceSerial, "webhook");
        }
      } catch (evtErr) {
    if (isDatabaseUnavailable(evtErr)) throw evtErr;
        console.warn(`[hikvision-webhook] Event error: ${(evtErr as Error).message}`);
        skipped++;
      }
    }

    await pool.query(
      `INSERT INTO public.hikvision_sync_log (action, status, sync_type, records_synced)
       VALUES ('webhook_received', 'success', 'attendance', $1)`,
      [processed]
    ).catch(() => undefined);

    console.log(`[hikvision-webhook] Done: ${processed} processed, ${skipped} skipped, batch ${batchId}`);
    return ok(res, { success: true, processed, skipped });
  } catch (e) {
    if (isDatabaseUnavailable(e)) throw e;
    console.error(`[hikvision-webhook] FATAL: ${(e as Error).stack || (e as Error).message}`);
    return fail(res, "Internal error", 500);
  }
}));

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ---------------------------------------------------------------------------
// record-audit — authenticated system audit logger usable by admin/staff/tech
// ---------------------------------------------------------------------------
functionsRouter.post("/record-audit", requireAuth, asyncHandler(async (req, res) => {
  try {
    const { action, module, entity_type, entity_id, details, staff_name, user_role } = req.body ?? {};
    if (!action || typeof action !== "string") return fail(res, "action is required");

    let resolvedStaff = typeof staff_name === "string" && staff_name.trim() ? staff_name.trim() : null;
    if (!resolvedStaff && req.user?.id) {
      const p = await pool.query("SELECT full_name FROM public.profiles WHERE user_id = $1::uuid LIMIT 1", [req.user.id]);
      resolvedStaff = p.rows[0]?.full_name || req.user.email || null;
    }

    const cleanEntityId = typeof entity_id === "string" && UUID_RE.test(entity_id) ? entity_id : null;
    const resolvedDetails =
      cleanEntityId || !entity_id
        ? (details ?? null)
        : [String(entity_id), details].filter(Boolean).join(" — ");

    await pool.query(
      `INSERT INTO public.system_audit_log (user_id, user_role, staff_name, action, module, entity_type, entity_id, details)
       VALUES ($1::uuid, $2, $3, $4, $5, $6, $7::uuid, $8)`,
      [
        req.user?.id ?? null,
        user_role ?? req.user?.roles?.[0] ?? null,
        resolvedStaff,
        action.trim(),
        module || "system",
        entity_type ?? null,
        cleanEntityId,
        resolvedDetails,
      ]
    );
    return ok(res, { success: true });
  } catch (e) {
    if (isDatabaseUnavailable(e)) throw e;
    return fail(res, (e as Error).message, 500);
  }
}));

// ---------------------------------------------------------------------------
// notify-job-event — notifies admins/creator/technician for repair lifecycle
// events (supports authenticated staff OR public customer actions with token)
// ---------------------------------------------------------------------------
functionsRouter.post("/notify-job-event", asyncHandler(async (req, res) => {
  try {
    const { job_id, public_token, event, details } = req.body ?? {};
    if (!job_id || typeof job_id !== "string" || !UUID_RE.test(job_id)) {
      return fail(res, "Valid job_id is required");
    }
    if (!event || typeof event !== "string") {
      return fail(res, "event is required");
    }

    const jobRes = await pool.query(
      `SELECT j.id, j.job_number, j.public_token, j.created_by, j.assigned_technician_id,
              c.name AS customer_name, e.user_id AS tech_user_id
       FROM public.job_sheets j
       LEFT JOIN public.customers c ON c.id = j.customer_id
       LEFT JOIN public.employees e ON e.id = j.assigned_technician_id
       WHERE j.id = $1::uuid
       LIMIT 1`,
      [job_id]
    );
    const job = jobRes.rows[0];
    if (!job) return fail(res, "Job sheet not found", 404);

    if (!req.user) {
      if (!public_token || String(public_token) !== String(job.public_token)) {
        return fail(res, "Unauthorized", 401);
      }
    }

    const adminRes = await pool.query("SELECT user_id FROM public.user_roles WHERE role = 'admin'");
    const recipients = new Set<string>(adminRes.rows.map((r: { user_id: string }) => r.user_id));
    if (job.created_by) recipients.add(job.created_by);
    if (job.tech_user_id) recipients.add(job.tech_user_id);

    const customerLabel = job.customer_name || "Customer";
    const eventTitleMap: Record<string, string> = {
      customer_approved: `Estimate Approved — ${job.job_number}`,
      customer_rejected: `Estimate Declined — ${job.job_number}`,
      customer_delivery_signed: `Delivery Signed — ${job.job_number}`,
      requote_requested: `Re-Quote Sent — ${job.job_number}`,
      qc_submitted: `QC Ready for Review — ${job.job_number}`,
      qc_approved: `QC Approved — ${job.job_number}`,
      qc_failed: `QC Rework Needed — ${job.job_number}`,
      waiting_parts: `Parts Requested — ${job.job_number}`,
      invoice_generated: `Repair Invoice Generated — ${job.job_number}`,
    };
    const title = eventTitleMap[event] || `Repair Update — ${job.job_number}`;
    const message = details ? `${customerLabel}: ${details}` : `${job.job_number} (${customerLabel}) — ${event.replace(/_/g, " ")}`;
    const link = `/repairs/${job.id}`;

    for (const userId of recipients) {
      await pool.query(
        `INSERT INTO public.notifications (user_id, title, message, type, link) VALUES ($1::uuid, $2, $3, 'repair', $4)`,
        [userId, title, message, link]
      );
      await pool.query(
        `INSERT INTO public.notification_feed (user_id, type, title, body, metadata) VALUES ($1::uuid, 'repair', $2, $3, $4::jsonb)`,
        [userId, title, message, JSON.stringify({ link, job_id: job.id, event })]
      );
    }

    return ok(res, { success: true, notified: recipients.size });
  } catch (e) {
    if (isDatabaseUnavailable(e)) throw e;
    return fail(res, (e as Error).message, 500);
  }
}));
