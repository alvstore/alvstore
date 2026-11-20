"use client";

import { Box, ButtonBase, Chip, Typography } from "@mui/material";
import { mergeSx } from "@/components/mui";
import { useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { useMotionActivity } from "@/hooks/useMotionActivity";
import { CINEMA_COLORS, TYPOGRAPHY } from "@/lib/design-system";

type AtmosConfig = "5.1.2" | "7.1.4" | "9.4.6";

interface SpeakerNode {
  id: string;
  label: string;
  x: number;
  y: number;
  delay: number;
  role: string;
  hardware: string;
  isCeiling?: boolean;
  isSub?: boolean;
  configs: AtmosConfig[];
}

const ALL_SPEAKERS: SpeakerNode[] = [
  // Front LCR
  { id: "FL", label: "Front L", x: 140, y: 115, delay: 0.0, role: "Left Main Channel", hardware: "KEF Ci5160RL-THX / B&W CT8.2", configs: ["5.1.2", "7.1.4", "9.4.6"] },
  { id: "C",  label: "Center",  x: 300, y: 95,  delay: 0.1, role: "Dialogue Screen Channel", hardware: "Acoustically Transparent Screen-Mount LCR", configs: ["5.1.2", "7.1.4", "9.4.6"] },
  { id: "FR", label: "Front R", x: 460, y: 115, delay: 0.2, role: "Right Main Channel", hardware: "KEF Ci5160RL-THX / B&W CT8.2", configs: ["5.1.2", "7.1.4", "9.4.6"] },

  // Wide Channels (9.4.6 only)
  { id: "WL", label: "Wide L",  x: 100, y: 190, delay: 0.25, role: "Front Wide Imaging", hardware: "Timbre-Matched In-Wall Dispersion", configs: ["9.4.6"] },
  { id: "WR", label: "Wide R",  x: 500, y: 190, delay: 0.25, role: "Front Wide Imaging", hardware: "Timbre-Matched In-Wall Dispersion", configs: ["9.4.6"] },

  // Surrounds
  { id: "SL", label: "Surround L", x: 80,  y: 275, delay: 0.3, role: "Side Lateral Surround", hardware: "Bipole/Dipole Switchable Array", configs: ["5.1.2", "7.1.4", "9.4.6"] },
  { id: "SR", label: "Surround R", x: 520, y: 275, delay: 0.3, role: "Side Lateral Surround", hardware: "Bipole/Dipole Switchable Array", configs: ["5.1.2", "7.1.4", "9.4.6"] },

  // Rears
  { id: "RL", label: "Rear L", x: 150, y: 425, delay: 0.4, role: "Rear Envelopment", hardware: "Controlled Directivity In-Wall", configs: ["7.1.4", "9.4.6"] },
  { id: "RR", label: "Rear R", x: 450, y: 425, delay: 0.4, role: "Rear Envelopment", hardware: "Controlled Directivity In-Wall", configs: ["7.1.4", "9.4.6"] },

  // Heights / Overhead Atmos
  { id: "TFL", label: "Top Front L",  x: 210, y: 195, delay: 0.45, role: "Atmos Height Object", hardware: "Coaxial Uni-Q Aimed In-Ceiling", isCeiling: true, configs: ["5.1.2", "7.1.4", "9.4.6"] },
  { id: "TFR", label: "Top Front R",  x: 390, y: 195, delay: 0.45, role: "Atmos Height Object", hardware: "Coaxial Uni-Q Aimed In-Ceiling", isCeiling: true, configs: ["5.1.2", "7.1.4", "9.4.6"] },
  { id: "TML", label: "Top Mid L",    x: 210, y: 275, delay: 0.5,  role: "Direct Overhead Zenith", hardware: "Wide Dispersion Ceiling Array", isCeiling: true, configs: ["9.4.6"] },
  { id: "TMR", label: "Top Mid R",    x: 390, y: 275, delay: 0.5,  role: "Direct Overhead Zenith", hardware: "Wide Dispersion Ceiling Array", isCeiling: true, configs: ["9.4.6"] },
  { id: "TRL", label: "Top Rear L",   x: 210, y: 355, delay: 0.55, role: "Atmos Rear Height", hardware: "Coaxial Uni-Q Aimed In-Ceiling", isCeiling: true, configs: ["7.1.4", "9.4.6"] },
  { id: "TRR", label: "Top Rear R",   x: 390, y: 355, delay: 0.55, role: "Atmos Rear Height", hardware: "Coaxial Uni-Q Aimed In-Ceiling", isCeiling: true, configs: ["7.1.4", "9.4.6"] },

  // Subwoofers
  { id: "SUB1", label: "Sub 1 (Front L)", x: 190, y: 110, delay: 0.1, role: "Ultra-Low LFE 16Hz", hardware: "SVS SB16-Ultra / Dual 12″ Balanced", isSub: true, configs: ["5.1.2", "7.1.4", "9.4.6"] },
  { id: "SUB2", label: "Sub 2 (Rear R)",  x: 410, y: 430, delay: 0.2, role: "Room-Mode Smoothing LFE", hardware: "SVS SB16-Ultra Sealed Sub", isSub: true, configs: ["7.1.4", "9.4.6"] },
  { id: "SUB3", label: "Sub 3 (Front R)", x: 410, y: 110, delay: 0.3, role: "Standing-Wave Cancellation", hardware: "Boundary-Tuned Active Sub", isSub: true, configs: ["9.4.6"] },
  { id: "SUB4", label: "Sub 4 (Rear L)",  x: 190, y: 430, delay: 0.4, role: "Corner Pressure Equalizer", hardware: "Boundary-Tuned Active Sub", isSub: true, configs: ["9.4.6"] },
];

export default function SoundstageSection() {
  const ref = useRef<HTMLElement>(null);
  const reduced = useReducedMotion();
  const active = useMotionActivity(ref);

  const [activeConfig, setActiveConfig] = useState<AtmosConfig>("7.1.4");
  const [selectedSpeaker, setSelectedSpeaker] = useState<SpeakerNode | null>(null);

  const currentSpeakers = ALL_SPEAKERS.filter((s) => s.configs.includes(activeConfig));

  return (
    <Box
      ref={ref}
      component="section"
      id="soundstage"
      sx={{
        position: "relative",
        background: "linear-gradient(180deg, #1A1228 0%, #0E0B14 100%)",
        pt: { xs: 8, md: 12 },
        pb: { xs: 8, md: 12 },
        scrollMarginTop: { xs: "4.5rem", md: "5.5rem" },
        overflow: "hidden",
      }}
    >
      {/* Background radial glow */}
      <Box
        sx={{
          position: "absolute",
          top: "0px",
          left: "50%",
          transform: "translateX(-50%)",
          width: "700px",
          height: "220px",
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(232, 184, 108, 0.12), transparent 70%)",
          filter: "blur(140px)",
          pointerEvents: "none",
        }}
      />

      <Box sx={{ maxWidth: "80rem", mx: "auto", px: { xs: 2, sm: 3, md: 4 }, position: "relative", zIndex: 10 }}>
        {/* Header */}
        <Box sx={{ textAlign: "center", mb: { xs: 4, md: 6 } }}>
          <Typography
            component="p"
            variant="body2"
            sx={{
              fontSize: "0.75rem",
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.3em",
              mb: 1.5,
              color: CINEMA_COLORS.GOLD,
            }}
          >
            The Soundstage
          </Typography>
          <Typography
            component="h2"
            variant="h2"
            sx={{
              fontSize: { xs: "2.25rem", md: "3rem" },
              fontWeight: 700,
              color: CINEMA_COLORS.WARM_WHITE,
              fontFamily: TYPOGRAPHY.fontDisplay,
              mb: 1.5,
            }}
          >
            Architectural Precision for{" "}
            <Box
              component="span"
              sx={{
                background: "linear-gradient(135deg, #F4D9A8 0%, #E8B86C 50%, #B8862E 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              Dolby Atmos
            </Box>
          </Typography>
          <Typography
            component="p"
            variant="body1"
            sx={{
              fontSize: { xs: "0.875rem", md: "1rem" },
              color: "rgba(245, 239, 227, 0.55)",
              maxWidth: "38rem",
              mx: "auto",
              lineHeight: 1.6,
            }}
          >
            Switch between configurations to examine how sound envelops the listener in 3D space —
            front, surround, overhead height, and multi-subwoofer pressure equalization.
          </Typography>

          {/* Config Selectors */}
          <Box sx={{ display: "inline-flex", gap: 1, mt: 3, p: 0.5, bgcolor: "rgba(255, 255, 255, 0.04)", borderRadius: "0.75rem", border: "1px solid rgba(232, 184, 108, 0.2)" }}>
            {(["5.1.2", "7.1.4", "9.4.6"] as AtmosConfig[]).map((cfg) => {
              const activeBtn = activeConfig === cfg;
              return (
                <ButtonBase
                  key={cfg}
                  onClick={() => {
                    setActiveConfig(cfg);
                    setSelectedSpeaker(null);
                  }}
                  type="button"
                  sx={{
                    px: { xs: 2, sm: 3 },
                    py: 1,
                    borderRadius: "0.5rem",
                    fontSize: "0.875rem",
                    fontWeight: 700,
                    fontFamily: TYPOGRAPHY.fontDisplay,
                    bgcolor: activeBtn ? CINEMA_COLORS.GOLD : "transparent",
                    color: activeBtn ? "#000" : "rgba(245, 239, 227, 0.7)",
                    boxShadow: activeBtn ? "0 0 16px rgba(232, 184, 108, 0.4)" : "none",
                    transition: "all 0.2s ease",
                  }}
                >
                  {cfg === "9.4.6" ? "9.4.6 Reference" : cfg === "7.1.4" ? "7.1.4 Theater" : "5.1.2 Essential"}
                </ButtonBase>
              );
            })}
          </Box>
        </Box>

        {/* Interactive Layout Grid */}
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", lg: "1fr 340px" },
            gap: 4,
            alignItems: "center",
          }}
        >
          {/* Top-Down Theater SVG Diagram */}
          <Box sx={{ position: "relative" }}>
            <Box
              viewBox="0 0 600 500"
              component="svg"
              sx={mergeSx({ width: "100%", height: "auto" }, { maxHeight: 520 })}
              role="img"
              aria-label="Interactive Dolby Atmos soundstage top-down layout"
            >
              <defs>
                <linearGradient id="soundstageScreenGrad" x1="0" x2="1">
                  <stop offset="0%" stopColor="#1A1228" />
                  <stop offset="50%" stopColor="#E8B86C" />
                  <stop offset="100%" stopColor="#1A1228" />
                </linearGradient>
              </defs>

              {/* Room Outline */}
              <rect
                x="50"
                y="70"
                width="500"
                height="400"
                rx="24"
                fill="rgba(42, 27, 61, 0.4)"
                stroke="rgba(232, 184, 108, 0.2)"
                strokeWidth="1.5"
                strokeDasharray="4 4"
              />

              {/* Cinema Screen */}
              <rect x="120" y="52" width="360" height="16" rx="3" fill="url(#soundstageScreenGrad)" />
              <text x="300" y="42" textAnchor="middle" fill="rgba(232, 184, 108, 0.6)" fontSize="9" letterSpacing="3">
                150″ ACOUSTICALLY TRANSPARENT SCREEN
              </text>

              {/* Sweet Spot */}
              <g>
                <circle cx="300" cy="275" r="40" fill="none" stroke="rgba(232, 184, 108, 0.2)" strokeDasharray="3 3" />
                <circle cx="300" cy="275" r="9" fill="#C97B6E" opacity="0.8" />
                <text x="300" y="330" textAnchor="middle" fill="rgba(245, 239, 227, 0.6)" fontSize="9" fontWeight="600">
                  Reference Listener Sweet Spot
                </text>
              </g>

              {/* Connection lines from sweet spot to each speaker (rendered underneath speakers) */}
              {currentSpeakers.map((s) => (
                <line
                  key={`line-${s.id}`}
                  x1="300"
                  y1="275"
                  x2={s.x}
                  y2={s.y}
                  stroke={selectedSpeaker?.id === s.id ? "rgba(232, 184, 108, 0.75)" : "rgba(232, 184, 108, 0.14)"}
                  strokeWidth={selectedSpeaker?.id === s.id ? 1.5 : 0.6}
                  strokeDasharray="2 3"
                />
              ))}

              {/* Animated Sound Rings */}
              {active &&
                [0, 1, 2].map((i) => (
                  <Box
                    key={i}
                    cx="300"
                    cy="275"
                    r="45"
                    fill="none"
                    stroke="#E8B86C"
                    strokeWidth="1"
                    initial={{ scale: 0.4, opacity: 0 }}
                    animate={{ scale: [0.4, 2.4], opacity: [0.55, 0] }}
                    transition={{ duration: 3, repeat: Infinity, delay: i * 1, ease: "easeOut" }}
                    style={{ transformOrigin: "300px 275px" }}
                    component={motion.circle}
                  />
                ))}

              {/* Speakers */}
              {currentSpeakers.map((s, i) => {
                const isSelected = selectedSpeaker?.id === s.id;
                const dotColor = s.isSub ? "#FF9966" : s.isCeiling ? "#C97B6E" : "#E8B86C";
                return (
                  <Box
                    key={s.id}
                    onClick={() => setSelectedSpeaker(s)}
                    initial={reduced ? false : { opacity: 0, scale: 0 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: reduced ? 0 : 0.35, delay: reduced ? 0 : s.delay, ease: "backOut" }}
                    component={motion.g}
                    style={{ cursor: "pointer", transformOrigin: `${s.x}px ${s.y}px` }}
                  >
                    {/* Ambient pulse */}
                    <Box
                      cx={s.x}
                      cy={s.y}
                      r={isSelected ? "18" : "13"}
                      fill={dotColor}
                      animate={{ scale: active ? [1, 1.4, 1] : 1, opacity: active ? [0.35, 0.05, 0.35] : 0.2 }}
                      transition={active ? { duration: 2.2, repeat: Infinity, delay: i * 0.15 } : { duration: 0 }}
                      style={{ transformOrigin: `${s.x}px ${s.y}px` }}
                      component={motion.circle}
                    />

                    {/* Main Dot */}
                    <circle
                      cx={s.x}
                      cy={s.y}
                      r={s.isSub ? 8 : s.isCeiling ? 5.5 : 7}
                      fill={dotColor}
                      stroke={isSelected ? "#FFF" : "#0E0B14"}
                      strokeWidth={isSelected ? 2.5 : 1.5}
                    />

                    {/* Speaker label */}
                    <text
                      x={s.x}
                      y={s.y - 12}
                      textAnchor="middle"
                      fill={isSelected ? "#FFF" : "rgba(245, 239, 227, 0.85)"}
                      fontSize="8"
                      fontWeight={isSelected ? "700" : "500"}
                      fontFamily="monospace"
                    >
                      {s.id}
                    </text>
                  </Box>
                );
              })}
            </Box>
          </Box>

          {/* Sidebar: Detail & Spec Breakdown */}
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {selectedSpeaker ? (
              <Box
                sx={{
                  p: 2.5,
                  borderRadius: "1rem",
                  bgcolor: "rgba(232, 184, 108, 0.08)",
                  border: "1px solid rgba(232, 184, 108, 0.4)",
                  boxShadow: "0 0 30px rgba(232, 184, 108, 0.15)",
                }}
              >
                <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1.5 }}>
                  <Typography component="h4" variant="h6" sx={{ color: CINEMA_COLORS.GOLD, fontFamily: TYPOGRAPHY.fontDisplay, fontWeight: 700 }}>
                    {selectedSpeaker.id} · {selectedSpeaker.label}
                  </Typography>
                  <Chip
                    label={selectedSpeaker.isSub ? "LFE Channel" : selectedSpeaker.isCeiling ? "Height Object" : "Bed Layer"}
                    size="small"
                    sx={{
                      height: 20,
                      fontSize: "0.625rem",
                      bgcolor: "rgba(232, 184, 108, 0.2)",
                      color: CINEMA_COLORS.GOLD,
                    }}
                  />
                </Box>
                <Typography component="p" variant="body2" sx={{ color: "rgba(245, 239, 227, 0.8)", mb: 1, fontWeight: 600 }}>
                  Role: {selectedSpeaker.role}
                </Typography>
                <Typography component="p" variant="caption" sx={{ color: "rgba(245, 239, 227, 0.55)", display: "block", mb: 2 }}>
                  Hardware: {selectedSpeaker.hardware}
                </Typography>
                <ButtonBase
                  onClick={() => setSelectedSpeaker(null)}
                  type="button"
                  sx={{
                    fontSize: "0.75rem",
                    color: CINEMA_COLORS.GOLD,
                    textDecoration: "underline",
                  }}
                >
                  Clear Selection
                </ButtonBase>
              </Box>
            ) : (
              <Box
                sx={{
                  p: 2,
                  borderRadius: "1rem",
                  bgcolor: "rgba(255, 255, 255, 0.03)",
                  border: "1px dashed rgba(232, 184, 108, 0.2)",
                  textAlign: "center",
                }}
              >
                <Typography component="p" variant="caption" sx={{ color: "rgba(245, 239, 227, 0.5)" }}>
                  💡 Click any speaker or sub on the diagram to inspect its transducer specs and acoustic role.
                </Typography>
              </Box>
            )}

            {/* Spec Cards */}
            {[
              {
                label: "Bed Channels (Ear Level)",
                count: activeConfig === "9.4.6" ? "9 Channels" : activeConfig === "7.1.4" ? "7 Channels" : "5 Channels",
                desc: "LCR + Wide + Side + Rear Surround Array",
              },
              {
                label: "Subwoofer Array (LFE)",
                count: activeConfig === "9.4.6" ? "4 Subwoofers" : activeConfig === "7.1.4" ? "2 Subwoofers" : "1 Subwoofer",
                desc: "Bass pressure nodes cancelled across all seating rows",
              },
              {
                label: "Atmos Overhead Height",
                count: activeConfig === "9.4.6" ? "6 Overhead" : activeConfig === "7.1.4" ? "4 Overhead" : "2 Overhead",
                desc: "Discrete 3D audio objects floating above audience",
              },
              {
                label: "Total Speaker Count",
                count: activeConfig === "9.4.6" ? "19 Transducers" : activeConfig === "7.1.4" ? "13 Transducers" : "8 Transducers",
                desc: "Full DSP phase, delay, and EQ timbre matching",
              },
            ].map((item, i) => (
              <Box
                key={i}
                sx={{
                  p: 2,
                  borderRadius: "0.75rem",
                  bgcolor: "rgba(26, 18, 40, 0.6)",
                  border: "1px solid rgba(232, 184, 108, 0.15)",
                }}
              >
                <Box sx={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", mb: 0.5 }}>
                  <Typography component="p" variant="caption" sx={{ fontSize: "0.6875rem", textTransform: "uppercase", letterSpacing: "0.15em", color: CINEMA_COLORS.GOLD }}>
                    {item.label}
                  </Typography>
                  <Typography component="span" variant="body2" sx={{ fontFamily: TYPOGRAPHY.fontDisplay, fontWeight: 700, color: "#F4D9A8" }}>
                    {item.count}
                  </Typography>
                </Box>
                <Typography component="p" variant="caption" sx={{ color: "rgba(245, 239, 227, 0.5)" }}>
                  {item.desc}
                </Typography>
              </Box>
            ))}
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
