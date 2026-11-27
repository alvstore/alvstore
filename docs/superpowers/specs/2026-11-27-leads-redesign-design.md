# ALVStore CRM Leads (/leads) 2026 Redesign & Bot/Spam Purge Spec

**Date:** 2026-11-27  
**Route:** `/leads` ([Leads.tsx](file:///Users/rajat/Downloads/alvstore/src/screens/Leads.tsx))  
**Status:** Approved (User Approved + Recommended Duplicate-Safe Conversion)  
**Selected Approach:** Approach A — 2026 Bento Command Console + Rich Drag-and-Drop Pipeline + Bot/Spam Purge

---

## 1. Intent & Why

The current `/leads` screen leaves critical CRM workflows half-finished:
1. **Uneven KPI row:** Mixes three tall `StatCard` tiles with two compact flat `Card` tiles (`Conversion`, `Pipeline`), creating unbalanced whitespace and no click-to-filter utility.
2. **Incomplete Lead Cards:** Pipeline cards render only `name`, `phone || email` (hiding email whenever a phone number exists), `source`, `score`, `expected_value`, and `Overdue` — omitting parsed inquiry context (`Topic:`, `City:`, full `notes` logged by [public-lead.ts](file:///Users/rajat/Downloads/alvstore/server/src/lib/public-lead.ts)), assigned staff name, lead age, contact shortcuts, and stage progression.
3. **No Delete or Bot/Spam Cleanup:** There is no delete action anywhere in Pipeline cards, Table rows, Bulk Selection, or the Inspector Drawer to remove fake/test/bot submissions.
4. **Disconnected Quotation Conversion:** Converted leads stop at creating a customer record instead of offering a one-click **Create Quotation** handoff into `/sales/new?customerId=...` (already supported by [QuotationAdd.tsx](file:///Users/rajat/Downloads/alvstore/src/screens/QuotationAdd.tsx#L112)).

---

## 2. Goals, Non-Goals & Anti-Goals

### Goals
- Deliver a high-craft **2026 CRM Command Console** aligned with ALVStore's MUI + Framer Motion token system across all 7 themes (Light: `Donezo`, `Forest`, `Arctic`; Dark: `Obsidian`, `Ocean Deep`, `Sunset Ember`, `Midnight Rose`).
- Show complete, immediately actionable lead cards with one-tap **Call / WhatsApp / Email**, parsed **Topic / City** pills, notes preview, dynamic **Score**, assigned owner, follow-up urgency, drag-and-drop + accessible stage switching, **Delete**, and **Convert -> Create Quotation** handoff.
- Provide practical **single-click and bulk permanent deletion** for fake/bot/unwanted leads (atomic server cleanup across `leads`, `lead_activities`, `follow_up_notes`, and `notification_feed`), plus an optional `"Fake / Spam Bot"` reason when marking `Lost`.
- Include purposeful, `prefers-reduced-motion`-safe widgets (**Interactive Stage Funnel**, **Source Attribution Donut**, **Follow-Up Readiness Ring**, **Segmented Pill Switcher**, **Animated Bulk Bar**, **Split Inspector View**).

### Non-Goals / Anti-Goals
- **No breaking Prisma schema migrations:** All needed columns already exist on `leads` and `lead_activities` ([schema.prisma](file:///Users/rajat/Downloads/alvstore/server/prisma/schema.prisma#L924-L949)).
- **No Tailwind/shadcn components:** Must strictly use `@mui/material`, `@/components/mui/*`, `lucide-react`, `recharts`, and `framer-motion` so `npm run check:ui` (`tools/check-ui.mjs`) passes cleanly.
- **No gratuitous motion:** Zero blocking animations; zero layout shifts; zero raw hex colors outside theme tokens.

---

## 3. Approaches Considered

| Approach | Summary | Trade-offs | Decision |
|---|---|---|---|
| **A: 2026 Bento Command Console** | Unified `MetricStrip`, collapsible animated Funnel + Source + SLA widgets, rich drag-and-drop Kanban cards with Delete & Call/WhatsApp/Email, `Pipeline \| Table \| Split` view switcher, Bot/Spam triage filter + bulk delete, direct Convert -> `/sales/new` Quotation CTA. | Higher component richness (kept clean above the fold via collapsible Insights toggle persisted per browser). | **Selected** |
| **B: Minimalist Kanban & Table Patch** | Replace KPI row with `MetricStrip`, add email + notes + Delete button to cards/table, skip widgets & Split view. | Fast, but misses analytics widgets and rapid Split Inbox triage workflow. | Rejected |
| **C: Split-View Inbox First** | Default `/leads` to a 2-pane Inbox with Kanban demoted to secondary tab. | Faster for high-volume calling queues, weaker for pipeline stage management. | Rejected |

---

## 4. Architecture & Detailed Design

### 4.1 Pure Helper Module ([src/lib/leads-utils.ts](file:///Users/rajat/Downloads/alvstore/src/lib/leads-utils.ts))
All non-UI logic lives in a dependency-free TypeScript module covered by root `node --test` unit tests:
- **`parseLeadNotes(notes?: string | null)`:** Extracts `Topic:` and `City:` headers emitted by `parsePublicLeadPayload` in [public-lead.ts](file:///Users/rajat/Downloads/alvstore/server/src/lib/public-lead.ts#L59-L64), returning `{ topic, city, summary, followUpNotes }`.
- **`computeLeadScore(lead, activityCount)`:** Computes an intuitive `0–100` engagement/quality score combining base source weight (`referral: 45`, `website: 35`, `walkin: 35`, `whatsapp: 35`, `social: 25`, `ads: 25`, `cold_call: 20`), contact completeness (`+15` valid phone, `+10` valid email), deal context (`+10` notes/topic present, `+10` `expected_value > 0`), activity engagement (`min(15, activityCount * 5)`), minus a `-25` penalty capped at `>= 5` when bot/spam heuristics fire.
- **`detectSuspiciousLead(lead)`:** Non-destructive heuristic returning `{ suspicious: boolean; reasons: string[] }`. Flags patterns commonly seen in spam/bot form submissions (without auto-deleting anything automatically):
  - Repetition/dummy phone digits (e.g. `9999999999`, `1234567890`, `< 8` digits when phone is present).
  - Test/gibberish name tokens (e.g. `test`, `asdf`, `qwer`, single char, heavy random consonants or URLs inside `name`).
  - Known disposable/spam email hints or URL links pasted into short notes (`http://` / `https://` in first 120 chars when source is `website`/`social`).
- **`formatLeadAge(createdAt, now)`** and **`getFollowUpStatus(lead, now)`** (`overdue` | `due_today` | `upcoming` | `none`, ignoring `converted`/`lost` stages).
- **`buildWhatsAppLink(phone, lead)` / `buildCallLink(phone)` / `buildMailLink(email, lead)`:** Sanitizes Indian/international numbers safely for quick action buttons.
- **`filterAndSortLeads(leads, filters)`:** Deterministic search (across name, phone, email, topic, city, notes), stage, source, assignee, quick filter (`all` | `hot` | `overdue` | `unassigned` | `suspicious` | `unconverted`), and sort (`newest` | `score` | `value` | `followup`).

### 4.2 Backend Atomic Delete & Cleanup ([server/src/routes/functions.ts](file:///Users/rajat/Downloads/alvstore/server/src/routes/functions.ts))
Add authenticated endpoint **`POST /leads-delete`** (proxied at `/api/backend/functions/leads-delete`, allowed for `admin` and `staff` roles — mirroring CRM lead management access):
- Validates `ids: string[]` (1–100 valid UUIDs via Zod/UUID check).
- Inside a single DB transaction (`withTransaction` / `BEGIN ... COMMIT`):
  1. Reads target lead names/phones/sources (`SELECT id, name, phone, source FROM public.leads WHERE id = ANY($1::uuid[])`).
  2. Deletes loose/polymorphic child records so no orphans remain:
     - `DELETE FROM public.follow_up_notes WHERE entity_type = 'lead' AND entity_id = ANY($1::uuid[])`
     - `DELETE FROM public.notification_feed WHERE type = 'lead' AND metadata->>'lead_id' = ANY($2::text[])`
  3. Deletes `public.leads WHERE id = ANY($1::uuid[])` (PostgreSQL automatically cascades `public.lead_activities` via `ON DELETE CASCADE` and unlinks `whatsapp_conversations`/`whatsapp_messages` via `ON DELETE SET NULL`).
  4. Inserts an audit trail record into `public.system_audit_log` (`action: 'LEADS_DELETED'`, actor user ID, count + lead names summary).
- Returns `{ success: true, deletedIds, deletedCount }`.
- Frontend wrapper `deleteLeadsByIds(ids: string[])` handles calling `/api/backend/functions/leads-delete`.

### 4.2b Atomic Duplicate-Safe Conversion ([server/src/routes/functions.ts](file:///Users/rajat/Downloads/alvstore/server/src/routes/functions.ts))
Add authenticated endpoint **`POST /leads-convert`** (proxied at `/api/backend/functions/leads-convert`, allowed for `admin`, `staff`, `technician`):
- Runs inside a transaction (`BEGIN ... COMMIT`):
  1. Loads target `leads` row (`404` if missing). If `converted_customer_id` already points to an existing `public.customers` row, updates lead stage/status idempotently and returns that customer.
  2. Searches `public.customers` by normalized last-10 digits of phone first (`regexp_replace(coalesce(phone,''), '\\D', '', 'g') LIKE '%' || $last10`), then fallback by `lower(email)`.
  3. Reuses matched customer or inserts a new `public.customers` row copying `name`, `phone`, `email`, parsed `city` (from `Topic:` / `City:` lines in `notes`), and notes summary.
  4. Updates `leads` (`status = 'converted'`, `pipeline_stage = 'converted'`, `converted_customer_id = customer.id`, `updated_at = now()`) and logs a `lead_activities` conversion entry.
- Moving any lead to `Converted` via drag-and-drop, card menu/advance, table dropdown, or drawer stepper triggers `convertLead(lead)` automatically (bulk multi-stage moves exclude `Converted` to prevent accidental bulk customer creation).
- Both in-place **"Convert Customer"** (menu/drawer) and **"Convert & Quote"** / **"Create Quotation"** (`/sales/new?customerId=...`) share this idempotent flow.

### 4.3 Redesigned UI Structure ([src/screens/Leads.tsx](file:///Users/rajat/Downloads/alvstore/src/screens/Leads.tsx))

1. **Page Header:**
   - Title: `"Lead Management"`, concise subtitle, right-side actions: **Insights Toggle** chip (`Show Insights` / `Hide Insights`), **Export CSV**, and **`+ New Lead`** CTA.

2. **Unified Elevated KPI `MetricStrip` (`5` aligned cells):**
   - **Total Leads** (caption: `+N this week`)
   - **Active Pipeline** (formatted `₹` sum of non-closed stages, caption: deal count)
   - **Hot Leads** (`score >= 70`, clicking toggles `hot` quick filter)
   - **Overdue Follow-ups** (warning accent, clicking toggles `overdue` quick filter)
   - **Conversion Rate** (`%` converted, caption: `W converted · L lost`)

3. **Collapsible Bento Analytics Strip (`3` Apple-clean Widgets):**
   - **Pipeline Stage Funnel (`WidgetCard`):** Animated horizontal proportional stage bars for all 7 stages showing count + `₹` pipeline value + stage % share; clicking any stage bar filters the active view (clicking again resets).
   - **Channel Mix (`DistributionWidget`):** Uses ALVStore's Recharts `DistributionWidget` showing lead distribution by `Website`, `WhatsApp`, `Walk-in`, `Referral`, `Ads`, `Social`, `Cold Call` (with custom count formatter).
   - **CRM Hygiene & Bot Watch (`WidgetCard`):** Pairs `ProgressRing` (% of active leads with follow-up date & owner assigned) with a **Suspicious / Bot Watch** action box showing count of flagged leads + `"Filter Flagged (N)"` shortcut button.

4. **Command Bar & Segmented View Switcher:**
   - [SegmentedControl](file:///Users/rajat/Downloads/alvstore/src/components/mui/SegmentedControl.tsx): **`Pipeline`** | **`Table`** | **`Split View`** (persists view preference or defaults cleanly to `Pipeline`).
   - Quick Filter Chips: `All`, `Overdue`, `Hot (70+)`, `Unassigned`, `Flagged / Spam`, plus Source & Assignee dropdowns, Sort selector (`Newest`, `Highest Score`, `Highest Value`, `Follow-up Due`), and `SearchToolbar` (`Search leads...`).

5. **View 1 — Rich Drag-and-Drop Pipeline (`Pipeline`):**
   - Grouped columns for `New`, `Contacted`, `Qualified`, `Proposal`, `Negotiation`, `Converted`, `Lost` (with a compact toggle to hide/show closed `Converted` & `Lost` columns or collapse them cleanly so active sales stages stay wide and uncluttered).
   - Each column shows stage `StatusChip`, count badge, column `₹` sum, subtle drop highlight border/tint when dragging a card over it, and clean empty-drop state (`EmptyState` compact card).
   - **Each Lead Card renders full context cleanly:**
     - Checkbox (subtle on hover or always visible when any card is selected for bulk cleanup) + Monogram Avatar + **Name** + **Age** (`Today` / `2d ago`) + Score pill (`60 pts`).
     - **Both Phone AND Email** shown (wrapped cleanly with truncation tooltips) + one-tap icon buttons: Call (`tel:`), WhatsApp (`wa.me`), Email (`mailto:`).
     - **Topic / City** pills + 2-line `notes` summary + Suspicious warning badge if flagged.
     - **Expected Value (`₹`)**, Follow-Up due status pill, and Assigned Staff badge.
     - **Action Row:**
       - Stage advance button (`Advance →`) or `ActionMenu` (`Move Stage`, `Mark Lost / Spam`, `Delete Lead`).
       - Direct visible **`Delete`** trash `IconButton` (`aria-label="Delete lead ..."`) invoking `confirmAction` -> `/leads-delete`.
       - Primary conversion CTA: `"Convert & Quote"` (unconverted) or **`"Create Quotation"`** (when already converted, navigating directly to `/sales/new?customerId=${lead.converted_customer_id}`).

6. **View 2 — High-Density Triage Table (`Table`):**
   - Uses `DataTable` inside a `minWidth: 0` container (zero mobile horizontal overflow) with checkbox selection column, inline Contact shortcuts (`Phone` + `Email`), Topic/Notes summary, inline Stage dropdown, Dynamic Score bar, `₹` Expected Value, Next Follow-Up date, Assigned Staff, and Action column (**`Edit`**, **`Convert` / `Create Quotation`**, and **`Delete`** icon button).
   - Preserves stage filter bar and column sorting.

7. **View 3 — Split Inbox (`Split View`):**
   - Two-pane desktop layout (`380px` scrollable queue on left + live Lead Inspector & Activity Timeline on right; collapses gracefully to drawer on mobile), allowing rapid keyboard/click navigation down a queue to call, log outcomes, delete spam bots, or convert into quotations without opening/closing modals repeatedly.

8. **Upgraded Inspector Drawer (`SideDrawer`) & Floating Bulk Action Bar:**
   - **Floating Bulk Action Bar** (`AnimatePresence` bottom/top dock when selected > 0): `Move Stage`, `Mark Lost (Spam)`, `Select All Flagged`, **`Delete Selected (N)`** (`confirmAction`).
   - **Lead `SideDrawer`:**
     - Top stage stepper pills (`New` → `Contacted` → ... → `Converted` / `Lost`), optional `Lost Reason` quick presets (`Price`, `Competitor`, `No Response`, `Fake / Spam Bot`) shown automatically when `pipeline_stage === "lost"`.
     - Drawer header/footer exposes **Delete Lead** (`confirmAction`), **Convert & Quote** / **Create Quotation**, and **Save / Create Lead**.
     - **Activity Timeline** shows activity count badge + quick **Schedule Follow-Up** 1-tap presets (`Tomorrow`, `+3 Days`, `+1 Week`).

### 4.4 Motion Choreography (`framer-motion` + `motion-presets.ts`)
- Page container uses `AnimatedPage`; KPI strip uses `MetricStrip` (`CountUp`); widgets use `MotionSection` (`fadeUp`, staggered indices).
- View switcher uses `SegmentedControl` shared `layoutId` spring surface.
- Kanban cards & list items animate via `motion.div` GPU transforms (`opacity`, `y`, `scale`) with `motionTokens.fast` (`0.14s`) / `motionTokens.base` (`0.22s`) and `easeOut = [0.22, 1, 0.36, 1]`.
- Drag-over column targets use smooth border/background transition (`150ms`); bulk action toolbar slides cleanly with `AnimatePresence`.
- All custom animations check `useReducedMotion()` and disable movement/transitions immediately when reduced motion is enabled.

---

## 5. Minor Design Calls Made (Editable Before Plan)
1. **Hard Delete vs Soft Archive:** Delete permanently deletes selected leads plus their child `follow_up_notes`, `lead_activities`, and `notification_feed` (`type='lead'`) entries (and unlinks WhatsApp threads via `SetNull`) while logging an entry in `system_audit_log`. Separately, marking stage `Lost` includes a quick `"Fake / Spam Bot"` `lost_reason` chip if the team wants to retain metrics instead of purging.
2. **Quotation Handoff on Unconverted Leads:** Already-converted leads show `"Create Quotation"` -> `/sales/new?customerId=${lead.converted_customer_id}`. Active unconverted leads also get a `"Convert & Quote"` option that creates the customer, marks the lead `converted`, and routes directly to `/sales/new?customerId=${newCustomerId}`.
3. **Closed Columns Toggle:** To keep active deal columns spacious on desktop, `Converted` and `Lost` columns default to visible or compact-toggleable (`Show Closed Stages`) without hiding any pipeline counts in the Funnel or Table tabs.

---

## 6. Verification Plan (Post-Implementation)
- **Root unit tests:** New `tests/leads-utils.test.mjs` testing `parseLeadNotes`, `computeLeadScore`, `detectSuspiciousLead`, `filterAndSortLeads`, and link builders.
- **Server unit tests:** `server/tests/public-flows.test.ts` (or `server/tests/leads-delete.test.ts`) verifying auth/role guards and SQL cleanup on `POST /leads-delete`.
- **Static & Build checks:** `npm run check:ui` (58 screens MUI/motion compliance), `npm run typecheck`, `npm test`, `npm run build`, `npm --prefix server run build`.
- **Playwright E2E + Visual Inspection:** Extend E2E coverage for `/leads` verifying KPI alignment, full card contact/topic/notes visibility, single & bulk bot-lead deletion via `confirmAction`, drag/stage transitions, Convert -> `/sales/new?customerId=...` quotation handoff, zero 390px horizontal overflow, and desktop/mobile screenshots in Light (`Donezo`) & Dark (`Obsidian`) modes.
