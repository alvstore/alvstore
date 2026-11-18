"use client";

import { useRef, useEffect, useState } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { motion, AnimatePresence } from "framer-motion";
import { useIsMobile } from "@/hooks/use-mobile";

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

function hexToRgb(hex: string): [number, number, number] {
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
function SpeakerVisual({ progressRef }: { progressRef: React.MutableRefObject<number> }) {
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

  useEffect(() => {
    let raf = 0;
    const tick = (now: number) => {
      const p = progressRef.current;
      const t = now / 1000;

      // Cabinet grows upward from the floor.
      const h = 150 + p * 200;          // 150 → 350
      const w = 88 + p * 34;            // 88 → 122
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
        if (!g) return;
        if (i < wooferCount) {
          const step = wooferCount > 1 ? wooferSpan / (wooferCount - 1) : 0;
          const cy = wooferTop + i * step;
          const r = (15 + p * 9) * (i === wooferCount - 1 ? 1.08 : 1);
          g.setAttribute("opacity", "1");
          const cone = g.querySelector<SVGCircleElement>("[data-cone]");
          const cap = g.querySelector<SVGCircleElement>("[data-cap]");
          const ring = g.querySelector<SVGCircleElement>("[data-ring]");
          if (cone) { cone.setAttribute("cy", String(cy)); cone.setAttribute("r", String(r)); }
          if (cap) { cap.setAttribute("cy", String(cy)); cap.setAttribute("r", String(r * 0.32)); }
          if (ring) { ring.setAttribute("cy", String(cy)); ring.setAttribute("r", String(r + 3)); }
        } else {
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
        groupRef.current.setAttribute(
          "transform",
          `translate(0 ${bob.toFixed(2)}) rotate(${tilt.toFixed(2)} ${CX} ${FLOOR_Y})`
        );
      }

      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [progressRef]);

  return (
    <svg viewBox="0 0 300 420" preserveAspectRatio="xMidYMax meet" className="h-full w-full">
      <defs>
        <linearGradient id="spk-sheen" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="rgba(255,255,255,0.18)" />
          <stop offset="45%" stopColor="rgba(255,255,255,0.02)" />
          <stop offset="100%" stopColor="rgba(0,0,0,0.28)" />
        </linearGradient>
        <radialGradient id="spk-glow" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0%" stopColor="rgba(232,184,108,0.55)" />
          <stop offset="100%" stopColor="rgba(232,184,108,0)" />
        </radialGradient>
      </defs>

      {/* floor reflection */}
      <ellipse cx={CX} cy={FLOOR_Y + 16} rx="120" ry="12" fill="rgba(0,0,0,0.5)" />
      <ellipse ref={glowRef} cx={CX} cy={FLOOR_Y + 14} rx="90" ry="10" fill="url(#spk-glow)" opacity="0.3" />

      <g ref={groupRef}>
        {/* plinth */}
        <rect ref={baseRef} x={CX - 55} y={FLOOR_Y} width="110" height="12" rx="3" fill="#1A1228" opacity="0" />

        {/* cabinet */}
        <rect ref={cabinetRef} x={CX - 44} y={FLOOR_Y - 150} width="88" height="150" rx="6" fill={OAK} />
        {/* sheen overlay tracks the cabinet geometry every frame */}
        <rect ref={sheenRef} x={CX - 44} y={FLOOR_Y - 150} width="88" height="150" rx="6"
          fill="url(#spk-sheen)" pointerEvents="none" opacity="0.5" />

        {/* gold front trim */}
        <line ref={trimRef} x1={CX} y1={FLOOR_Y - 138} x2={CX} y2={FLOOR_Y - 12}
          stroke="#E8B86C" strokeWidth="1.5" opacity="0.5" />

        {/* tweeter */}
        <circle ref={tweeterRef} cx={CX} cy={FLOOR_Y - 120} r="6" fill="#1a0f08" stroke="#E8B86C" strokeWidth="1" />

        {/* up to 4 woofers */}
        {[0, 1, 2, 3].map((i) => (
          <g key={i} ref={(el) => { wooferRefs.current[i] = el; }} opacity="0">
            <circle data-ring cx={CX} cy={FLOOR_Y - 40} r="18" fill="none" stroke="#3d2817" strokeWidth="1.5" />
            <circle data-cone cx={CX} cy={FLOOR_Y - 40} r="15" fill="#0a0a12" />
            <circle data-cap cx={CX} cy={FLOOR_Y - 40} r="5" fill="#E8B86C" />
          </g>
        ))}
      </g>
    </svg>
  );
}

// ─── Mobile fallback: 4 static frames in a strip ───
function MobileFrameStrip() {
  return (
    <div className="px-4 py-12 bg-stage-deep film-grain relative overflow-hidden">
      <div className="text-center mb-8 relative z-10">
        <p className="text-xs font-medium uppercase tracking-[0.3em] text-champagne mb-3">The Evolution</p>
        <h2 className="text-3xl font-bold text-warm" style={{ fontFamily: "'Cinzel', serif" }}>
          From Bookshelf <span className="text-champagne-gradient">to Reference</span>
        </h2>
      </div>
      <div className="flex gap-4 overflow-x-auto pb-4 snap-x snap-mandatory scrollbar-hide relative z-10">
        {FRAMES.map((f, i) => (
          <div key={i} className="film-frame bg-[#0E0B14] min-w-[200px] h-[280px] p-4 flex flex-col justify-between snap-center flex-shrink-0">
            <div className="flex-1 flex items-end justify-center">
              <svg viewBox="0 0 60 200" className="h-full">
                <rect x="20" y={180 - (40 + i * 35)} width="20" height={40 + i * 35} fill="url(#wood)" rx="2" />
                <defs>
                  <linearGradient id="wood" x1="0" x2="1">
                    <stop offset="0%" stopColor="#6B4423" />
                    <stop offset="100%" stopColor="#2A1810" />
                  </linearGradient>
                </defs>
                <circle cx="30" cy={180 - (40 + i * 35) + 10} r="3" fill="#E8B86C" />
                {Array.from({ length: Math.min(4, i + 1) }).map((_, j) => (
                  <circle key={j} cx="30" cy={180 - (40 + i * 35) + 25 + j * 18} r="6" fill="#0a0a12" stroke="#3d2817" strokeWidth="1" />
                ))}
              </svg>
            </div>
            <div className="text-center">
              <p className="text-xs uppercase tracking-wider text-champagne mb-1">{f.tier}</p>
              <p className="text-xs text-warm/70 italic">"{f.caption}"</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main: Pinned scroll-driven hero (GSAP ScrollTrigger) ───
export default function SpeakerEvolution() {
  const isMobile = useIsMobile();
  const containerRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef(0);
  const [activeFrame, setActiveFrame] = useState(0);

  useEffect(() => {
    if (isMobile) return;
    if (!containerRef.current) return;

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
  }, [isMobile]);

  if (isMobile) return <MobileFrameStrip />;

  const frame = FRAMES[activeFrame];

  return (
    // Tall outer track provides the scroll room; the sticky inner stage stays
    // pinned for the whole scroll (replaces GSAP pin — no DOM reparenting).
    <div ref={containerRef} className="relative" style={{ height: "400vh" }}>
      <div className="sticky top-0 h-screen overflow-hidden bg-stage-plum film-grain">
      {/* Ambient glow orbs */}
      <div className="absolute top-1/4 left-1/4 w-[400px] h-[400px] rounded-full blur-[140px] pointer-events-none"
        style={{ background: "radial-gradient(circle, rgba(232,184,108,0.18), transparent 70%)" }} />
      <div className="absolute bottom-1/4 right-1/4 w-[350px] h-[350px] rounded-full blur-[120px] pointer-events-none"
        style={{ background: "radial-gradient(circle, rgba(201,123,110,0.12), transparent 70%)" }} />

      <div className="relative z-10 h-full max-w-7xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
        {/* LEFT — Film frame with morphing SVG speaker */}
        <div className="relative flex items-center justify-center h-full">
          <div className="film-frame w-full max-w-[480px] aspect-[3/4] bg-[#0a0710] relative overflow-hidden">
            <div className="absolute top-3 left-3 z-20 px-2 py-1 rounded bg-black/60 backdrop-blur-sm border border-champagne/30">
              <p className="text-[9px] uppercase tracking-[0.25em] text-champagne font-mono">
                Frame {String(activeFrame + 1).padStart(2, "0")} / 04
              </p>
            </div>
            <div className="absolute bottom-3 right-3 z-20 px-2 py-1 rounded bg-black/60 backdrop-blur-sm border border-champagne/30">
              <p className="text-[9px] uppercase tracking-[0.25em] text-champagne font-mono">REC ●</p>
            </div>
            <div className="absolute inset-0">
              <SpeakerVisual progressRef={progressRef} />
            </div>
            {/* Scan-line overlay */}
            <div
              className="absolute inset-0 pointer-events-none opacity-20"
              style={{ backgroundImage: "repeating-linear-gradient(0deg, rgba(232,184,108,0.08) 0px, transparent 2px, transparent 4px)" }}
            />
          </div>
        </div>

        {/* RIGHT — Animated copy */}
        <div className="relative">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-6 bg-champagne/10 border border-champagne/30">
            <div className="h-1.5 w-1.5 rounded-full bg-champagne animate-pulse" />
            <span className="text-[10px] uppercase tracking-[0.25em] text-champagne font-medium">
              ALV Store · Cinematic Audio
            </span>
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={activeFrame}
              initial={{ opacity: 0, y: 30, filter: "blur(10px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={{ opacity: 0, y: -20, filter: "blur(8px)" }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            >
              <p className="text-sm uppercase tracking-[0.3em] text-champagne-deep mb-3">{frame.tier}</p>
              <h1
                className="text-4xl md:text-6xl lg:text-7xl font-bold leading-[1.05] mb-6 text-warm"
                style={{ fontFamily: "'Cinzel', serif" }}
              >
                {frame.caption.split(",").map((part, i) => (
                  <span key={i} className={i === 1 ? "block text-champagne-gradient" : "block"}>
                    {part.trim()}
                  </span>
                ))}
              </h1>
              <p className="text-sm text-warm/60 mb-8 font-mono">{frame.spec}</p>
            </motion.div>
          </AnimatePresence>

          {/* Progress dots */}
          <div className="flex gap-2 mb-8">
            {FRAMES.map((_, i) => (
              <div
                key={i}
                className="h-1 rounded-full transition-all duration-500"
                style={{
                  width: i === activeFrame ? 40 : 16,
                  background: i <= activeFrame ? "#E8B86C" : "rgba(232,184,108,0.2)",
                  boxShadow: i === activeFrame ? "0 0 12px rgba(232,184,108,0.6)" : "none",
                }}
              />
            ))}
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              className="px-7 py-3 rounded-lg text-sm font-semibold transition-all hover:scale-105"
              style={{
                background: "linear-gradient(135deg, #F4D9A8, #E8B86C, #B8862E)",
                color: "#1A1228",
                boxShadow: "0 8px 30px rgba(232,184,108,0.35)",
              }}
              onClick={() => document.getElementById("services")?.scrollIntoView({ behavior: "smooth" })}
            >
              Explore Our Theaters
            </button>
            <button
              className="px-7 py-3 rounded-lg text-sm font-semibold transition-all"
              style={{ border: "1px solid rgba(232,184,108,0.4)", color: "#E8B86C", background: "rgba(232,184,108,0.05)" }}
              onClick={() => document.getElementById("consultation")?.scrollIntoView({ behavior: "smooth" })}
            >
              Book Consultation
            </button>
          </div>

          <p className="absolute -bottom-12 left-0 text-[10px] uppercase tracking-[0.3em] text-warm/30">
            ↓ Scroll to evolve
          </p>
        </div>
      </div>
      </div>
    </div>
  );
}
