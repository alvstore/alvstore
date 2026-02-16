
# Phase 7: Merge Repair Management + Job Sheets & Enhance

## Overview

The old `Repairs.tsx` (simple ticket system) and `JobSheets.tsx` (enterprise workflow) serve the same purpose. This phase merges them into a single unified "Repair Management" module using the Job Sheet system as the foundation, removes legacy files, categorizes the sidebar, and enhances the Job Sheet form with missing fields and smarter checklist logic.

---

## 1. Merge: Delete Old Files, Unify Routes

**Delete these files:**
- `src/pages/Repairs.tsx` -- replaced by `JobSheets.tsx`

**Route changes in `App.tsx`:**
- Remove `/repairs` route
- Change `/job-sheets` to `/repairs` (main repair management page)
- Change `/job-sheets/new` to `/repairs/new`
- Change `/job-sheets/:id` to `/repairs/:id`
- Update all internal `navigate()` calls in `JobSheets.tsx`, `JobSheetCreate.tsx`, `JobSheetDetail.tsx`

**Rename page titles:**
- "Job Sheets" becomes "Repair Management" in the UI headings
- The data model stays as `job_sheets` table (no DB changes needed)

---

## 2. Categorized Sidebar Navigation

Group the flat nav list into labeled categories (CloudOnex-style from the reference images). When collapsed, only icons show; when expanded, category headers appear.

```
MAIN
  Dashboard

BUSINESS
  CRM
  Sales
  POS
  Inventory

SERVICE
  Repair Management  (merged, single item)
  Customers

OPERATIONS
  Attendance
  Payments
  Reports

TEAM
  Technicians
  Staff

SYSTEM
  Templates
  Settings
```

Category labels will be small uppercase text separators. When sidebar is collapsed, separators are hidden.

---

## 3. Enhanced Job Sheet Creation Form

### 3a. Account Credentials Section (new fields)
Add to the form between "Device Information" and "Pre-Repair Checklist":

- **Apple ID** (text input)
- **Apple ID Password** (password input with show/hide toggle)
- **Google Account** (text input)  
- **Google Account Password** (password input with show/hide toggle)
- **Device Lock Code / PIN** (text input)

These replace the simple Yes/No checklist items for accounts. The checklist "Accounts" category items change to:
- "Apple ID present" becomes auto-filled based on whether Apple ID field has a value
- "Google account present" becomes auto-filled based on whether Google Account field has a value

**Database change:** Add columns to `job_sheets` table:
- `apple_id` TEXT nullable
- `apple_id_password` TEXT nullable  
- `google_account` TEXT nullable
- `google_account_password` TEXT nullable
- `device_lock_code` TEXT nullable

### 3b. Smart Checklist -- Device Power-Off Logic
When staff marks "Device turns ON" as **No**, automatically set all dependent items (Display, Audio, Camera, Network, Hardware checks) to **N/A** with a visual indicator showing "Auto-set: Device is OFF". Staff can still manually override if needed.

This solves the user's question: "if device is switched off how can staff check for other device details?"

### 3c. Checklist UX Improvement
- Group checklist items in collapsible accordion sections by category
- Show completion progress per category (e.g., "3/5 completed")
- Highlight incomplete categories in amber

---

## 4. Repair Progress Timeline (Enhanced)

On `JobSheetDetail.tsx`, replace the simple audit log dots with a proper vertical timeline component:
- Each status node shows an icon, status name, timestamp, and who performed it
- Completed steps show green checkmarks
- Current step is highlighted/pulsing
- Future steps are grayed out
- Visual connector lines between nodes

---

## 5. Technician Dashboard Update

Update `TechnicianDashboard.tsx` to fetch from `job_sheets` table instead of `repair_tickets`, showing:
- Assigned job sheets with the full workflow status set
- Navigate to `/repairs/:id` for detail view

---

## 6. Customer Portal Update

Update `CustomerPortal.tsx` to also fetch `job_sheets` (in addition to legacy `repair_tickets`) and show them in the Repairs tab.

---

## Technical Summary

### Database Migration
- Add 5 columns to `job_sheets`: `apple_id`, `apple_id_password`, `google_account`, `google_account_password`, `device_lock_code`

### Files to Delete
- `src/pages/Repairs.tsx`

### Files to Create
- None (all changes are to existing files)

### Files to Modify
- `src/App.tsx` -- route changes
- `src/components/layout/AppSidebar.tsx` -- categorized nav
- `src/pages/JobSheets.tsx` -- rename headings, update routes
- `src/pages/JobSheetCreate.tsx` -- add credential fields, smart checklist logic
- `src/pages/JobSheetDetail.tsx` -- enhanced timeline, update routes
- `src/pages/TechnicianDashboard.tsx` -- use `job_sheets` table
- `src/pages/CustomerPortal.tsx` -- add job sheets data
