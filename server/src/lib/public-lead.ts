import type { Request, Response } from "express";
import { pool } from "../db.js";
import type { QueryRunner } from "./user-roles.js";

export type { QueryRunner };

export interface ParsedPublicLead {
  name: string;
  phone: string;
  last10Digits: string;
  email: string;
  city: string;
  topic: string;
  note: string;
  formattedNotes: string | null;
}

export type ParsePublicLeadResult =
  | { kind: "honeypot" }
  | { kind: "error"; message: string }
  | { kind: "ok"; data: ParsedPublicLead };

export interface LeadRateLimiter {
  isAllowed: (clientKey: string, now?: number) => boolean;
}

function clampText(value: unknown, maxLen: number): string {
  return typeof value === "string" ? value.trim().slice(0, maxLen) : "";
}

/** Validate and normalize public consultation form payloads before DB writes. */
export function parsePublicLeadPayload(raw: unknown): ParsePublicLeadResult {
  const body = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const honeypot = clampText(body.website ?? body.company, 120);
  if (honeypot.length > 0) {
    return { kind: "honeypot" };
  }

  const name = clampText(body.name, 120);
  const phone = clampText(body.phone, 32);
  const email = clampText(body.email, 160).toLowerCase();
  const city = clampText(body.city, 80);
  const topic = clampText(body.topic ?? body.room, 120);
  const note = clampText(body.note, 4000);

  if (name.length < 2) {
    return { kind: "error", message: "Please provide your full name." };
  }

  const digits = phone.replace(/\D/g, "");
  if (digits.length < 10) {
    return { kind: "error", message: "Please provide a valid 10-digit mobile number." };
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { kind: "error", message: "Please provide a valid email address." };
  }

  const headerLines: string[] = [];
  if (topic) headerLines.push(`Topic: ${topic}`);
  if (city) headerLines.push(`City: ${city}`);
  const sections = [headerLines.join("\n"), note].filter(Boolean);
  const formattedNotes = sections.join("\n\n").trim() || null;

  return {
    kind: "ok",
    data: {
      name,
      phone,
      last10Digits: digits.slice(-10),
      email,
      city,
      topic,
      note,
      formattedNotes,
    },
  };
}

/** Simple sliding-window in-memory rate limiter for anonymous lead submissions. */
export function createLeadRateLimiter(opts?: { maxAttempts?: number; windowMs?: number }): LeadRateLimiter {
  const maxAttempts = opts?.maxAttempts ?? 8;
  const windowMs = opts?.windowMs ?? 10 * 60 * 1000;
  const hits = new Map<string, number[]>();

  return {
    isAllowed(clientKey: string, now = Date.now()): boolean {
      const key = clientKey.trim() || "unknown";
      const cutoff = now - windowMs;
      const recent = (hits.get(key) ?? []).filter((ts) => ts > cutoff);
      if (recent.length >= maxAttempts) {
        hits.set(key, recent);
        return false;
      }
      recent.push(now);
      hits.set(key, recent);
      if (hits.size > 1000) {
        for (const [k, list] of hits.entries()) {
          if (list.every((ts) => ts <= cutoff)) hits.delete(k);
        }
      }
      return true;
    },
  };
}

const defaultLimiter = createLeadRateLimiter();

/**
 * Create a website CRM lead (or merge rapid repeat submissions within 10 minutes),
 * log an activity item, and notify all admins.
 */
export async function createPublicLead(
  db: QueryRunner,
  data: ParsedPublicLead
): Promise<{ leadId: string; deduplicated: boolean }> {
  const existing = (await db.query(
    `SELECT id, notes FROM public.leads
     WHERE created_at > now() - interval '10 minutes'
       AND (
         regexp_replace(coalesce(phone, ''), '\\D', '', 'g') LIKE '%' || $1
         OR lower(coalesce(email, '')) = lower($2)
       )
     ORDER BY created_at DESC
     LIMIT 1`,
    [data.last10Digits, data.email]
  )) as { rows: { id: string; notes: string | null }[] };

  if (existing.rows.length > 0) {
    const existingRow = existing.rows[0];
    const currentNotes = (existingRow.notes ?? "").trim();
    let mergedNotes: string | null = currentNotes || data.formattedNotes;
    if (data.formattedNotes && !currentNotes.includes(data.formattedNotes)) {
      mergedNotes = [currentNotes, `--- Follow-up note ---\n${data.formattedNotes}`]
        .filter(Boolean)
        .join("\n\n");
    }

    await db.query(
      `UPDATE public.leads SET notes = $1, name = $2, updated_at = now() WHERE id = $3::uuid`,
      [mergedNotes, data.name, existingRow.id]
    );

    await db.query(
      `INSERT INTO public.lead_activities (lead_id, type, description, outcome)
       VALUES ($1::uuid, 'note', $2, 'Updated existing website enquiry')`,
      [existingRow.id, data.formattedNotes ?? `Follow-up submitted by ${data.name}`]
    );

    return { leadId: existingRow.id, deduplicated: true };
  }

  // Server-enforced defaults match CRM lead scoring (website = 60, pipeline_stage = new).
  const inserted = (await db.query(
    `INSERT INTO public.leads (name, phone, email, source, status, pipeline_stage, score, notes)
     VALUES ($1, $2, $3, 'website', 'new', 'new', 60, $4)
     RETURNING id`,
    [data.name, data.phone, data.email, data.formattedNotes]
  )) as { rows: { id: string }[] };

  const leadId = inserted.rows[0]?.id;
  if (!leadId) {
    throw new Error("Failed to persist website lead");
  }

  await db.query(
    `INSERT INTO public.lead_activities (lead_id, type, description, outcome)
     VALUES ($1::uuid, 'note', $2, 'Created from Write to us form')`,
    [leadId, data.formattedNotes ?? `Website consultation request from ${data.name}`]
  );

  const admins = (await db.query("SELECT user_id FROM public.user_roles WHERE role = 'admin'")) as {
    rows: { user_id: string }[];
  };
  const summaryParts = [data.name, data.city || null, data.topic || null].filter(Boolean);
  const bodyText = `${summaryParts.join(" · ")} (${data.phone})`;
  const metaJson = JSON.stringify({ lead_id: leadId, source: "website", link: "/leads" });

  for (const admin of admins.rows) {
    await db.query(
      `INSERT INTO public.notification_feed (user_id, type, title, body, metadata)
       VALUES ($1::uuid, 'lead', 'New Website Lead', $2, $3)`,
      [admin.user_id, bodyText, metaJson]
    );
  }

  return { leadId, deduplicated: false };
}

/** Express handler for POST /api/functions/public-lead. */
export async function handlePublicLeadRequest(
  req: Request,
  res: Response,
  deps?: { db?: QueryRunner; limiter?: LeadRateLimiter }
): Promise<Response> {
  const parsed = parsePublicLeadPayload(req.body);
  if (parsed.kind === "honeypot") {
    return res.json({ success: true, ignored: true });
  }
  if (parsed.kind === "error") {
    return res.status(400).json({ error: parsed.message, success: false });
  }

  const forwarded = req.headers["x-forwarded-for"];
  const firstForwarded = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  const clientIp = (firstForwarded?.split(",")[0] ?? req.ip ?? req.socket?.remoteAddress ?? "").trim() || "unknown";
  const limiter = deps?.limiter ?? defaultLimiter;
  if (!limiter.isAllowed(clientIp)) {
    return res.status(429).json({
      error: "Too many consultation requests sent recently. Please call or WhatsApp our studio directly.",
      success: false,
    });
  }

  const db = deps?.db ?? pool;
  const result = await createPublicLead(db, parsed.data);
  return res.status(result.deduplicated ? 200 : 201).json({
    success: true,
    lead_id: result.leadId,
    deduplicated: result.deduplicated,
  });
}
