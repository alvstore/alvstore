"use client";

import { useId, type ReactNode } from "react";
import { Alert, Box, Button, Card, CardContent, Typography, type SxProps, type Theme } from "@mui/material";
import { alpha } from "@mui/material/styles";
import { MotionSection } from "../MotionSection";

export type WidgetFeedback = { error?: string; onRetry?: () => void };

export function WidgetCard({ title, subtitle, eyebrow, action, children, footer, index = 0, featured = false, sx, error, onRetry }: {
  title: ReactNode; subtitle?: ReactNode; eyebrow?: ReactNode; action?: ReactNode; children: ReactNode;
  footer?: ReactNode; index?: number; featured?: boolean; sx?: SxProps<Theme>;
} & WidgetFeedback) {
  const id = useId();
  return <MotionSection index={index}><Card component="section" aria-labelledby={id} data-widget sx={[
    theme => ({ height: "100%", display: "flex", flexDirection: "column", minWidth: 0, borderRadius: "20px", overflow: "hidden", ...(featured && { background: `linear-gradient(145deg, ${alpha(theme.palette.primary.main, theme.palette.mode === "dark" ? .1 : .055)}, ${theme.palette.background.paper} 80%)`, borderColor: alpha(theme.palette.primary.main, .18) }) }),
    ...(Array.isArray(sx) ? sx : [sx]),
  ]}>
    <Box sx={{ px: { xs: 2.25, sm: 2.75 }, pt: 2.5, pb: 2, display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 1.5 }}>
      <Box sx={{ minWidth: 0, flex: "1 1 140px" }}>
        {eyebrow && <Typography variant="overline" color="text.secondary" sx={{ fontSize: 10, letterSpacing: ".13em", lineHeight: 1.5, display: "block", mb: .5 }}>{eyebrow}</Typography>}
        <Typography id={id} component="h2" variant="subtitle1" sx={{ fontWeight: 700, letterSpacing: "-.025em", lineHeight: 1.4 }}>{title}</Typography>
        {subtitle && <Typography variant="caption" component="div" color="text.secondary" sx={{ mt: .5, lineHeight: 1.6 }}>{subtitle}</Typography>}
      </Box>
      {action && <Box sx={{ flexShrink: 0 }}>{action}</Box>}
    </Box>
    <CardContent sx={{ px: { xs: 2.25, sm: 2.75 }, pt: 0, pb: 2.5, flex: 1, minWidth: 0, "&:last-child": { pb: 2.5 } }}>{error ? <Alert severity="error" variant="outlined" action={onRetry ? <Button color="inherit" size="small" onClick={onRetry}>Retry</Button> : undefined}>{error}</Alert> : children}</CardContent>
    {footer && <Box sx={{ px: 2.75, py: 1.5, borderTop: 1, borderColor: "divider", fontSize: 11, color: "text.secondary" }}>{footer}</Box>}
  </Card></MotionSection>;
}
