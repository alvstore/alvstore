

# Comprehensive Audit & Enhancement Plan

## Issues Found

### Sidebar Collapse Bug
The sidebar width is `w-[260px]` when expanded, but `AppLayout` uses `md:ml-[240px]` — a 20px mismatch. The collapse toggle button exists and localStorage persistence works. The actual collapse mechanism appears functional, but the width inconsistency may cause layout shift. Need to verify the toggle button is rendering and clickable.

### Notifications System
The `createNotification()` helper exists but is only called in **one place** (JobSheetDetail technician assignment). No notifications are triggered for:
- Quotation created/accepted/rejected
- Invoice created/paid
- Payment received
- New customer added
- Employee attendance events
- Task assignments

The fetch/display in AppHeader looks correct (realtime subscription, mark-read, click navigation).

### Quotation Missing Features
- **Product photos**: `quotation_items` already has `image_url` column in DB, but it's never populated during item creation and never displayed in preview/public view
- **Ship-to / Bill-to**: Customers table only has one `address` field — no separate shipping address
- **Payment terms**: Field exists in QuotationAdd but is not saved to the database (no `payment_terms` column on `quotations`)
- **Bank details**: `business_settings` has no bank detail columns
- **Terms & Conditions**: Already implemented with a textarea and toggle

### Apple Pricing — Offer Import
Currently manual-only. User wants AI-powered PDF parsing to extract offers automatically.

---

## Plan

### 1. AI-Powered Offer PDF Import (Edge Function)

Create `supabase/functions/parse-offer-pdf/index.ts`:
- Accept base64 PDF content
- Send to Lovable AI (gemini-3-flash-preview) with structured output via tool calling
- Extract: offer_type, bank_name, category, product, discount_amount, dates
- Return parsed offers as JSON for user review before insert
- Add "Upload & Parse PDF" button in Apple Pricing Offers tab

Also add to Apple Pricing:
- "Delete All Products" button with confirmation dialog
- "Replace Price List" flow (delete all → re-import)

### 2. Quotation Enhancements

**Database Migration:**
```sql
-- Add payment_terms + bank details to quotations
ALTER TABLE quotations ADD COLUMN IF NOT EXISTS payment_terms text;

-- Add bank details to business_settings  
ALTER TABLE business_settings
  ADD COLUMN IF NOT EXISTS bank_name text,
  ADD COLUMN IF NOT EXISTS bank_account_number text,
  ADD COLUMN IF NOT EXISTS bank_ifsc text,
  ADD COLUMN IF NOT EXISTS bank_branch text,
  ADD COLUMN IF NOT EXISTS bank_upi_id text;

-- Add shipping address to customers
ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS shipping_address text,
  ADD COLUMN IF NOT EXISTS shipping_city text,
  ADD COLUMN IF NOT EXISTS shipping_state text,
  ADD COLUMN IF NOT EXISTS shipping_pincode text;
```

**QuotationAdd.tsx changes:**
- Fetch product `image_url` and pass it when creating quotation items
- Add Bill-to / Ship-to dual address display with "Same as billing" copy button
- Save `payment_terms` to the quotation record
- Show validity period (already has `valid_until`)
- Display bank details from business_settings at the bottom

**QuotationPreview.tsx / PublicQuotation.tsx changes:**
- Show product thumbnail next to item name in the items table
- Show Ship-to address if different from Bill-to
- Show payment terms with validity
- Show bank details section for payment

**ItemsTable.tsx changes:**
- Add optional `image_url` to `DocumentItem` interface
- Show small product thumbnail in read-only mode

### 3. Sidebar Collapse Fix

**AppLayout.tsx:** Fix margin from `md:ml-[240px]` to `md:ml-[260px]` to match sidebar width.

### 4. Notifications System

Add `createNotification` calls across key workflows:

**QuotationAdd.tsx** — on create: notify admin
**QuotationPreview.tsx** — on convert to invoice: notify creator
**PublicQuotation.tsx** — on accept/reject: notify quotation creator
**Invoices.tsx** — on payment recorded: notify admin
**JobSheetDetail.tsx** — already has technician assignment notification; add status change notifications
**Settings.tsx** — add bank details section under Business Info tab

### 5. Settings — Bank Details

Add bank details fields (Bank Name, Account Number, IFSC, Branch, UPI ID) in the Business Info settings section.

---

## Files Summary

```
MIGRATION:  quotations.payment_terms, business_settings bank columns, customers shipping address columns
CREATE:     supabase/functions/parse-offer-pdf/index.ts
EDIT:       src/pages/ApplePricing.tsx (PDF upload + parse, delete all products)
EDIT:       src/pages/QuotationAdd.tsx (product images, ship-to/bill-to, payment terms save, bank details)
EDIT:       src/pages/QuotationPreview.tsx (product images, bank details, payment terms display)
EDIT:       src/pages/PublicQuotation.tsx (product images, bank details, notifications on response)
EDIT:       src/components/documents/ItemsTable.tsx (image_url in DocumentItem, thumbnail display)
EDIT:       src/components/layout/AppLayout.tsx (fix 240→260 margin)
EDIT:       src/pages/Invoices.tsx (add notification on payment)
EDIT:       src/pages/Settings.tsx (add bank details section)
```

## Implementation Order

1. Sidebar fix (quick)
2. Database migration (all new columns)
3. Bank details in Settings
4. Quotation enhancements (images, addresses, payment terms, bank details)
5. Notifications across workflows
6. AI offer PDF parser edge function + Apple Pricing UI updates
