"use client";

import { Box, Typography, useTheme } from "@mui/material";
import { alpha } from "@mui/material/styles";

export interface TooltipEntry {
  name?: string;
  value?: number;
  color?: string;
  payload?: Record<string, unknown>;
}

/** Shared translucent Apple HIG tooltip surface for Recharts plots. */
export function ChartTooltipCard({
  active,
  title,
  entries,
  formatter,
  hint,
}: {
  active?: boolean;
  title?: string;
  entries?: TooltipEntry[];
  formatter: (value: number) => string;
  hint?: string;
}) {
  const theme = useTheme();
  if (!active || !entries?.length) return null;

  return (
    <Box
      sx={{
        minWidth: 148,
        px: 1.5,
        py: 1.15,
        borderRadius: "12px",
        border: `1px solid ${alpha(theme.palette.divider, 0.9)}`,
        bgcolor: alpha(theme.palette.background.paper, theme.palette.mode === "dark" ? 0.92 : 0.96),
        backdropFilter: "blur(12px)",
        boxShadow: `0 10px 28px ${alpha(theme.palette.common.black, theme.palette.mode === "dark" ? 0.35 : 0.1)}`,
      }}
    >
      {title && (
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ display: "block", fontSize: 10.5, fontWeight: 600, mb: 0.5, letterSpacing: ".01em" }}
        >
          {title}
        </Typography>
      )}
      <Box sx={{ display: "grid", gap: 0.45 }}>
        {entries.map((entry, idx) => (
          <Box
            key={`${entry.name ?? "metric"}-${idx}`}
            sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1.5 }}
          >
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, minWidth: 0 }}>
              <Box
                component="span"
                sx={{
                  width: 7,
                  height: 7,
                  borderRadius: "50%",
                  bgcolor: entry.color || theme.palette.primary.main,
                  flexShrink: 0,
                }}
              />
              <Typography variant="caption" color="text.secondary" noWrap sx={{ fontSize: 11 }}>
                {entry.name || "Value"}
              </Typography>
            </Box>
            <Typography
              variant="caption"
              sx={{
                fontSize: 11.5,
                fontWeight: 700,
                color: "text.primary",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {formatter(Number(entry.value ?? 0))}
            </Typography>
          </Box>
        ))}
      </Box>
      {hint && (
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{
            display: "block",
            fontSize: 10,
            mt: 0.65,
            pt: 0.55,
            borderTop: `1px solid ${theme.palette.divider}`,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {hint}
        </Typography>
      )}
    </Box>
  );
}
