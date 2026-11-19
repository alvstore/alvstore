"use client";

import { Box, SxProps, Theme } from "@mui/material";
import { mergeSx } from "@/components/mui";
import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { useMotionActivity } from "@/hooks/useMotionActivity";
/**
 * CinemaParticles — DOM/canvas replacement for the old three.js starfield.
 *
 * A single 2D <canvas> renders a twinkling starfield + drifting "gold dust"
 * with scroll parallax (cheaper than WebGL and works everywhere), while the
 * floating speakers / projector / sound-rings are SVG + framer-motion so they
 * stay crisp and need no GL context.
 */
interface Star {
    x: number;
    y: number;
    r: number;
    layer: number;
    color: string;
    phase: number;
    speed: number;
}
interface Dust {
    x: number;
    y: number;
    r: number;
    vx: number;
    vy: number;
    o: number;
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
        if (!canvas)
            return;
        const ctx = canvas.getContext("2d");
        if (!ctx)
            return;
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
                d.x += d.vx;
                d.y += d.vy;
                if (d.x < 0)
                    d.x = w;
                if (d.x > w)
                    d.x = 0;
                if (d.y < 0)
                    d.y = h;
                if (d.y > h)
                    d.y = 0;
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
    return <Box ref={canvasRef} component="canvas" sx={{ position: "absolute", inset: "0px", height: "100%", width: "100%" }}/>;
}
/* ─── Floating SVG speaker (was a three.js mesh) ─── */
function SpeakerShape() {
    return (<Box viewBox="0 0 60 96" component="svg" sx={{ height: "100%", width: "100%", "--alv-drop-shadow": "drop-shadow(0 0 18px rgba(255,215,0,0.25))", filter: "var(--alv-blur) var(--alv-brightness) var(--alv-contrast) var(--alv-grayscale) var(--alv-hue-rotate) var(--alv-invert) var(--alv-saturate) var(--alv-sepia) var(--alv-drop-shadow)" }}>
      <rect x="4" y="2" width="52" height="92" rx="8" fill="#14142a" stroke="rgba(255,215,0,0.25)" strokeWidth="1"/>
      <circle cx="30" cy="34" r="16" fill="#0a0a12" stroke="#3d2817" strokeWidth="2"/>
      <circle cx="30" cy="34" r="6" fill="#FFD700" opacity="0.9"/>
      <circle cx="30" cy="68" r="7" fill="#0a0a12" stroke="#3d2817" strokeWidth="2"/>
      <circle cx="30" cy="68" r="2.5" fill="#FF8C00"/>
    </Box>);
}
/* ─── Floating SVG projector ─── */
function ProjectorShape() {
    return (<Box viewBox="0 0 96 48" component="svg" sx={{ height: "100%", width: "100%", "--alv-drop-shadow": "drop-shadow(0 0 18px rgba(255,215,0,0.3))", filter: "var(--alv-blur) var(--alv-brightness) var(--alv-contrast) var(--alv-grayscale) var(--alv-hue-rotate) var(--alv-invert) var(--alv-saturate) var(--alv-sepia) var(--alv-drop-shadow)" }}>
      <rect x="2" y="12" width="92" height="26" rx="8" fill="#0f0f1a" stroke="rgba(255,215,0,0.25)" strokeWidth="1"/>
      <circle cx="76" cy="25" r="9" fill="#FFD700" opacity="0.85"/>
      <circle cx="76" cy="25" r="4" fill="#FFF3C4"/>
      <rect x="10" y="20" width="34" height="3" rx="1.5" fill="rgba(255,255,255,0.12)"/>
    </Box>);
}
/* ─── Expanding sound ring (framer-motion) ─── */
function SoundRing({ sx, delay = 0 }: {
    sx?: SxProps<Theme>;
    delay?: number;
}) {
    return (<Box initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: [0.5, 1.6], opacity: [0.35, 0] }} transition={{ duration: 3, repeat: Infinity, delay, ease: "easeOut" }} style={{ borderColor: "rgba(255,215,0,0.35)" }} component={motion.div} sx={mergeSx({ pointerEvents: "none", position: "absolute", borderRadius: "9999px", borderWidth: "1px" }, sx ?? {})}/>);
}
export default function CinemaParticles() {
    const ref = useRef<HTMLDivElement>(null);
    const active = useMotionActivity(ref);
    return (<Box ref={ref} aria-hidden="true" data-motion-active={active} sx={{ pointerEvents: "none", position: "absolute", inset: "0px", overflow: "hidden", background: "radial-gradient(ellipse at 30% 25%, rgba(232,184,108,.04), transparent 65%)" }}>
      {active && <>
      <ParticleCanvas />

      {/* Floating speakers */}
      <Box animate={{ y: [0, -14, 0], rotate: [-4, 4, -4] }} transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }} component={motion.div} sx={{ position: "absolute", left: "12%", top: "22%", height: "6rem", width: "4rem", opacity: "0.7" }}>
        <SpeakerShape />
      </Box>
      <Box animate={{ y: [0, 12, 0], rotate: [3, -3, 3] }} transition={{ duration: 8, repeat: Infinity, ease: "easeInOut", delay: 0.8 }} component={motion.div} sx={{ position: "absolute", right: "12%", top: "46%", height: "5rem", width: "3.5rem", opacity: "0.6" }}>
        <SpeakerShape />
      </Box>

      {/* Floating projector */}
      <Box animate={{ y: [0, -10, 0] }} transition={{ duration: 6, repeat: Infinity, ease: "easeInOut", delay: 0.4 }} component={motion.div} sx={{ position: "absolute", left: "50%", top: "12%", height: "3rem", width: "6rem", "--alv-translate-x": "-50%", transform: "translate(var(--alv-translate-x), var(--alv-translate-y)) rotate(var(--alv-rotate)) skewX(var(--alv-skew-x)) skewY(var(--alv-skew-y)) scaleX(var(--alv-scale-x)) scaleY(var(--alv-scale-y))", opacity: "0.6" }}>
        <ProjectorShape />
      </Box>

      {/* Sound rings */}
      <SoundRing delay={0} sx={{ left: "12%", top: "22%", height: "6rem", width: "6rem" }}/>
      <SoundRing delay={1.5} sx={{ right: "12%", top: "46%", height: "5rem", width: "5rem" }}/>
      <SoundRing delay={3} sx={{ left: "50%", top: "50%", height: "7rem", width: "7rem", "--alv-translate-x": "-50%", transform: "translate(var(--alv-translate-x), var(--alv-translate-y)) rotate(var(--alv-rotate)) skewX(var(--alv-skew-x)) skewY(var(--alv-skew-y)) scaleX(var(--alv-scale-x)) scaleY(var(--alv-scale-y))" }}/>
      </>}
    </Box>);
}
