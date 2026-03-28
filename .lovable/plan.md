

# Apple Pricing Engine — Production Upgrade

## What Changes

### 1. Excel Import System (in-browser)
Add an "Import" tab with:
- File upload input for `.xlsx` files
- Field mapping UI: dropdowns to map Excel columns → system fields (Part Number, Description, Category, MRP, ALP Ex VAT, GST%)
- Save/reuse mapping templates (stored in `localStorage`)
- Preview of first 5 rows before import
- Batch upsert into `apple_products` (upsert on `part_number` to prevent duplicates)
- Import history section showing last imports with count + timestamp

### 2. Manual Offer Entry Form
Add "Add Offer" dialog in the Offers tab:
- Fields: Offer Type, Bank Name, Category, Product (optional), Discount Amount, Description, Start/End Date
- Insert into `apple_offers`
- PDF upload is informational only (no server-side parsing in this stack)

### 3. Cash Discount Engine

**Database Migration:**
```sql
ALTER TABLE public.apple_pricing_rules
  ADD COLUMN IF NOT EXISTS cash_discount_type text DEFAULT 'on_base_price',
  ADD COLUMN IF NOT EXISTS cash_discount_value numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cash_discount_mode text DEFAULT 'percentage';
```
- `cash_discount_type`: `on_base_price` / `on_mrp` / `on_landing_cost`
- `cash_discount_mode`: `percentage` / `fixed`

### 4. Updated Calculation Engine
Current formula is too simple. New formula:

```
Base Price = MRP / (1 + GST%)
Base Discount = MRP * rule.discount_percentage%
Offer Discount = best applicable offer amount
Landing Cost = MRP - Base Discount - Offer Discount
Cash Discount = applied on (Base Price | MRP | Landing Cost) based on type
Final Cost = Landing Cost - Cash Discount
Margin = Selling Price - Final Cost
```

Update `getBaseDiscount`, `getLandingCost`, and calculator to use this formula. Add `getCashDiscount` and `getFinalCost` helpers.

### 5. UI Improvements
- Add action buttons row: "Import Excel", "Add Product", "Add Offer", "Recalculate All"
- Add "Add Product" dialog for manual single-product entry
- Calculator tab: add Cash Discount section showing breakdown (MRP → Base Price → Base Disc → Offer Disc → Cash Disc → Final Cost → Margin)
- Catalog table: add "Final Cost" column after Landing Cost
- Show calculation breakdown on row click/expand

### 6. Validation
- Upsert on `part_number` prevents duplicate products
- Offer date validation (warn if expired)
- Required field validation on all forms

### 7. Performance
- Already paginated to 100 rows with virtual scroll message
- Add `useMemo` on all computed values (already done)
- No changes needed

## Files

```text
MIGRATION:  Add cash_discount columns to apple_pricing_rules
EDIT:       src/pages/ApplePricing.tsx
            - Add Import tab with Excel upload + field mapping
            - Add "Add Product" dialog
            - Add "Add Offer" dialog  
            - Update calculation engine with Base Price + Cash Discount
            - Add action buttons row
            - Enhanced calculator breakdown
            - Final Cost column in catalog
```

No new files needed — all changes fit in the existing page component.

