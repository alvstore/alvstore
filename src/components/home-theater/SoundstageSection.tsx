"use client";

import { Box, Typography } from "@mui/material";
import { mergeSx } from "@/components/mui";
import { useRef } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { useMotionActivity } from "@/hooks/useMotionActivity";
// 7.1.4 Dolby Atmos layout — top-down view
// Positions in a 600x500 viewBox
const SPEAKERS = [
    { id: "FL", label: "Front L", x: 150, y: 120, delay: 0.0 },
    { id: "C", label: "Center", x: 300, y: 100, delay: 0.1 },
    { id: "FR", label: "Front R", x: 450, y: 120, delay: 0.2 },
    { id: "SL", label: "Surround L", x: 90, y: 280, delay: 0.3 },
    { id: "SR", label: "Surround R", x: 510, y: 280, delay: 0.3 },
    { id: "RL", label: "Rear L", x: 150, y: 420, delay: 0.4 },
    { id: "RR", label: "Rear R", x: 450, y: 420, delay: 0.4 },
    { id: "TFL", label: "Ceiling Front L", x: 220, y: 200, delay: 0.5, ceiling: true },
    { id: "TFR", label: "Ceiling Front R", x: 380, y: 200, delay: 0.5, ceiling: true },
    { id: "TRL", label: "Ceiling Rear L", x: 220, y: 360, delay: 0.6, ceiling: true },
    { id: "TRR", label: "Ceiling Rear R", x: 380, y: 360, delay: 0.6, ceiling: true },
];
export default function SoundstageSection() {
    const ref = useRef<HTMLElement>(null);
    const reduced = useReducedMotion();
    const active = useMotionActivity(ref);
    return (<Box ref={ref} component="section" sx={{ position: "relative", background: "linear-gradient(180deg, #1A1228 0%, #0E0B14 100%)", "&::before": { content: "''", position: "absolute", inset: "0", pointerEvents: "none", opacity: "0.04", mixBlendMode: "overlay", backgroundImage: "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%25' height='100%25' filter='url(%23n)' opacity='0.6'/></svg>\")" }, paddingTop: "6rem", paddingBottom: "6rem", overflow: "hidden" }}>
      <Box sx={mergeSx({ position: "absolute", top: "0px", left: "50%", "--alv-translate-x": "-50%", transform: "translate(var(--alv-translate-x), var(--alv-translate-y)) rotate(var(--alv-rotate)) skewX(var(--alv-skew-x)) skewY(var(--alv-skew-y)) scaleX(var(--alv-scale-x)) scaleY(var(--alv-scale-y))", width: "600px", height: "200px", borderRadius: "9999px", "--alv-blur": "blur(140px)", filter: "var(--alv-blur) var(--alv-brightness) var(--alv-contrast) var(--alv-grayscale) var(--alv-hue-rotate) var(--alv-invert) var(--alv-saturate) var(--alv-sepia) var(--alv-drop-shadow)", pointerEvents: "none" }, { background: "radial-gradient(circle, rgba(232,184,108,0.12), transparent 70%)" })}/>

      <Box sx={{ maxWidth: "80rem", marginLeft: "auto", marginRight: "auto", paddingLeft: "1.5rem", paddingRight: "1.5rem", position: "relative", zIndex: "10" }}>
        <Box sx={{ textAlign: "center", marginBottom: "4rem" }}>
          <Typography component="p" variant="body1" sx={{ fontSize: "0.75rem", lineHeight: "1rem", fontWeight: "500", textTransform: "uppercase", letterSpacing: "0.3em", marginBottom: "1rem", color: "rgb(232 184 108 / 1)" }}>
            The Soundstage
          </Typography>
          <Typography component="h2" variant="h2" sx={mergeSx({ fontSize: "2.25rem", lineHeight: "2.5rem", "@media (min-width: 768px)": { fontSize: "3rem", lineHeight: "1" }, fontWeight: "700", color: "rgb(245 239 227 / 1)", marginBottom: "1rem" }, { fontFamily: "'Cinzel', serif" })}>
            Engineered for <Box component="span" sx={{ background: "linear-gradient(135deg, #F4D9A8 0%, #E8B86C 50%, #B8862E 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>7.1.4 Atmos</Box>
          </Typography>
          <Typography component="p" variant="body1" sx={{ fontSize: "0.875rem", lineHeight: "1.25rem", "@media (min-width: 768px)": { fontSize: "1rem", lineHeight: "1.5rem" }, color: "rgb(245 239 227 / 0.5)", maxWidth: "36rem", marginLeft: "auto", marginRight: "auto" }}>
            Eleven precisely calibrated channels. Sound moves through three dimensions —
            front, surround, and overhead.
          </Typography>
        </Box>

        <Box sx={{ display: "grid", gridTemplateColumns: "repeat(1, minmax(0, 1fr))", "@media (min-width: 1024px)": { gridTemplateColumns: "1fr 320px" }, gap: "3rem", alignItems: "center" }}>
          {/* Top-down theater diagram */}
          <Box sx={{ position: "relative" }}>
            <Box viewBox="0 0 600 500" component="svg" sx={mergeSx({ width: "100%", height: "auto" }, { maxHeight: 500 })}>
              {/* Room outline */}
              <rect x="60" y="80" width="480" height="380" rx="20" fill="rgba(42,27,61,0.4)" stroke="rgba(232,184,108,0.2)" strokeWidth="1" strokeDasharray="4 4"/>

              {/* Screen at front */}
              <rect x="120" y="60" width="360" height="14" rx="2" fill="url(#screenGrad)"/>
              <text x="300" y="50" textAnchor="middle" fill="rgba(232,184,108,0.5)" fontSize="9" letterSpacing="3">
                SCREEN
              </text>

              {/* Sweet spot — listening position */}
              <g>
                <circle cx="300" cy="270" r="35" fill="none" stroke="rgba(232,184,108,0.15)" strokeDasharray="2 3"/>
                <circle cx="300" cy="270" r="8" fill="#C97B6E" opacity="0.6"/>
                <text x="300" y="320" textAnchor="middle" fill="rgba(245,239,227,0.4)" fontSize="9">
                  Sweet Spot
                </text>
              </g>

              {/* Animated sound rings emanating from sweet spot */}
              {active && [0, 1, 2].map((i) => (<Box key={i} cx="300" cy="270" r="40" fill="none" stroke="#E8B86C" strokeWidth="1" initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: [0.4, 2.2], opacity: [0.5, 0] }} transition={{ duration: 3, repeat: Infinity, delay: i * 1, ease: "easeOut" }} style={{ transformOrigin: "300px 270px" }} component={motion.circle}/>))}

              {/* Speakers */}
              {SPEAKERS.map((s, i) => (<Box key={s.id} initial={reduced ? false : { opacity: 0, scale: 0 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true, margin: "-100px" }} transition={{ duration: reduced ? 0 : 0.5, delay: reduced ? 0 : s.delay, ease: "backOut" }} component={motion.g}>
                  {/* Pulse glow */}
                  <Box cx={s.x} cy={s.y} r="14" fill="#E8B86C" animate={{ scale: active ? [1, 1.6, 1] : 1, opacity: active ? [0.3, 0, 0.3] : 0.2 }} transition={active ? { duration: 2.5, repeat: Infinity, delay: i * 0.2 } : { duration: 0 }} style={{ transformOrigin: `${s.x}px ${s.y}px` }} component={motion.circle}/>
                  {/* Speaker dot */}
                  <circle cx={s.x} cy={s.y} r={s.ceiling ? 5 : 7} fill={s.ceiling ? "#C97B6E" : "#E8B86C"} stroke="#0E0B14" strokeWidth="2"/>
                  {/* Label */}
                  <text x={s.x} y={s.y - 14} textAnchor="middle" fill="rgba(245,239,227,0.7)" fontSize="8" fontFamily="monospace">
                    {s.id}
                  </text>
                </Box>))}

              {/* Connection lines from sweet spot to each speaker */}
              {SPEAKERS.map(s => <line key={`l-${s.id}`} x1="300" y1="270" x2={s.x} y2={s.y} stroke="rgba(232,184,108,0.12)" strokeWidth="0.5" strokeDasharray="2 3" />)}

              <defs>
                <linearGradient id="screenGrad" x1="0" x2="1">
                  <stop offset="0%" stopColor="#1A1228"/>
                  <stop offset="50%" stopColor="#E8B86C"/>
                  <stop offset="100%" stopColor="#1A1228"/>
                </linearGradient>
              </defs>
            </Box>
          </Box>

          {/* Legend / specs */}
          <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "1rem" } }}>
            {[
            { label: "Front Channels", count: "3", desc: "L · C · R for dialogue & music" },
            { label: "Surround Array", count: "4", desc: "Side & rear for envelopment" },
            { label: "Height Layer", count: "4", desc: "Ceiling speakers for Atmos objects" },
            { label: "Total Output", count: "11.0", desc: "+ subwoofer = 11.1 / 11.2" },
        ].map((item, i) => (<Box key={i} initial={reduced ? false : { opacity: 0, x: 20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ duration: reduced ? 0 : 0.5, delay: reduced ? 0 : i * 0.1 }} component={motion.div} sx={{ borderRadius: "0.75rem", padding: "1.25rem", borderWidth: "1px", borderColor: "rgb(232 184 108 / 0.15)", backgroundColor: "rgb(26 18 40 / 0.6)", "--alv-backdrop-blur": "blur(4px)", WebkitBackdropFilter: "var(--alv-backdrop-blur) var(--alv-backdrop-brightness) var(--alv-backdrop-contrast) var(--alv-backdrop-grayscale) var(--alv-backdrop-hue-rotate) var(--alv-backdrop-invert) var(--alv-backdrop-saturate) var(--alv-backdrop-sepia)", backdropFilter: "var(--alv-backdrop-blur) var(--alv-backdrop-brightness) var(--alv-backdrop-contrast) var(--alv-backdrop-grayscale) var(--alv-backdrop-hue-rotate) var(--alv-backdrop-invert) var(--alv-backdrop-saturate) var(--alv-backdrop-sepia)" }}>
                <Box sx={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: "0.25rem" }}>
                  <Typography component="p" variant="body1" sx={{ fontSize: "0.75rem", lineHeight: "1rem", textTransform: "uppercase", letterSpacing: "0.2em", color: "rgb(232 184 108 / 1)" }}>{item.label}</Typography>
                  <Box component="span" sx={mergeSx({ fontSize: "1.5rem", lineHeight: "2rem", fontWeight: "700", background: "linear-gradient(135deg, #F4D9A8 0%, #E8B86C 50%, #B8862E 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }, { fontFamily: "'Cinzel', serif" })}>
                    {item.count}
                  </Box>
                </Box>
                <Typography component="p" variant="body1" sx={{ fontSize: "0.75rem", lineHeight: "1rem", color: "rgb(245 239 227 / 0.5)" }}>{item.desc}</Typography>
              </Box>))}
          </Box>
        </Box>
      </Box>
    </Box>);
}
