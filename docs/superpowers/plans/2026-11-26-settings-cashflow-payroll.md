# Settings 2026 Redesign, Cash Flow Control & Payroll Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a 2026 Split Console redesign of `/settings`, an idempotent automated+manual Cash Flow & Daily Closing/Next-Day Opening Carry-Forward system across Finance and billing/payout screens, and an attendance-linked Working-Days Payroll & Employee Advances system with branded ALVStore A4 PDF reports.

**Architecture:** Extend existing Prisma models (`DailyCashControl`, `FinanceTransactions`, `Payroll`, `AttendanceRecords`) and add two normalized admin-protected tables (`EmployeeAdvances`, `PayrollAdvanceRecoveries`), keeping PostgreSQL runtime triggers clean for account balance integrity (`INSERT`/`UPDATE`/`DELETE`) while handling idempotent multi-channel routing (`cash` vs `bank`), cash drawer daily carry-forward/recomputation, working-days payroll calculation, and `pdf-lib` A4 reporting in focused, shared TypeScript libraries. On the frontend, keep every screen compliant with `@mui/material` + `@/components/mui/*` (`tools/check-ui.mjs`) and preserve existing Playwright E2E selectors and dark/light 7-theme parity.

**Tech Stack:** Next.js 15, React 19, MUI 9, Express, Prisma 6, PostgreSQL, `pdf-lib`, Node test runner (`node --test` / `tsx --test`), Playwright.

**Spec:** [2026-11-26-settings-cashflow-payroll-design.md](file:///Users/rajat/Downloads/alvstore/docs/superpowers/specs/2026-11-26-settings-cashflow-payroll-design.md)

## Global Constraints

- `tools/check-ui.mjs` (`npm run check:ui`): `@mui/material` + `@/components/mui/*` only; zero Tailwind classes, `className` utilities, `@radix-ui`, or raw HTML tags inside `src/screens` and `src/components`.
- `tests/database-contract.test.mjs`: `server/prisma/runtime.sql` MUST NEVER contain `CREATE TABLE`, `CREATE TYPE`, or `auth.uid(`; `server/src/generated/schema-meta.json` MUST match every `@@schema("public")` model cleanly.
- Cash Drawer Carry-Forward & Immutability: Closed `daily_cash_control` days are never silently overwritten by late/backdated transactions; open days recompute deterministically from real `finance_transactions` rows; ₹0 opening float and ₹0 closing float are valid.
- Zero Double-Counting: Invoices/POS/Repairs/Razorpay post income once; linked `PaymentRegister` settlements post MDR fees only; `PurchaseBills` posts expense only when paid now (or later via `Suppliers`); `JobSheetDetail` tech payout shares `techpay:<id>` with `Technicians`.
- Existing E2E Contracts (`tests/e2e/app.spec.mjs`, `tests/e2e/settings-profile.spec.mjs`, `tests/platform-pos-repair.test.mjs`): Keep exact `/finance` tab labels, exact `/settings` section button labels, `Upload avatar for ...`, `Upload Photo`/`Change Photo`, `Remove Photo`, `Console Color Palette`, `Compact Navigation Sidebar`, `Upload Logo`, `Add User`/`Add Team Member`, `Save & Send Test Email`, and `refreshUserMetadata()`.

## Review Focus

1. **Duplicate / Replay Submissions:** Rapid double-click or webhook retry on `POS`, `Invoices`, `PurchaseBills`, `Payroll`, `Advances`, or `Razorpay` — pinned by `(entry_source, source_id)` unique index + atomic idempotency tests in `server/tests/finance-sync.test.ts`.
2. **Closed-Day & Pre-Open Cash Events:** POS cash sale before `Open Day`, and backdated/after-hours expense hitting an already-`closed` day — pinned by `cashControlStateMachine` tests verifying auto-open carry-forward vs closed-day immutability + alert flagging.
3. **Carry-Forward Chain Breakage & TZ Shifts:** IST vs UTC date boundary (`yyyy-MM-dd`) and mismatched `opening_cash !== prev.closing_cash` — pinned by pure carry-forward/chain-audit unit tests using ISO date strings.
4. **Attendance Employee Key Mismatch & Leave vs Weekly Off Salary Math:** `attendance_records.employee_id` matching either `emp.id` or `emp.user_id`, half-days (`<5h` or `"Half day"` / `"half_day"`), paid holidays vs Sundays vs unpaid absences — pinned by `tests/payroll-calculator.test.mjs`.
5. **Cancelled Disbursed Advances & Partial Recovery Cap:** Blocking cancellation when `recovered_amount > 0`, posting compensating `advance_refund` income when unrecovered, and capping advance deductions cleanly at payable salary — pinned by unit & backend tests.

---

## File Structure

- **Schema & Database Runtime:**
  - Modify: `server/prisma/schema.prisma` (extend `AttendanceRecords`, `DailyCashControl`, `FinanceTransactions`, `Payroll`; add `EmployeeAdvances`, `PayrollAdvanceRecoveries`, relations on `Employees` & `FinanceAccounts`)
  - Modify: `server/prisma/runtime.sql` (update `update_account_balance_on_transaction` trigger to handle `INSERT`, `UPDATE`, `DELETE`; add `ADV-` sequence generator or helper)
  - Regenerate: `server/src/generated/schema-meta.json` (`npm --prefix server run prisma:generate`)
  - Modify: `server/src/routes/data.ts` (add `employee_advances: ["admin"]`, `payroll_advance_recoveries: ["admin"]` to `WRITE_ROLES`)
  - Modify: `tests/database-contract.test.mjs` & `server/tests/schema-parity.test.ts` (update table count `65 -> 67` & assert new fields)
- **Backend Cash Flow & Payroll Engine:**
  - Create: `server/src/lib/finance-sync.ts` (pure helpers + DB transaction orchestrator: account/category resolution, idempotent `recordFinanceSync`, `recomputeOpenCashDay`, `getCashControlContext` with carry-forward & chain audit, `auditCarryForwardChain`)
  - Create: `server/src/lib/report-pdf.ts` (reusable ALVStore branded A4 `pdf-lib` generator for `Cash Flow Audit Report` & `Employee Salary Slip`)
  - Modify: `server/src/routes/functions.ts` (wire `POST /finance-sync`, `GET /cash-control-context`, `POST /cash-control-recompute`, `GET /cashflow-audit-pdf`, `GET /payroll-pdf`, `POST /payroll-settle`, `POST /employee-advance-issue`, `POST /employee-advance-cancel`, plus update `razorpay-webhook` to call `recordFinanceSync`)
  - Create: `server/tests/finance-sync.test.ts` (unit tests for carry-forward math, chain gap detection, transfer cash-drawer effect, payment-mode routing, idempotency, advance recovery math, and branded PDF output `%PDF-`)
- **Frontend Shared Modules & UI:**
  - Create: `src/lib/payroll-calculator.ts` (pure working-days, attendance matching by `id | user_id`, leave/half-day classification, per-day rate, bonus/deduction, advance recovery allocation, default policy presets)
  - Create: `tests/payroll-calculator.test.mjs` (thorough unit tests covering every Review Focus payroll edge case)
  - Create: `src/lib/finance-sync.ts` (typed client helpers for `syncFinanceEvent`, `fetchCashControlContext`, `openCashflowAuditPdf`, `openPayrollPdf`, date-key formatting & carry-forward audit helpers)
  - Modify: `src/components/AvatarUpload.tsx` (explicit crisp contrast fallback initials across dark/light themes)
  - Modify: `src/screens/Settings.tsx` (2026 Split Console redesign: remove `AccountHero` + boxy 3-row nav, add sticky left rail + filter search + integration health dots, unify Profile avatar+identity editor, visual 7-palette swatches in Appearance, hairline-divided sections)
  - Modify: `src/screens/Finance.tsx` (full Daily Cash Control carry-forward, Auto+Manual transaction creation, search & multi-filter across Cash Control / Ledger / Audit Log, Cash <-> Bank transfer cash drawer sync, Day Breakdown Drawer, Reopen Day Drawer, Variance adjustment action, PDF/CSV Audit Report buttons)
  - Modify: `src/screens/Attendance.tsx` (persist `status` for `present | half_day | paid_leave | unpaid_leave | absent` across all 4 tabs; show Paid Leave vs Unpaid Leave vs Absent cleanly)
  - Modify: `src/screens/Payroll.tsx` (3-tab Payroll Workspace: `Monthly Run` with search/filters/policy drawer/attendance-linked working-days calculation/advance auto-deduction/Mark Paid finance sync, `Advances Ledger` with issue/cancel/history, `Salary History` multi-month archive + CSV & branded A4 PDF payslip)
  - Modify (Auto-Sync Wiring): `src/screens/POS.tsx`, `src/screens/Invoices.tsx`, `src/screens/InvoicePreview.tsx`, `src/screens/JobSheetDetail.tsx`, `src/screens/Payments.tsx`, `src/screens/PaymentRegister.tsx`, `src/screens/PurchaseBills.tsx`, `src/screens/Suppliers.tsx`, `src/screens/Technicians.tsx`
  - Modify / Add E2E: `tests/e2e/settings-profile.spec.mjs` & `tests/e2e/app.spec.mjs` (verify redesigned Settings visual layout, Cash Control carry-forward + manual/auto recording, Advance + Payroll working-days generation + Mark Paid)

---

### Task 1: Schema, Runtime Triggers & RBAC Parity

**Files:**
- Modify: `server/prisma/schema.prisma`
- Modify: `server/prisma/runtime.sql`
- Regenerate: `server/src/generated/schema-meta.json`
- Modify: `server/src/routes/data.ts`
- Modify: `tests/database-contract.test.mjs` & `server/tests/schema-parity.test.ts`

- [ ] **Step 1: Update failing schema contract assertions (`tests/database-contract.test.mjs`, `server/tests/schema-parity.test.ts`)**
  Update expected table count from `65` to `67` and add explicit assertions for `daily_cash_control` (`previous_closing`, `auto_income`, `auto_expense`, `transfer_in`, `transfer_out`, `opening_override_reason`, `reopened_at`), `finance_transactions` (`entry_source`, `source_id`, `daily_cash_date`), `attendance_records` (`status`), `payroll` (`slip_number`, `working_days`, `present_days`, `half_days`, `leave_days`, `absent_days`, `advance_deduction`, `other_deductions`, `finance_transaction_id`), `employee_advances`, and `payroll_advance_recoveries`.
- [ ] **Step 2: Run tests to verify new assertions fail before schema update**
  Run: `cd /Users/rajat/Downloads/alvstore && node --test tests/database-contract.test.mjs && npm --prefix server test`
- [ ] **Step 3: Edit `server/prisma/schema.prisma` & `server/prisma/runtime.sql` & `server/src/routes/data.ts`**
  Add new columns & `EmployeeAdvances` / `PayrollAdvanceRecoveries` models (including `@@unique([entry_source, source_id])` on `FinanceTransactions` so non-null `source_id` entries deduplicate atomically in Postgres!). Update `update_account_balance_on_transaction()` in `runtime.sql` to create clean `INSERT`, `UPDATE`, and `DELETE` account balance delta handling without using forbidden `CREATE TABLE`/`CREATE TYPE` tokens. Add `employee_advances` and `payroll_advance_recoveries` (`["admin"]`) to `WRITE_ROLES` in `server/src/routes/data.ts`.
- [ ] **Step 4: Regenerate Prisma client & metadata (`prisma:generate`) + verify database contract & server schema tests pass**
  Run: `cd /Users/rajat/Downloads/alvstore && npm --prefix server run prisma:generate && node --test tests/database-contract.test.mjs && npm --prefix server test`

---

### Task 2: Pure Payroll & Attendance Working-Days Calculator (`src/lib/payroll-calculator.ts`)

**Files:**
- Create: `src/lib/payroll-calculator.ts`
- Create: `tests/payroll-calculator.test.mjs`

**Interfaces:**
- `export interface PayrollPolicy { working_days_mode: "exclude_weekly_off" | "calendar_days" | "fixed_26" | "fixed_30"; weekly_off_days: number[]; half_day_hours_threshold: number; auto_deduct_advances: boolean; paid_holidays: Array<{ date: string; name: string }>; }`
- `export function calculateEmployeePayroll(input: PayrollCalculationInput): PayrollCalculationResult`
- `export function matchesEmployeeAttendance(emp: { id: string; user_id?: string | null }, recordEmployeeId: string): boolean`

- [ ] **Step 1: Write comprehensive unit tests in `tests/payroll-calculator.test.mjs`** covering:
  - Matching attendance records via BOTH `emp.id` and `emp.user_id` without double-counting duplicate date records.
  - Counting `status: "half_day"`, `"Half day"` note, and `< 5h` duration as `0.5d`; keeping `"paid_leave"` un-docked; docking `"unpaid_leave"` and absent workdays (`1.0d`); excluding Sunday weekly offs & Paid Holidays from absence deductions across all 4 policy modes (`exclude_weekly_off`, `calendar_days`, `fixed_26`, `fixed_30`).
  - Advance recovery capping (`net_salary` never goes negative unless overridden) & FIFO recovery allocation across multiple active advances.
- [ ] **Step 2: Run test to verify failure**
  Run: `node --test tests/payroll-calculator.test.mjs`
- [ ] **Step 3: Implement `src/lib/payroll-calculator.ts`** cleanly and pass `tests/payroll-calculator.test.mjs`.
- [ ] **Step 4: Re-run tests to confirm PASS.**

---

### Task 3: Backend Cash Flow Sync Engine, Carry-Forward Helpers & Branded Audit/Payslip PDFs

**Files:**
- Create: `server/src/lib/finance-sync.ts`
- Create: `server/src/lib/report-pdf.ts`
- Modify: `server/src/routes/functions.ts`
- Create: `server/tests/finance-sync.test.ts`

**Interfaces (`server/src/lib/finance-sync.ts`):**
- `export function resolveAccountTypeForMode(paymentMode?: string | null): "cash" | "bank"`
- `export function computeCashDayExpectedClosing(row: CashDayTotals): number`
- `export function auditCarryForwardChain(daysDesc: CashDaySummary[]): CarryChainAuditResult`
- `export async function recordFinanceSync(client: Queryable, input: FinanceSyncInput): Promise<FinanceSyncResult>`
- `export async function syncDailyCashForDate(client: Queryable, dateKey: string, actor?: { userId?: string | null; staffName?: string | null }): Promise<DailyCashRow | null>`

**Interfaces (`server/src/lib/report-pdf.ts`):**
- `export async function buildCashflowAuditPdf(input: CashflowAuditPdfInput): Promise<Uint8Array>`
- `export async function buildPayrollSlipPdf(input: PayrollSlipPdfInput): Promise<Uint8Array>`

- [ ] **Step 1: Write failing tests in `server/tests/finance-sync.test.ts`** covering:
  - Payment mode routing (`"cash"` -> `"cash"`, `"upi"/"card"/"bank_transfer"/"neft_rtgs"/"cheque"/"razorpay"` -> `"bank"`).
  - Cash Drawer expected closing math including transfers (`opening + pos_total + auto_income + manual_income + transfer_in - auto_expense - manual_expense - transfer_out`), ₹0 float acceptance, and carry-forward chain audit detecting mismatched opening vs prior closing.
  - Generating valid multi-row `%PDF-` A4 buffers for `buildCashflowAuditPdf` and `buildPayrollSlipPdf` with Rupee `₹` glyphs.
- [ ] **Step 2: Run `npm --prefix server test` to verify failure.**
- [ ] **Step 3: Implement `server/src/lib/finance-sync.ts` & `server/src/lib/report-pdf.ts`**, reusing typography/palette constants (`#0B0C0E` Obsidian band, `#9C7B49` Brass rule, embedded `DMSans` & `JetBrainsMono` fonts from `server/assets/fonts/`) consistently with `document-pdf.ts`.
- [ ] **Step 4: Wire Express endpoints in `server/src/routes/functions.ts`**:
  - `POST /finance-sync` (`requireStaff`)
  - `GET /cash-control-context` (`requireStaff`) — returns carry-forward suggestion for target date (`previousClosing`, `previousDate`, `previousStatus`), bank/UPI non-cash summary, per-date post-close flags, and chain audit status
  - `POST /cash-control-recompute` (`requireStaff`) — refreshes open-day drawer totals cleanly from `finance_transactions`
  - `GET /cashflow-audit-pdf` (`requireStaff`) — streams branded Period Cash Flow & Daily Control Audit Report PDF
  - `GET /payroll-pdf` (`requireRole("admin")` / staff own?) — streams branded ALVStore Salary Slip PDF
  - `POST /employee-advance-issue` & `POST /employee-advance-cancel` (`requireRole("admin")`) — transactional advance disbursement/refund + finance sync
  - `POST /payroll-settle` (`requireRole("admin")`) — transactional Mark Paid + FIFO `PayrollAdvanceRecoveries` persistence + `EmployeeAdvances` balance/status updates + Finance expense sync
  - Update `razorpay-webhook` to call `recordFinanceSync` idempotently (`entry_source: "razorpay"`, `source_id: "rzp:" + payment.id`).
- [ ] **Step 5: Run `npm --prefix server test` & server typecheck to confirm all pass.**

---

### Task 4: Redesign `/settings` into 2026 Split Console (`src/screens/Settings.tsx`, `src/components/AvatarUpload.tsx`)

**Files:**
- Modify: `src/components/AvatarUpload.tsx`
- Modify: `src/screens/Settings.tsx`

- [ ] **Step 1: Fix fallback initial contrast in `src/components/AvatarUpload.tsx`** across dark Obsidian / all 7 themes using theme-aware MUI `alpha(theme.palette.primary.main, 0.16)` and crisp `theme.palette.primary.main` text with explicit border contrast.
- [ ] **Step 2: Refactor `src/screens/Settings.tsx`** into a 2026 Split Console:
  - Remove `AccountHero` card & 3-row boxed nav completely.
  - Keep clean `PageHeader` + compact subtle active-account indicator pill.
  - Left sticky rail (`248px`, `>= md`) with inline filter search (`Filter settings…`), compact tracked section labels (`ACCOUNT`, `WORKSPACE`, `INTEGRATIONS`), icon + exact accessible button names (`Profile`, `Appearance`, `Business Info`, etc.), active left-border highlight pill, and subtle health/configured indicator dot per integration.
  - Mobile horizontal compact chip/pill bar (`< md`) with zero horizontal overflow at `390px`.
  - Unify `ProfileTab` to ONE single Avatar uploader + inline actions (`Upload Photo`/`Change Photo`, `Remove Photo`) paired cleanly with Identity fields and Password & Security rows separated by hairline `Divider`s (`maxWidth: 880px`).
  - Upgrade `AppearanceTab` with mini workspace preview swatches inside the 7 theme selector cards while keeping exact accessible theme button labels (`Obsidian`, `Forest`, etc.) and `Compact Navigation Sidebar` toggle switch.
- [ ] **Step 3: Run `npm run check:ui && npm run typecheck` cleanly.**

---

### Task 5: Upgrade Cash Flow Management & Client Billing Auto-Sync (`src/lib/finance-sync.ts`, `Finance.tsx` + 9 Screens)

**Files:**
- Create: `src/lib/finance-sync.ts`
- Modify: `src/screens/Finance.tsx`
- Modify: `src/screens/POS.tsx`, `src/screens/Invoices.tsx`, `src/screens/InvoicePreview.tsx`, `src/screens/JobSheetDetail.tsx`, `src/screens/Payments.tsx`, `src/screens/PaymentRegister.tsx`, `src/screens/PurchaseBills.tsx`, `src/screens/Suppliers.tsx`, `src/screens/Technicians.tsx`

- [ ] **Step 1: Create `src/lib/finance-sync.ts`** wrapping `POST /api/backend/functions/finance-sync`, `GET /cash-control-context`, `POST /cash-control-recompute`, `openCashflowAuditPdf(opts)`, and IST-safe `localDateKey` helpers (plus updating `Cash Control` / `Audit` links cleanly).
- [ ] **Step 2: Wire automatic financial recording across all 9 transaction screens without double-counting:**
  - `POS.tsx`: sync cash/UPI/card checkout (`entry_source: "pos"`, `source_id: "pos:" + txn.id`).
  - `Invoices.tsx` (add `Payment Method` selector to Record Payment drawer) & `InvoicePreview.tsx` (reuse `computePaymentUpdate` + pass `payMethod`): sync via `entry_source: "invoice"`.
  - `JobSheetDetail.tsx`: sync customer `addPayment` (`entry_source: "repair"`, `source_id: "repair:" + ...`) AND update `recordTechnicianPayment` to let admin choose mode, mark `technician_payments` `"paid"`, and sync once (`source_id: "techpay:" + tp.id`).
  - `Technicians.tsx`: switch `markAsPaid` to `finance-sync` with matching `"techpay:" + payment.id` so synced job-sheet payouts never double-post.
  - `Payments.tsx`: sync standalone manual payments (`entry_source: "payment"`); skip if already captured via linked invoice/pos ref check.
  - `PaymentRegister.tsx`: when marking `"cleared"` or `"reconciled"`, post ONLY MDR/`bank_charges` as expense (`source_id: "preg-fee:" + id`) when `invoice_id` is linked; post net received (`source_id: "preg:" + id`) only when unlinked.
  - `PurchaseBills.tsx`: fix `select("*, suppliers(name, outstanding_balance)")`; remove phantom unpaid expense insert on `confirmBill`; add optional `"Paid Now"` + payment mode/account confirmation drawer on confirm (`source_id: "pbill:" + bill.id`).
  - `Suppliers.tsx`: upgrade `recordSupplierPayment` to call `finance-sync` (`entry_source: "supplier"`) so Cash Drawer updates automatically on cash vendor payouts!
  - `Finance.tsx` (`TransfersTab`): after inserting `type = "transfer"`, invoke `/cash-control-recompute` for the transfer date so `Cash <-> Bank` transfers update `transfer_in`/`transfer_out` on `daily_cash_control`.
- [ ] **Step 3: Upgrade `Finance.tsx` (`CashControlTab`, `TransactionTab`, `LedgerTab`, `AuditLogTab`):**
  - Carry forward prior day's `closing_cash` into `Open Day` (with clear source caption + override reason toggle, allowing ₹0 opening/closing).
  - Record manual Income/Expense from Cash Control as real `finance_transactions` rows (`entry_source: "manual"`, selectable category + reference + description) linked to the Cash account & synced into `daily_cash_control`.
  - Add Cash Flow KPI strip (Day Status, Opening Cash + Carry-Forward badge, Cash Inflows Auto/Manual, Cash Outflows Auto/Manual, Transfers Net, Expected Closing, Counted Closing & Variance + Bank/UPI non-cash today strip).
  - Add Search + Filter bar (Search date/ref/staff/notes, Date presets `Today | 7 Days | This Month | Custom`, Entry Source `All | Auto | Manual`, Status `All | Open | Closed`).
  - Add Day Detail & Audit SideDrawer (chronological day cash + non-cash txns, denominations, variance notes, audit logs, Reopen Day action, Variance Adjustment action) + Export Branded PDF Audit Report + CSV buttons!
  - Preserve exact `/finance` `<Tab>` labels for E2E parity.
- [ ] **Step 4: Run `npm run check:ui && npm run typecheck`.**

---

### Task 6: Upgrade `Attendance.tsx` Leave Persistence & Full `Payroll.tsx` + Advances Workspace

**Files:**
- Modify: `src/screens/Attendance.tsx`
- Modify: `src/screens/Payroll.tsx`

- [ ] **Step 1: Upgrade `src/screens/Attendance.tsx`**
  - Persist `attendance_records.status` explicitly across `'present'`, `'half_day'`, `'paid_leave'`, `'unpaid_leave'` (deleting/omitting record for `'absent'` or explicit `'absent'` handling) so `Leave` is no longer lost or conflated with `Absent`.
  - Update `WeeklyViewTab`, `CalendarViewTab`, and `MonthlyReportTab` to distinguish Paid Leave (`PL`), Unpaid Leave (`UL`), Half Day (`H`), Present (`P`), and Absent (`A`), using shared date-key helpers (`yyyy-MM-dd`).
- [ ] **Step 2: Upgrade `src/screens/Payroll.tsx` into 3-tab Workspace:**
  - `Monthly Run`: Month picker, `SearchToolbar`, Role & Status filters, **"Working Days Policy"** configuration `SideDrawer`, **"Generate All"** button, 4-card Metric Strip (`Total Payable`, `Paid`, `Pending`, `Advances Adjusted`), attendance-linked data table using `calculateEmployeePayroll` (`emp.id || emp.user_id` fix!), `Generate / Edit Slip` drawer showing worked/working days + active advances breakdown + manual overrides, and `Mark Paid` drawer calling `/payroll-settle` (account + mode + FIFO advance recovery + Finance expense sync).
  - `Advances Ledger`: Search, Employee & Status filters, Issue Advance drawer (calling `/employee-advance-issue`), Cancel unrecovered advance action (`/employee-advance-cancel`), and recovery breakdown drawer.
  - `Salary History`: Multi-month searchable/filterable historical archive (`Month From–To`, `Employee Search`, `Status`, `Payment Mode`), CSV export, and Branded ALVStore A4 PDF Payslip view/download (`/api/functions/payroll-pdf`).
- [ ] **Step 3: Run `npm run check:ui && npm run typecheck`.**

---

### Task 7: Full Verification, Database Push, E2E Playwright Suite & Visual Inspection

**Files:**
- Modify: `tests/e2e/settings-profile.spec.mjs` & `tests/e2e/app.spec.mjs` (verify redesigned controls + Cash Flow carry-forward & Payroll E2E journeys)

- [ ] **Step 1: Push Prisma schema + apply `runtime.sql` triggers cleanly to local PostgreSQL (`setup-db.ts` / `db:push` + `seed.ts`) & run `RUN_DB_INTEGRATION=1` DB lifecycle tests.**
- [ ] **Step 2: Run full static, unit, server, and Next production build checks:**
  `cd /Users/rajat/Downloads/alvstore && npm run check:ui && npm run typecheck && npm test && npm run build && npm --prefix server run build`
- [ ] **Step 3: Run Playwright E2E suite (`settings-profile.spec.mjs`, `sidebar.spec.mjs`, `app.spec.mjs`) against live app & capture desktop (Dark Obsidian + Light Forest) and mobile (`390px`) screenshots of `/settings`, `/finance` (Cash Control), and `/payroll` (Monthly Run + Advances).**
- [ ] **Step 4: Visually inspect every screenshot with `read_file` to verify zero overflow, clean contrast, tabular numbers, and 2026 visual polish; fix any polish issues and re-verify cleanly.**
