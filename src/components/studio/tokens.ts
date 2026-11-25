/**
 * The ALV Studio visual language: plaster room, graphite type, brass accent.
 * Deliberately separate from the ERP palette — this is the public gallery.
 */
export const STUDIO = {
  plaster: "#EAE7DD",
  chalk: "#F6F4EE",
  silt: "#D9D4C6",
  graphite: "#16181A",
  slate: "#565A55",
  mist: "#8A8D86",
  brass: "#9C7B49",
  verdigris: "#4E6960",
  ink: "#101112",
  hair: "rgba(22,24,26,0.14)",
  hairStrong: "rgba(22,24,26,0.26)",
  hairLight: "rgba(246,244,238,0.18)",
} as const;

export const FONT = {
  display: "'Archivo Studio', 'Archivo', system-ui, sans-serif",
  text: "'Newsreader Studio', 'Newsreader', Georgia, serif",
} as const;

/** Display sizes follow a 1.5 modular scale from 1rem; tracking tightens as size grows. */
export const TYPE = {
  hero: {
    fontFamily: FONT.display,
    fontSize: "clamp(2.1rem, 3.85vw, 4.05rem)",
    lineHeight: 0.98,
    fontWeight: 480,
    fontStretch: "112%",
    letterSpacing: "-0.032em",
  },
  section: {
    fontFamily: FONT.display,
    fontSize: "clamp(1.75rem, 3.4vw, 2.75rem)",
    lineHeight: 1.04,
    fontWeight: 500,
    fontStretch: "104%",
    letterSpacing: "-0.025em",
  },
  exhibit: {
    fontFamily: FONT.display,
    fontSize: "clamp(1.45rem, 2.4vw, 2.1rem)",
    lineHeight: 1.04,
    fontWeight: 520,
    fontStretch: "100%",
    letterSpacing: "-0.018em",
  },
  lead: {
    fontFamily: FONT.text,
    fontSize: "clamp(1.06rem, 1.4vw, 1.25rem)",
    lineHeight: 1.5,
    fontWeight: 400,
  },
  placard: {
    fontFamily: FONT.text,
    fontSize: "0.98rem",
    lineHeight: 1.55,
    fontWeight: 400,
  },
  label: {
    fontFamily: FONT.display,
    fontSize: "0.72rem",
    lineHeight: 1.3,
    fontWeight: 560,
    fontStretch: "88%",
    letterSpacing: "0.06em",
  },
} as const;

export const EASE = "cubic-bezier(.22,1,.36,1)";
export const reduceTransition = { "@media (prefers-reduced-motion: reduce)": { transition: "none !important" } } as const;