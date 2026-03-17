

# Payment Register & Reconciliation Module

## Overview

Create a new `payment_register` table and a full-featured page at `/payment-register` for tracking card/cheque/UPI payments, bank charges, and reconciliation status. This is an audit layer -- it does NOT create finance ledger entries.

## Database Migration

**New table: `payment_register`**

```sql
CREATE TABLE public.payment_register (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_date date NOT NULL DEFAULT CURRENT_DATE,
  customer_name text NOT NULL,
  customer_id uuid,
  invoice_number text,
  invoice_id uuid,
  invoice_amount numeric NOT NULL DEFAULT 0,
  payment_mode text NOT NULL DEFAULT 'card', -- card/upi/cheque/bank_transfer
  bank_name text,
  card_type text, -- credit/debit
  transaction_reference text,
  cheque_number text,
  cheque_deposit_date date,
  cheque_clearance_date date,
  received_amount numeric NOT NULL DEFAULT 0,
  bank_charges numeric NOT NULL DEFAULT 0,
  net_received_amount numeric GENERATED ALWAYS AS (received_amount - bank_charges) STORED,
  difference_amount numeric GENERATED ALWAYS AS (invoice_amount - (received_amount - bank_charges)) STORED,
  difference_type text GENERATED ALWAYS AS (
    CASE
      WHEN invoice_amount - (received_amount - bank_charges) > 0.01 THEN 'short'
      WHEN invoice_amount - (received_amount - bank_charges) < -0.01 THEN 'excess'
      ELSE 'none'
    END
  ) STORED,
  status text NOT NULL DEFAULT 'pending', -- pending/deposited/cleared/reconciled/failed
  notes text,
  document_url text,
  created_by uuid,
  created_at timestamptz DEFAULT now()
);

-- Auto-number trigger (REG-XXXXX pattern)
-- RLS: admin + staff full access
```

Key design decisions:
- `net_received_amount`, `difference_amount`, `difference_type` are **generated columns** -- zero client-side drift
- `customer_id` and `invoice_id` are optional FKs for linking; `customer_name` and `invoice_number` allow manual entry
- Document uploads go to existing `uploads` bucket

## New Page: `src/pages/PaymentRegister.tsx`

### KPI Cards (5)
- Total Entries (count)
- Pending Clearance (status = pending/deposited)
- Total Bank Charges (sum)
- Mismatch Amount (sum of abs(difference) where type != none)
- Reconciled Entries (status = reconciled)

### Main Table
Columns: Date, Customer, Invoice, Mode, Bank, Reference, Invoice Amt, Received, Charges, Net Received, Difference (color-coded), Status badge.

Features:
- Search by customer/invoice/reference
- Filter by date range, bank, status, payment mode
- Color-coded difference: green (none), red (short), orange (excess)
- Status badges with workflow colors

### Entry Form (Sheet/Drawer)
Sections:
1. **Basic**: Date, Customer (autocomplete from customers table or manual), Invoice (autocomplete from invoices or manual)
2. **Payment**: Mode selector, received amount, bank charges (auto-calculates net + difference live)
3. **Bank/Card**: Bank name, card type (shown for card mode)
4. **Cheque**: Number, deposit date, clearance date (shown for cheque mode)
5. **Reconciliation**: Status selector, notes
6. **Document**: Upload slip/photo/PDF with preview

### Export
- CSV/Excel export of filtered data

## Routing & Sidebar

- **Route**: `/payment-register` in `src/App.tsx`
- **Sidebar**: Add "Payment Register" under the Finance category with a `FileText` or `Shield` icon

## Files Summary

```text
MIGRATION:  payment_register table + auto-number trigger + RLS
CREATE:     src/pages/PaymentRegister.tsx
EDIT:       src/App.tsx (add route)
EDIT:       src/components/layout/AppSidebar.tsx (add nav item under Finance)
```

