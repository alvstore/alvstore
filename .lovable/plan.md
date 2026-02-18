

# Enhancement Plan: Calendar Views, Finance Receipts & Search, Dashboard Widgets

## 1. Calendar -- Month/Week/Day/List Views

The current calendar only has a month grid view. Based on the reference image, we need Month, Week, Day, and List toggle buttons with proper views for each.

**Changes to `src/pages/CalendarPage.tsx`:**

- Add a `viewMode` state: `"month" | "week" | "day" | "list"`
- Add toggle button group (Month / Week / Day / List) in the calendar header, styled like the reference image
- **Month View** (existing): Keep current grid, minor polish
- **Week View**: 7-column grid with time slots (6AM-10PM) on the left axis. Events rendered as colored blocks spanning their time range. All-day events shown in a top row. Navigation arrows shift by 1 week. Header shows "Feb 15 -- 21, 2026" style date range
- **Day View**: Single column with hourly slots. Events rendered as blocks. Header shows the selected date
- **List View**: Simple chronological list of upcoming events in a table/card format with date grouping
- Update navigation arrows to shift by week/day depending on current viewMode
- "Today" button resets to current date in any view

---

## 2. Finance: Income/Expense Receipt Slip + Date Filter + Search Fix

### 2A. Receipt Slip for Income/Expense

When a user records an income (e.g., advance payment from customer), they need to download/print a receipt slip.

**Changes to `TransactionTab` in `src/pages/Finance.tsx`:**
- Add a "View" or receipt icon button on each transaction row
- Clicking opens a receipt dialog/sheet with a print-optimized layout:
  - Company name, address, phone (from `business_settings`)
  - Receipt number (transaction_id)
  - Date, Payment Mode, Amount (in words + digits)
  - Category, Reference, Description
  - "Received From" / "Paid To" field
  - Staff name
  - Signature line
- Add "Print" and "Download PDF" buttons (using `window.print()` with print CSS)
- Add "Send WhatsApp" and "Send Email" buttons to share receipt

### 2B. Date Filter for Income & Expense Tabs

**Changes to `TransactionTab`:**
- Add date range filter buttons: Today, 7 Days, This Month, Custom (with date picker)
- Filter the transaction list by the selected date range
- Same pattern already used in Cash Control tab

### 2C. Search Fix -- Search Across All Fields

**Current issue**: Search only matches `transaction_id` and `description`. User expects to search by date, amount, reference, staff name, payment mode.

**Changes to `TransactionTab`:**
- Expand search filter to match across: `transaction_id`, `date` (formatted), `amount` (string), `payment_mode`, `reference`, `staff_name`, `description`

### 2D. Audit Log Search Fix

**Changes to `AuditLogTab` in `src/pages/Finance.tsx`:**
- Expand search to match across: `action`, `details`, `staff_name`, `user_role`, `entity_type`, and formatted `created_at` date
- Same fix in `src/pages/AuditLogs.tsx` (the standalone audit page)

---

## 3. Dashboard -- Separate KPI Widgets for Quotations, POS Sales, and Total Sales

### Problem
"POS Sales Today" KPI currently only shows POS transaction totals. User wants three separate clearly labeled widgets so nothing is merged.

**Changes to `src/pages/Dashboard.tsx`:**

- Replace the current secondary stat cards with a new row of 3 clearly separated widgets:

  1. **POS Sales Today** -- Sum of `pos_transactions.total` for today (already exists, keep as-is)
  2. **Quotations Today** -- Sum of `quotations.total` created today (new query)
  3. **Invoices Today** -- Sum of `invoices.total` created today (new query)

- Add month equivalents below or as sub-text:
  - POS Sales This Month
  - Quotations This Month
  - Invoices This Month

- Each widget uses a different icon and color to make them visually distinct:
  - POS Sales: ShoppingCart icon, primary color
  - Quotations: FileText icon, warning/amber color
  - Invoices: Receipt icon, success/green color

- Update `fetchKpis()` to add new queries:
  - `supabase.from("quotations").select("total").gte("created_at", today)` for quotations today
  - `supabase.from("quotations").select("total").gte("created_at", monthStart)` for quotations this month
  - `supabase.from("invoices").select("total").gte("created_at", today)` for invoices today
  - `supabase.from("invoices").select("total").gte("created_at", monthStart)` for invoices this month

---

## Technical Details

### Modified Files
```
src/pages/CalendarPage.tsx -- Add Month/Week/Day/List views with toggle
src/pages/Finance.tsx -- Receipt slip, date filter, search fix for TransactionTab + AuditLogTab
src/pages/Dashboard.tsx -- Separate KPI widgets for POS/Quotations/Invoices
src/pages/AuditLogs.tsx -- Search fix across all fields
```

### No Database Changes Required

### Implementation Order
1. Dashboard KPI separation (quickest, clear impact)
2. Finance search fix + date filter (TransactionTab + AuditLogTab)
3. Finance receipt slip (print/download)
4. Calendar Month/Week/Day/List views (largest change)

