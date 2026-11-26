# Design System: ALVStore Unified Brand, Console & Branded Document Spec
**Project Scope:** ALVStore Storefront, Multi-Theme ERP Console & Branded A4 Documents (Quotations, Invoices, Delivery Challans)

---

## 1. Visual Theme & Atmosphere

ALVStore balances two deliberate visual registers linked by precision craftsmanship and clean architectural hierarchy:

- **Public Studio ("Architectural Acoustics Gallery"):** Warm, museum-like plaster surfaces paired with editorial serif/sans typography and metallic brass hardware accents—calm, spacious, and unhurried.
- **Authenticated ERP Console ("Swiss High-Contrast Control Room"):** Crisp, functional, high-clarity enterprise workspace supporting seven user-selectable palettes (defaulting to high-contrast dark **Obsidian Titanium (#080808)** alongside light editorial workspaces like **Deep Emerald Forest (#065F46)**, **Donezo (#065F46)**, **Arctic (#4F46E5)**, **Ocean Deep (#0A1628)**, **Sunset Ember (#F59E0B)**, and **Midnight Rose (#EC4899)**). Surfaces stay flat and sharply separated by 1px hairline dividers (`rgba(255,255,255,0.08)` dark / `rgba(16,18,24,0.09)` light).
- **Branded A4 PDF & Print Documents ("Precision Commercial Spec Sheet"):** Always renders onto **Pure Paper White (#FFFFFF)** ink-ready A4 paper regardless of whether the staff user is browsing in Dark Obsidian mode. Topped by an authoritative **Obsidian Header Band (#0B0C0E)** with the official **ALVStore** lens crest (`public/alvstore-logo.png` / `public/alvstore-logo-dark.png`), **Warm Burnished Brass (#9C7B49)** rule accents, aligned thumbnail cells, and strict tabular monospace pricing.

---

## 2. Color Palette & Roles

### A. Branded A4 Document & PDF Palette (Print / Mail / Public Token Views)
- **Paper Canvas (#FFFFFF):** Crisp A4 document sheet background across PDF output and print media.
- **Primary Ink — Deep Carbon Slate (#111827):** High-contrast body copy, itemized titles, and final monetary totals.
- **Secondary Ink — Cool Graphite (#475569):** Item descriptions, HSN codes, GST splits, and address metadata.
- **Hairline Divider — Frost Grey (#E2E8F0):** Clean 0.75pt–1pt grid rules between table rows, summary boxes, and signature blocks.
- **Subtle Surface Tint — Cool Paper Slate (#F8FAFC):** Alternated table header band, payment bank card fill, and shipping summary block.
- **Header Identity Band — Obsidian Titanium (#0B0C0E):** Anchors the top letterhead bar paired with crisp white **Chalk Text (#F6F4EE)**.
- **Brand Hardware Accent — Warm Burnished Brass (#9C7B49):** Thin 2px accent rule under letterhead, section eyebrows, and specification callouts.
- **Accepted / Delivered Badge Ink — Deep Emerald (#065F46) on Misty Sage (#ECFDF5):** Status pill for accepted quotations and delivered challans (`>= 4.5:1` contrast).
- **Dispatched / Pending Badge Ink — Cobalt Ink (#1E3A8A) on Pale Ice (#EFF6FF):** In-transit / sent document status pill.
- **Warning / Expiring Badge Ink — Amber Ochre (#92400E) on Warm Cream (#FEF3C7):** Expiring quotation or partial delivery highlight.
- **Rejected / Overdue Badge Ink — Crimson Ink (#991B1B) on Rose Mist (#FEF2F2):** Rejected quotation or cancelled challan status pill.

### B. ERP Console Themes (`src/hooks/useTheme.tsx` & `src/components/MuiThemeBridge.tsx`)
All interactive ERP screens inherit theme tokens dynamically via `MuiThemeBridge` (zero hardcoded background hex in components):
- **Obsidian (Default Dark):** Deep Obsidian Void (`#080808`), Charcoal Card (`#121212`), Electric Violet Primary (`#8C5CFF`).
- **Forest / Donezo (Light):** Whisper Ivory / Chalk Slate (`#F9FAF8` / `#F7F5F0`), Pure Card (`#FFFFFF`), Deep Emerald Primary (`#065F46`).
- **Arctic (Light):** Cool Slate Canvas (`#F0F5FA`), Crisp Navy Text (`#0F172A`), Royal Indigo Primary (`#4F46E5`).
- **Ocean Deep (Dark):** Abyssal Navy (`#0B1628`), Steel Surface (`#122138`), Electric Cyan Primary (`#09C3DE`).
- **Sunset Ember (Dark):** Espresso Void (`#1A0F0A`), Roasted Umber Surface (`#211712`), Amber Gold Primary (`#F59E0B`).
- **Midnight Rose (Dark):** Deep Plum (`#110717`), Twilight Velvet Surface (`#1D1024`), Vivid Magenta Primary (`#EC4899`).

### C. Public Cinema Gallery Tokens (`src/components/studio/tokens.ts`)
- **Warm Plaster Canvas (#EAE7DD)**, **Chalk Highlight (#F6F4EE)**, **Dark Graphite Ink (#16181A)**, **Muted Slate (#565A55)**, **Warm Burnished Brass (#9C7B49)**, **Deep Verdigris (#4E6960)**.

---

## 3. Typography Rules

- **Interactive ERP UI:** `DM Sans` (`cv02`, `cv03`, `cv04`, `cv11`) across headings and forms; `-0.035em` display tracking (`h5`), `-0.025em` card header tracking (`h6`), never uppercase buttons (`textTransform: "none"`).
- **Tabular & Document Identifiers:** `JetBrains Mono` / tabular monospace with `font-variant-numeric: tabular-nums` on every Quotation (`QT-00001`), Challan (`DC-00001`), Invoice (`INV-00001`), HSN code, currency rate, and GST column so decimal columns align vertically down every page.
- **Public Studio Gallery:** `Archivo Studio` (variable stretch/weight display) paired with `Newsreader Studio` editorial serif prose.
- **A4 PDF Document Scale (in pt):** Document Title `18pt` Bold, Brand Header `13pt` Bold, Section Eyebrows `8pt` SemiBold tracked uppercase (`0.08em`), Line-Item Title `9.5pt` SemiBold, Line Spec / Description `8pt` Regular (clamped/wrapped cleanly without overflowing row height), Table Cell Numbers `9pt` Tabular, Footer Microcopy `7.5pt` Muted.

---

## 4. Component Stylings

- **Buttons & Interactive Controls:** Subtly rounded corners (`10px` radius), minimum `36px` touch height (`44×44px` hit target for icon-only reorder/delete controls), zero elevation (`disableElevation: true`), smooth `160ms cubic-bezier(.22,1,.36,1)` hover/press feedback, and high-visibility focus rings (`2px solid` primary). SVG icons exclusively (`lucide-react` / `@mui/icons-material`; zero structural emojis).
- **Cards & Drawers:** Generously rounded corners (`16px` card radius; `20px` drawer radius) with crisp `1px solid` hairline dividers. Slide-over `SideDrawer` (`420px`–`760px` width) handles previews, share/email dispatch, customer quick-add, and delivery proof capture with sticky header and sticky bottom footer.
- **Line-Item Editor Table (Quotations & Delivery Challans; Invoices remain crisp commercial table without item photos):**
  - Leftmost **Reorder Rail**: Drag grip (`GripVertical`) paired with accessible single-pointer **Move Up / Move Down** icon buttons (WCAG 2.2 AA Dragging Movements compliance).
  - **Optional Product Thumbnail Cell (`48×48px`, Quotations & Delivery Challans only):** Subtly rounded `8px` bordered image slot (`object-fit: cover`) with hover/click upload (`<=5MB` image validation), remove toggle, and fallback crisp wireframe box icon when toggled off or unset—reserving fixed dimensions (`48×48px`) so toggling/loading never causes layout shift. Tax Invoices omit product thumbnails across both the editor and PDF.
- **Proof-of-Delivery & Acceptance Pads:** Tactile dashed border container (`2px dashed`), high-DPI HTML canvas signature pad (`touch-action: none`), pill-shaped status badges (`>= 4.5:1` contrast), and stepped milestone timeline (`Draft -> Dispatched -> In Transit -> Out for Delivery -> Delivered`) for Delivery Challans.

---

## 5. Layout Principles

- **Two-Column Desktop Builder Layout (12-Column Grid):** Left `8` columns hold the live document sheet (letterhead, dates, Customer Bill/Ship To cards, line-item table, GST/discount totals, notes/terms, bank card); Right `4` sticky column holds primary actions (`Send / Email PDF`, `Preview`, `Download PDF`, `Print`, `Save`) and toggle switches (`Show Item Images`, `GST Inclusive`, `Terms & Conditions`, `Client Notes`).
- **A4 Print & PDF Page Alignment Rules:**
  - Page format `A4 Portrait (210mm × 297mm / 595.28 × 841.89 pt)` with `12mm (34pt)` margins.
  - Repeating table header on multi-page quotes; **individual line-item rows never split across page boundaries** (`break-inside: avoid` in HTML print and dynamic height lookahead in `pdf-lib` before rendering each row).
  - Image cells occupy a fixed-width column (`46pt × 46pt` inside PDF) vertically top-aligned with the item title/spec/HSN stack so rows with and without thumbnails remain flush on the left text rail.
  - Footer carries genuine `ALVStore` identity + page numbers (`Page X of Y`), removing legacy strings (`ORIGINAL COPY — DO NOT ALTER`, `Powered by ERPMaster`).
- **Strict Repo UI Rule:** Every frontend screen uses `@/components/mui/*` and `@mui/material` `sx` props exclusively (zero raw HTML elements in `src/screens` or `src/components`, zero utility classes), validated by `node tools/check-ui.mjs`.
