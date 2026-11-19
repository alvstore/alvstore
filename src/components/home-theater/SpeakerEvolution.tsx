"use client";

import { scrollToSection } from "@/lib/scroll";

import { Box, ButtonBase, Typography } from "@mui/material";
import { mergeSx } from "@/components/mui";
import { useRef, useEffect, useState } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { useIsMobile } from "@/hooks/use-mobile";
import { useMotionActivity } from "@/hooks/useMotionActivity";
if (typeof window !== "undefined") {
    gsap.registerPlugin(ScrollTrigger);
}
const FRAMES = [
    { tier: "Bookshelf", caption: "Where it begins.", spec: "2-Way · 5″ Driver · Compact" },
    { tier: "Compact Tower", caption: "Where rooms become stages.", spec: "2-Way · Dual 5″ · Floorstand" },
    { tier: "Floor-Standing", caption: "Where you stop watching, and feel.", spec: "3-Way · Triple 6″ · Reference" },
    { tier: "Reference Tower", caption: "Where Luxury Meets Entertainment.", spec: "4-Way · Quad 8″ · Flagship" },
];
// Wood colour ramp: oak → walnut → ebony (same palette as the old 3D model).
const OAK = "#C9A876";
const WALNUT = "#6B4423";
const EBONY = "#2A1810";
function hexToRgb(hex: string): [
    number,
    number,
    number
] {
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function lerpColor(a: string, b: string, t: number): string {
    const [r1, g1, b1] = hexToRgb(a);
    const [r2, g2, b2] = hexToRgb(b);
    const r = Math.round(r1 + (r2 - r1) * t);
    const g = Math.round(g1 + (g2 - g1) * t);
    const bl = Math.round(b1 + (b2 - b1) * t);
    return `rgb(${r},${g},${bl})`;
}
function woodColor(p: number): string {
    return p < 0.5 ? lerpColor(OAK, WALNUT, p / 0.5) : lerpColor(WALNUT, EBONY, (p - 0.5) / 0.5);
}
/**
 * Scroll-scrubbed SVG speaker. Geometry + colour are driven directly from
 * `progressRef` (0..1, written by the ScrollTrigger) inside a rAF loop — the
 * same pattern the old three.js `useFrame` used, so the morph stays buttery
 * without re-rendering React on every scroll tick.
 */
function SpeakerVisual({ progressRef }: {
    progressRef: React.MutableRefObject<number>;
}) {
    const groupRef = useRef<SVGGElement>(null);
    const cabinetRef = useRef<SVGRectElement>(null);
    const sheenRef = useRef<SVGRectElement>(null);
    const trimRef = useRef<SVGLineElement>(null);
    const tweeterRef = useRef<SVGCircleElement>(null);
    const baseRef = useRef<SVGRectElement>(null);
    const glowRef = useRef<SVGEllipseElement>(null);
    const wooferRefs = useRef<(SVGGElement | null)[]>([]);
    const CX = 150;
    const FLOOR_Y = 350;
    const svgRef = useRef<SVGSVGElement>(null);
    const active = useMotionActivity(svgRef);
    useEffect(() => {
        if (!active) return;
        let raf = 0;
        const tick = (now: number) => {
            const p = progressRef.current;
            const t = now / 1000;
            // Cabinet grows upward from the floor.
            const h = 150 + p * 200; // 150 → 350
            const w = 88 + p * 34; // 88 → 122
            const topY = FLOOR_Y - h;
            if (cabinetRef.current) {
                cabinetRef.current.setAttribute("x", String(CX - w / 2));
                cabinetRef.current.setAttribute("y", String(topY));
                cabinetRef.current.setAttribute("width", String(w));
                cabinetRef.current.setAttribute("height", String(h));
                cabinetRef.current.setAttribute("rx", String(6 + p * 6));
                cabinetRef.current.setAttribute("fill", woodColor(p));
            }
            if (sheenRef.current) {
                sheenRef.current.setAttribute("x", String(CX - w / 2));
                sheenRef.current.setAttribute("y", String(topY));
                sheenRef.current.setAttribute("width", String(w));
                sheenRef.current.setAttribute("height", String(h));
                sheenRef.current.setAttribute("rx", String(6 + p * 6));
            }
            if (trimRef.current) {
                trimRef.current.setAttribute("y1", String(topY + 12));
                trimRef.current.setAttribute("y2", String(FLOOR_Y - 12));
            }
            if (tweeterRef.current) {
                tweeterRef.current.setAttribute("cy", String(topY + 30));
                tweeterRef.current.setAttribute("r", String(6 + p * 1.5));
            }
            // Plinth fades in past ~35% progress.
            const baseV = Math.max(0, (p - 0.35) / 0.65);
            if (baseRef.current) {
                baseRef.current.setAttribute("width", String(w * (1.12 + baseV * 0.1)));
                baseRef.current.setAttribute("x", String(CX - (w * (1.12 + baseV * 0.1)) / 2));
                baseRef.current.setAttribute("opacity", String(baseV));
            }
            // Woofers: 1 → 4, distributed down the cabinet, growing with progress.
            const wooferCount = Math.min(4, Math.floor(1 + p * 3.2));
            const wooferTop = topY + 62;
            const wooferSpan = Math.max(0, FLOOR_Y - 22 - wooferTop);
            wooferRefs.current.forEach((g, i) => {
                if (!g)
                    return;
                if (i < wooferCount) {
                    const step = wooferCount > 1 ? wooferSpan / (wooferCount - 1) : 0;
                    const cy = wooferTop + i * step;
                    const r = (15 + p * 9) * (i === wooferCount - 1 ? 1.08 : 1);
                    g.setAttribute("opacity", "1");
                    const cone = g.querySelector<SVGCircleElement>("[data-cone]");
                    const cap = g.querySelector<SVGCircleElement>("[data-cap]");
                    const ring = g.querySelector<SVGCircleElement>("[data-ring]");
                    if (cone) {
                        cone.setAttribute("cy", String(cy));
                        cone.setAttribute("r", String(r));
                    }
                    if (cap) {
                        cap.setAttribute("cy", String(cy));
                        cap.setAttribute("r", String(r * 0.32));
                    }
                    if (ring) {
                        ring.setAttribute("cy", String(cy));
                        ring.setAttribute("r", String(r + 3));
                    }
                }
                else {
                    g.setAttribute("opacity", "0");
                }
            });
            // Floor glow grows with progress (the old spotlight intensity).
            if (glowRef.current) {
                glowRef.current.setAttribute("opacity", String(0.25 + p * 0.5));
                glowRef.current.setAttribute("rx", String(70 + p * 60));
            }
            // Gentle idle float / tilt.
            if (groupRef.current) {
                const bob = Math.sin(t * 0.6) * 4;
                const tilt = Math.sin(t * 0.4) * 1.6 - 0.5;
                groupRef.current.setAttribute("transform", `translate(0 ${bob.toFixed(2)}) rotate(${tilt.toFixed(2)} ${CX} ${FLOOR_Y})`);
            }
            raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(raf);
    }, [progressRef, active]);
    return (<Box ref={svgRef} viewBox="0 0 300 420" preserveAspectRatio="xMidYMax meet" component="svg" sx={{ height: "100%", width: "100%" }}>
      <defs>
        <linearGradient id="spk-sheen" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="rgba(255,255,255,0.18)"/>
          <stop offset="45%" stopColor="rgba(255,255,255,0.02)"/>
          <stop offset="100%" stopColor="rgba(0,0,0,0.28)"/>
        </linearGradient>
        <radialGradient id="spk-glow" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0%" stopColor="rgba(232,184,108,0.55)"/>
          <stop offset="100%" stopColor="rgba(232,184,108,0)"/>
        </radialGradient>
      </defs>

      {/* floor reflection */}
      <ellipse cx={CX} cy={FLOOR_Y + 16} rx="120" ry="12" fill="rgba(0,0,0,0.5)"/>
      <ellipse ref={glowRef} cx={CX} cy={FLOOR_Y + 14} rx="90" ry="10" fill="url(#spk-glow)" opacity="0.3"/>

      <g ref={groupRef}>
        {/* plinth */}
        <rect ref={baseRef} x={CX - 55} y={FLOOR_Y} width="110" height="12" rx="3" fill="#1A1228" opacity="0"/>

        {/* cabinet */}
        <rect ref={cabinetRef} x={CX - 44} y={FLOOR_Y - 150} width="88" height="150" rx="6" fill={OAK}/>
        {/* sheen overlay tracks the cabinet geometry every frame */}
        <rect ref={sheenRef} x={CX - 44} y={FLOOR_Y - 150} width="88" height="150" rx="6" fill="url(#spk-sheen)" pointerEvents="none" opacity="0.5"/>

        {/* gold front trim */}
        <line ref={trimRef} x1={CX} y1={FLOOR_Y - 138} x2={CX} y2={FLOOR_Y - 12} stroke="#E8B86C" strokeWidth="1.5" opacity="0.5"/>

        {/* tweeter */}
        <circle ref={tweeterRef} cx={CX} cy={FLOOR_Y - 120} r="6" fill="#1a0f08" stroke="#E8B86C" strokeWidth="1"/>

        {/* up to 4 woofers */}
        {[0, 1, 2, 3].map((i) => (<g key={i} ref={(el) => { wooferRefs.current[i] = el; }} opacity="0">
            <circle data-ring cx={CX} cy={FLOOR_Y - 40} r="18" fill="none" stroke="#3d2817" strokeWidth="1.5"/>
            <circle data-cone cx={CX} cy={FLOOR_Y - 40} r="15" fill="#0a0a12"/>
            <circle data-cap cx={CX} cy={FLOOR_Y - 40} r="5" fill="#E8B86C"/>
          </g>))}
      </g>
    </Box>);
}
// ─── Mobile fallback: 4 static frames in a strip ───
function MobileFrameStrip() {
    return (<Box data-static-speaker-evolution sx={{ paddingLeft: "1rem", paddingRight: "1rem", paddingTop: "3rem", paddingBottom: "3rem", background: "linear-gradient(180deg, #1A1228 0%, #0E0B14 100%)", "&::before": { content: "''", position: "absolute", inset: "0", pointerEvents: "none", opacity: "0.04", mixBlendMode: "overlay", backgroundImage: "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%25' height='100%25' filter='url(%23n)' opacity='0.6'/></svg>\")" }, position: "relative", overflow: "hidden" }}>
      <Box sx={{ textAlign: "center", marginBottom: "2rem", position: "relative", zIndex: "10" }}>
        <Typography component="p" variant="body1" sx={{ fontSize: "0.75rem", lineHeight: "1rem", fontWeight: "500", textTransform: "uppercase", letterSpacing: "0.3em", color: "rgb(232 184 108 / 1)", marginBottom: "0.75rem" }}>The Evolution</Typography>
        <Typography component="h2" variant="h2" sx={mergeSx({ fontSize: "1.875rem", lineHeight: "2.25rem", fontWeight: "700", color: "rgb(245 239 227 / 1)" }, { fontFamily: "'Cinzel', serif" })}>
          From Bookshelf <Box component="span" sx={{ background: "linear-gradient(135deg, #F4D9A8 0%, #E8B86C 50%, #B8862E 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>to Reference</Box>
        </Typography>
      </Box>
      <Box sx={{ display: "flex", gap: "1rem", overflowX: "auto", paddingBottom: "1rem", scrollSnapType: "x var(--alv-scroll-snap-strictness)", "--alv-scroll-snap-strictness": "mandatory", scrollbarWidth: "none", "&::-webkit-scrollbar": { display: "none" }, position: "relative", zIndex: "10" }}>
        {FRAMES.map((f, i) => (<Box key={i} sx={{ position: "relative", border: "2px solid rgba(232,184,108,0.4)", borderRadius: "8px", boxShadow: "0 0 60px rgba(232,184,108,0.15),\n      inset 0 0 80px rgba(232,184,108,0.04)", "&::before,&::after": { content: "''", position: "absolute", left: "0", right: "0", height: "14px", backgroundImage: "radial-gradient(circle, #0E0B14 4px, transparent 5px)", backgroundSize: "24px 14px", backgroundRepeat: "repeat-x", backgroundPosition: "center" }, "&::before": { top: "-16px" }, "&::after": { bottom: "-16px" }, backgroundColor: "rgb(14 11 20 / 1)", minWidth: "200px", height: "280px", padding: "1rem", display: "flex", flexDirection: "column", justifyContent: "space-between", scrollSnapAlign: "center", flexShrink: "0" }}>
            <Box sx={{ flex: "1 1 0%", display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
              <Box viewBox="0 0 60 200" component="svg" sx={{ height: "100%" }}>
                <rect x="20" y={180 - (40 + i * 35)} width="20" height={40 + i * 35} fill={`url(#wood-${i})`} rx="2"/>
                <defs>
                  <linearGradient id={`wood-${i}`} x1="0" x2="1">
                    <stop offset="0%" stopColor="#6B4423"/>
                    <stop offset="100%" stopColor="#2A1810"/>
                  </linearGradient>
                </defs>
                <circle cx="30" cy={180 - (40 + i * 35) + 10} r="3" fill="#E8B86C"/>
                {Array.from({ length: Math.min(4, i + 1) }).map((_, j) => (<circle key={j} cx="30" cy={180 - (40 + i * 35) + 25 + j * 18} r="6" fill="#0a0a12" stroke="#3d2817" strokeWidth="1"/>))}
              </Box>
            </Box>
            <Box sx={{ textAlign: "center" }}>
              <Typography component="p" variant="body1" sx={{ fontSize: "0.75rem", lineHeight: "1rem", textTransform: "uppercase", letterSpacing: "0.05em", color: "rgb(232 184 108 / 1)", marginBottom: "0.25rem" }}>{f.tier}</Typography>
              <Typography component="p" variant="body1" sx={{ fontSize: "0.75rem", lineHeight: "1rem", color: "rgb(245 239 227 / 0.7)", fontStyle: "italic" }}>"{f.caption}"</Typography>
            </Box>
          </Box>))}
      </Box>
    </Box>);
}
// ─── Main: CSS-sticky scroll-driven hero (GSAP reads scroll only) ───
export default function SpeakerEvolution() {
    const isMobile = useIsMobile();
    const reduced = useReducedMotion();
    const containerRef = useRef<HTMLDivElement>(null);
    const progressRef = useRef(0);
    const [activeFrame, setActiveFrame] = useState(0);
    useEffect(() => {
        if (isMobile || reduced)
            return;
        if (!containerRef.current)
            return;
        // NOTE: no `pin: true` here. GSAP pinning wraps the element in a
        // `.pin-spacer` and *reparents* it, which collides with React 18/19 DOM
        // reconciliation and throws "removeChild: node is not a child" when the
        // component unmounts (route change) or swaps to the mobile layout. We pin
        // with CSS `position: sticky` instead (zero DOM moves) and use
        // ScrollTrigger purely as a scrub — it only reads scroll position.
        const st = ScrollTrigger.create({
            trigger: containerRef.current,
            start: "top top",
            end: "bottom bottom",
            scrub: 1,
            onUpdate: (self) => {
                progressRef.current = self.progress;
                const idx = Math.min(FRAMES.length - 1, Math.floor(self.progress * FRAMES.length));
                setActiveFrame(idx);
            },
        });
        return () => st.kill();
    }, [isMobile, reduced]);
    if (isMobile || reduced)
        return <MobileFrameStrip />;
    const frame = FRAMES[activeFrame];
    return (<Box ref={containerRef} data-speaker-evolution sx={mergeSx({ position: "relative" }, { height: "400vh" })}>
      <Box data-speaker-stage sx={{ position: "sticky", top: "0px", height: "100vh", overflow: "hidden", background: "linear-gradient(135deg, #2A1B3D 0%, #1A1228 60%, #0E0B14 100%)", "&::before": { content: "''", position: "absolute", inset: "0", pointerEvents: "none", opacity: "0.04", mixBlendMode: "overlay", backgroundImage: "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%25' height='100%25' filter='url(%23n)' opacity='0.6'/></svg>\")" } }}>
      {/* Ambient glow orbs */}
      <Box sx={mergeSx({ position: "absolute", top: "25%", left: "25%", width: "400px", height: "400px", borderRadius: "9999px", "--alv-blur": "blur(140px)", filter: "var(--alv-blur) var(--alv-brightness) var(--alv-contrast) var(--alv-grayscale) var(--alv-hue-rotate) var(--alv-invert) var(--alv-saturate) var(--alv-sepia) var(--alv-drop-shadow)", pointerEvents: "none" }, { background: "radial-gradient(circle, rgba(232,184,108,0.18), transparent 70%)" })}/>
      <Box sx={mergeSx({ position: "absolute", bottom: "25%", right: "25%", width: "350px", height: "350px", borderRadius: "9999px", "--alv-blur": "blur(120px)", filter: "var(--alv-blur) var(--alv-brightness) var(--alv-contrast) var(--alv-grayscale) var(--alv-hue-rotate) var(--alv-invert) var(--alv-saturate) var(--alv-sepia) var(--alv-drop-shadow)", pointerEvents: "none" }, { background: "radial-gradient(circle, rgba(201,123,110,0.12), transparent 70%)" })}/>

      <Box sx={{ position: "relative", zIndex: "10", height: "100%", maxWidth: "80rem", marginLeft: "auto", marginRight: "auto", paddingLeft: "1.5rem", paddingRight: "1.5rem", display: "grid", gridTemplateColumns: "repeat(1, minmax(0, 1fr))", "@media (min-width: 1024px)": { gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }, gap: "2rem", alignItems: "center" }}>
        {/* LEFT — Film frame with morphing SVG speaker */}
        <Box sx={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}>
          <Box sx={{ position: "relative", border: "2px solid rgba(232,184,108,0.4)", borderRadius: "8px", boxShadow: "0 0 60px rgba(232,184,108,0.15),\n      inset 0 0 80px rgba(232,184,108,0.04)", "&::before,&::after": { content: "''", position: "absolute", left: "0", right: "0", height: "14px", backgroundImage: "radial-gradient(circle, #0E0B14 4px, transparent 5px)", backgroundSize: "24px 14px", backgroundRepeat: "repeat-x", backgroundPosition: "center" }, "&::before": { top: "-16px" }, "&::after": { bottom: "-16px" }, width: "100%", maxWidth: "480px", aspectRatio: "3/4", backgroundColor: "rgb(10 7 16 / 1)", overflow: "hidden" }}>
            <Box sx={{ position: "absolute", top: "0.75rem", left: "0.75rem", zIndex: "20", paddingLeft: "0.5rem", paddingRight: "0.5rem", paddingTop: "0.25rem", paddingBottom: "0.25rem", borderRadius: "0.25rem", backgroundColor: "rgb(0 0 0 / 0.6)", "--alv-backdrop-blur": "blur(4px)", WebkitBackdropFilter: "var(--alv-backdrop-blur) var(--alv-backdrop-brightness) var(--alv-backdrop-contrast) var(--alv-backdrop-grayscale) var(--alv-backdrop-hue-rotate) var(--alv-backdrop-invert) var(--alv-backdrop-saturate) var(--alv-backdrop-sepia)", backdropFilter: "var(--alv-backdrop-blur) var(--alv-backdrop-brightness) var(--alv-backdrop-contrast) var(--alv-backdrop-grayscale) var(--alv-backdrop-hue-rotate) var(--alv-backdrop-invert) var(--alv-backdrop-saturate) var(--alv-backdrop-sepia)", borderWidth: "1px", borderColor: "rgb(232 184 108 / 0.3)" }}>
              <Typography component="p" variant="body1" sx={{ fontSize: "9px", textTransform: "uppercase", letterSpacing: "0.25em", color: "rgb(232 184 108 / 1)", fontFamily: "JetBrains Mono, monospace" }}>
                Frame {String(activeFrame + 1).padStart(2, "0")} / 04
              </Typography>
            </Box>
            <Box sx={{ position: "absolute", bottom: "0.75rem", right: "0.75rem", zIndex: "20", paddingLeft: "0.5rem", paddingRight: "0.5rem", paddingTop: "0.25rem", paddingBottom: "0.25rem", borderRadius: "0.25rem", backgroundColor: "rgb(0 0 0 / 0.6)", "--alv-backdrop-blur": "blur(4px)", WebkitBackdropFilter: "var(--alv-backdrop-blur) var(--alv-backdrop-brightness) var(--alv-backdrop-contrast) var(--alv-backdrop-grayscale) var(--alv-backdrop-hue-rotate) var(--alv-backdrop-invert) var(--alv-backdrop-saturate) var(--alv-backdrop-sepia)", backdropFilter: "var(--alv-backdrop-blur) var(--alv-backdrop-brightness) var(--alv-backdrop-contrast) var(--alv-backdrop-grayscale) var(--alv-backdrop-hue-rotate) var(--alv-backdrop-invert) var(--alv-backdrop-saturate) var(--alv-backdrop-sepia)", borderWidth: "1px", borderColor: "rgb(232 184 108 / 0.3)" }}>
              <Typography component="p" variant="body1" sx={{ fontSize: "9px", textTransform: "uppercase", letterSpacing: "0.25em", color: "rgb(232 184 108 / 1)", fontFamily: "JetBrains Mono, monospace" }}>REC ●</Typography>
            </Box>
            <Box sx={{ position: "absolute", inset: "0px" }}>
              <SpeakerVisual progressRef={progressRef}/>
            </Box>
            {/* Scan-line overlay */}
            <Box sx={mergeSx({ position: "absolute", inset: "0px", pointerEvents: "none", opacity: "0.2" }, { backgroundImage: "repeating-linear-gradient(0deg, rgba(232,184,108,0.08) 0px, transparent 2px, transparent 4px)" })}/>
          </Box>
        </Box>

        {/* RIGHT — Animated copy */}
        <Box sx={{ position: "relative" }}>
          <Box sx={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", paddingLeft: "0.75rem", paddingRight: "0.75rem", paddingTop: "0.375rem", paddingBottom: "0.375rem", borderRadius: "9999px", marginBottom: "1.5rem", backgroundColor: "rgb(232 184 108 / 0.1)", borderWidth: "1px", borderColor: "rgb(232 184 108 / 0.3)" }}>
            <Box sx={{ height: "0.375rem", width: "0.375rem", borderRadius: "9999px", backgroundColor: "rgb(232 184 108 / 1)" }}/>
            <Box component="span" sx={{ fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.25em", color: "rgb(232 184 108 / 1)", fontWeight: "500" }}>
              ALV Store · Cinematic Audio
            </Box>
          </Box>

          <AnimatePresence mode="wait">
            <Box key={activeFrame} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }} component={motion.div}>
              <Typography component="p" variant="body1" sx={{ fontSize: "0.875rem", lineHeight: "1.25rem", textTransform: "uppercase", letterSpacing: "0.3em", color: "rgb(184 134 46 / 1)", marginBottom: "0.75rem" }}>{frame.tier}</Typography>
              <Typography component="h1" variant="h1" sx={mergeSx({ fontSize: "2.25rem", lineHeight: "1.05", "@media (min-width: 768px)": { fontSize: "3.75rem", lineHeight: "1" }, "@media (min-width: 1024px)": { fontSize: "4.5rem", lineHeight: "1" }, fontWeight: "700", marginBottom: "1.5rem", color: "rgb(245 239 227 / 1)" }, { fontFamily: "'Cinzel', serif" })}>
                {frame.caption.split(",").map((part, i) => (<Box key={i} component="span" sx={i === 1 ? { display: "block", background: "linear-gradient(135deg, #F4D9A8 0%, #E8B86C 50%, #B8862E 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" } : { display: "block" }}>
                    {part.trim()}
                  </Box>))}
              </Typography>
              <Typography component="p" variant="body1" sx={{ fontSize: "0.875rem", lineHeight: "1.25rem", color: "rgb(245 239 227 / 0.6)", marginBottom: "2rem", fontFamily: "JetBrains Mono, monospace" }}>{frame.spec}</Typography>
            </Box>
          </AnimatePresence>

          {/* Progress dots */}
          <Box sx={{ display: "flex", gap: "0.5rem", marginBottom: "2rem" }}>
            {FRAMES.map((_, i) => (<Box key={i} sx={mergeSx({ height: "0.25rem", borderRadius: "9999px", transitionProperty: "all", transitionTimingFunction: "cubic-bezier(0.4, 0, 0.2, 1)", transitionDuration: "500ms", animationDuration: "500ms" }, {
            width: i === activeFrame ? 40 : 16,
            background: i <= activeFrame ? "#E8B86C" : "rgba(232,184,108,0.2)",
            boxShadow: i === activeFrame ? "0 0 12px rgba(232,184,108,0.6)" : "none",
        })}/>))}
          </Box>

          <Box sx={{ display: "flex", flexDirection: "column", "@media (min-width: 640px)": { flexDirection: "row" }, gap: "0.75rem" }}>
            <ButtonBase onClick={() => scrollToSection("services")} type="button" sx={mergeSx({ paddingLeft: "1.75rem", paddingRight: "1.75rem", paddingTop: "0.75rem", paddingBottom: "0.75rem", borderRadius: "var(--radius)", fontSize: "0.875rem", lineHeight: "1.25rem", fontWeight: "600", transitionProperty: "all", transitionTimingFunction: "cubic-bezier(0.4, 0, 0.2, 1)", transitionDuration: "150ms", "&:hover": { "--alv-scale-x": "1.05", "--alv-scale-y": "1.05", transform: "translate(var(--alv-translate-x), var(--alv-translate-y)) rotate(var(--alv-rotate)) skewX(var(--alv-skew-x)) skewY(var(--alv-skew-y)) scaleX(var(--alv-scale-x)) scaleY(var(--alv-scale-y))" } }, {
        background: "linear-gradient(135deg, #F4D9A8, #E8B86C, #B8862E)",
        color: "#1A1228",
        boxShadow: "0 8px 30px rgba(232,184,108,0.35)",
    })}>
              Explore Our Theaters
            </ButtonBase>
            <ButtonBase onClick={() => scrollToSection("consultation")} type="button" sx={mergeSx({ paddingLeft: "1.75rem", paddingRight: "1.75rem", paddingTop: "0.75rem", paddingBottom: "0.75rem", borderRadius: "var(--radius)", fontSize: "0.875rem", lineHeight: "1.25rem", fontWeight: "600", transitionProperty: "all", transitionTimingFunction: "cubic-bezier(0.4, 0, 0.2, 1)", transitionDuration: "150ms" }, { border: "1px solid rgba(232,184,108,0.4)", color: "#E8B86C", background: "rgba(232,184,108,0.05)" })}>
              Book Consultation
            </ButtonBase>
          </Box>

          <Typography component="p" variant="body1" sx={{ position: "absolute", bottom: "-3rem", left: "0px", fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.3em", color: "rgb(245 239 227 / 0.3)" }}>
            ↓ Scroll to evolve
          </Typography>
        </Box>
      </Box>
      </Box>
    </Box>);
}
