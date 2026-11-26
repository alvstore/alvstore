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
});
