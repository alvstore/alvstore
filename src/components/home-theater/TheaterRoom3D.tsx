"use client";

import { Box } from "@mui/material";
import { mergeSx } from "@/components/mui";
import { useRef } from "react";
import { motion, useScroll, useTransform, useReducedMotion } from "framer-motion";
import { useMotionActivity } from "@/hooks/useMotionActivity";
/**
 * TheaterRoom3D — CSS/SVG replacement for the old three.js wireframe room.
 *
 * The room is drawn once as an isometric SVG wireframe (floor, walls, screen,
 * seating, speaker cones). The whole scene lives inside a `preserve-3d`
 * container whose rotateX/rotateY/scale are driven by scroll through
 * framer-motion — giving a real 3D "turn the room" reveal with no WebGL.
 */
const WALL = "rgba(120,130,180,0.28)";
const WALL_DIM = "rgba(120,130,180,0.14)";
const GOLD = "#FFD700";
function RoomSvg({ active }: { active: boolean }) {
    return (<Box viewBox="0 0 600 420" component="svg" role="img" aria-label="Home theater layout with a screen, seating and surround speakers" sx={{ height: "auto", width: "100%" }}>
      <defs>
        <linearGradient id="room-screen" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#1A1228"/>
          <stop offset="50%" stopColor="#FFD700"/>
          <stop offset="100%" stopColor="#1A1228"/>
        </linearGradient>
        <radialGradient id="room-glow" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0%" stopColor="rgba(255,215,0,0.35)"/>
          <stop offset="100%" stopColor="rgba(255,215,0,0)"/>
        </radialGradient>
      </defs>

      {/* ambient glow behind screen */}
      <ellipse cx="300" cy="150" rx="150" ry="80" fill="url(#room-glow)"/>

      {/* Floor */}
      <polygon points="100,330 500,330 430,250 170,250" fill="rgba(10,10,26,0.35)" stroke={WALL} strokeWidth="1.2"/>
      {/* floor grid lines */}
      {[0.25, 0.5, 0.75].map((t) => (<line key={`fx${t}`} x1={100 + (170 - 100) * t} y1={330 + (250 - 330) * t} x2={500 + (430 - 500) * t} y2={330 + (250 - 330) * t} stroke={WALL_DIM} strokeWidth="0.6"/>))}
      {[0.33, 0.66].map((t) => (<line key={`fz${t}`} x1={100 + (500 - 100) * t} y1={330} x2={170 + (430 - 170) * t} y2={250} stroke={WALL_DIM} strokeWidth="0.6"/>))}

      {/* Back wall */}
      <polygon points="170,250 430,250 430,80 170,80" fill="rgba(10,10,26,0.45)" stroke={WALL} strokeWidth="1.2"/>
      {/* Left wall */}
      <polygon points="100,330 170,250 170,80 100,160" fill="rgba(10,10,26,0.3)" stroke={WALL} strokeWidth="1.2"/>
      {/* Right wall */}
      <polygon points="500,330 430,250 430,80 500,160" fill="rgba(10,10,26,0.3)" stroke={WALL} strokeWidth="1.2"/>
      {/* Ceiling hint */}
      <polygon points="100,160 170,80 430,80 500,160" fill="none" stroke={WALL_DIM} strokeWidth="0.8"/>

      {/* Screen on back wall */}
      <Box points="235,120 365,120 365,190 235,190" fill="url(#room-screen)" stroke={GOLD} strokeWidth="1" initial={false} animate={{ opacity: active ? [0.5, 0.9, 0.5] : 0.65 }} transition={active ? { duration: 3.5, repeat: Infinity, ease: "easeInOut" } : { duration: 0 }} component={motion.polygon}/>
      <text x="300" y="110" textAnchor="middle" fill="rgba(255,215,0,0.5)" fontSize="9" letterSpacing="3">SCREEN</text>

      {/* Seating — two rows of boxes */}
      {[235, 285].map((y, row) => ([210, 265, 320, 375].map((x, i) => (row === 1 && i === 3 ? null : (<g key={`${row}-${i}`} opacity="0.9">
              <polygon points={`${x},${y} ${x + 42},${y} ${x + 42},${y + 16} ${x},${y + 16}`} fill="rgba(26,26,46,0.9)" stroke="rgba(255,215,0,0.18)" strokeWidth="0.6"/>
              <polygon points={`${x},${y} ${x + 42},${y} ${x + 36},${y - 12} ${x - 6},${y - 12}`} fill="rgba(20,20,40,0.9)" stroke="rgba(255,215,0,0.4)" strokeWidth="0.6"/>
            </g>)))))}

      {/* Speaker cones on side walls (gold) */}
      <Box points="132,225 150,205 150,245" fill={GOLD} animate={{ opacity: active ? [0.4, 0.8, 0.4] : 0.55 }} transition={active ? { duration: 2.4, repeat: Infinity } : { duration: 0 }} component={motion.polygon}/>
      <Box points="468,225 450,245 450,205" fill={GOLD} animate={{ opacity: active ? [0.4, 0.8, 0.4] : 0.55 }} transition={active ? { duration: 2.4, repeat: Infinity, delay: 1.2 } : { duration: 0 }} component={motion.polygon}/>

      {/* Sound waves from screen */}
      {[0, 1, 2].map((i) => (<Box key={i} d={`M ${300 - 30 - i * 18} 200 Q 300 ${230 + i * 8} ${300 + 30 + i * 18} 200`} fill="none" stroke={GOLD} strokeWidth="0.8" initial={false} animate={{ opacity: active ? [0, 0.5, 0] : 0.2 }} transition={active ? { duration: 2.5, repeat: Infinity, delay: i * 0.6 } : { duration: 0 }} component={motion.path}/>))}
    </Box>);
}
export default function TheaterRoom3D() {
    const ref = useRef<HTMLDivElement>(null);
    const reduced = useReducedMotion();
    const active = useMotionActivity(ref);
    const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
    // Scroll-linked 3D turn + settle
    const rotateY = useTransform(scrollYProgress, [0, 0.5, 1], [-24, 0, 18]);
    const rotateX = useTransform(scrollYProgress, [0, 0.5, 1], [16, 6, 10]);
    const scale = useTransform(scrollYProgress, [0, 0.5, 1], [0.9, 1, 0.96]);
    const opacity = useTransform(scrollYProgress, [0, 0.25], [0, 1]);
    return (<Box ref={ref} sx={{ position: "relative", width: "100%", height: "500px", "@media (min-width: 768px)": { height: "600px" }, display: "flex", alignItems: "center", justifyContent: "center" }}>
      {/* soft stage glow */}
      <Box sx={{ position: "absolute", inset: "0px", display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
        <Box sx={mergeSx({ width: "480px", height: "320px", borderRadius: "9999px", "--alv-blur": "blur(120px)", filter: "var(--alv-blur) var(--alv-brightness) var(--alv-contrast) var(--alv-grayscale) var(--alv-hue-rotate) var(--alv-invert) var(--alv-saturate) var(--alv-sepia) var(--alv-drop-shadow)" }, { background: "radial-gradient(circle, rgba(255,215,0,0.10), transparent 70%)" })}/>
      </Box>

      <Box style={{
        rotateY: reduced ? 0 : rotateY, rotateX: reduced ? 6 : rotateX, scale: reduced ? 1 : scale, opacity: reduced ? 1 : opacity,
        transformPerspective: 1100,
        transformStyle: "preserve-3d",
    }} component={motion.div} sx={{ width: "100%", maxWidth: "720px", paddingLeft: "1.5rem", paddingRight: "1.5rem" }}>
        <RoomSvg active={active} />
      </Box>
    </Box>);
}
