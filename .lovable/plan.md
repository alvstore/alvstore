

# Supplier CRM Enhancement + Technician Ledger Sync Fix

## Audit Findings: Technician Payment-Ledger Sync Bug

**Root cause identified:** In `JobSheetDetail.tsx` line 229, `recordTechnicianPayment()` updates the `job_sheets` table (`technician_payment`, `technician_payment_status`) but **never inserts a row into `technician_payments`**. The Technicians page ledger reads from `technician_payments`, so it always shows ₹0 -- the two systems are completely disconnected.

**Fix:** After updating `job_sheets`, also insert into `technician_payments` with the job sheet ID, amount, and technician ID. This syncs the ledger automatically.

---

## Supplier CRM Enhancement

The current Suppliers page is basic CRUD + a read-only bill ledger. Enhance it into a full CRM module:

### Current gaps:
- No supplier payment recording (can't pay down outstanding balance)
- No purchase return visibility in the supplier ledger
- No tabbed layout for different views

### Redesign:
- **Supplier Ledger Dialog** -- expand to show 3 tabs: Bills, Payments, Returns
- **Record Payment** -- add ability to record payments against a supplier (reduces outstanding balance, creates finance expense)
- **Returns visibility** -- show purchase returns linked to the supplier
- **Supplier detail header** -- show full contact info (GST, phone, email, address) in the ledger dialog

---

## Files

```
EDIT:  src/pages/JobSheetDetail.tsx   -- Fix: insert into technician_payments when recording tech payment
EDIT:  src/pages/Suppliers.tsx        -- CRM enhancement: tabs for Bills/Payments/Returns, record payment action
```

No database migration needed -- existing tables (`technician_payments`, `suppliers`, `purchase_bills`, `purchase_returns`, `finance_transactions`) already support all required operations.

