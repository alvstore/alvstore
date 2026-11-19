/** Programmatic scrolling must honor the same preference as CSS and Framer Motion. */
export function scrollToSection(id: string) {
  if (typeof window === "undefined") return;
  document.getElementById(id)?.scrollIntoView({
    behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
    block: "start",
  });
}
