import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  connectGatewaySession,
  normalizePhoneLast10,
  normalizeWhatsappNumber,
  parseGatewayWebhookPayload,
  readLocalStorageUploadBase64,
  resolveWhatsappConfig,
  sendGatewayMedia,
  sendGatewayText,
  verifyGatewayWebhook,
  type FetchLike,
} from "../src/lib/whatsapp-gateway.js";

test("resolveWhatsappConfig prefers OpenWA/Evolution gateway settings and keeps Meta fallback intact", () => {
  const openwaCfg = resolveWhatsappConfig(
    {
      whatsapp_api_url: "https://graph.facebook.com/v21.0/12345/messages",
      whatsapp_api_key: "meta-token",
      whatsapp_phone_id: "12345",
      integrations: {
        whatsapp_provider: "openwa",
        whatsapp_gateway_url: "http://127.0.0.1:2785/",
        whatsapp_gateway_key: "gw-secret",
        whatsapp_instance: "alv-main",
        whatsapp_webhook_secret: "wh-secret",
      },
    },
    {}
  );

  assert.equal(openwaCfg.provider, "openwa");
  assert.equal(openwaCfg.gatewayUrl, "http://127.0.0.1:2785");
  assert.equal(openwaCfg.gatewayKey, "gw-secret");
  assert.equal(openwaCfg.instance, "alv-main");
  assert.equal(openwaCfg.configured, true);

  // Explicit Meta Official switch continues using Meta fields cleanly
  const metaCfg = resolveWhatsappConfig(
    {
      whatsapp_api_url: "https://graph.facebook.com/v21.0/12345/messages",
      whatsapp_api_key: "meta-token",
      whatsapp_phone_id: "12345",
      integrations: {
        whatsapp_provider: "meta",
        whatsapp_gateway_url: "http://127.0.0.1:2785",
      },
    },
    {}
  );
  assert.equal(metaCfg.provider, "meta");
  assert.equal(metaCfg.metaToken, "meta-token");
  assert.equal(metaCfg.metaPhoneId, "12345");
  assert.equal(metaCfg.configured, true);
});

test("phone normalization formats 10-digit Indian numbers and JIDs cleanly", () => {
  assert.equal(normalizeWhatsappNumber("9887601200"), "919887601200");
  assert.equal(normalizeWhatsappNumber("098876-01200"), "919887601200");
  assert.equal(normalizeWhatsappNumber("+91 98876 01200"), "919887601200");
  assert.equal(normalizeWhatsappNumber("919887601200:2@s.whatsapp.net"), "919887601200");
  assert.equal(normalizePhoneLast10("919887601200"), "9887601200");
});

test("connectGatewaySession supports OpenWA QR and 8-char pairing-code flows", async () => {
  const calls: Array<{ url: string; method: string; body?: string; apiKey?: string }> = [];
  const qrPng = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

  const mockFetch: FetchLike = async (url, init) => {
    const u = String(url);
    const method = init?.method || "GET";
    const headers = (init?.headers || {}) as Record<string, string>;
    calls.push({ url: u, method, body: init?.body ? String(init.body) : undefined, apiKey: headers["X-API-Key"] });

    if (u.endsWith("/api/sessions/alvstore") && method === "GET") {
      return new Response(JSON.stringify({ id: "sess-1", name: "alvstore", status: "qr_ready" }), { status: 200 });
    }
    if (u.endsWith("/api/sessions/sess-1/webhooks")) {
      return new Response(JSON.stringify({ ok: true }), { status: 201 });
    }
    if (u.endsWith("/api/sessions/sess-1/start")) {
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }
    if (u.endsWith("/api/sessions/sess-1/qr")) {
      return new Response(JSON.stringify({ qrCode: `data:image/png;base64,${qrPng}` }), { status: 200 });
    }
    if (u.endsWith("/api/sessions/sess-1/pairing-code")) {
      return new Response(JSON.stringify({ pairingCode: "ABCD-EFGH" }), { status: 200 });
    }
    return new Response("{}", { status: 404 });
  };

  const cfg = resolveWhatsappConfig({
    integrations: {
      whatsapp_provider: "openwa",
      whatsapp_gateway_url: "http://127.0.0.1:2785",
      whatsapp_gateway_key: "key-123",
      whatsapp_instance: "alvstore",
      whatsapp_webhook_secret: "hmac-sec",
    },
  });

  const qrResult = await connectGatewaySession(
    cfg,
    { method: "qr", webhookUrl: "https://alvstore.com/api/functions/whatsapp-webhook" },
    mockFetch
  );
  assert.equal(qrResult.state, "qr_ready");
  assert.ok(qrResult.qrCode?.startsWith("data:image/png;base64,"));
  assert.ok(calls.some((c) => c.url.endsWith("/webhooks") && c.apiKey === "key-123"));

  const pairResult = await connectGatewaySession(
    cfg,
    { method: "pairing_code", phoneNumber: "+91 9887601200" },
    mockFetch
  );
  assert.equal(pairResult.pairingCode, "ABCD-EFGH");
  const pairCall = calls.find((c) => c.url.endsWith("/pairing-code"));
  assert.ok(pairCall);
  assert.deepEqual(JSON.parse(pairCall.body || "{}"), { phoneNumber: "919887601200" });
});

test("sendGatewayText and sendGatewayMedia format Evolution API v2 requests cleanly", async () => {
  const requests: Array<{ url: string; apiKey?: string; payload: Record<string, unknown> }> = [];
  const mockFetch: FetchLike = async (url, init) => {
    const headers = (init?.headers || {}) as Record<string, string>;
    requests.push({
      url: String(url),
      apiKey: headers.apikey,
      payload: JSON.parse(String(init?.body || "{}")),
    });
    return new Response(JSON.stringify({ key: { id: "evo-msg-1" } }), { status: 200 });
  };

  const cfg = resolveWhatsappConfig({
    integrations: {
      whatsapp_provider: "evolution",
      whatsapp_gateway_url: "https://evo.example.com",
      whatsapp_gateway_key: "evo-key",
      whatsapp_instance: "crm",
    },
  });

  const txt = await sendGatewayText(cfg, { to: "9887601200", text: "Hello ALV" }, mockFetch);
  assert.equal(txt.sent, true);
  assert.equal(txt.messageId, "evo-msg-1");
  assert.equal(requests[0].url, "https://evo.example.com/message/sendText/crm");
  assert.equal(requests[0].apiKey, "evo-key");
  assert.deepEqual(requests[0].payload, { number: "919887601200", text: "Hello ALV" });

  const media = await sendGatewayMedia(
    cfg,
    {
      to: "9887601200",
      fileName: "QTN-001.pdf",
      mimeType: "application/pdf",
      caption: "Quotation PDF",
      base64: "JVBERi0xLjQ=",
    },
    mockFetch
  );
  assert.equal(media.sent, true);
  assert.equal(requests[1].url, "https://evo.example.com/message/sendMedia/crm");
  assert.equal(requests[1].payload.mediatype, "document");
  assert.equal(requests[1].payload.fileName, "QTN-001.pdf");
});

test("verifyGatewayWebhook validates OpenWA HMAC-SHA256 digests and rejects forged payloads", () => {
  const secret = "super-secret-hmac";
  const rawBody = Buffer.from(JSON.stringify({ event: "message.received", data: { from: "919887601200@c.us", body: "Hi" } }));
  const sig = "sha256=" + crypto.createHmac("sha256", secret).update(rawBody).digest("hex");

  assert.equal(
    verifyGatewayWebhook({
      secret,
      headers: { "x-openwa-signature": sig },
      rawBody,
    }).ok,
    true
  );

  assert.equal(
    verifyGatewayWebhook({
      secret,
      headers: { "x-openwa-signature": "sha256=" + "0".repeat(64) },
      rawBody,
    }).ok,
    false
  );

  assert.equal(
    verifyGatewayWebhook({
      secret,
      headers: {},
      rawBody,
    }).ok,
    false
  );
});

test("parseGatewayWebhookPayload filters groups/@g.us/fromMe and normalizes inbound unknown numbers", () => {
  const groupIgnored = parseGatewayWebhookPayload({
    event: "message.received",
    data: { from: "120363021111111111@g.us", body: "Group spam", fromMe: false },
  });
  assert.equal(groupIgnored.kind, "ignored");

  const echoIgnored = parseGatewayWebhookPayload({
    event: "message.received",
    data: { from: "919887601200@c.us", body: "Echo", fromMe: true },
  });
  assert.equal(echoIgnored.kind, "ignored");

  const openwaInbound = parseGatewayWebhookPayload({
    event: "message.received",
    data: {
      id: "msg-wa-101",
      from: "919887601200@c.us",
      pushName: "Vikram",
      body: "Need Dolby Atmos quote",
      fromMe: false,
      timestamp: 1795760000,
    },
  });
  assert.equal(openwaInbound.kind, "inbound_messages");
  if (openwaInbound.kind === "inbound_messages") {
    assert.equal(openwaInbound.messages.length, 1);
    assert.equal(openwaInbound.messages[0].last10, "9887601200");
    assert.equal(openwaInbound.messages[0].senderName, "Vikram");
    assert.equal(openwaInbound.messages[0].text, "Need Dolby Atmos quote");
  }

  // @lid identifier with remoteJidAlt phone fallback (Evolution / Baileys multi-device)
  const evoLid = parseGatewayWebhookPayload({
    event: "messages.upsert",
    data: {
      key: { id: "evo-lid-1", remoteJid: "123456789012345@lid", remoteJidAlt: "919811112222@s.whatsapp.net", fromMe: false },
      pushName: "Unknown Walk-in",
      message: { extendedTextMessage: { text: "Hello showroom" } },
    },
  });
  assert.equal(evoLid.kind, "inbound_messages");
  if (evoLid.kind === "inbound_messages") {
    assert.equal(evoLid.messages[0].last10, "9811112222");
    assert.equal(evoLid.messages[0].text, "Hello showroom");
  }
});

test("readLocalStorageUploadBase64 blocks traversal and encodes local uploads", async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "alv-wa-test-"));
  const sub = path.join(tmpDir, "chat", "thread-1");
  await fs.mkdir(sub, { recursive: true });
  await fs.writeFile(path.join(sub, "quote.pdf"), Buffer.from("%PDF-1.4"));

  const okFile = await readLocalStorageUploadBase64(
    "/api/backend/storage/files/chat/thread-1/quote.pdf",
    tmpDir
  );
  assert.ok(okFile);
  assert.equal(okFile.mimeType, "application/pdf");
  assert.equal(Buffer.from(okFile.base64, "base64").toString(), "%PDF-1.4");

  await assert.rejects(
    readLocalStorageUploadBase64("/api/backend/storage/files/../../etc/passwd", tmpDir),
    /Invalid storage file path/
  );
  await fs.rm(tmpDir, { recursive: true, force: true });
});
