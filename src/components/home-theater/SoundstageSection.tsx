import { useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";

// 7.1.4 Dolby Atmos layout — top-down view
// Positions in a 600x500 viewBox
const SPEAKERS = [
  { id: "FL",  label: "Front L",       x: 150, y: 120, delay: 0.0 },
  { id: "C",   label: "Center",        x: 300, y: 100, delay: 0.1 },
  { id: "FR",  label: "Front R",       x: 450, y: 120, delay: 0.2 },
  { id: "SL",  label: "Surround L",    x: 90,  y: 280, delay: 0.3 },
  { id: "SR",  label: "Surround R",    x: 510, y: 280, delay: 0.3 },
  { id: "RL",  label: "Rear L",        x: 150, y: 420, delay: 0.4 },
  { id: "RR",  label: "Rear R",        x: 450, y: 420, delay: 0.4 },
  { id: "TFL", label: "Ceiling Front L", x: 220, y: 200, delay: 0.5, ceiling: true },
  { id: "TFR", label: "Ceiling Front R", x: 380, y: 200, delay: 0.5, ceiling: true },
  { id: "TRL", label: "Ceiling Rear L", x: 220, y: 360, delay: 0.6, ceiling: true },
  { id: "TRR", label: "Ceiling Rear R", x: 380, y: 360, delay: 0.6, ceiling: true },
];

export default function SoundstageSection() {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });
  const ringScale = useTransform(scrollYProgress, [0, 1], [0.4, 1.6]);
  const ringOpacity = useTransform(scrollYProgress, [0, 0.5, 1], [0, 0.7, 0]);

  return (
    <section ref={ref} className="relative bg-stage-deep film-grain py-24 overflow-hidden">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[200px] rounded-full blur-[140px] pointer-events-none"
        style={{ background: "radial-gradient(circle, rgba(232,184,108,0.12), transparent 70%)" }} />

      <div className="max-w-7xl mx-auto px-6 relative z-10">
        <div className="text-center mb-16">
          <p className="text-xs font-medium uppercase tracking-[0.3em] mb-4 text-champagne">
            The Soundstage
          </p>
          <h2 className="text-4xl md:text-5xl font-bold text-warm mb-4" style={{ fontFamily: "'Cinzel', serif" }}>
            Engineered for <span className="text-champagne-gradient">7.1.4 Atmos</span>
          </h2>
          <p className="text-sm md:text-base text-warm/50 max-w-xl mx-auto">
            Eleven precisely calibrated channels. Sound moves through three dimensions —
            front, surround, and overhead.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-12 items-center">
          {/* Top-down theater diagram */}
          <div className="relative">
            <svg viewBox="0 0 600 500" className="w-full h-auto" style={{ maxHeight: 500 }}>
              {/* Room outline */}
              <rect
                x="60" y="80" width="480" height="380" rx="20"
                fill="rgba(42,27,61,0.4)"
                stroke="rgba(232,184,108,0.2)"
                strokeWidth="1"
                strokeDasharray="4 4"
              />

              {/* Screen at front */}
              <rect x="120" y="60" width="360" height="14" rx="2" fill="url(#screenGrad)" />
              <text x="300" y="50" textAnchor="middle" fill="rgba(232,184,108,0.5)" fontSize="9" letterSpacing="3">
                SCREEN
              </text>

              {/* Sweet spot — listening position */}
              <g>
                <circle cx="300" cy="270" r="35" fill="none" stroke="rgba(232,184,108,0.15)" strokeDasharray="2 3" />
                <circle cx="300" cy="270" r="8" fill="#C97B6E" opacity="0.6" />
                <text x="300" y="320" textAnchor="middle" fill="rgba(245,239,227,0.4)" fontSize="9">
                  Sweet Spot
                </text>
              </g>

              {/* Animated sound rings emanating from sweet spot */}
              {[0, 1, 2].map((i) => (
                <motion.circle
                  key={i}
                  cx="300" cy="270"
                  r="40"
                  fill="none"
                  stroke="#E8B86C"
                  strokeWidth="1"
                  initial={{ scale: 0.4, opacity: 0 }}
                  animate={{ scale: [0.4, 2.2], opacity: [0.5, 0] }}
                  transition={{ duration: 3, repeat: Infinity, delay: i * 1, ease: "easeOut" }}
                  style={{ transformOrigin: "300px 270px" }}
                />
              ))}

              {/* Speakers */}
              {SPEAKERS.map((s, i) => (
                <motion.g
                  key={s.id}
                  initial={{ opacity: 0, scale: 0 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true, margin: "-100px" }}
                  transition={{ duration: 0.5, delay: s.delay, ease: "backOut" }}
                >
                  {/* Pulse glow */}
                  <motion.circle
                    cx={s.x} cy={s.y} r="14"
                    fill="#E8B86C"
                    opacity="0.2"
                    animate={{ scale: [1, 1.6, 1], opacity: [0.3, 0, 0.3] }}
                    transition={{ duration: 2.5, repeat: Infinity, delay: i * 0.2 }}
                    style={{ transformOrigin: `${s.x}px ${s.y}px` }}
                  />
                  {/* Speaker dot */}
                  <circle
                    cx={s.x} cy={s.y} r={s.ceiling ? 5 : 7}
                    fill={s.ceiling ? "#C97B6E" : "#E8B86C"}
                    stroke="#0E0B14"
                    strokeWidth="2"
                  />
                  {/* Label */}
                  <text
                    x={s.x}
                    y={s.y - 14}
                    textAnchor="middle"
                    fill="rgba(245,239,227,0.7)"
                    fontSize="8"
                    fontFamily="monospace"
                  >
                    {s.id}
                  </text>
                </motion.g>
              ))}

              {/* Connection lines from sweet spot to each speaker */}
              {SPEAKERS.map((s, i) => (
                <motion.line
                  key={`l-${s.id}`}
                  x1="300" y1="270" x2={s.x} y2={s.y}
                  stroke="rgba(232,184,108,0.12)"
                  strokeWidth="0.5"
                  strokeDasharray="2 3"
                  initial={{ pathLength: 0 } as never}
                  whileInView={{ pathLength: 1 } as never}
                  viewport={{ once: true }}
                  transition={{ duration: 1, delay: 0.8 + i * 0.05 }}
                />
              ))}

              <defs>
                <linearGradient id="screenGrad" x1="0" x2="1">
                  <stop offset="0%" stopColor="#1A1228" />
                  <stop offset="50%" stopColor="#E8B86C" />
                  <stop offset="100%" stopColor="#1A1228" />
                </linearGradient>
              </defs>
            </svg>
          </div>

          {/* Legend / specs */}
          <div className="space-y-4">
            {[
              { label: "Front Channels", count: "3", desc: "L · C · R for dialogue & music" },
              { label: "Surround Array", count: "4", desc: "Side & rear for envelopment" },
              { label: "Height Layer", count: "4", desc: "Ceiling speakers for Atmos objects" },
              { label: "Total Output", count: "11.0", desc: "+ subwoofer = 11.1 / 11.2" },
            ].map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: 20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                className="rounded-xl p-5 border border-champagne/15 bg-[#1A1228]/60 backdrop-blur-sm"
              >
                <div className="flex items-baseline justify-between mb-1">
                  <p className="text-xs uppercase tracking-[0.2em] text-champagne">{item.label}</p>
                  <span className="text-2xl font-bold text-champagne-gradient" style={{ fontFamily: "'Cinzel', serif" }}>
                    {item.count}
                  </span>
                </div>
                <p className="text-xs text-warm/50">{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
