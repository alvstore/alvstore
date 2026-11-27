# Settings 2026 Redesign, Daily Cash Flow Control & Attendance-Linked Payroll Design Spec

**Date:** 2026-11-26  
**Status:** Updated with Accounting & Payroll Decisions — Ready for Design Approval  
**Approaches Approved:** Split Console `/settings` + Cash Drawer Carry-Forward & Multi-Account Auto-Sync + Configurable Working-Days Payroll with Advances Ledger  
**Skills Applied:** `using-superpowers`, `brainstorming`, `ponytail`, `ui-ux-pro-max`, `ui-styling` (adapted to MUI 9 rules in `tools/check-ui.mjs`), `taste-design`

---

## 1. Intent & Why

Three operational areas in ALVStore currently fall short of day-to-day financial, HR, and usability requirements:

1. **Settings UI/UX (`src/screens/Settings.tsx`, screenshots `test-results/settings-desktop.png`, `settings-mobile.png`):**
   - Stacks an oversized `AccountHero` banner above a 3-row boxed pill bar (`ACCOUNT | WORKSPACE | INTEGRATIONS`), which sits directly above a **duplicate** `Profile Photo` uploader inside `Personal Details & Avatar`.
   - In dark themes (`Obsidian`), an unset avatar renders as a dark low-contrast circle without clearly visible fallback initials.
   - Lacks quick filtering across 13 settings sections, live integration configuration status indicators, and refined 2026 visual hierarchy.
2. **Cash Flow & Daily Cash Control (`src/screens/Finance.tsx`, `DailyCashControl`, `FinanceTransactions`):**
   - Opening the day requires manually entering `opening_cash` rather than automatically carrying forward the prior day's `closing_cash`.
   - Core revenue/disbursement flows (`POS.tsx`, `Invoices.tsx`, `InvoicePreview.tsx`, `JobSheetDetail.tsx`, `Payments.tsx`, `PaymentRegister.tsx`, `razorpay-webhook`, and Payroll/Advances) do not automatically post entries into `finance_transactions` or reconcile `daily_cash_control` (`pos_total`, `auto_income`, `auto_expense`).
   - Cash Control manual entries (`Finance.tsx:780-817`) only increment summary counters and insert raw audit strings without creating searchable `finance_transactions` ledger rows or printable audit reports.
3. **Payroll, Working Days & Employee Advances (`src/screens/Payroll.tsx`, `Attendance.tsx`, `Payroll`):**
   - **Critical Bug:** `Attendance.tsx:79` stores `attendance_records.employee_id = emp.user_id || emp.id`, while `Payroll.tsx:58-75` looks up `attendanceCounts[emp.id]` only—causing staff with login accounts to read `0` present days.
   - Working days use raw calendar days (`getDaysInMonth`) with zero policy support (weekly offs, paid holidays, `<5h` / `"Half day"` `0.5` weighting).
   - No `employee_advances` tracking, automatic advance recovery inside monthly payroll generation, multi-month searchable history, status/role filters, finance expense synchronization, or branded ALVStore PDF payslips.

---

## 2. Locked Product Decisions (Confirmed by User)

1. **Daily Cash Control Model:** Physical Cash Drawer carry-forward (`Yesterday Closing Cash -> Today Opening Cash`) + multi-account auto-sync (`cash` transactions route to the active Cash account & Daily Cash Control sheet; `upi` / `card` / `bank_transfer` / `razorpay` route to the Bank account and appear in Finance Ledger + a non-cash channel summary without inflating physical cash-in-drawer).
2. **Automatic Financial Recording:** POS checkouts, Invoice payments, Repair/Job Sheet payments, Payments register entries, Purchase Bills, Supplier payments, Technician payouts, Payroll disbursements, Employee Advances, and Razorpay webhooks automatically create idempotent `finance_transactions` entries (`entry_source` + `source_id`) alongside manual entry support and full source filtering (`All | Auto | Manual`).
3. **Working-Days & Half-Day Payroll Policy:** Configurable store policy stored in `business_settings.integrations.payroll_policy` (mode: Exclude Weekly Offs like Sunday + Paid Holidays, Calendar Days, Fixed 26 Days, or Fixed 30 Days; `Present = 1.0d`, `Half Day = 0.5d`, `Paid Leave / Holiday = 1.0d`, `Absent = unpaid deduction`), with live preview and manual override in the Generate Slip drawer.
4. **Employee Advances & Finance Sync:** Dedicated Advances Ledger (`employee_advances` + `payroll_advance_recoveries`). Issuing an advance or marking a salary slip paid automatically posts an `"expense"` to `finance_transactions` (Cash Drawer or Bank) and pulls unrecovered advance balances into monthly payroll generation with a partial-recovery cap (`<= payable net` unless overridden).
5. **Settings 2026 Layout:** **2026 Split Console** — remove the redundant top `AccountHero` and multi-row boxed nav; use a sticky left navigation rail (`Filter settings…` search + grouped Account/Workspace/Integrations + live status dots) paired with an open hairline-divided workspace canvas on the right, a single unified Avatar & Profile identity section, and visual theme swatches in Appearance.
6. **Zero Double-Counting Revenue & Expense Rules (Confirmed):**
   - **Income Deduplication (`PaymentRegister` vs Collections):** Collection events (`POS`, `Invoices` / `InvoicePreview`, `JobSheetDetail` customer payments, `razorpay-webhook`, and standalone unlinked `Payments`) post `"income"` once into `finance_transactions` (deduped across `payment_id` / `invoice_id` / `source_id`). When `PaymentRegister` marks an entry `cleared` or `reconciled`, if linked to an already-recorded invoice/collection it skips duplicate revenue and posts **only `bank_charges` / MDR** as an `"expense"`; unlinked standalone register settlements post `net_received_amount` income (+ MDR expense if > 0).
   - **Expense Deduplication (`PurchaseBills` + `Suppliers`, `JobSheetDetail` + `Technicians`):** Confirming an unpaid Purchase Bill stops creating an immediate phantom expense on `accounts[0]` and only adds to `suppliers.outstanding_balance` (with an optional `"Paid Now"` toggle + Payment Mode & Account selector during confirm when paid on the spot, tracked via `source_id: pbill:<id>`). Otherwise supplier payments post once from `Suppliers.tsx`. Likewise, `JobSheetDetail` Technician Payout includes Payment Mode / Account, sets `technician_payments.status = "paid"`, and posts once (`source_id: techpay:<id>`) so `Technicians.tsx` never double-posts it.
   - **Transfers & Close Variances:** `Cash <-> Bank` transfers update `daily_cash_control` (bank->cash adds cash-in; cash->bank deducts cash-out). `Close Day` variances remain audited in `daily_cash_control.difference` without mutating `finance_accounts`, with an explicit `"Post Cash Variance Adjustment"` button if admin chooses to align ledger balance to counted cash.
7. **Working-Days & Leave Persistence Rule (Confirmed):** Deduct **only unpaid Absences (`absent` / `unpaid_leave`) and Half Days (`0.5d`)** — Weekly Offs (e.g., Sundays) and Paid Holidays/Paid Leaves never dock salaried employees for missing punches (`deductionDays = unpaidAbsentDays + unpaidLeaveDays + 0.5 * halfDays`, capped to basis days, `earnedBasic = round(monthlySalary - deductionDays * (monthlySalary / divisorDays))`). Upgrade `AttendanceRecords` & `Attendance.tsx` so `Present`, `Half Day`, `Paid Leave`, `Unpaid Leave`, and `Absent` are stored distinctly (replacing the prior delete-on-leave behavior).
8. **Settled Builder Calls (Marked for Review):**
   - *Pre-open Cash Events:* A cash POS sale or payout arriving before clicking `Open Day` auto-initializes today's `daily_cash_control` row cleanly with yesterday's carried-forward `closing_cash` (`status: "open"`) so counter checkout never blocks; manual `Open Day` still lets morning staff verify opening denominations first.
   - *Post-close Cash Events:* Backdated or after-hours transactions on an already-closed date post to `finance_transactions`, flag a variance notice on that date row, and never silently overwrite a closed physical cash count until admin reopens or reconciles it.
   - *Cancelling an Advance:* Blocked once `recovered_amount > 0` (`status: "partial" | "recovered"`); cancelling an unrecovered advance (`recovered_amount === 0`) automatically posts a compensating `"income"` refund `finance_transactions` row (`entry_source: "advance_refund"`) restoring the originating Cash Drawer or Bank balance.

---

## 3. Approaches Considered (`/ponytail` Discipline)

1. **Selected — Unified Backend Sync + Shared Branded PDF + Strict MUI Split Console:**
   - **Backend:** Add minimal targeted columns to `DailyCashControl`, `FinanceTransactions`, and `Payroll`, plus two normalized tables (`EmployeeAdvances`, `PayrollAdvanceRecoveries`). Add idempotent sync endpoints (`POST /api/functions/finance-sync`, `GET /api/functions/cashflow-audit-pdf`, `GET /api/functions/payroll-pdf`) reusing the existing `pdf-lib` builder (`server/src/lib/document-pdf.ts`) and DB trigger (`server/prisma/runtime.sql`) so cash drawer math stays consistent regardless of which screen writes a transaction.
   - **Frontend:** Pure pure-function calculators (`src/lib/payroll-calculator.ts`, `src/lib/finance-sync.ts`) paired with clean upgrades to `Settings.tsx`, `Finance.tsx`, `Payroll.tsx`, and `AvatarUpload.tsx` using existing `@/components/mui/*` primitives.
   - **Tradeoff:** Minimal schema diff (`db push`), zero new npm packages, zero drift between Ledger and Cash Drawer.
2. **Rejected — Frontend-only per-screen ledger patches + client HTML printing:**
   - Leaves race conditions / duplicate entries across screens, keeps `daily_cash_control` disconnected from `finance_transactions`, and continues unbranded `window.open` HTML popups.
3. **Rejected — Heavy third-party accounting / Tailwind UI rewrite:**
   - Violates `tools/check-ui.mjs` (enforces `@mui/material` + `@/components/mui` and forbids Tailwind/`className`/`@radix-ui`), breaks theme switching across the 7 palettes, and adds bloat.

---

## 4. Non-Goals & Technical Constraints

- **UI Guardrails (`tools/check-ui.mjs`):** All screens and components must use `@mui/material` + `@/components/mui/*` only (zero Tailwind classes, zero `@radix-ui`, zero raw HTML elements in `src/screens` or `src/components`). Numeric columns and KPI figures use `fontVariantNumeric: "tabular-nums"`.
- **Route & E2E Stability Contracts (`tests/e2e/app.spec.mjs`, `tests/e2e/settings-profile.spec.mjs`, `tests/platform-pos-repair.test.mjs`):**
  - Keep existing `/finance` `<Tab>` labels (`Dashboard`, `Income`, `Expenses`, `Transfers`, `Accounts`, `Categories`, `Ledger`, `Cash Control`, `Audit Log`).
  - Keep existing `/settings` section button exact accessible names (`Profile`, `Appearance`, `Business Info`, `User Management`, `GST Settings`, `Document Settings`, `Service Categories`, `Templates`, `Email / SMTP`, `SMS Gateway`, `WhatsApp`, `Razorpay`, `Hikvision`), `Upload avatar for ...` button label, `Upload Photo`/`Change Photo`, `Remove Photo`, `Console Color Palette`, `Compact Navigation Sidebar`, `Upload Logo`, `Add User` -> `Add Team Member`, `Save & Send Test Email`, and `refreshUserMetadata()` sync.
- **Role Security (`server/src/routes/data.ts`):** `employee_advances` and `payroll_advance_recoveries` require `["admin"]` for writes (matching `payroll` and `finance_audit_log`). Server sync endpoints use parameterized SQL via `pool.query`.
- **Non-Goals:** No automated external bank feeds / Open Banking APIs, no statutory PF/ESIC tax filing engine (simple custom deduction fields cover statutory deductions when needed), no automated salary disbursement via Razorpay payouts API.

---

## 5. Module 1 — Settings 2026 Split Console (`src/screens/Settings.tsx`, `src/components/AvatarUpload.tsx`)

### 5.1 Layout & Visual Architecture
- **Page Header Only:** Compact `PageHeader` (`Settings`, subtitle `"Account preferences, workspace identity, tax rules, and connected services"`, right-aligned subtle signed-in identity pill showing compact avatar, display name, and current theme name). **Remove `AccountHero`** entirely so no duplicate hero card sits above the content.
- **Split Workspace Grid (`>= md`):**
  - **Left Rail (`248px` sticky column, `top: 24px`):**
    - Compact search filter input (`Placeholder: "Filter settings..."`, ESC to clear) filtering the 13 sections by title or keywords (e.g., typing `"smtp"`, `"logo"`, `"gst"`, `"hikvision"`, `"theme"`).
    - Three tight navigation groups (`ACCOUNT`, `WORKSPACE`, `INTEGRATIONS`) with `11px` uppercase tracked labels (`letterSpacing: "0.08em"`).
    - Each nav item is a `<Button>` / list button preserving exact accessible names (`Profile`, `Appearance`, etc.) with left `3px` active indicator pill, icon, label, and a compact status indicator dot (`8px`):
      - Active / configured services (e.g. SMTP host present, WhatsApp phone ID set, Razorpay key saved, active Hikvision devices) show a subtle `success.main` indicator dot.
  - **Responsive Mobile (`< md`):** Single sticky horizontally scrollable segmented group bar (or compact section selector chips) directly under `PageHeader` with `0px` horizontal page overflow at `390px` viewport width.
  - **Right Detail Canvas (`minmax(0, 1fr)`, maxWidth `880px`):**
    - Avoid boxed cards stacked inside cards. Present a clean single surface (`Paper` or clean hairline-bordered surface) with **hairline dividers** (`1px solid divider`), clear section heading + subtitle + live health/completion badge at top, and generous `24px–32px` vertical spacing between open form groups.

### 5.2 Section Upgrades
- **`Profile` (Unified Identity & Password):**
  - Fix blank avatar contrast bug in `AvatarUpload.tsx` / `Profile` panel: fallback initials use explicit `bgcolor: alpha(theme.palette.primary.main, 0.16)`, `color: theme.palette.primary.main`, subtle `1px solid alpha(primary, 0.3)` border so initials (`AA`) are always crisp on Obsidian and all 6 other palettes.
  - Single unified Profile Photo row (`AvatarUpload` with hover camera badge + `Upload Photo`/`Change Photo` button + `Remove Photo` button) — zero duplicate upload block.
  - Hairline-separated `Identity Details` (Account Email read-only, Full Name, Phone Number + explicit `Save Profile`) and `Password & Security` (`New Password`, `Confirm New Password` with visibility toggle + `Update Password`).
- **`Appearance` (Theme Swatches & Workspace Density):**
  - 7-theme visual swatch grid (`Obsidian`, `Forest`, `Ocean Deep`, `Sunset Ember`, `Arctic`, `Midnight Rose`, `Donezo`) displaying a tiny mini-preview of each palette's background, card surface, sidebar tint, and primary accent bar + Dark/Light badge + crisp active ring (`accessible` label matches theme name).
  - Clean hairline toggle rows (`Compact Navigation Sidebar` switch verified at `88px`/`288px`).
- **Remaining 11 Workspace & Integration Panels:** Clean hairline-grouped forms preserving every existing field, Drawer (`Add Team Member`), `Upload Logo`, `Save & Send Test Email`, and Hikvision webhook/sync/backfill/mock-punch controls.

---

## 6. Module 2 — Cash Flow Management & Daily Cash Control (`Finance.tsx`, Backend Sync & Reports)

### 6.1 Schema Changes (`server/prisma/schema.prisma`, `server/prisma/runtime.sql`)
- **`DailyCashControl` additions:**
  - `previous_closing Decimal? @db.Decimal` — snapshot of prior day's closing balance carried in.
  - `auto_income Decimal? @default(dbgenerated("0")) @db.Decimal` — summed automatic cash inflows (`invoices`, `payments`, `repairs`, excluding POS if tracked in `pos_total`).
  - `auto_expense Decimal? @default(dbgenerated("0")) @db.Decimal` — summed automatic cash outflows (`purchase_bills`, `suppliers`, `technicians`, `payroll`, `advances`).
  - `transfer_in Decimal? @default(dbgenerated("0")) @db.Decimal` — cash transfers received into Cash Drawer from Bank accounts.
  - `transfer_out Decimal? @default(dbgenerated("0")) @db.Decimal` — cash transfers deposited from Cash Drawer to Bank accounts.
  - `opening_override_reason String?` — required if staff overrides carried-forward `previous_closing`.
  - `reopened_at DateTime? @db.Timestamptz(6)` & `reopened_by String? @db.Uuid` — audit metadata when an admin reopens a closed day.
- **`FinanceTransactions` additions:**
  - `entry_source String @default(dbgenerated("'manual'::text"))` — values: `'manual' | 'pos' | 'invoice' | 'payment' | 'payment_register' | 'repair' | 'purchase_bill' | 'supplier' | 'technician' | 'payroll' | 'advance' | 'advance_refund' | 'razorpay'`.
  - `source_id String?` — referenced entity ID (plus payment sequence where partial payments occur, e.g. `inv:<id>:<tx_or_ts>` or `pos:<id>`, `pay:<id>`, `payroll:<id>`, `adv:<id>`). Partial unique index `CREATE UNIQUE INDEX idx_fin_tx_source_unique ON public.finance_transactions (entry_source, source_id) WHERE source_id IS NOT NULL;` guarantees zero duplicate ledger postings.
  - `daily_cash_date DateTime? @db.Date` — populated whenever transaction hits a `cash` account / `payment_mode = 'cash'`.
- **PostgreSQL Reconciliation Trigger / Helper (`runtime.sql` + `functions.ts`):**
  - Add helper `syncDailyCashForDate(date, actor)` (and trigger guard / SQL upsert on `cash` transactions):
    - Ensures a `daily_cash_control` row exists or recalculates aggregates for open days (`pos_total` from `entry_source = 'pos'`, `auto_income` from `type = 'income' AND entry_source NOT IN ('manual','pos')`, `manual_income` from `type = 'income' AND entry_source = 'manual'`, `auto_expense` from `type = 'expense' AND entry_source != 'manual'`, `manual_expense` from `type = 'expense' AND entry_source = 'manual'`, plus `transfer_in` and `transfer_out` for `Cash <-> Bank` transfers -> `expected_closing = opening_cash + pos_total + auto_income + manual_income + transfer_in - auto_expense - manual_expense - transfer_out`; legacy standalone cash rows without backing transactions remain preserved cleanly).
    - **Builder Rule:** Manual cash entries from `CashControlTab` always insert real `finance_transactions` rows (`entry_source = 'manual'`, `payment_mode = 'cash'`, `daily_cash_date = targetDate`) linked to the active Cash account so `Ledger`, `Income`, `Expenses`, `Cash Control`, and `FinanceAuditLog` share one source of truth.

### 6.2 Auto-Recording Endpoints & Client Integration
- **Unified Endpoint (`POST /api/functions/finance-sync`, auth required):**
  - Accepts `{ entry_source, source_id, type: "income" | "expense", amount, date, payment_mode, account_id?, category_name?, reference?, description?, customer_id?, staff_name? }`.
  - Runs idempotently inside a transaction: resolves `account_id` (matching account if provided, else first active `cash` account for `"cash"`, else first active `bank` account; creates default `"Cash Drawer"` or `"Primary Bank"` if none exist), resolves matching `finance_categories` row by name/type, inserts into `finance_transactions` (falling back safely on `source_id` conflict), and updates/recomputes `daily_cash_control` totals for `daily_cash_date` when cash is involved.
- **Wired Entry Points (via thin client helper `src/lib/finance-sync.ts`):**
  1. `POS.tsx` checkout (`entry_source: "pos"`, `source_id: "pos:" + txn.id`, category `"POS Sales"`)
  2. `Invoices.tsx` & `InvoicePreview.tsx` payment recording (`entry_source: "invoice"`, selectable payment mode `cash | upi | card | bank_transfer`, `source_id: "inv:" + id + ":" + timestamp_or_seq`, category `"Invoice Sales"`)
  3. `JobSheetDetail.tsx` customer payment (`entry_source: "repair"`, category `"Repair Income"`) & technician payout (via shared `techpay:<id>`)
  4. `server/src/routes/functions.ts` (`razorpay-webhook` directly posts bank `"income"` with `entry_source: "razorpay"`, `source_id: "rzp:" + payment.id`, category `"Invoice Sales"`)
  5. `PurchaseBills.tsx` & `Suppliers.tsx`: Remove automatic phantom expense insert on `unpaid` Purchase Bill confirmation; add optional `"Paid Now"` mode/account selector on confirmation (`source_id: "pbill:" + bill.id`) while `Suppliers.tsx` posts on actual vendor payment (`source_id: "suppay:" + id_or_ts`).
  6. `JobSheetDetail.tsx` & `Technicians.tsx`: `JobSheetDetail.tsx` records technician payout with account/mode, inserts `technician_payments` as `"paid"`, and posts once via shared `source_id: "techpay:" + tp.id` (`Technicians.tsx` skips already-synced payouts and syncs remaining unpaid ones with `"techpay:" + p.id`).
  7. `PaymentRegister.tsx` & `Payments.tsx`: Linked invoice settlements post **only** `bank_charges` / MDR as `"expense"` (`source_id: "preg-fee:" + id`); standalone unlinked `PaymentRegister` / `Payments` collections post `"income"` once without duplicating linked Invoice / Razorpay / JobSheet receipts.
  8. `Transfers` (`Finance.tsx`): `Cash <-> Bank` transfers update `daily_cash_control` net cash movement (`transfer_in` / `transfer_out` rolled into `expected_closing`) so depositing drawer cash to bank or withdrawing petty float stays reconciled.
  9. `Payroll.tsx`: Advance disbursement (`entry_source: "advance"`), advance cancellation refund (`entry_source: "advance_refund"`), and salary disbursement (`entry_source: "payroll"`, category `"Salary"`).

### 6.3 Closing -> Next-Day Opening Carry-Forward & Cash Flow UI (`Finance.tsx`)
- **Opening Balance Carry-Forward:**
  - `Open Day` automatically queries the latest previous `daily_cash_control` row (`date < todayStr`):
    - If previous row is `closed` with `closing_cash != null`: `opening_cash` defaults cleanly to `prev.closing_cash` with a `"Carried Forward from <Date>"` banner. Editing it reveals a required `Override Reason` field logged in `opening_override_reason` and `finance_audit_log`.
    - If previous row is still `open`: warns the user clearly with a one-click action to close that day first or carry its `expected_closing`.
    - Supports `opening_cash === 0` gracefully (fixing the current `if (oc <= 0)` blocker when starting with ₹0 float!).
- **Cash Control & Flow Redesign (`/finance` `Cash Control` tab):**
  - **KPI & Balance Strip:** Day Status chip, **Opening Cash** (+ carry-forward source caption), **Cash Inflows** (`POS Cash + Auto + Manual`), **Cash Outflows** (`Auto Bills/Payroll/Advances + Manual`), **Expected Closing**, **Actual Counted Closing & Variance**, plus compact Bank / UPI Today inflow/outflow summary badges.
  - **Search & Multi-Filter Bar:** Search across date, reference, description, staff, ID; Filter pills/selects for Date Range (`Today`, `7 Days`, `This Month`, `Custom Range` from–to), Entry Source (`All`, `Auto`, `Manual`), Channel (`All`, `Cash Drawer`, `Bank / UPI`), Status (`All`, `Open`, `Closed`).
  - **Expandable Day Ledger & Audit Drawer:** Selecting any date row opens a clean SideDrawer listing the exact Opening Balance -> itemized Cash Inflows & Outflows (auto-linked + manual) -> Denomination count table -> Expected vs Counted Variance -> Notes -> Finance Audit Log entries for that date.
  - **Reopen Closed Day (Admin audit-logged):** Allows correcting a closed day via `SideDrawer` with mandatory reason recorded to `finance_audit_log`.
  - **Cash Flow & Reconciliation Audit Report (`GET /api/functions/cashflow-audit-pdf` + CSV export):** Uses the reusable branded ALVStore A4 `pdf-lib` engine to generate an executive **Daily & Period Cash Flow Audit Report** (Opening -> Auto/Manual Income -> Auto/Manual Expense -> Expected Closing -> Actual Counted Closing -> Variance -> Channel Breakdown & Staff Trail), directly printable or downloadable.

---

## 7. Module 3 — Attendance-Linked Payroll, Working Days & Advances Ledger (`Payroll.tsx`, `Attendance.tsx`, Backend)

### 7.1 Schema Changes (`server/prisma/schema.prisma`, `server/src/routes/data.ts`)
- **`EmployeeAdvances` (`employee_advances`):**
  - `id`, `advance_number` (prefix `ADV-`), `employee_id` (`Employees.id` cascade), `amount`, `recovered_amount` (default `0`), `remaining_amount`, `advance_date` (`@db.Date`), `payment_mode`, `account_id` (nullable `UUID`), `status` (`active | partial | recovered | cancelled`), `reason`, `notes`, `finance_transaction_id` (nullable `UUID`), `staff_name`, `created_by`, `created_at`.
- **`PayrollAdvanceRecoveries` (`payroll_advance_recoveries`):**
  - `id`, `payroll_id` (`Payroll.id` cascade), `advance_id` (`EmployeeAdvances.id` cascade), `amount_recovered`, `created_at`.
- **`Payroll` extensions (`payroll`):**
  - `slip_number String?`, `working_days Decimal?`, `present_days Decimal?`, `half_days Int? @default(0)`, `leave_days Decimal? @default(0)`, `absent_days Decimal? @default(0)`, `overtime_hours Decimal? @default(0)`, `gross_salary Decimal?`, `advance_deduction Decimal? @default(0)`, `other_deductions Decimal? @default(0)`, `payment_mode String?`, `account_id String? @db.Uuid`, `finance_transaction_id String? @db.Uuid`, `policy_snapshot Json? @db.JsonB`.
- **RBAC (`server/src/routes/data.ts`):** Protect `employee_advances` and `payroll_advance_recoveries` under `WRITE_ROLES` as `["admin"]`.

### 7.2 Working-Days, Attendance Unification & Pure Payroll Calculator (`src/lib/payroll-calculator.ts`)
- **Schema (`AttendanceRecords`):** Add `status String @default(dbgenerated("'present'::text"))` (`present | half_day | paid_leave | unpaid_leave | absent`) to `AttendanceRecords` (`server/prisma/schema.prisma`), backfilling existing rows safely via `notes` / duration (`Half day` -> `half_day`, else `present`).
- **Update `src/screens/Attendance.tsx` (`AdminDailyTab`, `WeeklyViewTab`, `CalendarViewTab`, `MonthlyReportTab`):** Persist `paid_leave` and `unpaid_leave` rows explicitly (instead of deleting leave rows alongside `absent`), and reflect paid leave vs unpaid leave vs absent cleanly across daily marking, calendar pills, and CSV report.
- **Fix Attendance ↔ Employee Matching Bug:** Always resolve an employee's attendance records across BOTH `emp.id` and `emp.user_id` (`matchesEmployeeRecord(emp, record.employee_id)`).
- **Half-Day Classification:** Mark a day `0.5` when `record.status === "half_day"` OR `record.notes?.toLowerCase().includes("half day")` OR `(check_in && check_out)` worked duration `< policy.half_day_hours_threshold` (default `5` hours).
- **Configurable Policy (`business_settings.integrations.payroll_policy`):**
  - Editable from an inline **"Working Days Policy"** `SideDrawer` right on `/payroll` (weekly off days e.g. Sunday, calculation mode `'exclude_weekly_off' | 'calendar_days' | 'fixed_26' | 'fixed_30'`, paid holidays list for month, half-day hour threshold, auto-deduct active advances toggle).
  - Pure function `calculateEmployeePayroll(...)` evaluates calendar dates for the month, filters out configured weekly offs & paid holidays so unpunched weekly offs/holidays are never treated as absences, counts `presentDays`, `halfDays`, `paidLeaveDays`, `unpaidLeaveDays`, `unmarkedWorkdaysAbsent`, computes `deductionDays = unpaidLeaveDays + unmarkedWorkdaysAbsent + halfDays * 0.5`, computes `perDayRate = monthlySalary / divisorDays`, and outputs:
    - `scheduledWorkingDays`, `presentDays`, `halfDays`, `paidLeaveDays`, `absentDays` (`unpaidLeaveDays + unmarkedWorkdaysAbsent`), `paidDays` (`max(0, divisorDays - deductionDays)`), `perDayRate`
    - `earnedBasic` (`Math.max(0, Math.round(monthlySalary - deductionDays * perDayRate))`, overridable in Generate Slip drawer!)
    - `availableAdvanceBalance` & recommended `advanceDeduction` (`min(availableAdvanceBalance, max(0, earnedBasic + bonus - otherDeductions))`)
    - `netSalary = Math.max(0, earnedBasic + bonus - otherDeductions - advanceDeduction)`

### 7.3 Payroll Workspace Upgrade (`src/screens/Payroll.tsx`) & Branded PDF Payslip
- **Three Structured Tabs (`TabView`):**
  1. **`Monthly Run`:**
     - Top controls: Month selector (`YYYY-MM`), `SearchToolbar` (search employee name / role / slip #), Filters (`Role`, `Status`: All / Not Generated / Pending / Paid), **"Working Days Policy"** button, **"Generate All Pending"** batch button.
     - 4-card Metric Strip (`Total Payable`, `Paid`, `Pending`, `Advances Adjusted`).
     - High-clarity DataTable with tabular figures: `Employee`, `Role`, `Working / Present / Half / Absent`, `Base Salary`, `Earned Basic`, `Advances Adj.`, `Bonus / Other`, `Net Payable`, `Status`, `Actions` (`Generate`, `Edit Draft`, `Mark Paid`, `Print / PDF Slip`).
     - `Generate / Edit Slip` `SideDrawer`: shows attendance breakdown (`Present`, `Half Days`, `Absent`, `Working Days`, `Per-Day Rate`), active unrecovered advances list with auto-fill deduction amount, bonus/other deductions, payment account selection when marking paid, and live net salary preview.
     - **Marking Paid (`Mark Paid` Drawer/Confirm):** Chooses Payment Mode (`cash | bank_transfer | upi`) + Finance Account, persists `payroll_advance_recoveries` & updates `employee_advances.recovered_amount` / `remaining_amount` / `status`, posts `"expense"` via `finance-sync` (`entry_source: "payroll"`), updates `daily_cash_control` if Cash, and writes `system_audit_log`.
  2. **`Advances Ledger`:**
     - `SearchToolbar` + filters (Employee, Status: `All | Active | Partial | Recovered | Cancelled`, Date From–To) + CSV export.
     - Metric Strip (`Total Disbursed`, `Recovered`, `Active Outstanding`, `Employees with Advances`).
     - `Issue Advance` `SideDrawer`: Employee, Amount, Date, Payment Mode + Account (`Cash Drawer` / Bank), Reason & Notes -> creates `employee_advances` row (`ADV-xxxxx`) and posts `finance-sync` expense (`entry_source: "advance"`) immediately so cash/bank balance & daily cash sheet reflect cash leaving the drawer that day!
     - Expandable/drawer history showing original advance, amount recovered per payroll month, and remaining balance.
  3. **`Salary History`:**
     - Multi-month full payroll & salary archive across all months: filter by Month From–To, Employee search, Status (`Pending | Paid`), Payment Mode, Export CSV, and one-click Branded PDF Payslip.
- **Branded ALVStore PDF Payslip (`GET /api/functions/payroll-pdf?id=<uuid>`):**
  - Replaces legacy `window.open` `"ORIGINAL COPY — DO NOT ALTER"` popup with ALVStore Obsidian/Brass A4 `pdf-lib` Payslip containing company header, employee info, attendance & working-days summary table (`Scheduled Working Days`, `Present`, `Half Days`, `Absent`, `Per-Day Rate`), Earnings & Deductions table (with Advance Recovery itemized), Net Payable + payment account/date/mode, and authorized footer.

---

## 8. Verification Plan

1. **Automated Unit & Contract Checks (`tests/`):**
   - Pure unit tests (`tests/payroll-calculator.test.mjs`) covering: attendance lookup by both `emp.id` and `emp.user_id`, half-day duration/notes math, weekly-off working-day calculation (`exclude_weekly_off`, `fixed_26`, `calendar_days`), advance balance recovery capping, and `opening_cash` carry-forward chain edge cases.
   - Code UI hygiene check (`npm run check:ui` / `tools/check-ui.mjs`) + TypeScript build (`npm run build` / `server` typecheck).
   - API / DB integration checks verifying Prisma schema push (`db:push` + `prisma:generate`), RBAC on `employee_advances`, `POST /api/functions/finance-sync` idempotency, `daily_cash_control` closing->opening carry-forward, and `GET /api/functions/payroll-pdf` + `GET /api/functions/cashflow-audit-pdf` returning valid `%PDF` buffers.
2. **Playwright End-to-End & Visual Inspection (`tests/e2e/`):**
   - Run existing `tests/e2e/settings-profile.spec.mjs` and `tests/e2e/app.spec.mjs` + new E2E assertions for Cash Control carry-forward, manual + POS auto-sync, Advance issuance + Payroll calculation + Mark Paid finance sync, and visually inspect screenshots across Obsidian (Dark) + Forest (Light) + `390px` Mobile!
