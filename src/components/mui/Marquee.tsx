"use client";

import { useRef, useState, type ReactNode } from "react";
import { Box, IconButton, Tooltip } from "@mui/material";
import { Pause, PlayArrow } from "@mui/icons-material";
import { keyframes } from "@emotion/react";
import { useReducedMotion } from "framer-motion";
import { useMotionActivity } from "@/hooks/useMotionActivity";

const slide = keyframes`from { transform: translateX(0); } to { transform: translateX(-50%); }`;

/** Public-site decoration: user-pausable, no duplicate accessible content or hidden-tab work. */
export function Marquee({ children, label, duration = 40, gap = 3 }: { children: ReactNode; label: string; duration?: number; gap?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const active = useMotionActivity(ref);
  const reduced = useReducedMotion();
  const [paused, setPaused] = useState(false);
  const group = { display: "flex", alignItems: "stretch", gap, pr: gap, flexShrink: 0 };
  return <Box ref={ref} role="region" aria-label={label} sx={{ position: "relative", minWidth: 0 }}>
    <Box tabIndex={reduced ? 0 : undefined} sx={{ overflowX: reduced ? "auto" : "hidden", overflowY: "hidden", py: .5, scrollbarWidth: "thin", pr: reduced ? 0 : 5 }}>
      <Box data-marquee-track sx={{ display: "flex", width: "max-content", animation: reduced ? "none" : `${slide} ${duration}s linear infinite`, animationPlayState: active && !paused ? "running" : "paused", "&:hover, &:focus-within": { animationPlayState: "paused" }, "@media print": { animation: "none" } }}>
        <Box sx={group}>{children}</Box>
        {!reduced && <Box aria-hidden="true" inert sx={group}>{children}</Box>}
      </Box>
    </Box>
    {!reduced && <Tooltip title={paused ? "Resume scrolling" : "Pause scrolling"}><IconButton size="small" aria-label={`${paused ? "Resume" : "Pause"} ${label.toLowerCase()}`} onClick={() => setPaused(value => !value)} sx={{ position: "absolute", right: 4, top: 4, zIndex: 1, bgcolor: "rgba(20,16,30,.85)", color: "#fff", "&:hover": { bgcolor: "rgba(20,16,30,.95)" } }}>{paused ? <PlayArrow fontSize="inherit" /> : <Pause fontSize="inherit" />}</IconButton></Tooltip>}
  </Box>;
}
