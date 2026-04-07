

# Enhancement Plan — Payment Register, Public Website 3D, & SEO

## 1. Payment Register Redesign

### Current Issues
- Missing fields for proper MDR tracking: no MDR percentage, no card network (Visa/MC/Amex/Rupay), no deposit bank vs issuing bank distinction
- No net banking payment mode
- Bank charges are manual — no auto-calculation from MDR %
- No settlement date tracking (when bank actually credits the amount)
- Cheque fields exist but lack deposit bank name

### Database Migration
Add new columns to `payment_register`:
```sql
ALTER TABLE payment_register
  ADD COLUMN IF NOT EXISTS card_network text,        -- visa, mastercard, amex, rupay
  ADD COLUMN IF NOT EXISTS mdr_percentage numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS deposit_bank_name text,   -- bank where cheque/card settlement goes
  ADD COLUMN IF NOT EXISTS settlement_date date,     -- when bank credits the amount
  ADD COLUMN IF NOT EXISTS payment_sub_mode text;    -- credit_card, debit_card, net_banking, upi, neft, rtgs, imps
```

### UI Redesign — `src/pages/PaymentRegister.tsx`
- **Payment modes expanded**: Card (Credit/Debit with network), UPI, Net Banking, NEFT/RTGS/IMPS, Cheque
- **MDR auto-calc**: When card network + type selected, auto-suggest MDR % (Visa Debit ~0.4%, Credit ~1.8%, Amex ~2.2%, Rupay Debit ~0%, etc.) — editable override
- **Bank charges auto-fill**: `bank_charges = received_amount × mdr_percentage / 100`
- **Deposit bank**: Separate field for "Deposit/Settlement Bank" (where the money lands)
- **Settlement date**: Track when bank actually credits the net amount
- **Enhanced form sections**: Payment Info → MDR & Charges → Banking Details → Cheque Details → Reconciliation
- **Table columns update**: Add Card Network, MDR%, Settlement Date, Deposit Bank
- **KPI enhancement**: Add "Total MDR Paid" card

### Files
```
MIGRATE: Add card_network, mdr_percentage, deposit_bank_name, settlement_date, payment_sub_mode
REWRITE: src/pages/PaymentRegister.tsx
```

---

## 2. Public Website — 3D Scrolling Enhancement

### Current State
- CinemaParticles renders a 500-point starfield — static feel, no scroll interaction beyond z-parallax
- No 3D objects (speakers, projectors, room) in the scene
- Page sections fade in but have no scroll-linked 3D transformations
- Feels flat despite the dark cinematic palette

### Plan
- **Add 3D floating objects to CinemaParticles**: Speaker boxes, projector cylinder, and sound wave torus rings using Three.js primitives — these float and rotate as user scrolls
- **Scroll-linked 3D room reveal**: New Three.js component `TheaterRoom3D` — a wireframe theater room (walls as boxes, screen as plane, seats as low-poly shapes) that rotates/reveals as the user scrolls past the services section
- **Parallax depth layers**: Gold dust particles in foreground at 2x scroll speed, starfield at 0.5x — CSS layers with `transform: translateY` based on scroll
- **Ambient glow orbs**: CSS radial gradient orbs that drift between sections using CSS animations
- **Section dividers**: Gold gradient line separators between major sections
- **Warm up the palette**: Add subtle gold/amber gradient overlays between pure black sections

### Files
```
EDIT: src/components/home-theater/CinemaParticles.tsx (add 3D speaker/projector/rings)
CREATE: src/components/home-theater/TheaterRoom3D.tsx (scroll-linked wireframe room)
EDIT: src/pages/public/HomeTheaterHome.tsx (integrate 3D room, parallax layers, dividers, glow orbs)
```

---

## 3. SEO Hardening

### Current State
- Meta tags in `index.html` already have proper title, description, OG tags, JSON-LD
- `sitemap.xml` and `robots.txt` exist
- Missing: per-page `document.title`, `meta description` updates, canonical tags per route

### Plan
- Add `useEffect` to set `document.title` on `HomeTheaterHome` mount with rich keyword title
- Add meta description tag dynamically
- Ensure no "Lovable" references remain anywhere in rendered HTML
- Add `rel="canonical"` dynamically for the home route
- Verify JSON-LD LocalBusiness schema has real phone/address (currently placeholder `+91-XXXXXXXXXX`)

### Files
```
EDIT: src/pages/public/HomeTheaterHome.tsx (dynamic title, meta tags)
EDIT: index.html (verify no branding leaks)
```

---

## Implementation Order
1. Payment Register migration + rewrite
2. 3D scrolling enhancements (CinemaParticles + TheaterRoom3D + HomeTheaterHome)
3. SEO hardening

