

# Comprehensive ERP Upgrade: 9-Point Implementation Plan

## Overview

Nine distinct improvements spanning dashboard redesign, theme addition, new Delivery Challan module, chat enhancements, technician separation, finance KPIs, salesperson/signature settings, and attendance restructuring.

---

## 1. Dashboard Redesign with KPI Cards (Matching Reference)

**File: `src/pages/Dashboard.tsx`**

Replace the current dashboard layout with the Dribbble reference design:
- **Header**: "Dashboard" title + subtitle + "Add Project" / "Import Data" action buttons (right-aligned)
- **KPI Cards Row** (4 cards): Replicate the exact reference layout -- label top-left, arrow-up-right icon top-right, large bold metric center, trend text with wave icon at bottom. Cards: Total Revenue, Sales (Month), Active Repairs, Pending Payments
- **Analytics Section** (2-col): "Project Analytics" bar chart (weekly sales with green gradient bars, day labels S-M-T-W-T-F-S) + "Reminders" card (next calendar event with "Start Meeting" button)
- **Bottom Section** (3-col): "Team Collaboration" card (employee list with status badges), "Project Progress" donut chart (repair completion %), and "Recent Invoices" list with "Time Tracker" accent card
- Fix right-side alignment: ensure all grid items align flush-right with consistent gap spacing

## 2. Add "Donezo" Green/White Theme

**File: `src/hooks/useTheme.tsx`**

Add a 7th theme matching the uploaded Dribbble reference (white background, forest green accents, warm cream cards):
- Name: `"donezo"`
- Label: `"Donezo"`
- Background: `#F5F5F0` (warm gray), Card: `#FFFFFF`, Primary: Forest Green `#065F46`
- Success: `#065F46`, borders: `#E5E7EB`, muted-foreground: zinc-500
- isDark: false

## 3. Delivery Challan Module (New Feature)

**Database**: Create `delivery_challans` and `delivery_challan_items` tables via migration:
- `delivery_challans`: id, challan_number, customer_id, status (draft/sent/delivered/invoiced), invoice_id (nullable FK), notes, created_by, created_at
- `delivery_challan_items`: id, challan_id, product_id, product_name, quantity, unit_price, total
- RLS policies for authenticated users

**New Files**:
- `src/pages/DeliveryChallans.tsx` -- list page with KPI cards (Total, Sent, Delivered, Converted to Invoice) + table
- `src/pages/DeliveryChallanAdd.tsx` -- create/edit form (reuse document pattern from QuotationAdd)
- `src/pages/DeliveryChallanPreview.tsx` -- preview + print + "Convert to Invoice" button

**Route & Sidebar**:
- Add routes in `App.tsx`: `/challans`, `/challans/new`, `/challans/:id`
- Add "Delivery Challans" nav item under Sales category in `AppSidebar.tsx`

## 4. Chat: Read/Sent/Seen Status + File Attachments

**Database Migration**:
- Add columns to `chat_messages`: `read_at` already exists, add `delivered_at` timestamp, `file_url` text, `file_name` text, `file_type` text
- Create storage bucket `chat-files` for file uploads

**File: `src/pages/Chat.tsx`**:
- **Read receipts**: When user views a message, update `read_at`. Show tick icons: single grey (sent), double grey (delivered), double blue (read)
- **File upload**: Add paperclip button next to send. Upload to `chat-files` bucket, store URL in message. Render image previews inline, file links for documents
- Mark messages as read when conversation is opened (`read_at = now()` for all unread messages from other sender)

## 5. Separate Technicians from Employees

**New File: `src/pages/Technicians.tsx`**:
- Dedicated page listing employees where `role = 'technician'`
- KPI cards: Total Technicians, Active Jobs, Completed Today, Average Rating
- Table: Avatar, Name, Phone, Active Jobs, Status
- Create/Edit sheet with technician-specific fields (specialization, skills)
- "Assign to Job" quick action

**File: `src/pages/Employees.tsx`**: Filter out technicians (`role != 'technician'`) from the default employee list

**Sidebar**: Add "Technicians" under Repair category. Update route in `App.tsx` from `/technicians` (currently TechnicianDashboard) to use new Technicians page, and keep TechnicianDashboard at `/technicians/dashboard`

## 6. Finance Redesign with More KPI Cards

**File: `src/pages/Finance.tsx`**:
- Add a prominent KPI row at top (before tabs): Total Balance, Today's Income, Today's Expenses, Net Profit (Month), Pending Receivables, Cash in Hand
- Each KPI card uses the icon-on-top layout matching the dashboard reference
- Add "ALVStore" vs "Incline Gym" transaction filter toggle
- Improve chart section with theme-aware colors

## 7. Salesperson Auto-populate + Payment Terms + Signature Upload

**Files: `src/pages/QuotationAdd.tsx`, `src/pages/InvoiceAdd.tsx`**:
- Replace the text "Salesperson" input with a `<Select>` dropdown populated from `employees` table (role = staff/admin)
- Add "Payment Terms" dropdown: Net 7, Net 15, Net 30, Net 45, Net 60, Due on Receipt, Custom
- Store selected payment_terms in quotation/invoice record

**File: `src/pages/Settings.tsx`**:
- Add "Document Settings" section under Organization group
- Upload signature image (stored in Supabase storage `signatures` bucket)
- Toggle: "Show signature on Quotations", "Show signature on Invoices"
- Store signature_url in `business_settings.integrations` JSON

**Database Migration**: Add `salesperson_id`, `payment_terms` columns to `quotations` and `invoices` tables

## 8. Attendance Page Restructure

**File: `src/pages/Attendance.tsx`**:
- Move Devices, Sync Logs, Employee Mapping, Departments tabs to Settings page (under a new "Hikvision" or "Devices" section) -- they are system configuration, not daily attendance
- Keep only the main Attendance tab on this page
- Add **KPI Cards**: Present Today, Absent Today, Late Arrivals, On Leave, Total Employees
- Add **Calendar View** tab: Monthly calendar grid showing attendance dots per day per employee
- Add **Month-wise Download**: Select month, generate CSV/print of all employee attendance for that month
- Admin can click any day on calendar to see detailed attendance for that date

## 9. Right-Side Alignment Fix

**File: `src/pages/Dashboard.tsx`** (covered in item 1):
- Ensure grid columns use consistent `gap-4` or `gap-6`
- KPI cards must be equal width in their grid
- Charts and bottom panels align to the same right edge
- No orphan padding or margin on the rightmost column

---

## Database Migrations Required

```sql
-- Delivery Challans
CREATE TABLE public.delivery_challans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  challan_number text NOT NULL DEFAULT '',
  customer_id uuid REFERENCES public.customers(id),
  status text NOT NULL DEFAULT 'draft',
  notes text,
  invoice_id uuid,
  created_by uuid,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.delivery_challan_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  challan_id uuid REFERENCES public.delivery_challans(id) ON DELETE CASCADE,
  product_id uuid,
  product_name text,
  quantity integer DEFAULT 1,
  unit_price numeric DEFAULT 0,
  total numeric DEFAULT 0
);

ALTER TABLE public.delivery_challans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_challan_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth users manage challans" ON public.delivery_challans FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Auth users manage challan items" ON public.delivery_challan_items FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Chat file columns
ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS file_url text;
ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS file_name text;
ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS file_type text;
ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS delivered_at timestamptz;

-- Salesperson + payment terms
ALTER TABLE public.quotations ADD COLUMN IF NOT EXISTS salesperson_id uuid;
ALTER TABLE public.quotations ADD COLUMN IF NOT EXISTS payment_terms text;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS salesperson_id uuid;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS payment_terms text;
```

## Files Summary

```text
MIGRATIONS:  delivery_challans, chat_messages columns, quotation/invoice columns
NEW:         src/pages/DeliveryChallans.tsx
NEW:         src/pages/DeliveryChallanAdd.tsx
NEW:         src/pages/DeliveryChallanPreview.tsx
NEW:         src/pages/Technicians.tsx
EDIT:        src/hooks/useTheme.tsx              -- Add Donezo theme
EDIT:        src/pages/Dashboard.tsx              -- Full KPI redesign
EDIT:        src/pages/Chat.tsx                   -- Read receipts + file upload
EDIT:        src/pages/Employees.tsx              -- Filter out technicians
EDIT:        src/pages/Finance.tsx                -- KPI cards row
EDIT:        src/pages/QuotationAdd.tsx           -- Salesperson select + payment terms
EDIT:        src/pages/InvoiceAdd.tsx             -- Salesperson select + payment terms
EDIT:        src/pages/Settings.tsx               -- Signature upload + Hikvision tabs
EDIT:        src/pages/Attendance.tsx             -- Remove device tabs, add calendar
EDIT:        src/components/layout/AppSidebar.tsx -- Add Delivery Challans + Technicians
EDIT:        src/App.tsx                          -- New routes
```

## Implementation Order
1. Database migrations (foundation for new features)
2. `src/hooks/useTheme.tsx` -- Donezo theme
3. `src/pages/Dashboard.tsx` -- KPI redesign
4. `src/pages/DeliveryChallans.tsx` + Add/Preview -- new module
5. `src/pages/Chat.tsx` -- file attachments + read receipts
6. `src/pages/Technicians.tsx` + Employees filter
7. `src/pages/Finance.tsx` -- KPI cards
8. `src/pages/QuotationAdd.tsx` + `InvoiceAdd.tsx` -- salesperson/payment terms
9. `src/pages/Attendance.tsx` -- restructure + calendar
10. `src/pages/Settings.tsx` -- signature upload + Hikvision tabs
11. `src/App.tsx` + `AppSidebar.tsx` -- routes and navigation

