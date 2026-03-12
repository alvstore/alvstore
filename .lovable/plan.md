

# Implementation Plan: Landing Page Route, Technician Ledger, and Procurement Module

This is a large scope request spanning 3 major areas. Here is the plan broken into phases.

---

## 1. Landing Page as Primary Route

**Current state:** `/` goes to Dashboard (protected), `/welcome` goes to LandingPage.
**Change:** Make `/` show LandingPage for unauthenticated users and Dashboard for authenticated users.

**Files:**
- `src/App.tsx` -- Change `/` route to `<LandingPage />`, move Dashboard to `/dashboard`, update `ProtectedRoute` redirect
- `src/components/layout/ProtectedRoute.tsx` -- Redirect unauthenticated to `/` instead of `/login`
- `src/pages/Login.tsx` -- After login, redirect to `/dashboard`
- `src/hooks/useAuth.tsx` -- Ensure post-login redirect goes to `/dashboard`
- `src/components/layout/AppSidebar.tsx` -- Update Dashboard link from `/` to `/dashboard`

---

## 2. Technician Payment Ledger

**Goal:** Track technician payments (paid/unpaid) with a ledger view for both admin and technician roles, synced to Finance expenses.

**Database Migration:**
```sql
CREATE TABLE public.technician_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  technician_id uuid NOT NULL,
  job_sheet_id uuid,
  amount numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'unpaid', -- unpaid, paid
  payment_date date,
  payment_mode text,
  finance_transaction_id uuid,
  notes text,
  created_by uuid,
  created_at timestamptz DEFAULT now()
);
-- RLS + policies for admin/staff/technician access
```

**Files:**
- `src/pages/Technicians.tsx` -- Add "Ledger" tab per technician showing payment history, totals (paid/unpaid/total), and "Mark as Paid" action that creates a finance expense transaction
- `src/pages/TechnicianDashboard.tsx` -- Add payment ledger view for technician's own payments
- `src/pages/JobSheetDetail.tsx` -- When tech payment is recorded, auto-insert into `technician_payments`

---

## 3. Procurement Module

This is the largest piece. New tables, pages, and sidebar section.

### Database Migration (6 new tables):

```sql
-- Suppliers
CREATE TABLE public.suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  gst_number text,
  phone text, email text, address text,
  outstanding_balance numeric DEFAULT 0,
  status text DEFAULT 'active',
  created_by uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Purchase Orders
CREATE TABLE public.purchase_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  po_number text NOT NULL DEFAULT '',
  supplier_id uuid REFERENCES public.suppliers(id),
  status text DEFAULT 'draft', -- draft/sent/approved/partially_received/completed/cancelled
  subtotal numeric DEFAULT 0,
  gst_amount numeric DEFAULT 0,
  total numeric DEFAULT 0,
  notes text,
  expected_date date,
  created_by uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Purchase Order Items
CREATE TABLE public.purchase_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  po_id uuid NOT NULL,
  product_id uuid,
  product_name text NOT NULL,
  quantity integer DEFAULT 1,
  received_quantity integer DEFAULT 0,
  unit_price numeric DEFAULT 0,
  gst_percentage numeric DEFAULT 18,
  total numeric DEFAULT 0
);

-- Purchase Bills
CREATE TABLE public.purchase_bills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_number text NOT NULL DEFAULT '',
  po_id uuid,
  supplier_id uuid REFERENCES public.suppliers(id),
  status text DEFAULT 'draft', -- draft/confirmed/paid/cancelled
  subtotal numeric DEFAULT 0,
  gst_amount numeric DEFAULT 0,
  discount_value numeric DEFAULT 0,
  total numeric DEFAULT 0,
  payment_status text DEFAULT 'unpaid',
  paid_amount numeric DEFAULT 0,
  bill_date date DEFAULT CURRENT_DATE,
  due_date date,
  notes text,
  created_by uuid,
  created_at timestamptz DEFAULT now()
);

-- Purchase Bill Items
CREATE TABLE public.purchase_bill_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_id uuid NOT NULL,
  product_id uuid,
  product_name text NOT NULL,
  quantity integer DEFAULT 1,
  unit_price numeric DEFAULT 0,
  gst_percentage numeric DEFAULT 18,
  serial_numbers text[],
  batch_number text,
  expiry_date date,
  total numeric DEFAULT 0
);

-- Purchase Returns
CREATE TABLE public.purchase_returns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  return_number text NOT NULL DEFAULT '',
  supplier_id uuid REFERENCES public.suppliers(id),
  bill_id uuid,
  status text DEFAULT 'draft',
  subtotal numeric DEFAULT 0,
  total numeric DEFAULT 0,
  reason text,
  notes text,
  created_by uuid,
  created_at timestamptz DEFAULT now()
);

-- Purchase Return Items
CREATE TABLE public.purchase_return_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  return_id uuid NOT NULL,
  product_id uuid,
  product_name text NOT NULL,
  quantity integer DEFAULT 1,
  unit_price numeric DEFAULT 0,
  total numeric DEFAULT 0
);
```

Plus auto-number triggers for `po_number`, `bill_number`, `return_number`.
Plus RLS policies for admin/staff access.

### New Pages:
- `src/pages/Suppliers.tsx` -- CRUD + supplier ledger (outstanding, payments, credits)
- `src/pages/PurchaseOrders.tsx` -- List, create, edit POs with status workflow
- `src/pages/PurchaseOrderDetail.tsx` -- PO preview with convert-to-bill action
- `src/pages/PurchaseBills.tsx` -- List, create bills; on confirm: stock increases via `stock_movements`
- `src/pages/PurchaseReturns.tsx` -- Create returns; on confirm: stock decreases, supplier credit created

### Sidebar Update:
- `src/components/layout/AppSidebar.tsx` -- Add "Procurement" category with Purchase Orders, Purchase Bills, Purchase Returns, Suppliers

### Route Updates:
- `src/App.tsx` -- Add routes: `/suppliers`, `/purchase-orders`, `/purchase-orders/new`, `/purchase-orders/:id`, `/purchase-bills`, `/purchase-bills/new`, `/purchase-returns`, `/purchase-returns/new`

### Finance Integration:
- Purchase Bill confirmed → auto-create finance expense transaction
- Supplier payment → reduce `suppliers.outstanding_balance`
- Purchase Return confirmed → create supplier credit entry in finance

### Inventory Integration:
- Purchase Bill confirmed → insert `stock_movements` (type: 'in')
- Purchase Return confirmed → insert `stock_movements` (type: 'out')

---

## Implementation Order

1. Database migration (all tables + triggers + RLS)
2. Landing page route change
3. Technician payment ledger
4. Suppliers page
5. Purchase Orders (list + create + detail)
6. Purchase Bills (list + create + stock integration)
7. Purchase Returns
8. Sidebar + routing updates
9. Finance integration wiring

## Files Summary

```text
MIGRATION:  technician_payments, suppliers, purchase_orders, purchase_order_items,
            purchase_bills, purchase_bill_items, purchase_returns, purchase_return_items
            + triggers + RLS

EDIT:       src/App.tsx
EDIT:       src/components/layout/ProtectedRoute.tsx
EDIT:       src/components/layout/AppSidebar.tsx
EDIT:       src/pages/Technicians.tsx
EDIT:       src/pages/TechnicianDashboard.tsx

CREATE:     src/pages/Suppliers.tsx
CREATE:     src/pages/PurchaseOrders.tsx
CREATE:     src/pages/PurchaseOrderDetail.tsx
CREATE:     src/pages/PurchaseBills.tsx
CREATE:     src/pages/PurchaseReturns.tsx
```

