import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import { decomposeColor, getContrastRatio } from "@mui/material/styles";
import { root } from "../tools/check-ui.mjs";

async function importTs(file) {
  const source = fs.readFileSync(path.join(root, file), "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
  });
  return import(`data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`);
}

function blendOver(fgRgba, bgHex) {
  const fg = decomposeColor(fgRgba).values;
  const bg = decomposeColor(bgHex).values;
  const a = fg.length === 4 ? fg[3] : 1;
  const r = Math.round((1 - a) * bg[0] + a * fg[0]);
  const g = Math.round((1 - a) * bg[1] + a * fg[1]);
  const b = Math.round((1 - a) * bg[2] + a * fg[2]);
  return `rgb(${r}, ${g}, ${b})`;
}

test("pastelPillColors guarantees >= 4.5:1 WCAG AA contrast across light and dark theme surfaces", async () => {
  const { pastelPillColors } = await importTs("src/lib/pill-style.ts");
  const sampleColors = [
    "#6366f1", // Arctic indigo
    "#8b5cf6", // Obsidian violet
    "#065f46", // Forest emerald
    "#06b6d4", // Ocean cyan
    "#f59e0b", // Ember amber / warning
    "#ec4899", // Rose pink
    "#22c55e", // Success green
    "#3b82f6", // Info blue
    "#ef4444", // Destructive red
  ];

  for (const base of sampleColors) {
    const lightPill = pastelPillColors(base, "#ffffff", false);
    const lightBg = blendOver(lightPill.backgroundColor, "#ffffff");
    const lightRatio = getContrastRatio(lightPill.color, lightBg);
    assert.ok(lightRatio >= 4.5, `Light contrast ${lightRatio.toFixed(2)} < 4.5 for ${base}`);

    const darkPill = pastelPillColors(base, "#121212", true);
    const darkBg = blendOver(darkPill.backgroundColor, "#121212");
    const darkRatio = getContrastRatio(darkPill.color, darkBg);
    assert.ok(darkRatio >= 4.5, `Dark contrast ${darkRatio.toFixed(2)} < 4.5 for ${base}`);
  }
});

test("SideDrawer and MetricStrip are exported cleanly and SideDrawer enforces modal accessibility and busy locks", () => {
  const indexSrc = fs.readFileSync(path.join(root, "src/components/mui/index.ts"), "utf8");
  const drawerSrc = fs.readFileSync(path.join(root, "src/components/mui/SideDrawer.tsx"), "utf8");
  const stripSrc = fs.readFileSync(path.join(root, "src/components/mui/MetricStrip.tsx"), "utf8");

  assert.match(indexSrc, /export \{ SideDrawer/);
  assert.match(indexSrc, /export \{ MetricStrip/);
  assert.match(drawerSrc, /role:\s*["']dialog["']/);
  assert.match(drawerSrc, /"aria-modal":\s*true/);
  assert.match(drawerSrc, /if\s*\(\s*!busy\s*\)\s*onClose\(\)/);
  assert.match(stripSrc, /CountUp/);
});

test("summarizeInvoices and filterInvoices handle partial payments, cancelled exclusions, and client-side search", async () => {
  const { summarizeInvoices, filterInvoices } = await importTs("src/lib/invoice-metrics.ts");
  const sample = [
    { id: "1", invoice_number: "INV-001", customer_id: "c1", total: 1000, paid_amount: 1000, payment_status: "paid", status: "paid", customers: { name: "Aarav Mehta", email: "aarav@x.in" } },
    { id: "2", invoice_number: "INV-002", customer_id: "c1", total: 2000, paid_amount: 500, payment_status: "partial", status: "sent", customers: { name: "Aarav Mehta", email: "aarav@x.in" } },
    { id: "3", invoice_number: "INV-003", customer_id: "c2", total: 1500, paid_amount: 0, payment_status: "unpaid", status: "draft", customers: { name: "Riya Kapoor", email: "riya@y.in" } },
    { id: "4", invoice_number: "INV-004", customer_id: "c3", total: 5000, paid_amount: 0, payment_status: "unpaid", status: "cancelled", customers: { name: "Void Co", email: null } },
  ];

  const stats = summarizeInvoices(sample);
  assert.equal(stats.uniqueClients, 3);
  assert.equal(stats.totalCount, 4);
  assert.equal(stats.paidCount, 1);
  assert.equal(stats.unpaidCount, 2);
  assert.equal(stats.paidRevenue, 1500);
  assert.equal(stats.unpaidBalance, 3000);
  assert.equal(stats.totalBilled, 4500);

  assert.equal(filterInvoices(sample, "all", "riya").length, 1);
  assert.equal(filterInvoices(sample, "sent", "inv-002").length, 1);
  assert.equal(filterInvoices(sample, "paid", "riya").length, 0);

  const invoicesSrc = fs.readFileSync(path.join(root, "src/screens/Invoices.tsx"), "utf8");
  assert.match(invoicesSrc, /MetricStrip/);
  assert.match(invoicesSrc, /SideDrawer/);
  assert.doesNotMatch(invoicesSrc, /FormDialog/);
});

test("Tasks screen and useTaskBoard support Kanban lanes, Table toggle, MetricStrip, SideDrawer, saveTask, and deleteTask", () => {
  const hookSrc = fs.readFileSync(path.join(root, "src/hooks/useTaskBoard.ts"), "utf8");
  const tasksSrc = fs.readFileSync(path.join(root, "src/screens/Tasks.tsx"), "utf8");

  assert.match(hookSrc, /saveTask/);
  assert.match(hookSrc, /deleteTask/);
  assert.match(tasksSrc, /MetricStrip/);
  assert.match(tasksSrc, /SideDrawer/);
  assert.match(tasksSrc, /SegmentedControl/);
  assert.match(tasksSrc, /value:\s*["']board["']/);
  assert.match(tasksSrc, /value:\s*["']table["']/);
  assert.match(tasksSrc, /label:\s*["']Edit["']/);
  assert.match(tasksSrc, /label:\s*["']Activity["']/);
  assert.doesNotMatch(tasksSrc, /FormDialog/);
});

test("CalendarPage uses unified left filter rail, SideDrawer, pastel pill events, and preserves AgendaWidget", () => {
  const calSrc = fs.readFileSync(path.join(root, "src/screens/CalendarPage.tsx"), "utf8");
  assert.match(calSrc, /SideDrawer/);
  assert.match(calSrc, /pastelPillColors/);
  assert.match(calSrc, /DateCalendar/);
  assert.match(calSrc, /AgendaWidget/);
  assert.match(calSrc, /Event Filters/);
  assert.match(calSrc, /Edit Event/);
  assert.doesNotMatch(calSrc, /FormDialog/);
});

test("Dashboard uses Materialize bento row + MetricStrip + Recent invoices table while keeping all E2E landmarks", () => {
  const dashSrc = fs.readFileSync(path.join(root, "src/screens/Dashboard.tsx"), "utf8");
  assert.match(dashSrc, /MetricStrip/);
  assert.match(dashSrc, /DataTable/);
  assert.match(dashSrc, /pastelPillColors/);
  assert.match(dashSrc, /WorkloadCalendar/);
  assert.match(dashSrc, /AgendaWidget/);
  assert.match(dashSrc, /ChecklistWidget/);
  assert.match(dashSrc, /title="Sales activity"/);
  assert.match(dashSrc, /title="Repair pipeline"/);
  assert.match(dashSrc, /label="Repair completion"/);
  assert.match(dashSrc, /aria-label="Refresh dashboard"/);
});

test("pill-style supports hsl() inputs, opaque solidHeaderBg, and WCAG AA solidTextTone", async () => {
  const { pastelPillColors, solidHeaderBg, solidTextTone } = await importTs("src/lib/pill-style.ts");

  const hslPill = pastelPillColors("hsl(239, 84%, 67%)", "hsl(0, 0%, 100%)", false);
  const hslBg = blendOver(hslPill.backgroundColor, "#ffffff");
  assert.ok(getContrastRatio(hslPill.color, hslBg) >= 4.5, "hsl pill light contrast < 4.5");

  for (const [surface, isDark] of [
    ["#ffffff", false],
    ["#11161c", true],
  ]) {
    const hdr = solidHeaderBg(surface, isDark);
    const parsed = decomposeColor(hdr);
    assert.ok(parsed.values.length === 3 || parsed.values[3] === 1, `Header bg not opaque: ${hdr}`);
  }

  const lightAmber = solidTextTone("#f59e0b", "#ffffff", false);
  assert.ok(getContrastRatio(lightAmber, "#ffffff") >= 4.5, `Amber text on white < 4.5: ${lightAmber}`);

  const darkIndigo = solidTextTone("#4f46e5", "#11161c", true);
  assert.ok(getContrastRatio(darkIndigo, "#11161c") >= 4.5, `Indigo text on dark < 4.5: ${darkIndigo}`);
});

test("summarizeInvoices excludes $0 drafts from paidCount and computePaymentUpdate guards precision & bounds", async () => {
  const { summarizeInvoices, computePaymentUpdate } = await importTs("src/lib/invoice-metrics.ts");

  const draftStats = summarizeInvoices([
    { id: "d1", invoice_number: "INV-000", customer_id: "c1", total: 0, paid_amount: 0, payment_status: "unpaid", status: "draft", customers: null },
  ]);
  assert.equal(draftStats.paidCount, 0);
  assert.equal(draftStats.unpaidCount, 1);

  const partial = computePaymentUpdate(200, 100.1, 0.2);
  assert.deepEqual(partial, {
    valid: true,
    nextPaid: 100.3,
    paymentStatus: "partial",
    invoiceStatus: "partial",
    remaining: 99.7,
  });

  const paid = computePaymentUpdate(200, 100.3, 99.7);
  assert.deepEqual(paid, {
    valid: true,
    nextPaid: 200,
    paymentStatus: "paid",
    invoiceStatus: "paid",
    remaining: 0,
  });

  for (const badAmount of [0, -10, Number.NaN, Number.POSITIVE_INFINITY, 300]) {
    assert.equal(computePaymentUpdate(200, 100.3, badAmount).valid, false);
  }
});

test("task-lanes computes full-lane neighbors independent of filters and coalesces nullable status", async () => {
  const { TASK_LANES, getAdjacentLanes, normalizeTaskStatus, formatTaskStatus } = await importTs("src/lib/task-lanes.ts");
  assert.equal(TASK_LANES.length, 3);
  assert.equal(getAdjacentLanes("pending").prev, null);
  assert.equal(getAdjacentLanes("pending").next?.id, "in_progress");
  assert.equal(getAdjacentLanes("in_progress").prev?.id, "pending");
  assert.equal(getAdjacentLanes("in_progress").next?.id, "completed");
  assert.equal(getAdjacentLanes("completed").prev?.id, "in_progress");
  assert.equal(getAdjacentLanes("completed").next, null);
  assert.equal(normalizeTaskStatus(null), "pending");
  assert.equal(normalizeTaskStatus("unknown"), "pending");
  assert.equal(formatTaskStatus(null), "Pending");
  assert.equal(formatTaskStatus("in_progress"), "In Progress");
});

test("calendar-utils handles multi-day overlap intersection and strict category filtering", async () => {
  const { eventIntersectsDay, matchesCategoryFilter } = await importTs("src/lib/calendar-utils.ts");

  const multiDay = { start_date: "2026-11-20T10:00:00", end_date: "2026-11-22T14:00:00" };
  assert.equal(eventIntersectsDay(multiDay, new Date("2026-11-19T12:00:00")), false);
  assert.equal(eventIntersectsDay(multiDay, new Date("2026-11-20T12:00:00")), true);
  assert.equal(eventIntersectsDay(multiDay, new Date("2026-11-21T12:00:00")), true);
  assert.equal(eventIntersectsDay(multiDay, new Date("2026-11-22T12:00:00")), true);
  assert.equal(eventIntersectsDay(multiDay, new Date("2026-11-23T12:00:00")), false);

  const openEnded = { start_date: "2026-11-20T10:00:00", end_date: null };
  assert.equal(eventIntersectsDay(openEnded, new Date("2026-11-20T12:00:00")), true);
  assert.equal(eventIntersectsDay(openEnded, new Date("2026-11-21T12:00:00")), false);

  const allOn = { personal: true, business: true, family: true, holiday: true, etc: true };
  const allOff = { personal: false, business: false, family: false, holiday: false, etc: false };
  const partialOn = { personal: true, business: false, family: true, holiday: true, etc: true };
  assert.equal(matchesCategoryFilter("unknown_cat", allOn), true);
  assert.equal(matchesCategoryFilter("unknown_cat", allOff), false);
  assert.equal(matchesCategoryFilter("unknown_cat", partialOn), false);
  assert.equal(matchesCategoryFilter("business", partialOn), false);
  assert.equal(matchesCategoryFilter("personal", partialOn), true);
});
