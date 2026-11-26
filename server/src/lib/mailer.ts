import nodemailer from "nodemailer";
import { env } from "../env.js";

export interface ResolvedSmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  fromName: string;
  fromEmail: string;
}

export interface MailPayload {
  to: string;
  subject: string;
  html: string;
  attachments?: Array<{ filename: string; content: Buffer; contentType?: string }>;
}

export function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Resolves SMTP configuration cleanly: prioritizes Admin Settings stored in
 * business_settings.integrations, falling back field-by-field to server/.env.
 */
export async function resolveSmtpConfig(queryable: { query: (sql: string) => Promise<{ rows: any[] }> }): Promise<ResolvedSmtpConfig | null> {
  let row: any = null;
  try {
    const res = await queryable.query(
      "SELECT company_name, company_email, integrations FROM public.business_settings ORDER BY created_at ASC LIMIT 1"
    );
    row = res.rows[0] ?? null;
  } catch {
    row = null;
  }
  const integrations = (row?.integrations && typeof row.integrations === "object" ? row.integrations : {}) as Record<string, unknown>;
  const host = String(integrations.smtp_host || env.smtpHost || "").trim();
  const port = Number(integrations.smtp_port || env.smtpPort || 587) || 587;
  const user = String(integrations.smtp_user || env.smtpUser || "").trim();
  const pass = String(integrations.smtp_pass || env.smtpPass || "").trim();
  const fromName = String(integrations.smtp_from_name || row?.company_name || "ALVStore").trim();
  const fromEmail = String(integrations.smtp_from_email || env.smtpFrom || row?.company_email || user).trim();

  if (!host || !user || !pass || !fromEmail) return null;
  return {
    host,
    port,
    secure: port === 465,
    user,
    pass,
    fromName,
    fromEmail,
  };
}

export function renderBrandedEmailHtml(opts: {
  companyName: string;
  companyEmail?: string | null;
  companyPhone?: string | null;
  title: string;
  bodyHtml: string;
  ctaLabel?: string;
  ctaUrl?: string;
}): string {
  const safeBrand = escapeHtml(opts.companyName || "ALVStore");
  const safeTitle = escapeHtml(opts.title);
  const contactLine = [opts.companyPhone, opts.companyEmail].filter(Boolean).map(escapeHtml).join(" · ");
  const safeCtaUrl = opts.ctaUrl ? escapeHtml(opts.ctaUrl) : "";
  const safeCtaLabel = opts.ctaLabel ? escapeHtml(opts.ctaLabel) : "";

  return `<!DOCTYPE html>
<html>
<body style="margin:0;padding:24px;background:#F8FAFC;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#111827;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;margin:0 auto;background:#FFFFFF;border:1px solid #E2E8F0;border-radius:12px;overflow:hidden;">
    <tr>
      <td style="background:#0B0C0E;padding:20px 24px;border-bottom:3px solid #9C7B49;">
        <div style="font-size:18px;font-weight:700;color:#F6F4EE;letter-spacing:-0.02em;">${safeBrand}</div>
        <div style="font-size:13px;color:#D6D3CD;margin-top:4px;">${safeTitle}</div>
      </td>
    </tr>
    <tr>
      <td style="padding:24px;font-size:14px;line-height:1.6;color:#334155;">
        ${opts.bodyHtml}
        ${
          safeCtaUrl && safeCtaLabel
            ? `<div style="margin-top:22px;"><a href="${safeCtaUrl}" style="display:inline-block;background:#065F46;color:#FFFFFF;text-decoration:none;font-weight:600;font-size:14px;padding:11px 20px;border-radius:8px;">${safeCtaLabel}</a></div>`
            : ""
        }
      </td>
    </tr>
    <tr>
      <td style="padding:14px 24px;background:#F8FAFC;border-top:1px solid #E2E8F0;font-size:12px;color:#64748B;">
        ${safeBrand}${contactLine ? ` · ${contactLine}` : ""}
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export async function sendMailWithConfig(
  config: ResolvedSmtpConfig,
  payload: MailPayload,
  createTransportImpl: typeof nodemailer.createTransport = nodemailer.createTransport
): Promise<{ messageId: string }> {
  const transporter = createTransportImpl({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: { user: config.user, pass: config.pass },
  });
  const from = config.fromName ? `"${config.fromName.replace(/"/g, "")}" <${config.fromEmail}>` : config.fromEmail;
  const info = await transporter.sendMail({
    from,
    to: payload.to,
    subject: payload.subject,
    html: payload.html,
    attachments: payload.attachments?.map(a => ({
      filename: a.filename,
      content: a.content,
      contentType: a.contentType || "application/pdf",
    })),
  });
  return { messageId: String((info as { messageId?: string })?.messageId || "sent") };
}
