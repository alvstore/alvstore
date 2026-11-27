import test from "node:test";
import assert from "node:assert/strict";
import metaJson from "../src/generated/schema-meta.json" with { type: "json" };

const tables = metaJson.tables as Record<string, { columns: Array<{ name: string }> }>;

test("schema-meta includes new Quotation, Invoice, and 2026 Delivery Challan columns", () => {
  const cols = (table: string) => new Set(tables[table].columns.map(c => c.name));

  assert.ok(cols("quotations").has("show_item_images"));
  assert.ok(cols("quotations").has("rejection_reason"));
  assert.ok(cols("quotations").has("responded_at"));
  assert.ok(cols("quotation_items").has("sort_order"));

  assert.ok(cols("invoices").has("deduct_stock"));
  assert.ok(cols("invoices").has("stock_deducted_at"));
  assert.ok(cols("invoices").has("stock_reversed_at"));
  assert.ok(cols("invoice_items").has("sort_order"));

  for (const col of [
    "public_token", "quotation_id", "job_sheet_id", "challan_type",
    "show_pricing", "show_item_images", "shipping_address",
    "courier_name", "tracking_number", "tracking_url", "eway_bill_number",
    "dispatched_at", "expected_delivery_at", "delivered_at",
    "receiver_name", "receiver_phone", "pod_photo_url",
    "discount_type", "discount_value", "deduct_stock",
    "stock_deducted_at", "stock_reversed_at", "timeline",
  ]) {
    assert.ok(cols("delivery_challans").has(col), `Missing delivery_challans.${col}`);
  }

  for (const col of ["description", "discount_type", "discount_value", "image_url", "sort_order"]) {
    assert.ok(cols("delivery_challan_items").has(col), `Missing delivery_challan_items.${col}`);
  }

  for (const col of ["previous_closing", "auto_income", "auto_expense", "transfer_in", "transfer_out", "opening_override_reason", "reopened_at", "reopened_by"]) {
    assert.ok(cols("daily_cash_control").has(col), `Missing daily_cash_control.${col}`);
  }

  for (const col of ["entry_source", "source_id", "daily_cash_date"]) {
    assert.ok(cols("finance_transactions").has(col), `Missing finance_transactions.${col}`);
  }

  assert.ok(cols("attendance_records").has("status"), "Missing attendance_records.status");

  for (const col of [
    "slip_number", "working_days", "present_days", "half_days", "leave_days",
    "absent_days", "overtime_hours", "gross_salary", "advance_deduction",
    "other_deductions", "payment_mode", "account_id", "finance_transaction_id", "policy_snapshot",
  ]) {
    assert.ok(cols("payroll").has(col), `Missing payroll.${col}`);
  }

  assert.ok(tables.employee_advances, "Missing employee_advances table in schema-meta");
  assert.ok(tables.payroll_advance_recoveries, "Missing payroll_advance_recoveries table in schema-meta");
  for (const col of ["advance_number", "employee_id", "amount", "recovered_amount", "remaining_amount", "advance_date", "payment_mode", "account_id", "status", "finance_transaction_id"]) {
    assert.ok(cols("employee_advances").has(col), `Missing employee_advances.${col}`);
  }
});
