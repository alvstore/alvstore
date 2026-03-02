

# Glassmorphic Dark Dashboard & UI Transformation Plan

## What We're Building

Transform the entire application to match the Dribbble reference (dark glassmorphic task management dashboard) with the specified design system: `#080808` background, `#121212` cards, `rounded-3xl` corners, vibrant accent KPI cards, and clean sidebar.

## Changes

### 1. Theme Variables (`src/index.css`)
Switch the default `:root` theme to the dark glassmorphic palette:
- `--background`: near `#080808` (0 0% 3%)
- `--card`: near `#121212` (0 0% 7%)
- `--foreground`: white
- `--muted-foreground`: zinc-400
- `--border`: white at ~5% opacity equivalent
- `--sidebar-background`: `#080808`
- Remove the separate `.dark` block (dark IS the default now)
- Update `--radius` to `1.5rem` (24px) for `rounded-3xl` default

### 2. Sidebar Redesign (`src/components/layout/AppSidebar.tsx`)
Match the reference: clean icons, minimalist labels, purple active-state highlight.
- Background `#080808` with right border `white/5`
- Nav items: muted white text, on hover `white/5` background
- Active item: purple/violet left accent + `bg-purple-500/10` + white text
- Category labels: tiny uppercase zinc-500
- Collapse button at bottom

### 3. Header Update (`src/components/layout/AppHeader.tsx`)
- Transparent/glass background with blur
- Search bar with `#121212` bg and `white/5` border
- User avatar + name on the right (matching reference)
- Notification bell

### 4. Dashboard Complete Redesign (`src/pages/Dashboard.tsx`)
Replicate the reference layout:

**Welcome Section**: "Dashboard" title with subtitle, Quick Action buttons (+ New Job Sheet, Import Data)

**KPI Cards Row** (4 columns):
- Each card: `#121212` bg, `rounded-3xl`, `border white/5`
- Icon-on-top layout with 48x48 icon container at 10% opacity accent background
- Accent colors: Purple (Revenue), Green (Sales), Blue (Customers), Orange (Repairs)
- Large bold number, trend text below ("Increased from last month")
- Arrow icon top-right

**Analytics Section** (2-col grid):
- "Sales Analytics" bar chart (weekly, with green gradient bars matching reference)
- "Recent Activity / Reminders" card

**Bottom Row** (3-col grid):
- "Team Collaboration" card with employee avatars + status badges
- "Repair Progress" donut chart (percentage in center)
- Recent Invoices list

All charts use the dark theme: no grid lines visible, green/accent colored bars, clean axes.

### 5. Global Card Component Update (`src/components/ui/card.tsx`)
- Default classes: `bg-card rounded-3xl border border-white/5`
- Hover state: `hover:border-white/20` transition

### 6. Skeleton Loader Enhancement (`src/components/ui/skeleton.tsx`)
- Use `bg-white/5` pulse animation for dark theme skeleton loaders

### 7. Button Styling
- Primary buttons: solid white bg with black text
- Secondary: outline with `white/10` border

## Files to Modify
```text
src/index.css                        -- Dark glassmorphic theme as default
src/components/ui/card.tsx           -- rounded-3xl, dark card defaults
src/components/ui/skeleton.tsx       -- Dark skeleton style
src/components/layout/AppSidebar.tsx -- Purple active state, clean design
src/components/layout/AppHeader.tsx  -- Glass header with search bar
src/pages/Dashboard.tsx              -- Full redesign matching reference
```

## Implementation Order
1. `src/index.css` -- theme variables (foundation)
2. `src/components/ui/card.tsx` -- card styling
3. `src/components/layout/AppSidebar.tsx` -- sidebar redesign
4. `src/components/layout/AppHeader.tsx` -- glass header
5. `src/pages/Dashboard.tsx` -- full dashboard redesign
6. `src/components/ui/skeleton.tsx` -- dark skeletons

