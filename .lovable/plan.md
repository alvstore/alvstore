

# ERP-CRM Phase 2: Quotations, Inventory & Repair Management

Phase 1 (Dashboard, CRM, Auth/RBAC, App Shell) is complete. This plan covers the next three high-value modules that form the operational backbone of your business.

---

## Phase 2A: Inventory Module

### Database
- **`products` table**: id, name, sku, barcode, description, image_url, category, purchase_price, selling_price, gst_percentage, stock_quantity, low_stock_threshold, unit, created_by, created_at, updated_at
- **`stock_movements` table**: id, product_id, type (in/out/adjustment), quantity, reference, notes, created_by, created_at
- Trigger to auto-update `products.stock_quantity` on stock movement insert
- RLS: Admin and Staff can CRUD; Technician can view only

### UI
- Product catalog page with search, category filter, and grid/list toggle
- Product card showing image, name, SKU, barcode, price, stock level
- Low stock badge (red) when quantity falls below threshold
- Slide-over form for add/edit product with image upload (using Lovable Cloud storage)
- Stock movement history table per product
- Barcode input field support (keyboard wedge scanner compatible — just an auto-focused text input)

---

## Phase 2B: Quotation / Sales Module

### Database
- **`quotations` table**: id, customer_id, quotation_number (auto-generated), status (draft/sent/accepted/rejected/expired), subtotal, gst_amount, total, notes, terms, valid_until, public_token (UUID for public link), created_by, created_at, updated_at
- **`quotation_items` table**: id, quotation_id, product_id, product_name, quantity, unit_price, gst_percentage, total, image_url, notes
- RLS: Admin and Staff can CRUD; Customer can view own quotations via public token

### UI
- Quotation list page with status tabs (All, Draft, Sent, Accepted, Rejected)
- Create/edit quotation slide-over with:
  - Customer selector (from CRM)
  - Add products from inventory with quantity
  - Auto GST calculation per line item
  - Notes and terms fields
  - Preview before sending
- Generate shareable public link
- **Public quotation page** (unauthenticated route): view quotation, accept/reject buttons, download PDF (client-side generation), pay online button (placeholder for Phase 3 payment integration)

---

## Phase 2C: Repair Management Module

### Database
- **`repair_tickets` table**: id, ticket_number (auto-generated), customer_id, device_type, device_brand, device_model, serial_number, issue_description, status (pending/assigned/in_progress/waiting_parts/completed/delivered), priority (low/normal/high/urgent), assigned_technician_id, estimated_cost, final_cost, diagnosis_notes, repair_notes, created_by, created_at, updated_at
- **`repair_images` table**: id, ticket_id, image_url, caption, uploaded_by, created_at
- **`repair_status_history` table**: id, ticket_id, old_status, new_status, changed_by, notes, created_at
- RLS: Admin/Staff full access; Technician can view/update only assigned tickets; Customer can view own tickets
- Trigger to log status changes to history table

### UI
- Repair tickets list with status filter tabs and search
- Create ticket slide-over: customer selector, device details, issue description, image upload, assign technician, priority
- Ticket detail view with:
  - Device info header
  - Status timeline (from history table)
  - Image gallery
  - Notes section
  - Status update dropdown (role-restricted)
- **Technician Dashboard** (separate view at `/technicians`): shows only assigned tickets, quick status update buttons, mobile-optimized card layout

---

## Phase 2D: Storage Setup

- Create a Lovable Cloud storage bucket for product images and repair images
- Configure public access for product images
- Configure authenticated access for repair images

---

## Routing Updates

New routes added to the app:
- `/sales` — Quotation list and management
- `/sales/public/:token` — Public quotation view (unauthenticated)
- `/inventory` — Product catalog and stock management
- `/repairs` — Repair ticket management
- `/technicians` — Technician dashboard (filtered repair view)

---

## Technical Details

### New database tables: 6
`products`, `stock_movements`, `quotations`, `quotation_items`, `repair_tickets`, `repair_images`, `repair_status_history`

### New pages/components: ~10
Inventory page, Product form, Quotation list, Quotation form, Public quotation page, Repair list, Repair detail, Repair form, Technician dashboard

### Storage buckets: 1
`uploads` bucket with folders for products and repairs

### Triggers: 2
- Stock quantity auto-update on movement
- Repair status history logging

All new tables will have RLS policies enforcing the existing RBAC system (Admin, Staff, Technician, Customer roles).

