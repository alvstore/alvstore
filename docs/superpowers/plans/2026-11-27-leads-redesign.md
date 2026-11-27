# Leads (/leads) 2026 Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to execute cleanly with minimal bloat (`ponytail`).

**Goal:** Redesign `/leads` into a 2026 Bento Command Console with unified `MetricStrip`, collapsible animated Funnel/Source/Hygiene widgets, information-complete drag-and-drop cards, atomic single/bulk bot-lead deletion, Split View triage, and duplicate-safe Customer Conversion -> `/sales/new?customerId=...` Quotation handoff.

**Architecture:** Extract pure CRM parsing, dynamic scoring, bot/spam heuristic detection, and filtering into `src/lib/leads-utils.ts`. Keep atomic transactional backend logic in `server/src/lib/lead-actions.ts` wired into `POST /leads-delete` and `POST /leads-convert` in `server/src/routes/functions.ts`. Rebuild `src/screens/Leads.tsx` strictly on `@mui/material`, `@/components/mui/*`, `framer-motion`, `recharts`, and ALVStore CSS theme tokens so light (`Donezo`/`Forest`/`Arctic`) and dark (`Obsidian`/`Ocean Deep`/`Sunset Ember`/`Midnight Rose`) themes stay uniform and accessible.

**Tech Stack:** Next.js 15, React 19, MUI v9, Framer Motion 11, Recharts, Express 4 + PostgreSQL (`pg`).

**Spec:** [2026-11-27-leads-redesign-design.md](file:///Users/rajat/Downloads/alvstore/docs/superpowers/specs/2026-11-27-leads-redesign-design.md)

## Global Constraints
- Strictly `@mui/material` + `@/components/mui/*` (`npm run check:ui` zero errors across 58 screens).
- Zero breaking Prisma schema changes (`leads` and `lead_activities` tables already contain all columns).
- Every animation checks `useReducedMotion()` and animates only GPU transforms/opacity (`motionTokens`).
- Zero horizontal overflow at `390px` mobile and `1440px` desktop viewports.

## Review Focus
- `parseLeadNotes` must cleanly parse both structured public enquiries (`Topic: ...\nCity: ...\n\nNote`) and freeform internal notes without losing follow-up appends (`--- Follow-up note ---`).
- `convertLeadTx` must never duplicate existing customers when phone formatting differs (`+91 98876 01200` vs `9887601200`).
- `deleteLeadsTx` must reject empty/invalid UUIDs, verify staff role, clean `follow_up_notes` + `notification_feed`, cascade `lead_activities`, and log a single audit entry.
- Table/Kanban checkboxes and icon buttons (`Call`, `WhatsApp`, `Mail`, `Delete`, `Convert & Quote`) must call `e.stopPropagation()` so clicking never opens the edit drawer accidentally.
- Drag-and-drop across pipeline columns must work seamlessly alongside keyboard/dropdown fallbacks and update optimistically/cleanly on `Converted` transitions.

---

### Task 1: Pure Lead Helpers & Unit Tests
- **Files:** `src/lib/leads-utils.ts`, `tests/leads-utils.test.mjs`
- **Steps:**
  1. Write unit tests in `tests/leads-utils.test.mjs` covering `parseLeadNotes`, `computeLeadScore`, `detectSuspiciousLead`, `getFollowUpStatus`, `formatLeadAge`, `buildWhatsAppLink`, `filterAndSortLeads`.
  2. Implement `src/lib/leads-utils.ts`.
  3. Run `node --test tests/leads-utils.test.mjs` -> confirm pass.

### Task 2: Atomic Server Actions (`POST /leads-delete` & `POST /leads-convert`) + Tests
- **Files:** `server/src/lib/lead-actions.ts`, `server/src/routes/functions.ts`, `server/tests/leads-actions.test.ts`
- **Steps:**
  1. Write `server/tests/leads-actions.test.ts` validating customer phone/email dedup matching, parsed city/notes copy, atomic multi-lead deletion (`follow_up_notes`, `notification_feed`, `leads`, `system_audit_log`), and route role guards (`401`/`403`/`400`).
  2. Implement `server/src/lib/lead-actions.ts` (`deleteLeadsTx`, `convertLeadTx`, `normalizePhoneLast10`).
  3. Mount `POST /leads-delete` and `POST /leads-convert` in `server/src/routes/functions.ts`.
  4. Run `npm --prefix server test && npm --prefix server run build`.

### Task 3: Redesign `src/screens/Leads.tsx`
- **Files:** `src/screens/Leads.tsx`
- **Steps:**
  1. Replace mixed KPI cards with `MetricStrip` (5 cells + click-to-filter actions) + collapsible Bento Insights Strip (Animated Pipeline Stage Funnel, Source Attribution `DistributionWidget`, Lead Readiness `ProgressRing` + Bot/Spam Watch card).
  2. Add `SegmentedControl` (`Pipeline` | `Table` | `Split View`), Quick Filter chips (`All`, `Overdue`, `Hot 70+`, `Unassigned`, `Flagged / Spam`), Source/Assignee/Sort controls, Export CSV, and animated floating Bulk Action bar (`Select Flagged`, `Move Stage`, `Mark Lost (Spam)`, `Delete Selected`).
  3. Rebuild Pipeline columns (`Show Closed` toggle) with full-context animated cards (avatar, age, dynamic score badge, BOTH phone + email + Call/WhatsApp/Email triggers, Topic/City pills, notes preview, Expected ₹, Follow-up chip, Owner chip, inline Trash/Delete `confirmAction`, `Advance ->` menu, `Convert & Quote` / `Create Quotation` CTA) and HTML5 Drag-and-Drop.
  4. Upgrade `Table` (`minWidth: 0`, bulk checkboxes, Delete + Convert/Quote buttons) and `Split View` (left filterable queue + right live Inspector & Activity Timeline), plus upgrade `SideDrawer` with stage stepper, Lost Reason presets, Delete, Convert Customer, and Create Quotation CTA.

### Task 4: Verification, Playwright E2E & Visual Inspection
- **Files:** `tests/e2e/leads-redesign.spec.mjs`
- **Steps:**
  1. Run `npm run check:ui && npm run typecheck && npm test && npm run build && npm --prefix server run build`.
  2. Write `tests/e2e/leads-redesign.spec.mjs` verifying KPI strip, collapsed/expanded widgets, full card email+phone+topic+notes visibility, single & bulk bot-lead deletion via `confirmAction`, stage drag/switch, Convert -> `/sales/new?customerId=...` quotation handoff, Split View, and 390px/1440px zero horizontal overflow + screenshots.
  3. Run live Playwright E2E tests and inspect generated desktop & mobile PNG screenshots (`read_file`).
