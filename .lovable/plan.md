

# Phase 8: Advanced Finance Module -- Daily Finance Control System

This phase introduces a full financial control system with income/expense tracking, account management, transfers, daily cash control, and audit logging -- all while keeping the existing `payments` table for POS/invoice payments.

---

## 1. Database Schema

### New Tables

**`finance_accounts`** -- Bank, Cash, UPI, and Gateway accounts

| Column | Type | Default |
|--------|------|---------|
| id | UUID PK | gen_random_uuid() |
| name | TEXT NOT NULL | |
| type | TEXT NOT NULL | 'cash' (cash/bank/upi/gateway) |
| account_number | TEXT | |
| bank_name | TEXT | |
| opening_balance | NUMERIC | 0 |
| current_balance | NUMERIC | 0 |
| status | TEXT | 'active' |
| created_by | UUID | |
| created_at | TIMESTAMPTZ | now() |
| updated_at | TIMESTAMPTZ | now() |

**`finance_categories`** -- Income and Expense categories

| Column | Type | Default |
|--------|------|---------|
| id | UUID PK | gen_random_uuid() |
| name | TEXT NOT NULL | |
| type | TEXT NOT NULL | (income/expense) |
| status | TEXT | 'active' |
| created_at | TIMESTAMPTZ | now() |

Seed with default categories: POS Sales, Repair Income, Service Income, Other Income, Salary, Rent, Purchase, Utilities, Maintenance, Misc Expense.

**`finance_transactions`** -- All income, expense, and transfer entries

| Column | Type | Default |
|--------|------|---------|
| id | UUID PK | gen_random_uuid() |
| transaction_id | TEXT | auto-generated (FIN-NNNNN) |
| type | TEXT NOT NULL | (income/expense/transfer) |
| date | DATE | CURRENT_DATE |
| amount | NUMERIC NOT NULL | |
| payment_mode | TEXT | (cash/bank/upi/card/gateway) |
| account_id | UUID FK finance_accounts | |
| to_account_id | UUID FK finance_accounts | (for transfers) |
| category_id | UUID FK finance_categories | |
| customer_id | UUID FK customers | nullable |
| reference | TEXT | (invoice/job sheet number) |
| description | TEXT | |
| attachment_url | TEXT | |
| balance_after | NUMERIC | |
| created_by | UUID | |
| staff_name | TEXT | (denormalized for audit) |
| created_at | TIMESTAMPTZ | now() |

**`finance_audit_log`** -- Immutable audit trail for all finance actions

| Column | Type | Default |
|--------|------|---------|
| id | UUID PK | gen_random_uuid() |
| action | TEXT NOT NULL | |
| entity_type | TEXT | (transaction/account/category) |
| entity_id | UUID | |
| details | TEXT | |
| staff_name | TEXT | |
| user_id | UUID | |
| user_role | TEXT | |
| ip_address | TEXT | |
| created_at | TIMESTAMPTZ | now() |

**`daily_cash_control`** -- Daily opening/closing cash tracking

| Column | Type | Default |
|--------|------|---------|
| id | UUID PK | gen_random_uuid() |
| date | DATE UNIQUE | |
| opening_cash | NUMERIC | 0 |
| closing_cash | NUMERIC | |
| difference | NUMERIC | |
| staff_name | TEXT | |
| created_by | UUID | |
| created_at | TIMESTAMPTZ | now() |

### Triggers

- `generate_finance_transaction_id()`: auto-generates `FIN-00001` format
- `update_account_balance_on_transaction()`: on INSERT to `finance_transactions`, adjusts `finance_accounts.current_balance` (add for income, subtract for expense, both for transfer)
- `log_finance_action()`: on INSERT to `finance_transactions`, auto-creates audit log entry

### RLS Policies

- Admin: full access on all finance tables
- Staff: SELECT, INSERT on transactions, accounts, categories; SELECT on audit log
- Audit log: INSERT only, no UPDATE/DELETE for anyone

---

## 2. Frontend Pages

### New Page: `src/pages/Finance.tsx`
A tabbed finance hub with sub-tabs:

**Tab: Dashboard**
- KPI cards: Cash Balance, Bank Balance, Today Income, Today Expense, Monthly Income, Monthly Expense, Net Balance
- Charts: Daily cash flow (7 days), Income vs Expense bar chart, Category breakdown pie chart

**Tab: Income**
- Table of income entries with search, date filter
- Slide-over form to create income entry with all fields (date, amount, payment mode, account, category, customer, reference, description, attachment)
- Staff name auto-captured from logged-in user profile

**Tab: Expenses**
- Same layout as Income but for expense entries
- Vendor field instead of customer

**Tab: Transfers**
- Table of transfer records
- Slide-over form: From Account, To Account, Amount, Date, Description

**Tab: Accounts**
- Table of all accounts with current balances
- Slide-over form to create/edit accounts

**Tab: Categories**
- Two-column layout: Income categories and Expense categories
- Inline add with type toggle

**Tab: Ledger**
- Full chronological transaction list with running balance
- Columns: Date, Transaction ID, Type, Category, Account, Amount, Staff, Reference, Balance
- Search, filter by type/account/date range, export (CSV)

**Tab: Cash Control**
- Daily opening/closing cash entry form
- History table showing daily records with variance

**Tab: Audit Log**
- Read-only table of all finance audit entries
- Filter by action type, date range

---

## 3. Sidebar Update

Replace the single "Payments" item in the OPERATIONS category with "Finance" pointing to `/finance`. The old `/payments` route will redirect to `/finance`.

```
OPERATIONS
  Attendance
  Finance        <-- replaces "Payments"
  Reports
```

---

## 4. Route Changes in App.tsx

- Add `/finance` route pointing to `Finance.tsx`
- Keep `/payments` as a redirect to `/finance` for backward compatibility

---

## 5. Integration with Existing Data

- The existing `payments` table remains untouched for POS and invoice payment records
- The Finance Dashboard KPIs will aggregate data from both `finance_transactions` AND `payments` tables to give a complete picture
- When a POS sale or invoice payment is recorded, staff can optionally create a corresponding finance income entry to keep the finance ledger in sync

---

## Technical Summary

### Database Migration
- Create 5 new tables: `finance_accounts`, `finance_categories`, `finance_transactions`, `finance_audit_log`, `daily_cash_control`
- Create 3 triggers for auto-numbering, balance updates, and audit logging
- Seed default categories
- RLS policies for admin/staff access

### New Files
- `src/pages/Finance.tsx` -- main finance module with all tabs

### Modified Files
- `src/App.tsx` -- add `/finance` route
- `src/components/layout/AppSidebar.tsx` -- replace Payments with Finance in OPERATIONS

### No New Dependencies
- Uses existing UI components (Tabs, Sheet, Table, Charts from recharts)

