

# Redesign Plan: Dashboard KPIs, Follow-Ups, and Landing Page

## 1. Dashboard -- Promote Secondary KPIs to Full Cards

**File: `src/pages/Dashboard.tsx`**

The "Cash Balance", "Pending Payments", "Invoices (Month)", and "Low Stock Items" are currently in a cramped secondary row (lines 166-183) with minimal styling. Redesign:

- Remove the secondary stats row entirely
- Merge those 4 metrics into the primary KPI grid, making it a 2-row, 4-column grid (8 total KPI cards)
- All 8 cards use the full `KpiCard` component with proper icon backgrounds, trend lines, and arrow buttons
- Order: Today's Sales, Monthly Revenue, Cash Balance, Pending Payments (row 1) | Customers, Active Repairs, Invoices (Month), Low Stock Items (row 2)
- Low Stock card links to `/inventory`, Pending Payments links to `/payments`

---

## 2. Follow-Ups -- Full Redesign with Recording UI

**File: `src/pages/FollowUps.tsx`**

**Database Migration**: Create a `follow_up_notes` table to persist follow-up records:
```sql
CREATE TABLE public.follow_up_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL,        -- 'quotation' | 'job_sheet'
  entity_id uuid NOT NULL,
  note text NOT NULL,
  outcome text,                     -- 'interested' | 'not_interested' | 'callback' | 'converted' | 'no_answer'
  next_follow_up_date date,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.follow_up_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage follow_up_notes"
  ON public.follow_up_notes FOR ALL TO authenticated USING (true) WITH CHECK (true);
```

**UI Redesign:**
- **KPI Row** (4 cards): Total Follow-Ups Due, Overdue (>7 days), Completed Today, Conversion Rate
- **Two-column layout**: Left = follow-up list (tabbed quotations/repairs), Right = detail panel
- **Follow-Up Recording Sheet**: When user clicks a row or "Record Follow-Up" button, open a Sheet/drawer with:
  - Customer name + entity info (read-only header)
  - Outcome selector (radio): Interested, Not Interested, Callback Later, Converted, No Answer
  - Notes textarea
  - Next Follow-Up Date picker
  - Save button -- inserts into `follow_up_notes`, creates a calendar event if next date is set
- **History Timeline**: Below the recording form, show previous follow-up notes for this entity as a vertical timeline
- **Visual indicators**: Color-coded urgency badges (green <3d, yellow 3-7d, red >7d)

---

## 3. Landing Page -- Premium Apple/AV Dealer Theme

**File: `src/pages/LandingPage.tsx`** -- Complete rewrite

Since the user is an Apple products, home theater, and professional audio dealer, the landing page should reflect that identity with a premium, Apple-inspired aesthetic. Using CSS-only 3D transforms and gradients (no Three.js needed for this scope).

**Design:**
- **Hero**: Full-viewport dark gradient background with large floating 3D CSS-transformed product cards (iPhone, HomePod, soundbar silhouettes using CSS shapes/gradients). Headline: store name + "Premium Audio & Apple Experience". CTA buttons to login/signup.
- **Product Categories Section**: 3 large cards with perspective transforms on hover -- "Apple Products", "Home Theater", "Professional Audio" -- each with a gradient icon and description
- **Features Grid**: Service capabilities (Authorized Repairs, Expert Installation, Trade-In, Financing) with glass-morphism cards
- **Brands Marquee**: Scrolling strip of brand names (Apple, Sonos, Bose, JBL, Harman Kardon, etc.) using CSS animation
- **Stats Strip**: "500+ Repairs", "1000+ Products", "98% Satisfaction" counters
- **CTA + Footer**: Dark premium footer with contact info and social links

**Color palette**: Deep blacks (#0a0a0a), white text, accent gradients (blue-purple for Apple, amber for audio warmth). CSS `transform: perspective() rotateY()` for 3D hover effects on cards.

---

## Files Summary

```text
MIGRATION:   follow_up_notes table
EDIT:        src/pages/Dashboard.tsx        -- Merge secondary KPIs into primary grid
REWRITE:     src/pages/FollowUps.tsx        -- Full redesign with recording UI + KPIs
REWRITE:     src/pages/LandingPage.tsx      -- Premium Apple/AV dealer theme
```

## Implementation Order
1. Database migration (follow_up_notes)
2. Dashboard KPI merge
3. Follow-Ups redesign
4. Landing page rewrite

