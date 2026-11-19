"use client";

import { Box, type SxProps, type Theme } from "@mui/material";
import { motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";
import { easeOut, entranceDelay, motionTokens } from "@/lib/motion-presets";

/** Finite, transform/opacity-only entrance. Never animates form layout or reparents DOM. */
export function MotionSection({ children, index = 0, sx }: { children: ReactNode; index?: number; sx?: SxProps<Theme> }) {
  const reduced = useReducedMotion();
  return <Box component={motion.div} data-motion-section initial={reduced ? false : { opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: .1, margin: "0px 0px 40px 0px" }}
    transition={{ duration: reduced ? 0 : motionTokens.page, delay: reduced ? 0 : entranceDelay(index), ease: easeOut }}
    sx={[{ minWidth: 0, height: "100%", "@media print": { transform: "none !important", opacity: "1 !important" } }, ...(Array.isArray(sx) ? sx : [sx])]}>{children}</Box>;
}
