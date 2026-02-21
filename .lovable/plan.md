
# Full ERP Code Audit, Bug Fix, and Workflow Redesign

## Part 1: Fix Sidebar Navigation Bug

**Problem**: Sidebar only visible on hover, does not persist state across page refresh.

**Root Cause**: `AppLayout.tsx` initializes `collapsed` as `useState(false)` without reading from localStorage. The sidebar width (`w-[240px]` / `w-[60px]`) is correct but the state resets on every navigation.

**Fix in `src/components/layout/AppLayout.tsx`**:
- Read initial `collapsed` state from `localStorage.getItem("sidebarCollapsed")`
- Persist collapsed state to localStorage on toggle
- Ensure sidebar margin (`md:ml-60` / `md:ml-16`) stays synced with the `w-[240px]` / `w-[60px]` in AppSidebar
- Mobile: sidebar opens via hamburger, closes on overlay click or navigation

**Fix in `src/components/layout/AppSidebar.tsx`**:
- No hover-dependent visibility -- sidebar is always rendered, never toggles on hover
- Verify all CSS classes are static positioning, no `opacity-0` or `translate-x` tricks on desktop

---

## Part 2: Fix "Edit Job Sheet" Not Working

**Problem**: No `/repairs/:id/edit` route exists in `App.tsx`. The edit button in `JobSheetDetail.tsx` likely navigates to a non-existent route.

**Fix in `src/App.tsx`**:
- Add route: `<Route path="/repairs/:id/edit" element={<JobSheetCreate />} />`

**Fix in `src/pages/JobSheetCreate.tsx`**:
- The file already reads `useParams().id` as `editId` (line 167) but has no edit-loading logic
- Add `useEffect` that fetches existing job sheet data when `editId` is present
- Populate form fields from fetched data
- On save: use `update` instead of `insert` when `editId` exists
- Add audit log entry: "job_sheet_edited"
- Change page title to "Edit Job Sheet" when editing

---

## Part 3: Remove Auto Invoice Generation

**Problem**: `JobSheetCreate.tsx` has a "Save and Generate Invoice" button (line 416-454) that auto-generates an invoice at creation time. This violates the correct business workflow.

**Fix in `src/pages/JobSheetCreate.tsx`**:
- Remove the `generateInvoice` parameter from `handleSave()`
- Remove the "Save and Generate Invoice" button from Step 5
- Keep only "Save Job Sheet" button
- Remove all invoice generation code from the create form (lines 416-454)

**Invoice generation stays ONLY in `JobSheetDetail.tsx`** via the "Generate Invoice" button, which is already a manual action (line 220-264). This is correct and stays as-is.

---

## Part 4: Enhanced Service Charge Structure

**Problem**: Current service charge is a single amount field. Needs HSN, per-item GST, quantity, and proper line-item structure.

**Fix in `src/pages/JobSheetCreate.tsx` (Step 3)**:
- Replace single service charge input with a line-items table
- Each service line item has: Service Name, HSN Code, GST %, Price, Quantity, Discount (type + value), Taxable Amount, GST Amount, Total
- Add "Add Service Line" button to add multiple charges
- Auto-fill first line from `service_charge_categories` based on device type
- GST toggle (None/Inclusive/Exclusive) applies globally
- Live calculation preview: Subtotal, Total Discount, Total GST (CGST/SGST split), Grand Total
- Store as JSON array in `service_charge` column or keep computed totals in existing columns

**Database change**: Add `service_items` jsonb column to `job_sheets` to store line items array, or create a new `job_sheet_service_items` table.

I recommend using a JSONB column on `job_sheets` called `service_items` (simpler, no new table needed) to store the array of service line items. The existing `service_charge`, `gst_amount`, `total_amount` columns continue to hold computed totals.

---

## Part 5: Redesign Job Sheet Detail Page

**Current state**: Already has a two-column layout with timeline. Needs section improvements.

**Fix in `src/pages/JobSheetDetail.tsx`**:
- Structured sections in left column:
  1. Customer Info card (name, phone, email, GST)
  2. Device Info card (brand, model, serial, IMEI, color, storage)
  3. Problem Description card (description, issue tags)
  4. Pre-Repair Checklist (collapsible, existing)
  5. Diagnosis section (staff notes, technician notes)
  6. Service Charges table (line items with HSN, GST, discount, totals)
  7. Parts Used table (from repair_parts)
  8. Cost Summary card (subtotal, discount, GST breakdown, parts, grand total)
  9. Post-Repair Checklist (existing)
  10. Repair Timeline (existing, already implemented)
  11. Audit Log (existing)

- Right sidebar improvements:
  - Large status badge with stepper dropdown
  - Payment status badge
  - Generate Invoice button (only if no invoice linked AND status >= quality_check)
  - Add Payment button
  - Edit Job Sheet button (navigates to `/repairs/:id/edit`)
  - Download PDF / Print
  - Copy Public Link
  - Technician assignment card
  - Device movement actions

- Status flow enforcement: only allow forward progression through defined statuses:
  Created -> Diagnosis -> Estimate Prepared -> Estimate Approved -> Repair In Progress -> Repair Completed -> Quality Check -> Invoice Generated -> Delivered

---

## Part 6: Finance Transactions UI Redesign

**Fix in `src/pages/Finance.tsx`**:
- Enhance TransactionTab table columns: Transaction ID, Date, Type, Category name (joined), Reference, Customer, Amount, Payment Method, Account name, Status, Created By
- Add date range filter (Today / 7 Days / Month / Custom)
- Add export CSV button
- Add transaction detail side panel (Sheet) on row click showing full details
- Improve dashboard KPI cards: Cash Balance, Bank Balance, Daily Income, Daily Expense with proper card styling
- Transaction creation panel as a slide-over Sheet

---

## Part 7: Invoice Control System

**Already implemented** in `JobSheetDetail.tsx` (generateInvoice function, lines 220-264). Needs minor improvements:

- Add invoice preview dialog before creation (show what will be generated)
- Only enable "Generate Invoice" when status is `quality_check` or later
- Invoice includes: Customer, Job Sheet reference, Service Charges (line items), Parts, GST, Discount, Total
- After generation, show link to invoice

---

## Part 8: UI/UX Improvements

Apply across all modified files:
- Consistent spacing (p-6 for cards, gap-6 between sections)
- Status badges use consistent color scheme from StatusBadge component
- Stepper UI uses ring indicators for current step
- Forms use consistent label/input spacing
- Responsive: stack to single column on mobile
- Print styles for PDF generation

---

## Part 9: Code Audit Stability Fixes

- Fix broken route: Add `/repairs/:id/edit`
- Fix sidebar state persistence
- Remove auto-invoice trigger
- Fix payment sync: sum ALL payments for a job (not just latest) when calculating payment status
- Fix `addPayment` in JobSheetDetail (line 286): currently only uses current payment amount, should query all payments for this job

---

## Part 10: Audit Log

Already implemented. All actions (create, edit, status change, invoice generation, payment) log to `job_sheet_audit_log`. Finance actions log to `finance_audit_log`. No changes needed -- just ensure new edit flow also logs.

---

## Technical Summary

### Database Migration
```sql
ALTER TABLE job_sheets ADD COLUMN IF NOT EXISTS service_items jsonb DEFAULT '[]'::jsonb;
```

### Files Modified
```text
src/components/layout/AppLayout.tsx   -- Sidebar persistence fix
src/components/layout/AppSidebar.tsx  -- Remove any hover dependencies
src/App.tsx                          -- Add /repairs/:id/edit route
src/pages/JobSheetCreate.tsx         -- Edit mode, remove auto-invoice, enhanced service charges
src/pages/JobSheetDetail.tsx         -- UI restructure, invoice control, payment fix
src/pages/Finance.tsx                -- Transaction UI redesign
```

### Implementation Order
1. Sidebar fix (AppLayout + AppSidebar)
2. Database migration (service_items column)
3. App.tsx route addition
4. JobSheetCreate -- edit mode + remove auto-invoice + service line items
5. JobSheetDetail -- UI restructure + invoice control + payment fix
6. Finance.tsx -- transaction UI improvements
