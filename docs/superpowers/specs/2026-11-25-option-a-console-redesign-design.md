# ALVStore Console Option A Redesign — UI Spec & Component Contract

**Date:** 2026-11-25  
**Scope:** Reusable MUI kit primitives (`SideDrawer`, `MetricStrip`), multi-theme surface & contrast refinement (`MuiThemeBridge`), and redesign of 4 core ERP pages (`/dashboard`, `/tasks`, `/invoices`, `/calendar`) adopting the Pixinvent Materialize visual hierarchy with Apple HIG clarity.

---

## 1. Visual & Surface Architecture (`MuiThemeBridge.tsx`)

- **Preserve All 7 User Themes (`useTheme.tsx`):** `obsidian`, `forest`, `ocean`, `ember`, `arctic` (cool slate canvas, pure paper surfaces, `#6366F1` indigo accent via `239 84% 67%`), `rose`, `donezo`. Derive all surfaces, hairlines, and ink from `theme.palette` + `alpha` / `darken` / `lighten` — zero hardcoded light-only background hex values.
- **Card Elevation & Table Header Surfaces:**
  - `MuiCard`: `borderRadius: 16`, `1px solid divider`, plus subtle light-mode elevation (`boxShadow: "0 2px 10px rgba(34, 48, 62, 0.06)"`) and clean dark-mode depth (`boxShadow: "0 4px 16px rgba(0, 0, 0, 0.28)"`).
  - `DataTable`: override `& thead th` background/typography directly via `DataTable` `sx` prop (since sticky headers paint their own background).
- **Accessible Pastel Pill Formula (`>= 4.5:1` WCAG AA across light & dark modes):**
  - **Light mode:** `bgcolor: alpha(color, 0.12)`, foreground ink `darken(color, 0.42)` (or `theme.palette[accent].dark` / darker saturated ink so indigo, amber `warning`, cyan `info`, and green `success` stay `>= 4.5:1`).
  - **Dark mode:** `bgcolor: alpha(color, 0.18)`, foreground ink `lighten(color, 0.38)` (or `theme.palette[accent].light`).
- **Compliance:** Strict MUI + `@/components/mui/*` usage (no raw HTML `div`/`span`/`p`/`h1`/`h2`/`button`/`input`/`textarea`/`select`/`table`, no `className`, no `Stack component={motion.*}`), preserving `tools/check-ui.mjs` and `tests/ui-contract.test.mjs` (`57` screens, `StatCard`/`FormDialog` adoption preserved elsewhere).

---

## 2. New Reusable Kit Components (`src/components/mui/`)

### 2.1 `SideDrawer` (`src/components/mui/SideDrawer.tsx`)
Right-hand slide-over drawer replacing centered modals on interactive workflows.

- **Props:**
  - `open: boolean`, `onClose: () => void`
  - `title: ReactNode`, `description?: ReactNode`, `badge?: ReactNode`
  - `tabs?: { value: string; label: ReactNode }[]`, `activeTab?: string`, `onTabChange?: (v: string) => void`
  - `width?: number` (default `420`, `{ xs: "100%", sm: width }`)
  - `busy?: boolean` (prevents Escape/backdrop dismiss and disables close icon while saving)
  - `footer?: ReactNode` (sticky bottom action bar with `1px solid divider` top border)
  - `children: ReactNode`, `paperSx?: SxProps<Theme>`
- **Accessibility & Structure:**
  - Drawer `slotProps.paper` sets `role="dialog"`, `aria-modal="true"`, `aria-labelledby={`${id}-title`}`, `aria-describedby` (preserving screen-reader semantics and E2E `getByRole("dialog")` locators).
  - Sticky header (`minHeight: 56`), Close `IconButton` (`minWidth: 36, minHeight: 36`), optional underline `TabBar` right under header, scrollable body (`flex: 1, overflowY: "auto"`), sticky bottom footer.

### 2.2 `MetricStrip` (`src/components/mui/MetricStrip.tsx`)
Unified multi-metric KPI summary card separated by internal hairline dividers (Materialize Invoice List header pattern).

- **Props:**
  - `items: MetricStripItem[]` (`{ id?: string; label: ReactNode; value: number | string; isCurrency?: boolean; formatter?: (v: number) => string; caption?: ReactNode; trend?: ReactNode; icon: ReactNode; accent?: StatAccent; onClick?: () => void }[]`)
  - `loading?: boolean`, `index?: number`, `sx?: SxProps<Theme>`
- **Layout & Contrast:**
  - Single elevated `Card` divided via responsive CSS grid (`1` col mobile, `2×2` `sm`, `N` cols `md+`) with internal `1px solid divider` rules.
  - Left-aligned bold `tabular-nums` metric (`CountUp`) + muted label/caption; right-aligned `42×42` rounded-square icon tile (`borderRadius: "10px"`, `bgcolor: alpha(color, dark ? 0.18 : 0.12)`, contrast-safe ink).

---

## 3. Page Redesigns (Preserving Live Data & Accessibility Regions)

### 3.1 Dashboard (`/dashboard` — `src/screens/Dashboard.tsx`)
Adopt Materialize CRM + Analytics card hierarchy while keeping every existing live telemetry query and accessible widget region (`Workload calendar`, `Your agenda`, `Today's focus`, `Sales activity`, `Repair completion`, `Repair pipeline`, `Refresh dashboard`).

1. **Header & Quick Strip:** `PageHeader` (`"Refresh dashboard"` button, date chip) + `STORE ACTIVE` pulse strip + compact Quick Actions pills (`New Sale`, `Quotation`, `Invoice`, `Repair`, `Payment`).
2. **Row 1 — 12-Col Bento KPI Row (`lg: 4fr / 2fr / 2fr / 2fr / 2fr`):**
   - **Hero Performance Card (`4` cols):** `Monthly Revenue`, collection % against monthly invoices (`CountUp`), `"New Invoice"` primary button, and subtle `ProgressRing` (`collectedMonth / invoicesMonth`).
   - **4 Compact KPI / Mini-Viz Cards (`2` cols each):** `Today's Sales` (`/pos`), `Invoices (Month)` (`/invoices`), `Cash Balance` with 7-day `Sparkline` (`/finance`), and `Store Vitality` compact `ProgressRing` (`/repairs`).
   - Plus unified 4-stat secondary operational `MetricStrip` (`Pending Payments`, `Customers`, `Active Repairs`, `Low Stock Items`) keeping every KPI clickable to its module.
3. **Row 2 — `4 : 8` Pipeline & Split Sales Card (`lg: 4fr / 8fr`):**
   - **Left (`4` cols):** `Repair pipeline` (`DistributionWidget` with centered count + stage legend).
   - **Right (`8` cols):** Elevated split card (`lg: 1.55fr / 1fr` with internal vertical hairline divider):
     - Left pane: `Sales activity` (`TrendChart` 7 days / 30 days `SegmentedControl`, area graph).
     - Right pane: `Repair momentum` & Team Tasks (`"Repair completion"` `ProgressRing`, completed/total jobs, task completion bar -> `/repairs`).
4. **Row 3 — `4 : 4 : 4` Action Row (`Workload calendar`, `Your agenda`, `Today's focus`):**
   - Preserves synced `WorkloadCalendar`, `AgendaWidget`, and `ChecklistWidget` (`Today's focus` — directly toggleable checkboxes synced via `useTaskBoard`).
5. **Row 4 — `5 : 7` Activity & Recent Invoices / Inventory Watch:**
   - **Left (`5` cols):** `Financial overview` + `InventoryWatchWidget` + colored-dot activity timeline of latest invoices & repair jobs.
   - **Right (`7` cols):** `Recent invoices` Materialize-styled `DataTable` (`#INV` link, `Avatar` + customer name, total, pastel `Paid`/balance pill, quick `"View all →"`).

### 3.2 Tasks (`/tasks` — `src/screens/Tasks.tsx`)
1. **Header & View Toggle:** `Task Management`, `SegmentedControl` view switcher (**Kanban Board** | **Table**), `+ New Task` CTA (gated by `isAdminOrStaff` matching existing RBAC).
2. **Unified Top `MetricStrip`:** `Team Progress %`, `Pending`, `In Progress`, `Overdue`.
3. **Status Tabs & Search:** `All`, `Pending`, `In Progress`, `Completed` tabs + `SearchToolbar` (active across both Kanban & Table so filtering works seamlessly in either view).
4. **Kanban Board View (default view; 3 columns: `Pending`, `In Progress`, `Completed`):**
   - Lane header with colored status dot, count badge, and inline `+ Add` action (prefilling that lane's `status`).
   - Elevated `Card` (`background.paper`, `borderRadius: "14px"`, `p: 2`): top row with priority pastel pill (`low`/`medium`/`high` contrast-safe ink) + quick lane step controls (`←` / `→` calling `useTaskBoard().updateStatus` with optimistic rollback), title + 2-line clipped description, bottom row with overdue/due-date tag + related entity badge + `26×26` assignee `Avatar`. Clicking a card opens the `SideDrawer`. Bottom `+ Add New Item` trigger in each lane (for `isAdminOrStaff`).
5. **Table View:** Full `DataTable` with inline status `<Select>` (updates via `useTaskBoard`), kept intact as toggleable view (`tests/e2e/app.spec.mjs` task test switches to Table when verifying row combobox + also verifies Kanban lane flow).
6. **`SideDrawer` (`Edit Task` / `New Task`, `width: 420`):**
   - Underline tabs when editing: **Edit** (`Details`) and **Activity**.
   - **Edit Tab:** Outlined `Title *`, `Description`, `Priority`, `Status`, `Due Date`, `Assign To`, `Related To`. Sticky footer: `Create Task` / `Update`, `Cancel`, and `Delete` (for `isAdminOrStaff` via `confirmAction`).
   - **Activity Tab:** Created timestamp, Priority/Status badges, linked entity info, and 1-tap transition buttons. Extend `useTaskBoard` cleanly with `saveTask` and `deleteTask` helpers updating the React Query cache.

### 3.3 Invoices (`/invoices` — `src/screens/Invoices.tsx`)
1. **Header:** `Invoices` + `+ New Invoice` CTA (`/invoices/new`).
2. **Unified `MetricStrip` (computed over all unfiltered invoices):** `Clients` (unique customer count), `Total Invoices`, `Paid Revenue` (`paid_amount` / paid sum), `Unpaid Balance` (remaining balance `Math.max(0, total - paid_amount)` across non-cancelled unpaid/partial invoices).
3. **Unified Table Card:**
   - Toolbar: Status filter tabs (`All`, `Draft`, `Sent`, `Paid`, `Cancelled`) + client-side `SearchToolbar` filtering loaded rows across `#INV` number and `customers?.name` / `customers?.email` (since `queryEngine.ts` does not filter relation paths server-side).
   - `DataTable`: styled `& thead th` (`alpha(text.primary, 0.035)` background, `11px` uppercase tracked labels), `#ID` primary monospace link, `Avatar` + client name & email subtitle, tabular INR total, formatted issued date, contrast-safe pastel `Paid` badge or remaining balance + partial progress bar, and action row (`Pay` -> `SideDrawer`, `Copy link`, `View`).
4. **`Record Payment` `SideDrawer` (`width: 420`):**
   - Replaces `FormDialog`. Displays invoice `#`, client name, Billed / Paid / Balance summary box, numeric `Amount` field with quick `"Pay Full Balance"` chip, `Payment Method` selector (`cash`, `card`, `upi`, `online`), and sticky footer (`Record Payment`, `Cancel`, `"Open Invoice"` link).

### 3.4 Calendar (`/calendar` — `src/screens/CalendarPage.tsx`)
1. **Header:** `Calendar` + `+ Add Event` primary CTA.
2. **Unified Two-Pane Card (`lg: "300px minmax(0, 1fr)"`, hairline vertical divider):**
   - **Left Sidebar Rail (`300px` on `lg`, stacks cleanly on narrow screens):**
     - Full-width solid primary `+ Add Event` button.
     - Inline `DateCalendar` month picker (`selected={currentDate}`, circular primary highlight).
     - `Event Filters`: `View All` checkbox + color-coded category checkboxes (`Personal`, `Business`, `Family`, `Holiday`, `Other`, coalescing nullable `event.category ?? "business"`) + `Show tasks` toggle.
     - Compact `Your agenda` (`AgendaWidget`) embedded right below filters in the rail so clicking events/tasks on the selected day remains 1-click accessible and preserves E2E `Your agenda` workflows.
   - **Right Calendar Canvas:**
     - Toolbar: `<` `>` chevrons + `Today` + period heading on left; `Month | Week | Day | List` `SegmentedControl` (`aria-label="Calendar view"`) on right.
     - Grid: Hairline cells, circular today indicator, **pastel pill event chips** (`alpha(catColor, ...)` bg + contrast-safe ink, coalescing nullable `event.all_day ?? false`).
3. **Add / Edit Event `SideDrawer` (`width: 420`):**
   - Replaces `FormDialog`, preserving `"Add Event"` / `"Edit Event"` dialog title, error Alert validation (`"A title and start date are required"`, `"End date and time must be after the start"`), `Title *`, `Category` (with color dots), `All day` switch, `Start Date/Time`, `End Date/Time`, `Description`, `Also create a task` switch on create, and sticky footer (`Add Event` / `Update`, `Cancel`, and `Delete` via `confirmAction`).

---

## 4. Verification Criteria
- `npm run check` (`check:ui`, `tsc --noEmit`, `npm test` including new unit tests for `SideDrawer`, `MetricStrip`, and invoice/task helpers).
- `rm -rf .next && npm run build` exits `0`.
- Playwright visual + interactive verification across `/dashboard`, `/tasks`, `/invoices`, `/calendar` in both **Arctic** (light) and **Obsidian** (dark) modes across `1440×900`, `1280×800`, `768×1024`, and `375×812` viewports.
