import { test as base, expect } from "@playwright/test";

const email = process.env.E2E_EMAIL ?? "admin@alvstore.in";
const password = process.env.E2E_PASSWORD ?? "admin123";
const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3000";

const TINY_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAFUlEQVR42mP8z8BQz0AEYBxVSF+FABJADveWkH6oAAAAAElFTkSuQmCC",
  "base64"
);

let token = "";
let customer = null;
let prodA = null;
let prodB = null;
const cleanup = {
  challans: [],
  invoices: [],
  quotations: [],
  products: [],
  customers: [],
};

const test = base.extend({});

async function queryApi(request, table, op, values, filters = []) {
  const res = await request.post(`${baseURL}/api/backend/data/query`, {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      table,
      op,
      values,
      filters,
      ...(op === "insert" ? { select: "*", single: "single" } : {}),
      ...(op === "select" ? { select: "*" } : {}),
    },
  });
  const body = await res.json();
  expect(res.ok(), `${table} ${op}: ${JSON.stringify(body)}`).toBeTruthy();
  return body.data;
}

const eq = (col, val) => ({ type: "op", col, op: "eq", val });

test.beforeAll(async ({ request }) => {
  const loginRes = await request.post(`${baseURL}/api/backend/auth/login`, {
    data: { email, password },
  });
  expect(loginRes.ok()).toBeTruthy();
  token = (await loginRes.json()).access_token;

  const suffix = Date.now();
  customer = await queryApi(request, "customers", "insert", {
    name: `E2E Quote Challan Client ${suffix}`,
    phone: "9820012345",
    email: `e2e-quote-${suffix}@example.test`,
    address: "42 Linking Road, Bandra West, Mumbai 400050",
    gst_number: "27AABCA1234E1Z5",
  });
  cleanup.customers.push(customer.id);

  prodA = await queryApi(request, "products", "insert", {
    name: `E2E Studio Amp ${suffix}`,
    sku: `AMP-${suffix}`,
    selling_price: 10000,
    gst_percentage: 18,
    stock_quantity: 10,
  });
  cleanup.products.push(prodA.id);

  prodB = await queryApi(request, "products", "insert", {
    name: `E2E Reference Panel ${suffix}`,
    sku: `PNL-${suffix}`,
    selling_price: 20000,
    gst_percentage: 18,
    stock_quantity: 8,
  });
  cleanup.products.push(prodB.id);
});

test.afterAll(async ({ request }) => {
  for (const chId of cleanup.challans) {
    await queryApi(request, "delivery_challan_items", "delete", null, [eq("challan_id", chId)]).catch(() => {});
    await queryApi(request, "delivery_challans", "delete", null, [eq("id", chId)]).catch(() => {});
  }
  for (const invId of cleanup.invoices) {
    await queryApi(request, "invoice_items", "delete", null, [eq("invoice_id", invId)]).catch(() => {});
    await queryApi(request, "invoices", "delete", null, [eq("id", invId)]).catch(() => {});
  }
  for (const qId of cleanup.quotations) {
    await queryApi(request, "quotation_items", "delete", null, [eq("quotation_id", qId)]).catch(() => {});
    await queryApi(request, "quotations", "delete", null, [eq("id", qId)]).catch(() => {});
  }
  for (const pId of cleanup.products) {
    await queryApi(request, "stock_movements", "delete", null, [eq("product_id", pId)]).catch(() => {});
    await queryApi(request, "products", "delete", null, [eq("id", pId)]).catch(() => {});
  }
  for (const cId of cleanup.customers) {
    await queryApi(request, "customers", "delete", null, [eq("id", cId)]).catch(() => {});
  }
});

test("Detailed Quotation images, reorder, signature accept, duplicate, Invoice no-image + single stock deduct, and 2026 Challan POD", async ({
  page,
  browser,
  request,
}) => {
  const consoleErrors = [];
  page.on("pageerror", (err) => consoleErrors.push(err.message));
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });

  // 1. Login as Admin
  await page.goto(`${baseURL}/login`, { waitUntil: "networkidle" });
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(password);
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  // 2. Navigate to New Quotation
  await page.goto(`${baseURL}/sales/new`, { waitUntil: "networkidle" });
  const customerInput = page.getByPlaceholder("Search or select customer...");
  await customerInput.click();
  await customerInput.fill(customer.name);
  await page.getByRole("option", { name: new RegExp(customer.name) }).click();

  const futureDate = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
  await page.getByLabel("Valid Until").fill(futureDate);

  // Add two products
  for (const prod of [prodA, prodB]) {
    await page.getByRole("combobox", { name: "Line Items" }).click();
    await page.getByRole("option", { name: new RegExp(prod.name) }).click();
  }

  // Upload real PNG thumbnail onto Product A
  const uploadBtn = page.getByRole("button", { name: `Upload image for ${prodA.name}` });
  const [fileChooser] = await Promise.all([page.waitForEvent("filechooser"), uploadBtn.click()]);
  await fileChooser.setFiles({ name: "studio-amp.png", mimeType: "image/png", buffer: TINY_PNG });
  await page.waitForTimeout(400);

  // Reorder Product A down -> Product B becomes row #1
  await page.getByRole("button", { name: `Move ${prodA.name} down` }).click();
  await expect(page.getByLabel("#1 Item Name")).toHaveValue(prodB.name);

  // Open Live Preview SideDrawer
  await page.getByRole("button", { name: "Preview", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText(prodB.name)).toBeVisible();
  await dialog.getByRole("button", { name: "Close drawer", exact: true }).click();

  // Save Draft
  await page.getByRole("button", { name: "Save Draft", exact: true }).click();
  await expect(page).toHaveURL(/\/sales\/[0-9a-f-]+$/);
  const quoteId = page.url().split("/").pop();
  cleanup.quotations.push(quoteId);

  // Verify Branded Vector PDF download for Quotation returns real %PDF-
  const pdfRes = await request.get(`${baseURL}/api/backend/functions/document-pdf?type=quotation&id=${quoteId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(pdfRes.status()).toBe(200);
  expect(pdfRes.headers()["content-type"]).toContain("application/pdf");
  const pdfBuf = await pdfRes.body();
  expect(pdfBuf.subarray(0, 5).toString("ascii")).toBe("%PDF-");

  await expect(page.getByRole("button", { name: "Download Branded PDF", exact: true })).toBeVisible();
  await expect(page.getByText(prodB.name)).toBeVisible();
  await page.waitForTimeout(300);
  await page.screenshot({ path: "test-results/quotation-preview-desktop.png", fullPage: false });

  // Fetch public_token for Quotation
  const [quoteRow] = await queryApi(request, "quotations", "select", null, [eq("id", quoteId)]);
  expect(quoteRow.public_token).toBeTruthy();

  // 3. Public Customer Quotation Acceptance (unauthenticated mobile viewport)
  const pubCtx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const pubPage = await pubCtx.newPage();
  await pubPage.goto(`${baseURL}/sales/public/${quoteRow.public_token}`, { waitUntil: "networkidle" });
  await expect(pubPage.getByText(prodB.name)).toBeVisible();
  await pubPage.getByPlaceholder("Full name").fill("Aarav Mehta");
  const canvas = pubPage.locator("canvas").first();
  await canvas.scrollIntoViewIfNeeded();
  const box = await canvas.boundingBox();
  if (box) {
    await pubPage.mouse.move(box.x + 20, box.y + 30);
    await pubPage.mouse.down();
    await pubPage.mouse.move(box.x + 120, box.y + 50, { steps: 8 });
    await pubPage.mouse.up();
  }
  await pubPage.getByRole("button", { name: "Accept Quotation", exact: true }).click();
  await expect(pubPage.getByText(/Accepted & digitally signed by Aarav Mehta/i)).toBeVisible();
  await pubPage.screenshot({ path: "test-results/public-quotation-mobile.png", fullPage: true });
  await pubCtx.close();

  // 4. Verify Accepted Lock & Duplicate as New Quotation (no revision suffix)
  await page.goto(`${baseURL}/sales/${quoteId}/edit`, { waitUntil: "networkidle" });
  await expect(page.getByText(/already been accepted and digitally signed/i)).toBeVisible();
  await page.getByRole("button", { name: "Duplicate as New Quotation", exact: true }).first().click();
  await expect(page).toHaveURL(new RegExp(`/sales/(?!${quoteId})[0-9a-f-]+/edit$`));
  const dupId = page.url().split("/").slice(-2)[0];
  expect(dupId).not.toBe(quoteId);
  cleanup.quotations.push(dupId);
  await expect(page.getByLabel("#1 Item Name")).toHaveValue(prodB.name);

  // 5. Return to Accepted Quotation -> Convert to Invoice IS visible -> Convert -> Verify single stock deduction + zero images
  await page.goto(`${baseURL}/sales/${quoteId}`, { waitUntil: "networkidle" });
  const convertBtn = page.getByRole("button", { name: "Convert to Invoice", exact: true });
  await expect(convertBtn).toBeVisible();
  await convertBtn.click();
  await expect(page).toHaveURL(/\/invoices\/[0-9a-f-]+$/);
  const invId = page.url().split("/").pop();
  cleanup.invoices.push(invId);

  // Tax invoice must have zero product item thumbnails
  await expect(page.locator(`img[alt="${prodA.name}"]`)).toHaveCount(0);

  // Verify stock deducted ONCE (10->9, 8->7)
  const [pAAfterInv] = await queryApi(request, "products", "select", null, [eq("id", prodA.id)]);
  const [pBAfterInv] = await queryApi(request, "products", "select", null, [eq("id", prodB.id)]);
  expect(Number(pAAfterInv.stock_quantity)).toBe(9);
  expect(Number(pBAfterInv.stock_quantity)).toBe(7);

  // 6. Create 2026 Delivery Challan from Invoice -> Dispatch -> Verify NO double-deduct
  await page.getByRole("button", { name: "Create Delivery Challan", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/challans/new\\?invoiceId=${invId}`));
  await page.getByLabel("Courier / Carrier").fill("BlueDart Express");
  await page.getByLabel("AWB / Tracking Number").fill("AWB2026E2E");
  await page.getByLabel("e-Way Bill Number").fill("141234567890");
  await page.getByRole("button", { name: "Save & Mark Dispatched", exact: true }).click();
  await expect(page).toHaveURL(/\/challans\/[0-9a-f-]+$/);
  const chId = page.url().split("/").pop();
  cleanup.challans.push(chId);

  // Verify stock is STILL 9 and 7 (no double deduction!)
  const [pAAfterCh] = await queryApi(request, "products", "select", null, [eq("id", prodA.id)]);
  const [pBAfterCh] = await queryApi(request, "products", "select", null, [eq("id", prodB.id)]);
  expect(Number(pAAfterCh.stock_quantity)).toBe(9);
  expect(Number(pBAfterCh.stock_quantity)).toBe(7);

  await expect(page.getByText(/BlueDart Express/).first()).toBeVisible();
  await page.waitForTimeout(300);
  await page.screenshot({ path: "test-results/challan-preview-desktop.png", fullPage: false });

  // 7. Public Delivery Challan Tracking & Contactless POD
  const [chRow] = await queryApi(request, "delivery_challans", "select", null, [eq("id", chId)]);
  expect(chRow.public_token).toBeTruthy();

  const podCtx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const podPage = await podCtx.newPage();
  await podPage.goto(`${baseURL}/challan/public/${chRow.public_token}`, { waitUntil: "networkidle" });
  await expect(podPage.getByText(/BlueDart Express/).first()).toBeVisible();
  await expect(podPage.getByText(/AWB2026E2E/).first()).toBeVisible();

  const podUploadBtn = podPage.getByRole("button", { name: /Upload Delivery Photo/i });
  const [podChooser] = await Promise.all([podPage.waitForEvent("filechooser"), podUploadBtn.click()]);
  await podChooser.setFiles({ name: "pod.png", mimeType: "image/png", buffer: TINY_PNG });
  await expect(podPage.getByText("Photo attached")).toBeVisible();

  await podPage.getByPlaceholder("Full name").fill("Aarav Mehta");
  const podCanvas = podPage.locator("canvas").first();
  await podCanvas.scrollIntoViewIfNeeded();
  const podBox = await podCanvas.boundingBox();
  if (podBox) {
    await podPage.mouse.move(podBox.x + 25, podBox.y + 30);
    await podPage.mouse.down();
    await podPage.mouse.move(podBox.x + 130, podBox.y + 55, { steps: 8 });
    await podPage.mouse.up();
  }
  await podPage.getByRole("button", { name: /Confirm Receipt & Submit POD/i }).click();
  await expect(podPage.getByText(/Delivered.*Received by Aarav Mehta/i)).toBeVisible();
  await podPage.screenshot({ path: "test-results/public-challan-pod.png", fullPage: true });
  await podCtx.close();

  // Verify Branded Vector PDF download for Invoice & Challan returns real %PDF-
  for (const [docType, docId] of [["invoice", invId], ["challan", chId]]) {
    const res = await request.get(`${baseURL}/api/backend/functions/document-pdf?type=${docType}&id=${docId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status(), `${docType} PDF status`).toBe(200);
    expect(res.headers()["content-type"]).toContain("application/pdf");
    const buf = await res.body();
    expect(buf.subarray(0, 5).toString("ascii")).toBe("%PDF-");
  }

  // 8. Cancel Invoice & Restore Stock -> verify inventory returns to 10 & 8 via Postgres trigger
  await page.goto(`${baseURL}/invoices/${invId}`, { waitUntil: "networkidle" });
  const cancelBtn = page.getByRole("button", { name: "Cancel Invoice & Restore Stock", exact: true });
  await expect(cancelBtn).toBeVisible();
  await cancelBtn.click();
  await expect(page.getByText(/Invoice cancelled and stock restored/i)).toBeVisible();

  const [pARestored] = await queryApi(request, "products", "select", null, [eq("id", prodA.id)]);
  const [pBRestored] = await queryApi(request, "products", "select", null, [eq("id", prodB.id)]);
  expect(Number(pARestored.stock_quantity)).toBe(10);
  expect(Number(pBRestored.stock_quantity)).toBe(8);

  expect(consoleErrors).toEqual([]);
});
