

# Comprehensive Fix and Enhancement Plan -- 10 Issues

## Overview

Addressing all 10 issues reported: Dashboard KPI fix, barcode management, chat user selector, settings redesign, WhatsApp webhook config, quotation editing, item-wise GST, POS walk-in customer, calendar event display sync, and external technician management.

---

## Issue 1: Dashboard "Sales Today" Shows Quotation Value + Follow-Up Widget

**Problem**: "Sales Today" KPI queries `pos_transactions` only. The displayed value may be confusing. User wants a follow-up widget for pending quotations and repairs.

**Changes to `src/pages/Dashboard.tsx`:**
- Rename "Sales Today" KPI to "POS Sales Today" for clarity
- Add a new "Follow-Up" widget card below the charts section showing:
  - Pending Quotations (status = draft or sent) with customer name, amount, days since created, and a "Call" button that creates a task + calendar event
  - Pending Repairs (status not completed/delivered) with customer name, job number, status
- Each follow-up row has action buttons: "Schedule Call" (creates a task linked to the entity and a calendar event), "View" (navigates to detail page)
- Add a new "Follow-Ups" page (`src/pages/FollowUps.tsx`) accessible from sidebar for dedicated follow-up management with filters for quotations, repairs, and invoices

**Changes to `src/components/layout/AppSidebar.tsx`:**
- Add "Follow-Ups" nav item under CRM category

**Changes to `src/App.tsx`:**
- Add route `/follow-ups` pointing to FollowUps page

---

## Issue 2: Barcode Generator as Separate Menu

**Problem**: No standalone barcode generation page. User wants to generate, print, and assign barcodes to products.

**New file: `src/pages/BarcodeManager.tsx`**
- Page with two sections:
  - **Generate Barcodes**: Select products (multi-select), choose barcode format (CODE128/EAN-13), set label size, quantity per product
  - **Print Labels**: Preview barcode labels in a grid, print button opens print-optimized view
  - **Assign Barcode**: If a product has no barcode, auto-generate one and update the product record
- Uses existing `jsbarcode` dependency (already installed)
- Each label shows: barcode image, product name, SKU, price

**Changes to `src/components/layout/AppSidebar.tsx`:**
- Add "Barcode Manager" under ECOMMERCE category

**Changes to `src/App.tsx`:**
- Add route `/barcodes` pointing to BarcodeManager

---

## Issue 3: Chat "Select User" Not Showing Staff/Customer

**Problem**: `fetchAllProfiles` queries `profiles` table but only gets users whose profile exists. The dropdown shows nothing because profiles may not have `full_name` populated, or RLS policies restrict visibility.

**Changes to `src/pages/Chat.tsx`:**
- Fix `fetchAllProfiles` to also fetch the user's role from `user_roles` table so the dropdown shows "Name (Role)" format
- For WhatsApp tab, also load customers from `customers` table so user can pick a customer to chat with (auto-fills phone number)
- Add search/filter in the user dropdown
- Show role badge (Admin, Staff, Technician, Customer) next to each user name
- Ensure the Select component renders properly with actual data

---

## Issue 4: Settings Page Redesign

**Problem**: Settings page is messy with too many tabs in a single row. No payment gateway settings. Profile not properly linked.

**Changes to `src/pages/Settings.tsx` -- Full redesign:**
- Replace horizontal tabs with a vertical sidebar navigation (left panel 25%, content 75%) matching Materialize settings pattern
- Group settings into sections:
  - **Account**: Profile (linked to current user profile), Change Password
  - **Organization**: Business Info, GST Settings
  - **Integrations**: Email/SMTP, SMS, WhatsApp (with webhook URL field and Facebook App ID/Secret fields), Razorpay (Key ID, Key Secret, Webhook Secret, Webhook URL display), Hikvision
  - **System**: User Management, Templates
- Each section is a card with clear labels and descriptions
- Add Razorpay payment gateway configuration section with:
  - Key ID, Key Secret, Webhook Secret fields
  - Display the webhook URL that needs to be configured in Razorpay dashboard
  - Test connection button

---

## Issue 5: WhatsApp Webhook URL + Facebook Developer Config

**Problem**: WhatsApp settings don't show the webhook URL for Facebook developer portal. No field for Facebook App Secret for webhook verification.

**Changes to Settings WhatsApp section:**
- Add fields for:
  - Facebook App ID
  - Facebook App Secret (for webhook signature verification)
  - Webhook Verify Token (auto-generated, copyable)
  - Display the Webhook URL (read-only, copyable) that user enters in Facebook Developer portal
- Similarly for Razorpay, display webhook URL for Razorpay dashboard

**Changes to `supabase/functions/send-whatsapp/index.ts`:**
- Add webhook verification support (GET request handling for Facebook webhook verification challenge)

---

## Issue 6: No Option to Edit Quotation

**Problem**: QuotationPreview has an "Edit" button that just navigates to `/sales` (list page). There's no edit functionality.

**Changes to `src/App.tsx`:**
- Add route `/sales/:id/edit` pointing to QuotationAdd

**Changes to `src/pages/QuotationAdd.tsx`:**
- Accept optional `id` param from URL
- If `id` is present, load existing quotation data + items and pre-fill the form
- Change save logic: if editing, update existing quotation + delete old items + insert new items
- Change page title to "Edit Quotation" when editing

**Changes to `src/pages/QuotationPreview.tsx`:**
- Fix "Edit" button to navigate to `/sales/${id}/edit` instead of `/sales`

**Same pattern for InvoiceAdd:**
- Add route `/invoices/:id/edit`
- Update InvoiceAdd to support edit mode
- Fix InvoicePreview edit button

---

## Issue 7: Item-Wise GST Control (Inclusive/Exclusive per Item)

**Problem**: GST is only at the overall invoice/quotation level. User wants per-item GST control -- some items with GST, some without, some inclusive, some exclusive.

**Changes to `src/components/documents/ItemsTable.tsx`:**
- The `DocumentItem` interface already has `gst_enabled` and `gst_percentage` fields
- Add a visible toggle per item row: "GST" switch (on/off) and GST% input
- When GST is disabled for an item, `gst_percentage` is set to 0
- Add "Inclusive" toggle per item (new field `gst_inclusive` on DocumentItem)

**Changes to `src/components/documents/TotalsPanel.tsx`:**
- Update calculation to respect per-item `gst_enabled` and per-item `gst_inclusive` settings
- Show breakdown: "Items with GST" subtotal vs "Items without GST" subtotal

**Database**: No schema change needed -- `gst_percentage` per item already exists in `quotation_items` and `invoice_items`

---

## Issue 8: POS Walk-In Customer Capture

**Problem**: POS has no way to record customer details (name, phone, email, address) and send receipt via WhatsApp/SMS/Email.

**Changes to `src/pages/POS.tsx`:**
- Add "Customer" section in the cart panel (right side), above payment method:
  - "Walk-in" toggle (default) vs "Select Customer" dropdown
  - If toggle off: show customer search/select from existing customers
  - If walk-in: show inline fields for Name, Phone, Email (optional quick-capture)
  - "Save as Customer" checkbox -- if checked, creates a new customer record on sale completion
- On sale completion:
  - If customer selected/created, link `customer_id` to `pos_transactions`
  - Receipt dialog: "Send WhatsApp" button uses `send-whatsapp` function, "Send Email" uses `send-email` function, "Send SMS" uses `send-sms` function
  - Pre-fill phone/email from customer record

---

## Issue 9: Calendar Events Not Visible + Task Sync

**Problem**: After creating a calendar event, it's not visible on the grid. Only edit/delete buttons show. Events should sync with Tasks.

**Changes to `src/pages/CalendarPage.tsx`:**
- Bug fix: Events are fetched but the grid click handler always opens "Add Event" dialog. When clicking on an event chip, `e.stopPropagation()` is already used but the event chip might be too small or covered
- Make event chips taller (min-height) and more visible with better contrast
- Add "Link to Task" option in event dialog -- when checked, also creates/updates a task in `tasks` table with same title, date, and linked entity
- Show task-linked events with a small task icon indicator
- Fetch tasks from `tasks` table and display them on the calendar grid as well (different style -- dashed border)
- Two-way sync: When a task with a due date is created/updated, also create/update a calendar event

---

## Issue 10: External Technician Management

**Problem**: Technicians are sometimes outsourced (not employees). Currently shown under Employees which is incorrect.

**Changes to `src/pages/Employees.tsx`:**
- Add a "Type" field to employee form: "Internal" or "External/Outsourced"
- Add filter tab: All / Internal / External
- External technicians show a different badge/indicator

**Database migration:**
- Add `employee_type` column to `employees` table: `text DEFAULT 'internal'`
- Values: 'internal', 'external'

**Changes to `src/pages/JobSheetCreate.tsx` and `src/pages/JobSheetDetail.tsx`:**
- When assigning technician, show type badge (Internal/External) next to name
- For external technicians, show payment terms more prominently since they're paid per job

---

## Technical Details

### New Files
```
src/pages/FollowUps.tsx -- Follow-up management for pending quotations/repairs
src/pages/BarcodeManager.tsx -- Barcode generation and label printing
```

### Modified Files
```
src/pages/Dashboard.tsx -- Fix KPI label, add follow-up widget
src/pages/Chat.tsx -- Fix user selector to show staff/customers with roles
src/pages/Settings.tsx -- Full redesign with vertical sidebar layout, add Razorpay + WhatsApp webhook config
src/pages/QuotationAdd.tsx -- Support edit mode via URL param
src/pages/QuotationPreview.tsx -- Fix edit button navigation
src/pages/InvoiceAdd.tsx -- Support edit mode via URL param  
src/pages/InvoicePreview.tsx -- Fix edit button navigation
src/components/documents/ItemsTable.tsx -- Per-item GST toggle (on/off + percentage)
src/components/documents/TotalsPanel.tsx -- Updated calculations for item-wise GST
src/pages/POS.tsx -- Walk-in customer capture with contact fields
src/pages/CalendarPage.tsx -- Fix event visibility, task sync
src/pages/Employees.tsx -- Internal/External technician type
src/pages/JobSheetCreate.tsx -- Show technician type badge
src/pages/JobSheetDetail.tsx -- Show technician type badge
src/components/layout/AppSidebar.tsx -- Add Follow-Ups, Barcode Manager nav items
src/App.tsx -- Add routes for /follow-ups, /barcodes, /sales/:id/edit, /invoices/:id/edit
supabase/functions/send-whatsapp/index.ts -- Add webhook verification handler
```

### Database Migration
```sql
ALTER TABLE employees ADD COLUMN employee_type text DEFAULT 'internal';
```

### Implementation Order
1. Database migration (employee_type)
2. Settings page redesign (Issue 4 + 5 -- Razorpay and WhatsApp webhook config)
3. Chat user selector fix (Issue 3)
4. Quotation/Invoice edit mode (Issue 6)
5. Item-wise GST (Issue 7)
6. POS walk-in customer (Issue 8)
7. Calendar fix + task sync (Issue 9)
8. External technician type (Issue 10)
9. Barcode Manager page (Issue 2)
10. Dashboard follow-up widget + page (Issue 1)

