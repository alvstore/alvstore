"use client";

import { Box, Typography, type SxProps, type Theme } from "@mui/material";
import { motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";
import { easeOut, motionTokens } from "@/lib/motion-presets";

export function PageHeader({ title, subtitle, actions, sx }: {
  title: ReactNode; subtitle?: ReactNode; actions?: ReactNode; sx?: SxProps<Theme>;
}) {
  const reduced = useReducedMotion();
  return (
    <Box component={motion.div} initial={reduced ? false : { opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: reduced ? 0 : motionTokens.base, ease: easeOut }}
      sx={[{ display: "flex", flexDirection: { xs: "column", sm: "row" }, justifyContent: "space-between", alignItems: { sm: "center" }, gap: 2 }, ...(Array.isArray(sx) ? sx : [sx])]}>
      <Box sx={{ minWidth: 0 }}>
        <Typography component="h1" variant="h5" sx={{ fontWeight: 750, letterSpacing: "-0.025em" }}>{title}</Typography>
        {subtitle && <Typography component="div" variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>{subtitle}</Typography>}
      </Box>
      {actions && <Box sx={{ display: "flex", gap: 1, alignItems: "center", flexWrap: "wrap" }}>{actions}</Box>}
    </Box>
  );
}
