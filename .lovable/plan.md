

# ERP-CRM Phase 3: Settings, POS, and Remaining Modules

Phase 1 (Dashboard, CRM, Auth/RBAC) and Phase 2 (Inventory, Sales/Quotations, Repairs) are complete. This phase builds out the Settings page and the remaining "Coming Soon" modules.

---

## 1. Settings Page (Priority -- you're currently viewing this)

A tabbed settings interface with the following sections:

### Profile Tab
- Edit current user's full name, phone, avatar
- Change password form
- Reads/writes to `profiles` table

### User Management Tab (Admin only)
- List all users with their roles
- Change user roles (Admin/Staff/Technician/Customer)
- Invite new users (show signup link or send invite)
- Requires joining `profiles` and `user_roles` tables
- New RLS policy: Admins can view all profiles

### Business Settings Tab (Admin only)
- Company name, address, phone, email, GST number, logo
- Invoice prefix, quotation prefix settings
- New `business_settings` table (single-row config table)

### Integration Settings Tab (Admin only)
- Placeholder fields for future integrations:
  - Razorpay API key
  - CCAvenue credentials
  - PhonePe merchant ID
  - SMS API endpoint and key
  - SMTP email settings
  - Hikvision device IP/credentials
- Stored securely (will use edge function secrets in future phases)

---

## 2. POS Module

A fast, full-screen point-of-sale interface:

### Layout
- Left panel: product grid with images, search, barcode input field
- Right panel: cart with line items, GST calculation, total, payment buttons
- Optimized for tablet and desktop

### Features
- Barcode scanner input (auto-focused text field, listens for Enter key)
- Search products by name/SKU/barcode from `products` table
- Add to cart with quantity adjustment
- Auto GST calculation per line and total
- Complete sale: creates stock movement (type: out) for each item
- New `pos_transactions` table: id, transaction_number, items (jsonb), subtotal, gst_amount, total, payment_method, customer_id (optional), created_by, created_at
- Receipt view with print option

---

## 3. Payments Module

### Database
- New `payments` table: id, payment_number, type (invoice/pos/online), amount, payment_method (cash/card/upi/online), reference_id, customer_id, quotation_id, pos_transaction_id, status (pending/completed/failed/refunded), notes, created_by, created_at

### UI
- Payment list with filters (date range, status, type)
- Record manual payment form (slide-over)
- Payment summary KPI cards (total collected today, pending, by method)
- Links to related quotation or POS transaction

---

## 4. Attendance Module

### Database
- New `attendance_records` table: id, employee_id (references profiles.user_id), check_in, check_out, date, device_id, source (manual/biometric), notes, created_by, created_at

### UI
- Calendar view of attendance records
- Manual check-in/check-out buttons for today
- Admin view: all employees attendance with date filter
- Employee view: own attendance history
- Placeholder for Hikvision biometric sync (future edge function)

---

## 5. Staff Module

### UI
- Staff directory listing all users with profiles
- Filter by role
- View staff member details (profile, role, attendance summary)
- Admin can edit roles from here (reuses User Management logic)

---

## 6. Customers Page

- Redirects to or mirrors the CRM page (they serve the same purpose)
- Or: a simplified customer directory view focused on customer portal features (view own quotations, repairs, invoices)

---

## 7. Templates Module

### Database
- New `templates` table: id, name, type (email/sms/invoice/quotation), subject, body, variables (jsonb array), is_default, created_by, created_at, updated_at

### UI
- Template list grouped by type
- Create/edit template slide-over with:
  - Rich text editor for email templates
  - Plain text editor for SMS (with character count and DLT compliance note)
  - Variable insertion helper (e.g., customer_name, invoice_number, amount)
- Preview template with sample data

---

## 8. Reports Module

### UI
- Report dashboard with date range selector
- Pre-built reports:
  - Sales report (daily/weekly/monthly)
  - Inventory report (stock levels, movements)
  - Repair report (tickets by status, technician performance)
  - Payment report (collections by method, outstanding)
  - Attendance report (employee-wise, date range)
- Each report shown as a data table with export to CSV option
- Charts where applicable

---

## Database Changes Summary

New tables:
- `business_settings` (single-row company config)
- `pos_transactions` (POS sales records)
- `payments` (payment tracking)
- `attendance_records` (employee attendance)
- `templates` (email/SMS/invoice templates)

Modified tables:
- `profiles`: add RLS policy for admin to view all profiles

All tables will have RLS policies following the existing RBAC pattern.

---

## Implementation Order

1. Settings page (immediate value -- you're on it now)
2. POS module (high business priority)
3. Payments module
4. Attendance module
5. Staff page
6. Customers page
7. Templates module
8. Reports module

Each module will follow the established patterns: slide-over forms, search/filter tables, KPI cards where relevant, and mobile-responsive layouts.

