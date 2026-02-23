

# Full ERP Audit, Bug Fix, and UI/UX Upgrade Plan

## Audit Summary

After a comprehensive end-to-end review of the entire codebase (Login, Signup, Dashboard, Sidebar, Job Sheets, Invoices, Finance, POS, Chat, Settings, Technician Dashboard, Customer Portal, Public Pages, and Audit Logs), here are all identified issues and improvements organized by priority.

---

## CRITICAL BUGS TO FIX

### 1. Dashboard Repair Chart Queries Wrong Table
**File:** `src/pages/Dashboard.tsx` (line 88)
**Issue:** `fetchRepairBreakdown()` queries `repair_tickets` table, which is a legacy table. All repair data now lives in `job_sheets`.
**Fix:** Change query to `job_sheets` and map statuses from the current `job_sheet_status` enum.

### 2. Login Page Branding Mismatch
**File:** `src/pages/Login.tsx` (line 33)
**Issue:** Shows "ERPMaster" instead of "ALVStore ERP 2026" branding.
**Fix:** Update Login, Signup, ForgotPassword, and ResetPassword pages to use "ALVStore ERP 2026" branding with the Zap icon, matching the sidebar.

### 3. Payment Sync Bug in JobSheetDetail
**File:** `src/pages/JobSheetDetail.tsx` (line 286)
**Issue:** Payment query sums ALL payments for the customer (`eq("customer_id", job.customer_id)`) instead of payments specifically for this job. This means payments from other jobs or invoices affect this job's payment status incorrectly.
**Fix:** Filter payments by job-related invoice or add a `job_sheet_id` filter. Since payments don't have a `job_sheet_id` column, link through `invoice_id` or add a reference column.

### 4. Sidebar Mobile Close on Navigation
**File:** `src/components/layout/AppLayout.tsx`
**Issue:** When user taps a navigation link on mobile, the sidebar stays open. User must manually close it.
**Fix:** Close mobile sidebar on route change using `useLocation()`.

### 5. Dashboard Hardcoded Trend Percentages
**File:** `src/pages/Dashboard.tsx` (lines 143-147)
**Issue:** KPI cards show hardcoded trend values like "+8%", "-5%", "+12%", "+22%" which are fake/misleading.
**Fix:** Either calculate real trends by comparing current vs previous period, or remove the trend indicators entirely.

---

## WORKFLOW AND LOGIC FIXES

### 6. Finance Transaction Table Missing Columns
**File:** `src/pages/Finance.tsx` (TransactionTab)
**Issue:** Income/Expense tables lack Category name, Account name, and Description columns. Only shows ID, Date, Mode, Amount, Reference, Staff.
**Fix:** Add joined Category name and Account name columns. Add CSV export button. Add transaction detail side panel on row click.

### 7. Finance Ledger Missing CSV Export
**File:** `src/pages/Finance.tsx` (LedgerTab)
**Issue:** No export functionality for the ledger view.
**Fix:** Add CSV export button to the ledger tab.

### 8. Public Job Sheet Missing Billing Info
**File:** `src/pages/PublicJobSheet.tsx`
**Issue:** The public-facing job sheet page shows the old `estimated_cost` field but doesn't show the new service charges breakdown, GST, or total amount. Customers can't see what they're approving cost-wise.
**Fix:** Add billing summary section (service charges, GST, discount, total) to the public view.

### 9. Technician Dashboard Missing Repair Details
**File:** `src/pages/TechnicianDashboard.tsx`
**Issue:** Technician cards in the overview don't link to filtered job lists. No way for admin to drill down into a specific technician's jobs.
**Fix:** Make technician cards clickable to filter by technician.

---

## UI/UX IMPROVEMENTS

### 10. Login/Signup/Auth Pages -- Modern 2026 Redesign
**Files:** `Login.tsx`, `Signup.tsx`, `ForgotPassword.tsx`, `ResetPassword.tsx`
**Current:** Plain card with basic form fields. No visual identity.
**Improvement:**
- Split-screen layout: left side with brand illustration/gradient, right side with form
- ALVStore ERP 2026 branding with Zap icon
- Glassmorphism card effect
- Password visibility toggle
- Loading spinner animation
- Consistent with the 2026 design system

### 11. Finance Dashboard KPI Cards -- Better Visual Hierarchy
**File:** `src/pages/Finance.tsx`
**Current:** 7 KPI cards in a single row (too many, cramped on smaller screens).
**Improvement:**
- Group into 2 rows: Primary (Cash, Bank, Net) and Secondary (Today Income, Today Expense, Monthly Income, Monthly Expense)
- Add mini sparkline or trend indicator
- Better responsive grid (2 cols mobile, 4 cols desktop)

### 12. Chat -- Smart Action Drawer Context
**File:** `src/pages/Chat.tsx`
**Current:** "New Chat" button opens a generic user picker.
**Improvement:**
- Add glassmorphism effect to the new chat drawer
- Auto-suggest contacts based on active context (if navigated from a job sheet, suggest the customer and assigned technician)
- Show user role badges in the contact list
- Add "typing..." indicator placeholder

### 13. POS -- Receipt Improvements
**File:** `src/pages/POS.tsx`
**Current:** Basic receipt dialog.
**Improvement:**
- Add business header (company name, address, GST from business_settings)
- Show GST breakup (CGST/SGST) on receipt
- Better print formatting

### 14. Customer Portal -- Service Charges Visibility
**File:** `src/pages/CustomerPortal.tsx`
**Current:** Shows repair cards with old `estimated_cost` and `final_cost` fields.
**Improvement:**
- Show `total_amount` from job_sheets (new billing fields)
- Show payment status badge
- Add "View Details" link to public job sheet page

### 15. Technician Dashboard -- TTR Countdown
**File:** `src/pages/TechnicianDashboard.tsx`
**Current:** No time tracking or urgency indicators.
**Improvement:**
- Add Time-to-Repair countdown based on `estimated_completion` date
- Color-code cards by urgency (overdue = red, due today = orange, on track = green)
- Add repair notes quick-input

### 16. Job Sheet List -- Dense Table Mode
**File:** `src/pages/JobSheets.tsx`
**Current:** Standard table density.
**Improvement:**
- Add compact/dense toggle for power users
- Show payment status badge in the table
- Add bulk status update capability

### 17. Settings Page -- Better Section Navigation
**File:** `src/pages/Settings.tsx`
**Current:** Long sidebar with many sections.
**Improvement:**
- Add search/filter for settings sections
- Add breadcrumb for current section
- Better mobile layout (full-width sections)

---

## DATABASE CHANGES

### 18. Add `job_sheet_id` to Payments Table
**Migration SQL:**
```sql
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS job_sheet_id uuid REFERENCES public.job_sheets(id);
```
This allows proper payment-to-job tracking instead of the current customer-wide sum approach.

---

## IMPLEMENTATION ORDER

### Phase 1: Critical Bug Fixes (Priority)
1. Fix Dashboard repair chart query (repair_tickets -> job_sheets)
2. Fix payment sync bug (add job_sheet_id to payments, update addPayment logic)
3. Fix hardcoded dashboard trends (remove or compute real values)
4. Fix mobile sidebar auto-close on navigation
5. Fix branding across all auth pages (ERPMaster -> ALVStore ERP 2026)

### Phase 2: Auth Pages Redesign
6. Redesign Login page (split-screen, glassmorphism, 2026 branding)
7. Redesign Signup, ForgotPassword, ResetPassword pages to match

### Phase 3: Finance UI Upgrade
8. Enhance transaction table with Category/Account columns and CSV export
9. Add transaction detail side panel
10. Improve KPI card layout and responsiveness

### Phase 4: Repair Workflow Polish
11. Update PublicJobSheet with billing summary
12. Update CustomerPortal with new billing fields
13. Add TTR countdown to TechnicianDashboard
14. Add dense mode to JobSheets list

### Phase 5: Chat and Settings Polish
15. Chat Smart Action Drawer improvements
16. Settings section search and mobile layout

---

## Technical Summary

### Database Migration
```sql
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS job_sheet_id uuid;
```

### Files Modified
```text
src/pages/Login.tsx                      -- 2026 branded redesign
src/pages/Signup.tsx                     -- 2026 branded redesign
src/pages/ForgotPassword.tsx             -- 2026 branded redesign
src/pages/ResetPassword.tsx              -- 2026 branded redesign
src/pages/Dashboard.tsx                  -- Fix repair chart, remove fake trends
src/pages/JobSheetDetail.tsx             -- Fix payment sync with job_sheet_id
src/pages/Finance.tsx                    -- Enhanced transaction table, CSV export
src/pages/Chat.tsx                       -- Glassmorphism drawer, context suggestions
src/pages/POS.tsx                        -- Receipt improvements
src/pages/PublicJobSheet.tsx             -- Add billing summary
src/pages/CustomerPortal.tsx             -- Show new billing fields
src/pages/TechnicianDashboard.tsx        -- TTR countdown, clickable cards
src/pages/JobSheets.tsx                  -- Dense mode, payment status column
src/pages/Settings.tsx                   -- Section search, mobile layout
src/components/layout/AppLayout.tsx      -- Mobile sidebar auto-close
```

