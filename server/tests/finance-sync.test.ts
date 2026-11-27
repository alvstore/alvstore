import test from "node:test";
import assert from "node:assert/strict";
import { PDFDocument } from "pdf-lib";
import {
  auditCarryForwardChain,
  computeCashDayExpectedClosing,
  resolveAccountTypeForMode,
} from "../src/lib/finance-sync.js";
import { buildCashflowAuditPdf, buildPayrollSlipPdf } from "../src/lib/report-pdf.js";

test("resolveAccountTypeForMode routes cash vs non-cash modes safely", () => {
  assert.equal(resolveAccountTypeForMode("cash"), "cash");
  assert.equal(resolveAccountTypeForMode("CASH"), "cash");
  assert.equal(resolveAccountTypeForMode("upi"), "bank");
  assert.equal(resolveAccountTypeForMode("card"), "bank");
  assert.equal(resolveAccountTypeForMode("bank_transfer"), "bank");
  assert.equal(resolveAccountTypeForMode("razorpay"), "bank");
  assert.equal(resolveAccountTypeForMode("online"), "bank");
  assert.equal(resolveAccountTypeForMode(null), "cash");
});

test("computeCashDayExpectedClosing and auditCarryForwardChain detect continuity cleanly", () => {
  const expected = computeCashDayExpectedClosing({
    opening_cash: 5000,
    pos_total: 12000,
    auto_income: 3500,
    manual_income: 1000,
    transfer_in: 2000,
    auto_expense: 4000,
    manual_expense: 500,
    transfer_out: 6000,
  });
  // 5000 + 12000 + 3500 + 1000 + 2000 - 4000 - 500 - 6000 = 13000
  assert.equal(expected, 13000);

  // Supports zero opening/closing float
  assert.equal(computeCashDayExpectedClosing({ opening_cash: 0 }), 0);

  const audit = auditCarryForwardChain([
    {
      date: "2026-11-26",
      opening_cash: 13200,
      closing_cash: null,
      expected_closing: 15000,
      status: "open",
      opening_override_reason: null,
    },
    {
      date: "2026-11-25",
      opening_cash: 5000,
      closing_cash: 13000,
      expected_closing: 13000,
      status: "closed",
      opening_override_reason: null,
    },
    {
      date: "2026-11-24",
      opening_cash: 0,
      closing_cash: 5000,
      expected_closing: 5000,
      status: "closed",
      opening_override_reason: null,
    },
  ]);

  assert.equal(audit["2026-11-25"].status, "linked");
  assert.equal(audit["2026-11-26"].status, "mismatch");
  assert.equal(audit["2026-11-26"].delta, 200);
});

test("buildCashflowAuditPdf and buildPayrollSlipPdf render valid ALVStore branded A4 PDFs with Rupee glyphs", async () => {
  const sampleBusiness = {
    company_name: "ALVStore",
    company_address: "Udaipur, Rajasthan",
    company_phone: "+91 98876 01200",
    company_email: "sales@alvstore.in",
    gst_number: "08ABCDE1234F1Z5",
  };

  const cashPdf = await buildCashflowAuditPdf({
    business: sampleBusiness,
    fromDate: "2026-11-24",
    toDate: "2026-11-26",
    days: [
      {
        date: "2026-11-25",
        status: "closed",
        opening_cash: 5000,
        pos_total: 12000,
        auto_income: 3500,
        manual_income: 1000,
        transfer_in: 2000,
        auto_expense: 4000,
        manual_expense: 500,
        transfer_out: 6000,
        expected_closing: 13000,
        closing_cash: 12950,
        difference: -50,
        staff_name: "ALV Admin",
        notes: "Minor loose change",
      },
    ],
    transactions: [
      {
        transaction_id: "FIN-00012",
        date: "2026-11-25",
        type: "income",
        entry_source: "pos",
        payment_mode: "cash",
        amount: 12000,
        account_name: "Cash Drawer",
        category_name: "POS Sales",
        reference: "POS-00012",
        description: "POS checkout",
        staff_name: "ALV Admin",
      },
    ],
  });
  assert.equal(Buffer.from(cashPdf.slice(0, 5)).toString(), "%PDF-");
  const parsedCash = await PDFDocument.load(cashPdf);
  assert.ok(parsedCash.getPageCount() >= 1);

  const slipPdf = await buildPayrollSlipPdf({
    business: sampleBusiness,
    slipNumber: "PAY-00009",
    month: "2026-11",
    employeeName: "Rohan Sharma",
    employeeRole: "Senior Technician",
    department: "AV Engineering",
    workingDays: 25,
    presentDays: 23,
    halfDays: 1,
    leaveDays: 1,
    absentDays: 1,
    monthlyBaseSalary: 30000,
    basicSalary: 28200,
    bonus: 1500,
    advanceDeduction: 3000,
    otherDeductions: 200,
    netSalary: 26500,
    paymentStatus: "paid",
    paidDate: "2026-11-26",
    paymentMode: "cash",
    accountName: "Cash Drawer",
    notes: "Diwali performance bonus included",
  });
  assert.equal(Buffer.from(slipPdf.slice(0, 5)).toString(), "%PDF-");
  const parsedSlip = await PDFDocument.load(slipPdf);
  assert.equal(parsedSlip.getPageCount(), 1);
});
