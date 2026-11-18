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
  whatsappToken: process.env.WHATSAPP_TOKEN ?? "",
  whatsappPhoneId: process.env.WHATSAPP_PHONE_ID ?? "",
  appOrigin: process.env.APP_ORIGIN ?? "http://localhost:3000",
};

export { serverRoot };
