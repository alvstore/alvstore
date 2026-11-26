import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

function readSrc(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

test("print CSS and public document screens remove fake watermarks and legacy ERPMaster footer", () => {
  const css = readSrc("src/index.css");
  assert.equal(css.includes("ORIGINAL COPY"), false);

  const pubQuote = readSrc("src/screens/PublicQuotation.tsx");
  assert.equal(pubQuote.includes("Powered by ERPMaster"), false);

  const pubInv = readSrc("src/screens/PublicInvoice.tsx");
  assert.equal(pubInv.includes("Powered by ERPMaster"), false);
});

test("reusable document UI components provide sortable line items, fixed media alignment, and server PDF download", () => {
  const editor = readSrc("src/components/documents/SortableLineItemsEditor.tsx");
  assert.ok(editor.includes("reorderListItems"));
  assert.ok(editor.includes("Move "));
  assert.ok(editor.includes("uploadDocumentItemImage"));
  assert.ok(editor.includes('role="alert"'));

  const table = readSrc("src/components/documents/ItemsTable.tsx");
  assert.ok(table.includes("showImages"));
  assert.ok(table.includes("hidePricing"));

  const preview = readSrc("src/components/documents/DocumentPreview.tsx");
  assert.ok(preview.includes("downloadDocumentPdf"));
  assert.ok(preview.includes('type === "invoice" ? false : showImages'));

  const drawer = readSrc("src/components/documents/SendDocumentDrawer.tsx");
  assert.ok(drawer.includes("attach_document"));
  assert.ok(drawer.includes("send-email"));
  assert.ok(drawer.includes("SideDrawer"));
});

test("client PDF helper preserves order helper and image normalization guard", () => {
  const helper = readSrc("src/lib/document-pdf-client.ts");
  assert.ok(helper.includes("reorderListItems"));
  assert.ok(helper.includes("getBackendAuthHeaders"));
  assert.ok(helper.includes("Only PNG, JPEG, or WebP images are allowed."));
  assert.ok(helper.includes("Image size must be 5 MB or less."));
});

test("Quotation flows enforce accepted lock, duplicate-as-new, token-verified response, and Invoice thumbnail suppression", () => {
  const qAdd = readSrc("src/screens/QuotationAdd.tsx");
  assert.ok(qAdd.includes("isLockedAccepted"));
  assert.ok(qAdd.includes("Duplicate as New Quotation"));
  assert.ok(qAdd.includes("Show Item Images"));
  assert.ok(qAdd.includes("SortableLineItemsEditor"));

  const qPrev = readSrc("src/screens/QuotationPreview.tsx");
  assert.ok(qPrev.includes("!quotation.converted_invoice_id"));
  assert.equal(qPrev.includes('quotation.status !== "accepted" && !quotation.converted_invoice_id'), false);
  assert.ok(qPrev.includes("document-stock"));

  const pubQuote = readSrc("src/screens/PublicQuotation.tsx");
  assert.ok(pubQuote.includes("public-quotation-respond"));
  assert.ok(pubQuote.includes("public-quotation-view"));
  assert.ok(pubQuote.includes("downloadDocumentPdf"));

  const portal = readSrc("src/screens/CustomerPortal.tsx");
  assert.ok(portal.includes("public-quotation-respond"));
  assert.equal(portal.includes('from("quotations").update'), false);

  const invAdd = readSrc("src/screens/InvoiceAdd.tsx");
  assert.ok(invAdd.includes("allowImages={false}"));
  assert.ok(invAdd.includes("showImages={false}"));
  assert.ok(invAdd.includes("document-stock"));

  const invPrev = readSrc("src/screens/InvoicePreview.tsx");
  assert.ok(invPrev.includes("showImages={false}"));
  assert.ok(invPrev.includes("downloadDocumentPdf"));
});

test("Delivery Challan 2026 workflow supports searchable customer, repair handover suppression, milestones, and public POD", () => {
  const chAdd = readSrc("src/screens/DeliveryChallanAdd.tsx");
  assert.ok(chAdd.includes("Autocomplete"));
  assert.ok(chAdd.includes("CustomerQuickDialog"));
  assert.ok(chAdd.includes("jobIdParam"));
  assert.ok(chAdd.includes("setDeductStock(false)"));
  assert.ok(chAdd.includes("eway_bill_number"));
  assert.ok(chAdd.includes("challan-transition"));

  const chPrev = readSrc("src/screens/DeliveryChallanPreview.tsx");
  assert.ok(chPrev.includes("MILESTONE_STEPS"));
  assert.ok(chPrev.includes("challan-transition"));
  assert.ok(chPrev.includes("SideDrawer"));
  assert.ok(chPrev.includes("downloadDocumentPdf"));

  const pubCh = readSrc("src/screens/PublicChallan.tsx");
  assert.ok(pubCh.includes("public-challan-pod"));
  assert.ok(pubCh.includes("public-challan-pod-upload"));
  assert.ok(pubCh.includes("SignaturePad"));
});

