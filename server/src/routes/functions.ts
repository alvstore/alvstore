import { isDatabaseUnavailable } from "../lib/api-errors.js";
import { asyncHandler } from "../lib/async-handler.js";
import { Router, type Request, type Response } from "express";
import fs from "node:fs";
import path from "node:path";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import multer from "multer";
import { prisma, pool } from "../db.js";
import { env } from "../env.js";
import { publicUrl } from "./storage.js";
import { buildBrandedDocumentPdf, type BrandedDocumentPdfInput, type BrandedDocumentType } from "../lib/document-pdf.js";
import { buildCashflowAuditPdf, buildPayrollSlipPdf } from "../lib/report-pdf.js";
import {
  aggregateCashMovementsForDate,
  auditCarryForwardChain,
  computeCashDayExpectedClosing,
  normalizeDateKey,
  recordFinanceSync,
  syncDailyCashForDate,
  type FinanceEntrySource,
} from "../lib/finance-sync.js";
import { escapeHtml, renderBrandedEmailHtml, resolveSmtpConfig, sendMailWithConfig } from "../lib/mailer.js";
import { syncDocumentStock } from "../lib/inventory-ledger.js";
import { appendChallanTimeline, CHALLAN_POD_ALLOWED_STATUSES, validatePublicQuotationResponse } from "../lib/public-documents.js";
import { resolveHikvisionCredentials } from "../lib/hikvision-config.js";
import { handlePublicLeadRequest } from "../lib/public-lead.js";
import { convertLeadTx, deleteLeadsTx } from "../lib/lead-actions.js";
import { isValidAppRole, replaceUserRole } from "../lib/user-roles.js";
import { requireAuth, requireRole } from "../auth/middleware.js";
import {
  connectGatewaySession,
  disconnectGatewaySession,
  getGatewaySessionStatus,
  normalizePhoneLast10,
  normalizeWhatsappNumber,
  parseGatewayWebhookPayload,
  readLocalStorageUploadBase64,
  resolveWhatsappConfig,
  sendGatewayMedia,
  sendGatewayText,
  verifyGatewayWebhook,
  type NormalizedInboundMessage,
  type NormalizedStatusUpdate,
  type WhatsappProvider,
} from "../lib/whatsapp-gateway.js";
import {
  promoteWhatsappChatToLead,
  recordOutboundWhatsappChatMessage,
  syncInboundWhatsappMessages,
  syncWhatsappDeliveryStatuses,
} from "../lib/whatsapp-sync.js";

const DOC_UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STAFF_ROLES = new Set(["admin", "staff", "technician"]);
const CHALLAN_VALID_STATUSES = new Set([
  "draft",
  "packed",
  "sent",
  "dispatched",
  "in_transit",
  "out_for_delivery",
  "delivered",
  "returned",
  "invoiced",
  "cancelled",
]);
const POD_UPLOAD_DIR = path.resolve(env.uploadsDir, "uploads", "pod");
const podUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (["image/png", "image/jpeg", "image/jpg", "image/webp"].includes(file.mimetype.toLowerCase())) {
      cb(null, true);
    } else {
      cb(new Error("Only PNG, JPEG, or WebP POD photos up to 5 MB are supported"));
    }
  },
});

function hasStaffRole(req: Request): boolean {
  const roles = req.user?.roles ?? [];
  return roles.some((r) => STAFF_ROLES.has(r));
}

function requireStaff(req: Request, res: Response, next: () => void): void {
  if (!req.user) {
    res.status(401).json({ error: "Unauthorized", success: false });
    return;
  }
  if (!hasStaffRole(req)) {
    res.status(403).json({ error: "Staff access required", success: false });
    return;
  }
  next();
}

function getClientIp(req: Request): string {
  const xff = req.headers["x-forwarded-for"];
  if (typeof xff === "string" && xff.trim()) return xff.split(",")[0].trim().slice(0, 64);
  if (Array.isArray(xff) && xff[0]) return String(xff[0]).trim().slice(0, 64);
  return String(req.ip || req.socket.remoteAddress || "").slice(0, 64);
}

async function notifyStaffAndCreator(opts: {
  createdBy?: string | null;
  type: string;
  title: string;
  message: string;
  link: string;
  metadata: Record<string, unknown>;
}) {
  const recipients = new Set<string>();
  const admins = await pool.query("SELECT user_id FROM public.user_roles WHERE role = 'admin'");
  for (const row of admins.rows) if (row.user_id) recipients.add(row.user_id);
  if (opts.createdBy) recipients.add(opts.createdBy);
  for (const userId of recipients) {
    await pool.query(
      `INSERT INTO public.notifications (user_id, title, message, type, link) VALUES ($1::uuid, $2, $3, $4, $5)`,
      [userId, opts.title, opts.message, opts.type, opts.link]
    );
    await pool.query(
      `INSERT INTO public.notification_feed (user_id, type, title, body, metadata) VALUES ($1::uuid, $2, $3, $4, $5::jsonb)`,
      [userId, opts.type, opts.title, opts.message, JSON.stringify({ link: opts.link, ...opts.metadata })]
    );
  }
}

async function resolveSalespersonName(salespersonId?: string | null): Promise<string | null> {
  if (!salespersonId) return null;
  const emp = await prisma.employees.findFirst({
    where: { OR: [{ id: salespersonId }, { user_id: salespersonId }] },
    select: { name: true },
  });
  if (emp?.name) return emp.name;
  const prof = await prisma.profiles.findFirst({
    where: { OR: [{ id: salespersonId }, { user_id: salespersonId }] },
    select: { full_name: true },
  });
  return prof?.full_name ?? null;
}

async function loadDocumentForPdf(
  docType: BrandedDocumentType,
  opts: { id?: string; token?: string }
): Promise<{
  id: string;
  docNumber: string;
  status: string;
  filename: string;
  publicToken: string | null;
  publicPath: string | null;
  customerEmail: string | null;
  customerName: string | null;
  pdfInput: BrandedDocumentPdfInput;
} | null> {
  const biz = await prisma.businessSettings.findFirst();
  const business = {
    company_name: biz?.company_name ?? "ALVStore",
    company_address: biz?.company_address ?? null,
    company_phone: biz?.company_phone ?? null,
    company_email: biz?.company_email ?? null,
    gst_number: biz?.gst_number ?? null,
    logo_url: biz?.logo_url ?? "/alvstore-logo.png",
    bank_name: biz?.bank_name ?? null,
    bank_account_number: biz?.bank_account_number ?? null,
    bank_ifsc: biz?.bank_ifsc ?? null,
    bank_branch: biz?.bank_branch ?? null,
    bank_upi_id: biz?.bank_upi_id ?? null,
  };

  if (docType === "quotation") {
    const where = opts.id ? { id: opts.id } : opts.token ? { public_token: opts.token } : null;
    if (!where) return null;
    const q = await prisma.quotations.findFirst({
      where,
      include: {
        r_customers: true,
        rl_quotation_items_quotation_id: { orderBy: [{ sort_order: "asc" }, { product_name: "asc" }] },
      },
    });
    if (!q) return null;
    const salespersonName = await resolveSalespersonName(q.salesperson_id);
    const items = q.rl_quotation_items_quotation_id.map((it) => ({
      product_id: it.product_id,
      product_name: it.product_name,
      description: it.description,
      hsn_code: it.hsn_code,
      quantity: Number(it.quantity ?? 0),
      unit_price: Number(it.unit_price ?? 0),
      discount_type: it.discount_type,
      discount_value: Number(it.discount_value ?? 0),
      gst_percentage: Number(it.gst_percentage ?? 0),
      total: Number(it.total ?? 0),
      image_url: it.image_url,
      sort_order: it.sort_order,
    }));
    const docNumber = q.quotation_number || q.id.slice(0, 8).toUpperCase();
    return {
      id: q.id,
      docNumber,
      status: q.status || "draft",
      filename: `${docNumber}.pdf`,
      publicToken: q.public_token ?? null,
      publicPath: q.public_token ? `/sales/public/${q.public_token}` : null,
      customerEmail: q.r_customers?.email ?? null,
      customerName: q.r_customers?.name ?? null,
      pdfInput: {
        docType: "quotation",
        docNumber,
        status: q.status || "draft",
        createdAt: q.created_at,
        validUntil: q.valid_until,
        paymentTerms: q.payment_terms,
        salespersonName,
        showItemImages: Boolean(q.show_item_images),
        showPricing: true,
        gstInclusive: Boolean(q.gst_inclusive),
        globalDiscountType: q.discount_type,
        globalDiscountValue: Number(q.discount_value ?? 0),
        subtotal: Number(q.subtotal ?? 0),
        gstAmount: Number(q.gst_amount ?? 0),
        total: Number(q.total ?? 0),
        notes: q.notes,
        terms: q.terms,
        signatureData: q.signature_data,
        signatureName: q.signature_name,
        signedAt: q.signed_at,
        rejectionReason: q.rejection_reason,
        business,
        customer: q.r_customers
          ? {
              name: q.r_customers.name,
              email: q.r_customers.email,
              phone: q.r_customers.phone,
              address: q.r_customers.address,
              gst_number: q.r_customers.gst_number,
              shipping_address: q.r_customers.shipping_address,
              shipping_city: q.r_customers.shipping_city,
              shipping_state: q.r_customers.shipping_state,
              shipping_pincode: q.r_customers.shipping_pincode,
            }
          : null,
        items,
      },
    };
  }

  if (docType === "invoice") {
    const where = opts.id ? { id: opts.id } : opts.token ? { public_token: opts.token } : null;
    if (!where) return null;
    const inv = await prisma.invoices.findFirst({
      where,
      include: {
        r_customers: true,
        rl_invoice_items_invoice_id: { orderBy: [{ sort_order: "asc" }, { product_name: "asc" }] },
      },
    });
    if (!inv) return null;
    const salespersonName = await resolveSalespersonName(inv.salesperson_id);
    const items = inv.rl_invoice_items_invoice_id.map((it) => ({
      product_id: it.product_id,
      product_name: it.product_name,
      description: it.description,
      hsn_code: it.hsn_code,
      quantity: Number(it.quantity ?? 0),
      unit_price: Number(it.unit_price ?? 0),
      discount_type: it.discount_type,
      discount_value: Number(it.discount_value ?? 0),
      gst_percentage: Number(it.gst_percentage ?? 0),
      total: Number(it.total ?? 0),
      sort_order: it.sort_order,
    }));
    const docNumber = inv.invoice_number || inv.id.slice(0, 8).toUpperCase();
    return {
      id: inv.id,
      docNumber,
      status: inv.payment_status || inv.status || "issued",
      filename: `${docNumber}.pdf`,
      publicToken: inv.public_token ?? null,
      publicPath: inv.public_token ? `/invoice/public/${inv.public_token}` : null,
      customerEmail: inv.r_customers?.email ?? null,
      customerName: inv.r_customers?.name ?? null,
      pdfInput: {
        docType: "invoice",
        docNumber,
        status: inv.payment_status || inv.status || "issued",
        createdAt: inv.created_at,
        dueDate: inv.due_date,
        paymentTerms: inv.payment_terms,
        salespersonName,
        showItemImages: false,
        showPricing: true,
        gstInclusive: Boolean(inv.gst_inclusive),
        globalDiscountType: inv.discount_type,
        globalDiscountValue: Number(inv.discount_value ?? 0),
        subtotal: Number(inv.subtotal ?? 0),
        gstAmount: Number(inv.gst_amount ?? 0),
        total: Number(inv.total ?? 0),
        paidAmount: Number(inv.paid_amount ?? 0),
        notes: inv.notes,
        signatureData: inv.signature_data,
        signatureName: inv.signature_name,
        signedAt: inv.signed_at,
        business,
        customer: inv.r_customers
          ? {
              name: inv.r_customers.name,
              email: inv.r_customers.email,
              phone: inv.r_customers.phone,
              address: inv.r_customers.address,
              gst_number: inv.r_customers.gst_number,
              shipping_address: inv.r_customers.shipping_address,
              shipping_city: inv.r_customers.shipping_city,
              shipping_state: inv.r_customers.shipping_state,
              shipping_pincode: inv.r_customers.shipping_pincode,
            }
          : null,
        items,
      },
    };
  }

  const where = opts.id ? { id: opts.id } : opts.token ? { public_token: opts.token } : null;
  if (!where) return null;
  const ch = await prisma.deliveryChallans.findFirst({
    where,
    include: {
      r_customers: true,
      rl_delivery_challan_items: { orderBy: [{ sort_order: "asc" }, { product_name: "asc" }] },
    },
  });
  if (!ch) return null;
  const items = ch.rl_delivery_challan_items.map((it) => ({
    product_id: it.product_id,
    product_name: it.product_name,
    description: it.description,
    hsn_code: it.hsn_code,
    quantity: Number(it.quantity ?? 0),
    unit_price: Number(it.unit_price ?? 0),
    discount_type: it.discount_type,
    discount_value: Number(it.discount_value ?? 0),
    gst_percentage: Number(it.gst_percentage ?? 0),
    total: Number(it.total ?? 0),
    image_url: it.image_url,
    sort_order: it.sort_order,
  }));
  const docNumber = ch.challan_number || ch.id.slice(0, 8).toUpperCase();
  return {
    id: ch.id,
    docNumber,
    status: ch.status || "draft",
    filename: `${docNumber}.pdf`,
    publicToken: ch.public_token ?? null,
    publicPath: ch.public_token ? `/challan/public/${ch.public_token}` : null,
    customerEmail: ch.r_customers?.email ?? null,
    customerName: ch.r_customers?.name ?? null,
    pdfInput: {
      docType: "challan",
      docNumber,
      status: ch.status || "draft",
      createdAt: ch.created_at ?? new Date(),
      showItemImages: Boolean(ch.show_item_images),
      showPricing: Boolean(ch.show_pricing),
      gstInclusive: Boolean(ch.gst_inclusive),
      globalDiscountType: ch.discount_type,
      globalDiscountValue: Number(ch.discount_value ?? 0),
      subtotal: Number(ch.subtotal ?? 0),
      gstAmount: Number(ch.gst_amount ?? 0),
      total: Number(ch.total ?? 0),
      notes: ch.notes,
      signatureData: ch.receiver_signature,
      signatureName: ch.receiver_name,
      signedAt: ch.delivered_at,
      challanMeta: {
        challan_type: ch.challan_type,
        shipping_address: ch.shipping_address,
        courier_name: ch.courier_name,
        tracking_number: ch.tracking_number,
        tracking_url: ch.tracking_url,
        eway_bill_number: ch.eway_bill_number,
        delivery_person: ch.delivery_person,
        vehicle_number: ch.vehicle_number,
        dispatched_at: ch.dispatched_at,
        expected_delivery_at: ch.expected_delivery_at,
        delivered_at: ch.delivered_at,
        receiver_name: ch.receiver_name,
        receiver_phone: ch.receiver_phone,
        pod_photo_url: ch.pod_photo_url,
      },
      business,
      customer: ch.r_customers
        ? {
            name: ch.r_customers.name,
            email: ch.r_customers.email,
            phone: ch.r_customers.phone,
            address: ch.r_customers.address,
            gst_number: ch.r_customers.gst_number,
            shipping_address: ch.r_customers.shipping_address,
            shipping_city: ch.r_customers.shipping_city,
            shipping_state: ch.r_customers.shipping_state,
            shipping_pincode: ch.r_customers.shipping_pincode,
          }
        : null,
      items,
    },
  };
}

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
  file_url?: string;
  file_name?: string;
  file_type?: string;
  media_base64?: string;
}): Promise<{
  success: boolean;
  error?: string;
  waMessageId?: string | null;
  provider?: WhatsappProvider;
  data?: unknown;
}> {
  const settings = await getSettings();
  const cfg = resolveWhatsappConfig(
    {
      whatsapp_api_url: settings.whatsapp_api_url as string | null,
      whatsapp_api_key: settings.whatsapp_api_key as string | null,
      whatsapp_phone_id: settings.whatsapp_phone_id as string | null,
      integrations: (settings.integrations as Record<string, unknown>) || null,
    },
    env
  );

  if (!cfg.configured) {
    return {
      success: false,
      error: "WhatsApp not configured. Link a number or configure credentials in Settings -> WhatsApp.",
    };
  }

  const normalizedTo = normalizeWhatsappNumber(args.to);
  if (!normalizedTo) {
    return { success: false, error: "Invalid recipient phone number" };
  }

  // Self-hosted Gateway path (OpenWA / Evolution API v2)
  if (cfg.provider === "openwa" || cfg.provider === "evolution") {
    if (args.media_base64 || args.file_url) {
      let base64 = args.media_base64;
      let mimeType = args.file_type || "application/octet-stream";
      let mediaUrl: string | undefined;

      if (!base64 && args.file_url) {
        const localFile = await readLocalStorageUploadBase64(args.file_url, env.uploadsDir).catch(() => null);
        if (localFile) {
          base64 = localFile.base64;
          if (!args.file_type) mimeType = localFile.mimeType;
        } else if (args.file_url.startsWith("http://") || args.file_url.startsWith("https://")) {
          mediaUrl = args.file_url;
        } else {
          mediaUrl = `${env.appOrigin.replace(/\/$/, "")}${args.file_url.startsWith("/") ? "" : "/"}${args.file_url}`;
        }
      }

      const gwRes = await sendGatewayMedia(cfg, {
        to: normalizedTo,
        fileName: args.file_name || "attachment",
        mimeType,
        caption: args.message || "",
        base64,
        mediaUrl,
      });
      return {
        success: gwRes.sent,
        error: gwRes.error,
        waMessageId: gwRes.messageId ?? null,
        provider: gwRes.provider,
      };
    }

    let textBody = (args.message || "").trim();
    if (!textBody && args.template_name) {
      const paramText = args.template_params
        ? (Array.isArray(args.template_params) ? args.template_params : Object.values(args.template_params)).join(" — ")
        : "";
      textBody = paramText ? `${args.template_name}: ${paramText}` : args.template_name;
    }
    if (!textBody) return { success: false, error: "Message content required" };

    const gwRes = await sendGatewayText(cfg, { to: normalizedTo, text: textBody });
    return {
      success: gwRes.sent,
      error: gwRes.error,
      waMessageId: gwRes.messageId ?? null,
      provider: gwRes.provider,
    };
  }

  // Meta Official Cloud API path
  const baseUrl = (cfg.metaApiUrl || "https://graph.facebook.com/v21.0").replace(/\/+$/, "");
  const endpointUrl = baseUrl.endsWith("/messages")
    ? baseUrl
    : cfg.metaPhoneId
      ? `${baseUrl}/${cfg.metaPhoneId}/messages`
      : `${baseUrl}/messages`;

  let payload: Record<string, unknown>;
  if (args.template_name) {
    const params = args.template_params
      ? (Array.isArray(args.template_params) ? args.template_params : Object.values(args.template_params)).map((t) => ({ type: "text", text: String(t) }))
      : undefined;
    payload = {
      messaging_product: "whatsapp",
      to: normalizedTo,
      type: "template",
      template: {
        name: args.template_name,
        language: { code: "en" },
        components: params ? [{ type: "body", parameters: params }] : undefined,
      },
    };
  } else if (args.file_url && args.file_url.startsWith("https://")) {
    const isPdf = (args.file_type || "").includes("pdf") || (args.file_name || "").endsWith(".pdf");
    const isImg = (args.file_type || "").startsWith("image/");
    if (isImg) {
      payload = {
        messaging_product: "whatsapp",
        to: normalizedTo,
        type: "image",
        image: { link: args.file_url, caption: args.message || args.file_name || "" },
      };
    } else if (isPdf) {
      payload = {
        messaging_product: "whatsapp",
        to: normalizedTo,
        type: "document",
        document: { link: args.file_url, filename: args.file_name || "document.pdf", caption: args.message || "" },
      };
    } else {
      if (!args.message) return { success: false, error: "Message content required" };
      payload = { messaging_product: "whatsapp", to: normalizedTo, type: "text", text: { body: args.message } };
    }
  } else {
    if (!args.message) return { success: false, error: "Message content required" };
    payload = { messaging_product: "whatsapp", to: normalizedTo, type: "text", text: { body: args.message } };
  }

  const waRes = await fetch(endpointUrl, {
    method: "POST",
    headers: { Authorization: `Bearer ${cfg.metaToken}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const waData = (await waRes.json().catch(() => ({}))) as { messages?: { id?: string }[] } & Record<string, unknown>;
  if (!waRes.ok) {
    return { success: false, provider: "meta", error: `WhatsApp API error [${waRes.status}]: ${JSON.stringify(waData)}` };
  }
  return { success: true, provider: "meta", waMessageId: waData?.messages?.[0]?.id ?? null, data: waData };
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

functionsRouter.post("/send-whatsapp", requireStaff, asyncHandler(async (req, res) => {
  try {
    const {
      to,
      message,
      template_name,
      template_params,
      conversation_id,
      sender_id,
      file_url,
      file_name,
      file_type,
      customer_name,
    } = req.body ?? {};
    if (!to) return fail(res, "Recipient phone number required");

    const textContent = String(message || "").trim() || (file_name ? `📎 ${file_name}` : "");
    const result = await sendWhatsAppMessage({
      to: String(to),
      message: textContent || undefined,
      template_name,
      template_params,
      file_url: typeof file_url === "string" ? file_url : undefined,
      file_name: typeof file_name === "string" ? file_name : undefined,
      file_type: typeof file_type === "string" ? file_type : undefined,
    });
    if (!result.success) return fail(res, result.error ?? "WhatsApp send failed");

    let recordedConversationId: string | null = conversation_id ?? null;
    if (textContent || file_url) {
      try {
        const rec = await recordOutboundWhatsappChatMessage(pool, {
          phone: String(to),
          conversationId: conversation_id ?? null,
          senderId: req.user?.id ?? sender_id ?? null,
          customerName: typeof customer_name === "string" ? customer_name : null,
          content: textContent || (file_name ? `📎 ${file_name}` : "WhatsApp attachment"),
          waMessageId: result.waMessageId ?? null,
          fileUrl: typeof file_url === "string" ? file_url : null,
          fileName: typeof file_name === "string" ? file_name : null,
          fileType: typeof file_type === "string" ? file_type : null,
        });
        recordedConversationId = rec.conversationId;
      } catch (e) {
        if (isDatabaseUnavailable(e)) throw e;
        console.warn("[send-whatsapp] failed to record chat message:", (e as Error).message);
      }
    }
    return ok(res, {
      success: true,
      whatsapp_message_id: result.waMessageId,
      conversation_id: recordedConversationId,
      provider: result.provider,
    });
  } catch (e) {
    if (isDatabaseUnavailable(e)) throw e;
    return fail(res, (e as Error).message, 500);
  }
}));

// ---------------------------------------------------------------------------
// send-email — ALVStore SMTP (Settings -> Integrations, fallback env) + PDF attach
// ---------------------------------------------------------------------------
functionsRouter.post("/send-email", requireAuth, asyncHandler(async (req, res) => {
  try {
    if (req.user?.roles.includes("customer") && !hasStaffRole(req)) {
      return fail(res, "Staff access required to send emails", 403);
    }
    const {
      to,
      subject,
      body,
      html,
      template_id,
      variables,
      attach_document,
      mark_sent,
      plain_text,
    } = req.body ?? {};
    const recipient = String(to ?? "").trim();
    const cleanSubject = String(subject ?? "").trim();
    if (!recipient || !cleanSubject) return fail(res, "Missing 'to' or 'subject'");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) {
      return fail(res, "Please enter a valid recipient email address");
    }

    const smtp = await resolveSmtpConfig(pool);
    if (!smtp) {
      return fail(res, "SMTP not configured. Add SMTP credentials in Settings -> Integrations.", 500);
    }

    let rawBodyContent = typeof html === "string" && html.trim() ? html : typeof body === "string" ? body : "";
    if (template_id) {
      const tpl = await pool.query("SELECT body, subject FROM public.templates WHERE id = $1 LIMIT 1", [template_id]);
      if (tpl.rows.length) rawBodyContent = applyVariables(tpl.rows[0].body ?? "", variables);
    }

    const attachments: Array<{ filename: string; content: Buffer; contentType?: string }> = [];
    let ctaLabel: string | undefined;
    let ctaUrl: string | undefined;
    let companyName = smtp.fromName || "ALVStore";
    let companyEmail: string | null = smtp.fromEmail;
    let companyPhone: string | null = null;
    let attachedDoc: { type: BrandedDocumentType; id: string; docNumber: string } | null = null;

    if (attach_document && typeof attach_document === "object") {
      const docType = String(attach_document.type ?? "") as BrandedDocumentType;
      const docId = String(attach_document.id ?? "");
      if (!["quotation", "invoice", "challan"].includes(docType) || !DOC_UUID_RE.test(docId)) {
        return fail(res, "Invalid attach_document parameter");
      }
      const loaded = await loadDocumentForPdf(docType, { id: docId });
      if (!loaded) return fail(res, `${docType} not found`, 404);
      const pdfBytes = await buildBrandedDocumentPdf(loaded.pdfInput);
      attachments.push({
        filename: loaded.filename,
        content: Buffer.from(pdfBytes),
        contentType: "application/pdf",
      });
      companyName = loaded.pdfInput.business.company_name || companyName;
      companyEmail = loaded.pdfInput.business.company_email || companyEmail;
      companyPhone = loaded.pdfInput.business.company_phone || null;
      if (loaded.publicPath) {
        const origin = env.appOrigin.replace(/\/$/, "");
        ctaUrl = `${origin}${loaded.publicPath}`;
        ctaLabel =
          docType === "quotation"
            ? "View & Accept Quotation Online"
            : docType === "invoice"
            ? "View Tax Invoice Online"
            : "Track Delivery & Sign POD";
      }
      attachedDoc = { type: docType, id: loaded.id, docNumber: loaded.docNumber };
    } else {
      const biz = await prisma.businessSettings.findFirst({
        select: { company_name: true, company_email: true, company_phone: true },
      });
      if (biz) {
        companyName = biz.company_name || companyName;
        companyEmail = biz.company_email || companyEmail;
        companyPhone = biz.company_phone || null;
      }
    }

    let finalHtml = rawBodyContent;
    const isFullHtmlDoc = /^\s*<!doctype|^\s*<html/i.test(rawBodyContent);
    if (!isFullHtmlDoc) {
      const fragmentHtml =
        plain_text || (!/<[a-z][\s\S]*>/i.test(rawBodyContent) && typeof html !== "string")
          ? `<p>${escapeHtml(rawBodyContent).replace(/\n/g, "<br/>")}</p>`
          : rawBodyContent;
      finalHtml = renderBrandedEmailHtml({
        companyName,
        companyEmail,
        companyPhone,
        title: cleanSubject,
        bodyHtml: fragmentHtml,
        ctaLabel,
        ctaUrl,
      });
    }

    const result = await sendMailWithConfig(smtp, {
      to: recipient,
      subject: cleanSubject,
      html: finalHtml,
      attachments,
    });

    if (attachedDoc && attachedDoc.type === "quotation" && mark_sent !== false) {
      await prisma.quotations.updateMany({
        where: { id: attachedDoc.id, status: "draft" },
        data: { status: "sent", updated_at: new Date() },
      });
    }

    if (attachedDoc) {
      await pool.query(
        `INSERT INTO public.system_audit_log (user_id, action, module, entity_type, entity_id, details, ip_address)
         VALUES ($1::uuid, $2, $3, $4, $5::uuid, $6::jsonb, $7)`,
        [
          req.user?.id ?? null,
          `${attachedDoc.type}_emailed`,
          attachedDoc.type === "challan" ? "logistics" : "sales",
          attachedDoc.type,
          attachedDoc.id,
          JSON.stringify({ to: recipient, subject: cleanSubject, doc_number: attachedDoc.docNumber, message_id: result.messageId }),
          getClientIp(req),
        ]
      );
    }

    return ok(res, { success: true, messageId: result.messageId });
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

    // Try WhatsApp first (supports OpenWA, Evolution API v2, and Meta Official API)
    const settings = await getSettings();
    const waCfg = resolveWhatsappConfig(
      {
        whatsapp_api_url: settings.whatsapp_api_url as string | null,
        whatsapp_api_key: settings.whatsapp_api_key as string | null,
        whatsapp_phone_id: settings.whatsapp_phone_id as string | null,
        integrations: (settings.integrations as Record<string, unknown>) || null,
      },
      env
    );
    if (waCfg.configured) {
      const waResult = await sendWhatsAppMessage({ to: phone, message: messageBody });
      if (waResult.success) {
        sent = true;
        channel = "whatsapp";
        waMessageId = waResult.waMessageId ?? null;
        await recordOutboundWhatsappChatMessage(pool, {
          phone,
          senderId: req.user?.id ?? null,
          customerName: typeof variables?.customer_name === "string" ? variables.customer_name : null,
          content: messageBody,
          waMessageId,
        }).catch(() => {});
      } else {
        console.error("[whatsapp-automation] WhatsApp error:", waResult.error);
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
  try {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const settings = await getSettings();
    const cfg = resolveWhatsappConfig(
      {
        whatsapp_api_url: settings.whatsapp_api_url as string | null,
        whatsapp_api_key: settings.whatsapp_api_key as string | null,
        whatsapp_phone_id: settings.whatsapp_phone_id as string | null,
        integrations: (settings.integrations as Record<string, unknown>) || null,
      },
      env
    );

    // Meta Official Cloud API webhook payload
    if (body.object === "whatsapp_business_account" || Array.isArray(body.entry)) {
      const entries = (body.entry as Record<string, unknown>[]) ?? [];
      const inboundList: NormalizedInboundMessage[] = [];
      const statusList: NormalizedStatusUpdate[] = [];

      for (const entry of entries) {
        const changes = (entry?.changes as Record<string, unknown>[]) ?? [];
        for (const change of changes) {
          const value = change?.value as Record<string, unknown> | undefined;
          if (!value) continue;

          const contacts = Array.isArray(value.contacts)
            ? (value.contacts as Record<string, unknown>[])
            : [];
          const contactNameByWaId = new Map<string, string>();
          for (const c of contacts) {
            const waId = String(c.wa_id ?? "");
            const profName = String(((c.profile as Record<string, unknown>)?.name ?? "")).trim();
            if (waId && profName) contactNameByWaId.set(waId, profName);
          }

          const messages = (value.messages as Record<string, unknown>[]) ?? [];
          for (const msg of messages) {
            const fromRaw = String(msg.from ?? "");
            const fromPhone = normalizeWhatsappNumber(fromRaw);
            const last10 = normalizePhoneLast10(fromPhone);
            if (!last10 || last10.length < 7) continue;

            const messageType = (msg.type as string) || "text";
            const messageBody =
              ((msg.text as Record<string, unknown>)?.body as string) ||
              (msg.caption as string) ||
              `[${messageType}]`;
            const waTimestamp = msg.timestamp
              ? new Date(parseInt(String(msg.timestamp), 10) * 1000).toISOString()
              : new Date().toISOString();

            inboundList.push({
              externalId: String(msg.id ?? `meta-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`),
              fromPhone,
              last10,
              senderName: contactNameByWaId.get(fromRaw),
              text: messageBody,
              timestampIso: waTimestamp,
            });
          }

          const statuses = (value.statuses as Record<string, unknown>[]) ?? [];
          for (const s of statuses) {
            const st = String(s.status ?? "").toLowerCase();
            if ((st === "sent" || st === "delivered" || st === "read" || st === "failed") && s.id) {
              statusList.push({ externalId: String(s.id), status: st });
            }
          }
        }
      }

      if (inboundList.length > 0) await syncInboundWhatsappMessages(pool, inboundList);
      if (statusList.length > 0) await syncWhatsappDeliveryStatuses(pool, statusList);
      return res.json({ success: true, provider: "meta", processed: inboundList.length });
    }

    // OpenWA / Evolution API v2 webhook payload — enforce configured HMAC / secret header
    const verdict = verifyGatewayWebhook({
      secret: cfg.webhookSecret,
      headers: req.headers,
      rawBody: (req as Request & { rawBody?: Buffer }).rawBody,
      bodyText: JSON.stringify(body),
    });
    if (!verdict.ok) {
      return res.status(401).json({ success: false, error: verdict.reason || "Invalid webhook signature" });
    }

    const parsed = parseGatewayWebhookPayload(body);
    if (parsed.kind === "inbound_messages") {
      const summary = await syncInboundWhatsappMessages(pool, parsed.messages);
      return res.json({ success: true, provider: cfg.provider, ...summary });
    }
    if (parsed.kind === "status_updates") {
      const updated = await syncWhatsappDeliveryStatuses(pool, parsed.updates);
      return res.json({ success: true, provider: cfg.provider, updated });
    }
    return res.json({ success: true, provider: cfg.provider, kind: parsed.kind });
  } catch (e) {
    if (isDatabaseUnavailable(e)) throw e;
    console.error("[whatsapp-webhook] error:", e);
    return res.json({ success: true });
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

      if (amount > 0) {
        const client = await pool.connect();
        try {
          await client.query("BEGIN");
          await recordFinanceSync(client, {
            entry_source: "razorpay",
            source_id: `rzp:${payment?.id || paymentLinkId || Date.now()}`,
            type: "income",
            amount,
            payment_mode: "razorpay",
            category_name: "Invoice Sales",
            reference: invoiceId || paymentLinkId || payment?.id || null,
            description: `Razorpay ${eventType}${invoiceId ? ` · Invoice ${invoiceId}` : ""}`,
            staff_name: "Razorpay Webhook",
          });
          await client.query("COMMIT");
        } catch (syncErr) {
          await client.query("ROLLBACK").catch(() => {});
          console.warn("[razorpay-webhook] finance sync failed:", (syncErr as Error).message);
        } finally {
          client.release();
        }
      }

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

const POD_PHOTO_PATH_RE = /^\/api\/backend\/storage\/files\/uploads\/pod\/[A-Za-z0-9._-]+$/;

// ---------------------------------------------------------------------------
// document-pdf — Vector A4 Branded ALVStore PDF (Quotations, Invoices, Challans)
// ---------------------------------------------------------------------------
functionsRouter.get("/document-pdf", asyncHandler(async (req, res) => {
  try {
    const docType = String(req.query.type ?? "").toLowerCase() as BrandedDocumentType;
    const id = typeof req.query.id === "string" ? req.query.id.trim() : "";
    const token = typeof req.query.token === "string" ? req.query.token.trim() : "";
    const download = req.query.download === "1" || req.query.download === "true";

    if (!["quotation", "invoice", "challan"].includes(docType)) {
      return fail(res, "Query parameter 'type' must be quotation, invoice, or challan", 400);
    }

    if (!token) {
      if (!req.user) return fail(res, "Unauthorized", 401);
      if (!hasStaffRole(req)) return fail(res, "Staff access required", 403);
      if (!id || !DOC_UUID_RE.test(id)) return fail(res, "Valid 'id' or 'token' is required", 400);
    } else if (!DOC_UUID_RE.test(token)) {
      return fail(res, "Valid 'token' UUID is required", 400);
    }

    const loaded = await loadDocumentForPdf(docType, token ? { token } : { id });
    if (!loaded) return fail(res, `${docType} not found`, 404);

    const pdfBytes = await buildBrandedDocumentPdf(loaded.pdfInput);
    const safeFilename = loaded.filename.replace(/[^A-Za-z0-9._-]/g, "_");
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `${download ? "attachment" : "inline"}; filename="${safeFilename}"`);
    res.setHeader("Cache-Control", "no-store");
    return res.send(Buffer.from(pdfBytes));
  } catch (e) {
    if (isDatabaseUnavailable(e)) throw e;
    return fail(res, (e as Error).message, 500);
  }
}));

// ---------------------------------------------------------------------------
// public-quotation-view — token-gated public view counter
// ---------------------------------------------------------------------------
functionsRouter.post("/public-quotation-view", asyncHandler(async (req, res) => {
  try {
    const token = typeof req.body?.token === "string" ? req.body.token.trim() : "";
    if (!token || !DOC_UUID_RE.test(token)) return fail(res, "Valid quotation token required", 400);
    const existing = await prisma.quotations.findFirst({
      where: { public_token: token },
      select: { id: true, view_count: true },
    });
    if (!existing) return fail(res, "Quotation not found", 404);
    const updated = await prisma.quotations.update({
      where: { id: existing.id },
      data: {
        view_count: (existing.view_count ?? 0) + 1,
        last_viewed_at: new Date(),
      },
      select: { view_count: true, last_viewed_at: true },
    });
    return ok(res, { success: true, ...updated });
  } catch (e) {
    if (isDatabaseUnavailable(e)) throw e;
    return fail(res, (e as Error).message, 500);
  }
}));

// ---------------------------------------------------------------------------
// public-quotation-respond — token-gated atomic customer accept / reject
// ---------------------------------------------------------------------------
functionsRouter.post("/public-quotation-respond", asyncHandler(async (req, res) => {
  try {
    const token = typeof req.body?.token === "string" ? req.body.token.trim() : "";
    const action = typeof req.body?.action === "string" ? req.body.action.trim().toLowerCase() : "";
    const signatureName = typeof req.body?.signature_name === "string" ? req.body.signature_name.trim() : "";
    const signatureData = typeof req.body?.signature_data === "string" ? req.body.signature_data.trim() : "";
    const rejectionReason = typeof req.body?.rejection_reason === "string" ? req.body.rejection_reason.trim() : "";

    if (!token || !DOC_UUID_RE.test(token)) return fail(res, "Valid quotation token required", 400);

    const q = await prisma.quotations.findFirst({
      where: { public_token: token },
      include: { r_customers: { select: { name: true } } },
    });
    if (!q) return fail(res, "Quotation not found", 404);

    const check = validatePublicQuotationResponse({
      status: String(q.status),
      validUntil: q.valid_until,
      action,
      signatureName,
      signatureData,
    });
    if (!check.ok) {
      return res.status(check.status).json({ error: check.message, code: check.code, success: false });
    }

    const clientIp = getClientIp(req);
    const now = new Date();
    const targetStatus = action === "accept" ? "accepted" : "rejected";

    const updated = await prisma.quotations.updateMany({
      where: { id: q.id, status: { in: ["draft", "sent"] } },
      data: {
        status: targetStatus,
        signature_name: action === "accept" ? signatureName : null,
        signature_data: action === "accept" ? signatureData : null,
        signed_at: action === "accept" ? now : null,
        responded_at: now,
        signed_ip: clientIp,
        rejection_reason: action === "reject" ? rejectionReason || null : null,
        updated_at: now,
      },
    });
    if (updated.count === 0) {
      return res.status(409).json({ error: "Quotation has already been responded to", code: "ALREADY_RESPONDED", success: false });
    }

    await pool.query(
      `INSERT INTO public.system_audit_log (action, module, entity_type, entity_id, details, ip_address)
       VALUES ($1, 'sales', 'quotation', $2::uuid, $3::jsonb, $4)`,
      [
        action === "accept" ? "quotation_accepted" : "quotation_rejected",
        q.id,
        JSON.stringify({
          quotation_number: q.quotation_number,
          signature_name: signatureName || null,
          rejection_reason: rejectionReason || null,
        }),
        clientIp,
      ]
    );

    await notifyStaffAndCreator({
      createdBy: q.created_by,
      type: "quotation",
      title:
        action === "accept"
          ? `Quotation Accepted — ${q.quotation_number}`
          : `Quotation Declined — ${q.quotation_number}`,
      message:
        action === "accept"
          ? `${q.r_customers?.name || signatureName || "Customer"} digitally signed ${q.quotation_number}`
          : `${q.r_customers?.name || "Customer"} declined ${q.quotation_number}${rejectionReason ? `: ${rejectionReason}` : ""}`,
      link: `/sales/${q.id}`,
      metadata: { quotation_id: q.id, action },
    });

    return ok(res, {
      success: true,
      status: targetStatus,
      responded_at: now.toISOString(),
      signed_at: action === "accept" ? now.toISOString() : null,
    });
  } catch (e) {
    if (isDatabaseUnavailable(e)) throw e;
    return fail(res, (e as Error).message, 500);
  }
}));

// ---------------------------------------------------------------------------
// document-stock — idempotent inventory deduction/restore for Invoice & Challan
// ---------------------------------------------------------------------------
functionsRouter.post("/document-stock", requireStaff, asyncHandler(async (req, res) => {
  try {
    const docType = String(req.body?.doc_type ?? "").toLowerCase();
    const docId = String(req.body?.doc_id ?? "");
    const targetStatus = typeof req.body?.target_status === "string" ? req.body.target_status : undefined;
    const mode = req.body?.mode === "deduct" || req.body?.mode === "reverse" ? req.body.mode : undefined;
    const note = typeof req.body?.note === "string" ? req.body.note : undefined;

    if (docType !== "invoice" && docType !== "challan") {
      return fail(res, "doc_type must be 'invoice' or 'challan'", 400);
    }
    if (!DOC_UUID_RE.test(docId)) {
      return fail(res, "Valid doc_id UUID required", 400);
    }

    const result = await prisma.$transaction((tx) =>
      syncDocumentStock(tx, {
        docType,
        docId,
        targetStatus,
        explicitMode: mode,
        userId: req.user?.id ?? null,
        note,
      })
    );
    return ok(res, { success: true, ...result });
  } catch (e) {
    if (isDatabaseUnavailable(e)) throw e;
    return fail(res, (e as Error).message, 500);
  }
}));

// ---------------------------------------------------------------------------
// challan-transition — atomic milestone update, timeline append & stock ledger
// ---------------------------------------------------------------------------
functionsRouter.post("/challan-transition", requireStaff, asyncHandler(async (req, res) => {
  try {
    const body = req.body ?? {};
    const challanId = String(body.challan_id ?? "");
    const targetStatus = String(body.target_status ?? "").toLowerCase();
    const note = typeof body.note === "string" ? body.note.trim() : undefined;

    if (!DOC_UUID_RE.test(challanId)) return fail(res, "Valid challan_id UUID required", 400);
    if (!CHALLAN_VALID_STATUSES.has(targetStatus)) return fail(res, `Unsupported challan status: ${targetStatus}`, 400);

    const out = await prisma.$transaction(async (tx) => {
      const existing = await tx.deliveryChallans.findUnique({ where: { id: challanId } });
      if (!existing) throw Object.assign(new Error("Delivery challan not found"), { httpStatus: 404 });

      const now = new Date();
      const nextTimeline = appendChallanTimeline(existing.timeline, {
        status: targetStatus,
        note,
        by: req.user?.email || "Staff",
      });

      const isDispatchState = ["sent", "dispatched", "in_transit", "out_for_delivery", "delivered"].includes(targetStatus);
      const data: Record<string, unknown> = {
        status: targetStatus,
        timeline: nextTimeline as unknown as object,
        updated_at: now,
      };
      if (isDispatchState && !existing.dispatched_at) data.dispatched_at = now;
      if (targetStatus === "delivered" && !existing.delivered_at) data.delivered_at = now;

      const optionalStringFields = [
        "courier_name",
        "tracking_number",
        "tracking_url",
        "eway_bill_number",
        "delivery_person",
        "vehicle_number",
        "receiver_name",
        "receiver_phone",
        "receiver_signature",
        "pod_photo_url",
      ] as const;
      for (const field of optionalStringFields) {
        if (field in body) {
          const val = typeof body[field] === "string" && body[field].trim() ? body[field].trim() : null;
          if (field === "pod_photo_url" && val && !POD_PHOTO_PATH_RE.test(val)) {
            throw Object.assign(new Error("Invalid POD photo path"), { httpStatus: 400 });
          }
          data[field] = val;
        }
      }
      if ("expected_delivery_at" in body) {
        if (body.expected_delivery_at) {
          const parsed = new Date(String(body.expected_delivery_at));
          if (Number.isNaN(parsed.getTime())) {
            throw Object.assign(new Error("Invalid expected_delivery_at date"), { httpStatus: 400 });
          }
          data.expected_delivery_at = parsed;
        } else {
          data.expected_delivery_at = null;
        }
      }

      const challan = await tx.deliveryChallans.update({
        where: { id: challanId },
        data: data as any,
      });

      const stock = await syncDocumentStock(tx, {
        docType: "challan",
        docId: challanId,
        targetStatus,
        userId: req.user?.id ?? null,
        note,
      });

      return { challan, stock };
    });

    await pool.query(
      `INSERT INTO public.system_audit_log (user_id, action, module, entity_type, entity_id, details, ip_address)
       VALUES ($1::uuid, $2, 'logistics', 'delivery_challan', $3::uuid, $4::jsonb, $5)`,
      [
        req.user?.id ?? null,
        `challan_${targetStatus}`,
        challanId,
        JSON.stringify({ note: note || null, stock: out.stock }),
        getClientIp(req),
      ]
    );

    return ok(res, { success: true, challan: out.challan, stock: out.stock });
  } catch (e) {
    if (isDatabaseUnavailable(e)) throw e;
    const status = (e as { httpStatus?: number }).httpStatus || 500;
    return fail(res, (e as Error).message, status);
  }
}));

// ---------------------------------------------------------------------------
// public-challan-pod-upload — token-validated POD photo upload (max 5 MB)
// ---------------------------------------------------------------------------
functionsRouter.post("/public-challan-pod-upload", (req, res) => {
  podUpload.single("file")(req, res, (err) => {
    void (async () => {
      try {
        if (err) return fail(res, (err as Error).message || "Upload rejected", 400);
        const token = typeof req.body?.token === "string" ? req.body.token.trim() : "";
        if (!token || !DOC_UUID_RE.test(token)) return fail(res, "Valid challan token required", 400);

        const ch = await prisma.deliveryChallans.findFirst({
          where: { public_token: token },
          select: { id: true, status: true },
        });
        if (!ch) return fail(res, "Delivery challan not found", 404);
        if (!CHALLAN_POD_ALLOWED_STATUSES.has(String(ch.status))) {
          return fail(res, "POD photo upload is only allowed for dispatched challans", 409);
        }

        const file = req.file;
        if (!file || !file.buffer?.length) return fail(res, "Image file is required", 400);
        const b = file.buffer;
        const isPng = b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47;
        const isJpg = b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
        const isWebp =
          b.length >= 12 && b.toString("ascii", 0, 4) === "RIFF" && b.toString("ascii", 8, 12) === "WEBP";
        if (!isPng && !isJpg && !isWebp) {
          return fail(res, "File content must be a valid PNG, JPEG, or WebP image", 400);
        }

        const ext = isPng ? "png" : isJpg ? "jpg" : "webp";
        fs.mkdirSync(POD_UPLOAD_DIR, { recursive: true });
        const filename = `${ch.id}-${crypto.randomUUID()}.${ext}`;
        fs.writeFileSync(path.join(POD_UPLOAD_DIR, filename), file.buffer);
        return ok(res, { success: true, url: publicUrl("uploads", `pod/${filename}`) });
      } catch (e) {
        if (isDatabaseUnavailable(e)) return fail(res, "Database unavailable", 503);
        return fail(res, (e as Error).message, 500);
      }
    })();
  });
});

// ---------------------------------------------------------------------------
// public-challan-pod — contactless receiver POD signature + delivery confirm
// ---------------------------------------------------------------------------
functionsRouter.post("/public-challan-pod", asyncHandler(async (req, res) => {
  try {
    const token = typeof req.body?.token === "string" ? req.body.token.trim() : "";
    const receiverName = typeof req.body?.receiver_name === "string" ? req.body.receiver_name.trim() : "";
    const receiverPhone = typeof req.body?.receiver_phone === "string" ? req.body.receiver_phone.trim() : "";
    const receiverSignature =
      typeof req.body?.receiver_signature === "string" ? req.body.receiver_signature.trim() : "";
    const podPhotoUrl = typeof req.body?.pod_photo_url === "string" ? req.body.pod_photo_url.trim() : "";

    if (!token || !DOC_UUID_RE.test(token)) return fail(res, "Valid challan token required", 400);
    if (!receiverName) return fail(res, "Receiver full name is required", 400);
    if (!receiverSignature.startsWith("data:image/")) {
      return fail(res, "Receiver digital signature is required", 400);
    }
    if (podPhotoUrl && !POD_PHOTO_PATH_RE.test(podPhotoUrl)) {
      return fail(res, "Invalid POD photo path", 400);
    }

    const ch = await prisma.deliveryChallans.findFirst({
      where: { public_token: token },
      include: { r_customers: { select: { name: true } } },
    });
    if (!ch) return fail(res, "Delivery challan not found", 404);
    if (!CHALLAN_POD_ALLOWED_STATUSES.has(String(ch.status))) {
      return res.status(409).json({
        error: `Delivery POD cannot be captured when challan is '${ch.status}'`,
        success: false,
      });
    }

    const now = new Date();
    const clientIp = getClientIp(req);
    const nextTimeline = appendChallanTimeline(ch.timeline, {
      status: "delivered",
      note: `Contactless POD signed by ${receiverName}${receiverPhone ? ` (${receiverPhone})` : ""}`,
      by: receiverName,
      at: now.toISOString(),
    });

    const stock = await prisma.$transaction(async (tx) => {
      const updated = await tx.deliveryChallans.updateMany({
        where: { id: ch.id, status: { in: Array.from(CHALLAN_POD_ALLOWED_STATUSES) } },
        data: {
          status: "delivered",
          receiver_name: receiverName,
          receiver_phone: receiverPhone || null,
          receiver_signature: receiverSignature,
          pod_photo_url: podPhotoUrl || null,
          delivered_at: now,
          dispatched_at: ch.dispatched_at ?? now,
          timeline: nextTimeline as unknown as object,
          updated_at: now,
        },
      });
      if (updated.count === 0) {
        throw Object.assign(new Error("Delivery POD has already been completed"), { httpStatus: 409 });
      }
      return await syncDocumentStock(tx, {
        docType: "challan",
        docId: ch.id,
        targetStatus: "delivered",
        note: `POD confirmed by ${receiverName}`,
      });
    });

    await pool.query(
      `INSERT INTO public.system_audit_log (action, module, entity_type, entity_id, details, ip_address)
       VALUES ('challan_pod_captured', 'logistics', 'delivery_challan', $1::uuid, $2::jsonb, $3)`,
      [
        ch.id,
        JSON.stringify({ challan_number: ch.challan_number, receiver_name: receiverName, pod_photo_url: podPhotoUrl || null }),
        clientIp,
      ]
    );

    await notifyStaffAndCreator({
      createdBy: ch.created_by,
      type: "logistics",
      title: `Delivery POD Confirmed — ${ch.challan_number}`,
      message: `${receiverName} signed proof of delivery for ${ch.challan_number} (${ch.r_customers?.name || "Customer"})`,
      link: `/challans/${ch.id}`,
      metadata: { challan_id: ch.id, receiver_name: receiverName },
    });

    return ok(res, {
      success: true,
      status: "delivered",
      delivered_at: now.toISOString(),
      stock,
      timeline: nextTimeline,
    });
  } catch (e) {
    if (isDatabaseUnavailable(e)) throw e;
    const status = (e as { httpStatus?: number }).httpStatus || 500;
    return fail(res, (e as Error).message, status);
  }
}));

// ---------------------------------------------------------------------------
// finance-sync — idempotent multi-channel ledger & cash drawer synchronization
// ---------------------------------------------------------------------------
const ALLOWED_FIN_SOURCES = new Set<FinanceEntrySource>([
  "manual",
  "pos",
  "invoice",
  "payment",
  "payment_register",
  "repair",
  "purchase_bill",
  "supplier",
  "technician",
  "payroll",
  "advance",
  "advance_refund",
  "razorpay",
]);

functionsRouter.post("/finance-sync", requireStaff, asyncHandler(async (req, res) => {
  const body = req.body ?? {};
  const amount = Number(body.amount);
  const type = body.type === "expense" ? "expense" : body.type === "income" ? "income" : null;
  if (!type) return fail(res, "type must be income or expense", 400);
  if (!Number.isFinite(amount) || amount <= 0) return fail(res, "amount must be greater than zero", 400);

  const entrySourceRaw = String(body.entry_source || "manual").trim() as FinanceEntrySource;
  const entrySource: FinanceEntrySource = ALLOWED_FIN_SOURCES.has(entrySourceRaw) ? entrySourceRaw : "manual";
  if (body.account_id && !DOC_UUID_RE.test(String(body.account_id))) return fail(res, "Invalid account_id", 400);
  if (body.category_id && !DOC_UUID_RE.test(String(body.category_id))) return fail(res, "Invalid category_id", 400);
  if (body.customer_id && !DOC_UUID_RE.test(String(body.customer_id))) return fail(res, "Invalid customer_id", 400);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await recordFinanceSync(client, {
      entry_source: entrySource,
      source_id: typeof body.source_id === "string" ? body.source_id : null,
      type,
      amount,
      date: typeof body.date === "string" ? body.date : undefined,
      payment_mode: typeof body.payment_mode === "string" ? body.payment_mode : "cash",
      account_id: body.account_id || null,
      category_name: typeof body.category_name === "string" ? body.category_name : null,
      category_id: body.category_id || null,
      customer_id: body.customer_id || null,
      reference: typeof body.reference === "string" ? body.reference : null,
      description: typeof body.description === "string" ? body.description : null,
      staff_name: typeof body.staff_name === "string" ? body.staff_name : req.user?.email || null,
      user_id: req.user?.id || null,
      sync_cash_control: body.sync_cash_control !== false,
    });
    await client.query("COMMIT");
    return ok(res, { success: true, ...result });
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    if (isDatabaseUnavailable(e)) throw e;
    return fail(res, (e as Error).message, 500);
  } finally {
    client.release();
  }
}));

// ---------------------------------------------------------------------------
// cash-control-context — carry-forward baseline, non-cash split & chain audit
// ---------------------------------------------------------------------------
functionsRouter.get("/cash-control-context", requireStaff, asyncHandler(async (req, res) => {
  try {
    const targetDate = normalizeDateKey(typeof req.query.date === "string" ? req.query.date : undefined);
    const [priorRes, allDaysRes, nonCashRes] = await Promise.all([
      pool.query<Record<string, unknown>>(
        `SELECT * FROM public.daily_cash_control WHERE date < $1::date ORDER BY date DESC LIMIT 1`,
        [targetDate]
      ),
      pool.query<Record<string, unknown>>(
        `SELECT * FROM public.daily_cash_control ORDER BY date DESC LIMIT 120`
      ),
      pool.query<{ type: string; payment_mode: string | null; total: string }>(
        `SELECT ft.type, COALESCE(ft.payment_mode, fa.type, 'bank') AS payment_mode, COALESCE(SUM(ft.amount), 0) AS total
         FROM public.finance_transactions ft
         LEFT JOIN public.finance_accounts fa ON fa.id = ft.account_id
         WHERE ft.date = $1::date
           AND ft.type IN ('income', 'expense')
           AND (fa.type IS DISTINCT FROM 'cash')
           AND (fa.type = 'bank' OR LOWER(COALESCE(ft.payment_mode, '')) NOT IN ('cash', 'petty_cash', 'drawer', ''))
         GROUP BY ft.type, COALESCE(ft.payment_mode, fa.type, 'bank')`,
        [targetDate]
      ),
    ]);

    const prior = priorRes.rows[0] ?? null;
    const suggestedOpening = prior
      ? Number(prior.closing_cash ?? prior.expected_closing ?? prior.opening_cash ?? 0)
      : 0;

    const chainAudit = auditCarryForwardChain(
      allDaysRes.rows.map((r) => ({
        date: normalizeDateKey(String(r.date)),
        opening_cash: Number(r.opening_cash || 0),
        closing_cash: r.closing_cash != null ? Number(r.closing_cash) : null,
        expected_closing: r.expected_closing != null ? Number(r.expected_closing) : null,
        pos_total: Number(r.pos_total || 0),
        auto_income: Number(r.auto_income || 0),
        manual_income: Number(r.manual_income || 0),
        transfer_in: Number(r.transfer_in || 0),
        auto_expense: Number(r.auto_expense || 0),
        manual_expense: Number(r.manual_expense || 0),
        transfer_out: Number(r.transfer_out || 0),
        status: String(r.status || "open"),
        opening_override_reason: (r.opening_override_reason as string | null) ?? null,
      }))
    );

    // Check closed days in the last 30 days for post-close ledger mutations
    const postCloseAlerts: Record<string, { liveExpected: number; savedExpected: number; delta: number }> = {};
    for (const row of allDaysRes.rows.slice(0, 30)) {
      if (row.status !== "closed") continue;
      const dk = normalizeDateKey(String(row.date));
      const agg = await aggregateCashMovementsForDate(pool, dk);
      const liveHasTxns =
        agg.pos_total + agg.auto_income + agg.manual_income + agg.auto_expense + agg.manual_expense + agg.transfer_in + agg.transfer_out > 0;
      if (!liveHasTxns) continue;
      const liveExpected = computeCashDayExpectedClosing({ opening_cash: Number(row.opening_cash || 0), ...agg });
      const savedExpected = row.expected_closing != null
        ? Number(row.expected_closing)
        : computeCashDayExpectedClosing(row as any);
      const delta = Math.round((liveExpected - savedExpected) * 100) / 100;
      if (Math.abs(delta) >= 0.01) {
        postCloseAlerts[dk] = { liveExpected, savedExpected, delta };
      }
    }

    let nonCashIncome = 0;
    let nonCashExpense = 0;
    const channelBreakdown: Record<string, { income: number; expense: number }> = {};
    for (const r of nonCashRes.rows) {
      const val = Number(r.total || 0);
      const mode = String(r.payment_mode || "bank").toLowerCase();
      if (!channelBreakdown[mode]) channelBreakdown[mode] = { income: 0, expense: 0 };
      if (r.type === "income") {
        nonCashIncome += val;
        channelBreakdown[mode].income += val;
      } else {
        nonCashExpense += val;
        channelBreakdown[mode].expense += val;
      }
    }

    return ok(res, {
      targetDate,
      previousDay: prior
        ? {
            date: normalizeDateKey(String(prior.date)),
            status: prior.status,
            opening_cash: Number(prior.opening_cash || 0),
            closing_cash: prior.closing_cash != null ? Number(prior.closing_cash) : null,
            expected_closing: prior.expected_closing != null ? Number(prior.expected_closing) : null,
          }
        : null,
      suggestedOpening,
      nonCashSummary: {
        income: Math.round(nonCashIncome * 100) / 100,
        expense: Math.round(nonCashExpense * 100) / 100,
        net: Math.round((nonCashIncome - nonCashExpense) * 100) / 100,
        byChannel: channelBreakdown,
      },
      chainAudit,
      postCloseAlerts,
    });
  } catch (e) {
    if (isDatabaseUnavailable(e)) throw e;
    return fail(res, (e as Error).message, 500);
  }
}));

// ---------------------------------------------------------------------------
// cash-control-recompute — recomputes open day or admin-reopens closed day
// ---------------------------------------------------------------------------
functionsRouter.post("/cash-control-recompute", requireStaff, asyncHandler(async (req, res) => {
  const body = req.body ?? {};
  const dateKey = normalizeDateKey(typeof body.date === "string" ? body.date : undefined);
  const reopen = Boolean(body.reopen);
  const reason = typeof body.reason === "string" ? body.reason.trim() : "";

  if (reopen) {
    if (!req.user?.roles.includes("admin")) {
      return fail(res, "Admin role required to reopen a closed day", 403);
    }
    if (!reason) return fail(res, "Reopen reason is required", 400);
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    if (reopen) {
      await client.query(
        `UPDATE public.daily_cash_control
         SET status = 'open', reopened_by = $2::uuid, reopened_at = now()
         WHERE date = $1::date`,
        [dateKey, req.user?.id || null]
      );
      await client.query(
        `INSERT INTO public.finance_audit_log (action, entity_type, details, staff_name, user_id)
         VALUES ('DAY_REOPENED', 'cash_control', $1, $2, $3::uuid)`,
        [`Day ${dateKey} reopened for reconciliation. Reason: ${reason}`, req.user?.email || "Admin", req.user?.id || null]
      );
    }

    const updated = await syncDailyCashForDate(client, dateKey, {
      userId: req.user?.id || null,
      staffName: req.user?.email || null,
      allowCreate: Boolean(body.allow_create),
    });
    await client.query("COMMIT");
    return ok(res, { success: true, record: updated });
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    if (isDatabaseUnavailable(e)) throw e;
    return fail(res, (e as Error).message, 500);
  } finally {
    client.release();
  }
}));

// ---------------------------------------------------------------------------
// cashflow-audit-pdf — Branded A4 Period Cash Flow & Daily Control Report
// ---------------------------------------------------------------------------
functionsRouter.get("/cashflow-audit-pdf", requireStaff, asyncHandler(async (req, res) => {
  try {
    const toDate = normalizeDateKey(typeof req.query.to === "string" ? req.query.to : undefined);
    const fromDefault = `${toDate.slice(0, 8)}01`;
    const fromDate = normalizeDateKey(typeof req.query.from === "string" ? req.query.from : fromDefault);
    const entrySourceFilter = typeof req.query.entry_source === "string" ? req.query.entry_source : "all";
    const channelFilter = typeof req.query.channel === "string" ? req.query.channel : "all";
    const download = req.query.download === "1" || req.query.download === "true";

    const [business, daysRes, txRes] = await Promise.all([
      getSettings(),
      pool.query<Record<string, unknown>>(
        `SELECT * FROM public.daily_cash_control WHERE date >= $1::date AND date <= $2::date ORDER BY date ASC`,
        [fromDate, toDate]
      ),
      pool.query<Record<string, unknown>>(
        `SELECT ft.*, fa.name AS account_name, fa.type AS account_type, fc.name AS category_name
         FROM public.finance_transactions ft
         LEFT JOIN public.finance_accounts fa ON fa.id = ft.account_id
         LEFT JOIN public.finance_categories fc ON fc.id = ft.category_id
         WHERE ft.date >= $1::date AND ft.date <= $2::date
         ORDER BY ft.date ASC, ft.created_at ASC`,
        [fromDate, toDate]
      ),
    ]);

    const filteredTx = txRes.rows.filter((t) => {
      if (entrySourceFilter === "manual" && t.entry_source !== "manual") return false;
      if (entrySourceFilter === "auto" && (!t.entry_source || t.entry_source === "manual")) return false;
      const isCash = t.account_type === "cash" || String(t.payment_mode || "").toLowerCase() === "cash";
      if (channelFilter === "cash" && !isCash) return false;
      if (channelFilter === "bank" && isCash) return false;
      return true;
    });

    const pdfBytes = await buildCashflowAuditPdf({
      business: business as any,
      fromDate,
      toDate,
      days: daysRes.rows.map((d) => ({
        date: normalizeDateKey(String(d.date)),
        status: String(d.status || "open"),
        opening_cash: Number(d.opening_cash || 0),
        pos_total: Number(d.pos_total || 0),
        auto_income: Number(d.auto_income || 0),
        manual_income: Number(d.manual_income || 0),
        transfer_in: Number(d.transfer_in || 0),
        auto_expense: Number(d.auto_expense || 0),
        manual_expense: Number(d.manual_expense || 0),
        transfer_out: Number(d.transfer_out || 0),
        expected_closing: d.expected_closing != null ? Number(d.expected_closing) : null,
        closing_cash: d.closing_cash != null ? Number(d.closing_cash) : null,
        difference: d.difference != null ? Number(d.difference) : null,
        staff_name: (d.staff_name as string | null) ?? null,
        notes: (d.notes as string | null) ?? null,
      })),
      transactions: filteredTx.map((t) => ({
        transaction_id: String(t.transaction_id || "FIN"),
        date: normalizeDateKey(String(t.date)),
        type: String(t.type || "income"),
        entry_source: String(t.entry_source || "manual"),
        payment_mode: (t.payment_mode as string | null) ?? null,
        amount: Number(t.amount || 0),
        account_name: (t.account_name as string | null) ?? null,
        category_name: (t.category_name as string | null) ?? null,
        reference: (t.reference as string | null) ?? null,
        description: (t.description as string | null) ?? null,
        staff_name: (t.staff_name as string | null) ?? null,
      })),
    });

    const filename = `ALVStore-CashFlow-Audit-${fromDate}-to-${toDate}.pdf`;
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `${download ? "attachment" : "inline"}; filename="${filename}"`);
    res.setHeader("Cache-Control", "no-store");
    return res.send(Buffer.from(pdfBytes));
  } catch (e) {
    if (isDatabaseUnavailable(e)) throw e;
    return fail(res, (e as Error).message, 500);
  }
}));

// ---------------------------------------------------------------------------
// employee-advance-issue / cancel — Admin advance lifecycle + finance sync
// ---------------------------------------------------------------------------
functionsRouter.post("/employee-advance-issue", requireAuth, requireRole("admin"), asyncHandler(async (req, res) => {
  const body = req.body ?? {};
  const employeeId = typeof body.employee_id === "string" ? body.employee_id.trim() : "";
  const amount = Number(body.amount);
  const paymentMode = typeof body.payment_mode === "string" ? body.payment_mode.trim().toLowerCase() : "cash";
  const accountId = typeof body.account_id === "string" && DOC_UUID_RE.test(body.account_id) ? body.account_id : null;
  const advanceDate = normalizeDateKey(typeof body.advance_date === "string" ? body.advance_date : undefined);
  const reason = typeof body.reason === "string" ? body.reason.trim() : "";
  const notes = typeof body.notes === "string" ? body.notes.trim() : "";
  const staffName = typeof body.staff_name === "string" ? body.staff_name.trim() : req.user?.email || "Admin";

  if (!DOC_UUID_RE.test(employeeId)) return fail(res, "Valid employee_id required", 400);
  if (!Number.isFinite(amount) || amount <= 0) return fail(res, "Advance amount must be greater than zero", 400);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const empRes = await client.query<{ id: string; name: string }>(
      "SELECT id, name FROM public.employees WHERE id = $1::uuid LIMIT 1",
      [employeeId]
    );
    const emp = empRes.rows[0];
    if (!emp) {
      await client.query("ROLLBACK");
      return fail(res, "Employee not found", 404);
    }

    const advId = crypto.randomUUID();
    const syncRes = await recordFinanceSync(client, {
      entry_source: "advance",
      source_id: `adv:${advId}`,
      type: "expense",
      amount,
      date: advanceDate,
      payment_mode: paymentMode,
      account_id: accountId,
      category_name: "Salary",
      reference: reason || `Advance - ${emp.name}`,
      description: `Employee salary advance to ${emp.name}${notes ? `: ${notes}` : ""}`,
      staff_name: staffName,
      user_id: req.user?.id || null,
    });

    const { rows: advRows } = await client.query<Record<string, unknown>>(
      `INSERT INTO public.employee_advances
       (id, employee_id, amount, recovered_amount, remaining_amount, advance_date, payment_mode, account_id, status, reason, notes, finance_transaction_id, staff_name, created_by)
       VALUES ($1::uuid, $2::uuid, $3, 0, $3, $4::date, $5, $6::uuid, 'active', $7, $8, $9::uuid, $10, $11::uuid)
       RETURNING *`,
      [
        advId,
        employeeId,
        amount,
        advanceDate,
        paymentMode,
        syncRes.account.id,
        reason || null,
        notes || null,
        syncRes.transaction?.id || null,
        staffName,
        req.user?.id || null,
      ]
    );

    await client.query(
      `INSERT INTO public.system_audit_log (action, module, entity_type, entity_id, details, staff_name, user_id)
       VALUES ('advance_issued', 'hrm', 'employee_advance', $1::uuid, $2, $3, $4::uuid)`,
      [
        advId,
        JSON.stringify({ employee: emp.name, amount, payment_mode: paymentMode, advance_number: advRows[0]?.advance_number }),
        staffName,
        req.user?.id || null,
      ]
    );
    await client.query("COMMIT");
    return ok(res, { success: true, advance: advRows[0], transaction: syncRes.transaction, dailyCash: syncRes.dailyCash });
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    if (isDatabaseUnavailable(e)) throw e;
    return fail(res, (e as Error).message, 500);
  } finally {
    client.release();
  }
}));

functionsRouter.post("/employee-advance-cancel", requireAuth, requireRole("admin"), asyncHandler(async (req, res) => {
  const body = req.body ?? {};
  const advanceId = typeof body.advance_id === "string" ? body.advance_id.trim() : "";
  const reason = typeof body.reason === "string" ? body.reason.trim() : "Cancelled";
  const staffName = typeof body.staff_name === "string" ? body.staff_name.trim() : req.user?.email || "Admin";
  if (!DOC_UUID_RE.test(advanceId)) return fail(res, "Valid advance_id required", 400);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const advRes = await client.query<Record<string, unknown>>(
      `SELECT ea.*, e.name AS employee_name
       FROM public.employee_advances ea
       JOIN public.employees e ON e.id = ea.employee_id
       WHERE ea.id = $1::uuid FOR UPDATE`,
      [advanceId]
    );
    const adv = advRes.rows[0];
    if (!adv) {
      await client.query("ROLLBACK");
      return fail(res, "Advance record not found", 404);
    }
    if (adv.status === "cancelled") {
      await client.query("ROLLBACK");
      return fail(res, "Advance is already cancelled", 409);
    }
    if (Number(adv.recovered_amount || 0) > 0) {
      await client.query("ROLLBACK");
      return fail(res, "Cannot cancel an advance after salary recovery has been applied", 400);
    }

    const syncRes = await recordFinanceSync(client, {
      entry_source: "advance_refund",
      source_id: `advref:${advanceId}`,
      type: "income",
      amount: Number(adv.amount || 0),
      date: normalizeDateKey(),
      payment_mode: String(adv.payment_mode || "cash"),
      account_id: (adv.account_id as string | null) || null,
      category_name: "Other Income",
      reference: String(adv.advance_number || advanceId),
      description: `Reversal of cancelled salary advance (${adv.employee_name}): ${reason}`,
      staff_name: staffName,
      user_id: req.user?.id || null,
    });

    const { rows: updated } = await client.query<Record<string, unknown>>(
      `UPDATE public.employee_advances
       SET status = 'cancelled',
           remaining_amount = 0,
           notes = COALESCE(notes || E'\\n', '') || $2
       WHERE id = $1::uuid
       RETURNING *`,
      [advanceId, `[Cancelled: ${reason}]`]
    );

    await client.query("COMMIT");
    return ok(res, { success: true, advance: updated[0], refundTransaction: syncRes.transaction });
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    if (isDatabaseUnavailable(e)) throw e;
    return fail(res, (e as Error).message, 500);
  } finally {
    client.release();
  }
}));

// ---------------------------------------------------------------------------
// payroll-settle — Mark slip paid, recover advances FIFO & post Finance expense
// ---------------------------------------------------------------------------
functionsRouter.post("/payroll-settle", requireAuth, requireRole("admin"), asyncHandler(async (req, res) => {
  const body = req.body ?? {};
  const payrollId = typeof body.payroll_id === "string" ? body.payroll_id.trim() : "";
  const paymentMode = typeof body.payment_mode === "string" ? body.payment_mode.trim().toLowerCase() : "cash";
  const accountId = typeof body.account_id === "string" && DOC_UUID_RE.test(body.account_id) ? body.account_id : null;
  const paidDate = normalizeDateKey(typeof body.paid_date === "string" ? body.paid_date : undefined);
  const notes = typeof body.notes === "string" ? body.notes.trim() : null;
  const staffName = typeof body.staff_name === "string" ? body.staff_name.trim() : req.user?.email || "Admin";
  if (!DOC_UUID_RE.test(payrollId)) return fail(res, "Valid payroll_id required", 400);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const payRes = await client.query<Record<string, unknown>>(
      `SELECT p.*, e.name AS employee_name
       FROM public.payroll p
       JOIN public.employees e ON e.id = p.employee_id
       WHERE p.id = $1::uuid FOR UPDATE`,
      [payrollId]
    );
    const pay = payRes.rows[0];
    if (!pay) {
      await client.query("ROLLBACK");
      return fail(res, "Payroll slip not found", 404);
    }
    if (pay.payment_status === "paid") {
      await client.query("ROLLBACK");
      return fail(res, "Salary slip is already marked as paid", 409);
    }

    const advanceDeductionTarget = Math.max(0, Number(pay.advance_deduction || 0));
    const recoveriesApplied: Array<{ advance_id: string; amount_recovered: number; new_status: string }> = [];

    if (advanceDeductionTarget > 0) {
      const { rows: activeAdvances } = await client.query<{
        id: string;
        remaining_amount: string;
        recovered_amount: string;
        advance_date: string;
      }>(
        `SELECT id, remaining_amount, recovered_amount, advance_date
         FROM public.employee_advances
         WHERE employee_id = $1::uuid AND status IN ('active', 'partial') AND remaining_amount > 0
         ORDER BY advance_date ASC, created_at ASC
         FOR UPDATE`,
        [pay.employee_id]
      );

      let toRecover = advanceDeductionTarget;
      for (const adv of activeAdvances) {
        if (toRecover <= 0.005) break;
        const prevRem = Math.max(0, Number(adv.remaining_amount || 0));
        const chunk = Math.min(prevRem, toRecover);
        const newRecovered = Math.round((Number(adv.recovered_amount || 0) + chunk) * 100) / 100;
        const newRemaining = Math.max(0, Math.round((prevRem - chunk) * 100) / 100);
        const newStatus = newRemaining <= 0.005 ? "recovered" : "partial";

        await client.query(
          `INSERT INTO public.payroll_advance_recoveries (payroll_id, advance_id, amount_recovered)
           VALUES ($1::uuid, $2::uuid, $3)`,
          [payrollId, adv.id, chunk]
        );
        await client.query(
          `UPDATE public.employee_advances
           SET recovered_amount = $2, remaining_amount = $3, status = $4
           WHERE id = $1::uuid`,
          [adv.id, newRecovered, newRemaining, newStatus]
        );
        recoveriesApplied.push({ advance_id: adv.id, amount_recovered: chunk, new_status: newStatus });
        toRecover = Math.round((toRecover - chunk) * 100) / 100;
      }
    }

    const netSalary = Math.max(0, Number(pay.net_salary || 0));
    let syncRes: Awaited<ReturnType<typeof recordFinanceSync>> | null = null;
    if (netSalary > 0) {
      syncRes = await recordFinanceSync(client, {
        entry_source: "payroll",
        source_id: `payroll:${payrollId}`,
        type: "expense",
        amount: netSalary,
        date: paidDate,
        payment_mode: paymentMode,
        account_id: accountId,
        category_name: "Salary",
        reference: String(pay.slip_number || `Payroll-${pay.month}`),
        description: `Salary paid to ${pay.employee_name} (${pay.month})`,
        staff_name: staffName,
        user_id: req.user?.id || null,
      });
    }

    const { rows: updatedRows } = await client.query<Record<string, unknown>>(
      `UPDATE public.payroll
       SET payment_status = 'paid',
           paid_date = $2::date,
           payment_mode = $3,
           account_id = $4::uuid,
           finance_transaction_id = $5::uuid,
           notes = COALESCE($6, notes)
       WHERE id = $1::uuid
       RETURNING *`,
      [
        payrollId,
        paidDate,
        paymentMode,
        syncRes?.account.id || accountId || null,
        syncRes?.transaction?.id || null,
        notes,
      ]
    );

    await client.query(
      `INSERT INTO public.system_audit_log (action, module, entity_type, entity_id, details, staff_name, user_id)
       VALUES ('payroll_paid', 'hrm', 'payroll', $1::uuid, $2, $3, $4::uuid)`,
      [
        payrollId,
        JSON.stringify({ employee: pay.employee_name, month: pay.month, net_salary: netSalary, advance_deduction: advanceDeductionTarget, payment_mode: paymentMode }),
        staffName,
        req.user?.id || null,
      ]
    );

    await client.query("COMMIT");
    return ok(res, {
      success: true,
      payroll: updatedRows[0],
      transaction: syncRes?.transaction || null,
      dailyCash: syncRes?.dailyCash || null,
      recoveries: recoveriesApplied,
    });
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    if (isDatabaseUnavailable(e)) throw e;
    return fail(res, (e as Error).message, 500);
  } finally {
    client.release();
  }
}));

// ---------------------------------------------------------------------------
// payroll-pdf — Branded A4 Employee Salary Payslip PDF
// ---------------------------------------------------------------------------
functionsRouter.get("/payroll-pdf", requireAuth, asyncHandler(async (req, res) => {
  try {
    const id = typeof req.query.id === "string" ? req.query.id.trim() : "";
    const download = req.query.download === "1" || req.query.download === "true";
    if (!DOC_UUID_RE.test(id)) return fail(res, "Valid payroll slip 'id' is required", 400);

    const [business, rowRes] = await Promise.all([
      getSettings(),
      pool.query<Record<string, unknown>>(
        `SELECT p.*, e.name AS employee_name, e.role AS employee_role, e.department AS department,
                e.salary AS monthly_base_salary, e.user_id AS employee_user_id, fa.name AS account_name
         FROM public.payroll p
         JOIN public.employees e ON e.id = p.employee_id
         LEFT JOIN public.finance_accounts fa ON fa.id = p.account_id
         WHERE p.id = $1::uuid
         LIMIT 1`,
        [id]
      ),
    ]);

    const row = rowRes.rows[0];
    if (!row) return fail(res, "Salary slip not found", 404);
    const isAdmin = req.user?.roles.includes("admin");
    if (!isAdmin && row.employee_user_id !== req.user?.id) {
      return fail(res, "Admin role or slip owner required", 403);
    }

    const pdfBytes = await buildPayrollSlipPdf({
      business: business as any,
      slipNumber: (row.slip_number as string | null) ?? null,
      month: String(row.month || ""),
      employeeName: String(row.employee_name || "Employee"),
      employeeRole: (row.employee_role as string | null) ?? null,
      department: (row.department as string | null) ?? null,
      workingDays: row.working_days != null ? Number(row.working_days) : null,
      presentDays: row.present_days != null ? Number(row.present_days) : null,
      halfDays: row.half_days != null ? Number(row.half_days) : null,
      leaveDays: row.leave_days != null ? Number(row.leave_days) : null,
      absentDays: row.absent_days != null ? Number(row.absent_days) : null,
      monthlyBaseSalary: row.monthly_base_salary != null ? Number(row.monthly_base_salary) : null,
      basicSalary: Number(row.basic_salary || 0),
      bonus: Number(row.bonus || 0),
      advanceDeduction: Number(row.advance_deduction || 0),
      otherDeductions: Number(row.other_deductions ?? row.deductions ?? 0),
      netSalary: Number(row.net_salary || 0),
      paymentStatus: String(row.payment_status || "pending"),
      paidDate: row.paid_date ? normalizeDateKey(String(row.paid_date)) : null,
      paymentMode: (row.payment_mode as string | null) ?? null,
      accountName: (row.account_name as string | null) ?? null,
      notes: (row.notes as string | null) ?? null,
    });

    const safeFile = `Payslip-${String(row.slip_number || row.month || id).replace(/[^A-Za-z0-9._-]/g, "_")}.pdf`;
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `${download ? "attachment" : "inline"}; filename="${safeFile}"`);
    res.setHeader("Cache-Control", "no-store");
    return res.send(Buffer.from(pdfBytes));
  } catch (e) {
    if (isDatabaseUnavailable(e)) throw e;
    return fail(res, (e as Error).message, 500);
  }
}));

// ---------------------------------------------------------------------------
// leads-delete & leads-convert — Atomic CRM spam/bot cleanup & deduped conversion
// ---------------------------------------------------------------------------
functionsRouter.post("/leads-delete", requireStaff, asyncHandler(async (req, res) => {
  const body = req.body ?? {};
  const ids = Array.isArray(body.ids) ? body.ids : body.id ? [body.id] : [];
  if (ids.length === 0) return fail(res, "At least one lead id is required", 400);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await deleteLeadsTx(client, {
      ids: ids.map(String),
      userId: req.user?.id || null,
    });
    await client.query("COMMIT");
    return ok(res, { success: true, ...result });
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    if (isDatabaseUnavailable(e)) throw e;
    const status = typeof (e as { status?: number }).status === "number" ? (e as { status: number }).status : 500;
    return fail(res, (e as Error).message, status);
  } finally {
    client.release();
  }
}));

functionsRouter.post("/leads-convert", requireStaff, asyncHandler(async (req, res) => {
  const leadId = typeof req.body?.lead_id === "string" ? req.body.lead_id : typeof req.body?.id === "string" ? req.body.id : "";
  if (!DOC_UUID_RE.test(leadId)) return fail(res, "Valid lead id is required", 400);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await convertLeadTx(client, {
      leadId,
      userId: req.user?.id || null,
    });
    await client.query("COMMIT");
    return ok(res, { success: true, ...result });
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    if (isDatabaseUnavailable(e)) throw e;
    const status = typeof (e as { status?: number }).status === "number" ? (e as { status: number }).status : 500;
    return fail(res, (e as Error).message, status);
  } finally {
    client.release();
  }
}));

// ---------------------------------------------------------------------------
// WhatsApp Gateway Session Management, Direct PDF Send & Chat->Lead Promotion
// ---------------------------------------------------------------------------
functionsRouter.get(["/whatsapp-session/status", "/whatsapp-session-status"], requireRole("admin"), asyncHandler(async (_req, res) => {
  try {
    const settings = await getSettings();
    const cfg = resolveWhatsappConfig(
      {
        whatsapp_api_url: settings.whatsapp_api_url as string | null,
        whatsapp_api_key: settings.whatsapp_api_key as string | null,
        whatsapp_phone_id: settings.whatsapp_phone_id as string | null,
        integrations: (settings.integrations as Record<string, unknown>) || null,
      },
      env
    );
    const status = await getGatewaySessionStatus(cfg);
    return ok(res, {
      success: true,
      configured: cfg.configured,
      webhook_url: `${env.appOrigin.replace(/\/$/, "")}/api/backend/functions/whatsapp-webhook`,
      ...status,
    });
  } catch (e) {
    if (isDatabaseUnavailable(e)) throw e;
    return fail(res, (e as Error).message, 502);
  }
}));

functionsRouter.post(["/whatsapp-session/connect", "/whatsapp-session-connect"], requireRole("admin"), asyncHandler(async (req, res) => {
  try {
    const { method = "qr", phone_number } = req.body ?? {};
    const connectMethod = method === "pairing_code" ? "pairing_code" : "qr";
    const settings = await getSettings();
    const cfg = resolveWhatsappConfig(
      {
        whatsapp_api_url: settings.whatsapp_api_url as string | null,
        whatsapp_api_key: settings.whatsapp_api_key as string | null,
        whatsapp_phone_id: settings.whatsapp_phone_id as string | null,
        integrations: (settings.integrations as Record<string, unknown>) || null,
      },
      env
    );
    const webhookUrl = `${env.appOrigin.replace(/\/$/, "")}/api/backend/functions/whatsapp-webhook`;
    const status = await connectGatewaySession(cfg, {
      method: connectMethod,
      phoneNumber: typeof phone_number === "string" ? phone_number : undefined,
      webhookUrl,
    });
    return ok(res, { success: true, webhook_url: webhookUrl, ...status });
  } catch (e) {
    if (isDatabaseUnavailable(e)) throw e;
    return fail(res, (e as Error).message, 400);
  }
}));

functionsRouter.post(["/whatsapp-session/logout", "/whatsapp-session-logout"], requireRole("admin"), asyncHandler(async (req, res) => {
  try {
    const settings = await getSettings();
    const cfg = resolveWhatsappConfig(
      {
        whatsapp_api_url: settings.whatsapp_api_url as string | null,
        whatsapp_api_key: settings.whatsapp_api_key as string | null,
        whatsapp_phone_id: settings.whatsapp_phone_id as string | null,
        integrations: (settings.integrations as Record<string, unknown>) || null,
      },
      env
    );
    const result = await disconnectGatewaySession(cfg);
    await pool.query(
      `INSERT INTO public.system_audit_log (user_id, action, module, details, ip_address)
       VALUES ($1::uuid, 'whatsapp_session_disconnected', 'integrations', $2::jsonb, $3)`,
      [req.user?.id ?? null, JSON.stringify({ provider: cfg.provider, instance: cfg.instance }), getClientIp(req)]
    );
    return ok(res, { success: result.ok, provider: cfg.provider, instance: cfg.instance });
  } catch (e) {
    if (isDatabaseUnavailable(e)) throw e;
    return fail(res, (e as Error).message, 502);
  }
}));

functionsRouter.post("/send-whatsapp-document", requireStaff, asyncHandler(async (req, res) => {
  try {
    const { type, id, to, message, mark_sent } = req.body ?? {};
    const docType = String(type ?? "").toLowerCase() as BrandedDocumentType;
    const docId = String(id ?? "").trim();
    if (!["quotation", "invoice", "challan"].includes(docType) || !DOC_UUID_RE.test(docId)) {
      return fail(res, "Valid 'type' and 'id' are required", 400);
    }

    const loaded = await loadDocumentForPdf(docType, { id: docId });
    if (!loaded) return fail(res, `${docType} not found`, 404);

    const recipientPhone = String(to || loaded.pdfInput.customer?.phone || "").trim();
    if (!recipientPhone) {
      return fail(res, "Customer WhatsApp phone number is required", 400);
    }

    const pdfBytes = await buildBrandedDocumentPdf(loaded.pdfInput);
    const origin = env.appOrigin.replace(/\/$/, "");
    const publicPdfUrl = loaded.publicToken
      ? `${origin}/api/backend/functions/document-pdf?type=${docType}&token=${loaded.publicToken}`
      : `${origin}/api/backend/functions/document-pdf?type=${docType}&id=${loaded.id}`;
    const portalLink = loaded.publicPath ? `${origin}${loaded.publicPath}` : null;

    const docLabel = docType === "quotation" ? "Quotation" : docType === "challan" ? "Delivery Challan" : "Tax Invoice";
    const defaultText = [
      `Hello ${loaded.customerName || "Customer"},`,
      `Please find attached your ALVStore ${docLabel} (${loaded.docNumber}).`,
      portalLink ? `Review online: ${portalLink}` : null,
    ]
      .filter(Boolean)
      .join("\n");
    const finalMessage = String(message || "").trim() || defaultText;

    const sendRes = await sendWhatsAppMessage({
      to: recipientPhone,
      message: portalLink && !String(message || "").includes("http")
        ? `${finalMessage}\n\nOnline link: ${portalLink}`
        : finalMessage,
      file_url: publicPdfUrl,
      file_name: loaded.filename,
      file_type: "application/pdf",
      media_base64: Buffer.from(pdfBytes).toString("base64"),
    });
    if (!sendRes.success) {
      return fail(res, sendRes.error ?? "Failed to send WhatsApp PDF", 502);
    }

    const chatPdfPath = loaded.publicToken
      ? `/api/backend/functions/document-pdf?type=${docType}&token=${loaded.publicToken}`
      : `/api/backend/functions/document-pdf?type=${docType}&id=${loaded.id}`;
    const chatRec = await recordOutboundWhatsappChatMessage(pool, {
      phone: recipientPhone,
      senderId: req.user?.id ?? null,
      customerName: loaded.customerName,
      content: `${docLabel} ${loaded.docNumber} sent via WhatsApp`,
      waMessageId: sendRes.waMessageId ?? null,
      fileUrl: chatPdfPath,
      fileName: loaded.filename,
      fileType: "application/pdf",
    });

    if (docType === "quotation" && mark_sent !== false) {
      await prisma.quotations.updateMany({
        where: { id: loaded.id, status: "draft" },
        data: { status: "sent", updated_at: new Date() },
      });
    }

    await pool.query(
      `INSERT INTO public.system_audit_log (user_id, action, module, entity_type, entity_id, details, ip_address)
       VALUES ($1::uuid, $2, $3, $4, $5::uuid, $6::jsonb, $7)`,
      [
        req.user?.id ?? null,
        `${docType}_whatsapp_sent`,
        docType === "challan" ? "logistics" : "sales",
        docType,
        loaded.id,
        JSON.stringify({ to: recipientPhone, doc_number: loaded.docNumber, message_id: sendRes.waMessageId }),
        getClientIp(req),
      ]
    );

    return ok(res, {
      success: true,
      whatsapp_message_id: sendRes.waMessageId,
      conversation_id: chatRec.conversationId,
      provider: sendRes.provider,
    });
  } catch (e) {
    if (isDatabaseUnavailable(e)) throw e;
    return fail(res, (e as Error).message, 500);
  }
}));

functionsRouter.post("/whatsapp-promote-lead", requireStaff, asyncHandler(async (req, res) => {
  try {
    const { conversation_id, name, interest, notes } = req.body ?? {};
    const cid = String(conversation_id ?? "").trim();
    if (!DOC_UUID_RE.test(cid)) {
      return fail(res, "Valid conversation_id is required", 400);
    }
    const result = await promoteWhatsappChatToLead(pool, {
      conversationId: cid,
      userId: req.user?.id ?? null,
      name: typeof name === "string" ? name : null,
      interest: typeof interest === "string" ? interest : null,
      notes: typeof notes === "string" ? notes : null,
    });
    return ok(res, { success: true, ...result });
  } catch (e) {
    if (isDatabaseUnavailable(e)) throw e;
    const status = typeof (e as { status?: number }).status === "number" ? (e as { status: number }).status : 500;
    return fail(res, (e as Error).message, status);
  }
}));
