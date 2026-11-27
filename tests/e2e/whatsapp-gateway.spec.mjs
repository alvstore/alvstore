import { test as base, expect } from "@playwright/test";
import crypto from "node:crypto";
import fs from "node:fs";
import http from "node:http";

const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const email = process.env.E2E_EMAIL ?? "admin@alvstore.in";
const password = process.env.E2E_PASSWORD ?? "admin123";

const TINY_QR_PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

let token = "";
let storageState;
let mockServer;
let mockPort = 0;
let originalBizSettings = null;
const mockState = {
  sessionStatus: "qr_ready",
  connectedPhone: "919887609999",
  webhooks: [],
  sentTexts: [],
  sentDocuments: [],
};
const cleanup = {
  quotations: [],
  customers: [],
  leads: [],
  chatConversations: [],
  waConversations: [],
};

const test = base.extend({
  storageState: async ({}, use) => use(storageState ?? { cookies: [], origins: [] }),
});

const eq = (col, val) => ({ type: "op", col, op: "eq", val });

async function dataQuery(request, table, op, values, filters = []) {
  const res = await request.post(`${baseURL}/api/backend/data/query`, {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      table,
      op,
      values,
      filters,
      ...(op === "insert" ? { select: "*", single: "single" } : { select: "*" }),
    },
  });
  const body = await res.json();
  expect(res.ok(), `${table} ${op}: ${JSON.stringify(body)}`).toBeTruthy();
  return body.data;
}

async function localAssets(context) {
  await context.route(/^https?:\/\//, (route) => {
    const host = new URL(route.request().url()).hostname;
    return [new URL(baseURL).hostname, "localhost", "127.0.0.1", "arena.test"].includes(host) ||
      host.endsWith(".e2b.app")
      ? route.continue()
      : route.fulfill({ status: 200, contentType: "text/plain", body: "" });
  });
}

function startMockOpenWaServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const chunks = [];
      req.on("data", (c) => chunks.push(c));
      req.on("end", () => {
        const raw = Buffer.concat(chunks).toString("utf8");
        const parsed = raw ? JSON.parse(raw) : {};
        const urlPath = (req.url || "").split("?")[0];

        if (req.headers["x-api-key"] !== "e2e-openwa-key") {
          res.writeHead(401, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Unauthorized mock OpenWA key" }));
          return;
        }

        if (urlPath === "/api/sessions" && req.method === "GET") {
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(
            JSON.stringify([
              {
                id: "alv-e2e-sess",
                name: "alv-e2e",
                status: mockState.sessionStatus,
                phone: mockState.sessionStatus === "connected" ? mockState.connectedPhone : undefined,
                pushName: "ALVStore Showroom",
              },
            ])
          );
          return;
        }
        if (urlPath === "/api/sessions" && req.method === "POST") {
          res.writeHead(201, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ id: "alv-e2e-sess", name: parsed.name, status: mockState.sessionStatus }));
          return;
        }
        if (urlPath.match(/^\/api\/sessions\/[^/]+$/) && req.method === "GET") {
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(
            JSON.stringify({
              id: "alv-e2e-sess",
              name: "alv-e2e",
              status: mockState.sessionStatus,
              phone: mockState.sessionStatus === "connected" ? mockState.connectedPhone : undefined,
              pushName: "ALVStore Showroom",
            })
          );
          return;
        }
        if (urlPath.endsWith("/webhooks") && req.method === "POST") {
          mockState.webhooks.push(parsed);
          res.writeHead(201, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ ok: true }));
          return;
        }
        if (urlPath.endsWith("/start") && req.method === "POST") {
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ ok: true }));
          return;
        }
        if (urlPath.endsWith("/qr") && req.method === "GET") {
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ qrCode: TINY_QR_PNG }));
          return;
        }
        if (urlPath.endsWith("/pairing-code") && req.method === "POST") {
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ pairingCode: "ABCD-EFGH" }));
          return;
        }
        if (urlPath.endsWith("/messages/send-text") && req.method === "POST") {
          mockState.sentTexts.push(parsed);
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ id: `wa-txt-${mockState.sentTexts.length}` }));
          return;
        }
        if (urlPath.endsWith("/messages/send-document") && req.method === "POST") {
          mockState.sentDocuments.push(parsed);
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ id: `wa-doc-${mockState.sentDocuments.length}` }));
          return;
        }
        if (urlPath.endsWith("/logout") && req.method === "POST") {
          mockState.sessionStatus = "disconnected";
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ ok: true }));
          return;
        }

        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Not found" }));
      });
    });
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      resolve({ server, port: typeof addr === "object" && addr ? addr.port : 0 });
    });
  });
}

test.beforeEach(async ({ context }) => localAssets(context));

test.beforeAll(async ({ request, browser }) => {
  fs.mkdirSync("test-results", { recursive: true });
  const srv = await startMockOpenWaServer();
  mockServer = srv.server;
  mockPort = srv.port;

  const loginRes = await request.post(`${baseURL}/api/backend/auth/login`, {
    data: { email, password },
  });
  expect(loginRes.ok()).toBeTruthy();
  token = (await loginRes.json()).access_token;

  const existing = await dataQuery(request, "business_settings", "select", {});
  originalBizSettings = existing?.[0] ?? null;

  const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  await localAssets(context);
  try {
    const page = await context.newPage();
    await page.goto(new URL("/login", baseURL).href, { waitUntil: "networkidle" });
    await page.locator("#email").fill(email);
    await page.locator("#password").fill(password);
    await page.getByRole("button", { name: "Sign In", exact: true }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
    storageState = await context.storageState();
  } finally {
    await context.close();
  }
});

test.afterAll(async ({ request }) => {
  if (originalBizSettings?.id) {
    await dataQuery(
      request,
      "business_settings",
      "update",
      {
        integrations: originalBizSettings.integrations ?? {},
        whatsapp_api_url: originalBizSettings.whatsapp_api_url ?? null,
        whatsapp_api_key: originalBizSettings.whatsapp_api_key ?? null,
        whatsapp_phone_id: originalBizSettings.whatsapp_phone_id ?? null,
      },
      [eq("id", originalBizSettings.id)]
    ).catch(() => {});
  }
  for (const id of cleanup.quotations) {
    await dataQuery(request, "quotations", "delete", {}, [eq("id", id)]).catch(() => {});
  }
  for (const id of cleanup.customers) {
    await dataQuery(request, "customers", "delete", {}, [eq("id", id)]).catch(() => {});
  }
  if (cleanup.leads.length) {
    await request
      .post(`${baseURL}/api/backend/functions/leads-delete`, {
        headers: { Authorization: `Bearer ${token}` },
        data: { ids: cleanup.leads },
      })
      .catch(() => {});
  }
  for (const id of cleanup.chatConversations) {
    await dataQuery(request, "chat_conversations", "delete", {}, [eq("id", id)]).catch(() => {});
  }
  for (const id of cleanup.waConversations) {
    await dataQuery(request, "whatsapp_conversations", "delete", {}, [eq("id", id)]).catch(() => {});
  }
  if (mockServer) {
    await new Promise((r) => mockServer.close(() => r(undefined)));
  }
});

test("WhatsApp Gateway E2E: Meta fallback preserved, OpenWA QR & pairing work, unknown inbound numbers hit /chat only, and PDF send works", async ({
  page,
  request,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });

  // 1. Settings -> WhatsApp: verify Meta mode & OpenWA QR + Pairing Code flows
  await page.goto(`${baseURL}/settings`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "WhatsApp", exact: true }).click();
  await expect(page.getByText("WhatsApp Transport Mode")).toBeVisible();

  // Verify Meta Official Cloud API compatibility toggle preserves existing fields
  await page.getByRole("combobox", { name: "Active Provider" }).click();
  await page.getByRole("option", { name: /Meta Official Cloud API/i }).click();
  await expect(page.getByLabel("Phone Number ID")).toBeVisible();
  await expect(page.getByLabel("Webhook Verify Token")).toBeVisible();

  // Switch back to OpenWA Gateway
  await page.getByRole("combobox", { name: "Active Provider" }).click();
  await page.getByRole("option", { name: /OpenWA Gateway/i }).click();

  await page.getByLabel("Gateway URL").fill(`http://127.0.0.1:${mockPort}`);
  await page.getByLabel("OpenWA X-API-Key").fill("e2e-openwa-key");
  await page.getByLabel("Session / Instance Name").fill("alv-e2e");
  await page.getByLabel("Webhook HMAC Secret").fill("e2e-hmac-secret");

  await page.getByRole("button", { name: "Save Gateway Settings", exact: true }).click();
  await expect(page.getByText("Settings saved")).toBeVisible();

  // Generate QR Code
  await page.getByRole("button", { name: "Generate QR Code", exact: true }).click();
  await expect(page.getByAltText("WhatsApp Link QR Code")).toBeVisible();
  await page.screenshot({ path: "test-results/whatsapp-settings-qr.png", fullPage: false });

  // Switch to Phone Pairing Code
  await page.getByRole("button", { name: "Phone Pairing Code", exact: true }).click();
  await page.getByLabel("Business Phone Number (with country code)").fill("+919887609999");
  await page.getByRole("button", { name: "Request 8-Char Pairing Code", exact: true }).click();
  await expect(page.getByText("ABCD-EFGH")).toBeVisible();

  // Simulate successful WhatsApp phone scan on gateway and check status + test message
  mockState.sessionStatus = "connected";
  await page.getByRole("button", { name: "Check Status", exact: true }).click();
  await expect(page.getByText("Connected · +919887609999")).toBeVisible();

  await page.getByLabel("Recipient WhatsApp Number").fill("9887609999");
  await page.getByLabel("Test Message").fill("Live CRM ping");
  await page.getByRole("button", { name: "Send Test Message", exact: true }).click();
  await expect(page.getByText(/Test message sent/i)).toBeVisible();
  expect(mockState.sentTexts.some((t) => t.chatId === "919887609999@c.us" && t.text === "Live CRM ping")).toBe(true);

  // 2. Inbound unknown WhatsApp webhook: HMAC security check + /chat ONLY (no auto-lead in /leads)
  const suffix = Date.now().toString().slice(-5);
  const unknownDigits = `98123${suffix}`;
  const webhookPayload = JSON.stringify({
    event: "message.received",
    data: {
      id: `ext-inbound-${suffix}`,
      from: `91${unknownDigits}@c.us`,
      pushName: `Walkin Visitor ${suffix}`,
      body: `Need quote for Sony 4K projector (${suffix})`,
      fromMe: false,
      timestamp: Math.floor(Date.now() / 1000),
    },
  });

  // Tampered HMAC must reject 401
  const badWebhookRes = await request.post(`${baseURL}/api/backend/functions/whatsapp-webhook`, {
    headers: {
      "Content-Type": "application/json",
      "X-OpenWA-Signature": "sha256=" + "0".repeat(64),
    },
    data: webhookPayload,
  });
  expect(badWebhookRes.status()).toBe(401);

  // Valid HMAC succeeds
  const validSig =
    "sha256=" + crypto.createHmac("sha256", "e2e-hmac-secret").update(webhookPayload).digest("hex");
  const goodWebhookRes = await request.post(`${baseURL}/api/backend/functions/whatsapp-webhook`, {
    headers: {
      "Content-Type": "application/json",
      "X-OpenWA-Signature": validSig,
    },
    data: webhookPayload,
  });
  expect(goodWebhookRes.ok()).toBeTruthy();

  // Confirm unknown phone was NOT auto-inserted into leads table
  const leadsCheck = await dataQuery(request, "leads", "select", {}, [eq("phone", `91${unknownDigits}`)]);
  expect((leadsCheck || []).length).toBe(0);

  // Open /chat -> select WhatsApp filter -> click thread -> verify message + Add to Leads button
  await page.goto(`${baseURL}/chat`, { waitUntil: "networkidle" });
  const chatRow = page.getByText(`Walkin Visitor ${suffix}`).first();
  await expect(chatRow).toBeVisible();
  await chatRow.click();
  await expect(page.getByText(`Need quote for Sony 4K projector (${suffix})`).last()).toBeVisible();
  await page.screenshot({ path: "test-results/whatsapp-chat-desktop.png", fullPage: false });

  // Mobile overflow check on /chat
  await page.setViewportSize({ width: 390, height: 844 });
  const mobileOverflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(mobileOverflow).toBeLessThanOrEqual(1);
  await page.screenshot({ path: "test-results/whatsapp-mobile.png", fullPage: false });
  await page.setViewportSize({ width: 1440, height: 900 });

  // Manually promote unknown WhatsApp chat to Leads
  await page.getByRole("button", { name: "Add to Leads", exact: true }).click();
  await expect(page.getByText(/Added .* to Leads/i)).toBeVisible();

  const promotedLeads = await dataQuery(request, "leads", "select", {}, [eq("phone", `91${unknownDigits}`)]);
  expect(promotedLeads.length).toBe(1);
  cleanup.leads.push(promotedLeads[0].id);

  // Track synthetic chat_conversations / whatsapp_conversations for cleanup
  const chatRows = await dataQuery(request, "chat_conversations", "select", {}, [eq("whatsapp_phone", `91${unknownDigits}`)]);
  chatRows?.forEach((r) => cleanup.chatConversations.push(r.id));
  const waRows = await dataQuery(request, "whatsapp_conversations", "select", {}, [eq("phone_number", `91${unknownDigits}`)]);
  waRows?.forEach((r) => cleanup.waConversations.push(r.id));

  // 3. Direct Quotation PDF send over WhatsApp gateway via API & SendDocumentDrawer
  const cust = await dataQuery(request, "customers", "insert", {
    name: `WA Quote Client ${suffix}`,
    phone: `91${unknownDigits}`,
    email: `wa-quote-${suffix}@example.test`,
  });
  cleanup.customers.push(cust.id);

  const quote = await dataQuery(request, "quotations", "insert", {
    customer_id: cust.id,
    quotation_number: `QTN-WA-${suffix}`,
    status: "draft",
    subtotal: 50000,
    gst_amount: 9000,
    total: 59000,
  });
  cleanup.quotations.push(quote.id);

  await page.goto(`${baseURL}/sales/${quote.id}`, { waitUntil: "networkidle" });
  const sendBtn = page.getByRole("button", { name: /Send Quotation/i }).first();
  await expect(sendBtn).toBeVisible();
  await sendBtn.click();
  const waPdfBtn = page.getByRole("button", { name: "Send PDF on WhatsApp", exact: true });
  await expect(waPdfBtn).toBeVisible();
  await page.waitForTimeout(350);
  await page.screenshot({ path: "test-results/whatsapp-send-doc-drawer.png", fullPage: false });
  await waPdfBtn.click();
  await expect(page.getByText(/sent on WhatsApp/i)).toBeVisible();
  expect(mockState.sentDocuments.some((d) => String(d.filename || "").includes(`QTN-WA-${suffix}.pdf`))).toBe(true);

  expect(errors, `Browser console/page errors: ${errors.join("\n")}`).toEqual([]);
});
