# ALV Store Public Website — Cinematic Redesign

**"Where Luxury Meets Entertainment"** — a bright, premium, scroll-driven experience anchored by a hero animation where a small bookshelf speaker transforms into a full floor-standing tower across animated frames as you scroll.

---

## 1. Design Direction — Out with Pure Black

### Current Problems
- Background is `#000000` everywhere — flat, oppressive, "dark mode forever"
- Animations are passive (rotating starfield, floating cards) — nothing reacts to the user
- No moment of "wow" — every section feels the same
- Gold accents disappear into the void instead of glowing against contrast

### New Palette — "Theater Lobby at Golden Hour"
```
Base background:     #0E0B14  (warm near-black with violet tint)
Stage gradient:      #1A1228 → #2A1B3D  (rich plum, used in hero & CTA)
Surface light:       #F7F3EC  (warm ivory — for "lit" sections)
Champagne gold:      #E8B86C  (softer, more luxurious than pure #FFD700)
Deep gold:           #B8862E
Accent rose:         #C97B6E  (warm spotlight tint)
Soft white text:     #F5EFE3
```

Sections **alternate** between dark stage and ivory "lobby" backgrounds — creates visual rhythm instead of one long dark tunnel.

---

## 2. Hero Centerpiece — The Speaker Transformation

The signature moment of the site. As the user scrolls the hero, **the same speaker grows from a compact bookshelf model into a full floor-standing tower**, frame by frame, inside a stylized cinematic frame border.

### Concept
```text
Frame 0 (top of page):                Frame 1 (scroll 33%):           Frame 2 (scroll 66%):           Frame 3 (scroll 100%):
┌─────────────┐                       ┌─────────────┐                  ┌─────────────┐                 ┌─────────────┐
│             │                       │   ┌───┐     │                  │   ┌───┐     │                 │   ┌───┐     │
│   ┌───┐     │       →               │   │ ◉ │     │       →          │   │ ◉ │     │       →         │   │ ◉ │     │
│   │ ◉ │     │                       │   │ ◉ │     │                  │   │ ◉ │     │                 │   │ ◉ │     │
│   └───┘     │                       │   │ ◯ │     │                  │   │ ◯ │     │                 │   │ ◯ │     │
│             │                       │   └───┘     │                  │   │ ◯ │     │                 │   │ ◯ │     │
│ "Bookshelf" │                       │"2-Way Tower"│                  │   └───┘     │                 │   │ ◯ │     │
└─────────────┘                       └─────────────┘                  │"3-Way Tower"│                 │   └───┘     │
                                                                       └─────────────┘                 │"Reference"  │
                                                                                                       └─────────────┘
```

Each "frame" is a film-strip style window with sprocket holes, gold edge glow, and a caption that crossfades. The speaker itself is a single Three.js model whose **height, driver count, cabinet depth, grille pattern, and spotlight intensity** are all driven by a normalized scroll value (0 → 1).

### Implementation
- New component `SpeakerEvolution.tsx` — Three.js scene with one parametric speaker
- Scroll progress (0–1) drives:
  - `cabinet.scale.y` 1 → 2.6
  - Number of woofer cones rendered (1 → 4) via array map
  - `tweeter.position.y` raises with cabinet
  - Wood grain material darkens (oak → walnut → ebony)
  - Floor base appears below speaker after 0.5
  - Gold spotlight intensity ramps up
- Around the speaker: a CSS-styled film frame (sprocket hole pseudo-elements, gold border, slight perspective tilt)
- To the right of the frame: animated copy block that swaps tier name + spec list using Framer Motion's `AnimatePresence`
- Pinned section using GSAP ScrollTrigger (`pin: true, scrub: 1`) for smoothness — already a stated user preference per the message

### Hero Copy (animated swap)
| Scroll % | Tier            | Caption                              |
|----------|-----------------|--------------------------------------|
| 0        | Bookshelf       | "Where it begins."                   |
| 33       | Compact Tower   | "Where rooms become stages."         |
| 66       | Floor-Standing  | "Where you stop watching, and feel." |
| 100      | Reference Tower | "Where Luxury Meets Entertainment."  |

The brand tagline lands as the final frame — a payoff, not a header.

---

## 3. Section-by-Section Redesign

```text
┌────────────────────────────────────────────────────┐
│  NAV (transparent → ivory glass on scroll)         │
├────────────────────────────────────────────────────┤
│  HERO — Speaker Evolution (pinned, scroll-driven)  │  dark stage
├────────────────────────────────────────────────────┤
│  SOUNDSTAGE — animated 7.1.4 speaker layout        │  dark stage
│  (top-down theater with pulsing sound waves        │
│   as you scroll past each speaker position)        │
├────────────────────────────────────────────────────┤
│  SERVICES — kept flip cards, restyled on ivory     │  ivory lobby
├────────────────────────────────────────────────────┤
│  CONFIGURATOR (existing component, restyled)       │  dark stage
├────────────────────────────────────────────────────┤
│  PROJECTS — horizontal scroll gallery with         │  ivory lobby
│  marquee-style "now playing" film strip header     │
├────────────────────────────────────────────────────┤
│  TESTIMONIALS — theater-seat carousel              │  dark stage
├────────────────────────────────────────────────────┤
│  FAQ — accordion with gold underline animation     │  ivory lobby
├────────────────────────────────────────────────────┤
│  CONSULTATION — split-screen form +                │  dark stage
│  reverse speaker animation (tower → bookshelf)     │
├────────────────────────────────────────────────────┤
│  FOOTER                                            │
└────────────────────────────────────────────────────┘
```

### Soundstage Section (new)
A stylized **top-down view of a 7.1.4 Dolby Atmos room**. Speakers are placed around a central seat. As you scroll, each speaker pulses gold + emits an animated sound ring in sequence (front L → center → front R → surrounds → ceiling). Built with SVG + Framer Motion (no Three.js cost).

### Projects "Now Playing" (new)
Existing project list rendered as a **vintage cinema marquee** — pill chips with gold border, scrolling horizontally with a marquee animation, click to open lightbox. Header reads "NOW SHOWING" in display font.

### Testimonials Carousel
Restyled to look like **rows of theater seats** — each testimonial card has a curved top, deep red velvet gradient, and a small gold seat number badge.

---

## 4. Animation Stack

Adopt **GSAP + ScrollTrigger** alongside existing Framer Motion. GSAP is required for the pinned scroll-scrubbed hero (Framer Motion's `useScroll` is good but jittery for long pinned sequences with multiple keyframes).

### New dependencies
```
gsap@^3.12.5        (includes ScrollTrigger via gsap/ScrollTrigger)
```

Three.js, react-three-fiber, drei, framer-motion already installed.

### Performance
- Hero Three.js scene uses `dpr={[1, 1.5]}`, `antialias: false`, single mesh group
- All scroll listeners use `{ passive: true }`
- Mobile fallback: SpeakerEvolution renders as a **4-frame static image strip** (no Three.js, no GSAP scrub) — preserves the storytelling without the GPU cost
- Sections lazy-loaded via `React.lazy` (existing pattern preserved)

---

## 5. Brightening the Aesthetic

- Replace `CINEMA_COLORS.BLACK` references in `HomeTheaterHome.tsx` with the new warm palette tokens
- Add `--bg-stage`, `--bg-lobby`, `--gold-champagne`, `--text-warm` CSS variables in `index.css`
- Section transitions: each dark→light boundary uses an **angled gold gradient sweep** (clip-path polygon) — looks like a stage curtain
- Ivory sections use subtle `radial-gradient` warm spotlights instead of the harsh black void
- Add subtle **film grain overlay** (SVG noise, 4% opacity, mix-blend-mode: overlay) over dark sections only — gives cinematic warmth without darkening

---

## 6. Files

```text
EDIT:    src/pages/public/HomeTheaterHome.tsx
            - Swap palette to new warm tokens
            - Replace hero with <SpeakerEvolution />
            - Insert <SoundstageSection />, restyle services on ivory bg
            - Restyle projects as marquee, testimonials as theater seats
            - Add gold curtain dividers between sections

CREATE:  src/components/home-theater/SpeakerEvolution.tsx
            - GSAP ScrollTrigger pinned hero
            - Three.js parametric speaker (scroll 0→1 morphs bookshelf→tower)
            - Film-frame CSS wrapper with sprocket holes & gold edge
            - Mobile fallback: 4-frame image strip

CREATE:  src/components/home-theater/SoundstageSection.tsx
            - SVG top-down 7.1.4 layout
            - Sequential pulse + sound-ring animation tied to scroll progress

EDIT:    src/components/home-theater/CinemaParticles.tsx
            - Reduce star count (warmer palette doesn't need 500)
            - Soften gold dust opacity to suit ivory transitions

EDIT:    src/lib/design-system.ts
            - Add new palette tokens (champagne, ivory, plum stage)

EDIT:    src/index.css
            - Add CSS vars + film-grain SVG noise + curtain divider keyframes

PACKAGE: add gsap@^3.12.5
```

---

## 7. Implementation Order

1. Add palette tokens + CSS vars + install gsap
2. Build `SpeakerEvolution` (the headline feature) and replace hero
3. Build `SoundstageSection` and insert after hero
4. Restyle services / projects / testimonials sections to alternating dark/ivory rhythm
5. Polish: curtain dividers, film grain, mobile fallbacks
6. SEO unchanged (already implemented in prior pass)

After approval I'll implement in this order.
