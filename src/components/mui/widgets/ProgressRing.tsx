"use client";

import { useEffect, useState } from "react";
import { Box, CircularProgress, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import { useReducedMotion } from "framer-motion";
import { CountUp, type StatAccent } from "../StatCard";
import { clampPercent } from "@/lib/widget-data";

const percent = (value: number) => `${Math.round(value)}%`;
export function ProgressRing({ value, label, caption, size = 144, color = "primary" }: {
  value: number; label: string; caption?: string; size?: number; color?: StatAccent;
}) {
  const reduced = useReducedMotion();
  const [entered, setEntered] = useState(false);
  const normalized = clampPercent(value);
  useEffect(() => { const frame = requestAnimationFrame(() => setEntered(true)); return () => cancelAnimationFrame(frame); }, []);
  return <Box sx={{ textAlign: "center", flexShrink: 0 }}>
    <Box sx={{ position: "relative", width: size, height: size, mx: "auto" }}>
      <CircularProgress variant="determinate" value={100} size={size} thickness={3.2} aria-hidden="true" sx={theme => ({ color: alpha(theme.palette[color].main, .14), position: "absolute", inset: 0 })} />
      <CircularProgress variant="determinate" value={entered || reduced ? normalized : 0} aria-label={label} aria-valuenow={Math.round(normalized)} size={size} thickness={3.2} color={color}
        sx={{ position: "absolute", inset: 0, "& .MuiCircularProgress-circle": { strokeLinecap: "round", transition: reduced ? "none" : "stroke-dashoffset .72s cubic-bezier(.22,1,.36,1)", "@media print": { transition: "none" } } }} />
      <Box sx={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <Typography component="div" sx={{ fontSize: size < 110 ? 21 : 31, fontWeight: 700, letterSpacing: "-.055em", fontVariantNumeric: "tabular-nums", lineHeight: 1.2 }}><CountUp value={normalized} formatter={percent} duration={.72} /></Typography>
        {size >= 110 && <Typography variant="caption" color="text.secondary" sx={{ fontSize: 10.5, mt: .25 }}>completed</Typography>}
      </Box>
    </Box>
    {caption && <Typography variant="caption" component="div" color="text.secondary" sx={{ mt: 1 }}>{caption}</Typography>}
  </Box>;
}
