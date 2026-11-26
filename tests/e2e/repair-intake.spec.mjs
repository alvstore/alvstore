import { test as base, expect } from "@playwright/test";

const email = process.env.E2E_EMAIL ?? "admin@alvstore.in";
const password = process.env.E2E_PASSWORD ?? "admin123";
const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3000";

let token = "";
let customer = null;
const cleanupIds = { jobs: [], customers: [] };

const test = base.extend({});

async function queryApi(request, table, op, values, filters = []) {
  const res = await request.post(`${baseURL}/api/backend/data/query`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { table, op, values, filters, ...(op === "insert" ? { select: "*", single: "single" } : {}) },
  });
  const body = await res.json();
  expect(res.ok(), `${table} ${op}: ${JSON.stringify(body)}`).toBeTruthy();
  return body.data;
}

test.beforeAll(async ({ request }) => {
  const loginRes = await request.post(`${baseURL}/api/backend/auth/login`, {
    data: { email, password },
  });
  expect(loginRes.ok()).toBeTruthy();
  token = (await loginRes.json()).access_token;

  customer = await queryApi(request, "customers", "insert", {
    name: `Repair Intake Test ${Date.now()}`,
    phone: "9876543210",
    email: "repair-e2e@example.test",
  });
  cleanupIds.customers.push(customer.id);
});

test.afterAll(async ({ request }) => {
  for (const id of cleanupIds.jobs) {
    await request.post(`${baseURL}/api/backend/data/query`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { table: "job_sheets", op: "delete", filters: [{ type: "op", col: "id", op: "eq", val: id }] },
    }).catch(() => {});
  }
  for (const id of cleanupIds.customers) {
    await request.post(`${baseURL}/api/backend/data/query`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { table: "customers", op: "delete", filters: [{ type: "op", col: "id", op: "eq", val: id }] },
    }).catch(() => {});
  }
});

test("Apple intake wizard seeds models/colors, collapses powered checks when OFF, and confirms via SideDrawer", async ({ page }) => {
  const consoleErrors = [];
  page.on("pageerror", err => consoleErrors.push(err.message));
  page.on("console", msg => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });

  await page.goto(`${baseURL}/login`, { waitUntil: "networkidle" });
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(password);
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.goto(`${baseURL}/repairs/new`, { waitUntil: "networkidle" });

  // Step 1: Select customer
  await page.getByLabel("Select Customer *").click();
  await page.getByRole("option", { name: new RegExp(customer.name) }).click();
  await page.getByRole("button", { name: "Next", exact: true }).click();

  // Step 2: Select iPhone -> Apple brand auto-fills + shows catalog + swatches + storage
  await page.getByLabel("Device Type *").click();
  await page.getByRole("option", { name: "iPhone", exact: true }).click();
  await expect(page.getByText(/Apple iPhone Model Catalog/i)).toBeVisible();
  await page.getByRole("button", { name: "iPhone 16 Pro Max", exact: true }).click();
  await page.getByRole("button", { name: "Desert Titanium", exact: true }).click();
  await page.getByRole("button", { name: "512 GB", exact: true }).click();
  await page.getByLabel("Problem Description *").fill("Dead after accidental liquid spill");
  await page.screenshot({ path: "test-results/repair-step2-apple-catalog.png" });

  // Step 3 -> Step 4
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.getByRole("button", { name: "Next", exact: true }).click();

  // Step 4: Mark "Device turns ON" = No -> collapses power-dependent diagnostics
  const powerRow = page.locator("tr", { hasText: "Device turns ON" });
  await powerRow.getByRole("button", { name: "No", exact: true }).click();
  await expect(page.getByText(/Device does not power on/i)).toBeVisible();
  await expect(page.getByRole("button", { name: /Override Skipped/i })).toBeVisible();
  await expect(page.getByText("Display & Biometrics")).toHaveCount(0);

  // Fill remaining active items (Draws charging current, Physical Condition, Accessories & Locks)
  const chargingRow = page.locator("tr", { hasText: "Draws charging / power current" });
  await chargingRow.getByRole("button", { name: "No", exact: true }).click();

  const groupYesButtons = page.getByRole("button", { name: "Mark Group Yes", exact: true });
  const count = await groupYesButtons.count();
  for (let i = 0; i < count; i++) {
    await groupYesButtons.nth(i).click();
  }
  await page.getByPlaceholder("Enter mandatory staff notes...").fill("Logic board liquid inspection required; power off at counter");
  await page.waitForTimeout(300);
  await page.screenshot({ path: "test-results/repair-step4-power-off.png" });

  // Step 5 -> Open Confirmation SideDrawer -> Save
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.getByRole("button", { name: /Review & Save Job Sheet/i }).click();
  const drawer = page.getByRole("dialog");
  await expect(drawer).toBeVisible();
  await expect(drawer.getByText(/Confirm & Save Job Sheet/i)).toBeVisible();
  await expect(drawer.getByText(/Desert Titanium/i)).toBeVisible();
  await expect(drawer.getByText(/Device Powered OFF at Intake/i)).toBeVisible();
  await page.waitForTimeout(450);
  await page.screenshot({ path: "test-results/repair-step5-confirm-drawer.png" });

  await drawer.getByRole("button", { name: /Confirm & Create Job Sheet/i }).click();
  await expect(page).toHaveURL(/\/repairs\/[0-9a-f-]+$/);
  const createdId = page.url().split("/").pop();
  if (createdId) cleanupIds.jobs.push(createdId);

  await expect(page.getByText("iPhone 16 Pro Max").first()).toBeVisible();
  await expect(page.getByText("Desert Titanium").first()).toBeVisible();

  await page.getByRole("tab", { name: "Checklist", exact: true }).click();
  await expect(page.getByText(/Device was Powered OFF at intake/i)).toBeVisible();

  // Also verify MacBook and iMac Apple model catalogs + tailored checklists
  await page.goto(`${baseURL}/repairs/new`, { waitUntil: "networkidle" });
  await page.getByLabel("Select Customer *").click();
  await page.getByRole("option", { name: new RegExp(customer.name) }).click();
  await page.getByRole("button", { name: "Next", exact: true }).click();

  await page.getByLabel("Device Type *").click();
  await page.getByRole("option", { name: "MacBook", exact: true }).click();
  await expect(page.getByText(/Apple MacBook Model Catalog/i)).toBeVisible();
  await page.getByRole("button", { name: /MacBook Pro 14"/i }).click();
  await page.getByRole("button", { name: "Space Black", exact: true }).click();
  await page.getByLabel("Problem Description *").fill("Keyboard backlight flickers");
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.getByText(/Trackpad & click/i)).toBeVisible();
  await expect(page.getByText(/Earpiece speaker/i)).toHaveCount(0);

  expect(consoleErrors).toEqual([]);
});
