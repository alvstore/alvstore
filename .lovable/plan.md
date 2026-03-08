
# Multi-Theme System, KPI Overhaul, and Employee Login Audit

## Overview

Add a multi-theme switcher with 6+ advanced color themes, redesign KPI cards to match the reference images, and audit/fix the employee creation flow to enforce login credentials for chat access.

## Phase 1: Theme Provider and Multiple Themes

### New File: `src/hooks/useTheme.tsx`
Create a React context-based theme provider that:
- Stores selected theme name in `localStorage` (key: `app-theme`)
- Applies the theme by setting CSS variables on `document.documentElement`
- Exposes `theme`, `setTheme`, and `themes` list

### Themes (6 total):

1. **Obsidian** (current dark) -- Background `#080808`, Card `#121212`, accent Purple
2. **Forest Minimal** (from reference) -- Background `#F9FAFB`, Cards `#FFFFFF`, accent Forest Green `#065F46`, borders `#E5E7EB`
3. **Ocean Deep** -- Background `#0A1628`, Card `#111D35`, accent Cyan `#06B6D4`
4. **Sunset Ember** -- Background `#1A0F0A`, Card `#241610`, accent Amber `#F59E0B`
5. **Arctic** -- Background `#F0F4F8`, Card `#FFFFFF`, accent Indigo `#4F46E5`, borders `#CBD5E1`
6. **Midnight Rose** -- Background `#0F0515`, Card `#1A0B22`, accent Pink `#EC4899`

Each theme is a plain JS object mapping CSS variable names to HSL values. When applied, all variables under `:root` are overwritten. This means the entire app (cards, sidebar, header, charts) adapts automatically -- no component changes needed.

### Theme Switcher UI
Add a palette icon button in `AppHeader.tsx` (next to notifications). Clicking opens a dropdown with theme swatches (small colored circles + name). Selected theme gets a checkmark.

### Files:
- **Create** `src/hooks/useTheme.tsx` -- ThemeProvider context + 6 theme definitions
- **Edit** `src/main.tsx` -- Wrap app in `<ThemeProvider>`
- **Edit** `src/components/layout/AppHeader.tsx` -- Add theme switcher dropdown
- **Edit** `src/index.css` -- Keep current variables as the "Obsidian" default; add `.glass` and `.glass-sidebar` conditional styles that work in both light and dark

### Adaptive Components
The sidebar, header, and dashboard currently use hardcoded hex colors (`bg-[#080808]`, `bg-[#121212]`, `text-white`, `text-zinc-500`). These must be replaced with semantic Tailwind classes:
- `bg-[#080808]` becomes `bg-background`
- `bg-[#121212]` becomes `bg-card`
- `text-white` becomes `text-foreground`
- `text-zinc-500` becomes `text-muted-foreground`
- `border-white/5` becomes `border-border`

This ensures all themes work automatically.

### Files to update for semantic colors:
- `src/components/layout/AppSidebar.tsx`
- `src/components/layout/AppHeader.tsx`
- `src/pages/Dashboard.tsx`

## Phase 2: KPI Card Redesign (Reference Match)

Redesign the `KpiCard` component in `Dashboard.tsx` to exactly match the uploaded reference images:

**Layout per card:**
- Top row: Label text (left) + arrow-up-right icon button (right corner)
- Center: Large bold metric number (32-40px)
- Bottom: Trend indicator with wave icon + "Increased from last month" text in accent color

**Accent color system**: Each card gets a unique subtle background tint:
- Card 1 (Revenue): Soft green background tint
- Card 2 (Sales): White/neutral
- Card 3 (Repairs): White/neutral
- Card 4 (Pending): White/neutral

The first card (most important KPI) gets a colored border-left accent strip.

**Contextual KPIs to display:**
- Daily Cash Flow (from `finance_transactions`)
- Store Sales with 18% GST indicator
- Gym Revenue with 5% GST indicator
- Active Repairs count

## Phase 3: Employee Login Enforcement

### Problem
Currently employees can be created WITHOUT email/password. These employees cannot use the chat system because they lack authentication accounts.

### Fix in `src/pages/Employees.tsx`:
1. Add a prominent "Create with Login" toggle/checkbox in the employee form
2. When toggled ON (default for internal employees), make email and password fields REQUIRED
3. Show a warning banner: "Employees without login credentials cannot access Chat, Tasks, or other system features"
4. For existing employees without `user_id`, show a "Link Login Account" button that:
   - Opens a mini-form asking for email + password
   - Calls `manage-staff` edge function with `action: "create"` to create the auth account
   - Updates the employee record with the returned `user_id`

### Visual indicator in employee list:
- Show a small shield/lock icon next to employees who have a linked auth account
- Show a warning icon next to employees without one

## Phase 4: Chart Theme Adaptation

Update the Recharts tooltip and gradient colors in `Dashboard.tsx` to use CSS variables instead of hardcoded hex:
- Tooltip background: `hsl(var(--card))`
- Tooltip border: `hsl(var(--border))`
- Bar gradient: Use the theme's accent/success color
- Axis text: `hsl(var(--muted-foreground))`

This ensures charts look correct in both light and dark themes.

## Files Summary

```text
NEW:  src/hooks/useTheme.tsx            -- Theme provider with 6 themes
EDIT: src/main.tsx                       -- Wrap in ThemeProvider
EDIT: src/index.css                      -- Keep as Obsidian default, add light-mode glass variants
EDIT: src/components/layout/AppHeader.tsx -- Add theme switcher, replace hardcoded colors
EDIT: src/components/layout/AppSidebar.tsx -- Replace hardcoded colors with semantic classes
EDIT: src/pages/Dashboard.tsx            -- KPI redesign, semantic colors, chart adaptation
EDIT: src/pages/Employees.tsx            -- Login enforcement, link-account button
```

## Database Changes
None required.

## Implementation Order
1. `src/hooks/useTheme.tsx` -- Create theme provider (foundation)
2. `src/index.css` -- Ensure variables are the correct defaults
3. `src/main.tsx` -- Wire up provider
4. `src/components/layout/AppSidebar.tsx` -- Semantic colors
5. `src/components/layout/AppHeader.tsx` -- Semantic colors + theme switcher
6. `src/pages/Dashboard.tsx` -- KPI redesign + chart adaptation
7. `src/pages/Employees.tsx` -- Login enforcement
