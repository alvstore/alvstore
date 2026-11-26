import test from "node:test";
import assert from "node:assert/strict";
import { planDocumentStockAction } from "../src/lib/inventory-ledger.js";

test("planDocumentStockAction prevents double-deduction across linked invoice and challan, skips repair handovers, and handles returns idempotently", () => {
  // Standalone challan transitioning to dispatched deducts once
  assert.equal(
    planDocumentStockAction({
      docType: "challan",
      deductStock: true,
      stockDeductedAt: null,
      stockReversedAt: null,
      linkedAlreadyDeducted: false,
      jobSheetId: null,
      challanType: "delivery",
      targetStatus: "dispatched",
    }),
    "deduct_out"
  );

  // Already-deducted invoice linked to challan must NEVER double-deduct
  assert.equal(
    planDocumentStockAction({
      docType: "challan",
      deductStock: true,
      stockDeductedAt: null,
      stockReversedAt: null,
      linkedAlreadyDeducted: true,
      jobSheetId: null,
      challanType: "delivery",
      targetStatus: "dispatched",
    }),
    "noop"
  );

  // Repeat transition when already deducted stays idempotent
  assert.equal(
    planDocumentStockAction({
      docType: "challan",
      deductStock: true,
      stockDeductedAt: new Date(),
      stockReversedAt: null,
      linkedAlreadyDeducted: false,
      jobSheetId: null,
      challanType: "delivery",
      targetStatus: "delivered",
    }),
    "noop"
  );

  // Returnable or cancelled challan restores stock once
  assert.equal(
    planDocumentStockAction({
      docType: "challan",
      deductStock: true,
      stockDeductedAt: new Date(),
      stockReversedAt: null,
      linkedAlreadyDeducted: false,
      jobSheetId: null,
      challanType: "returnable",
      targetStatus: "returned",
    }),
    "restore_in"
  );

  // Second return call is idempotent
  assert.equal(
    planDocumentStockAction({
      docType: "challan",
      deductStock: true,
      stockDeductedAt: new Date(),
      stockReversedAt: new Date(),
      linkedAlreadyDeducted: false,
      jobSheetId: null,
      challanType: "returnable",
      targetStatus: "returned",
    }),
    "noop"
  );

  // Customer repair device return challan never alters showroom inventory
  assert.equal(
    planDocumentStockAction({
      docType: "challan",
      deductStock: false,
      stockDeductedAt: null,
      stockReversedAt: null,
      linkedAlreadyDeducted: false,
      jobSheetId: "job-1",
      challanType: "delivery",
      targetStatus: "delivered",
    }),
    "noop"
  );

  // Sales return receipt adds stock in once when delivered
  assert.equal(
    planDocumentStockAction({
      docType: "challan",
      deductStock: true,
      stockDeductedAt: null,
      stockReversedAt: null,
      linkedAlreadyDeducted: false,
      jobSheetId: null,
      challanType: "sales_return",
      targetStatus: "delivered",
    }),
    "restore_in"
  );

  // Invoice deducts once unless already deducted
  assert.equal(
    planDocumentStockAction({
      docType: "invoice",
      deductStock: true,
      stockDeductedAt: null,
      stockReversedAt: null,
      linkedAlreadyDeducted: false,
    }),
    "deduct_out"
  );
  assert.equal(
    planDocumentStockAction({
      docType: "invoice",
      deductStock: true,
      stockDeductedAt: null,
      stockReversedAt: null,
      linkedAlreadyDeducted: true,
    }),
    "noop"
  );
  assert.equal(
    planDocumentStockAction({
      docType: "invoice",
      deductStock: true,
      jobSheetId: "job-1",
      stockDeductedAt: null,
      stockReversedAt: null,
      linkedAlreadyDeducted: false,
    }),
    "noop"
  );
  assert.equal(
    planDocumentStockAction({
      docType: "invoice",
      deductStock: true,
      targetStatus: "cancelled",
      stockDeductedAt: new Date("2026-11-26T10:00:00Z"),
      stockReversedAt: null,
      linkedAlreadyDeducted: false,
    }),
    "restore_in"
  );
});
