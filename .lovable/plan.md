

# Repair Management Module -- Complete Overhaul

## Overview

Full redesign of the repair module to support service charges with category-based defaults, per-repair GST (inclusive/exclusive), discounts, parts tracking, invoice generation from repairs, payment sync, and a step-by-step wizard for job sheet creation. All pages will follow Materialize admin template patterns (card layouts, stepper wizard, timeline, sticky sidebar).

---

## Database Changes

### 1. New Table: `service_charge_categories`

Stores default service charges per device category (admin-configurable).

```
id              uuid PK DEFAULT gen_random_uuid()
name            text NOT NULL (e.g. "iPhone", "Laptop", "MacBook")
default_charge  numeric NOT NULL DEFAULT 0
created_at      timestamptz DEFAULT now()
```

RLS: Admin full access, staff/technician read-only.

### 2. New Table: `repair_parts`

Tracks parts used per repair job.

```
id              uuid PK DEFAULT gen_random_uuid()
job_sheet_id    uuid NOT NULL (FK to job_sheets)
name            text NOT NULL
cost            numeric NOT NULL DEFAULT 0
gst_percentage  numeric DEFAULT 18
quantity        integer DEFAULT 1
total           numeric DEFAULT 0
created_at      timestamptz DEFAULT now()
```

RLS: Admin and staff full access, technicians can view assigned jobs' parts.

### 3. Alter Table: `job_sheets`

Add columns for billing:

```
service_charge      numeric DEFAULT 0
discount_type       text DEFAULT 'none' (values: none, percentage, fixed)
discount_value      numeric DEFAULT 0
gst_mode            text DEFAULT 'exclusive' (values: inclusive, exclusive, none)
gst_percentage      numeric DEFAULT 18
gst_amount          numeric DEFAULT 0
parts_total         numeric DEFAULT 0
total_amount        numeric DEFAULT 0
invoice_id          uuid (FK to invoices, nullable)
payment_status      text DEFAULT 'unpaid' (values: unpaid, partial, paid)
```

### 4. Seed default service categories

Insert rows via migration:

- iPhone: 750
- Android: 500
- Laptop: 2600
- MacBook: 3500
- Tablet: 1000
- Other: 500

---

## File Changes

### A. `src/pages/JobSheetCreate.tsx` -- Stepper Wizard Rewrite

Replace the current single-page form with a 5-step wizard:

- **Step state**: `currentStep` (1-5) with Next/Back buttons and a horizontal stepper indicator at the top showing completed/current/future steps with icons and labels.

- **Step 1 -- Customer Information**
  - Select existing customer dropdown with search
  - "Create New" button that reveals inline fields (Name, Phone, Email, Address, GSTIN)
  - Customer contact card preview when selected

- **Step 2 -- Device Information**
  - Device category dropdown (iPhone, Android, Laptop, MacBook, Tablet, Other)
  - Brand, Model, IMEI/Serial, Color, Storage
  - Problem description, Issue tags
  - Device photos upload (front, back, side, damage)
  - Account credentials (Apple ID, Google, Lock Code)

- **Step 3 -- Service Charges**
  - Auto-fill service charge from `service_charge_categories` based on device category
  - Editable service charge amount
  - GST toggle: None / Inclusive / Exclusive (radio group)
  - GST percentage selector (default 18%)
  - Discount selector: None / Percentage / Fixed
  - Discount value input
  - Live calculation preview card showing: Service Charge, Discount, GST, Total

- **Step 4 -- Pre-Repair Checklist**
  - Same existing checklist logic (device-specific, collapsible categories, progress bars)
  - Staff notes (mandatory)
  - Priority selector
  - Estimated completion date

- **Step 5 -- Review and Submit**
  - Full summary preview in a read-only card layout:
    - Customer card
    - Device info card
    - Service charge + GST + discount breakdown
    - Checklist summary (pass/fail counts)
  - Two buttons: "Save Job Sheet" and "Save and Generate Invoice"
  - "Save and Generate Invoice" creates both the job sheet and an invoice in one action

### B. `src/pages/JobSheetDetail.tsx` -- Materialize Preview Layout

Restructure to a two-column layout (70/30):

**Left column (main content):**

1. Business header card (company name, address, logo)
2. Customer card (name, phone, email, GST)
3. Device info card
4. Service charge summary card:
   - Service Charge line
   - Parts list (from `repair_parts` table) with name, cost, GST, quantity, total
   - Subtotal, Discount, GST breakdown (CGST/SGST), Grand Total
5. Pre-repair checklist (existing, collapsed)
6. Post-repair checklist (existing)
7. Repair Status Timeline (Materialize vertical timeline):
   - Each step: icon, label, date/time, user name, notes
   - Completed steps in primary color, current with ring indicator, future greyed out
   - Show audit log entries mapped to timeline steps
8. Audit log

**Right column (sticky sidebar actions):**

- Status badge (large)
- "Generate Invoice" button (creates invoice from repair data -- service charge + parts as line items)
- "Add Payment" button (opens sheet to record payment, updates job payment_status and syncs to invoices/payments tables)
- "Download PDF" button (print-optimized)
- "Edit Job Sheet" button (navigates to edit route)
- "Copy Public Link"
- Payment status badge (Unpaid/Partial/Paid)
- Assigned technician card
- Device movement actions

### C. `src/pages/JobSheets.tsx` -- Enhanced List Page

Update table columns to match requirements:

- Job Sheet Number
- Customer (with avatar initials)
- Device (brand + model)
- Category (device_type)
- Service Charge (formatted)
- Total Amount (formatted)
- Status badge
- Created Date
- Actions dropdown: View, Edit, Generate Invoice, Add Payment, Download PDF

Add repair revenue KPI cards:

- Total Repairs
- Pending Approval
- In Progress
- Repair Revenue (sum of total_amount where payment_status = paid)

### D. `src/pages/Dashboard.tsx` -- Repair Revenue Integration

Update `fetchKpis()` to add:

- Repair Revenue Today: sum of `job_sheets.total_amount` where `payment_status = 'paid'` and created today
- Repair Revenue This Month: same but month range

Add a "Repair Revenue" widget to the sales widgets row with Wrench icon.

Update the repair breakdown chart to query `job_sheets` instead of `repair_tickets` (which may be unused).

### E. Invoice Generation Logic

When "Generate Invoice" is clicked on a repair:

1. Create invoice with:
   - customer_id from job sheet
   - job_sheet_id linked
   - Line items:
     - Service charge as first item (product_name: "Service Charge - {device_type}", unit_price: service_charge)
     - Each repair_part as additional line items
   - GST mode, discount from job sheet
   - Calculate totals using existing `calculateTotals` function

2. Update `job_sheets.invoice_id` with the new invoice ID
3. Update `job_sheets.status` to `invoice_generated`
4. Log to `job_sheet_audit_log`

### F. Payment Sync

When payment is recorded against a repair:

1. Insert into `payments` table with type = 'repair'
2. Update `job_sheets.payment_status` based on paid vs total
3. If invoice exists, update `invoices.paid_amount` and `invoices.payment_status`
4. Log to `finance_audit_log`

### G. Settings -- Service Charge Categories

Add a "Service Categories" section in `src/pages/Settings.tsx` under the System group:

- Table listing categories with name and default charge
- Add/Edit/Delete categories
- CRUD against `service_charge_categories` table

### H. Routing Updates in `src/App.tsx`

- Add route `/repairs/:id/edit` pointing to JobSheetCreate in edit mode

---

## Technical Details

### New Files
```
None -- all changes are to existing files
```

### Modified Files
```
src/pages/JobSheetCreate.tsx  -- Full rewrite to stepper wizard with service charges
src/pages/JobSheetDetail.tsx  -- Two-column Materialize layout with invoice/payment actions
src/pages/JobSheets.tsx       -- Enhanced table columns, revenue KPIs, action dropdown
src/pages/Dashboard.tsx       -- Add repair revenue widget
src/pages/Settings.tsx        -- Add service charge categories management
src/App.tsx                   -- Add /repairs/:id/edit route
```

### Database Migration (single SQL)
```sql
-- Service charge categories table
CREATE TABLE service_charge_categories (...)
-- Repair parts table
CREATE TABLE repair_parts (...)
-- Alter job_sheets with new billing columns
ALTER TABLE job_sheets ADD COLUMN service_charge ...
-- RLS policies for new tables
-- Seed default categories
```

### Implementation Order
1. Database migration (new tables + alter job_sheets)
2. Settings -- service charge categories CRUD
3. JobSheetCreate -- stepper wizard rewrite
4. JobSheetDetail -- two-column layout + invoice generation + payment sync
5. JobSheets -- enhanced list with revenue KPIs
6. Dashboard -- repair revenue widget
7. App.tsx routing update

