
Audit summary: the module is not failing because of one formula only; it has a workflow mismatch between imported product data, pricing rules, offer matching, and calculator UX.

1. Core bug to fix first
- The imported product category is stored as uppercase like `IPHONE`.
- The pricing rule row is stored as `iPhone`.
- The code uses exact lookup: `ruleMap[product.category]`.
- Result: no rule is found, so:
  - base discount = 0
  - cash discount = 0
  - landing cost = MRP - 0 - 0
  - final cost = same as MRP
- This is the main reason you are seeing MRP and landing cost as equal.

2. Pricing logic issues found
- Base discount is currently being applied on MRP, which matches your “MRP less 5.5% include GST 18%” requirement for iPhone.
- Cash discount is configured as `0.5% on base price`, but it is hidden whenever rule lookup fails.
- Cash discount is always auto-subtracted from final cost when a rule exists. That is wrong for your workflow because cash discount is optional and should only apply when advance payment is available.
- Offer matching is also fragile because:
  - category matching is exact
  - product keyword matching is plain substring
  - expired offers are still loaded into the calculation pool

3. Search/calculator UX issues found
- Catalog search only checks `description` and `part_number`.
- Calculator product picker is a long dropdown with no search.
- No dedicated calculator search by SKU, product family, storage, or color.
- This makes the calculator hard to use with a large Apple list.

4. Production upgrade plan

A. Normalize the pricing engine data layer
- Normalize category matching everywhere:
  - compare categories case-insensitively
  - trim spaces
  - optionally standardize imported categories to canonical labels
- Add a helper for canonical category keys so products, rules, and offers all align.
- Update rule matching and offer matching to use normalized values.

B. Fix the calculation workflow
- Keep iPhone base rule as:
  - Base Discount = MRP × 5.5%
- Keep Base Price as:
  - Base Price = MRP / 1.18
- Compute:
  - Landing Cost = MRP - Base Discount - Offer Discount
- Make cash discount optional with a toggle:
  - “Apply Cash Discount”
  - default OFF
- Only when ON:
  - Cash Discount = Base Price × 0.5%
  - Final Cost = Landing Cost - Cash Discount
- When OFF:
  - Final Cost = Landing Cost
- Show a note in UI that cash discount requires advance billing/payment.

C. Improve the UI breakdown
- Update calculator and row expansion to show:
  - MRP
  - Base Price (ex GST)
  - Base Discount 5.5% on MRP
  - Offer Discount
  - Landing Cost
  - Cash Discount (optional)
  - Final Cost
- Add explicit labels so users understand:
  - “Base Discount on MRP (incl GST)”
  - “Cash Discount on Base Price (ex GST)”
- Show the rule source card for selected product:
  - matched category
  - base rule
  - cash rule
  - applied offers

D. Enhance calculator search
- Replace the plain Select product dropdown with searchable product selection.
- Search across:
  - description
  - part number / SKU
  - category
  - storage capacity terms
  - color words
- Add quick filters in calculator:
  - category
  - with offers only
  - recently imported / new
- Keep the selected product pinned at top of results.

E. Tighten offer logic
- Exclude expired offers from active calculations by date.
- Normalize category/product matching.
- Show “best offer available” separately from “selected offers”.
- Prevent accidental double discounting where only one scheme should apply.

F. Validate imported data
- Audit import flow so category values are normalized during import.
- Detect duplicates and blank required fields earlier.
- Add import preview warnings for:
  - unknown category
  - missing MRP
  - missing SKU
  - mixed category casing

5. Files to update
- `src/pages/ApplePricing.tsx`
  - normalize category matching
  - fix pricing helpers
  - add optional cash discount toggle
  - improve breakdown labels
  - replace calculator selector with searchable product finder
  - exclude expired offers
- New migration recommended
  - optionally normalize existing `apple_products.category` values
  - optionally normalize existing `apple_pricing_rules.category` values
  - optionally add a canonical category constraint or helper strategy

6. Recommended implementation order
- Step 1: fix category normalization and rule lookup
- Step 2: fix optional cash discount behavior
- Step 3: fix offer filtering by active date
- Step 4: improve calculator search UX
- Step 5: improve import normalization so the bug does not return

7. Expected result after fix
For iPhone products with your active rule:
- MRP will no longer equal landing cost
- 5.5% base discount will apply correctly
- 0.5% cash discount on base price will appear as an optional switch, not forced
- calculator search will be usable on large Apple catalogs
- pricing output will match actual billing workflow more closely

Technical notes
- Current live data confirms the mismatch:
  - products category: `IPHONE`
  - active rule category: `iPhone`
- Current rule data already contains:
  - discount_percentage = 5.5
  - cash_discount_type = `on_base_price`
  - cash_discount_value = 0.5
  - cash_discount_mode = `percentage`
- So the data for the rule exists; the lookup logic is what is breaking the workflow.
