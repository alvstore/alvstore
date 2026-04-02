

# Cinematic Home Theater Website + CRM Enhancements

This is a large, multi-phase request. Here is the prioritized implementation plan.

## Current State

- `/home-theater` route exists with a functional but generic SaaS-style page
- Three.js scene exists (`TheaterScene.tsx`) with speakers/screen — uses purple/indigo palette
- WhatsApp edge function exists (`send-whatsapp/index.ts`) but no webhook receiver or settings UI
- Notification system exists in `AppHeader.tsx` with realtime — but few triggers wired up

## Phase 1 — Design System + Hero (this approval cycle)

### File: `src/lib/design-system.ts`
Export all tokens as constants:
- Colors: `CINEMA_BLACK (#000000)`, `DEEP_NAVY (#050A18)`, `GOLD (#FFD700)`, `AMBER (#FF8C00)`, `WARM_WHITE (#F5F0E8)`
- Typography scale: display (72/80px), h1-h4, body, caption — fonts: Cinzel (display), DM Sans (body)
- Animation timings: `HERO_LETTER_DELAY`, `STAGGER_DELAY`, `SECTION_FADE_DURATION`
- Spacing scale: 4/8/12/16/24/32/48/64/96/128

### File: `src/pages/public/HomeTheaterHome.tsx` — Full Rewrite
Replace entire page with cinematic design:

**Hero Section:**
- Full 100vh, black background
- Three.js particle starfield (500 points, slow drift, scroll-zoom parallax) via new `CinemaParticles.tsx`
- Letter-by-letter "EXPERIENCE CINEMA AT HOME" using Framer Motion `staggerChildren`
- Subheading fade-in 800ms after heading
- Gold-bordered CTA with pulse glow
- Bouncing chevron scroll indicator
- Mobile: CSS gradient fallback (no Three.js)

**Services Section:**
- Horizontal scroll container with 4 cards
- CSS `transform-style: preserve-3d` + `rotateY(180deg)` on hover for card flip
- Front: gradient placeholder + title + tagline
- Back: 3 features + price range + CTA
- Staggered scroll-triggered entrance via Framer Motion

**Gallery Section:**
- Masonry grid (3/2/1 cols responsive)
- Hover: scale 1.05 + overlay with project name + location
- Click: fullscreen lightbox modal
- Placeholder gradient cards for now

**Testimonials Section:**
- Auto-scrolling infinite carousel (CSS animation, pause on hover)
- Dark glassmorphism cards: `rgba(255,255,255,0.05)` bg, 1px white/10 border

**Fixed Navigation:**
- Transparent over hero, solid black + backdrop-blur on scroll
- Logo left, nav center, "Get Quote" gold button right
- Mobile: hamburger → fullscreen overlay

### New File: `src/components/home-theater/CinemaParticles.tsx`
- @react-three/fiber Canvas with 500 particles (BufferGeometry + Points)
- Slow random drift, scroll-based Z-axis parallax
- Gold/amber color palette for particles

### Dependency: `framer-motion`

### Font: Add Cinzel + DM Sans to `index.html` via Google Fonts link

## Phase 2 — WhatsApp Settings + Webhook (next cycle)
- WhatsApp settings page at `/settings` (new tab, not separate route)
- `whatsapp-webhook` edge function with GET verify + POST message handling
- New tables: `whatsapp_messages`, `whatsapp_conversations`
- Widget generator UI + `/public/whatsapp-widget.js`

## Phase 3 — Notification Expansion + Security Audit (final cycle)
- Wire `createNotification` into quotation, invoice, payment, attendance workflows
- Notification drawer with date grouping
- Security checklist review and fixes

## Files Changed (Phase 1)

```
CREATE:  src/lib/design-system.ts
CREATE:  src/components/home-theater/CinemaParticles.tsx
REWRITE: src/pages/public/HomeTheaterHome.tsx
EDIT:    index.html (add Google Fonts)
INSTALL: framer-motion
```

## Technical Notes
- Framer Motion v11 is compatible with React 18
- Three.js particles use `BufferGeometry` + `PointsMaterial` for performance (no individual mesh per particle)
- Mobile detection via existing `useIsMobile()` hook to skip Three.js canvas
- All existing lead capture form logic preserved in the rewrite
- Configurator component kept as-is, restyled to match new palette

