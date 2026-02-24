

# Full ERP End-to-End Audit, Bug Fix, and UI/UX Overhaul

## Issues Found and Root Causes

### CRITICAL BUG 1: Sidebar Text Invisible / Cut Off
**Evidence**: Screenshots show sidebar nav items are barely visible -- only the active item and category headers show, rest appear as ghost text.
**Root Cause**: In `AppSidebar.tsx` (lines 179-183), nav link text colors use Tailwind arbitrary values like `text-[hsl(var(--sidebar-foreground))/0.55]` and `text-[hsl(var(--sidebar-foreground))/0.65]`. The `/0.55` and `/0.65` opacity syntax inside `hsl()` via Tailwind arbitrary values does NOT work correctly -- Tailwind generates broken CSS. The same issue affects category labels (line 159) using `/0.38`.
**Fix**: Replace all broken opacity color references with proper Tailwind opacity modifiers or explicit `rgba()` values. For example, change `text-[hsl(var(--sidebar-foreground))/0.65]` to `text-sidebar-foreground/65` (using Tailwind's built-in opacity modifier syntax).

### CRITICAL BUG 2: Chat "New Conversation" Shows No Users
**Evidence**: User reports "no user to select to start chat."
**Root Cause**: `fetchAllProfiles()` in `Chat.tsx` (line 101) queries the `profiles` table. Currently there is only 1 profile in the system (the logged-in admin). After filtering out `p.user_id !== user?.id` (line 108), the result is empty. The employees table has 2 records (Kuldeep Salvi and OGK) but they are not linked as auth users / do not have profiles.
**Fix**: Modify chat user picker to ALSO pull from the `employees` table (which has actual team members) as contacts. Show employees who have `user_id` set as internal chat contacts. For employees without `user_id` (external), show only as WhatsApp contacts if they have a phone number. Additionally, in the internal tab, show existing profiles AND linked employees.

### BUG 3: Payroll Shows External Technicians
**Evidence**: Screenshot shows "OGK" (Technician, external) in Payroll with salary ₹0. Payroll is for internal employees only.
**Root Cause**: `Payroll.tsx` (line 50) queries `employees` with only `eq("status", "active")` filter -- does NOT filter by `employee_type`. External/outsourced technicians should NOT appear in payroll.
**Fix**: Add `.neq("employee_type", "external")` or `.eq("employee_type", "internal")` filter. Also add a null-safe check since older records may not have `employee_type` set.

### BUG 4: Attendance Not Filtering by Employee Type
**Evidence**: Attendance tracks all employees but should focus on internal staff. External technicians have their own attendance tracking mechanisms.
**Root Cause**: `ManualAttendanceTab` in `Attendance.tsx` does not distinguish between internal and external employees.
**Fix**: When showing the admin attendance view, join with `employees` table to show only internal employees, or at minimum add an "Internal / All" filter toggle.

### BUG 5: Dashboard Shows Same Content on Every Page
**Evidence**: Screenshots show the Dashboard content (Welcome back, KPI cards) is displayed when user navigates to Customers, Inventory, Attendance pages. The sidebar highlights different items but the main content stays as Dashboard.
**Root Cause**: Need to check routing -- likely the `Outlet` is not rendering correctly or the route paths don't match. Looking at the screenshots, the URL bar shows `/customers`, `/inventory`, `/attendance` but the content is Dashboard. This suggests either the `Outlet` component is not receiving the child route properly, or the child routes are not matching.

Actually, re-examining `AppLayout.tsx` -- it uses `<Outlet />` correctly. The issue is more likely that those page components are failing to render (throwing errors silently) and the error boundary falls back to Dashboard. Let me check if pages like `Customers.tsx` or `Inventory.tsx` have import/render errors.

**Alternative root cause**: Looking at the screenshots more carefully, the URLs in the status bar show `/customers` and `/inventory`. The content area shows the Dashboard. This could mean the routes are defined but the page components crash on render, causing React to show nothing (and the Dashboard content bleeds through if it's a parent route issue). Since `App.tsx` uses flat routes under `AppLayout`, this shouldn't happen unless the child components error out.

**Fix**: Need to audit `Customers.tsx` and `Inventory.tsx` for render errors. Add error boundaries. Also verify route registration in `App.tsx`.

### UI/UX IMPROVEMENT 1: Adopt Reference Dashboard Design
**Evidence**: User provided reference images showing a dark-themed "Visualization Suite" with left sidebar module selector (Sales, Finance, Inventory, Operations), prominent KPI cards with trend arrows, chart type switcher (Area/Bar/Line), and donut resource allocation chart.
**Improvements**:
- Add chart type toggle (Area / Bar / Line) to the Sales Trend chart
- Add a metric selector dropdown to switch between data views (Revenue, Leads, etc.)
- Add a donut chart for "Resource Allocation" showing repair status distribution
- Improve KPI card design with larger values and trend indicators using real data
- Add temporal scope filter (Today / 7 Days / 30 Days / Custom) to dashboard

### UI/UX IMPROVEMENT 2: Employee Form Has Duplicate Field
**Evidence**: `Employees.tsx` lines 289-294 show "Designation" field appears TWICE -- once in line 290 and again in line 293. The second should be "Salary" label.
**Fix**: Remove duplicate designation field, keep the one with salary.

---

## Implementation Plan

### Phase 1: Critical Bug Fixes

**1. Fix Sidebar Text Visibility** (`src/components/layout/AppSidebar.tsx`)
- Replace all `text-[hsl(var(--sidebar-foreground))/0.XX]` with proper Tailwind opacity classes
- Replace `text-[hsl(var(--sidebar-accent-foreground))]` with `text-sidebar-accent-foreground`
- Use standard Tailwind color/opacity: `text-sidebar-foreground/55`, `text-sidebar-foreground/65`, etc.
- Test that all nav items, category labels, and separators are clearly visible

**2. Fix Chat User Picker** (`src/pages/Chat.tsx`)
- Modify `fetchAllProfiles()` to also query the `employees` table
- Merge employees with `user_id` into the profiles list
- Show role badges from the `employees.role` column
- For employees without auth accounts, show them with a "(no login)" indicator
- For external employees with phone numbers, auto-suggest them in the WhatsApp tab

**3. Fix Payroll to Exclude External Employees** (`src/pages/Payroll.tsx`)
- Add filter: `.or('employee_type.eq.internal,employee_type.is.null')` to exclude external/outsourced workers
- Add a visual indicator column showing "Internal" badge
- Show a separate section or note for external contractors if needed

**4. Fix Dashboard Rendering on Other Pages** (`src/App.tsx` + affected pages)
- Audit route definitions to ensure no conflicts
- Add React error boundaries around page components
- Check `Customers.tsx`, `Inventory.tsx` for runtime errors that might cause silent failures

### Phase 2: UI/UX Dashboard Overhaul

**5. Dashboard Redesign** (`src/pages/Dashboard.tsx`)
- Add temporal scope selector (Today / 7 Days / 30 Days)
- Add chart type toggle (Area / Bar / Line) for the sales trend chart
- Add donut chart showing repair status resource allocation
- Compute real trend percentages by comparing current vs previous period
- Improve KPI card styling to match reference: larger values, trend arrows with color coding

### Phase 3: Attendance & Employees Fixes

**6. Attendance Employee Type Filter** (`src/pages/Attendance.tsx`)
- Add "Internal / All" toggle to the attendance admin view
- Show employee type badge in attendance records

**7. Fix Employee Form Duplicate** (`src/pages/Employees.tsx`)
- Remove duplicate "Designation" field at line 293
- Ensure the second grid row is Joining Date + Salary

### Phase 4: Reports Dashboard Enhancement

**8. Reports Page** (`src/pages/Reports.tsx`)
- Add repair revenue report tab
- Add attendance summary report
- Add employee performance metrics

---

## Files to Modify

```text
src/components/layout/AppSidebar.tsx  -- Fix broken color opacity syntax
src/pages/Chat.tsx                    -- Fix user picker to show employees
src/pages/Payroll.tsx                 -- Filter out external employees
src/pages/Dashboard.tsx               -- UI/UX overhaul with chart toggles
src/pages/Attendance.tsx              -- Employee type filter
src/pages/Employees.tsx               -- Fix duplicate form field
src/App.tsx                           -- Verify routing, add error boundaries
```

## Database Changes
None required -- all fixes are frontend logic and CSS.

