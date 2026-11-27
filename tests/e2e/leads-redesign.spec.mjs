import { test as base, expect } from "@playwright/test";
import fs from "node:fs";

const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const email = process.env.E2E_EMAIL ?? "admin@alvstore.in";
const password = process.env.E2E_PASSWORD ?? "admin123";

let state;
let token;
const created = [];

const test = base.extend({
  storageState: async ({}, use) => use(state ?? { cookies: [], origins: [] }),
});

const eq = (col, val) => ({ type: "op", col, op: "eq", val });

async function data(request, table, op, values, filters = []) {
  const response = await request.post("/api/backend/data/query", {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      table,
      op,
      values,
      filters,
      ...(op === "insert" ? { select: "*", single: "single" } : { select: "*" }),
    },
  });
  const body = await response.json();
  expect(response.ok(), `${table} ${op}: ${JSON.stringify(body)}`).toBeTruthy();
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

function collectErrors(page) {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("response", async (response) => {
    if (response.status() >= 400 && response.url().includes("/api/backend/")) {
      errors.push(`${response.status()} ${response.url()} ${await response.text().catch(() => "")}`);
    }
  });
  return errors;
}

async function noOverflow(page, label) {
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth - innerWidth), {
      message: `${label} horizontal overflow`,
    })
    .toBeLessThanOrEqual(1);
}

test.beforeEach(async ({ context }) => localAssets(context));

test.beforeAll(async ({ request, browser }) => {
  fs.mkdirSync("test-results", { recursive: true });
  const loginRes = await request.post("/api/backend/auth/login", { data: { email, password } });
  expect(loginRes.ok(), "Admin login for E2E must succeed").toBeTruthy();
  const auth = await loginRes.json();
  token = auth.access_token;

  const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  await localAssets(context);
  try {
    const page = await context.newPage();
    await page.goto(new URL("/login", baseURL).href, { waitUntil: "networkidle" });
    await page.locator("#email").fill(email);
    await page.locator("#password").fill(password);
    await page.getByRole("button", { name: "Sign In", exact: true }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole("heading", { name: "Dashboard", exact: true })).toBeVisible();
    await page.waitForLoadState("networkidle");
    state = await context.storageState();
  } finally {
    await context.close();
  }
});

test.afterAll(async ({ request }) => {
  if (!token) return;
  for (const item of created) {
    if (item.table === "leads") {
      await request
        .post("/api/backend/functions/leads-delete", {
          headers: { Authorization: `Bearer ${token}` },
          data: { ids: [item.id] },
        })
        .catch(() => {});
    } else {
      await request
        .post("/api/backend/data/query", {
          headers: { Authorization: `Bearer ${token}` },
          data: { table: item.table, op: "delete", filters: [eq("id", item.id)] },
        })
        .catch(() => {});
    }
  }
});

test("2026 /leads command console: full cards, widgets, bot deletion, views, and Convert -> Quotation handoff", async ({
  page,
  request,
}) => {
  const errors = collectErrors(page);
  const run = Date.now();
  const uniquePhone = `98${String(run).slice(-8)}`;
  const legitEmail = `aarav.${run}@example.test`;

  // Seed realistic website lead + 2 spam/bot leads
  const legitLead = await data(request, "leads", "insert", {
    name: `Aarav Mehta ${run}`,
    phone: uniquePhone,
    email: legitEmail,
    source: "website",
    status: "new",
    pipeline_stage: "new",
    score: 60,
    expected_value: 450000,
    notes: "Topic: Dolby Atmos Home Theater\nCity: Udaipur\n\nDedicated 18x14 basement cinema room.",
  });
  created.push({ table: "leads", id: legitLead.id });

  const bot1 = await data(request, "leads", "insert", {
    name: `asdf test ${run}`,
    phone: "9999999999",
    email: `bot1.${run}@mailinator.com`,
    source: "website",
    status: "new",
    pipeline_stage: "new",
    score: 10,
    notes: "Cheap SEO traffic https://spam.example.com",
  });
  created.push({ table: "leads", id: bot1.id });

  const bot2 = await data(request, "leads", "insert", {
    name: `Fake Bot ${run}`,
    phone: "1234567890",
    email: `bot2.${run}@tempmail.com`,
    source: "website",
    status: "new",
    pipeline_stage: "new",
    score: 10,
    notes: "Automated test probe",
  });
  created.push({ table: "leads", id: bot2.id });

  await page.goto("/leads", { waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { name: "Lead Management", exact: true })).toBeVisible();
  await expect(page.locator("[data-metric-strip]")).toBeVisible();
  await expect(page.getByText("Stage Funnel", { exact: true })).toBeVisible();
  await expect(page.getByText("Channel Mix", { exact: true })).toBeVisible();
  await expect(page.getByText("Follow-Up Hygiene & Bot Watch", { exact: true })).toBeVisible();

  // Verify FULL information is displayed directly on the Pipeline card (not partial!)
  const legitCard = page.locator(`[data-lead-card="${legitLead.id}"]`);
  await expect(legitCard).toBeVisible();
  await expect(legitCard.getByText(uniquePhone)).toBeVisible();
  await expect(legitCard.getByText(legitEmail)).toBeVisible();
  await expect(legitCard.getByText("Dolby Atmos Home Theater")).toBeVisible();
  await expect(legitCard.getByText("Udaipur")).toBeVisible();
  await expect(legitCard.getByText(/18x14 basement cinema/i)).toBeVisible();
  await expect(legitCard.getByText("₹4,50,000")).toBeVisible();

  // Capture Donezo Light & Obsidian Dark visual screenshots for review
  await noOverflow(page, "/leads pipeline (1440px)");
  await page.screenshot({ path: "test-results/leads-pipeline-desktop.png", animations: "disabled" });

  // Switch briefly to Donezo light palette to verify light mode contrast/visual polish too
  await page.getByRole("button", { name: "Change theme", exact: true }).click();
  await page.getByRole("menuitem", { name: "Donezo", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "donezo");
  await page.screenshot({ path: "test-results/leads-pipeline-light-desktop.png", animations: "disabled" });
  // Switch back to Obsidian
  await page.getByRole("button", { name: "Change theme", exact: true }).click();
  await page.getByRole("menuitem", { name: "Obsidian", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "obsidian");

  // Single Delete of Bot 1 directly from its Pipeline card
  await page.getByRole("button", { name: `Delete lead ${bot1.name}`, exact: true }).first().click();
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(page.getByText(/Deleted 1 lead/i)).toBeVisible();
  await expect(page.locator(`[data-lead-card="${bot1.id}"]`)).toHaveCount(0);

  // Switch to Table View -> Filter Flagged -> Select Remaining Bot 2 & Bulk Delete
  await page.getByRole("button", { name: "Table", exact: true }).click();
  await expect(page.getByRole("table")).toBeVisible();
  await page.screenshot({ path: "test-results/leads-table-desktop.png", animations: "disabled" });
  await page.getByRole("checkbox", { name: `Select lead ${bot2.name}`, exact: true }).check();
  await page.getByRole("button", { name: /Delete Selected \(1\)/i }).click();
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(page.getByText(/Deleted 1 lead/i)).toBeVisible();
  await expect(page.getByText(bot2.name)).toHaveCount(0);

  // Verify Split View renders clean queue + inline inspector
  await page.getByRole("button", { name: "Split View", exact: true }).click();
  await expect(page.getByText(/Lead Queue/i)).toBeVisible();
  await expect(page.getByText(/Activity Timeline/i)).toBeVisible();

  // Switch back to Pipeline, advance stage New -> Contacted, then Convert & Quote -> /sales/new?customerId=...
  await page.getByRole("button", { name: "Pipeline", exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await noOverflow(page, "/leads pipeline (390px)");
  await page.screenshot({ path: "test-results/leads-pipeline-mobile.png", animations: "disabled" });
  await page.setViewportSize({ width: 1440, height: 1000 });

  await legitCard.getByRole("button", { name: "Contacted", exact: true }).click();
  await expect(page.getByText(/Moved .* to Contacted/i)).toBeVisible();

  // Convert & Quote creates/links Customer without duplicates and opens /sales/new?customerId=...
  await page.locator(`[data-lead-card="${legitLead.id}"]`).getByRole("button", { name: "Convert & Quote", exact: true }).click();
  await expect(page).toHaveURL(/\/sales\/new\?customerId=/);
  const convertedUrl = new URL(page.url());
  const customerId = convertedUrl.searchParams.get("customerId");
  expect(customerId).toBeTruthy();
  if (customerId) created.push({ table: "customers", id: customerId });

  // Verify lead now has converted status and customer record has parsed City = Udaipur
  const updatedLeads = await data(request, "leads", "select", undefined, [eq("id", legitLead.id)]);
  expect(updatedLeads[0].pipeline_stage).toBe("converted");
  expect(updatedLeads[0].converted_customer_id).toBe(customerId);
  const custRows = await data(request, "customers", "select", undefined, [eq("id", customerId)]);
  expect(custRows[0].city).toBe("Udaipur");

  expect(errors).toEqual([]);
});
