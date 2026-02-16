
# ERP-CRM Phase 4: Live Dashboard, Data Polish & System Hardening

All core modules (CRM, Sales, POS, Inventory, Repairs, Payments, Attendance, Templates, Reports, Settings) are built. This phase focuses on making the system production-ready by connecting the dashboard to real data, fixing usability gaps, and adding missing features.

---

## 1. Live Dashboard (Real Data)

The dashboard currently shows hardcoded KPI values and chart data. This phase replaces all static data with live queries from the database.

### KPI Cards (live queries)
- **Sales Today**: SUM of `pos_transactions.total` where `created_at` is today
- **Sales This Month**: SUM of `pos_transactions.total` where `created_at` is current month
- **Pending Payments**: SUM of `payments.amount` where `status = 'pending'`
- **Cash Balance**: SUM of completed payments (simplified cash tracking)
- **Low Stock Items**: COUNT of `products` where `stock_quantity <= low_stock_threshold`
- **Active Repairs**: COUNT of `repair_tickets` where status is NOT 'completed' or 'delivered'
- **Completed Repairs Today**: COUNT of `repair_tickets` where status changed to 'completed' today (from `repair_status_history`)
- **Total Customers**: COUNT of `customers`

### Charts (live queries)
- **Sales Trend**: Group `pos_transactions` by day for last 7 days
- **Revenue vs Expenses**: Monthly totals from `pos_transactions` (revenue) and `stock_movements` type 'in' with purchase prices (expenses approximation)
- **Top Selling Products**: Aggregate POS transaction items (JSONB) to find top 5 products by quantity
- **Repair Status Breakdown**: Group `repair_tickets` by status

### Implementation
- Use React Query (`useQuery`) for caching and background refresh
- Add a manual "Refresh" button
- Add loading skeletons while data loads

---

## 2. Sidebar Collapse Fix

The sidebar collapse state is local to `AppSidebar` but the main content area always uses `md:ml-60`. When collapsed, the content area does not adjust.

### Fix
- Lift the `collapsed` state up to `AppLayout` so the main content `div` can use `md:ml-16` when collapsed and `md:ml-60` when expanded
- Pass collapsed state and toggle function as props to both `AppSidebar` and `AppHeader`

---

## 3. Attendance: Show Employee Names

Currently the attendance table shows truncated UUIDs for employee IDs. This should show the employee's full name from the `profiles` table.

### Fix
- Join `attendance_records` with `profiles` on `employee_id = user_id`
- Display `full_name` instead of raw UUID

---

## 4. Business Settings: Allow First-Time Insert

The `BusinessTab` in Settings only updates existing records but never inserts the first record. If no `business_settings` row exists, the save button silently fails.

### Fix
- If no settings row exists, insert a new one instead of updating
- Add upsert logic to the save function

---

## 5. Quotation Status Updates

Currently there is no way to change a quotation's status (e.g., mark as "sent" after creating a draft). The public quotation page allows accept/reject, but admin/staff need to update status too.

### Fix
- Add a status dropdown in the quotation table row actions
- Allow admin/staff to change status to: draft, sent, accepted, rejected, expired

---

## 6. Repair Ticket: Show Customer & Technician Names

The repair tickets list currently only stores IDs. Display actual names by joining with `customers` and `profiles` tables.

---

## Technical Summary

### Database changes: None
All required tables and RLS policies already exist.

### Files modified: ~6
- `src/pages/Dashboard.tsx` -- complete rewrite with live queries
- `src/components/layout/AppLayout.tsx` -- lift collapsed state
- `src/components/layout/AppSidebar.tsx` -- accept collapsed prop
- `src/pages/Attendance.tsx` -- join with profiles
- `src/pages/Settings.tsx` -- upsert logic for business settings
- `src/pages/Sales.tsx` -- add status update dropdown

### No new dependencies needed
Uses existing `@tanstack/react-query` and `@supabase/supabase-js`.
