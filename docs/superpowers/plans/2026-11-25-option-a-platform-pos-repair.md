# Option A Implementation Plan: Platform Reliability, 2026 Repair Workflow & POS Redesign

**Goal:** Deliver all 7 requested fixes and redesigns cleanly without bloat or code duplication, verified by unit tests, production Postgres migration, isolated Playwright E2E/visual inspection, and live deployment.

---

## 1. Favicon Cache Bust + `admin@alvstore.in` Admin Role + Seed Convergence
- **Files:**
  - Delete un-busted `src/app/favicon.ico` (prevent Next.js from emitting `/favicon.ico` first in `<head>`).
  - Edit `src/app/layout.tsx`: add explicit `metadata.icons` referencing `/icon.svg?v=3`, `/alvstore-mark.png?v=3`, and `/apple-icon.png?v=3`.
  - Edit `server/tools/seed.ts`: converge `admin@alvstore.in` in `userRoles` using `replaceUserRole` (or deleting non-admin roles + ensuring `"admin"`) instead of no-op `update: {}`.
- **Database:**
  - Update `public.user_roles` on local `.pgdata` and Hostinger prod Postgres for `admin@alvstore.in` (`2b68e1ad-62b4-4b5d-92da-0db62c602199`) from `"staff"` to `"admin"`.

## 2. Avatars End-to-End + Database (`customers.avatar_url`)
- **Files:**
  - `server/prisma/schema.prisma`: add `avatar_url String?` to `model Customers`; run `npm --prefix server run prisma:generate` (syncs Prisma client + `server/src/generated/schema-meta.json`).
  - SQL migration on local & prod Postgres: `ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS avatar_url TEXT`.
  - `src/auth.ts`: support `trigger === "update"` in `jwt` callback so updating `full_name` or `avatar_url` reflects immediately in the NextAuth session cookie without re-login.
  - `src/hooks/useAuth.tsx`: expose `refreshSession` / `updateSessionMetadata` wrapping `next-auth/react` `update`.
  - `src/components/AvatarUpload.tsx`: make upload badge visibly discoverable on touch/mobile as well as hover.
  - `src/screens/Settings.tsx`: render `<AvatarUpload>` inside `ProfileTab` and refresh session metadata on avatar/profile save.
  - `src/components/layout/AppHeader.tsx` & `src/components/layout/AppSidebar.tsx`: pass `src={avatarUrl}` from session user metadata to `<Avatar>`.
  - `src/screens/CustomerProfile.tsx`: ensure `customers.avatar_url` is displayed in `<Avatar>`.

## 3. Audit Report & Repair Report Fixes
- **Files:**
  - `src/lib/audit.ts`: small `recordSystemAudit(...)` helper (safe non-blocking write to `system_audit_log` so staff sessions don't crash on admin-only write tables).
  - Key mutation screens (`CustomerCreate`, `InvoiceAdd`, `QuotationAdd`, `JobSheetDetail`, `Settings`): emit concise `recordSystemAudit` events.
  - `src/screens/AuditLogs.tsx`: query `job_sheet_audit_log` alongside `finance_audit_log` and `system_audit_log` (under `"repair"` module), surface query errors explicitly, and add Export CSV + Print Report actions.
  - `src/screens/Reports.tsx`: switch `RepairsReport` query from legacy empty `repair_tickets` to active `job_sheets`.

## 4. Shared `+ Add Item` With Custom Item Fallback Across Documents
- **Files:**
  - Shared helper component `src/components/documents/DocumentItemAdder.tsx` (or compact extension in `ItemsTable.tsx`): renders searchable/select catalog picker when `products.length > 0` PLUS an explicit **`+ Add Custom Item`** button + clickable empty-state CTA so invoices, quotations, delivery challans, and repair parts work cleanly even when `public.products` has 0 items.
  - Wire into `src/components/documents/ItemsTable.tsx`, `src/screens/InvoiceAdd.tsx`, `src/screens/QuotationAdd.tsx`, and `src/screens/DeliveryChallanAdd.tsx`, ensuring custom item name/description and price are editable inline.

## 5. 2026 Repair Workflow Audit & Upgrade
- **Files:**
  - `server/src/routes/functions.ts`: add safe unauthenticated-capable job event notification endpoint (`notify-job-event`) validating `job_id` + `public_token` before writing `notifications` / `notification_feed` / `system_audit_log`, preserving strict admin/staff `WRITE_ROLES` on direct table writes.
  - `src/screens/JobSheetDetail.tsx`:
    - Fix broken customer portal link `/job/${token}` -> `/job/public/${token}`.
    - Fix `generateInvoice` GST/parts subtotal math (`serviceCharge` + per-part GST / discount synced cleanly to `invoices` & `job_sheets`).
    - Fix `addPayment` completion threshold (`totalPaid >= totalAmount + partsTotal`) and sync `invoices.paid_amount`.
    - Allow technicians to save notes, upload During/After photos, mark `waiting_parts`, and submit Post-Repair QC checklist; gate final QC sign-off, invoice/warranty, and delivery handover to Admin/Staff with unpaid-balance confirmation guard.
    - Add Supplemental Re-quote (reset `approval_status` to `pending_approval` + notify customer) and multi-channel notifications (WhatsApp + Email fallback + Copy Links).
  - `src/screens/PublicJobSheet.tsx` & `src/screens/PublicDeliveryReport.tsx`: trigger `notify-job-event` on customer approval/rejection/signed delivery and add Print/Save PDF button on Delivery Report.

## 6. POS Terminal 2026 Redesign (Animated Bento + Live Charts)
- **Visual Grammar (from reference reels `halsa`, `talmo`, `veyla`, `kavora`, `skerry`):**
  - Top Live Shift KPI Strip (Orders Today, Shift Revenue, Avg Ticket, Items in Cart / Held Bills).
  - Collapsible Live Register Telemetry Deck: Recharts Hourly Cadence pill BarChart + high-contrast Obsidian dark `#111318` `Live Shift Pulse` card + Payment Mix breakdown with timeframe toggle (`7d` / `30d` / `Today`).
  - Left Workspace: Category Filter Chips (`All`, dynamic DB categories, `In Stock`, `Low Stock`), Barcode Scanner + Search, `+ Add Custom Item` SideDrawer (for instant ad-hoc counter billing even when catalog is empty), animated Product Grid using `<Box component={motion.div}>` respecting `useReducedMotion()`.
  - Right Cart & Settlement Rail: Cart item animations (`AnimatePresence`), inline quantity/discount controls, Customer search/Walk-in toggle, **Hold / Resume Bills** drawer (`SideDrawer`), Payment Mode + Cash Tendered/Change calculator or UPI reference, Checkout -> branded Receipt `SideDrawer` with Print, WhatsApp, and Email.

## 7. Verification & Deployment
- Write focused unit/contract tests in `tests/` covering all 7 areas.
- Run `npm --prefix server run prisma:generate`, `npm run check`, `npm run build`, local DB seed/push + Playwright E2E + visual screenshot audit (`visual-audit.mjs`), inspect every screenshot via `read_file`.
- Apply DB schema/role fix on Hostinger production Postgres, push to `origin/main`, fast-forward `/home/u502706970/backend/server` + restart backend + verify `https://alvstore.com/`.
