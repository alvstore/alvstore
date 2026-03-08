

# Comprehensive Audit & Fix Plan

## Issues Identified

1. **Dashboard quick action URLs are wrong**: `/quotations/new` → should be `/sales/new`, `/job-sheets/create` → should be `/repairs/new`. Missing quick buttons for Payment and Expense.
2. **Technician assignment broken**: Fetches from `user_roles` (auth users with technician role) but most technicians are in `employees` table without linked auth accounts. Need to fetch from `employees` where `role = 'technician'` instead.
3. **No warranty tracking**: After repair completion, no way to record warranty days or warranty terms.
4. **Razorpay payment link missing on Quotation and JobSheet**: Only InvoicePreview has it.
5. **Hikvision needs full redesign**: Current flow doesn't persist credentials properly, no device selection/save UI, no per-device sync actions.
6. **User wants a public front website/landing page**.

---

## 1. Fix Dashboard Quick Action URLs + Add Payment/Expense Buttons

**File: `src/pages/Dashboard.tsx` (lines 144-152)**

- Change `/quotations/new` → `/sales/new`
- Change `/job-sheets/create` → `/repairs/new`
- Add "Quick Payment" button → opens `/finance` 
- Add "Quick Expense" button → opens `/finance`

---

## 2. Fix Technician Assignment (Fetch from Employees)

**File: `src/pages/JobSheetDetail.tsx` (lines 125-129)**

Current: Fetches from `user_roles` where `role = 'technician'`, then gets `profiles`.

**Fix**: Fetch from `employees` where `role = 'technician'` and `status = 'active'`. Use `employees.id` + `employees.name` instead of `user_id` / `full_name`. Update `assignTechnician` to work with employee IDs. Also show technician assignment card for statuses beyond just `approved` (also `created`, `pending_approval`, `assigned`).

---

## 3. Add Warranty Tracking to Job Sheets

**Database Migration**:
```sql
ALTER TABLE public.job_sheets ADD COLUMN IF NOT EXISTS warranty_days integer DEFAULT 0;
ALTER TABLE public.job_sheets ADD COLUMN IF NOT EXISTS warranty_terms text;
ALTER TABLE public.job_sheets ADD COLUMN IF NOT EXISTS warranty_start_date date;
```

**File: `src/pages/JobSheetDetail.tsx`**:
- Add a "Warranty" card in the right sidebar (below Cost Tracking), visible after `repair_completed` / `quality_check` / `invoice_generated` / `delivered`
- Fields: Warranty Days (number input), Warranty Terms (text), auto-set `warranty_start_date` to today when saved
- Show warranty expiry date badge in header when warranty is active

---

## 4. Razorpay Payment Link on Quotation Preview + Job Sheet Detail

**File: `src/pages/QuotationPreview.tsx`**:
- Add "Send Payment Link" button (similar to InvoicePreview) that calls `create-payment-link` with quotation total and customer details

**File: `src/pages/JobSheetDetail.tsx`**:
- Add "Send Payment Link" button in Actions card that calls `create-payment-link` with job sheet total and customer details
- Reuse the same edge function, passing `description: "Payment for JOB-XXXX"`

---

## 5. Hikvision Full Redesign

**File: `src/pages/Settings.tsx` (HikvisionTab)**:

Complete redesign with step-by-step flow:

1. **Step 1 - Credentials**: App Key + Secret Key inputs with Save & Test (already exists, keep)
2. **Step 2 - Site Selection**: After valid credentials, show discovered sites in a selectable list. Add "Set as Default" button per site that saves to `business_settings.integrations.hik_default_site_id`
3. **Step 3 - Device Discovery**: After site selected, call `list-cloud-devices` for that site. Show devices in a table with Name, Serial, Model, Status. Add "Save Device" button that upserts into `hikvision_devices`
4. **Step 4 - Sync Actions**: Per-device sync buttons: "Sync Employees", "Sync Attendance", "Full Sync". Show results inline.

Replace the current flat layout with a stepper/accordion UI. Each step unlocks after the previous succeeds.

---

## 6. Public Landing Page

**New File: `src/pages/LandingPage.tsx`**:
- Modern SaaS landing page with:
  - Hero section (company name, tagline, CTA to login)
  - Features grid (Repair Management, Invoicing, POS, Inventory, CRM)
  - How it works section
  - Footer with links
- Clean white/green theme matching Donezo style

**File: `src/App.tsx`**:
- Change `/` route: if not authenticated → show LandingPage, if authenticated → show Dashboard
- Or add `/welcome` route for landing page

---

## Files Summary

```text
MIGRATION:   warranty columns on job_sheets
EDIT:        src/pages/Dashboard.tsx              -- Fix URLs, add payment/expense buttons
EDIT:        src/pages/JobSheetDetail.tsx          -- Fix technician fetch, add warranty, add Razorpay
EDIT:        src/pages/QuotationPreview.tsx        -- Add Razorpay payment link
EDIT:        src/pages/Settings.tsx                -- Hikvision full redesign with stepper
NEW:         src/pages/LandingPage.tsx             -- Public front website
EDIT:        src/App.tsx                           -- Landing page route
```

## Implementation Order
1. Database migration (warranty columns)
2. Dashboard URL fixes + quick buttons
3. JobSheetDetail: technician fetch fix + warranty + Razorpay
4. QuotationPreview: Razorpay link
5. Settings: Hikvision stepper redesign
6. LandingPage + App.tsx route

