import { PDFDocument, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import {
  PDF_COLORS,
  PDF_LAYOUT,
  drawRightText,
  embedImageSafe,
  formatDate,
  formatInr,
  loadFontBytes,
  safePdfText,
  wrapLines,
  type DocumentPdfBusiness,
} from "./document-pdf.js";
import { computeCashDayExpectedClosing, normalizeDateKey } from "./finance-sync.js";

const { A4_W, A4_H, MARGIN, CONTENT_W, BOTTOM_LIMIT } = PDF_LAYOUT;
const C = PDF_COLORS;

export interface CashflowAuditDayRow {
  date: string;
  status?: string | null;
  opening_cash: number;
  pos_total?: number | null;
  auto_income?: number | null;
  manual_income?: number | null;
  transfer_in?: number | null;
  auto_expense?: number | null;
  manual_expense?: number | null;
  transfer_out?: number | null;
  expected_closing?: number | null;
  closing_cash?: number | null;
  difference?: number | null;
  staff_name?: string | null;
  notes?: string | null;
}

export interface CashflowAuditTxRow {
  transaction_id: string;
  date: string;
  type: string;
  entry_source?: string | null;
  payment_mode?: string | null;
  amount: number;
  account_name?: string | null;
  category_name?: string | null;
  reference?: string | null;
  description?: string | null;
  staff_name?: string | null;
}

export interface CashflowAuditPdfInput {
  business: DocumentPdfBusiness;
  fromDate: string;
  toDate: string;
  days: CashflowAuditDayRow[];
  transactions: CashflowAuditTxRow[];
  auditLogs?: Array<{ created_at: string; action: string; details?: string | null; staff_name?: string | null }>;
}

export interface PayrollSlipPdfInput {
  business: DocumentPdfBusiness;
  slipNumber?: string | null;
  month: string;
  employeeName: string;
  employeeRole?: string | null;
  department?: string | null;
  workingDays?: number | null;
  presentDays?: number | null;
  halfDays?: number | null;
  leaveDays?: number | null;
  absentDays?: number | null;
  monthlyBaseSalary?: number | null;
  basicSalary: number;
  bonus?: number | null;
  advanceDeduction?: number | null;
  otherDeductions?: number | null;
  netSalary: number;
  paymentStatus: string;
  paidDate?: string | null;
  paymentMode?: string | null;
  accountName?: string | null;
  notes?: string | null;
}

function stampHeaderFooter(
  pdfDoc: PDFDocument,
  pagesCountBefore: number,
  business: DocumentPdfBusiness,
  badgeTitle: string,
  subtitleRight: string,
  fontReg: any,
  fontBold: any
) {
  const pages = pdfDoc.getPages();
  const rawFooterLeft = [
    business.company_name || "ALVStore",
    business.company_email || "sales@alvstore.in",
    business.company_phone,
  ]
    .filter(Boolean)
    .join("  ·  ");
  const footerLeft = wrapLines(rawFooterLeft, fontReg, 7.5, CONTENT_W - 80)[0] || "";
  void pagesCountBefore;
  void badgeTitle;
  void subtitleRight;
  pages.forEach((p, idx) => {
    p.drawLine({ start: { x: MARGIN, y: 32 }, end: { x: A4_W - MARGIN, y: 32 }, thickness: 0.5, color: C.line });
    p.drawText(footerLeft, { x: MARGIN, y: 20, size: 7.5, font: fontReg, color: C.muted });
    drawRightText(p, `Page ${idx + 1} of ${pages.length}`, A4_W - MARGIN, 20, fontReg, 7.5, C.muted);
  });
}

/** Generates a branded ALVStore A4 Cash Flow & Daily Reconciliation Audit Report PDF. */
export async function buildCashflowAuditPdf(input: CashflowAuditPdfInput): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);
  const { regular, bold } = loadFontBytes();
  const fontReg = await pdfDoc.embedFont(regular);
  const fontBold = await pdfDoc.embedFont(bold);
  const logoImage =
    (await embedImageSafe(pdfDoc, "/alvstore-logo-dark.png")) ||
    (await embedImageSafe(pdfDoc, input.business.logo_url));

  let page = pdfDoc.addPage([A4_W, A4_H]);
  let y = A4_H;

  const drawHeader = (continuation = false) => {
    const headerH = continuation ? 38 : 84;
    page.drawRectangle({ x: 0, y: A4_H - headerH, width: A4_W, height: headerH, color: C.obsidian });
    page.drawRectangle({ x: 0, y: A4_H - headerH - 2, width: A4_W, height: 2, color: C.brass });

    if (continuation) {
      page.drawText(safePdfText(`${input.business.company_name || "ALVStore"} — CASH FLOW AUDIT`), {
        x: MARGIN,
        y: A4_H - 24,
        size: 9.5,
        font: fontBold,
        color: C.chalk,
      });
      drawRightText(page, `${input.fromDate} to ${input.toDate}`, A4_W - MARGIN, A4_H - 24, fontReg, 8.5, C.brass);
      y = A4_H - 54;
      return;
    }

    if (logoImage) {
      const dims = logoImage.scaleToFit(108, 28);
      page.drawImage(logoImage, { x: MARGIN, y: A4_H - 35 - dims.height / 2 + 8, width: dims.width, height: dims.height });
    } else {
      page.drawText(safePdfText(input.business.company_name || "ALVStore"), {
        x: MARGIN,
        y: A4_H - 32,
        size: 16,
        font: fontBold,
        color: C.chalk,
      });
    }

    const addrLines = wrapLines(
      [
        input.business.company_address,
        [input.business.company_phone, input.business.company_email].filter(Boolean).join(" · "),
      ]
        .filter(Boolean)
        .join("\n"),
      fontReg,
      7.6,
      260
    );
    let infoY = A4_H - 50;
    for (const line of addrLines.slice(0, 2)) {
      page.drawText(line, { x: MARGIN, y: infoY, size: 7.6, font: fontReg, color: rgb(195 / 255, 198 / 255, 204 / 255) });
      infoY -= 10;
    }

    const rightEdge = A4_W - MARGIN;
    drawRightText(page, "CASH FLOW AUDIT REPORT", rightEdge, A4_H - 28, fontBold, 13, C.brass);
    drawRightText(page, `${formatDate(input.fromDate)} — ${formatDate(input.toDate)}`, rightEdge, A4_H - 45, fontBold, 10, C.white);
    drawRightText(page, `Generated ${formatDate(new Date())}`, rightEdge, A4_H - 60, fontReg, 7.8, rgb(200 / 255, 205 / 255, 212 / 255));
    y = A4_H - headerH - 18;
  };

  const ensureSpace = (needed: number) => {
    if (y - needed >= BOTTOM_LIMIT) return false;
    page = pdfDoc.addPage([A4_W, A4_H]);
    drawHeader(true);
    return true;
  };

  drawHeader(false);

  // Executive KPI Summary
  const totalInflow = input.transactions
    .filter((t) => t.type === "income")
    .reduce((s, t) => s + Number(t.amount || 0), 0);
  const totalOutflow = input.transactions
    .filter((t) => t.type === "expense")
    .reduce((s, t) => s + Number(t.amount || 0), 0);
  const autoCount = input.transactions.filter((t) => t.entry_source && t.entry_source !== "manual").length;
  const totalVariance = input.days.reduce((s, d) => s + Number(d.difference || 0), 0);

  const boxW = (CONTENT_W - 18) / 4;
  const stats = [
    { label: "TOTAL INFLOW", val: formatInr(totalInflow), color: C.successInk },
    { label: "TOTAL OUTFLOW", val: formatInr(totalOutflow), color: C.dangerInk },
    { label: "NET CASH FLOW", val: formatInr(totalInflow - totalOutflow), color: C.ink },
    { label: `DRAWER VARIANCE (${autoCount} AUTO)`, val: formatInr(totalVariance), color: totalVariance < 0 ? C.dangerInk : C.brass },
  ];
  stats.forEach((st, idx) => {
    const x = MARGIN + idx * (boxW + 6);
    page.drawRectangle({ x, y: y - 42, width: boxW, height: 42, color: C.surface, borderColor: C.line, borderWidth: 0.75 });
    page.drawText(st.label, { x: x + 8, y: y - 14, size: 6.4, font: fontBold, color: C.muted });
    page.drawText(safePdfText(st.val), { x: x + 8, y: y - 31, size: 9.5, font: fontBold, color: st.color });
  });
  y -= 56;

  // Section 1: Daily Closing -> Opening Chain
  page.drawText("DAILY OPENING -> CLOSING BALANCE CHAIN", { x: MARGIN, y, size: 8, font: fontBold, color: C.brass });
  y -= 8;

  const drawDayHeader = () => {
    const h = 20;
    page.drawRectangle({ x: MARGIN, y: y - h, width: CONTENT_W, height: h, color: C.obsidian });
    const ty = y - 13;
    page.drawText("Date", { x: MARGIN + 6, y: ty, size: 7.2, font: fontBold, color: C.white });
    page.drawText("Status", { x: MARGIN + 70, y: ty, size: 7.2, font: fontBold, color: C.white });
    drawRightText(page, "Opening", MARGIN + 172, ty, fontBold, 7.2, C.white);
    drawRightText(page, "Inflows", MARGIN + 240, ty, fontBold, 7.2, C.white);
    drawRightText(page, "Outflows", MARGIN + 308, ty, fontBold, 7.2, C.white);
    drawRightText(page, "Expected", MARGIN + 382, ty, fontBold, 7.2, C.white);
    drawRightText(page, "Closing", MARGIN + 455, ty, fontBold, 7.2, C.white);
    drawRightText(page, "Variance", MARGIN + CONTENT_W - 6, ty, fontBold, 7.2, C.white);
    y -= h;
  };
  drawDayHeader();

  const daysSorted = [...input.days].sort((a, b) => normalizeDateKey(a.date).localeCompare(normalizeDateKey(b.date)));
  if (daysSorted.length === 0) {
    page.drawText("No daily cash control sheets recorded in this period.", { x: MARGIN + 6, y: y - 14, size: 8, font: fontReg, color: C.muted });
    y -= 22;
  } else {
    daysSorted.forEach((d, i) => {
      if (ensureSpace(20)) drawDayHeader();
      const inflow = Number(d.pos_total || 0) + Number(d.auto_income || 0) + Number(d.manual_income || 0) + Number(d.transfer_in || 0);
      const outflow = Number(d.auto_expense || 0) + Number(d.manual_expense || 0) + Number(d.transfer_out || 0);
      const expected = d.expected_closing != null ? Number(d.expected_closing) : computeCashDayExpectedClosing(d);
      const bg = i % 2 === 1 ? C.surface : C.white;
      page.drawRectangle({ x: MARGIN, y: y - 18, width: CONTENT_W, height: 18, color: bg, borderColor: C.line, borderWidth: 0.4 });
      const ty = y - 12;
      page.drawText(formatDate(normalizeDateKey(d.date)), { x: MARGIN + 6, y: ty, size: 7.4, font: fontBold, color: C.ink });
      page.drawText(String(d.status || "open").toUpperCase(), { x: MARGIN + 70, y: ty, size: 7, font: fontReg, color: C.slate });
      drawRightText(page, formatInr(Number(d.opening_cash || 0)), MARGIN + 172, ty, fontReg, 7.3, C.ink);
      drawRightText(page, formatInr(inflow), MARGIN + 240, ty, fontReg, 7.3, C.successInk);
      drawRightText(page, formatInr(outflow), MARGIN + 308, ty, fontReg, 7.3, C.dangerInk);
      drawRightText(page, formatInr(expected), MARGIN + 382, ty, fontReg, 7.3, C.ink);
      drawRightText(page, d.closing_cash != null ? formatInr(Number(d.closing_cash)) : "—", MARGIN + 455, ty, fontBold, 7.3, C.ink);
      const varNum = d.difference != null ? Number(d.difference) : null;
      drawRightText(
        page,
        varNum != null ? formatInr(varNum) : "—",
        MARGIN + CONTENT_W - 6,
        ty,
        fontBold,
        7.3,
        varNum == null ? C.muted : varNum < 0 ? C.dangerInk : varNum > 0 ? C.successInk : C.ink
      );
      y -= 18;
    });
  }

  y -= 16;
  ensureSpace(44);
  page.drawText(`LEDGER TRANSACTIONS (${input.transactions.length})`, { x: MARGIN, y, size: 8, font: fontBold, color: C.brass });
  y -= 8;

  const drawTxHeader = () => {
    const h = 20;
    page.drawRectangle({ x: MARGIN, y: y - h, width: CONTENT_W, height: h, color: C.obsidian });
    const ty = y - 13;
    page.drawText("ID / Date", { x: MARGIN + 6, y: ty, size: 7.2, font: fontBold, color: C.white });
    page.drawText("Source", { x: MARGIN + 108, y: ty, size: 7.2, font: fontBold, color: C.white });
    page.drawText("Account / Mode", { x: MARGIN + 175, y: ty, size: 7.2, font: fontBold, color: C.white });
    page.drawText("Details / Reference", { x: MARGIN + 275, y: ty, size: 7.2, font: fontBold, color: C.white });
    drawRightText(page, "Amount", MARGIN + CONTENT_W - 6, ty, fontBold, 7.2, C.white);
    y -= h;
  };
  drawTxHeader();

  for (let i = 0; i < input.transactions.length; i++) {
    const t = input.transactions[i];
    if (ensureSpace(24)) drawTxHeader();
    const rowH = 22;
    const bg = i % 2 === 1 ? C.surface : C.white;
    page.drawRectangle({ x: MARGIN, y: y - rowH, width: CONTENT_W, height: rowH, color: bg, borderColor: C.line, borderWidth: 0.4 });
    const ty = y - 9;
    page.drawText(safePdfText(t.transaction_id || "FIN"), { x: MARGIN + 6, y: ty, size: 7.2, font: fontBold, color: C.ink });
    page.drawText(formatDate(normalizeDateKey(t.date)), { x: MARGIN + 6, y: ty - 8, size: 6.5, font: fontReg, color: C.muted });
    page.drawText(safePdfText(`${t.type.toUpperCase()} · ${t.entry_source || "manual"}`).slice(0, 16), { x: MARGIN + 108, y: ty - 3, size: 6.8, font: fontReg, color: C.slate });
    page.drawText(safePdfText(`${t.account_name || "Account"} (${t.payment_mode || "cash"})`).slice(0, 22), { x: MARGIN + 175, y: ty - 3, size: 6.8, font: fontReg, color: C.slate });
    const det = wrapLines([t.category_name, t.description, t.reference].filter(Boolean).join(" · "), fontReg, 7, 175)[0] || "—";
    page.drawText(det, { x: MARGIN + 275, y: ty - 3, size: 7, font: fontReg, color: C.ink });
    const signed = `${t.type === "expense" ? "-" : t.type === "income" ? "+" : ""}${formatInr(Number(t.amount || 0))}`;
    drawRightText(
      page,
      signed,
      MARGIN + CONTENT_W - 6,
      ty - 3,
      fontBold,
      7.4,
      t.type === "expense" ? C.dangerInk : t.type === "income" ? C.successInk : C.ink
    );
    y -= rowH;
  }

  stampHeaderFooter(pdfDoc, 1, input.business, "CASH FLOW AUDIT", "", fontReg, fontBold);
  return pdfDoc.save();
}

/** Generates a branded ALVStore A4 Employee Salary Slip PDF. */
export async function buildPayrollSlipPdf(input: PayrollSlipPdfInput): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);
  const { regular, bold } = loadFontBytes();
  const fontReg = await pdfDoc.embedFont(regular);
  const fontBold = await pdfDoc.embedFont(bold);
  const logoImage =
    (await embedImageSafe(pdfDoc, "/alvstore-logo-dark.png")) ||
    (await embedImageSafe(pdfDoc, input.business.logo_url));

  const page = pdfDoc.addPage([A4_W, A4_H]);
  const headerH = 86;
  page.drawRectangle({ x: 0, y: A4_H - headerH, width: A4_W, height: headerH, color: C.obsidian });
  page.drawRectangle({ x: 0, y: A4_H - headerH - 2, width: A4_W, height: 2, color: C.brass });

  if (logoImage) {
    const dims = logoImage.scaleToFit(108, 30);
    page.drawImage(logoImage, { x: MARGIN, y: A4_H - 36 - dims.height / 2 + 8, width: dims.width, height: dims.height });
  } else {
    page.drawText(safePdfText(input.business.company_name || "ALVStore"), { x: MARGIN, y: A4_H - 32, size: 16, font: fontBold, color: C.chalk });
  }
  const addr = wrapLines([input.business.company_address, [input.business.company_phone, input.business.company_email].filter(Boolean).join(" · ")].filter(Boolean).join("\n"), fontReg, 7.8, 280);
  let iy = A4_H - 52;
  for (const line of addr.slice(0, 2)) {
    page.drawText(line, { x: MARGIN, y: iy, size: 7.8, font: fontReg, color: rgb(195 / 255, 198 / 255, 204 / 255) });
    iy -= 10;
  }

  const rightEdge = A4_W - MARGIN;
  drawRightText(page, "SALARY PAYSLIP", rightEdge, A4_H - 28, fontBold, 14, C.brass);
  drawRightText(page, safePdfText(input.slipNumber || `PAY-${input.month}`), rightEdge, A4_H - 46, fontBold, 11.5, C.white);
  const monthLabel = (() => {
    const dt = new Date(`${input.month}-01T00:00:00Z`);
    return Number.isNaN(dt.getTime()) ? input.month : dt.toLocaleDateString("en-IN", { month: "long", year: "numeric", timeZone: "UTC" });
  })();
  drawRightText(page, `Pay Period: ${monthLabel}`, rightEdge, A4_H - 61, fontReg, 8.2, rgb(210 / 255, 214 / 255, 220 / 255));

  let y = A4_H - headerH - 22;

  // Employee & Attendance Summary Card
  const halfW = (CONTENT_W - 14) / 2;
  page.drawRectangle({ x: MARGIN, y: y - 76, width: halfW, height: 76, color: C.surface, borderColor: C.line, borderWidth: 0.75 });
  page.drawText("EMPLOYEE DETAILS", { x: MARGIN + 10, y: y - 14, size: 7.2, font: fontBold, color: C.brass });
  page.drawText(safePdfText(input.employeeName), { x: MARGIN + 10, y: y - 29, size: 10.5, font: fontBold, color: C.ink });
  page.drawText(safePdfText([input.employeeRole, input.department].filter(Boolean).join(" · ") || "Staff"), {
    x: MARGIN + 10,
    y: y - 42,
    size: 8.2,
    font: fontReg,
    color: C.slate,
  });
  page.drawText(
    safePdfText(`Status: ${input.paymentStatus.toUpperCase()}${input.paidDate ? ` · Paid ${formatDate(input.paidDate)}` : ""}`),
    { x: MARGIN + 10, y: y - 56, size: 8, font: fontBold, color: input.paymentStatus === "paid" ? C.successInk : C.warnInk }
  );
  if (input.paymentMode || input.accountName) {
    page.drawText(safePdfText(`Channel: ${[input.paymentMode?.toUpperCase(), input.accountName].filter(Boolean).join(" · ")}`), {
      x: MARGIN + 10,
      y: y - 68,
      size: 7.6,
      font: fontReg,
      color: C.muted,
    });
  }

  const rightX = MARGIN + halfW + 14;
  page.drawRectangle({ x: rightX, y: y - 76, width: halfW, height: 76, color: C.surface, borderColor: C.line, borderWidth: 0.75 });
  page.drawText("ATTENDANCE & WORKING DAYS", { x: rightX + 10, y: y - 14, size: 7.2, font: fontBold, color: C.brass });
  const attRows = [
    ["Scheduled Working Days", String(input.workingDays ?? "—")],
    ["Present / Half Days", `${input.presentDays ?? 0} full · ${input.halfDays ?? 0} half`],
    ["Paid Leaves / Absent", `${input.leaveDays ?? 0} leave · ${input.absentDays ?? 0} absent`],
    ["Monthly Base Salary", formatInr(Number(input.monthlyBaseSalary ?? input.basicSalary))],
  ];
  let ay = y - 29;
  for (const [k, v] of attRows) {
    page.drawText(k, { x: rightX + 10, y: ay, size: 7.8, font: fontReg, color: C.slate });
    drawRightText(page, v, rightX + halfW - 10, ay, fontBold, 7.8, C.ink);
    ay -= 13;
  }

  y -= 94;

  // Earnings & Deductions Table
  page.drawRectangle({ x: MARGIN, y: y - 22, width: CONTENT_W, height: 22, color: C.obsidian });
  page.drawText("COMPENSATION COMPONENT", { x: MARGIN + 10, y: y - 14, size: 7.8, font: fontBold, color: C.white });
  drawRightText(page, "AMOUNT", MARGIN + CONTENT_W - 10, y - 14, fontBold, 7.8, C.white);
  y -= 22;

  const lineRows: Array<{ label: string; value: string; color?: any; bold?: boolean }> = [
    { label: "Earned Basic Salary (Attendance Adjusted)", value: formatInr(Number(input.basicSalary || 0)) },
    { label: "Bonus & Incentives", value: `+ ${formatInr(Number(input.bonus || 0))}`, color: C.successInk },
    { label: "Advance Recovery Deduction", value: `- ${formatInr(Number(input.advanceDeduction || 0))}`, color: C.dangerInk },
    { label: "Other Deductions", value: `- ${formatInr(Number(input.otherDeductions || 0))}`, color: C.dangerInk },
    { label: "NET PAYABLE SALARY", value: formatInr(Number(input.netSalary || 0)), bold: true },
  ];

  lineRows.forEach((row, i) => {
    const h = row.bold ? 28 : 22;
    const bg = row.bold ? C.surface : i % 2 === 1 ? rgb(252 / 255, 252 / 255, 253 / 255) : C.white;
    page.drawRectangle({ x: MARGIN, y: y - h, width: CONTENT_W, height: h, color: bg, borderColor: row.bold ? C.brass : C.line, borderWidth: row.bold ? 1 : 0.5 });
    const ty = y - (row.bold ? 17 : 14);
    page.drawText(row.label, { x: MARGIN + 10, y: ty, size: row.bold ? 9.5 : 8.4, font: row.bold ? fontBold : fontReg, color: C.ink });
    drawRightText(page, row.value, MARGIN + CONTENT_W - 10, ty, row.bold ? fontBold : fontReg, row.bold ? 10 : 8.5, row.color || C.ink);
    y -= h;
  });

  if (input.notes?.trim()) {
    y -= 18;
    page.drawText("NOTES", { x: MARGIN, y, size: 7.4, font: fontBold, color: C.brass });
    y -= 12;
    for (const l of wrapLines(input.notes, fontReg, 8.2, CONTENT_W - 10)) {
      page.drawText(l, { x: MARGIN, y, size: 8.2, font: fontReg, color: C.slate });
      y -= 11;
    }
  }

  stampHeaderFooter(pdfDoc, 1, input.business, "SALARY PAYSLIP", "", fontReg, fontBold);
  return pdfDoc.save();
}
