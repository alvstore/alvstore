import type { Variants } from "framer-motion";

/** One quiet motion language for pages, widgets, overlays and feedback. Seconds. */
export const easeOut = [0.22, 1, 0.36, 1] as const;
export const motionTokens = {
  fast: 0.16,
  base: 0.28,
  page: 0.34,
  chart: 0.72,
  stagger: 0.045,
  maxDelay: 0.27,
  distance: 10,
} as const;
export const entranceDelay = (index = 0) => Math.min(Math.max(index, 0) * motionTokens.stagger, motionTokens.maxDelay);
export const fadeUp: Variants = {
  hidden: { opacity: 0, y: motionTokens.distance },
  show: { opacity: 1, y: 0, transition: { duration: motionTokens.page, ease: easeOut } },
  exit: { opacity: 0, y: -4, transition: { duration: motionTokens.fast, ease: easeOut } },
};
export const stagger: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: motionTokens.stagger, delayChildren: 0.02 } },
};
export const popIn: Variants = {
  hidden: { opacity: 0, y: 8, scale: 0.985 },
  show: { opacity: 1, y: 0, scale: 1, transition: { duration: motionTokens.base, ease: easeOut } },
  exit: { opacity: 0, transition: { duration: motionTokens.fast } },
};

const hoverEnabled = "&:not(.Mui-disabled):not([aria-disabled='true']):hover";
const pressEnabled = "&:not(.Mui-disabled):not([aria-disabled='true']):active";
/** Individual translate/scale compose with placement transforms (e.g. centered controls). */
export const controlFeedback = {
  transition: "background-color 160ms ease, color 160ms ease, border-color 160ms ease, box-shadow 160ms ease, translate 160ms cubic-bezier(.22,1,.36,1), scale 160ms cubic-bezier(.22,1,.36,1)",
  "@media (hover: hover) and (pointer: fine)": { [hoverEnabled]: { translate: "0 -1px" } },
  [pressEnabled]: { translate: "0 0", scale: "0.97" },
  "@media (prefers-reduced-motion: reduce)": { transition: "none", [hoverEnabled]: { translate: "none", scale: "none" }, [pressEnabled]: { translate: "none", scale: "none" } },
} as const;
