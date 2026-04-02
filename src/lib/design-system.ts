// ═══════════════════════════════════════════
// CINEMA DESIGN SYSTEM — "Cinematic Luxury Dark"
// ═══════════════════════════════════════════

export const CINEMA_COLORS = {
  BLACK: "#000000",
  DEEP_NAVY: "#050A18",
  GOLD: "#FFD700",
  AMBER: "#FF8C00",
  WARM_WHITE: "#F5F0E8",
  SOFT_WHITE: "rgba(255,255,255,0.85)",
  MUTED: "rgba(255,255,255,0.4)",
  GLASS_BG: "rgba(255,255,255,0.05)",
  GLASS_BORDER: "rgba(255,255,255,0.08)",
} as const;

// HSL tokens for Tailwind / CSS vars
export const CINEMA_HSL = {
  gold: "45 100% 50%",
  amber: "33 100% 50%",
  deepNavy: "222 60% 5%",
  warmWhite: "36 47% 95%",
} as const;

export const TYPOGRAPHY = {
  fontDisplay: "'Cinzel', serif",
  fontBody: "'DM Sans', sans-serif",
  scale: {
    display: { size: "clamp(3rem, 6vw, 5rem)", lineHeight: 1.05, weight: 700 },
    h1: { size: "clamp(2.5rem, 5vw, 4rem)", lineHeight: 1.1, weight: 700 },
    h2: { size: "clamp(2rem, 3.5vw, 3rem)", lineHeight: 1.15, weight: 600 },
    h3: { size: "clamp(1.5rem, 2.5vw, 2rem)", lineHeight: 1.25, weight: 600 },
    h4: { size: "1.25rem", lineHeight: 1.35, weight: 600 },
    body: { size: "1rem", lineHeight: 1.6, weight: 400 },
    caption: { size: "0.875rem", lineHeight: 1.5, weight: 400 },
    small: { size: "0.75rem", lineHeight: 1.4, weight: 500 },
  },
} as const;

export const ANIMATION = {
  HERO_LETTER_DELAY: 0.04,
  STAGGER_DELAY: 0.15,
  SECTION_FADE_DURATION: 0.8,
  CARD_FLIP_DURATION: 0.6,
  SCROLL_THRESHOLD: 0.15,
  CAROUSEL_SPEED: 40, // seconds per full loop
} as const;

export const SPACING = [4, 8, 12, 16, 24, 32, 48, 64, 96, 128] as const;

export const SHADOWS = {
  card: "0 8px 32px rgba(0,0,0,0.4)",
  glow: `0 0 30px ${CINEMA_COLORS.GOLD}33, 0 0 60px ${CINEMA_COLORS.GOLD}11`,
  glowPulse: `0 0 20px ${CINEMA_COLORS.GOLD}44`,
} as const;
