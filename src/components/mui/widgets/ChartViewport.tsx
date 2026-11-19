"use client";

import { useRef, type ReactNode } from "react";
import { Box } from "@mui/material";
import { useInView, useReducedMotion } from "framer-motion";

/** Keep a static plot available for print; replay its entrance only on first view. */
export function ChartViewport({ label, height, children }: { label: string; height: number; children: (animate: boolean) => ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const entered = useInView(ref, { once: true, margin: "40px" });
  const reduced = useReducedMotion();
  const animate = entered && !reduced;
  return <Box ref={ref} data-chart-viewport data-chart-entered={entered} role="img" aria-label={label} sx={{ height, width: "100%", minWidth: 0, position: "relative" }}>
    <Box key={animate ? "animated" : "static"} sx={{ height: "100%", width: "100%", minWidth: 0 }}>{children(animate)}</Box>
  </Box>;
}
