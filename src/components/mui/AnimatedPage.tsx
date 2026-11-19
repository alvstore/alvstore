"use client";

import { Box, type SxProps, type Theme } from "@mui/material";
import { motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";
import { fadeUp } from "@/lib/motion-presets";

export function AnimatedPage({ children, sx }: { children: ReactNode; sx?: SxProps<Theme> }) {
  const reduced = useReducedMotion();
  return (
    <Box data-animated-page component={motion.div} variants={fadeUp} initial={reduced ? false : "hidden"} animate="show" exit={reduced ? undefined : "exit"}
      sx={[{ minWidth: 0, width: "100%", "@media print": { transform: "none !important", opacity: "1 !important" } }, ...(Array.isArray(sx) ? sx : [sx])]}>
      {children}
    </Box>
  );
}
