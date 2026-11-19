# Historical public-site design plan

The original cinematic redesign proposal has been superseded by the implementation and [current UI audit/plan](../docs/ui-modernization.md).

Current constraints and implementation:

- MUI components with `sx`; no Tailwind, shadcn, or Radix.
- Framer Motion with `Box` hosts for entrances; reduced-motion alternatives.
- GSAP only for counters and scroll scrubbing. **Do not use ScrollTrigger pinning or reparent React-owned DOM.** The speaker hero uses CSS `position: sticky`.
- SVG/canvas theater illustrations; no Three.js/WebGL dependency.
- Repeating decoration stops offscreen, in hidden tabs, and for reduced-motion users.
- ERP widgets use actual business data and explicit loading/empty/error states.

See [README](../README.md) for setup, testing, operational behavior, and production-safety limitations.
