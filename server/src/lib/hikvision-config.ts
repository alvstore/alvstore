export interface HikvisionEnvConfig {
  hikPartnerAppKey: string;
  hikPartnerSecretKey: string;
  hikWebhookSignSecret: string;
}

export interface HikvisionCredentials {
  appKey: string;
  secretKey: string;
  webhookSignSecret: string;
  source: "settings" | "env" | "mixed" | "none";
  hasDbCredentials: boolean;
  hasEnvCredentials: boolean;
  hasWebhookSecret: boolean;
}

/**
 * Resolve Hik-Partner Pro OpenAPI credentials from business_settings.integrations
 * first, falling back to server environment variables when unset in UI.
 */
export function resolveHikvisionCredentials(
  integrations: Record<string, unknown> | null | undefined,
  envConfig: HikvisionEnvConfig
): HikvisionCredentials {
  const record = integrations && typeof integrations === "object" ? integrations : {};
  const dbAppKey = typeof record.hik_partner_app_key === "string" ? record.hik_partner_app_key.trim() : "";
  const dbSecretKey = typeof record.hik_partner_secret_key === "string" ? record.hik_partner_secret_key.trim() : "";
  const dbWebhook = typeof record.hik_webhook_sign_secret === "string" ? record.hik_webhook_sign_secret.trim() : "";

  const envAppKey = (envConfig.hikPartnerAppKey || "").trim();
  const envSecretKey = (envConfig.hikPartnerSecretKey || "").trim();
  const envWebhook = (envConfig.hikWebhookSignSecret || "").trim();

  const appKey = dbAppKey || envAppKey;
  const secretKey = dbSecretKey || envSecretKey;
  const webhookSignSecret = dbWebhook || envWebhook;

  const hasDbCredentials = Boolean(dbAppKey && dbSecretKey);
  const hasEnvCredentials = Boolean(envAppKey && envSecretKey);

  let source: HikvisionCredentials["source"] = "none";
  if (hasDbCredentials) {
    source = "settings";
  } else if ((dbAppKey || dbSecretKey) && appKey && secretKey) {
    source = "mixed";
  } else if (hasEnvCredentials) {
    source = "env";
  }

  return {
    appKey,
    secretKey,
    webhookSignSecret,
    source,
    hasDbCredentials,
    hasEnvCredentials,
    hasWebhookSecret: Boolean(webhookSignSecret),
  };
}
