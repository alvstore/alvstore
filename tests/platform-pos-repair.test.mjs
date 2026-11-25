import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import { root } from "../tools/check-ui.mjs";

async function importTranspiled(file) {
  const source = fs.readFileSync(path.join(root, file), "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ES2022,
      jsx: ts.JsxEmit.React,
    },
  });
  return import(`data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`);
}

test("Favicon metadata uses cache-busted icons without un-versioned app/favicon.ico", () => {
  assert.equal(fs.existsSync(path.join(root, "src/app/favicon.ico")), false);
  assert.equal(fs.existsSync(path.join(root, "public/favicon.ico")), true);
  assert.equal(fs.existsSync(path.join(root, "public/icon.svg")), true);
  assert.equal(fs.existsSync(path.join(root, "public/apple-icon.png")), true);

  const layoutSrc = fs.readFileSync(path.join(root, "src/app/layout.tsx"), "utf8");
  assert.match(layoutSrc, /icons:\s*\{/);
  assert.match(layoutSrc, /\/icon\.svg\?v=/);
  assert.match(layoutSrc, /\/favicon\.ico\?v=/);
});

test("Seed converges admin@alvstore.in role to admin cleanly", () => {
  const seedSrc = fs.readFileSync(path.join(root, "server/tools/seed.ts"), "utf8");
  assert.match(seedSrc, /deleteMany\(\s*\{\s*where:\s*\{\s*user_id:\s*admin\.id,\s*role:\s*\{\s*not:\s*"admin"/);
});

test("Customers avatar_url exists in Prisma schema, schema-meta, Supabase types, and UI avatar consumers", () => {
  const prismaSrc = fs.readFileSync(path.join(root, "server/prisma/schema.prisma"), "utf8");
  const customersBlock = prismaSrc.match(/model Customers \{[\s\S]*?\n\}/)?.[0] || "";
  assert.match(customersBlock, /\bavatar_url\s+String\?/);

  const schemaMeta = JSON.parse(fs.readFileSync(path.join(root, "server/src/generated/schema-meta.json"), "utf8"));
  assert.ok(schemaMeta.tables.customers.columns.some(c => c.name === "avatar_url"));

  const typesSrc = fs.readFileSync(path.join(root, "src/integrations/supabase/types.ts"), "utf8");
  const customersTypeBlock = typesSrc.match(/customers:\s*\{[\s\S]*?Relationships:/)?.[0] || "";
  assert.match(customersTypeBlock, /avatar_url:\s*string \| null/);

  const settingsSrc = fs.readFileSync(path.join(root, "src/screens/Settings.tsx"), "utf8");
  assert.match(settingsSrc, /<AvatarUpload[\s\S]*folder="profiles"/);
  assert.match(settingsSrc, /refreshUserMetadata/);

  const authSrc = fs.readFileSync(path.join(root, "src/auth.ts"), "utf8");
  assert.match(authSrc, /trigger === "update"/);

  const headerSrc = fs.readFileSync(path.join(root, "src/components/layout/AppHeader.tsx"), "utf8");
  assert.match(headerSrc, /<Avatar\s+src=\{avatarUrl\}/);

  const sidebarSrc = fs.readFileSync(path.join(root, "src/components/layout/AppSidebar.tsx"), "utf8");
  assert.match(sidebarSrc, /<Avatar\s+src=\{avatarUrl\}/);

  const custProfileSrc = fs.readFileSync(path.join(root, "src/screens/CustomerProfile.tsx"), "utf8");
  assert.match(custProfileSrc, /<AvatarUpload[\s\S]*folder="customers"/);
});

test("AuditLogs includes job_sheet_audit_log + exports, and RepairsReport queries active job_sheets", () => {
  const auditSrc = fs.readFileSync(path.join(root, "src/screens/AuditLogs.tsx"), "utf8");
  assert.match(auditSrc, /from\("job_sheet_audit_log"\)/);
  assert.match(auditSrc, /Export CSV/);
  assert.match(auditSrc, /Print Report/);

  const reportsSrc = fs.readFileSync(path.join(root, "src/screens/Reports.tsx"), "utf8");
  assert.doesNotMatch(reportsSrc, /from\("repair_tickets"\)/);
  assert.match(reportsSrc, /from\("job_sheets"\)/);
});

test("All document editors expose explicit Add Custom Item support alongside catalog selection", () => {
  for (const file of [
    "src/components/documents/ItemsTable.tsx",
    "src/screens/InvoiceAdd.tsx",
    "src/screens/QuotationAdd.tsx",
    "src/screens/DeliveryChallanAdd.tsx",
  ]) {
    const src = fs.readFileSync(path.join(root, file), "utf8");
    assert.match(src, /DocumentItemAdder/, `${file} must use DocumentItemAdder`);
    assert.match(src, /addCustomItem/, `${file} must implement addCustomItem`);
    assert.match(src, /Custom item name/, `${file} must allow editing custom item name inline`);
  }
});

test("computeRepairBillingSummary calculates service, multi-part GST, and totals consistently", async () => {
  const { computeRepairBillingSummary } = await importTranspiled("src/lib/repair-billing.ts");

  const excl = computeRepairBillingSummary({
    serviceCharge: 2000,
    gstAmount: 360,
    totalAmount: 2360,
    gstMode: "exclusive",
    repairParts: [
      { cost: 5000, quantity: 1, gst_percentage: 18, total: 5000 },
      { cost: 500, quantity: 2, gst_percentage: 12, total: 1000 },
    ],
  });
  assert.equal(excl.partsSubtotal, 6000);
  assert.equal(excl.partsGst, 1020);
  assert.equal(excl.combinedGst, 1380);
  assert.equal(excl.grandTotal, 9380);

  const none = computeRepairBillingSummary({
    serviceCharge: 1500,
    gstAmount: 0,
    totalAmount: 1500,
    gstMode: "none",
    repairParts: [{ cost: 1000, quantity: 1, gst_percentage: 18, total: 1000 }],
  });
  assert.equal(none.partsGst, 0);
  assert.equal(none.combinedGst, 0);
  assert.equal(none.grandTotal, 2500);
});

test("Repair workflow fixes public portal URL, technician gates, re-quote, and notifications", () => {
  const detailSrc = fs.readFileSync(path.join(root, "src/screens/JobSheetDetail.tsx"), "utf8");
  assert.doesNotMatch(detailSrc, /\/job\/\$\{job\.public_token\}/);
  assert.match(detailSrc, /\/job\/public\/\$\{job\.public_token\}/);
  assert.match(detailSrc, /requestReapproval/);
  assert.match(detailSrc, /is still unpaid on \$\{job\.job_number\}/);
  assert.match(detailSrc, /canWorkRepair/);

  const publicJobSrc = fs.readFileSync(path.join(root, "src/screens/PublicJobSheet.tsx"), "utf8");
  assert.match(publicJobSrc, /notify-job-event/);

  const deliverySrc = fs.readFileSync(path.join(root, "src/screens/PublicDeliveryReport.tsx"), "utf8");
  assert.match(deliverySrc, /notify-job-event/);
  assert.match(deliverySrc, /customer_delivery_signed/);
});

test("POS metrics helpers and redesigned terminal UI meet functional and motion standards", async () => {
  const { computePosCartTotals, buildPosShiftTelemetry } = await importTranspiled("src/lib/pos-metrics.ts");

  const cart = [
    {
      product: { id: "1", name: "Speaker", sku: "SPK", barcode: null, image_url: null, selling_price: 10000, gst_percentage: 18, stock_quantity: 5, unit: "pcs" },
      quantity: 2,
      lineTotal: 20000,
      lineGst: 3600,
    },
  ];

  const pct = computePosCartTotals(cart, "percentage", 10);
  assert.equal(pct.grossSubtotal, 20000);
  assert.equal(pct.discountAmount, 2000);
  assert.equal(pct.subtotal, 18000);
  assert.equal(pct.gstAmount, 3240);
  assert.equal(pct.total, 21240);
  assert.equal(pct.itemCount, 2);

  const now = new Date("2026-11-25T15:30:00");
  const telemetry = buildPosShiftTelemetry(
    [
      { total: 5000, payment_method: "upi", created_at: "2026-11-25T11:15:00" },
      { total: 3000, payment_method: "cash", created_at: "2026-11-25T14:15:00" },
      { total: 2000, payment_method: "card", created_at: "2026-11-20T12:00:00" },
    ],
    7,
    now
  );
  assert.equal(telemetry.todayRevenue, 8000);
  assert.equal(telemetry.todayOrders, 2);
  assert.equal(telemetry.periodRevenue, 10000);
  assert.equal(telemetry.periodOrders, 3);

  const posSrc = fs.readFileSync(path.join(root, "src/screens/POS.tsx"), "utf8");
  assert.doesNotMatch(posSrc, /ERPMaster/);
  assert.match(posSrc, /recharts/);
  assert.match(posSrc, /useReducedMotion/);
  assert.match(posSrc, /MetricStrip/);
  assert.match(posSrc, /Live Shift Pulse/);
  assert.match(posSrc, /Held Bills/);
  assert.match(posSrc, /Add Custom Item/);
});
