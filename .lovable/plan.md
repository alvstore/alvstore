

# Comprehensive Audit & Enhancement Plan

## Scope: 7 Items

---

## 1. CRM: Avatar Upload in Form + Avatar Display in Table

**File: `src/pages/CRM.tsx`**

- **Sheet form** (line ~254): Add `<AvatarUpload>` component above the form fields, passing `currentUrl={form.avatar_url}`, `folder="customers"`, `entityId={editId}`, and `onUploaded` to update `form.avatar_url`
- **Table rows** (line ~206-210): Replace the hardcoded initials circle with `<Avatar>` + `<AvatarImage src={c.avatar_url}>` + `<AvatarFallback>` so uploaded customer photos display in the list

---

## 2. Finance KPI Redesign

**File: `src/pages/Finance.tsx`**

Replace the current 2-row KPI grid (lines 172-207) with a single prominent 6-card KPI row matching the Dashboard reference style:
- **Cards**: Total Balance, Cash in Hand, Bank Balance, Today Income, Today Expense, Net Profit (Month = monthlyIncome - monthlyExpense)
- Each card: icon top-left in colored pill, label, large bold metric, small trend text
- Use the same `KpiCard`-style layout as Dashboard (icon + arrow-up-right + metric + subtitle)
- Apply theme-aware chart tooltip styling to the existing bar/pie charts (use `hsl(var(--card))` etc.)

---

## 3. Delivery Challan Enhancement

**File: `src/pages/DeliveryChallanAdd.tsx`**

Add fields for:
- **Delivery Person Name** (text input)
- **Vehicle Number** (text input)  
- **Receiver Signature** (use `SignaturePad` component already in `src/components/documents/SignaturePad.tsx`)
- **GST Details**: Add GST inclusive/exclusive toggle, CGST/SGST calculation per item (reuse the pattern from `InvoiceAdd.tsx`)
- **HSN Code** column in items table

**Database Migration**: Add columns to `delivery_challans`:
```sql
ALTER TABLE public.delivery_challans ADD COLUMN IF NOT EXISTS delivery_person text;
ALTER TABLE public.delivery_challans ADD COLUMN IF NOT EXISTS vehicle_number text;
ALTER TABLE public.delivery_challans ADD COLUMN IF NOT EXISTS receiver_signature text;
ALTER TABLE public.delivery_challans ADD COLUMN IF NOT EXISTS gst_inclusive boolean DEFAULT false;
ALTER TABLE public.delivery_challans ADD COLUMN IF NOT EXISTS subtotal numeric DEFAULT 0;
ALTER TABLE public.delivery_challans ADD COLUMN IF NOT EXISTS gst_amount numeric DEFAULT 0;
ALTER TABLE public.delivery_challans ADD COLUMN IF NOT EXISTS total numeric DEFAULT 0;

ALTER TABLE public.delivery_challan_items ADD COLUMN IF NOT EXISTS hsn_code text;
ALTER TABLE public.delivery_challan_items ADD COLUMN IF NOT EXISTS gst_percentage numeric DEFAULT 18;
ALTER TABLE public.delivery_challan_items ADD COLUMN IF NOT EXISTS gst_amount numeric DEFAULT 0;
```

**File: `src/pages/DeliveryChallanPreview.tsx`**: Display delivery person, vehicle number, GST breakdown, and signature image in preview. Update print layout.

---

## 4. Settings: Fix User Management Display

**File: `src/pages/Settings.tsx`** (UsersTab, line ~188)

Issue: "Kuldeep Salvi" shows as "admin" in user_roles but displays in User Management under employees context. The `UsersTab` correctly reads from `profiles` + `user_roles` and shows role. The label "admin" is correct -- the user is asking why it says "employee" somewhere.

**Fix**: In the UsersTab, also show the `employees` table entry if one exists, and display whether the user is linked to an employee record. Add an "Employee Link" column showing the employee's designation (Admin/Staff/Technician) to clarify the distinction between auth role and employee record type.

---

## 5. Dashboard Improvements

**File: `src/pages/Dashboard.tsx`**

- Add quick-action buttons below header: "New Sale" (→ /pos), "New Quotation" (→ /quotations/new), "New Invoice" (→ /invoices/new), "New Repair" (→ /job-sheets/create)
- Improve chart card titles with period selectors
- Add "Today's Sales" KPI as a prominent first card instead of Monthly Revenue

---

## 6. Sidebar Content Spacing Fix

**File: `src/components/layout/AppLayout.tsx`**

Current: `<main className="flex-1 p-4 md:p-6 md:pr-8">`

The content is too close to the sidebar on the left side. Add left padding:
```
md:p-6 md:pl-8 md:pr-8
```

This ensures equal breathing room on both sides of the content area.

---

## 7. Hikvision Integration Audit

**File: `src/pages/Settings.tsx`** (HikvisionTab)

Review the Hikvision section -- currently it has test/sync buttons. Verify:
- The "Test Connection" button calls the edge function with `action: "test"`
- "Sync Employees" calls `action: "sync-employees"`
- "Sync Attendance" calls `action: "sync-attendance"` or `action: "sync"`

Check if the edge function `hikvision-sync` properly handles these actions end-to-end. The Hikvision tab in Settings needs a status dashboard showing:
- Last sync timestamp
- Devices found count
- Employees mapped count  
- Recent sync log entries (last 5)

**File: `src/pages/Settings.tsx`** -- Enhance HikvisionTab to fetch and display `hikvision_sync_log` entries and `hikvision_devices` count as a mini-dashboard within the settings panel.

---

## Files Summary

```text
MIGRATION:  delivery_challans + delivery_challan_items columns
EDIT:       src/pages/CRM.tsx                    -- Avatar in form + table
EDIT:       src/pages/Finance.tsx                 -- KPI redesign  
EDIT:       src/pages/DeliveryChallanAdd.tsx      -- Delivery person, vehicle, GST, signature
EDIT:       src/pages/DeliveryChallanPreview.tsx   -- Display new fields
EDIT:       src/pages/Dashboard.tsx               -- Quick actions + improvements
EDIT:       src/pages/Settings.tsx                -- UsersTab clarity + Hikvision dashboard
EDIT:       src/components/layout/AppLayout.tsx   -- Left spacing fix
```

## Implementation Order
1. Database migration (delivery challan columns)
2. `AppLayout.tsx` -- spacing fix (quick win)
3. `CRM.tsx` -- avatar integration
4. `Finance.tsx` -- KPI redesign
5. `DeliveryChallanAdd.tsx` + `DeliveryChallanPreview.tsx` -- full enhancement
6. `Dashboard.tsx` -- quick actions
7. `Settings.tsx` -- UsersTab + Hikvision dashboard

