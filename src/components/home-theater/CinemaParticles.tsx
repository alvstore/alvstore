"use client";

import { useEffect, useRef } from "react";
import { motion } from "framer-motion";

/**
 * CinemaParticles — DOM/canvas replacement for the old three.js starfield.
 *
 * A single 2D <canvas> renders a twinkling starfield + drifting "gold dust"
 * with scroll parallax (cheaper than WebGL and works everywhere), while the
 * floating speakers / projector / sound-rings are SVG + framer-motion so they
 * stay crisp and need no GL context.
 */

interface Star {
  x: number; y: number; r: number; layer: number;
  color: string; phase: number; speed: number;
}
interface Dust {
  x: number; y: number; r: number; vx: number; vy: number; o: number;
}

const STAR_COLORS = ["#FFD700", "#FF8C00", "#F5F0E8"]; // gold / amber / warm white

function ParticleCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scrollRef = useRef(0);

  useEffect(() => {
    const onScroll = () => { scrollRef.current = window.scrollY; };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let stars: Star[] = [];
    let dust: Dust[] = [];
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);

    const resize = () => {
      const { clientWidth: w, clientHeight: h } = canvas;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // (Re)seed relative to canvas size.
      const W = w, H = h;
      stars = Array.from({ length: 220 }, () => ({
        x: Math.random() * W,
        y: Math.random() * H,
        r: Math.random() * 1.4 + 0.4,
        layer: 0.15 + Math.random() * 0.85, // depth → parallax strength
        color: STAR_COLORS[(Math.random() * STAR_COLORS.length) | 0],
        phase: Math.random() * Math.PI * 2,
        speed: 0.5 + Math.random() * 1.5,
      }));
      dust = Array.from({ length: 90 }, () => ({
        x: Math.random() * W,
        y: Math.random() * H,
        r: Math.random() * 1.1 + 0.3,
        vx: (Math.random() - 0.5) * 0.12,
        vy: (Math.random() - 0.5) * 0.12,
        o: 0.2 + Math.random() * 0.4,
      }));
    };

    resize();
    window.addEventListener("resize", resize);

    const tick = (t: number) => {
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      ctx.clearRect(0, 0, w, h);
      const scroll = scrollRef.current;

      // Stars — twinkle + scroll parallax
      for (const s of stars) {
        const tw = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t * 0.001 * s.speed + s.phase));
        const y = (((s.y - scroll * s.layer * 0.15) % h) + h) % h;
        ctx.globalAlpha = tw * 0.9;
        ctx.fillStyle = s.color;
        ctx.beginPath();
        ctx.arc(s.x, y, s.r * s.layer, 0, Math.PI * 2);
        ctx.fill();
      }

      // Gold dust — slow drift + stronger parallax (foreground)
      ctx.fillStyle = "#FFD700";
      for (const d of dust) {
        d.x += d.vx; d.y += d.vy;
        if (d.x < 0) d.x = w; if (d.x > w) d.x = 0;
        if (d.y < 0) d.y = h; if (d.y > h) d.y = 0;
        const y = (((d.y - scroll * 0.25) % h) + h) % h;
        ctx.globalAlpha = d.o;
        ctx.beginPath();
        ctx.arc(d.x, y, d.r, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.globalAlpha = 1;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", resize); };
  }, []);

  return <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />;
}

/* ─── Floating SVG speaker (was a three.js mesh) ─── */
function SpeakerShape() {
  return (
    <svg viewBox="0 0 60 96" className="h-full w-full drop-shadow-[0_0_18px_rgba(255,215,0,0.25)]">
      <rect x="4" y="2" width="52" height="92" rx="8" fill="#14142a" stroke="rgba(255,215,0,0.25)" strokeWidth="1" />
      <circle cx="30" cy="34" r="16" fill="#0a0a12" stroke="#3d2817" strokeWidth="2" />
      <circle cx="30" cy="34" r="6" fill="#FFD700" opacity="0.9" />
      <circle cx="30" cy="68" r="7" fill="#0a0a12" stroke="#3d2817" strokeWidth="2" />
      <circle cx="30" cy="68" r="2.5" fill="#FF8C00" />
    </svg>
  );
}

/* ─── Floating SVG projector ─── */
function ProjectorShape() {
  return (
    <svg viewBox="0 0 96 48" className="h-full w-full drop-shadow-[0_0_18px_rgba(255,215,0,0.3)]">
      <rect x="2" y="12" width="92" height="26" rx="8" fill="#0f0f1a" stroke="rgba(255,215,0,0.25)" strokeWidth="1" />
      <circle cx="76" cy="25" r="9" fill="#FFD700" opacity="0.85" />
      <circle cx="76" cy="25" r="4" fill="#FFF3C4" />
      <rect x="10" y="20" width="34" height="3" rx="1.5" fill="rgba(255,255,255,0.12)" />
    </svg>
  );
}

/* ─── Expanding sound ring (framer-motion) ─── */
function SoundRing({ className, delay = 0 }: { className?: string; delay?: number }) {
  return (
    <motion.div
      className={`pointer-events-none absolute rounded-full border ${className ?? ""}`}
      style={{ borderColor: "rgba(255,215,0,0.35)" }}
      initial={{ scale: 0.5, opacity: 0 }}
      animate={{ scale: [0.5, 1.6], opacity: [0.35, 0] }}
      transition={{ duration: 3, repeat: Infinity, delay, ease: "easeOut" }}
    />
  );
}

export default function CinemaParticles() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <ParticleCanvas />

      {/* Floating speakers */}
      <motion.div
        className="absolute left-[12%] top-[22%] h-24 w-16 opacity-70"
        animate={{ y: [0, -14, 0], rotate: [-4, 4, -4] }}
        transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
      >
        <SpeakerShape />
      </motion.div>
      <motion.div
        className="absolute right-[12%] top-[46%] h-20 w-14 opacity-60"
        animate={{ y: [0, 12, 0], rotate: [3, -3, 3] }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut", delay: 0.8 }}
      >
        <SpeakerShape />
      </motion.div>

      {/* Floating projector */}
      <motion.div
        className="absolute left-1/2 top-[12%] h-12 w-24 -translate-x-1/2 opacity-60"
        animate={{ y: [0, -10, 0] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut", delay: 0.4 }}
      >
        <ProjectorShape />
      </motion.div>

      {/* Sound rings */}
      <SoundRing className="left-[12%] top-[22%] h-24 w-24" delay={0} />
      <SoundRing className="right-[12%] top-[46%] h-20 w-20" delay={1.5} />
      <SoundRing className="left-1/2 top-1/2 h-28 w-28 -translate-x-1/2" delay={3} />
    </div>
  );
}
