import { test as base, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { httpsPreview } from "./https-preview.mjs";

let state, token;
const records = [], fixtures = {};
const email = process.env.E2E_EMAIL ?? "admin@alvstore.in";
const password = process.env.E2E_PASSWORD ?? "admin123";
const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const authCookieNames = ["__Host-alv.session-token", "__Host-alv.csrf-token", "__Host-alv.callback-url"];
const test = base.extend({ storageState: async ({}, use) => use(state ?? { cookies: [], origins: [] }) });
const dateKey = date => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
const tomorrow = () => new Date(Date.now() + 86400000);
const dayLabel = date => {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kolkata", weekday: "long", day: "numeric", month: "long" }).formatToParts(date).map(part => [part.type, part.value]));
  return `${parts.weekday} ${parts.day} ${parts.month}`;
};
async function data(request, table, op, values, filters = []) {
  const response = await request.post("/api/backend/data/query", { headers: { Authorization: `Bearer ${token}` }, data: { table, op, values, filters, ...(op === "insert" ? { select: "*", single: "single" } : {}) } });
  const body = await response.json();
  expect(response.ok(), `${table} ${op}: ${JSON.stringify(body)}`).toBeTruthy();
  return body.data;
}
const eq = (col, val) => ({ type: "op", col, op: "eq", val });
async function create(request, table, values) {
  const row = await data(request, table, "insert", values);
  records.unshift({ table, id: row.id });
  return row;
}
async function login(page) {
  await page.goto(new URL("/login", baseURL).href, { waitUntil: "networkidle" });
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(password);
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("heading", { name: "Dashboard", exact: true })).toBeVisible();
}
async function localAssets(context) {
  await context.route(/^https?:\/\//, route => {
    const host = new URL(route.request().url()).hostname;
    return [new URL(baseURL).hostname, "localhost", "127.0.0.1", "arena.test"].includes(host) || host.endsWith(".e2b.app") ? route.continue() : route.fulfill({ status: 200, contentType: "text/plain", body: "" });
  });
}
function collectErrors(page) {
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
  page.on("response", async response => {
    if (response.status() >= 400 && response.url().includes("/api/backend/")) errors.push(`${response.status()} ${response.request().postData()} ${await response.text().catch(() => "")}`);
  });
  return errors;
}
async function noHorizontalOverflow(page, route) {
  // ResizeObserver-based charts need a frame to measure the new container.
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - innerWidth), {
    message: `${route} must fit the viewport`,
  }).toBeLessThanOrEqual(1);
}

async function chartAtRest(chart) {
  // Recharts uses requestAnimationFrame, so screenshot({ animations: "disabled" })
  // does not finish its resize/draw interpolation. Wait for stable geometry.
  await expect(chart.locator("svg.recharts-surface")).toBeVisible();
  let previous = "", stable = 0;
  await expect.poll(async () => {
    const signature = await chart.evaluate(node => JSON.stringify([...node.querySelectorAll("path, clipPath rect")].map(shape => ["d", "x", "y", "width", "height"].map(name => shape.getAttribute(name)))));
    stable = signature === previous ? stable + 1 : 0;
    previous = signature;
    return stable;
  }, { timeout: 6000, intervals: [100], message: "Chart geometry must settle before visual capture" }).toBeGreaterThanOrEqual(3);
}

test.beforeEach(async ({ context }) => localAssets(context));
test.beforeAll(async ({ request, browser }) => {
  const response = await request.post("/api/backend/auth/login", { data: { email, password } });
  expect(response.ok(), "The configured admin must be able to sign in").toBeTruthy();
  const auth = await response.json();
  token = auth.access_token;
  const run = Date.now();
  fixtures.today = dateKey(new Date());
  fixtures.customer = await create(request, "customers", { name: `UI Smoke Customer ${run}`, phone: "9000000000", email: "smoke@example.test", city: "Jodhpur" });
  fixtures.deletable = await create(request, "customers", { name: `UI Delete Customer ${run}` });
  fixtures.product = await create(request, "products", { name: `UI Smoke Product ${run}`, sku: `UI-${run}`, selling_price: 100, stock_quantity: 10 });
  fixtures.quotation = await create(request, "quotations", { quotation_number: "", customer_id: fixtures.customer.id, subtotal: 100, gst_amount: 18, total: 118 });
  await create(request, "quotation_items", { quotation_id: fixtures.quotation.id, product_id: fixtures.product.id, product_name: fixtures.product.name, quantity: 1, unit_price: 100, total: 100 });
  fixtures.invoice = await create(request, "invoices", { customer_id: fixtures.customer.id, subtotal: 100, gst_amount: 18, total: 118, paid_amount: 59, due_date: fixtures.today });
  await create(request, "invoice_items", { invoice_id: fixtures.invoice.id, product_id: fixtures.product.id, product_name: fixtures.product.name, quantity: 1, unit_price: 100, total: 100 });
  fixtures.job = await create(request, "job_sheets", { customer_id: fixtures.customer.id, device_brand: "Apple", device_type: "iPhone", device_model: "iPhone 15", problem_description: "Screen replacement", estimated_completion: fixtures.today, service_charge: 750, total_amount: 885, status: "repair_completed" });
  fixtures.challan = await create(request, "delivery_challans", { customer_id: fixtures.customer.id, invoice_id: fixtures.invoice.id, total: 118 });
  fixtures.task = await create(request, "tasks", { title: `UI Focus Task ${run}`, due_date: fixtures.today, status: "pending", priority: "high" });
  await create(request, "tasks", { title: `UI Completed Task ${run}`, due_date: fixtures.today, status: "completed", priority: "medium" });
  fixtures.event = await create(request, "calendar_events", { title: `UI Event Today ${run}`, start_date: `${fixtures.today}T10:00:00+05:30`, all_day: false, category: "business", created_by: auth.user.id });
  fixtures.nextEvent = await create(request, "calendar_events", { title: `UI Event Tomorrow ${run}`, start_date: `${dateKey(tomorrow())}T11:00:00+05:30`, all_day: false, category: "business", created_by: auth.user.id });
  await create(request, "pos_transactions", { subtotal: 100, total: 118, gst_amount: 18, customer_id: fixtures.customer.id });
  await create(request, "pos_transactions", { subtotal: 200, total: 236, gst_amount: 36, created_at: new Date(Date.now() - 20 * 86400000).toISOString() });
  const account = await create(request, "finance_accounts", { name: `UI Smoke Account ${run}`, type: "cash", opening_balance: 1000, current_balance: 1000 });
  const category = await create(request, "finance_categories", { name: `UI Smoke Expense ${run}`, type: "expense" });
  await create(request, "finance_transactions", { type: "income", amount: 2200, date: fixtures.today, account_id: account.id, created_by: auth.user.id });
  await create(request, "finance_transactions", { type: "expense", amount: 400, date: fixtures.today, account_id: account.id, category_id: category.id, created_by: auth.user.id });
  const context = await browser.newContext({ timezoneId: "Asia/Kolkata" });
  await localAssets(context);
  try { const page = await context.newPage(); await login(page); state = await context.storageState(); }
  finally { await context.close(); }
});
test.afterAll(async ({ request }) => {
  const txIds = records.filter(row => row.table === "finance_transactions").map(row => row.id);
  if (txIds.length) await data(request, "finance_audit_log", "delete", undefined, [{ type: "op", col: "entity_id", op: "in", val: txIds }]);
  for (const row of records) await data(request, row.table, "delete", undefined, [eq("id", row.id)]);
});

test("credentials login sets secure cross-site cookies and survives reload", async ({ browser }) => {
  const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  await localAssets(context);
  const page = await context.newPage(), errors = collectErrors(page);
  try {
    await login(page);
    await page.reload({ waitUntil: "networkidle" });
    await expect(page.getByRole("heading", { name: "Dashboard", exact: true })).toBeVisible();
    for (const name of authCookieNames) expect((await context.cookies()).find(cookie => cookie.name === name)).toMatchObject({ secure: true, sameSite: "None", partitionKey: expect.any(String) });
    expect(errors).toEqual([]);
  } finally { await context.close(); }
});

for (const restricted of [false, true]) test(`HTTPS iframe login, reload and logout work with third-party cookies ${restricted ? "blocked" : "allowed"}`, async ({ browser }) => {
  const preview = await httpsPreview(baseURL);
  const context = await browser.newContext({ ignoreHTTPSErrors: true, storageState: { cookies: [], origins: [] } });
  await localAssets(context);
  const page = await context.newPage(), errors = collectErrors(page);
  try {
    const cdp = await context.newCDPSession(page);
    await cdp.send("Network.enable");
    if (restricted) await cdp.send("Network.setCookieControls", {
      enableThirdPartyCookieRestriction: true, disableThirdPartyCookieMetadata: true, disableThirdPartyCookieHeuristics: true,
    });
    // A control cookie proves that the restricted case really withholds
    // unpartitioned cookies, rather than accidentally re-testing the default.
    await context.addCookies([{ name: "alv-unpartitioned-probe", value: "test-only", url: `https://preview.e2b.app:${new URL(preview.parent).port}`, secure: true, sameSite: "None" }]);
    expect((await context.cookies()).some(cookie => cookie.name === "alv-unpartitioned-probe")).toBeTruthy();
    await page.goto(preview.parent, { waitUntil: "load" });
    const frame = page.frameLocator('iframe[title="ALV preview"]');
    const child = page.frames().find(child => child.url().startsWith("https://preview.e2b.app:"));
    if (restricted) {
      // Some Chromium builds isolate the iframe in a separate CDP target.
      try {
        const childCdp = await context.newCDPSession(child);
        await childCdp.send("Network.enable");
        await childCdp.send("Network.setCookieControls", { enableThirdPartyCookieRestriction: true, disableThirdPartyCookieMetadata: true, disableThirdPartyCookieHeuristics: true });
      } catch (error) {
        if (!error.message.includes("part of the parent frame's session")) throw error;
      }
    }
    const policy = await child.evaluate(() => fetch("/__test/cookie-policy", { cache: "no-store" }).then(response => response.json()));
    expect(policy.unpartitionedProbeReceived, "the TLS server must see the control cookie only when third-party cookies are allowed").toBe(!restricted);
    await expect(frame.getByRole("link", { name: "Open sign-in in a new tab", exact: true })).toHaveAttribute("target", "_blank");
    await frame.locator("#email").fill(email);
    await frame.locator("#password").fill(password);
    await frame.getByRole("button", { name: "Sign In", exact: true }).click();
    await expect(frame.getByRole("heading", { name: "Dashboard", exact: true })).toBeVisible();
    // Reload the authenticated subframe, not the wrapper's initial /login src.
    const dashboard = await frame.locator("html").evaluate(() => location.href);
    const reloaded = page.waitForEvent("framenavigated", { predicate: child => child.url() === dashboard });
    await page.evaluate(url => { document.querySelector("iframe").src = url; }, dashboard);
    await reloaded;
    await expect(frame.getByRole("heading", { name: "Dashboard", exact: true })).toBeVisible();
    const cookies = (await context.cookies()).filter(cookie => cookie.domain === "preview.e2b.app");
    for (const name of authCookieNames) expect(cookies.find(cookie => cookie.name === name)).toMatchObject({ secure: true, sameSite: "None", partitionKey: "https://arena.test" });
    await frame.getByRole("button", { name: "Open account menu", exact: true }).click();
    await frame.getByRole("menuitem", { name: "Sign out", exact: true }).click();
    await expect(frame.getByRole("heading", { name: "Dashboard", exact: true })).not.toBeVisible();
    await expect.poll(async () => (await context.cookies()).some(cookie => cookie.domain === "preview.e2b.app" && cookie.name.startsWith("__Host-alv.session-token"))).toBeFalsy();
    expect(errors).toEqual([]);
  } finally {
    try { await context.close(); }
    finally { await preview.close(); }
  }
});

// Negative cases run in fresh contexts so a pre-existing session cannot hide
// a failed login. None of these tests resets an account or changes a password.
test("a real bad password is rejected as credentials, not as a cookie failure", async ({ browser }) => {
  const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  await localAssets(context);
  const page = await context.newPage();
  try {
    await page.goto(new URL("/login", baseURL).href);
    await page.locator("#email").fill(email);
    await page.locator("#password").fill(`${password}-incorrect-test-value`);
    await page.getByRole("button", { name: "Sign In", exact: true }).click();
    await expect(page.getByRole("alert").filter({ hasText: "Invalid email or password." })).toBeVisible();
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole("button", { name: "Sign In", exact: true })).toBeEnabled();
  } finally { await context.close(); }
});

test("a rejected CSRF check stays protected and explains the cookie fallback", async ({ browser }) => {
  const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  await localAssets(context);
  const page = await context.newPage();
  try {
    // A stale/mismatched form token must still fail the real server check.
    await page.route("**/api/auth/csrf", route => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ csrfToken: "mismatched-test-csrf" }) }));
    await page.goto(new URL("/login", baseURL).href);
    await page.locator("#email").fill(email);
    await page.locator("#password").fill(password);
    await page.getByRole("button", { name: "Sign In", exact: true }).click();
    const error = page.getByRole("alert").filter({ hasText: "sign-in security check" });
    await expect(error).toBeVisible();
    await expect(error).not.toContainText("Invalid");
    const fallback = page.getByRole("link", { name: "Open sign-in in a new tab", exact: true });
    await expect(fallback).toHaveAttribute("href", "/login");
    await expect(fallback).toHaveAttribute("rel", "noopener noreferrer");
    await expect(page).toHaveURL(/\/login$/);
  } finally { await context.close(); }
});

test("a provider availability error is not reported as invalid credentials", async ({ browser }) => {
  const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  await localAssets(context);
  const page = await context.newPage();
  try {
    await page.route("**/api/auth/callback/credentials*", route => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ url: new URL("/login?error=CredentialsSignin&code=service_unavailable", baseURL).href }) }));
    await page.goto(new URL("/login", baseURL).href);
    await page.locator("#email").fill(email);
    await page.locator("#password").fill(password);
    await page.getByRole("button", { name: "Sign In", exact: true }).click();
    await expect(page.getByRole("alert").filter({ hasText: "Sign-in is temporarily unavailable" })).toBeVisible();
    await expect(page).toHaveURL(/\/login$/);
  } finally { await context.close(); }
});

test("a callback without a retained browser session does not navigate to Dashboard", async ({ browser }) => {
  const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  await localAssets(context);
  const page = await context.newPage();
  try {
    await page.route("**/api/auth/session", route => route.fulfill({ status: 200, contentType: "application/json", body: "null" }));
    await page.goto(new URL("/login", baseURL).href);
    await page.locator("#email").fill(email);
    await page.locator("#password").fill(password);
    await page.getByRole("button", { name: "Sign In", exact: true }).click();
    await expect(page.getByRole("alert").filter({ hasText: "the session could not be saved" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Open sign-in in a new tab", exact: true })).toBeVisible();
    await expect(page).toHaveURL(/\/login$/);
  } finally { await context.close(); }
});

function routeInventory() {
  const output = [];
  function walk(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) walk(file);
      else if (entry.name === "page.tsx") output.push("/" + path.relative("src/app", directory).split(path.sep).filter(segment => segment && !segment.startsWith("(")).join("/"));
    }
  }
  walk("src/app"); return output;
}
function resolveRoute(route) {
  for (const [prefix, fixture] of [["customers", "customer"], ["inventory", "product"], ["invoices", "invoice"], ["sales", "quotation"], ["repairs", "job"], ["challans", "challan"]]) if (route.startsWith(`/${prefix}/[id]`)) return route.replace("[id]", fixtures[fixture].id);
  if (route.startsWith("/invoice/public/")) return route.replace("[token]", fixtures.invoice.public_token);
  if (route.startsWith("/sales/public/")) return route.replace("[token]", fixtures.quotation.public_token);
  return route.replace("[token]", fixtures.job.public_token);
}

test("every App Router page renders on mobile and desktop; giant screens last", async ({ page }, testInfo) => {
  test.setTimeout(600_000);
  const errors = collectErrors(page), routes = routeInventory();
  const giant = ["/settings", "/finance", "/apple-pricing", "/repairs/new", "/repairs/[id]", "/repairs/[id]/edit"];
  const ordered = [...routes.filter(route => !giant.includes(route)), ...giant.filter(route => routes.includes(route))];
  const results = [], pending = new Set();
  page.on("request", request => { if (request.url().includes("/api/")) pending.add(request); });
  const settled = request => pending.delete(request);
  page.on("requestfinished", settled); page.on("requestfailed", settled);
  try {
    for (const width of [390, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      for (const route of ordered) {
        const start = errors.length;
        // Next.js link prefetches and polling are not page readiness. Wait for
        // the actual screen and its data instead of networkidle.
        const response = await page.goto(resolveRoute(route), { waitUntil: "load", timeout: 60_000 });
        const boundary = await page.getByRole("heading", { name: "Something went wrong", exact: true }).isVisible();
        const rendered = !boundary && await page.locator("[data-animated-page]").first().waitFor({ state: "visible", timeout: 15000 }).then(() => true, () => false);
        await expect.poll(() => pending.size, { message: `${route} data requests settle`, timeout: 15000 }).toBe(0);
        await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
        results.push({ route, width, status: response.status(), rendered, overflow, errors: errors.slice(start) });
        console.log(`${width}px ${route}: ${response.status()}${!rendered ? " NOT RENDERED" : ""}${overflow ? " OVERFLOW" : ""}${errors.length > start ? " ERRORS" : ""}`);
      }
    }
  } finally {
    await testInfo.attach("route-sweep", { body: JSON.stringify(results, null, 2), contentType: "application/json" });
  }
  expect(errors).toEqual([]);
  expect(results.filter(result => !result.rendered || result.status >= 400), "Every route must render without a boundary").toEqual([]);
  expect(results.filter(result => result.overflow), "No page may overflow its viewport").toEqual([]);
});


test("workload calendar uses persisted task counts and coordinates with the agenda", async ({ page, request }) => {
  const errors = collectErrors(page);
  const tasks = await data(request, "tasks", "select");
  const monthTasks = tasks.filter(task => task.due_date?.startsWith(fixtures.today.slice(0, 7)));
  const completed = monthTasks.filter(task => task.status === "completed").length;
  await page.goto("/dashboard", { waitUntil: "networkidle" });
  const calendar = page.getByRole("region", { name: "Workload calendar", exact: true });
  const agenda = page.getByRole("region", { name: "Your agenda", exact: true });
  const progress = calendar.getByRole("progressbar", { name: "Monthly scheduled-task completion" });
  await expect(progress).toHaveAttribute("aria-valuenow", String(monthTasks.length ? Math.round(completed / monthTasks.length * 100) : 0));
  const todayTasks = tasks.filter(task => task.due_date === fixtures.today);
  await expect(calendar.locator(`[data-workload-day="${fixtures.today}"]`)).toHaveAttribute("aria-label", new RegExp(`: ${todayTasks.length} tasks, ${todayTasks.filter(task => task.status === "completed").length} completed,`));
  const nextDay = dateKey(tomorrow());
  if (!nextDay.startsWith(fixtures.today.slice(0, 7))) await calendar.getByRole("button", { name: "Next workload month" }).click();
  const tomorrowCell = calendar.locator(`[data-workload-day="${nextDay}"]`);
  await tomorrowCell.click();
  await expect(tomorrowCell).toHaveAttribute("aria-pressed", "true");
  await expect(agenda.locator("[data-agenda-date]")).toHaveAttribute("data-agenda-date", nextDay);
  await expect(agenda.getByText(fixtures.nextEvent.title, { exact: true })).toBeVisible();
  await tomorrowCell.press("ArrowLeft");
  const todayCell = calendar.locator(`[data-workload-day="${fixtures.today}"]`);
  await expect(todayCell).toBeFocused();
  await expect(todayCell).toHaveAttribute("aria-pressed", "true");
  await expect(agenda.getByText(fixtures.task.title, { exact: true })).toBeVisible();
  await calendar.getByRole("button", { name: "Next workload month" }).click();
  await expect(todayCell).toHaveCount(0);
  await calendar.getByRole("button", { name: "Today", exact: true }).click();
  await expect(todayCell).toHaveAttribute("aria-pressed", "true");
  expect(errors).toEqual([]);
});


test("workload failures are explicit and can be retried without inventing zero tasks", async ({ page }) => {
  let fail = true;
  const pageErrors = [];
  page.on("pageerror", error => pageErrors.push(error.message));
  await page.route("**/api/backend/data/query", route => {
    const body = route.request().postDataJSON();
    return fail && body.table === "tasks" && body.op === "select"
      ? route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: { message: "Task service temporarily unavailable", code: "DB_UNAVAILABLE" } }) })
      : route.continue();
  });
  await page.goto("/dashboard", { waitUntil: "networkidle" });
  const calendar = page.getByRole("region", { name: "Workload calendar", exact: true });
  await expect(calendar.getByRole("alert")).toContainText("Task service temporarily unavailable");
  await expect(calendar.getByText("No tasks due this month")).toHaveCount(0);
  await expect(calendar.getByRole("progressbar")).toHaveCount(0);
  fail = false;
  await calendar.getByRole("button", { name: "Retry", exact: true }).click();
  await expect(calendar.locator(`[data-workload-day="${fixtures.today}"]`)).toBeVisible();
  await expect(calendar.getByRole("alert")).toHaveCount(0);
  expect(pageErrors).toEqual([]);
});

test("refresh feedback tracks the real request and prevents duplicate refresh actions", async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto("/dashboard", { waitUntil: "networkidle" });
  let release, reads = 0;
  const gate = new Promise(resolve => { release = resolve; });
  const handler = async route => {
    const body = route.request().postDataJSON();
    if (body.table === "tasks" && body.op === "select") { reads++; await gate; }
    await route.continue();
  };
  await page.route("**/api/backend/data/query", handler);
  const refresh = page.getByRole("button", { name: "Refresh dashboard", exact: true });
  try {
    await refresh.click();
    await expect(refresh).toBeDisabled();
    await expect(refresh).toHaveAttribute("aria-busy", "true");
    await expect.poll(() => reads).toBe(1);
    release();
    await expect(refresh).toBeEnabled();
    await expect(refresh).toHaveAttribute("aria-busy", "false");
    expect(reads).toBe(1);
    expect(errors).toEqual([]);
  } finally { release(); await page.unroute("**/api/backend/data/query", handler); }
});

test("segmented controls move one selection surface and support keyboard navigation", async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto("/dashboard", { waitUntil: "networkidle" });
  const range = page.getByRole("group", { name: "Sales activity date range", exact: true });
  const seven = range.getByRole("button", { name: "7 days", exact: true });
  const thirty = range.getByRole("button", { name: "30 days", exact: true });
  await seven.focus(); await seven.press("ArrowRight");
  await expect(thirty).toBeFocused(); await expect(thirty).toHaveAttribute("aria-pressed", "true");
  await expect(thirty.locator("[data-segment-indicator]")).toHaveCount(1);
  await expect(range.locator("[data-segment-indicator]")).toHaveCount(1);
  await expect.poll(async () => {
    const pill = await thirty.locator("[data-segment-indicator]").boundingBox(), button = await thirty.boundingBox();
    return Math.abs(pill.x - button.x) + Math.abs(pill.width - button.width);
  }).toBeLessThan(2);
  await thirty.press("Home"); await expect(seven).toBeFocused();
  await expect(seven).toHaveAttribute("aria-pressed", "true");
  await seven.press("End"); await expect(thirty).toBeFocused();
  await page.goto("/finance", { waitUntil: "networkidle" });
  const metric = page.getByRole("group", { name: "Cash flow metric", exact: true });
  await metric.getByRole("button", { name: "Income", exact: true }).press("ArrowRight");
  await expect(metric.getByRole("button", { name: "Expenses", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("img", { name: /Expenses: .*last 7 days/ })).toBeVisible();
  expect(errors).toEqual([]);
});

test("command palette supports search, Escape, focus restoration and shortcut navigation", async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto("/dashboard", { waitUntil: "networkidle" });
  const trigger = page.getByRole("button", { name: "Search pages and actions", exact: true });
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: "Quick navigation" });
  const search = dialog.getByRole("combobox", { name: "Search navigation" });
  await expect(search).toBeFocused();
  fs.mkdirSync(".arena/interaction-audit", { recursive: true });
  await dialog.screenshot({ path: ".arena/interaction-audit/command-palette-desktop.png", animations: "disabled" });
  await search.fill("there-is-no-page-with-this-name");
  await expect(dialog.getByText("No matching pages or actions")).toBeVisible();
  await search.press("Escape"); await expect(dialog).not.toBeVisible(); await expect(trigger).toBeFocused();
  await page.keyboard.press("Control+k"); await expect(dialog).toBeVisible();
  await search.fill("Create invoice");
  await expect(dialog.getByRole("option", { name: "Create invoice", exact: true })).toBeVisible();
  await search.press("Enter"); await expect(page).toHaveURL(/\/invoices\/new$/);
  await page.keyboard.press("Control+k"); await expect(page.getByRole("dialog")).toHaveCount(1);
  await search.fill("Tasks"); await search.press("Enter"); await expect(page).toHaveURL(/\/tasks$/);
  await page.setViewportSize({ width: 390, height: 844 });
  await trigger.click(); await expect(search).toBeFocused();
  await search.fill("Calendar");
  await dialog.screenshot({ path: ".arena/interaction-audit/command-palette-mobile.png", animations: "disabled" });
  await dialog.getByRole("option", { name: "Calendar", exact: true }).click();
  await expect(page).toHaveURL(/\/calendar$/);
  await noHorizontalOverflow(page, "/calendar after palette navigation");
  expect(errors).toEqual([]);
});

test("buttons have composable press feedback and become static under reduced motion", async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto("/dashboard", { waitUntil: "networkidle" });
  const trigger = page.getByRole("button", { name: "Search pages and actions", exact: true });
  await trigger.hover();
  await expect.poll(() => trigger.evaluate(node => getComputedStyle(node).translate)).toBe("0px -1px");
  await page.mouse.down();
  await expect.poll(() => trigger.evaluate(node => getComputedStyle(node).scale)).toBe("0.97");
  await page.mouse.up(); await page.getByRole("dialog").getByRole("combobox").press("Escape");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await trigger.hover();
  await expect(trigger).toHaveCSS("translate", "none");
  await page.mouse.down(); await expect(trigger).toHaveCSS("scale", "none");
  await page.mouse.up(); await page.getByRole("dialog").getByRole("combobox").press("Escape");
  expect(errors).toEqual([]);
});

test("widget sections reveal on first view, remain visible, and expose final content for print", async ({ page, request }) => {
  const errors = collectErrors(page);
  const expected = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format((await data(request, "job_sheets", "select")).length);
  await page.goto("/dashboard", { waitUntil: "networkidle" });
  const section = page.locator("[data-motion-section]").filter({ has: page.getByRole("region", { name: "Repair pipeline", exact: true }) });
  await expect(section).toHaveCSS("opacity", "0");
  await expect(section.locator("[data-chart-viewport]")).toHaveAttribute("data-chart-entered", "false");
  await page.emulateMedia({ media: "print" });
  await expect(section).toHaveCSS("opacity", "1");
  await expect(section).toHaveCSS("transform", "none");
  await expect(section.locator("[data-count-up-print]")).toBeVisible();
  await expect(section.locator("[data-count-up-print]")).toHaveText(expected);
  await expect(section.locator("[data-count-up-text]")).toHaveCSS("display", "none");
  await page.emulateMedia({ media: "screen" });
  await section.scrollIntoViewIfNeeded();
  await expect(section).toHaveCSS("opacity", "1");
  await expect(section.locator("[data-chart-viewport]")).toHaveAttribute("data-chart-entered", "true");
  await expect(section.locator("[data-count-up-text]")).toHaveText(expected);
  await page.evaluate(() => scrollTo({ top: 0, behavior: "instant" }));
  await expect(section).toHaveCSS("opacity", "1");
  expect(errors).toEqual([]);
});

test("task form, status tabs, dashboard checklist, and persistence work", async ({ page, request }) => {
  const title = `UI smoke task ${Date.now()}`, errors = collectErrors(page);
  await page.goto("/tasks", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "New Task", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel(/^Title/).fill(title);
  await dialog.getByLabel("Due Date", { exact: true }).fill(fixtures.today);
  await dialog.getByRole("button", { name: "Create Task", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  const created = (await data(request, "tasks", "select", undefined, [eq("title", title)]))[0];
  expect(created).toBeTruthy(); records.unshift({ table: "tasks", id: created.id });
  const row = page.getByRole("row").filter({ has: page.getByRole("button", { name: title, exact: true }) });
  await row.getByRole("combobox").click();
  await page.getByRole("option", { name: "completed", exact: true }).click();
  await page.getByRole("tab", { name: "Completed", exact: true }).click();
  await expect(row).toBeVisible();
  await page.goto("/dashboard", { waitUntil: "networkidle" });
  const focus = page.getByRole("region", { name: "Today's focus", exact: true });
  const checkbox = focus.getByRole("checkbox", { name: new RegExp(title) });
  await expect(checkbox).toBeChecked(); await checkbox.uncheck();
  await expect.poll(async () => (await data(request, "tasks", "select", undefined, [eq("id", created.id)]))[0]?.status).toBe("pending");
  await page.reload({ waitUntil: "networkidle" }); await expect(checkbox).not.toBeChecked();
  await checkbox.check();
  await expect.poll(async () => (await data(request, "tasks", "select", undefined, [eq("id", created.id)]))[0]?.status).toBe("completed");
  expect(errors).toEqual([]);
});

test("destructive actions use MUI confirmation and restore keyboard focus", async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto("/crm", { waitUntil: "networkidle" });
  const row = page.getByRole("row").filter({ hasText: fixtures.deletable.name });
  const trigger = row.getByRole("button", { name: /Trash2|Delete/ });
  await trigger.click();
  const dialog = page.getByRole("dialog"); await expect(dialog).toContainText("Delete this customer?");
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(dialog).not.toBeVisible(); await expect(trigger).toBeFocused();
  await trigger.click(); await dialog.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(row).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("real-data charts switch range and metric; agenda switches selected day", async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto("/dashboard", { waitUntil: "networkidle" });
  const sales = page.getByRole("region", { name: "Sales activity", exact: true });
  await expect(sales.getByRole("img", { name: /POS sales: .*last 7 days/ })).toBeVisible();
  await expect(sales.locator(".recharts-area-curve")).toBeVisible();
  await sales.getByRole("button", { name: "30 days", exact: true }).click();
  await expect(sales.getByRole("button", { name: "30 days" })).toHaveAttribute("aria-pressed", "true");
  await expect(sales.getByRole("img", { name: /POS sales: .*last 30 days/ })).toBeVisible();
  const ring = page.getByRole("progressbar", { name: "Repair completion", exact: true });
  expect(Number(await ring.getAttribute("aria-valuenow"))).toBeGreaterThanOrEqual(0);
  expect(Number(await ring.getAttribute("aria-valuenow"))).toBeLessThanOrEqual(100);
  const agenda = page.getByRole("region", { name: "Your agenda", exact: true });
  await expect(agenda.getByText(fixtures.event.title, { exact: true })).toBeVisible();
  await agenda.getByRole("button", { name: dayLabel(tomorrow()), exact: true }).click();
  await expect(agenda.getByText(fixtures.nextEvent.title, { exact: true })).toBeVisible();
  fs.mkdirSync(".arena/interaction-audit", { recursive: true });
  for (const section of await page.locator("[data-motion-section]").all()) { await section.scrollIntoViewIfNeeded(); await expect(section).toHaveCSS("opacity", "1"); }
  for (const counter of await page.locator("[data-count-up-text]").all()) await expect(counter).toHaveText(await counter.getAttribute("aria-label"));
  await chartAtRest(sales.getByRole("img", { name: /POS sales:/ }));
  await page.evaluate(() => scrollTo({ top: 0, behavior: "instant" }));
  await page.screenshot({ path: ".arena/dashboard-desktop.png", fullPage: true, animations: "disabled" });
  await page.screenshot({ path: ".arena/interaction-audit/dashboard-after-desktop.png", fullPage: true, animations: "disabled" });
  await page.setViewportSize({ width: 390, height: 844 });
  await noHorizontalOverflow(page, "/dashboard");
  await chartAtRest(sales.getByRole("img", { name: /POS sales:/ }));
  await page.screenshot({ path: ".arena/dashboard-mobile.png", animations: "disabled" });
  await page.screenshot({ path: ".arena/interaction-audit/dashboard-after-mobile.png", fullPage: true, animations: "disabled" });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/finance", { waitUntil: "networkidle" });
  const cashflow = page.getByRole("region", { name: "Cash flow", exact: true });
  await cashflow.getByRole("button", { name: "Expenses", exact: true }).click();
  await expect(cashflow.getByRole("img", { name: /Expenses: .*last 7 days/ })).toBeVisible();
  await cashflow.getByRole("button", { name: "30 days", exact: true }).click();
  await expect(cashflow.getByRole("img", { name: /Expenses: .*last 30 days/ })).toBeVisible();
  await page.goto("/calendar", { waitUntil: "networkidle" });
  for (const view of ["week", "day", "list", "month"]) {
    await page.getByRole("group", { name: "Calendar view" }).getByRole("button", { name: view, exact: true }).click();
    await expect(page.getByRole("group", { name: "Calendar view" }).getByRole("button", { name: view, exact: true })).toHaveAttribute("aria-pressed", "true");
  }
  expect(errors).toEqual([]);
});

test("calendar event form validates, creates a linked task, edits and deletes", async ({ page, request }) => {
  const title = `UI linked event ${Date.now()}`, errors = collectErrors(page);
  await page.goto("/calendar", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Add Event", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Add Event", exact: true }).click();
  await expect(dialog.getByRole("alert")).toContainText("A title and start date are required");
  await expect(dialog).toBeVisible();
  await dialog.getByLabel(/^Title/).fill(title);
  await dialog.getByRole("switch", { name: "All day", exact: true }).check();
  await dialog.getByLabel("End Date", { exact: true }).fill("2000-01-01");
  await dialog.getByRole("button", { name: "Add Event", exact: true }).click();
  await expect(dialog.getByRole("alert")).toContainText("End date and time must be after the start");
  await dialog.getByLabel("End Date", { exact: true }).fill(fixtures.today);
  await dialog.getByRole("switch", { name: /Also create a task/ }).check();
  await dialog.getByRole("button", { name: "Add Event", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  const event = (await data(request, "calendar_events", "select", undefined, [eq("title", title)]))[0];
  const task = (await data(request, "tasks", "select", undefined, [eq("title", title)]))[0];
  records.unshift({ table: "calendar_events", id: event.id }, { table: "tasks", id: task.id });
  expect(task.due_date).toBe(fixtures.today);
  expect(task.related_entity_type).toBe("calendar_event");
  expect(task.related_entity_id).toBe(event.id);
  await page.getByRole("region", { name: "Your agenda", exact: true }).getByRole("button", { name: new RegExp(`^${title}.*Business`) }).click();
  await expect(dialog).toContainText("Edit Event");
  await dialog.getByLabel(/^Title/).fill(`${title} updated`);
  await dialog.getByRole("button", { name: "Update", exact: true }).click(); await expect(dialog).not.toBeVisible();
  await page.getByRole("region", { name: "Your agenda", exact: true }).getByRole("button", { name: new RegExp(`^${title} updated.*Business`) }).click();
  await dialog.getByRole("button", { name: "Delete", exact: true }).click();
  const confirm = page.getByRole("dialog").filter({ hasText: "Confirm action" });
  await confirm.getByRole("button", { name: "Delete", exact: true }).click();
  await expect.poll(async () => (await data(request, "calendar_events", "select", undefined, [eq("id", event.id)])).length).toBe(0);
  expect(errors).toEqual([]);
});

test("seven themes, notifications and responsive navigation remain usable", async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto("/dashboard", { waitUntil: "networkidle" });
  for (const [label, name] of [["Obsidian", "obsidian"], ["Forest", "forest"], ["Ocean Deep", "ocean"], ["Sunset Ember", "ember"], ["Arctic", "arctic"], ["Midnight Rose", "rose"], ["Donezo", "donezo"]]) {
    await page.getByRole("button", { name: "Change theme" }).click();
    await page.getByRole("menuitem", { name: label, exact: true }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", name);
  }
  await page.reload({ waitUntil: "networkidle" }); await expect(page.locator("html")).toHaveAttribute("data-theme", "donezo");
  await page.getByRole("button", { name: /Notifications, / }).click();
  await expect(page.getByRole("heading", { name: /Notifications/ })).toBeVisible();
  await page.getByRole("button", { name: "Close notifications" }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Open navigation" }).click();
  await page.getByRole("navigation", { name: "Main navigation" }).getByRole("link", { name: "Tasks", exact: true }).click();
  await expect(page).toHaveURL(/\/tasks$/);
  await expect(page.getByRole("heading", { name: "Task Management", exact: true })).toBeVisible();
  await noHorizontalOverflow(page, "/tasks"); expect(errors).toEqual([]);
});

test("barcode generation and print documents retain actual content", async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto("/barcodes", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: new RegExp(fixtures.product.name) }).click();
  await page.getByRole("button", { name: "Generate", exact: true }).click();
  await expect(page.locator("[data-barcode-label]")).toHaveCount(1);
  await expect(page.locator("[data-barcode-label] svg rect").first()).toBeVisible();
  await page.goto(`/invoices/${fixtures.invoice.id}`, { waitUntil: "networkidle" });
  await page.emulateMedia({ media: "print" });
  await expect(page.locator("[data-print-area]").first()).toBeVisible();
  await expect(page.getByText(fixtures.customer.name, { exact: true }).first()).toBeVisible();
  await page.emulateMedia({ media: "screen" }); expect(errors).toEqual([]);
});

test("large-screen tabs and repeated public-page navigation clean up safely", async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto("/finance", { waitUntil: "networkidle" });
  for (const name of ["Income", "Expenses", "Transfers", "Accounts", "Categories", "Ledger", "Cash Control", "Audit Log", "Dashboard"]) {
    await page.getByRole("tab", { name, exact: true }).click();
    await expect(page.getByRole("tab", { name, exact: true })).toHaveAttribute("aria-selected", "true");
  }
  await page.goto(`/repairs/${fixtures.job.id}`, { waitUntil: "networkidle" });
  for (const name of ["Checklist", "Repair", "Parts", "Photos", "Audit", "Overview"]) await page.getByRole("tab", { name, exact: true }).click();
  await page.goto("/settings", { waitUntil: "networkidle" });
  for (const name of ["Business Info", "GST Settings", "Document Settings", "Service Categories", "Profile"]) await page.getByRole("button", { name, exact: true }).click();
  // Actual client-side unmount/remount, not page.goto (which destroys the
  // document and would conceal leaked ScrollTriggers / removeChild failures).
  await page.goto("/contact", { waitUntil: "load" });
  for (let iteration = 0; iteration < 3; iteration++) {
    await page.getByRole("link", { name: "Home", exact: true }).click();
    await expect(page).toHaveURL(new URL("/", baseURL).href);
    const stage = page.locator("[data-speaker-stage]");
    await expect(stage).toBeVisible();
    await page.evaluate(() => scrollTo({ top: 1200, behavior: "instant" }));
    // overflow:hidden on an ancestor would silently break CSS sticky and
    // leave a blank 400vh hero even though the route renders successfully.
    await expect.poll(async () => Math.abs((await stage.boundingBox())?.y ?? Infinity)).toBeLessThanOrEqual(1);
    await expect(page.getByRole("heading", { name: "Where rooms become stages.", exact: true })).toBeVisible();
    await expect(page.locator(".pin-spacer")).toHaveCount(0);
    await page.goBack();
    await expect(page.getByRole("heading", { name: "Get In Touch", exact: true })).toBeVisible();
  }
  expect(errors).toEqual([]);
});

test("reduced motion shows final values immediately and suppresses decorative motion", async ({ browser }) => {
  const context = await browser.newContext({ storageState: state, reducedMotion: "reduce", timezoneId: "Asia/Kolkata", viewport: { width: 390, height: 844 } });
  await localAssets(context);
  const page = await context.newPage(), errors = collectErrors(page);
  try {
    for (const route of ["/dashboard", "/finance", "/tasks", "/calendar"]) {
      await page.goto(route, { waitUntil: "networkidle" });
      expect(await page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches)).toBeTruthy();
      await expect(page.locator("[data-animated-page]").first()).toHaveCSS("transform", "none");
      const animated = await page.evaluate(() => document.getAnimations().filter(animation => animation.playState === "running" && Number(animation.effect?.getTiming().duration) > 1).length);
      expect(animated, route).toBe(0); await noHorizontalOverflow(page, route);
    }
    expect(errors).toEqual([]);
  } finally { await context.close(); }
});

test("widget failures are not misrepresented as zero or empty financial activity", async ({ page }) => {
  await page.route("**/api/backend/data/query", route => {
    const body = route.request().postDataJSON();
    return body.table === "pos_transactions" ? route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: { message: "Temporarily unavailable", code: "DB_UNAVAILABLE" } }) }) : route.fallback();
  });
  await page.goto("/dashboard", { waitUntil: "networkidle" });
  const sales = page.getByRole("region", { name: "Sales activity", exact: true });
  await expect(sales.getByRole("alert")).toContainText("Temporarily unavailable");
  await expect(sales.getByText("No transactions in this period", { exact: true })).toHaveCount(0);
  await expect(sales.getByRole("button", { name: "Retry", exact: true })).toBeVisible();
  await page.unroute("**/api/backend/data/query");
  await sales.getByRole("button", { name: "Retry", exact: true }).click();
  await expect(sales.getByRole("img", { name: /POS sales:/ })).toBeVisible();
});

test("a failed checklist write rolls back once without replaying it", async ({ page }) => {
  let writes = 0;
  await page.route("**/api/backend/data/query", route => {
    const body = route.request().postDataJSON();
    if (body.table === "tasks" && body.op === "update" && body.filters.some(filter => filter.col === "id" && filter.val === fixtures.task.id)) {
      writes++;
      return route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: { message: "Task save unavailable", code: "DB_UNAVAILABLE" } }) });
    }
    return route.fallback();
  });
  await page.goto("/dashboard", { waitUntil: "networkidle" });
  const checkbox = page.getByRole("region", { name: "Today's focus", exact: true }).getByRole("checkbox", { name: new RegExp(fixtures.task.title) });
  await expect(checkbox).not.toBeChecked();
  // A fast rejected request can roll back before check() verifies its final state.
  await checkbox.click();
  await expect(page.getByRole("alert").filter({ hasText: "Task save unavailable" })).toBeVisible();
  await expect(checkbox).not.toBeChecked();
  await expect(checkbox).toBeEnabled();
  expect(writes).toBe(1);
});

test("public pages honor reduced motion and use focus-safe MUI overlays", async ({ browser }) => {
  const context = await browser.newContext({ reducedMotion: "reduce", viewport: { width: 390, height: 844 } });
  await localAssets(context);
  const page = await context.newPage(), errors = collectErrors(page);
  try {
    await page.goto("/", { waitUntil: "load" });
    await expect(page.locator("[data-static-speaker-evolution]")).toBeVisible();
    const trigger = page.getByRole("button", { name: "Open site navigation", exact: true });
    await trigger.click();
    await expect(page.getByRole("navigation", { name: "Site navigation", exact: true })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(trigger).toBeFocused();
    for (const width of [390, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      for (const section of ["#services", "#projects", "#consultation"]) {
        await page.locator(section).scrollIntoViewIfNeeded();
        await expect(page.locator('[data-motion-active="true"]')).toHaveCount(0);
        await expect.poll(() => page.evaluate(() => document.getAnimations().filter(animation => animation.playState === "running" && Number(animation.effect?.getTiming().duration) > 1).length)).toBe(0);
        await noHorizontalOverflow(page, section);
      }
    }
    const project = page.getByRole("button", { name: "View Luxury Villa Cinema", exact: true });
    await project.focus(); await page.keyboard.press("Enter");
    const dialog = page.getByRole("dialog");
    await expect(dialog).toContainText("Luxury Villa Cinema");
    await page.keyboard.press("Escape"); await expect(dialog).not.toBeVisible();
    await expect(project).toBeFocused();
    await page.goto("/landing", { waitUntil: "load" });
    await expect(page.locator("[data-marquee-track]")).toHaveCSS("animation-name", "none");
    expect(errors).toEqual([]);
  } finally { await context.close(); }
});

test("public marquees pause offscreen and offer working pause and resume controls", async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto("/", { waitUntil: "load" });
  const marquee = page.getByRole("region", { name: "Featured projects", exact: true });
  const track = marquee.locator("[data-marquee-track]");
  await marquee.scrollIntoViewIfNeeded();
  await page.mouse.move(0, 0);
  await expect(track).toHaveCSS("animation-play-state", "running");
  await expect(track.locator('[aria-hidden="true"][inert]')).toHaveCount(1);
  await marquee.getByRole("button", { name: "Pause featured projects", exact: true }).click();
  await expect(track).toHaveCSS("animation-play-state", "paused");
  await marquee.getByRole("button", { name: "Resume featured projects", exact: true }).click();
  await page.mouse.move(0, 0);
  await expect(track).toHaveCSS("animation-play-state", "running");
  await page.locator("#consultation").scrollIntoViewIfNeeded();
  await expect(track).toHaveCSS("animation-play-state", "paused");
  expect(errors).toEqual([]);
});
