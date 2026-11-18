"use client";

import { useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";

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

function RoomSvg() {
  return (
    <svg viewBox="0 0 600 420" className="h-auto w-full">
      <defs>
        <linearGradient id="room-screen" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#1A1228" />
          <stop offset="50%" stopColor="#FFD700" />
          <stop offset="100%" stopColor="#1A1228" />
        </linearGradient>
        <radialGradient id="room-glow" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0%" stopColor="rgba(255,215,0,0.35)" />
          <stop offset="100%" stopColor="rgba(255,215,0,0)" />
        </radialGradient>
      </defs>

      {/* ambient glow behind screen */}
      <ellipse cx="300" cy="150" rx="150" ry="80" fill="url(#room-glow)" />

      {/* Floor */}
      <polygon points="100,330 500,330 430,250 170,250" fill="rgba(10,10,26,0.35)" stroke={WALL} strokeWidth="1.2" />
      {/* floor grid lines */}
      {[0.25, 0.5, 0.75].map((t) => (
        <line key={`fx${t}`}
          x1={100 + (170 - 100) * t} y1={330 + (250 - 330) * t}
          x2={500 + (430 - 500) * t} y2={330 + (250 - 330) * t}
          stroke={WALL_DIM} strokeWidth="0.6" />
      ))}
      {[0.33, 0.66].map((t) => (
        <line key={`fz${t}`}
          x1={100 + (500 - 100) * t} y1={330}
          x2={170 + (430 - 170) * t} y2={250}
          stroke={WALL_DIM} strokeWidth="0.6" />
      ))}

      {/* Back wall */}
      <polygon points="170,250 430,250 430,80 170,80" fill="rgba(10,10,26,0.45)" stroke={WALL} strokeWidth="1.2" />
      {/* Left wall */}
      <polygon points="100,330 170,250 170,80 100,160" fill="rgba(10,10,26,0.3)" stroke={WALL} strokeWidth="1.2" />
      {/* Right wall */}
      <polygon points="500,330 430,250 430,80 500,160" fill="rgba(10,10,26,0.3)" stroke={WALL} strokeWidth="1.2" />
      {/* Ceiling hint */}
      <polygon points="100,160 170,80 430,80 500,160" fill="none" stroke={WALL_DIM} strokeWidth="0.8" />

      {/* Screen on back wall */}
      <motion.polygon
        points="235,120 365,120 365,190 235,190"
        fill="url(#room-screen)"
        stroke={GOLD}
        strokeWidth="1"
        initial={{ opacity: 0.5 }}
        animate={{ opacity: [0.5, 0.9, 0.5] }}
        transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }}
      />
      <text x="300" y="110" textAnchor="middle" fill="rgba(255,215,0,0.5)" fontSize="9" letterSpacing="3">SCREEN</text>

      {/* Seating — two rows of boxes */}
      {[235, 285].map((y, row) => (
        [210, 265, 320, 375].map((x, i) => (
          row === 1 && i === 3 ? null : (
            <g key={`${row}-${i}`} opacity="0.9">
              <polygon points={`${x},${y} ${x + 42},${y} ${x + 42},${y + 16} ${x},${y + 16}`}
                fill="rgba(26,26,46,0.9)" stroke="rgba(255,215,0,0.18)" strokeWidth="0.6" />
              <polygon points={`${x},${y} ${x + 42},${y} ${x + 36},${y - 12} ${x - 6},${y - 12}`}
                fill="rgba(20,20,40,0.9)" stroke="rgba(255,215,0,0.4)" strokeWidth="0.6" />
            </g>
          )
        ))
      ))}

      {/* Speaker cones on side walls (gold) */}
      <motion.polygon points="132,225 150,205 150,245" fill={GOLD} opacity="0.55"
        animate={{ opacity: [0.4, 0.8, 0.4] }} transition={{ duration: 2.4, repeat: Infinity }} />
      <motion.polygon points="468,225 450,245 450,205" fill={GOLD} opacity="0.55"
        animate={{ opacity: [0.4, 0.8, 0.4] }} transition={{ duration: 2.4, repeat: Infinity, delay: 1.2 }} />

      {/* Sound waves from screen */}
      {[0, 1, 2].map((i) => (
        <motion.path
          key={i}
          d={`M ${300 - 30 - i * 18} 200 Q 300 ${230 + i * 8} ${300 + 30 + i * 18} 200`}
          fill="none" stroke={GOLD} strokeWidth="0.8"
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 0.5, 0] }}
          transition={{ duration: 2.5, repeat: Infinity, delay: i * 0.6 }}
        />
      ))}
    </svg>
  );
}

export default function TheaterRoom3D() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });

  // Scroll-linked 3D turn + settle
  const rotateY = useTransform(scrollYProgress, [0, 0.5, 1], [-24, 0, 18]);
  const rotateX = useTransform(scrollYProgress, [0, 0.5, 1], [16, 6, 10]);
  const scale = useTransform(scrollYProgress, [0, 0.5, 1], [0.9, 1, 0.96]);
  const opacity = useTransform(scrollYProgress, [0, 0.25], [0, 1]);

  return (
    <div ref={ref} className="relative w-full h-[500px] md:h-[600px] flex items-center justify-center">
      {/* soft stage glow */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-[480px] h-[320px] rounded-full blur-[120px]"
          style={{ background: "radial-gradient(circle, rgba(255,215,0,0.10), transparent 70%)" }} />
      </div>

      <motion.div
        style={{
          rotateY, rotateX, scale, opacity,
          transformPerspective: 1100,
          transformStyle: "preserve-3d",
        }}
        className="w-full max-w-[720px] px-6"
      >
        <RoomSvg />
      </motion.div>
    </div>
  );
}
