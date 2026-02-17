

# Phase 10: ERP Structure Correction and Missing Module Implementation

This phase restructures the entire ERP navigation into an enterprise-grade hierarchy with expandable sub-menus, and implements five missing core modules: Lead Management, Task Management, Invoices, HRM (Employees/Payroll), and a standalone Audit Log viewer.

---

## 1. Sidebar Navigation Restructure

Replace the flat nav structure with collapsible category groups containing sub-items. When a category has multiple children, clicking the parent expands/collapses its children. Single-item categories remain direct links.

```text
MAIN
  Dashboard

CRM
  Leads          (NEW)
  Customers      (moved from SERVICE)

SALES
  Quotations     (was "Sales")
  Invoices       (NEW)

POS
  POS Terminal   (was "POS")

INVENTORY
  Products       (was "Inventory")
  Stock Movements (NEW sub-tab, links to Inventory with tab)

REPAIR
  Repair Management (existing)

FINANCE
  Finance        (existing, contains tabs for Income/Expenses/Accounts/etc.)

HRM
  Employees      (NEW)
  Attendance     (existing, moved here)
  Payroll        (NEW)

TASKS
  Task Management (NEW)

REPORTS
  Reports        (existing)

SYSTEM
  Audit Logs     (NEW)
  Settings       (existing)
```

**Removed:** Duplicate "Customers" from SERVICE, "Technicians" (merged into Employees), standalone "Staff" (merged into Employees)

**Technical approach:** Add a `children` property to the `NavItem` interface in `AppSidebar.tsx`. Categories with children render as expandable accordions. Track expanded state in localStorage.

---

## 2. New Database Tables

### `leads`
| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| name | TEXT NOT NULL | |
| phone | TEXT | |
| email | TEXT | |
| source | TEXT | website/walkin/referral/ads |
| status | TEXT DEFAULT 'new' | new/contacted/qualified/converted/lost |
| assigned_to | UUID | staff user_id |
| notes | TEXT | |
| converted_customer_id | UUID | FK customers, nullable |
| created_by | UUID | |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

RLS: Admin + Staff full access.

### `tasks`
| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| title | TEXT NOT NULL | |
| description | TEXT | |
| assigned_to | UUID | |
| assigned_by | UUID | |
| priority | TEXT DEFAULT 'medium' | low/medium/high |
| status | TEXT DEFAULT 'pending' | pending/in_progress/completed |
| due_date | DATE | |
| related_entity_type | TEXT | customer/repair/invoice/lead |
| related_entity_id | UUID | |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

RLS: Admin + Staff full access. Technicians can view/update assigned tasks.

### `invoices`
| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| invoice_number | TEXT | auto-generated (INV-00001) |
| customer_id | UUID FK customers | |
| quotation_id | UUID FK quotations | nullable, if created from quotation |
| job_sheet_id | UUID FK job_sheets | nullable, if created from repair |
| subtotal | NUMERIC DEFAULT 0 | |
| gst_amount | NUMERIC DEFAULT 0 | |
| total | NUMERIC DEFAULT 0 | |
| paid_amount | NUMERIC DEFAULT 0 | |
| payment_status | TEXT DEFAULT 'unpaid' | unpaid/partial/paid |
| status | TEXT DEFAULT 'draft' | draft/sent/paid/cancelled |
| notes | TEXT | |
| due_date | DATE | |
| created_by | UUID | |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

### `invoice_items`
| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| invoice_id | UUID FK invoices | |
| product_id | UUID FK products | nullable |
| product_name | TEXT NOT NULL | |
| quantity | INTEGER DEFAULT 1 | |
| unit_price | NUMERIC DEFAULT 0 | |
| gst_percentage | NUMERIC DEFAULT 18 | |
| total | NUMERIC DEFAULT 0 | |

### `employees`
| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| user_id | UUID | links to auth user |
| name | TEXT NOT NULL | |
| phone | TEXT | |
| email | TEXT | |
| role | TEXT | admin/staff/technician |
| department | TEXT | |
| designation | TEXT | |
| salary | NUMERIC DEFAULT 0 | |
| joining_date | DATE | |
| status | TEXT DEFAULT 'active' | active/inactive |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

### `payroll`
| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| employee_id | UUID FK employees | |
| month | TEXT | e.g. "2026-02" |
| basic_salary | NUMERIC DEFAULT 0 | |
| deductions | NUMERIC DEFAULT 0 | |
| bonus | NUMERIC DEFAULT 0 | |
| net_salary | NUMERIC DEFAULT 0 | |
| payment_status | TEXT DEFAULT 'pending' | pending/paid |
| paid_date | DATE | |
| notes | TEXT | |
| created_by | UUID | |
| created_at | TIMESTAMPTZ | |

### `system_audit_log`
| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| user_id | UUID | |
| user_role | TEXT | |
| staff_name | TEXT | |
| action | TEXT NOT NULL | |
| module | TEXT | crm/sales/pos/inventory/repair/finance/hrm |
| entity_type | TEXT | |
| entity_id | UUID | |
| details | TEXT | |
| ip_address | TEXT | |
| created_at | TIMESTAMPTZ | |

RLS: Admin SELECT only. Authenticated INSERT. No UPDATE/DELETE.

### Triggers
- `generate_invoice_number()`: auto-generates INV-00001 format
- Invoice number trigger on INSERT

---

## 3. New Pages

### `src/pages/Leads.tsx`
- Table with search, filter by status (New/Contacted/Qualified/Converted/Lost)
- Slide-over form: Name, Phone, Email, Source, Assigned Staff, Notes
- "Convert to Customer" button that creates a customer record and updates lead status to "converted"
- Status pipeline view (tabs or kanban-style status filters)

### `src/pages/Tasks.tsx`
- Table with filters by status, priority, assignee
- Slide-over form: Title, Description, Assigned To (staff/technician dropdown), Priority, Due Date, Related Entity
- Status toggle buttons for quick updates
- "My Tasks" filter for current user

### `src/pages/Invoices.tsx`
- Table with search, status filter (draft/sent/paid/cancelled)
- Slide-over form to create invoice manually (select customer, add products from inventory, GST auto-calc)
- "Create from Quotation" flow: button on Sales page that copies quotation items to a new invoice
- Payment recording: slide-over to record partial/full payment
- PDF download support (client-side generation)

### `src/pages/Employees.tsx`
- Replaces Staff.tsx and merges Technicians view
- Table of all employees with role badges
- Slide-over form: Name, Phone, Email, Role, Department, Designation, Salary, Joining Date
- Uses the existing `manage-staff` edge function for user creation
- Links to attendance and payroll for each employee

### `src/pages/Payroll.tsx`
- Monthly payroll processing
- Select month, view all employees with salary, deductions, bonus, net pay
- Generate salary slips
- Mark as paid
- Export CSV

### `src/pages/AuditLogs.tsx`
- Read-only table of all system actions
- Filter by module, action type, date range, user
- No edit/delete capability
- Pulls from both `finance_audit_log` and `system_audit_log`

---

## 4. Modified Pages

### `src/pages/Sales.tsx`
- Rename heading to "Quotations"
- Add "Convert to Invoice" button on each accepted quotation row

### `src/pages/Inventory.tsx`
- Add a "Stock Movements" tab showing the `stock_movements` table data
- Existing product management stays as-is

### `src/pages/Attendance.tsx`
- No structural changes, just re-routed under HRM in sidebar

---

## 5. Route Changes in `App.tsx`

New routes:
- `/leads` -- Leads.tsx
- `/invoices` -- Invoices.tsx
- `/tasks` -- Tasks.tsx
- `/employees` -- Employees.tsx
- `/payroll` -- Payroll.tsx
- `/audit-logs` -- AuditLogs.tsx

Removed/redirected:
- `/customers` -- redirect to `/crm` (already does this)
- `/staff` -- redirect to `/employees`
- `/technicians` -- redirect to `/employees`

---

## 6. Implementation Order

1. **Database migration** -- Create all 6 new tables + triggers + RLS
2. **Sidebar restructure** -- Expandable nav with sub-items
3. **Leads page** -- CRM lead management
4. **Invoices page** -- Full GST invoice system with inventory integration
5. **Tasks page** -- Task assignment and tracking
6. **Employees page** -- Merge Staff + Technicians into unified HRM
7. **Payroll page** -- Monthly salary processing
8. **Audit Logs page** -- System-wide action log viewer
9. **Route cleanup** -- Add new routes, redirect old ones
10. **Sales page update** -- Add "Convert to Invoice" action

---

## Technical Summary

### Database Migration
- 7 new tables: `leads`, `tasks`, `invoices`, `invoice_items`, `employees`, `payroll`, `system_audit_log`
- 1 new trigger: `generate_invoice_number()`
- RLS policies for all tables following existing admin/staff/technician pattern

### New Files (7)
- `src/pages/Leads.tsx`
- `src/pages/Invoices.tsx`
- `src/pages/Tasks.tsx`
- `src/pages/Employees.tsx`
- `src/pages/Payroll.tsx`
- `src/pages/AuditLogs.tsx`

### Modified Files (5)
- `src/components/layout/AppSidebar.tsx` -- complete restructure with expandable sub-menus
- `src/App.tsx` -- new routes + redirects
- `src/pages/Sales.tsx` -- rename + add invoice conversion
- `src/pages/Inventory.tsx` -- add Stock Movements tab
- `src/pages/Reports.tsx` -- add Finance Reports tab

### Deleted Files
- `src/pages/Staff.tsx` -- replaced by Employees.tsx
- `src/pages/Customers.tsx` -- already just a redirect

### No New Dependencies
- Uses existing shadcn/ui, recharts, lucide-react components

