import dotenv from "dotenv";
import path from "node:path";
import url from "node:url";
import fs from "node:fs";

const here = path.dirname(url.fileURLToPath(import.meta.url));
const serverRoot = path.resolve(here, "..");
// Load server/.env first, then repo-root .env as fallback
for (const p of [path.join(serverRoot, ".env"), path.resolve(serverRoot, "..", ".env")]) {
  if (fs.existsSync(p)) dotenv.config({ path: p, override: false });
}

export const env = {
  port: Number(process.env.PORT ?? 4000),
  // Postgres connection. In local dev this points at the embedded PGlite
  // socket started by `npm run db:dev` (127.0.0.1:5433).
  databaseUrl:
    process.env.DATABASE_URL ?? "postgres://postgres:postgres@127.0.0.1:5433/postgres",
  jwtSecret: process.env.JWT_SECRET ?? "alvstore-dev-secret-change-me",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? "30d",
  uploadsDir: process.env.UPLOADS_DIR ?? path.join(serverRoot, "uploads"),
  // Optional integrations (functions degrade gracefully when unset)
  razorpayKeyId: process.env.RAZORPAY_KEY_ID ?? "",
  razorpayKeySecret: process.env.RAZORPAY_KEY_SECRET ?? "",
  razorpayWebhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET ?? "",
  smtpUrl: process.env.SMTP_URL ?? "",
  // Email (send-email function) — generic HTTP mail API pattern
  smtpHost: process.env.SMTP_HOST ?? "",
  smtpPort: process.env.SMTP_PORT ?? "587",
  smtpUser: process.env.SMTP_USER ?? "",
  smtpPass: process.env.SMTP_PASS ?? "",
  smtpFrom: process.env.SMTP_FROM ?? "",
  // SMS (send-sms function + WhatsApp automation fallback) — generic provider
  smsApiUrl: process.env.SMS_API_URL ?? "",
  smsApiKey: process.env.SMS_API_KEY ?? "",
  smsSenderId: process.env.SMS_SENDER_ID ?? "",
  smsDltEntityId: process.env.SMS_DLT_ENTITY_ID ?? "",
  // Hik-Partner Cloud (hikvision-sync / hikvision-webhook functions)
  hikPartnerAppKey: process.env.HIK_PARTNER_APP_KEY ?? "",
  hikPartnerSecretKey: process.env.HIK_PARTNER_SECRET_KEY ?? "",
  hikWebhookSignSecret: process.env.HIK_WEBHOOK_SIGN_SECRET ?? "",
  // AI gateway for parse-offer-pdf (OpenAI-compatible; heuristic fallback when unset)
  aiGatewayUrl: process.env.AI_GATEWAY_URL ?? "",
  aiGatewayKey: process.env.AI_GATEWAY_KEY ?? "",
  aiModel: process.env.AI_MODEL ?? "gpt-4o-mini",
  whatsappToken: process.env.WHATSAPP_TOKEN ?? "",
  whatsappPhoneId: process.env.WHATSAPP_PHONE_ID ?? "",
  appOrigin: process.env.APP_ORIGIN ?? "http://localhost:3000",
};

export function isEmbeddedPostgresUrl(databaseUrl: string): boolean {
  try {
    const url = new URL(databaseUrl);
    const pglitePort = process.env.PGLITE_SOCKET_PORT ?? "5433";
    const localHosts = new Set([
      "127.0.0.1",
      "localhost",
      "0.0.0.0",
      ...(process.env.PGLITE_CONNECT_HOST ? [process.env.PGLITE_CONNECT_HOST] : []),
    ]);
    return localHosts.has(url.hostname) && url.port === pglitePort;
  } catch {
    return false;
  }
}

export { serverRoot };
