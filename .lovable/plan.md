
# Phase 6: Enterprise Repair Job Sheet Module

This is a major module that replaces the simple repair ticket flow with a mandatory, audit-tracked Job Sheet system featuring pre/post-repair checklists, customer approval, photo uploads, and GST invoice generation.

---

## Database Changes

### 1. New Enum: `job_sheet_status`
Values: `created`, `pending_approval`, `approved`, `rejected`, `assigned`, `in_progress`, `waiting_parts`, `repair_completed`, `quality_check`, `invoice_generated`, `delivered`

### 2. New Table: `job_sheets`
The core table replacing the simple repair ticket creation flow.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | auto |
| job_number | TEXT | auto-generated `JOB-YYYY-NNNNN` |
| customer_id | UUID FK customers | required |
| device_brand | TEXT | required |
| device_type | TEXT | required |
| device_model | TEXT | |
| serial_number | TEXT | |
| imei_number | TEXT | |
| device_color | TEXT | |
| storage_capacity | TEXT | |
| problem_description | TEXT | required |
| issue_tags | JSONB | array of issue labels |
| pre_repair_checklist | JSONB | structured checklist data |
| post_repair_checklist | JSONB | quality control checklist |
| staff_notes | TEXT | mandatory at creation |
| estimated_cost | NUMERIC | |
| estimated_completion | DATE | |
| repair_notes | TEXT | |
| final_cost | NUMERIC | |
| assigned_technician_id | UUID | |
| status | job_sheet_status | default: `created` |
| priority | repair_priority (reuse) | default: `normal` |
| approval_status | TEXT | approved/rejected |
| approval_timestamp | TIMESTAMPTZ | |
| approval_ip | TEXT | |
| public_token | UUID | for customer approval link |
| created_by | UUID | |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

### 3. New Table: `job_sheet_images`
| Column | Type |
|--------|------|
| id | UUID PK |
| job_sheet_id | UUID FK |
| image_url | TEXT |
| image_type | TEXT | `front`, `back`, `side`, `damage`, `repair_completion` |
| caption | TEXT |
| uploaded_by | UUID |
| created_at | TIMESTAMPTZ |

### 4. New Table: `job_sheet_audit_log`
Immutable audit trail -- no UPDATE or DELETE policies.

| Column | Type |
|--------|------|
| id | UUID PK |
| job_sheet_id | UUID FK |
| action | TEXT | e.g. `created`, `checklist_completed`, `customer_approved` |
| details | TEXT |
| user_id | UUID |
| user_role | TEXT |
| ip_address | TEXT |
| created_at | TIMESTAMPTZ |

### 5. New Table: `device_brands` and `device_types`
Lookup tables for dropdown values with an "Other" option that saves new entries.

| Column | Type |
|--------|------|
| id | UUID PK |
| name | TEXT UNIQUE |
| created_at | TIMESTAMPTZ |

### 6. Auto-Number Trigger
`generate_job_number()` -- format `JOB-YYYY-NNNNN` based on current year and sequential count.

### 7. Status Change Trigger
`log_job_sheet_status_change()` -- auto-inserts into `job_sheet_audit_log` on status change.

### 8. RLS Policies
- Admin/Staff: full access on `job_sheets`, `job_sheet_images`, `job_sheet_audit_log`
- Technician: SELECT/UPDATE on assigned job sheets only
- Customer: SELECT on own job sheets (via `customers.user_id`)
- Audit log: INSERT only (no UPDATE/DELETE for anyone)
- Device brands/types: SELECT for all authenticated, INSERT for admin/staff

---

## Frontend Changes

### 1. New Page: `src/pages/JobSheets.tsx`
Main job sheet management page with:
- KPI cards: Total Jobs, Pending Approval, In Progress, Completed Today
- Filterable/searchable table of all job sheets
- Status tabs matching the new workflow

### 2. New Page: `src/pages/JobSheetCreate.tsx`
Multi-section creation form (slide-over or full page):
- **Customer Section**: Select existing or create new customer inline
- **Device Section**: Brand dropdown (with "Other"), type dropdown (with "Other"), model, serial, IMEI, color, storage
- **Photo Upload Section**: Front, back, side, damage images uploaded to storage bucket
- **Pre-Repair Checklist**: Structured Yes/No/NA checklist covering power, display, audio, camera, network, hardware, accounts, accessories
- **Problem Description**: Text + issue tags
- **Estimate Section**: Cost and completion date
- **Staff Notes**: Mandatory field
- Validation: cannot submit without checklist completion and staff notes

### 3. New Page: `src/pages/JobSheetDetail.tsx`
Full detail view with sections:
- Header: Job number, status badge, customer name
- Customer info card
- Device info card with photos gallery
- Pre-repair checklist (read-only after submission)
- Problem and estimate info
- Technician assignment (admin/staff only)
- Status update controls (role-based)
- Post-repair checklist (visible only at `repair_completed` stage)
- Invoice generation button (at `quality_check` stage)
- Status timeline from audit log
- Full audit log table

### 4. New Page: `src/pages/PublicJobSheet.tsx`
Public customer approval page (accessible via `/job/:token`):
- View job sheet details, checklist, device photos
- Approve or Reject buttons
- Captures approval timestamp (IP capture best-effort via edge function)

### 5. Update `src/pages/Repairs.tsx`
Add a prominent "Job Sheets" button/tab that links to `/job-sheets`. The existing repair tickets remain for legacy data but new repairs go through job sheets.

### 6. Update `src/App.tsx`
Add routes:
- `/job-sheets` -- Job Sheets list
- `/job-sheets/new` -- Create job sheet
- `/job-sheets/:id` -- Job sheet detail
- `/job/public/:token` -- Public approval page

### 7. Update `src/components/layout/AppSidebar.tsx`
Add "Job Sheets" nav item under Repair Management or as a top-level item.

### 8. Update Technician Dashboard
Show assigned job sheets instead of (or alongside) repair tickets.

### 9. Update Customer Portal
Show job sheets with approval actions and status tracking.

---

## Implementation Order

1. Database migration (enum, tables, triggers, RLS)
2. Lookup tables seed (device brands and types)
3. Job Sheet list page with routing
4. Job Sheet creation form with checklist and photo upload
5. Job Sheet detail page with status workflow
6. Public approval page
7. Sidebar and routing updates
8. Technician dashboard integration
9. Customer portal integration

---

## Technical Notes

- Photos stored in the existing `uploads` storage bucket, referenced by URL in `job_sheet_images`
- Pre/post repair checklists stored as JSONB for flexibility (array of `{item, category, value}` objects)
- Issue tags stored as JSONB array of strings
- The `job_sheet_audit_log` table has no UPDATE/DELETE RLS policies -- it is append-only
- GST invoice generation reuses the existing `payments` table and quotation patterns
- No new dependencies required
