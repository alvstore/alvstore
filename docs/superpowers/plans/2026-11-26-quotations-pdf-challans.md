# Quotations, Reusable Branded ALVStore PDF/Mail & 2026 Delivery Challan Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans or superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver end-to-end detailed Quotations (optional product thumbnails, accessible drag-and-drop sorting, preview/email dispatch, token-verified customer acceptance, lock-on-accept + duplicate), a reusable branded ALVStore A4 vector PDF & SMTP mail engine shared by Quotations/Invoices/Challans, idempotent stock movements for Invoices & Delivery Challans, and a 2026 Delivery Challan tracking & Proof-of-Delivery workflow.

**Architecture:** Server-side `pdf-lib` + `@pdf-lib/fontkit` draws true vector A4 ALVStore PDFs using bundled Unicode TTF fonts (supporting `₹` natively) for download, browser print, and `nodemailer` SMTP email attachments (reading Admin Settings `business_settings.integrations`). Token-verified backend routes replace broad anonymous DB writes for public quotation acceptance and contactless customer/driver Proof-of-Delivery on `/challan/public/[token]`, while an idempotent Prisma stock ledger prevents double-deduction when an order links a Delivery Challan and Invoice.

**Tech Stack:** Next.js 15, React 19, MUI 9 (`@/components/mui/*`), Express 4, Prisma 6, Postgres, `pdf-lib`, `@pdf-lib/fontkit`, `nodemailer`.

**Spec:** `docs/superpowers/specs/2026-11-26-quotations-pdf-challans-design.md` + `DESIGN.md`.

## Global Constraints
- Hostinger runtime has Node `v22.23.5` and **no** Chromium/wkhtmltopdf binary (`NO_BROWSER_BINARY`) — PDF generation must run purely in-memory via `pdf-lib`.
- Strict MUI UI rule enforced by `node tools/check-ui.mjs`: no raw HTML elements (`div`, `span`, `p`, `h1`, `h2`, `button`, `input`, `textarea`, `select`, `table`) in `src/screens` or `src/components`, no `className`, no `FormDialog`/`Dialog` (`SideDrawer` only), and `inputLabel: { shrink: true }` on labeled date inputs.
- No product thumbnails on Tax Invoices (Quotations & Delivery Challans only); Quotations **never** modify `stock_movements`.
- Preserve `ALVStore` branding cleanly in all public/PDF outputs (remove `"ORIGINAL COPY — DO NOT ALTER"` and `"Powered by ERPMaster"`).
- New `/challan/*` public routes must use `PRIVATE_NOINDEX_METADATA` and `Disallow: /challan/` in `public/robots.txt`.

## Review Focus
1. **Unicode Rupee `₹` encoding in `pdf-lib`:** Standard WinAnsi fonts crash on `₹`; tests must generate actual A4 PDFs with ₹ prices and multi-page wrapping without error.
2. **Double-deduction across Invoice <-> Delivery Challan:** Linked orders must post `stock_movements` `"out"` exactly once across the pair (`stock_deducted_at` guard) and never deduct for Quotations or customer repair handovers (`job_sheet_id`).
3. **Public quotation & challan authorization boundaries:** Anonymous callers must not mutate arbitrary rows via `/api/data/query`; `/public-quotation-respond` must reject expired `valid_until` quotes and `/public-challan-pod` must reject non-in-transit challans.
4. **Thumbnail alignment & missing/WebP images:** Mixed image/text rows in Quotation/Challan tables and PDFs must align flush on a fixed media column cleanly and never fail PDF generation if a product image is WebP or unreachable.
5. **Accepted quote immutability:** Once `accepted`, `/sales/[id]/edit` locks mutations and offers "Duplicate as New Quotation" (`draft`, fresh `QT-` number); editing `rejected`/`expired` resets to `draft` and clears prior acceptance fields.

---

### Task 1: Database Schema Migration & Generation

**Files:**
- Modify: `server/prisma/schema.prisma`
- Regenerate: `server/src/generated/schema-meta.json` (via `npm --prefix server run prisma:generate`)
- Test: `tests/seo-schema-geo.test.mjs`, `server/tests/device-catalog.test.ts` (existing schema contract) + `server/tests/schema-parity.test.ts`

**Interfaces:**
- Produces Prisma fields & generated client types:
  - `Quotations`: `show_item_images`, `rejection_reason`, `responded_at`
  - `QuotationItems`: `sort_order`
  - `Invoices`: `deduct_stock`, `stock_deducted_at`, `stock_reversed_at`
  - `InvoiceItems`: `sort_order`
  - `DeliveryChallans`: `public_token`, `quotation_id`, `job_sheet_id`, `challan_type`, `show_pricing`, `show_item_images`, `shipping_address`, `courier_name`, `tracking_number`, `tracking_url`, `eway_bill_number`, `dispatched_at`, `expected_delivery_at`, `delivered_at`, `receiver_name`, `receiver_phone`, `pod_photo_url`, `discount_type`, `discount_value`, `deduct_stock`, `stock_deducted_at`, `stock_reversed_at`, `timeline`
  - `DeliveryChallanItems`: `description`, `discount_type`, `discount_value`, `image_url`, `sort_order`

- [ ] **Step 1:** Update `server/prisma/schema.prisma` with all new columns and relations cleanly.
- [ ] **Step 2:** Run `npm --prefix server run prisma:generate && npm --prefix server run db:push` (against local dev Postgres) and verify `schema-meta.json` updates without breaking `query-meta` tests.
- [ ] **Step 3:** Add targeted test assertions checking new columns exist in `schema-meta.json`.

---

### Task 2: Branded ALVStore A4 PDF Generator & Real SMTP Mailer

**Files:**
- Install deps: `server/package.json` (`pdf-lib`, `@pdf-lib/fontkit`, `nodemailer`, `@types/nodemailer`)
- Add font assets: `server/assets/fonts/NotoSans-Regular.ttf`, `server/assets/fonts/NotoSans-Bold.ttf` (with `₹` glyph)
- Create: `server/src/lib/document-pdf.ts`
- Create: `server/src/lib/mailer.ts`
- Modify: `server/src/routes/functions.ts`
- Modify: `server/src/routes/data.ts` (tighten `PUBLIC_WRITE` + prevent direct `customer` role mutation on `quotations`)
- Test: `server/tests/document-pdf-mail.test.ts`

**Interfaces:**
- `buildBrandedDocumentPdf(docType: "quotation" | "invoice" | "challan", payload: BrandedDocumentPdfInput): Promise<Uint8Array>`
- `resolveSmtpConfig(pool): Promise<SmtpConfig>`
- `sendMailWithOptionalAttachment(config, message): Promise<{ messageId: string }>`
- Routes in `/api/backend/functions`:
  - `GET /document-pdf?type=&id=&token=&download=`
  - `POST /send-email` (real `nodemailer`, supports `attach_document: { type, id }`)
  - `POST /public-quotation-view` (`{ token }`)
  - `POST /public-quotation-respond` (`{ token, action: "accept" | "reject", signature_data?, signature_name?, rejection_reason? }`)
  - `POST /public-challan-pod-upload` (`multipart`: `token`, `file`)
  - `POST /public-challan-pod` (`{ token, receiver_name, receiver_phone?, signature_data, pod_photo_url? }`)

- [ ] **Step 1 (TDD):** Write failing tests in `server/tests/document-pdf-mail.test.ts` verifying: `%PDF-` output with `₹`, multi-page overflow stability, Invoice never renders thumbnails even if items contain `image_url`, Challan `show_pricing: false` omits monetary columns, SMTP priority (`business_settings.integrations` over `.env`), and expired quotation rejection.
- [ ] **Step 2:** Verify test fails before implementation.
- [ ] **Step 3:** Implement `server/src/lib/document-pdf.ts`, `server/src/lib/mailer.ts`, endpoints in `server/src/routes/functions.ts`, and `data.ts` public-write tightening.
- [ ] **Step 4:** Run `npm --prefix server test` and verify PASS.

---

### Task 3: Idempotent Inventory Ledger (`stock_movements`)

**Files:**
- Create: `server/src/lib/inventory-ledger.ts`
- Modify: `server/src/routes/functions.ts` (`POST /document-stock`, `POST /challan-transition`, `POST /public-challan-pod`)
- Test: `server/tests/inventory-ledger.test.ts`

**Interfaces:**
- `syncDocumentStockOnTransition(tx, opts: { docType: "invoice" | "challan"; docId: string; mode: "deduct" | "reverse" | "return_in"; userId?: string | null; note?: string })`

- [ ] **Step 1 (TDD):** Write failing unit tests in `server/tests/inventory-ledger.test.ts` testing: Quotation never creates movements, Invoice deducts once cleanly, Challan linked to already-deducted Invoice does not double-deduct, Challan `returnable`/`cancelled` reverses `"in"` once cleanly via `stock_reversed_at`, and `job_sheet_id` challans stay non-deducting by default.
- [ ] **Step 2:** Verify test fails.
- [ ] **Step 3:** Implement transactional ledger helper and route endpoints.
- [ ] **Step 4:** Verify `npm --prefix server test` passes.

---

### Task 4: Reusable Sortable Line-Item Editor, Branded Print Cleanup & Send Drawer

**Files:**
- Modify: `src/index.css` (`@media print` cleanup — remove `"ORIGINAL COPY — DO NOT ALTER"`)
- Create: `src/components/documents/SortableLineItemsEditor.tsx`
- Create: `src/components/documents/SendDocumentDrawer.tsx`
- Modify: `src/components/documents/ItemsTable.tsx` (`showImages?: boolean`, `hidePricing?: boolean`, aligned media column)
- Modify: `src/components/documents/DocumentPreview.tsx` (supports `"quotation" | "invoice" | "challan"`, real Branded PDF download/print button, `showImages`/`hidePricing`)
- Test: `tests/quotations-challans-pdf.test.mjs`

- [ ] **Step 1 (TDD):** Add contract & state helper tests in `tests/quotations-challans-pdf.test.mjs` testing item reordering (`reorderItems`), image normalization contract, and `ItemsTable`/`DocumentPreview` props.
- [ ] **Step 2:** Implement `SortableLineItemsEditor.tsx` (drag-and-drop + WCAG 2.2 AA Move Up/Down buttons, optional 48×48 thumbnail upload with WebP->PNG canvas normalization & URL/clear controls), `SendDocumentDrawer.tsx`, and update `ItemsTable.tsx`, `DocumentPreview.tsx`, and `src/index.css`.
- [ ] **Step 3:** Verify `npm run check` (`check:ui` + `typecheck` + unit tests).

---

### Task 5: Detailed Quotations, Invoice PDF/Stock Wiring & Customer Acceptance Parity

**Files:**
- Modify: `src/screens/QuotationAdd.tsx`
- Modify: `src/screens/QuotationPreview.tsx`
- Modify: `src/screens/Sales.tsx`
- Modify: `src/screens/PublicQuotation.tsx`
- Modify: `src/screens/CustomerPortal.tsx`
- Modify: `src/screens/InvoiceAdd.tsx`
- Modify: `src/screens/InvoicePreview.tsx`
- Modify: `src/screens/PublicInvoice.tsx`

- [ ] **Step 1:** Update `QuotationAdd.tsx`: fix `loadQuotation` (`image_url`, `sort_order`, `salesperson_id`, `payment_terms`, `show_item_images`), enforce read-only lock + **"Duplicate as New Quotation"** when `status === "accepted"`, reset `rejected`/`expired` on edit save, wire `<SortableLineItemsEditor allowImages />`, right-rail `Show Item Images` switch, live `Preview` (`<DocumentPreview />`), and `Send Quotation` (`<SendDocumentDrawer />`).
- [ ] **Step 2:** Update `QuotationPreview.tsx`: fix `Convert to Invoice` visibility on `accepted` quotes (`!converted_invoice_id`), add `Create Delivery Challan` & `Duplicate as New Quotation` buttons, add Branded PDF download + `<SendDocumentDrawer />`, trigger `/functions/document-stock` on Invoice creation, and render acceptance IP/timestamp/rejection reason.
- [ ] **Step 3:** Update `Sales.tsx` with Duplicate & PDF quick actions and customer name search.
- [ ] **Step 4:** Update `PublicQuotation.tsx` & `CustomerPortal.tsx`: call `/functions/public-quotation-view` & `/functions/public-quotation-respond` (signature required on accept, rejection reason optional, expiry enforcement), Branded PDF download, remove `"Powered by ERPMaster"` -> `"ALVStore"`.
- [ ] **Step 5:** Update `InvoiceAdd.tsx` (`deduct_stock` default `true` toggle calling `/functions/document-stock`), `InvoicePreview.tsx` (Branded PDF Download + `<SendDocumentDrawer />` without item photos), and `PublicInvoice.tsx` (Branded PDF Download + `"ALVStore"` footer).

---

### Task 6: 2026 Delivery Challan Suite + Public Tracking & Contactless POD Route

**Files:**
- Modify: `src/screens/DeliveryChallans.tsx`
- Modify: `src/screens/DeliveryChallanAdd.tsx`
- Modify: `src/screens/DeliveryChallanPreview.tsx`
- Create: `src/screens/PublicChallan.tsx`
- Create: `src/app/challan/layout.tsx` (`PRIVATE_NOINDEX_METADATA`)
- Create: `src/app/challan/public/[token]/page.tsx`
- Modify: `public/robots.txt` (`Disallow: /challan/`)
- Modify: `tests/seo-schema-geo.test.mjs`

- [ ] **Step 1:** Update `DeliveryChallans.tsx` with `MetricStrip`, status/type filter tabs, tracking/challan/customer search, quick Copy Tracking Link & PDF download.
- [ ] **Step 2:** Update `DeliveryChallanAdd.tsx`: searchable Customer `Autocomplete` + `CustomerQuickDialog`, `?quotationId=` / `?invoiceId=` / `?jobId=` prefill, 2026 logistics fields (`challan_type`, `courier_name`, `tracking_number`, `tracking_url`, `eway_bill_number` + ₹50k note, `dispatched_at`, `expected_delivery_at`, `shipping_address`, `delivery_person`, `vehicle_number`), toggles (`show_pricing`, `show_item_images`, `deduct_stock`), and `<SortableLineItemsEditor />`.
- [ ] **Step 3:** Update `DeliveryChallanPreview.tsx`: `<BusinessHeader />`, interactive dispatch milestone stepper calling `/functions/challan-transition`, independent `invoice_id` badge + `Convert to Invoice` (suppressed when already invoiced), **Capture POD `SideDrawer`** (`SignaturePad` + photo + receiver name/phone), Branded PDF Download, and `<SendDocumentDrawer />`.
- [ ] **Step 4:** Build `PublicChallan.tsx` + `/challan/public/[token]` route (`noindex`) with milestone timeline, tracking details, packing slip, Branded PDF Download, and contactless POD confirmation (`POST /functions/public-challan-pod` + photo upload).

---

### Task 7: Verification, Whole-Branch Code Review, Build & Deployment

**Files:**
- Create: `tests/e2e/quotations-challans.spec.mjs`

- [ ] **Step 1:** Run full local checks (`npm run check`, `npm --prefix server run test`, `npm run build`).
- [ ] **Step 2:** Run Playwright E2E `tests/e2e/quotations-challans.spec.mjs` exercising Quotation create + image + reorder + preview + accept + duplicate + Invoice conversion + Challan dispatch + POD capture cleanly on desktop & mobile screenshots, inspecting every screenshot via `read_file`.
- [ ] **Step 3:** Dispatch fresh `research` reviewer to check the whole branch diff against spec, design system, and security invariants; resolve any Critical/Important issues cleanly.
- [ ] **Step 4:** Push & sync production Hostinger repo/DB cleanly (applying non-destructive `prisma db push` cleanly and restarting backend/web build) and verify live!
