

# Enterprise Quotation and Invoice Module Overhaul

## Overview

Complete redesign of the Quotation (Sales) and Invoice modules with enterprise-grade UI/UX, advanced pricing features, PDF generation, communication integrations, and customer-facing approval workflows.

## Phase 1: Database Schema Updates

Add missing columns to support new features:

**`quotation_items` table -- add columns:**
- `description` (text, nullable) -- product description per line
- `discount_type` (text, default 'percentage') -- 'percentage' or 'fixed'
- `discount_value` (numeric, default 0) -- discount amount per item
- `hsn_code` (text, nullable) -- HSN/SAC code

**`invoice_items` table -- add columns:**
- `description` (text, nullable)
- `discount_type` (text, default 'percentage')
- `discount_value` (numeric, default 0)
- `hsn_code` (text, nullable)

**`quotations` table -- add columns:**
- `discount_type` (text, default 'percentage') -- global discount type
- `discount_value` (numeric, default 0) -- global discount
- `gst_inclusive` (boolean, default false) -- GST inclusive/exclusive toggle
- `signature_data` (text, nullable) -- base64 digital signature
- `signature_name` (text, nullable) -- signer name
- `signed_at` (timestamptz, nullable) -- signature timestamp
- `signed_ip` (text, nullable) -- IP address at signing
- `view_count` (integer, default 0) -- view tracking
- `last_viewed_at` (timestamptz, nullable) -- last viewed timestamp
- `reminder_sent_at` (timestamptz, nullable) -- auto reminder tracking
- `converted_invoice_id` (uuid, nullable) -- link to converted invoice

**`invoices` table -- add columns:**
- `discount_type` (text, default 'percentage')
- `discount_value` (numeric, default 0)
- `gst_inclusive` (boolean, default false)
- `public_token` (uuid, default gen_random_uuid()) -- for public invoice view
- `signature_data` (text, nullable)
- `signature_name` (text, nullable)
- `signed_at` (timestamptz, nullable)

## Phase 2: Reusable Components

Create shared components used by both quotation and invoice modules:

**`src/components/documents/BusinessHeader.tsx`**
- Fetches `business_settings` on mount
- Displays: logo, company name, address, GSTIN, phone, email
- Professional letterhead layout with logo on left, details on right

**`src/components/documents/CustomerCard.tsx`**
- Avatar with initials fallback
- Name, email, phone, address, GSTIN
- Compact card layout

**`src/components/documents/ItemsTable.tsx`**
- Reusable product line items table
- Columns: S.No, Product Name, Description, HSN, Qty, Unit Price, Discount, GST %, Amount
- Per-item discount (percentage or fixed) with toggle
- Per-item GST toggle (enable/disable)
- Add product button, inline editing, remove button
- Responsive: cards on mobile, table on desktop

**`src/components/documents/TotalsPanel.tsx`**
- GST inclusive/exclusive toggle at top
- Subtotal row
- Global discount row (percentage or fixed toggle)
- CGST / SGST breakdown (or IGST for inter-state)
- Grand total with large font
- Savings/discount callout

**`src/components/documents/StatusBadge.tsx`**
- Styled status badges: draft, sent, accepted, rejected, converted, expired, paid
- Consistent color scheme across modules

**`src/components/documents/DocumentPreview.tsx`**
- Full preview modal (Dialog) showing the document as it would appear in print/PDF
- Business header, customer info, items table, totals, notes, terms
- Print button (window.print with print stylesheet)
- Download PDF button (generates HTML-to-PDF via edge function)

**`src/components/documents/SignaturePad.tsx`**
- Canvas-based digital signature capture
- Clear button, undo
- Saves as base64 PNG
- Name input field below signature

**`src/components/documents/ActionButtons.tsx`**
- Preview, Download PDF, Send Email, Send WhatsApp, Copy Link
- Convert to Invoice (quotation only)
- Grouped button bar, responsive

## Phase 3: Sales (Quotation) Page Rewrite -- `src/pages/Sales.tsx`

**List View:**
- KPI cards at top: Total Quotations, Accepted, Pending, Total Value
- Status filter tabs with counts
- Enhanced table: number, customer (with avatar), status badge, total, date, validity, view count, actions
- Row click opens detail view (slide-over sheet, wider)

**Create/Edit Form (Sheet, full-width on mobile):**
- Customer selector with search + quick-add
- Valid Until date picker
- GST inclusive/exclusive toggle
- Items table component (ItemsTable)
- Global discount section
- Notes and Terms (with template selector)
- Totals panel (TotalsPanel)
- Save as Draft / Save and Send buttons

**Detail/Edit Sheet:**
- Business header + customer card
- Items table (read-only or editable based on status)
- Totals panel
- Action buttons: Preview, PDF, Email, WhatsApp, Copy Link, Convert to Invoice
- Status change dropdown
- Signature section (shows existing or empty)
- View tracking info (view count, last viewed)

**Convert to Invoice:**
- Button on accepted quotations
- Creates invoice from quotation data (copies customer, items, totals)
- Sets `quotation_id` on invoice and `converted_invoice_id` on quotation
- Updates quotation status to "converted" (requires adding to enum or using text)

## Phase 4: Invoice Page Rewrite -- `src/pages/Invoices.tsx`

**List View:**
- KPI cards: Total Invoices, Paid, Unpaid, Overdue, Revenue
- Status tabs with payment status filter
- Enhanced table with dual badges (status + payment)
- Action column: Pay, Preview, PDF, Email

**Create/Edit Form:**
- Same structure as quotation form
- Due date picker
- Payment terms
- Auto-populated from quotation if converted

**Payment Recording:**
- Enhanced payment sheet with payment method selector
- Payment history list per invoice
- Partial payment tracking with visual progress bar

## Phase 5: Public Quotation Page Rewrite -- `src/pages/PublicQuotation.tsx`

- Professional layout with business header
- Customer info card
- Items table with all columns
- Totals with discount and GST breakdown
- Digital signature pad for customer approval (saves to DB)
- Accept / Reject buttons with confirmation
- Online payment button (placeholder for payment gateway integration)
- Download PDF button
- View count increment on load (updates `view_count` and `last_viewed_at`)
- Mobile responsive

## Phase 6: PDF Generation Edge Function -- `supabase/functions/generate-pdf/index.ts`

- Accepts: `type` (quotation/invoice), `id`
- Fetches document data, items, customer, business settings from DB
- Generates HTML template with proper formatting
- Returns HTML suitable for browser print-to-PDF
- Includes: business header, customer details, items table, totals, notes, terms, signature

## Phase 7: Communication Actions

**Send Email (existing edge function):**
- From quotation/invoice detail, trigger email with:
  - HTML body containing document preview
  - Public link for online viewing
  - Uses existing `send-email` edge function

**Send WhatsApp:**
- Uses existing WhatsApp API settings from `business_settings`
- Sends message with document summary and public link
- Edge function call with WhatsApp Cloud API

**Auto Reminder:**
- Manual "Send Reminder" button for pending quotations
- Sends email/SMS reminder with public link
- Updates `reminder_sent_at` timestamp

## Phase 8: Route Updates -- `src/App.tsx`

- Add public invoice route: `/invoice/public/:token`
- Create `src/pages/PublicInvoice.tsx` for public invoice view (similar to PublicQuotation)

---

## Technical Details

### Database Migration SQL

```sql
-- Quotation items enhancements
ALTER TABLE quotation_items 
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS discount_type text DEFAULT 'percentage',
  ADD COLUMN IF NOT EXISTS discount_value numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS hsn_code text;

-- Invoice items enhancements  
ALTER TABLE invoice_items
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS discount_type text DEFAULT 'percentage',
  ADD COLUMN IF NOT EXISTS discount_value numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS hsn_code text;

-- Quotations enhancements
ALTER TABLE quotations
  ADD COLUMN IF NOT EXISTS discount_type text DEFAULT 'percentage',
  ADD COLUMN IF NOT EXISTS discount_value numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS gst_inclusive boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS signature_data text,
  ADD COLUMN IF NOT EXISTS signature_name text,
  ADD COLUMN IF NOT EXISTS signed_at timestamptz,
  ADD COLUMN IF NOT EXISTS signed_ip text,
  ADD COLUMN IF NOT EXISTS view_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_viewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS reminder_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS converted_invoice_id uuid;

-- Invoices enhancements
ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS discount_type text DEFAULT 'percentage',
  ADD COLUMN IF NOT EXISTS discount_value numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS gst_inclusive boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS public_token uuid DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS signature_data text,
  ADD COLUMN IF NOT EXISTS signature_name text,
  ADD COLUMN IF NOT EXISTS signed_at timestamptz;
```

### New Files to Create

```text
src/components/documents/BusinessHeader.tsx
src/components/documents/CustomerCard.tsx
src/components/documents/ItemsTable.tsx
src/components/documents/TotalsPanel.tsx
src/components/documents/StatusBadge.tsx
src/components/documents/DocumentPreview.tsx
src/components/documents/SignaturePad.tsx
src/components/documents/ActionButtons.tsx
src/pages/PublicInvoice.tsx
supabase/functions/generate-pdf/index.ts
```

### Files to Rewrite

```text
src/pages/Sales.tsx -- complete rewrite with new components
src/pages/Invoices.tsx -- complete rewrite with new components
src/pages/PublicQuotation.tsx -- complete rewrite with signature + payment
src/App.tsx -- add public invoice route
```

### Component Architecture

```text
Sales.tsx / Invoices.tsx
  |-- BusinessHeader (fetches business_settings)
  |-- CustomerCard (displays selected customer)
  |-- ItemsTable (product lines with discount + GST per item)
  |-- TotalsPanel (subtotal, discount, GST breakdown, total)
  |-- ActionButtons (Preview, PDF, Email, WhatsApp, Convert)
  |-- DocumentPreview (modal with print layout)
  |-- SignaturePad (canvas signature capture)
  |-- StatusBadge (colored status indicator)
```

### Implementation Order

1. Database migration (schema changes)
2. Reusable components (BusinessHeader, CustomerCard, ItemsTable, TotalsPanel, StatusBadge)
3. Sales page rewrite with new components
4. Invoices page rewrite with new components
5. SignaturePad, DocumentPreview, ActionButtons components
6. PublicQuotation rewrite with signature + view tracking
7. PublicInvoice page
8. PDF generation edge function
9. Communication integrations (email, WhatsApp)
10. Route updates

