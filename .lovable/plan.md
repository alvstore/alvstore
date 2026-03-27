

# Apple Pricing Engine & Offer Management System

## Overview

Build a new module at `/apple-pricing` that imports product data from the uploaded Apple price list and offers PDF, stores it in a new database table, and provides a powerful pricing calculator with offers, margins, and search.

## Data Analysis

The uploaded files contain:
- **Price List**: ~2500 lines covering all Apple categories (iPhone, Mac, iPad, Watch, AirPods, Accessories, AppleCare) with Part Number, Description, ALP Inc VAT (MRP), ALP Ex VAT
- **Offers PDF**: Q3'26 affordability offers — Card EMI cashbacks (₹1K-₹7K by product), Loan discounts, Trade-in offers by bank (Axis, ICICI, SBI Card, Bajaj Finance, HDB)

## Database Migration

**New table: `apple_products`**

```sql
CREATE TABLE public.apple_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  part_number text NOT NULL UNIQUE,
  description text NOT NULL,
  sap_description text,
  category text NOT NULL, -- iPhone, Mac, iPad, Watch, AirPods, Accessories, AppleCare, HomePod, Beats
  subcategory text,
  mrp numeric NOT NULL DEFAULT 0,
  alp_ex_vat numeric NOT NULL DEFAULT 0,
  gst_percentage numeric DEFAULT 18,
  is_new boolean DEFAULT false,
  status text DEFAULT 'active',
  created_at timestamptz DEFAULT now()
);
```

**New table: `apple_offers`**

```sql
CREATE TABLE public.apple_offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_type text NOT NULL, -- card_emi, card_fs, loan, trade_in, iphone_for_life
  bank_name text,
  applicable_category text NOT NULL,
  applicable_product text, -- specific product name pattern
  discount_amount numeric DEFAULT 0,
  discount_description text,
  start_date date,
  end_date date,
  status text DEFAULT 'active',
  created_at timestamptz DEFAULT now()
);
```

**New table: `apple_pricing_rules`**

```sql
CREATE TABLE public.apple_pricing_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL,
  discount_percentage numeric DEFAULT 0,
  discount_amount numeric DEFAULT 0,
  rule_name text,
  status text DEFAULT 'active',
  created_at timestamptz DEFAULT now()
);
```

RLS: admin + staff full access on all three tables.

## Data Seeding

Parse the uploaded Excel and PDF via a backend function to insert:
- ~300+ unique consumer products (filtering out Demo, Enterprise AppleCare, volume licenses) into `apple_products`
- Q3'26 offers (Card EMI cashbacks, Loan discounts per product category) into `apple_offers`

This will be done via an edge function `import-apple-pricing` that accepts the parsed data as JSON.

## New Page: `src/pages/ApplePricing.tsx`

### KPI Cards (5)
- Total Products
- Active Offers
- Avg Margin %
- Best Margin Product
- Products with Offers

### Tabs
1. **Product Catalog** — Searchable table of all Apple products with MRP, ALP Ex VAT, category filter, and margin column
2. **Pricing Rules** — Admin-editable category-wise discount rules (iPhone → X%, MacBook → Y%)
3. **Offers & Schemes** — Grid of active offers by type (Card EMI / Loan / Trade-in), bank, amount, applicable products
4. **Price Calculator** — Select product → auto-show MRP, apply base discount (from rules), select applicable offers, live calculate Landing Cost, Selling Price, Margin with color coding (green profit, red loss)

### Calculator Logic
```
Landing Cost = MRP - Base Discount (from pricing rules) - Offer Discount
Margin = Selling Price - Landing Cost
```

Color coding:
- Green badge if margin > 0
- Red badge if margin < 0
- Orange if margin = 0

### Features
- Search by product name, part number, category
- Filter by category, offer availability, margin range
- Compare up to 3 products side-by-side
- CSV export of filtered product list
- "Best margin" sort option

## Routing & Navigation

- Route: `/apple-pricing` in App.tsx
- Sidebar: Add "Apple Pricing" under Commerce category with a Tag/DollarSign icon

## Files Summary

```text
MIGRATION:  apple_products, apple_offers, apple_pricing_rules + RLS
CREATE:     src/pages/ApplePricing.tsx
CREATE:     supabase/functions/import-apple-pricing/index.ts (data import endpoint)
EDIT:       src/App.tsx (add route)
EDIT:       src/components/layout/AppSidebar.tsx (add nav item)
```

## Implementation Approach

Due to the large dataset (~2500 lines), the data import will:
1. Parse the Excel in the edge function, filtering to consumer products only (skip Demo, Enterprise, volume licenses)
2. Auto-categorize based on section headers (iPhone, Mac, iPad, Watch, etc.)
3. Parse offers from the PDF structure into structured offer records
4. Insert all data in one batch

The page will then read from these tables for real-time search, filtering, and calculations.

