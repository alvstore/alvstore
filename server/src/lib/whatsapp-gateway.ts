import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

export type WhatsappProvider = "openwa" | "evolution" | "meta";

export type WhatsappSessionState =
  | "connected"
  | "qr_ready"
  | "connecting"
  | "disconnected"
  | "error";

export interface WhatsappEnvConfig {
  whatsappProvider?: string;
  whatsappGatewayUrl?: string;
  whatsappGatewayKey?: string;
  whatsappInstance?: string;
  whatsappWebhookSecret?: string;
  whatsappToken?: string;
  whatsappPhoneId?: string;
}

export interface WhatsappSettingsLike {
  whatsapp_api_url?: string | null;
  whatsapp_api_key?: string | null;
  whatsapp_phone_id?: string | null;
  integrations?: Record<string, unknown> | null;
}

export interface ResolvedWhatsappConfig {
  provider: WhatsappProvider;
  gatewayUrl: string;
  gatewayKey: string;
  instance: string;
  webhookSecret: string;
  metaApiUrl: string;
  metaToken: string;
  metaPhoneId: string;
  configured: boolean;
}

export interface WhatsappSessionStatusResult {
  provider: WhatsappProvider;
  instance: string;
  state: WhatsappSessionState;
  connected: boolean;
  phone?: string;
  pushName?: string;
  qrCode?: string;
  pairingCode?: string;
  detail?: string;
}

export interface NormalizedInboundMessage {
  externalId: string;
  fromPhone: string;
  last10: string;
  senderName?: string;
  text: string;
  timestampIso: string;
}

export interface NormalizedStatusUpdate {
  externalId: string;
  status: "sent" | "delivered" | "read" | "failed";
}

export type ParsedWebhookPayload =
  | { kind: "inbound_messages"; messages: NormalizedInboundMessage[] }
  | { kind: "status_updates"; updates: NormalizedStatusUpdate[] }
  | { kind: "session_status"; status: WhatsappSessionState; phone?: string; qrCode?: string }
  | { kind: "ignored"; reason: string };

export interface GatewayMediaPayload {
  to: string;
  fileName: string;
  mimeType: string;
  caption?: string;
  base64?: string;
  mediaUrl?: string;
}

export interface GatewaySendResult {
  sent: boolean;
  provider: WhatsappProvider;
  messageId?: string;
  error?: string;
}

export type FetchLike = typeof fetch;

const str = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

function stripTrailingSlash(url: string): string {
  return url.replace(/\/+$/, "");
}

export function normalizePhoneLast10(phone: string | null | undefined): string {
  const digits = String(phone ?? "").replace(/\D/g, "");
  return digits.length >= 10 ? digits.slice(-10) : digits;
}

/** Normalize any phone or WhatsApp JID to numeric international digits (defaults 10-digit local numbers to +91). */
export function normalizeWhatsappNumber(input: string | null | undefined): string {
  const raw = String(input ?? "").trim();
  if (!raw) return "";
  const beforeAt = raw.includes("@") ? raw.split("@")[0] : raw;
  const userPart = beforeAt.includes(":") ? beforeAt.split(":")[0] : beforeAt;
  const digits = userPart.replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length === 10) return `91${digits}`;
  if (digits.length === 11 && digits.startsWith("0")) return `91${digits.slice(1)}`;
  return digits;
}

export function toOpenWaChatId(phone: string): string {
  const normalized = normalizeWhatsappNumber(phone);
  return normalized ? `${normalized}@c.us` : "";
}

export function normalizeQrDataUrl(qr: unknown): string | undefined {
  const val = str(qr);
  if (!val) return undefined;
  if (val.startsWith("data:image/")) return val;
  // Treat base64-looking strings as PNG QR images
  if (/^[A-Za-z0-9+/=]{80,}$/.test(val)) {
    return `data:image/png;base64,${val}`;
  }
  return undefined;
}

export function isIgnoredWhatsappJid(jid: string | null | undefined): boolean {
  const j = str(jid).toLowerCase();
  if (!j) return false;
  return (
    j.endsWith("@g.us") ||
    j.endsWith("@broadcast") ||
    j.endsWith("@newsletter") ||
    j === "status@broadcast"
  );
}

/**
 * Resolve active WhatsApp transport config (OpenWA, Evolution API v2, or Meta Official Cloud API)
 * from business_settings + integrations JSON, falling back to environment variables.
 */
export function resolveWhatsappConfig(
  settings: WhatsappSettingsLike | null | undefined,
  envConfig: WhatsappEnvConfig = {}
): ResolvedWhatsappConfig {
  const integ =
    settings?.integrations && typeof settings.integrations === "object"
      ? settings.integrations
      : {};

  const rawProvider = (
    str(integ.whatsapp_provider) || str(envConfig.whatsappProvider)
  ).toLowerCase();

  const gatewayUrl = stripTrailingSlash(
    str(integ.whatsapp_gateway_url) || str(envConfig.whatsappGatewayUrl)
  );
  const gatewayKey = str(integ.whatsapp_gateway_key) || str(envConfig.whatsappGatewayKey);
  const instance = str(integ.whatsapp_instance) || str(envConfig.whatsappInstance) || "alvstore";
  const webhookSecret =
    str(integ.whatsapp_webhook_secret) || str(envConfig.whatsappWebhookSecret);

  const metaApiUrl = str(settings?.whatsapp_api_url);
  const metaToken =
    str(settings?.whatsapp_api_key) || str(integ.whatsapp_token) || str(envConfig.whatsappToken);
  const metaPhoneId =
    str(settings?.whatsapp_phone_id) ||
    str(integ.whatsapp_phone_id) ||
    str(envConfig.whatsappPhoneId);

  let provider: WhatsappProvider = "meta";
  if (rawProvider === "openwa" || rawProvider === "evolution" || rawProvider === "meta") {
    provider = rawProvider;
  } else if (gatewayUrl) {
    provider = "openwa";
  } else if (metaToken || metaPhoneId || metaApiUrl) {
    provider = "meta";
  }

  const configured =
    provider === "meta"
      ? Boolean(metaToken && (metaApiUrl || metaPhoneId))
      : Boolean(gatewayUrl);

  return {
    provider,
    gatewayUrl,
    gatewayKey,
    instance,
    webhookSecret,
    metaApiUrl,
    metaToken,
    metaPhoneId,
    configured,
  };
}

function gatewayHeaders(cfg: ResolvedWhatsappConfig): Record<string, string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (!cfg.gatewayKey) return headers;
  if (cfg.provider === "evolution") {
    headers.apikey = cfg.gatewayKey;
  } else {
    headers["X-API-Key"] = cfg.gatewayKey;
  }
  return headers;
}

async function fetchJson(
  url: string,
  init: RequestInit,
  fetchImpl: FetchLike = fetch,
  timeoutMs = 15_000
): Promise<{ ok: boolean; status: number; data: Record<string, unknown>; rawText: string }> {
  const res = await fetchImpl(url, {
    ...init,
    signal: AbortSignal.timeout(timeoutMs),
  });
  const rawText = await res.text();
  let data: Record<string, unknown> = {};
  if (rawText) {
    try {
      const parsed = JSON.parse(rawText);
      if (parsed && typeof parsed === "object") data = parsed as Record<string, unknown>;
    } catch {
      data = { rawText };
    }
  }
  return { ok: res.ok, status: res.status, data, rawText };
}

function mapOpenWaState(raw: unknown): WhatsappSessionState {
  const s = str(raw).toLowerCase();
  if (s === "connected" || s === "ready" || s === "open") return "connected";
  if (s === "qr_ready" || s === "qr" || s === "scan_qr") return "qr_ready";
  if (s === "initializing" || s === "starting" || s === "connecting" || s === "authenticated") {
    return "connecting";
  }
  if (s === "error" || s === "failed") return "error";
  return "disconnected";
}

function mapEvolutionState(raw: unknown): WhatsappSessionState {
  const s = str(raw).toLowerCase();
  if (s === "open" || s === "connected") return "connected";
  if (s === "connecting") return "connecting";
  if (s === "error" || s === "refused") return "error";
  return "disconnected";
}

async function resolveOpenWaSessionId(
  cfg: ResolvedWhatsappConfig,
  fetchImpl: FetchLike,
  createIfMissing = false
): Promise<{ sid: string; session: Record<string, unknown> | null }> {
  const headers = gatewayHeaders(cfg);
  const enc = encodeURIComponent(cfg.instance);

  const direct = await fetchJson(`${cfg.gatewayUrl}/api/sessions/${enc}`, { method: "GET", headers }, fetchImpl);
  if (direct.ok) {
    const sid = str(direct.data.id) || cfg.instance;
    return { sid, session: direct.data };
  }

  const list = await fetchJson(`${cfg.gatewayUrl}/api/sessions`, { method: "GET", headers }, fetchImpl);
  if (list.ok) {
    const items = Array.isArray(list.data)
      ? list.data
      : Array.isArray((list.data as Record<string, unknown>).sessions)
        ? ((list.data as Record<string, unknown>).sessions as unknown[])
        : [];
    const matched = items.find(
      (item): item is Record<string, unknown> =>
        Boolean(item && typeof item === "object") &&
        (str((item as Record<string, unknown>).name) === cfg.instance ||
          str((item as Record<string, unknown>).id) === cfg.instance)
    );
    if (matched) {
      return { sid: str(matched.id) || cfg.instance, session: matched };
    }
  }

  if (!createIfMissing) return { sid: cfg.instance, session: null };

  const created = await fetchJson(
    `${cfg.gatewayUrl}/api/sessions`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({ name: cfg.instance }),
    },
    fetchImpl
  );
  if (!created.ok) {
    throw new Error(
      str(created.data.error) || str(created.data.message) || `OpenWA session create failed (${created.status})`
    );
  }
  const sid = str(created.data.id) || cfg.instance;
  return { sid, session: created.data };
}

function extractOpenWaPhone(data: Record<string, unknown> | null): string | undefined {
  if (!data) return undefined;
  const me = data.me && typeof data.me === "object" ? (data.me as Record<string, unknown>) : null;
  const user = data.user && typeof data.user === "object" ? (data.user as Record<string, unknown>) : null;
  const raw =
    str(data.phone) ||
    str(data.phoneNumber) ||
    str(me?.id) ||
    str(me?.user) ||
    str(user?.id);
  const norm = normalizeWhatsappNumber(raw);
  return norm || undefined;
}

/** Query current connection state, bound phone, and active QR if available. */
export async function getGatewaySessionStatus(
  cfg: ResolvedWhatsappConfig,
  fetchImpl: FetchLike = fetch
): Promise<WhatsappSessionStatusResult> {
  if (cfg.provider === "meta") {
    return {
      provider: "meta",
      instance: cfg.metaPhoneId || "meta-cloud",
      state: cfg.configured ? "connected" : "disconnected",
      connected: cfg.configured,
      phone: cfg.metaPhoneId || undefined,
      detail: cfg.configured ? "Meta Cloud API configured" : "Meta Cloud API credentials missing",
    };
  }

  if (!cfg.gatewayUrl) {
    return {
      provider: cfg.provider,
      instance: cfg.instance,
      state: "disconnected",
      connected: false,
      detail: "Gateway URL is not configured",
    };
  }

  const headers = gatewayHeaders(cfg);

  if (cfg.provider === "evolution") {
    const enc = encodeURIComponent(cfg.instance);
    const stateRes = await fetchJson(
      `${cfg.gatewayUrl}/instance/connectionState/${enc}`,
      { method: "GET", headers },
      fetchImpl
    );
    if (stateRes.status === 404) {
      return {
        provider: "evolution",
        instance: cfg.instance,
        state: "disconnected",
        connected: false,
        detail: "Instance not created yet",
      };
    }
    if (!stateRes.ok) {
      return {
        provider: "evolution",
        instance: cfg.instance,
        state: "error",
        connected: false,
        detail: str(stateRes.data.message) || `Evolution HTTP ${stateRes.status}`,
      };
    }
    const inst =
      stateRes.data.instance && typeof stateRes.data.instance === "object"
        ? (stateRes.data.instance as Record<string, unknown>)
        : stateRes.data;
    const state = mapEvolutionState(inst.state ?? stateRes.data.state);
    let phone: string | undefined;
    let pushName: string | undefined;
    if (state === "connected") {
      try {
        const infoRes = await fetchJson(
          `${cfg.gatewayUrl}/instance/fetchInstances?instanceName=${enc}`,
          { method: "GET", headers },
          fetchImpl,
          5_000
        );
        const arr = Array.isArray(infoRes.data)
          ? infoRes.data
          : Array.isArray((infoRes.data as Record<string, unknown>).instances)
            ? ((infoRes.data as Record<string, unknown>).instances as unknown[])
            : [];
        const first = arr[0] as Record<string, unknown> | undefined;
        const owner = str(first?.ownerJid) || str((first?.instance as Record<string, unknown> | undefined)?.owner);
        phone = normalizeWhatsappNumber(owner) || undefined;
        pushName =
          str(first?.profileName) ||
          str((first?.instance as Record<string, unknown> | undefined)?.profileName) ||
          undefined;
      } catch {
        // best-effort enrichment
      }
    }
    return {
      provider: "evolution",
      instance: cfg.instance,
      state,
      connected: state === "connected",
      phone,
      pushName,
    };
  }

  // OpenWA
  const { sid, session } = await resolveOpenWaSessionId(cfg, fetchImpl, false);
  if (!session) {
    return {
      provider: "openwa",
      instance: cfg.instance,
      state: "disconnected",
      connected: false,
      detail: "Session not initialized yet",
    };
  }

  let state = mapOpenWaState(session.status);
  let qrCode = normalizeQrDataUrl(session.qrCode ?? session.qr);
  if (state === "qr_ready" && !qrCode) {
    const qrRes = await fetchJson(
      `${cfg.gatewayUrl}/api/sessions/${encodeURIComponent(sid)}/qr`,
      { method: "GET", headers },
      fetchImpl,
      5_000
    );
    if (qrRes.ok) qrCode = normalizeQrDataUrl(qrRes.data.qrCode ?? qrRes.data.qr);
  }
  const me = session.me && typeof session.me === "object" ? (session.me as Record<string, unknown>) : null;
  return {
    provider: "openwa",
    instance: cfg.instance,
    state,
    connected: state === "connected",
    phone: extractOpenWaPhone(session),
    pushName: str(session.pushName) || str(me?.pushName) || str(me?.name) || undefined,
    qrCode,
  };
}

/**
 * Initialize or connect WhatsApp gateway session, register the CRM webhook,
 * and return a QR PNG data URI or 8-character pairing code.
 */
export async function connectGatewaySession(
  cfg: ResolvedWhatsappConfig,
  opts: {
    method: "qr" | "pairing_code";
    phoneNumber?: string;
    webhookUrl?: string;
  },
  fetchImpl: FetchLike = fetch
): Promise<WhatsappSessionStatusResult> {
  if (cfg.provider === "meta") {
    throw new Error("Meta Official Cloud API does not use QR or pairing-code login.");
  }
  if (!cfg.gatewayUrl) {
    throw new Error("WhatsApp Gateway URL is required before linking a number.");
  }
  if (opts.method === "pairing_code") {
    const cleanNum = normalizeWhatsappNumber(opts.phoneNumber);
    if (cleanNum.length < 10) {
      throw new Error("Enter a valid WhatsApp phone number with country code (e.g. +919887601200).");
    }
  }

  const headers = gatewayHeaders(cfg);

  if (cfg.provider === "evolution") {
    const enc = encodeURIComponent(cfg.instance);
    const stateCheck = await fetchJson(
      `${cfg.gatewayUrl}/instance/connectionState/${enc}`,
      { method: "GET", headers },
      fetchImpl
    );

    const webhookConfig = opts.webhookUrl
      ? {
          url: opts.webhookUrl,
          byEvents: false,
          base64: false,
          ...(cfg.webhookSecret ? { headers: { "x-webhook-secret": cfg.webhookSecret } } : {}),
          events: ["QRCODE_UPDATED", "CONNECTION_UPDATE", "MESSAGES_UPSERT", "MESSAGES_UPDATE"],
        }
      : undefined;

    if (stateCheck.status === 404) {
      const createRes = await fetchJson(
        `${cfg.gatewayUrl}/instance/create`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({
            instanceName: cfg.instance,
            qrcode: opts.method === "qr",
            integration: "WHATSAPP-BAILEYS",
            ...(webhookConfig ? { webhook: webhookConfig } : {}),
          }),
        },
        fetchImpl
      );
      if (!createRes.ok) {
        throw new Error(
          str(createRes.data.message) || `Evolution create instance failed (${createRes.status})`
        );
      }
    } else if (webhookConfig) {
      await fetchJson(
        `${cfg.gatewayUrl}/webhook/set/${enc}`,
        {
          method: "POST",
          headers,
          body: JSON.stringify(webhookConfig),
        },
        fetchImpl
      ).catch(() => null);
    }

    const numParam =
      opts.method === "pairing_code"
        ? `?number=${encodeURIComponent(normalizeWhatsappNumber(opts.phoneNumber))}`
        : "";
    const connRes = await fetchJson(
      `${cfg.gatewayUrl}/instance/connect/${enc}${numParam}`,
      { method: "GET", headers },
      fetchImpl
    );
    if (!connRes.ok) {
      throw new Error(str(connRes.data.message) || `Evolution connect failed (${connRes.status})`);
    }
    const qrCode = normalizeQrDataUrl(connRes.data.base64 ?? connRes.data.qrcode);
    const pairingCode = str(connRes.data.pairingCode) || undefined;
    const statusNow = await getGatewaySessionStatus(cfg, fetchImpl).catch(() => null);

    return {
      provider: "evolution",
      instance: cfg.instance,
      state: statusNow?.connected ? "connected" : qrCode || pairingCode ? "qr_ready" : "connecting",
      connected: Boolean(statusNow?.connected),
      phone: statusNow?.phone,
      pushName: statusNow?.pushName,
      qrCode,
      pairingCode,
    };
  }

  // OpenWA
  const { sid, session } = await resolveOpenWaSessionId(cfg, fetchImpl, true);
  const encSid = encodeURIComponent(sid);

  if (opts.webhookUrl) {
    await fetchJson(
      `${cfg.gatewayUrl}/api/sessions/${encSid}/webhooks`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          url: opts.webhookUrl,
          events: ["message.received", "message.sent", "message.ack", "session.status"],
          ...(cfg.webhookSecret ? { secret: cfg.webhookSecret } : {}),
        }),
      },
      fetchImpl
    ).catch(() => null);
  }

  const currentState = mapOpenWaState(session?.status);
  if (currentState !== "connected") {
    await fetchJson(
      `${cfg.gatewayUrl}/api/sessions/${encSid}/start`,
      { method: "POST", headers },
      fetchImpl
    ).catch(() => null);
  }

  if (opts.method === "pairing_code") {
    const cleanPhone = normalizeWhatsappNumber(opts.phoneNumber);
    const pairRes = await fetchJson(
      `${cfg.gatewayUrl}/api/sessions/${encSid}/pairing-code`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({ phoneNumber: cleanPhone }),
      },
      fetchImpl
    );
    if (!pairRes.ok) {
      throw new Error(
        str(pairRes.data.error) || str(pairRes.data.message) || `Pairing code request failed (${pairRes.status})`
      );
    }
    const pairingCode = str(pairRes.data.pairingCode) || str(pairRes.data.code);
    return {
      provider: "openwa",
      instance: cfg.instance,
      state: "qr_ready",
      connected: false,
      pairingCode: pairingCode || undefined,
    };
  }

  // QR mode — check status + QR endpoint with one short retry if starting up
  let status = await getGatewaySessionStatus(cfg, fetchImpl);
  if (!status.connected && !status.qrCode) {
    const qrRes = await fetchJson(
      `${cfg.gatewayUrl}/api/sessions/${encSid}/qr`,
      { method: "GET", headers },
      fetchImpl,
      6_000
    );
    const qrCode = normalizeQrDataUrl(qrRes.data.qrCode ?? qrRes.data.qr);
    if (qrCode) {
      status = { ...status, state: "qr_ready", qrCode };
    }
  }
  return status;
}

export async function disconnectGatewaySession(
  cfg: ResolvedWhatsappConfig,
  fetchImpl: FetchLike = fetch
): Promise<{ ok: boolean }> {
  if (cfg.provider === "meta" || !cfg.gatewayUrl) {
    return { ok: true };
  }
  const headers = gatewayHeaders(cfg);
  if (cfg.provider === "evolution") {
    const res = await fetchJson(
      `${cfg.gatewayUrl}/instance/logout/${encodeURIComponent(cfg.instance)}`,
      { method: "DELETE", headers },
      fetchImpl
    );
    return { ok: res.ok || res.status === 404 };
  }
  const { sid } = await resolveOpenWaSessionId(cfg, fetchImpl, false);
  const res = await fetchJson(
    `${cfg.gatewayUrl}/api/sessions/${encodeURIComponent(sid)}/logout`,
    { method: "POST", headers },
    fetchImpl
  );
  return { ok: res.ok || res.status === 404 };
}

export async function sendGatewayText(
  cfg: ResolvedWhatsappConfig,
  args: { to: string; text: string },
  fetchImpl: FetchLike = fetch
): Promise<GatewaySendResult> {
  const normalizedTo = normalizeWhatsappNumber(args.to);
  if (!normalizedTo) {
    return { sent: false, provider: cfg.provider, error: "Invalid recipient WhatsApp number" };
  }
  const headers = gatewayHeaders(cfg);

  if (cfg.provider === "evolution") {
    const res = await fetchJson(
      `${cfg.gatewayUrl}/message/sendText/${encodeURIComponent(cfg.instance)}`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({ number: normalizedTo, text: args.text }),
      },
      fetchImpl
    );
    if (!res.ok) {
      return {
        sent: false,
        provider: "evolution",
        error: str(res.data.message) || `Evolution HTTP ${res.status}`,
      };
    }
    const keyObj = res.data.key && typeof res.data.key === "object" ? (res.data.key as Record<string, unknown>) : null;
    return {
      sent: true,
      provider: "evolution",
      messageId: str(keyObj?.id) || str(res.data.id) || undefined,
    };
  }

  // OpenWA
  const { sid } = await resolveOpenWaSessionId(cfg, fetchImpl, false);
  const res = await fetchJson(
    `${cfg.gatewayUrl}/api/sessions/${encodeURIComponent(sid)}/messages/send-text`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({
        chatId: `${normalizedTo}@c.us`,
        text: args.text,
      }),
    },
    fetchImpl
  );
  if (!res.ok) {
    return {
      sent: false,
      provider: "openwa",
      error: str(res.data.error) || str(res.data.message) || `OpenWA HTTP ${res.status}`,
    };
  }
  const keyObj = res.data.key && typeof res.data.key === "object" ? (res.data.key as Record<string, unknown>) : null;
  return {
    sent: true,
    provider: "openwa",
    messageId: str(res.data.id) || str(res.data.messageId) || str(keyObj?.id) || undefined,
  };
}

export async function sendGatewayMedia(
  cfg: ResolvedWhatsappConfig,
  payload: GatewayMediaPayload,
  fetchImpl: FetchLike = fetch
): Promise<GatewaySendResult> {
  const normalizedTo = normalizeWhatsappNumber(payload.to);
  if (!normalizedTo) {
    return { sent: false, provider: cfg.provider, error: "Invalid recipient WhatsApp number" };
  }
  const headers = gatewayHeaders(cfg);

  if (cfg.provider === "evolution") {
    const mediatype = payload.mimeType.startsWith("image/")
      ? "image"
      : payload.mimeType.startsWith("video/")
        ? "video"
        : "document";
    const res = await fetchJson(
      `${cfg.gatewayUrl}/message/sendMedia/${encodeURIComponent(cfg.instance)}`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          number: normalizedTo,
          mediatype,
          mimetype: payload.mimeType,
          caption: payload.caption || "",
          media: payload.base64 || payload.mediaUrl || "",
          fileName: payload.fileName,
        }),
      },
      fetchImpl,
      25_000
    );
    if (!res.ok) {
      return {
        sent: false,
        provider: "evolution",
        error: str(res.data.message) || `Evolution sendMedia HTTP ${res.status}`,
      };
    }
    const keyObj = res.data.key && typeof res.data.key === "object" ? (res.data.key as Record<string, unknown>) : null;
    return {
      sent: true,
      provider: "evolution",
      messageId: str(keyObj?.id) || str(res.data.id) || undefined,
    };
  }

  // OpenWA
  const { sid } = await resolveOpenWaSessionId(cfg, fetchImpl, false);
  const endpoint = payload.mimeType.startsWith("image/") ? "send-image" : "send-document";
  const mediaField = payload.base64
    ? { base64: `data:${payload.mimeType};base64,${payload.base64}` }
    : { url: payload.mediaUrl };

  const res = await fetchJson(
    `${cfg.gatewayUrl}/api/sessions/${encodeURIComponent(sid)}/messages/${endpoint}`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({
        chatId: `${normalizedTo}@c.us`,
        ...mediaField,
        filename: payload.fileName,
        mimetype: payload.mimeType,
        caption: payload.caption || "",
      }),
    },
    fetchImpl,
    25_000
  );
  if (!res.ok) {
    return {
      sent: false,
      provider: "openwa",
      error: str(res.data.error) || str(res.data.message) || `OpenWA ${endpoint} HTTP ${res.status}`,
    };
  }
  const keyObj = res.data.key && typeof res.data.key === "object" ? (res.data.key as Record<string, unknown>) : null;
  return {
    sent: true,
    provider: "openwa",
    messageId: str(res.data.id) || str(res.data.messageId) || str(keyObj?.id) || undefined,
  };
}

/**
 * Safely resolve a local `/api/backend/storage/files/<bucket>/<path>` URL from uploadsDir
 * into raw base64 so self-hosted WhatsApp gateways can attach local uploads without public URLs.
 */
export async function readLocalStorageUploadBase64(
  fileUrl: string,
  uploadsDir: string
): Promise<{ base64: string; mimeType: string } | null> {
  const prefix = "/api/backend/storage/files/";
  if (!fileUrl.startsWith(prefix)) return null;
  const rel = fileUrl.slice(prefix.length).replace(/^\/+/, "");
  const root = path.resolve(uploadsDir);
  const abs = path.resolve(root, rel);
  if (!abs.startsWith(root + path.sep)) {
    throw new Error("Invalid storage file path");
  }
  const bytes = await fs.readFile(abs);
  const ext = path.extname(abs).toLowerCase();
  const mimeMap: Record<string, string> = {
    ".pdf": "application/pdf",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".gif": "image/gif",
    ".txt": "text/plain",
    ".csv": "text/csv",
    ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  };
  return {
    base64: bytes.toString("base64"),
    mimeType: mimeMap[ext] || "application/octet-stream",
  };
}

function timingSafeEqualStr(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/** Verify HMAC-SHA256 signature (`X-OpenWA-Signature: sha256=<hex>`) or gateway secret header. */
export function verifyGatewayWebhook(params: {
  secret: string;
  headers: Record<string, string | string[] | undefined>;
  rawBody?: Buffer;
  bodyText?: string;
}): { ok: boolean; reason?: string } {
  const secret = str(params.secret);
  if (!secret) return { ok: true, reason: "no_secret_configured" };

  const headerVal = (name: string): string => {
    const v = params.headers[name.toLowerCase()];
    return Array.isArray(v) ? str(v[0]) : str(v);
  };

  const openWaSig = headerVal("x-openwa-signature") || headerVal("x-hub-signature-256");
  if (openWaSig) {
    const raw = params.rawBody ?? Buffer.from(params.bodyText ?? "");
    const expectedHex = crypto.createHmac("sha256", secret).update(raw).digest("hex");
    const providedHex = openWaSig.replace(/^sha256=/i, "").trim().toLowerCase();
    if (timingSafeEqualStr(providedHex, expectedHex)) {
      return { ok: true };
    }
    return { ok: false, reason: "invalid_hmac_signature" };
  }

  const secretHeader =
    headerVal("x-webhook-secret") ||
    headerVal("apikey") ||
    headerVal("authorization").replace(/^Bearer\s+/i, "");

  if (secretHeader && timingSafeEqualStr(secretHeader, secret)) {
    return { ok: true };
  }

  return { ok: false, reason: "missing_or_invalid_webhook_secret" };
}

function mapAckStatus(ack: unknown): NormalizedStatusUpdate["status"] | null {
  if (typeof ack === "number") {
    if (ack === 0) return "failed";
    if (ack === 1 || ack === 2) return "sent";
    if (ack === 3) return "delivered";
    if (ack >= 4) return "read";
    return null;
  }
  const s = str(ack).toLowerCase();
  if (s === "read" || s === "played") return "read";
  if (s === "delivered" || s === "delivery_ack") return "delivered";
  if (s === "sent" || s === "server_ack") return "sent";
  if (s === "failed" || s === "error") return "failed";
  return null;
}

function extractTextFromMessageRecord(msg: Record<string, unknown>): string {
  const direct = str(msg.body) || str(msg.text) || str(msg.caption) || str(msg.content);
  if (direct) return direct;
  const inner = msg.message && typeof msg.message === "object" ? (msg.message as Record<string, unknown>) : null;
  if (!inner) return "";
  const ext =
    inner.extendedTextMessage && typeof inner.extendedTextMessage === "object"
      ? (inner.extendedTextMessage as Record<string, unknown>)
      : null;
  const img =
    inner.imageMessage && typeof inner.imageMessage === "object"
      ? (inner.imageMessage as Record<string, unknown>)
      : null;
  const doc =
    inner.documentMessage && typeof inner.documentMessage === "object"
      ? (inner.documentMessage as Record<string, unknown>)
      : null;
  return (
    str(inner.conversation) ||
    str(ext?.text) ||
    str(img?.caption) ||
    str(doc?.caption) ||
    (img ? "[Image received]" : doc ? `[Document: ${str(doc.fileName) || "file"}]` : "")
  );
}

/** Normalize OpenWA and Evolution API v2 webhook payloads while dropping groups/broadcasts/own echoes. */
export function parseGatewayWebhookPayload(body: Record<string, unknown> | null | undefined): ParsedWebhookPayload {
  if (!body || typeof body !== "object") {
    return { kind: "ignored", reason: "empty_payload" };
  }

  const event = str(body.event).toLowerCase();
  const data =
    body.data && typeof body.data === "object" ? (body.data as Record<string, unknown>) : body;

  // Session / QR events
  if (event === "session.status" || event === "connection.update" || event === "qrcode.updated") {
    const rawState = str(data.status) || str(data.state);
    const status = event.includes("qr")
      ? "qr_ready"
      : event.startsWith("connection")
        ? mapEvolutionState(rawState)
        : mapOpenWaState(rawState);
    const qrCode = normalizeQrDataUrl(data.qrCode ?? data.qr ?? data.base64 ?? (data.qrcode as Record<string, unknown> | undefined)?.base64);
    const phone = normalizeWhatsappNumber(str(data.phone) || str(data.ownerJid)) || undefined;
    return { kind: "session_status", status, phone, qrCode };
  }

  // Delivery/read status ACK events
  if (event === "message.ack" || event === "messages.update") {
    const items = Array.isArray(body.data) ? body.data : [data];
    const updates: NormalizedStatusUpdate[] = [];
    for (const item of items) {
      if (!item || typeof item !== "object") continue;
      const rec = item as Record<string, unknown>;
      const keyObj = rec.key && typeof rec.key === "object" ? (rec.key as Record<string, unknown>) : null;
      const updateObj = rec.update && typeof rec.update === "object" ? (rec.update as Record<string, unknown>) : null;
      const externalId = str(rec.messageId) || str(rec.id) || str(keyObj?.id);
      const status = mapAckStatus(rec.ack ?? rec.status ?? updateObj?.status);
      if (externalId && status) updates.push({ externalId, status });
    }
    return updates.length > 0
      ? { kind: "status_updates", updates }
      : { kind: "ignored", reason: "no_status_updates" };
  }

  // Inbound message events (OpenWA `message.received` or Evolution `messages.upsert`)
  if (event === "message.received" || event === "messages.upsert" || str(body.type) === "message") {
    const rawItems = Array.isArray(body.data) ? body.data : [data];
    const messages: NormalizedInboundMessage[] = [];
    let ignoredReason = "";

    for (const item of rawItems) {
      if (!item || typeof item !== "object") continue;
      const rec = item as Record<string, unknown>;
      const keyObj = rec.key && typeof rec.key === "object" ? (rec.key as Record<string, unknown>) : null;
      const fromMe = Boolean(rec.fromMe ?? keyObj?.fromMe);
      if (fromMe) {
        ignoredReason = "from_me";
        continue;
      }

      const rawJid =
        str(rec.from) ||
        str(rec.chatId) ||
        str(keyObj?.remoteJid);
      if (isIgnoredWhatsappJid(rawJid)) {
        ignoredReason = "ignored_jid";
        continue;
      }

      // Prefer real phone JID when WhatsApp uses @lid linked identifiers
      const phoneCandidate =
        str(rec.senderPn) ||
        str(rec.remoteJidAlt) ||
        str(keyObj?.remoteJidAlt) ||
        str(keyObj?.participantPn) ||
        rawJid;

      const fromPhone = normalizeWhatsappNumber(phoneCandidate);
      const last10 = normalizePhoneLast10(fromPhone);
      if (!last10 || last10.length < 7) {
        ignoredReason = "missing_sender_phone";
        continue;
      }

      const text = extractTextFromMessageRecord(rec) || "[Unsupported WhatsApp message]";
      const externalId =
        str(rec.id) ||
        str(rec.messageId) ||
        str(keyObj?.id) ||
        `wa-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

      const tsRaw = rec.timestamp ?? rec.messageTimestamp;
      let timestampIso = new Date().toISOString();
      if (typeof tsRaw === "number" && Number.isFinite(tsRaw)) {
        const ms = tsRaw > 1e12 ? tsRaw : tsRaw * 1000;
        timestampIso = new Date(ms).toISOString();
      } else if (typeof tsRaw === "string" && tsRaw.trim()) {
        const parsed = Date.parse(tsRaw);
        if (!Number.isNaN(parsed)) timestampIso = new Date(parsed).toISOString();
      }

      const senderName =
        str(rec.pushName) ||
        str(rec.senderName) ||
        str(rec.notifyName) ||
        undefined;

      messages.push({
        externalId,
        fromPhone,
        last10,
        senderName,
        text,
        timestampIso,
      });
    }

    if (messages.length > 0) {
      return { kind: "inbound_messages", messages };
    }
    return { kind: "ignored", reason: ignoredReason || "no_valid_inbound_messages" };
  }

  return { kind: "ignored", reason: `unhandled_event:${event || "unknown"}` };
}
