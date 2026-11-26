# Detailed Quotations, Branded ALVStore PDF/Mail & 2026 Delivery Challan Design Spec

**Date:** 2026-11-26  
**Status:** Updated with User Decisions — Ready for Final Sign-Off  
**Selected Approach:** Option A — Unified Vector A4 PDF Builder (`pdf-lib`) + Real SMTP Dispatch (`nodemailer`) + Branded Print Parity  
**Skills Applied:** `using-superpowers`, `brainstorming`, `ponytail`, `graphify`, `ui-ux-pro-max`, `design-md`, plus `gsd-ai-integration-phase` check (no AI/LLM feature requested; deterministic implementation)

---

## 1. Intent & Why

ALVStore creates bespoke private cinema & AV quotations alongside physical hardware deliveries via delivery challans and GST invoices. Today:
1. Quotations cannot reliably display optional product visuals to customers, cannot be reordered by drag-and-drop cleanly for print/PDF, drop existing `image_url`/`salesperson`/`payment_terms` during edits, hide **Convert to Invoice** when `status === "accepted"` in [QuotationPreview.tsx](file:///Users/rajat/Downloads/alvstore/src/screens/QuotationPreview.tsx#L252), and rely on broken `"Preview"` / `"Send Quotation"` actions plus raw `window.print()` with legacy `"ORIGINAL COPY — DO NOT ALTER"` and `"Powered by ERPMaster"` strings.
2. Settings SMTP credentials (`smtp_host`, `smtp_port`, `smtp_user`, `smtp_pass`, `smtp_from_name`, `smtp_from_email`) save to `business_settings.integrations`, while `/send-email` in [functions.ts](file:///Users/rajat/Downloads/alvstore/server/src/routes/functions.ts) ignores `business_settings`, reads `.env` only, calls a non-standard HTTP webhook, and cannot attach PDFs.
3. Delivery Challans lack company branding (`<BusinessHeader />`), have a dead `receiver_signature` field with no capture UI, lack a shareable customer/driver tracking & POD link (`public_token`), miss 2026 logistics fields (`challan_type`, carrier/AWB/e-Way Bill, dispatch/ETA/delivery timestamps, POD photo), and never record inventory movements (`stock_movements`).

Fixing all three around **one reusable branded ALVStore PDF & mail pipeline** lets customers view aligned product imagery on quotations, sign/accept online cleanly, receive branded `.pdf` attachments via email, and track & sign hardware deliveries on mobile or desktop.

---

## 2. Locked Product Decisions (Confirmed by User + Builder Review)

1. **Accepted Quotation Mutability & Duplication:**
   - Once a quotation is `accepted` (customer-signed or converted), editing is **locked** to protect the signed audit trail.
   - Locked quotations provide a **"Duplicate as New Quotation"** action that clones all customer details, metadata, and sorted line items (including `image_url` and `sort_order`) into a fresh `"draft"` quotation with a new auto-generated `QT-xxxxx` number (no revision suffixing).
   - Editing a `rejected` or `expired` quotation unlocks/resets its status back to `"draft"` and clears prior rejection/signature audit fields on save.
2. **Invoice Thumbnail & Editor Scope:**
   - **Tax Invoices do NOT show product thumbnails** in the line-item editor or printed/PDF Tax Invoice (`show_item_images` is strictly false / omitted for `type: "invoice"`).
   - [InvoiceAdd.tsx](file:///Users/rajat/Downloads/alvstore/src/screens/InvoiceAdd.tsx) retains its existing editor layout cleanly while gaining `deduct_stock` inventory support; [InvoicePreview.tsx](file:///Users/rajat/Downloads/alvstore/src/screens/InvoicePreview.tsx) and [PublicInvoice.tsx](file:///Users/rajat/Downloads/alvstore/src/screens/PublicInvoice.tsx) adopt the **unified ALVStore branded A4 PDF download**, Email PDF Send Drawer, and ALVStore footer (replacing `"Powered by ERPMaster"`).
3. **Stock Deduction Rules (`stock_movements`):**
   - **Quotations:** **Never** deduct or reserve stock.
   - **Invoices & Delivery Challans:** Deduct `products.stock_quantity` via `stock_movements` (`type: "out"` / `"in"`) with explicit persistence flags (`deduct_stock`, `stock_deducted_at`, `stock_reversed_at`) to guarantee idempotency and zero double-deduction:
     - **Invoices (`InvoiceAdd` / `convertToInvoice`):** Default `deduct_stock = true` (opt-out toggle visible). Skips deduction automatically for items/quantities already deducted via a linked `challan_id` or `job_sheet_id` repair invoice, and reverses (`in`) cleanly if an invoice is cancelled after deduction.
     - **Delivery Challans:** Standalone / quotation-derived challans default `deduct_stock = true` and post `"out"` movement once when transitioning to `dispatched` / `in_transit` / `out_for_delivery` / `delivered`. Challans created from an already-deducted `invoice_id` or from a customer-owned repair handover (`job_sheet_id`) default `deduct_stock = false` (suppressing double-deduction). Moving a previously deducted `returnable`, `approval_demo`, `sales_return`, or `dispatched` challan to `returned` / `cancelled` posts a single idempotent `"in"` restoration (`stock_reversed_at`).
4. **Agreed Defaults:**
   - **Delivery Challan Schema Parity & Independent `invoice_id`:** Add `description`, `discount_type`, `discount_value`, `image_url`, and `sort_order` to `DeliveryChallanItems` and `discount_type`/`discount_value` to `DeliveryChallans` so Quotation → Challan → Invoice round-trips never lose line specs or discounts. Track `invoice_id` independently of delivery milestone status so an already-invoiced Challan still progresses through `dispatched -> in_transit -> out_for_delivery -> delivered` and keeps customer POD signature enabled; allow creating multiple partial Challans from one Quotation or Invoice and suppress duplicate `Convert to Invoice` once an invoice link exists.
   - **Repair Job Challan Pre-Fill (`?jobId=`):** Pre-fills a single handover row for the customer's device (`Device Brand + Model`, qty `1`, rate `0`, `show_pricing = false`, `deduct_stock = false`) with optional custom accessory/part rows.
   - **Customer Portal Parity & Security:** Logged-in customers in [CustomerPortal.tsx](file:///Users/rajat/Downloads/alvstore/src/screens/CustomerPortal.tsx) use the same token-verified `public-quotation-respond` signature & expiry flow; broad anonymous/customer direct writes to `quotations` in [data.ts](file:///Users/rajat/Downloads/alvstore/server/src/routes/data.ts) are removed.
   - **Quotation Conversion Statuses:** `Convert to Invoice` and `Create Delivery Challan` are enabled on `draft`, `sent`, and `accepted` quotes (fixing [QuotationPreview.tsx](file:///Users/rajat/Downloads/alvstore/src/screens/QuotationPreview.tsx#L252)) and disabled on `rejected` or `expired` quotes.

---

## 3. Non-Goals & Anti-Goals (`/ponytail` Discipline)

- **No headless Chromium / Puppeteer / Playwright on Hostinger** (Hostinger shared Node 22 environment has `NO_BROWSER_BINARY`; `pdf-lib` runs natively in-memory).
- **No AI/LLM copywriting or RAG agent features** (`gsd:ai-integration-phase` is N/A — zero AI models are introduced in this deterministic ERP release).
- **No external shipping aggregator webhooks** — manual carrier + tracking URL + e-Way Bill covers practical 2026 dispatch cleanly without fragile third-party tokens.
- **No extra `@dnd-kit` package** — accessible native HTML5 row drag-and-drop + single-pointer Up/Down buttons handle reordering cleanly with zero extra dependency weight.

---

## 4. Technical & UI Constraints

- **Backend Runtime:** Express + Prisma 6 (`server/`), Postgres, Node `v22.23.5`, local multipart storage (`server/src/routes/storage.ts` `/api/backend/storage`).
- **Frontend UI Kit:** Next.js 15 + MUI 9 + strict `@/components/mui/*` primitives enforced by `tools/check-ui.mjs` (`AnimatedPage`, `PageHeader`, `SideDrawer`, `DataTable`, `MetricStrip`, `StatusChip`, `SearchToolbar`; zero raw HTML tags or utility classes).
- **UI/UX Pro Max Accessibility Standards:** WCAG 2.2 AA single-pointer Up/Down buttons alongside drag grips; `44×44px` hit areas on icon actions; `48×48px` fixed thumbnail containers (`CLS = 0`); `<=5MB` image validation + `role="alert"` inline feedback; `<4.5:1>` accessible status pill contrast across all 7 ERP themes; strict `#FFFFFF` light paper palette for A4 document previews/PDFs (`DESIGN.md`).
- **SEO Isolation:** New `/challan/public/[token]` gets `PRIVATE_NOINDEX_METADATA` in `src/app/challan/layout.tsx` and `Disallow: /challan/` in `public/robots.txt`.

---

## 5. Detailed Design by Module

### 5.1 Module 1 — Reusable Branded ALVStore A4 PDF & SMTP Mail Engine

1. **Dependencies (`server/package.json`)**:
   - `pdf-lib`, `@pdf-lib/fontkit` + bundled Unicode TTF fonts (`server/assets/fonts/DMSans-Regular.ttf`, `DMSans-Bold.ttf`, `JetBrainsMono-Regular.ttf`) so `₹` (`U+20B9`) and tabular figures render reliably without WinAnsi crashes.
   - `nodemailer` + `@types/nodemailer`.

2. **Unified PDF Builder (`server/src/lib/document-pdf.ts`)**:
   - Single `buildBrandedDocumentPdf(docType: "quotation" | "invoice" | "challan", payload)` returning `Promise<Uint8Array>`.
   - **A4 Architecture (`595.28 × 841.89 pt`, `34pt` margin)**:
     - **Obsidian Header Band (`#0B0C0E`)**: `public/alvstore-logo-dark.png` on left + company name/address/phone/email/GSTIN, document badge (`QUOTATION`, `TAX INVOICE`, `DELIVERY CHALLAN`), `#doc_number`, dates, and status chip on right; underlined by `2pt` Brass `#9C7B49` rule.
     - **Party Block**: Equal `Bill To` and `Ship To` / `Dispatch Logistics` columns (`Courier`, `Tracking #`, `e-Way Bill #`, `Delivery Person`, `Vehicle #` when applicable).
     - **Line-Item Table (Strict Column Alignment)**:
       - **Image column (`44pt × 44pt`)**: Rendered **only** when `(docType === "quotation" || docType === "challan") && show_item_images === true`. Fixed left media rail ensures rows with and without thumbnails keep left description text aligned flush on the exact same X-coordinate!
       - **Challan Pricing Toggle**: When `docType === "challan" && show_pricing === false`, renders `[#, Image (opt), Item & Specs, HSN, Qty]` cleanly and omits monetary rates/totals.
       - **Image Handling**: Resolves local `/api/backend/storage/files/...` paths directly from `env.uploadsDir` on disk (no self-HTTP call); supports PNG/JPEG bytes natively and falls back cleanly to a bordered `"IMG"` badge if any remote URL fails or uses an unsupported format.
       - **Lookahead Pagination**: Pre-measures wrapped description height and image cell height (`max(imageHeight, textHeight) + padding`) before each row; spawns new A4 pages with repeating mini-header + table header so no item row or thumbnail ever splits across page boundaries.
     - **Summary & Footer**: Keeps `Totals` + `Bank / UPI Details` + `Notes & Terms` + `Acceptance / POD Signature` cleanly grouped, stamped at bottom with `ALVStore · <company_email> · Page X of Y`.

3. **Backend PDF, Email & Token Endpoints (`server/src/routes/functions.ts`)**:
   - `GET /document-pdf?type=quotation|invoice|challan&id=<uuid>` (auth required) and `GET /document-pdf?type=...&token=<public_token>` (token-verified): streams `application/pdf` (`inline` for browser viewer/print, `?download=1` for download).
   - `POST /send-email` (auth required): reads SMTP config from `business_settings.integrations` (`smtp_host`, `smtp_port`, `smtp_user`, `smtp_pass`, `smtp_from_name`, `smtp_from_email`) with `.env` fallback; connects via `nodemailer`; optionally builds and attaches `attach_document: { type, id }` as `<doc_number>.pdf`; includes responsive HTML email card + button linking to the customer's interactive portal URL. If attaching a `draft` quotation, transitions quotation status to `sent`.
   - `POST /public-quotation-view` & `POST /public-quotation-respond` (anonymous token-verified): tracks `view_count`/`last_viewed_at`, rejects expired quotes (`valid_until < today`), enforces `status in ("draft","sent")`, saves `signature_data`/`signature_name`/`rejection_reason`/`signed_ip`/`responded_at`, writes `system_audit_log`, notifies staff/admins, and optionally emails confirmation.
   - `POST /public-challan-pod` & `POST /public-challan-pod-upload` (anonymous token-verified): allows driver/customer to confirm delivery on `dispatched`/`in_transit`/`out_for_delivery` challans (`receiver_name`, `receiver_phone`, `receiver_signature`, optional `pod_photo_url`), sets `status: "delivered"`, appends to `timeline`, sets `delivered_at`, and runs idempotent stock dispatch deduction if not already deducted.

4. **Shared Frontend Print / Preview (`DocumentPreview.tsx`, `src/index.css`, public screens)**:
   - Update [DocumentPreview.tsx](file:///Users/rajat/Downloads/alvstore/src/components/documents/DocumentPreview.tsx) `SideDrawer` to accept `"quotation" | "invoice" | "challan"`, support `"unsaved"` draft state for live pre-save preview, open/download branded PDF, print, email PDF, and copy customer link.
   - Replace `"ORIGINAL COPY — DO NOT ALTER"` in [src/index.css](file:///Users/rajat/Downloads/alvstore/src/index.css) with neutral A4 print hygiene rules, and replace `"Powered by ERPMaster"` in [PublicQuotation.tsx](file:///Users/rajat/Downloads/alvstore/src/screens/PublicQuotation.tsx) and [PublicInvoice.tsx](file:///Users/rajat/Downloads/alvstore/src/screens/PublicInvoice.tsx) with **ALVStore** studio attribution.

---

### 5.2 Module 2 — Detailed Quotations (`QuotationAdd`, `QuotationPreview`, `PublicQuotation`, `Sales`, `CustomerPortal`)

- **Schema (`Quotations`, `QuotationItems`)**:
  - `Quotations`: `show_item_images Boolean @default(true)`, `rejection_reason String?`, `responded_at DateTime? @db.Timestamptz(6)`.
  - `QuotationItems`: `sort_order Int @default(0)` (existing `image_url String?` kept and persisted everywhere).
- **Reusable Line-Item Editor (`SortableLineItemsEditor.tsx`, shared by Quotation & Delivery Challan with `allowImages` / `allowPricing` props)**:
  - Reuses `<DocumentItemAdder />` + `<TotalsPanel />` (`calcItemTotal`).
  - Supports `allowImages` (Quotation & Challan): `48×48px` thumbnail preview, click-to-upload image (client-normalized via `<canvas>` to PNG/JPEG `<=800px` & `<5MB` before uploading to `uploads` storage), paste URL option, clear image button, and aligned fixed media column whenever `show_item_images` is active.
  - Supports **drag-and-drop reordering** + WCAG 2.2 AA **Move Up / Move Down** icon buttons; updates `sort_order` cleanly.
  - Inline editable Name (catalog or custom), Spec Description, `HSN/SAC`, `Rate`, `Qty`, `Disc (% / ₹)`, `GST %` toggle/rate.
- **Quotation Lifecycle Fixes (`QuotationAdd.tsx`, `QuotationPreview.tsx`, `Sales.tsx`)**:
  - Fix `loadQuotation` to order by `sort_order ASC` and restore `image_url`, `salesperson_id`, `payment_terms`, `show_item_images`, and per-item `gst_enabled`.
  - If loading an `accepted` quotation for `/sales/[id]/edit`, lock form controls cleanly with a banner and **"Duplicate as New Quotation"** CTA; editing `rejected` or `expired` quotes clears old acceptance/rejection metadata and resets status to `"draft"`.
  - Wire **"Preview"** button in [QuotationAdd.tsx](file:///Users/rajat/Downloads/alvstore/src/screens/QuotationAdd.tsx) to open live `<DocumentPreview />` `SideDrawer` in-place (preserving unsaved edits).
  - Wire **"Send Quotation"** to save + open a **Send Document `SideDrawer`** (Email Branded PDF, Share via WhatsApp, Copy Public Link + mark `sent`).
  - Fix [QuotationPreview.tsx](file:///Users/rajat/Downloads/alvstore/src/screens/QuotationPreview.tsx) so `Convert to Invoice` (with `deduct_stock = true` default) and `Create Delivery Challan` appear for `draft`, `sent`, and **`accepted`** quotes when not already invoiced, carrying `image_url` (for Challans), `sort_order`, `salesperson_id`, and `payment_terms`.

---

### 5.3 Module 3 — 2026 Delivery Challan Workflow, Tracking & POD (`DeliveryChallanAdd`, `DeliveryChallanPreview`, `DeliveryChallans`, `PublicChallan`)

- **Schema (`DeliveryChallans`, `DeliveryChallanItems`, `Invoices`, `InvoiceItems`)**:
  - `Invoices`: `deduct_stock Boolean @default(true)`, `stock_deducted_at DateTime?`, `stock_reversed_at DateTime?`.
  - `InvoiceItems`: `sort_order Int @default(0)` (no `image_url` UI on Tax Invoices).
  - `DeliveryChallans`:
    - `public_token String @default(dbgenerated("gen_random_uuid()")) @db.Uuid`
    - `quotation_id String? @db.Uuid`, `job_sheet_id String? @db.Uuid`
    - `challan_type String @default("delivery")` (`delivery` | `approval_demo` | `job_work` | `returnable` | `sales_return`)
    - `show_pricing Boolean @default(true)`, `show_item_images Boolean @default(false)`
    - `shipping_address String?`, `courier_name String?`, `tracking_number String?`, `tracking_url String?`, `eway_bill_number String?`
    - `dispatched_at DateTime?`, `expected_delivery_at DateTime?`, `delivered_at DateTime?`
    - `receiver_name String?`, `receiver_phone String?`, `pod_photo_url String?`
    - `deduct_stock Boolean @default(true)`, `stock_deducted_at DateTime?`, `stock_reversed_at DateTime?`
    - `timeline Json? @default("[]")`
  - `DeliveryChallanItems`: add `description String?`, `discount_type String? @default("percentage")`, `discount_value Decimal? @default(0)`, `image_url String?`, `sort_order Int @default(0)`.
- **Inventory & Conversion Service (`server/src/lib/inventory-ledger.ts` + endpoint hooks)**:
  - Atomic helper running inside a Prisma transaction whenever:
    - An Invoice with `deduct_stock: true` is finalized/created (`out`), or cancelled (`in`), skipping items linked to an already-deducted `DeliveryChallan` (`stock_deducted_at !== null`).
    - A Delivery Challan with `deduct_stock: true` moves into `dispatched` / `in_transit` / `out_for_delivery` / `delivered` (`out` once via `stock_deducted_at`), or moves from deducted state to `returned` / `cancelled` (`in` once via `stock_reversed_at`). `sales_return` challans post `in` on receipt (`delivered`).
  - Partial Challan creation allowed from Quotations/Invoices (`?quotationId=`, `?invoiceId=`, `?jobId=`); creating an Invoice from a Challan copies `sort_order`, `description`, `discount_*` and preserves `invoice_id` separately from `status`.
- **UI & Public Tracking (`DeliveryChallans`, `DeliveryChallanAdd`, `DeliveryChallanPreview`, `PublicChallan`)**:
  - `DeliveryChallans.tsx`: Unified `MetricStrip` (`Total`, `In Transit`, `Delivered`, `Pending Invoice`), filter tabs (`All`, `Draft`, `Dispatched`, `Delivered`, `Returnable`, `Uninvoiced`), searchable table (`#DC`, Customer, Tracking/Courier, Type, Status, Invoice link, Copy POD Link).
  - `DeliveryChallanAdd.tsx`: Searchable Customer `Autocomplete` + `+ Add New Customer` (`CustomerQuickDialog`), `?quotationId=`/`?invoiceId=`/`?jobId=` prefill, `challan_type` selector, `show_pricing` / `show_item_images` / `deduct_stock` toggles, Courier/AWB/Tracking URL/e-Way Bill (with ₹50,000 GST advisory helper), Driver/Vehicle fields, and `SortableLineItemsEditor`.
  - `DeliveryChallanPreview.tsx`: `<BusinessHeader />`, interactive dispatch milestone stepper, **Send / Email PDF / Copy Tracking Link Drawer**, **Download Branded PDF**, **In-App POD `SideDrawer`** (`receiver_name`, `receiver_phone`, `pod_photo_url` upload, `SignaturePad`), timeline log, and **Convert to Invoice** (hidden if `invoice_id` already exists).
  - `/challan/public/[token]` (`PublicChallan.tsx`, `noindex`): ALVStore tracking timeline, courier link / driver badge, itemized packing slip (respecting `show_pricing` & `show_item_images`), Download Branded PDF button, and live **Confirm Delivery (POD)** form with `SignaturePad` + optional photo proof.
