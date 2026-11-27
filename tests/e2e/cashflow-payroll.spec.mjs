import { test as base, expect } from "@playwright/test";
import fs from "node:fs";

const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const email = process.env.E2E_EMAIL ?? "admin@alvstore.in";
const password = process.env.E2E_PASSWORD ?? "admin123";

let state;
let token;
const created = [];
const preExistingCashDays = [];

const test = base.extend({
  storageState: async ({}, use) => use(state ?? { cookies: [], origins: [] }),
});

const dateKey = (date) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);

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
  const order = [
    "payroll_advance_recoveries",
    "payroll",
    "employee_advances",
    "finance_transactions",
    "attendance_records",
    "daily_cash_control",
    "employees",
  ];
  for (const table of order) {
    for (const item of created.filter((c) => c.table === table)) {
      await request
        .post("/api/backend/data/query", {
          headers: { Authorization: `Bearer ${token}` },
          data: { table, op: "delete", filters: [eq("id", item.id)] },
        })
        .catch(() => {});
    }
  }
  for (const prev of preExistingCashDays) {
    const { id, created_at, ...rest } = prev;
    await request
      .post("/api/backend/data/query", {
        headers: { Authorization: `Bearer ${token}` },
        data: { table: "daily_cash_control", op: "insert", values: rest },
      })
      .catch(() => {});
  }
});

test("settings split console, cash flow carry-forward + sync + PDF, and attendance-linked payroll", async ({
  page,
  request,
}) => {
  const errors = collectErrors(page);
  const run = Date.now();
  const today = dateKey(new Date());
  const yesterday = dateKey(new Date(Date.now() - 86_400_000));

  // ── 1. Settings Split Console Verification ─────────────────────────────────
  await page.goto("/settings", { waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { name: "Settings", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Upload avatar for / })).toHaveCount(1);

  const filterInput = page.getByPlaceholder("Filter settings...");
  await filterInput.fill("smtp");
  await expect(page.getByRole("button", { name: /Email \/ SMTP/i })).toBeVisible();
  await page.getByRole("button", { name: "Clear settings filter" }).click();
  await noOverflow(page, "/settings");

  // ── 2. Cash Flow Carry-Forward, Manual + Auto Sync, Search & Audit PDF ─────
  // Snapshot any pre-existing today/yesterday rows so this test runs cleanly without losing prior data.
  for (const dk of [yesterday, today]) {
    const existingRows = await data(request, "daily_cash_control", "select", undefined, [eq("date", dk)]);
    for (const row of existingRows || []) {
      preExistingCashDays.push(row);
      await data(request, "daily_cash_control", "delete", undefined, [eq("id", row.id)]);
    }
  }

  const yestRow = await data(request, "daily_cash_control", "insert", {
    date: yesterday,
    opening_cash: 3000,
    previous_closing: 3000,
    pos_total: 1250,
    expected_closing: 4250,
    closing_cash: 4250,
    difference: 0,
    status: "closed",
    staff_name: "E2E Prior Shift",
    notes: "E2E Closed Yesterday",
  });
  created.push({ table: "daily_cash_control", id: yestRow.id });

  await page.goto("/finance", { waitUntil: "networkidle" });
  await page.getByRole("tab", { name: /Cash Control/i }).click();
  await expect(page.getByRole("button", { name: /Open Day \(Carry ₹4,250\)/ })).toBeVisible();

  await page.getByRole("button", { name: /^Open Day$/ }).click();
  await expect(page.getByText(/Open Day —/)).toBeVisible();
  await expect(page.getByLabel("Opening Cash Amount")).toHaveValue("4250");
  await page.getByRole("button", { name: /^Open Day$/ }).last().click();
  await expect(page.getByText(/Day opened with carried-forward balance/i)).toBeVisible();

  // Track today's newly created cash control row for teardown
  const todayCashRows = await data(request, "daily_cash_control", "select", undefined, [eq("date", today)]);
  if (todayCashRows?.[0]) created.push({ table: "daily_cash_control", id: todayCashRows[0].id });

  // Record Manual Cash Income via UI
  await page.getByRole("button", { name: "Record Income", exact: true }).click();
  await page.getByLabel("Amount *").fill("750");
  await page.getByLabel("Reference").fill(`E2E-MAN-${run}`);
  await page.getByLabel("Description / Remarks").fill(`E2E Manual Cash Income ${run}`);
  await page.getByRole("button", { name: "Record Income", exact: true }).last().click();
  await expect(page.getByText(/Manual cash income recorded/i)).toBeVisible();

  // Trigger Auto POS Cash Sale twice with identical source_id -> idempotent (no 2x count)
  const syncPayload = {
    entry_source: "pos",
    source_id: `e2e-pos-${run}`,
    type: "income",
    amount: 1250,
    date: today,
    payment_mode: "cash",
    category_name: "POS Sales",
    reference: `POS-E2E-${run}`,
    description: `E2E Auto POS Cash ${run}`,
    staff_name: "E2E Cashier",
  };
  const sync1 = await request.post("/api/backend/functions/finance-sync", {
    headers: { Authorization: `Bearer ${token}` },
    data: syncPayload,
  });
  expect(sync1.ok()).toBeTruthy();
  const sync1Body = await sync1.json();
  expect(sync1Body.deduplicated).toBe(false);
  if (sync1Body.transaction?.id) created.push({ table: "finance_transactions", id: sync1Body.transaction.id });

  const sync2 = await request.post("/api/backend/functions/finance-sync", {
    headers: { Authorization: `Bearer ${token}` },
    data: syncPayload,
  });
  expect(sync2.ok()).toBeTruthy();
  const sync2Body = await sync2.json();
  expect(sync2Body.deduplicated).toBe(true);

  // Track the manual transaction too for clean teardown
  const manTxns = await data(request, "finance_transactions", "select", undefined, [eq("reference", `E2E-MAN-${run}`)]);
  for (const tx of manTxns || []) created.push({ table: "finance_transactions", id: tx.id });

  // Sync drawer UI & check carried-forward expected balance = 4250 + 750 + 1250 = 6250
  await page.getByRole("button", { name: "Sync Drawer", exact: true }).click();
  await expect(page.getByText("₹6,250").first()).toBeVisible();
  await page.screenshot({ path: "test-results/finance-cash-control-desktop.png", animations: "disabled" });

  // Verify breakdown drawer + search
  await page.getByPlaceholder("Search date, staff, notes, ref or TXN ID...").fill("Auto Sync");
  const detailsBtn = page.getByRole("button", { name: "Details", exact: true }).first();
  if (await detailsBtn.isVisible().catch(() => false)) {
    await detailsBtn.click();
    await expect(page.getByText(`POS-E2E-${run}`)).toBeVisible();
    await expect(page.getByText(`E2E-MAN-${run}`)).toBeVisible();
    await page.keyboard.press("Escape");
  }
  await page.getByPlaceholder("Search date, staff, notes, ref or TXN ID...").fill("");

  // Mobile overflow + screenshot on Cash Control
  await page.setViewportSize({ width: 390, height: 844 });
  await noOverflow(page, "/finance (390px)");
  await page.screenshot({ path: "test-results/finance-cash-control-mobile.png", animations: "disabled" });
  await page.setViewportSize({ width: 1440, height: 1000 });

  // Cashflow Audit PDF verification
  const cashPdfRes = await request.get(
    `/api/backend/functions/cashflow-audit-pdf?from=${yesterday}&to=${today}&download=1`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  expect(cashPdfRes.status()).toBe(200);
  expect(cashPdfRes.headers()["content-type"]).toContain("application/pdf");
  const cashPdfBuf = await cashPdfRes.body();
  expect(cashPdfBuf.subarray(0, 5).toString()).toBe("%PDF-");

  // ── 3. Attendance Paid Leave + Employee Advances + Payroll Settlement + PDF ─
  const preExistingTodayAtt = await data(request, "attendance_records", "select", undefined, [eq("date", today)]);
  const preExistingAttIds = new Set((preExistingTodayAtt || []).map((a) => a.id));

  const emp = await data(request, "employees", "insert", {
    name: `E2E Staff ${run}`,
    role: "Technician",
    department: "AV Bench",
    salary: 90000,
    status: "active",
  });
  created.push({ table: "employees", id: emp.id });

  // Verify explicit Paid Leave persistence on /attendance
  await page.goto("/attendance", { waitUntil: "networkidle" });
  const empRow = page.locator("tr", { hasText: emp.name });
  await expect(empRow).toBeVisible();
  await empRow.getByRole("combobox").click();
  await page.getByRole("option", { name: "Paid Leave", exact: true }).click();
  await page.getByRole("button", { name: /Save All/i }).click();
  await expect(page.getByText(/Saved attendance for/i)).toBeVisible();

  const allTodayAttAfter = await data(request, "attendance_records", "select", undefined, [eq("date", today)]);
  for (const a of allTodayAttAfter || []) {
    if (!preExistingAttIds.has(a.id)) created.push({ table: "attendance_records", id: a.id });
  }
  const savedAtt = (allTodayAttAfter || []).filter((a) => a.employee_id === emp.id);
  expect(savedAtt.length).toBeGreaterThanOrEqual(1);
  expect(savedAtt[0].status).toBe("paid_leave");

  await page.goto("/payroll", { waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { name: "Payroll & Advances", exact: true })).toBeVisible();

  // Issue Cash Advance (₹2,000)
  await page.getByRole("button", { name: "Issue Advance", exact: true }).click();
  await page.getByRole("combobox", { name: /Employee/i }).click();
  await page.getByRole("option", { name: new RegExp(emp.name) }).click();
  await page.getByLabel("Advance Amount (₹) *").fill("2000");
  await page.getByRole("button", { name: "Issue & Post Expense", exact: true }).click();
  await expect(page.getByText(/Advance .* issued/i)).toBeVisible();

  const issuedAdvs = await data(request, "employee_advances", "select", undefined, [eq("employee_id", emp.id)]);
  expect(issuedAdvs?.length).toBe(1);
  expect(Number(issuedAdvs[0].remaining_amount)).toBe(2000);
  created.push({ table: "employee_advances", id: issuedAdvs[0].id });
  if (issuedAdvs[0].finance_transaction_id) {
    created.push({ table: "finance_transactions", id: issuedAdvs[0].finance_transaction_id });
  }

  // Advances Ledger visual check + screenshot
  await page.getByRole("tab", { name: /Advances Ledger/i }).click();
  await expect(page.getByText(issuedAdvs[0].advance_number)).toBeVisible();
  await page.screenshot({ path: "test-results/payroll-advances-desktop.png", animations: "disabled" });

  // Switch to Monthly Run, Generate Slip (linking Paid Leave + ₹2,000 Advance), then Mark Paid
  await page.getByRole("tab", { name: /Monthly Run/i }).click();
  await page.getByPlaceholder("Search staff, role, slip #...").fill(emp.name);
  const payRow = page.locator("tr", { hasText: emp.name });
  await expect(payRow).toBeVisible();
  await payRow.getByRole("button", { name: "Generate", exact: true }).click();
  await expect(page.getByText(/Paid Leave: 1/)).toBeVisible();
  await page.getByRole("button", { name: "Generate Slip", exact: true }).click();
  await expect(page.getByText(/Salary slip (generated|updated)/i)).toBeVisible();
  await page.screenshot({ path: "test-results/payroll-desktop.png", animations: "disabled" });

  await payRow.getByRole("button", { name: "Mark Paid", exact: true }).click();
  await page.getByRole("button", { name: "Mark Paid & Sync Finance", exact: true }).click();
  await expect(page.getByText(/marked paid/i)).toBeVisible();

  // Verify payroll settlement DB state + recovery + branded PDF slip
  const payrollRows = await data(request, "payroll", "select", undefined, [eq("employee_id", emp.id)]);
  expect(payrollRows?.length).toBe(1);
  expect(payrollRows[0].payment_status).toBe("paid");
  expect(Number(payrollRows[0].advance_deduction)).toBe(2000);
  created.push({ table: "payroll", id: payrollRows[0].id });
  if (payrollRows[0].finance_transaction_id) {
    created.push({ table: "finance_transactions", id: payrollRows[0].finance_transaction_id });
  }

  const recoveries = await data(request, "payroll_advance_recoveries", "select", undefined, [
    eq("payroll_id", payrollRows[0].id),
  ]);
  for (const r of recoveries || []) created.push({ table: "payroll_advance_recoveries", id: r.id });

  const settledAdv = await data(request, "employee_advances", "select", undefined, [eq("id", issuedAdvs[0].id)]);
  expect(Number(settledAdv[0].remaining_amount)).toBe(0);
  expect(settledAdv[0].status).toBe("recovered");

  // Salary History tab verification
  await page.getByRole("tab", { name: /Salary History/i }).click();
  await expect(page.getByText(payrollRows[0].slip_number)).toBeVisible();

  // Payslip PDF bytes verification
  const slipPdfRes = await request.get(`/api/backend/functions/payroll-pdf?id=${payrollRows[0].id}&download=1`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(slipPdfRes.status()).toBe(200);
  expect(slipPdfRes.headers()["content-type"]).toContain("application/pdf");
  const slipPdfBuf = await slipPdfRes.body();
  expect(slipPdfBuf.subarray(0, 5).toString()).toBe("%PDF-");

  await noOverflow(page, "/payroll (1440px)");
  await page.setViewportSize({ width: 390, height: 844 });
  await noOverflow(page, "/payroll (390px)");
  await page.setViewportSize({ width: 1440, height: 1000 });
  expect(errors).toEqual([]);
});
