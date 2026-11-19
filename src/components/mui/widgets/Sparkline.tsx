"use client";

import { useId } from "react";
import { Box, useTheme, type SxProps, type Theme } from "@mui/material";
import { keyframes } from "@emotion/react";
import { useReducedMotion } from "framer-motion";
import { sparklinePath } from "@/lib/widget-data";
import { motionTokens } from "@/lib/motion-presets";

const draw = keyframes`from { stroke-dashoffset: 1; } to { stroke-dashoffset: 0; }`;
export function Sparkline({ values, color, label = "Recent trend", sx }: { values: number[]; color?: string; label?: string; sx?: SxProps<Theme> }) {
  const theme = useTheme();
  const reduced = useReducedMotion();
  const id = useId().replace(/:/g, "");
  const path = sparklinePath(values);
  if (!path) return null;
  const stroke = color ?? theme.palette.primary.main;
  return <Box component="svg" viewBox="0 0 160 44" role="img" aria-label={label} sx={[{ width: "100%", height: 44, overflow: "visible", "& [data-sparkline-stroke]": { animation: reduced ? "none" : `${draw} ${motionTokens.chart}s cubic-bezier(.22,1,.36,1) both` } }, ...(Array.isArray(sx) ? sx : [sx])]}>
    <defs><linearGradient id={id} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={stroke} stopOpacity={.16} /><stop offset="100%" stopColor={stroke} stopOpacity={0} /></linearGradient></defs>
    <path d={path.area} fill={`url(#${id})`} />
    <path data-sparkline-stroke d={path.line} fill="none" stroke={stroke} strokeWidth={2} strokeLinecap="round" pathLength={1} strokeDasharray={1} />
    <circle cx={path.last.x} cy={path.last.y} r={2.75} fill={stroke} />
  </Box>;
}
