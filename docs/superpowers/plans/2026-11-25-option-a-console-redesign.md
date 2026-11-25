# ALVStore Console Option A Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (or subagent-driven-development) to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement reusable `SideDrawer` and `MetricStrip` MUI components, contrast-safe pill & elevation tokens, and redesigned `/invoices`, `/tasks`, `/calendar`, and `/dashboard` screens styled after Pixinvent Materialize.

**Architecture:** Extract pure contrast & metric helpers (`src/lib/pill-style.ts`, `src/lib/invoice-metrics.ts`), add accessible reusable primitives in `src/components/mui/`, keep all 7 `useTheme` palettes and E2E accessibility landmarks intact, and rebuild each screen incrementally with TDD tests and `check:ui` static validation.

**Tech Stack:** Next.js 15 App Router, React 19, MUI v6, Emotion, Recharts, Framer Motion, Node native `node:test`.

**Spec:** `docs/superpowers/specs/2026-11-25-option-a-console-redesign-design.md`

## Global Constraints
- Zero raw HTML tags (`div`, `span`, `p`, `h1`, `h2`, `button`, `input`, `textarea`, `select`, `table`) or `className` utilities in `src/screens` or `src/components` (`npm run check:ui`).
- Contrast ratio `>= 4.5:1` on all pastel badges/event pills across light (`arctic`, `forest`, `donezo`) and dark (`obsidian`, `ocean`, `ember`, `rose`) themes.
- `SideDrawer` paper must set `role="dialog"` and `aria-modal="true"` and lock backdrop/Escape dismissal while `busy` is true.
- All Dashboard (`Workload calendar`, `Your agenda`, `Today's focus`, `Sales activity`, `Repair completion`, `Repair pipeline`, `Refresh dashboard`) and Calendar (`Your agenda`, `Edit Event`, `Calendar view`) E2E landmarks remain intact.

## Review Focus
1. Pastel status/category pills failing WCAG 4.5:1 contrast in `arctic` light or `obsidian` dark mode.
2. Unfiltered `invoices` KPI totals getting corrupted when user types a search query filtering client name or invoice number.
3. Sticky `DataTable` `<thead><th>` painting opaque `background.paper` over custom `<TableRow sx={{ bgcolor }}>`.
4. `CalendarEvents` having nullable `all_day`/`category` fields or `SideDrawer` being dismissed while async save is in flight.
5. `useTaskBoard` optimistic rollback leaving Kanban columns out of sync on error or missing delete cache eviction.

---

### Task 1: Pill Contrast Helper, Theme Surface Polish, `SideDrawer`, and `MetricStrip`

**Files:**
- Create: `src/lib/pill-style.ts`, `src/components/mui/SideDrawer.tsx`, `src/components/mui/MetricStrip.tsx`
- Modify: `src/components/MuiThemeBridge.tsx`, `src/components/mui/index.ts`
- Test: `tests/console-redesign.test.mjs`

**Interfaces:**
- Produces `pastelPillColors(baseColor: string, surfaceBg: string, isDark: boolean) -> { backgroundColor: string; color: string }`
- Produces `<SideDrawer open onClose title description tabs activeTab onTabChange width busy footer paperSx>{children}</SideDrawer>`
- Produces `<MetricStrip items loading index sx />`

- [ ] **Step 1:** Write failing test in `tests/console-redesign.test.mjs` testing `pastelPillColors` guarantees `getContrastRatio(fg, compositeBg) >= 4.5` across all 7 themes (`arctic`, `obsidian`, `forest`, `ocean`, `ember`, `rose`, `donezo`) and checking `SideDrawer`/`MetricStrip` exports.
- [ ] **Step 2:** Run `node --test tests/console-redesign.test.mjs` and confirm FAIL.
- [ ] **Step 3:** Implement `src/lib/pill-style.ts`, update `src/components/MuiThemeBridge.tsx` (`MuiCard` soft light/dark elevation + radius `16`), implement `src/components/mui/SideDrawer.tsx` & `src/components/mui/MetricStrip.tsx`, and export them from `src/components/mui/index.ts`.
- [ ] **Step 4:** Run `node --test tests/console-redesign.test.mjs && npm run check:ui && npm run typecheck` and confirm PASS.
- [ ] **Step 5:** Commit Task 1 (`git add ... && git commit -m "feat: add SideDrawer, MetricStrip, pill contrast helper, and card elevation"`).

---

### Task 2: Redesign `/invoices` with `MetricStrip`, Materialize Table & Record Payment `SideDrawer`

**Files:**
- Create: `src/lib/invoice-metrics.ts`
- Modify: `src/screens/Invoices.tsx`
- Test: `tests/console-redesign.test.mjs`

**Interfaces:**
- Consumes: `SideDrawer`, `MetricStrip`, `pastelPillColors`
- Produces: `summarizeInvoices(invoices)` and `filterInvoices(invoices, statusFilter, search)`

- [ ] **Step 1:** Add failing tests in `tests/console-redesign.test.mjs` for `summarizeInvoices` (`uniqueClients`, `totalCount`, `paidRevenue`, `unpaidBalance`, excluding cancelled from unpaid balance) and `filterInvoices` (case-insensitive matching across `invoice_number`, `customers.name`, `customers.email`), plus verifying `Invoices.tsx` imports `MetricStrip` and `SideDrawer`.
- [ ] **Step 2:** Run `node --test tests/console-redesign.test.mjs` and confirm FAIL.
- [ ] **Step 3:** Implement `src/lib/invoice-metrics.ts` and update `src/screens/Invoices.tsx` (unified 4-cell `MetricStrip`, status filter tabs + search toolbar, styled `DataTable` `& thead th`, contrast-safe `Paid` pill, and `"Record Payment"` `SideDrawer` with full balance quick-fill chip).
- [ ] **Step 4:** Run `npm run check` and confirm PASS.
- [ ] **Step 5:** Commit Task 2 (`git add ... && git commit -m "feat: redesign Invoices with MetricStrip and payment SideDrawer"`).

---

### Task 3: Extend `useTaskBoard` & Redesign `/tasks` with Kanban Board + Table Toggle + `Edit | Activity` `SideDrawer`

**Files:**
- Modify: `src/hooks/useTaskBoard.ts`, `src/screens/Tasks.tsx`
- Test: `tests/console-redesign.test.mjs`

**Interfaces:**
- Consumes: `SideDrawer`, `MetricStrip`, `pastelPillColors`, `confirmAction`
- Produces: `useTaskBoard()` returning `{ tasks, pendingIds, updateStatus, saveTask, deleteTask, refresh, ... }`

- [ ] **Step 1:** Add failing test assertions in `tests/console-redesign.test.mjs` checking `Tasks.tsx` supports Kanban (`Pending`, `In Progress`, `Completed`) + Table `SegmentedControl`, `SideDrawer` with `Edit` & `Activity` tabs, `MetricStrip`, and `useTaskBoard` exposes `saveTask` & `deleteTask`.
- [ ] **Step 2:** Run `node --test tests/console-redesign.test.mjs` and confirm FAIL.
- [ ] **Step 3:** Add `saveTask` & `deleteTask` to `src/hooks/useTaskBoard.ts` (handling cache updates & error throwing cleanly), and redesign `src/screens/Tasks.tsx` (top `MetricStrip`, Board/Table `SegmentedControl`, Kanban lanes with lane status controls & assignee avatars, Table view, and `SideDrawer` with `Edit | Activity` underline tabs & admin/staff `Delete` confirmation).
- [ ] **Step 4:** Run `npm run check` and confirm PASS.
- [ ] **Step 5:** Commit Task 3 (`git add ... && git commit -m "feat: add Kanban board and Edit/Activity SideDrawer to Tasks"`).

---

### Task 4: Redesign `/calendar` with Left Rail (`300px`), Pastel Event Pills & Event `SideDrawer`

**Files:**
- Modify: `src/screens/CalendarPage.tsx`
- Test: `tests/console-redesign.test.mjs`

**Interfaces:**
- Consumes: `SideDrawer`, `pastelPillColors`, `DateCalendar`, `AgendaWidget`, `SegmentedControl`, `confirmAction`

- [ ] **Step 1:** Add failing assertions in `tests/console-redesign.test.mjs` checking `CalendarPage.tsx` uses `SideDrawer` (`Add Event` / `Edit Event`), `pastelPillColors` for event chips, left sidebar rail with `+ Add Event`, inline `DateCalendar`, `Event Filters`, and `AgendaWidget` preserved.
- [ ] **Step 2:** Run `node --test tests/console-redesign.test.mjs` and confirm FAIL.
- [ ] **Step 3:** Update `src/screens/CalendarPage.tsx` to unified two-pane Materialize card layout (`300px` left rail with CTA, `DateCalendar`, `Event Filters`, `AgendaWidget`; right calendar canvas with contrast-safe pastel pill events across Month/Week/Day/List views, nullable field coalescing `all_day ?? false`, `category ?? "business"`, and `SideDrawer` for event add/edit/delete).
- [ ] **Step 4:** Run `npm run check` and confirm PASS.
- [ ] **Step 5:** Commit Task 4 (`git add ... && git commit -m "feat: redesign Calendar with left filter rail, pastel pills, and Event SideDrawer"`).

---

### Task 5: Redesign `/dashboard` with Bento Hero + Sparkline Row, Split Operations Card, Synced Action Widgets & Invoices Table

**Files:**
- Modify: `src/screens/Dashboard.tsx`
- Test: `tests/console-redesign.test.mjs`

**Interfaces:**
- Consumes: `MetricStrip`, `pastelPillColors`, `TrendChart`, `DistributionWidget`, `WorkloadCalendar`, `AgendaWidget`, `ChecklistWidget`, `InventoryWatchWidget`, `ProgressRing`, `Sparkline`, `DataTable`

- [ ] **Step 1:** Add failing test assertions in `tests/console-redesign.test.mjs` verifying `Dashboard.tsx` uses `MetricStrip`, keeps all E2E accessibility names (`"Workload calendar"`, `"Your agenda"`, `"Today's focus"`, `"Sales activity"`, `"Repair completion"`, `"Repair pipeline"`, `"Refresh dashboard"`), and renders Materialize recent-invoices table rows.
- [ ] **Step 2:** Run `node --test tests/console-redesign.test.mjs` and confirm FAIL.
- [ ] **Step 3:** Redesign `src/screens/Dashboard.tsx` matching Materialize CRM + Analytics visual hierarchy (`4:2:2:2:2` Hero + KPI/Sparkline row, secondary `MetricStrip`, `4:8` `Repair pipeline` + split `Sales activity | Repair momentum`, `Workload calendar | Your agenda | Today's focus`, and `Activity & Financial` + `Recent invoices` table).
- [ ] **Step 4:** Run `npm run check` and confirm PASS.
- [ ] **Step 5:** Commit Task 5 (`git add ... && git commit -m "feat: redesign Dashboard with Materialize bento hierarchy and split widgets"`).

---

### Task 6: Update E2E Task View Selector, Run Whole-Branch Review & Verify Build/Screenshots

**Files:**
- Modify: `tests/e2e/app.spec.mjs`

- [ ] **Step 1:** Update task test in `tests/e2e/app.spec.mjs` (~line 485) so it switches `/tasks` view toggle to `Table` when verifying table row + combobox updates (in addition to verifying Kanban view renders cards).
- [ ] **Step 2:** Dispatch a fresh `research` code reviewer on diff against `spec` + `check-ui` + WCAG contrast + E2E safety; resolve any Critical/Important findings with TDD + full suite.
- [ ] **Step 3:** Run `npm run check && rm -rf .next && npm run build`.
- [ ] **Step 4:** Capture Playwright screenshots on `/dashboard`, `/tasks`, `/invoices`, `/calendar` in **Arctic** light & **Obsidian** dark across `1440px` and `375px` (`docOverflow === 0`, zero console errors), inspect PNGs directly, commit E2E fix, remove `.superpowers/sdd/2026-11-25-option-a-console-redesign`, and report completion.
