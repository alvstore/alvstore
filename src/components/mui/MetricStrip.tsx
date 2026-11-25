"use client";

import type { ReactNode } from "react";
import { Box, ButtonBase, Card, Chip, Skeleton, Typography, useTheme, type SxProps, type Theme } from "@mui/material";
import { MotionSection } from "./MotionSection";
import { CountUp, type StatAccent } from "./StatCard";
import { pastelPillColors } from "@/lib/pill-style";

const integer = (value: number) => new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(value);
const currency = (value: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value);

export interface MetricStripItem {
  id?: string;
  label: ReactNode;
  value: number | string;
  isCurrency?: boolean;
  formatter?: (value: number) => string;
  caption?: ReactNode;
  trend?: ReactNode;
  icon: ReactNode;
  accent?: StatAccent;
  onClick?: () => void;
}

/**
 * Single elevated KPI strip divided by internal hairlines, pairing tabular metrics
 * on the left with soft-tinted icon badges on the right (Materialize Invoice List style).
 */
export function MetricStrip({
  items,
  loading = false,
  index = 0,
  sx,
}: {
  items: MetricStripItem[];
  loading?: boolean;
  index?: number;
  sx?: SxProps<Theme>;
}) {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const count = items.length;

  return (
    <MotionSection index={index}>
      <Card
        data-metric-strip
        sx={[
          {
            borderRadius: "16px",
            overflow: "hidden",
          },
          ...(Array.isArray(sx) ? sx : [sx]),
        ]}
      >
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: {
              xs: "minmax(0, 1fr)",
              sm: count >= 2 ? "repeat(2, minmax(0, 1fr))" : "minmax(0, 1fr)",
              lg: `repeat(${Math.max(1, count)}, minmax(0, 1fr))`,
            },
          }}
        >
          {items.map((item, idx) => {
            const accentColor = theme.palette[item.accent ?? "primary"].main;
            const iconStyle = pastelPillColors(accentColor, theme.palette.background.paper, isDark);

            const body = loading ? (
              <Box role="status" aria-label="Loading metric" sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 2, width: "100%" }}>
                <Box sx={{ flex: 1 }}>
                  <Skeleton width="55%" height={30} />
                  <Skeleton width="75%" height={18} sx={{ mt: 0.5 }} />
                </Box>
                <Skeleton variant="rounded" width={42} height={42} />
              </Box>
            ) : (
              <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 2, width: "100%", minWidth: 0 }}>
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Box sx={{ display: "flex", alignItems: "baseline", gap: 1, flexWrap: "wrap" }}>
                    <Typography
                      component="div"
                      sx={{
                        fontSize: { xs: 22, sm: 24 },
                        fontWeight: 700,
                        letterSpacing: "-0.04em",
                        fontVariantNumeric: "tabular-nums",
                        lineHeight: 1.2,
                        color: "text.primary",
                      }}
                    >
                      {typeof item.value === "number" ? (
                        <CountUp value={item.value} formatter={item.formatter ?? (item.isCurrency ? currency : integer)} />
                      ) : (
                        item.value
                      )}
                    </Typography>
                    {item.trend && (
                      <Chip
                        size="small"
                        label={item.trend}
                        sx={{
                          height: 20,
                          fontSize: 10.5,
                          fontWeight: 650,
                          borderRadius: "6px",
                          ...iconStyle,
                        }}
                      />
                    )}
                  </Box>
                  <Typography variant="body2" color="text.secondary" noWrap sx={{ fontSize: 12.5, fontWeight: 500, mt: 0.35 }}>
                    {item.label}
                  </Typography>
                  {item.caption && (
                    <Typography variant="caption" color="text.secondary" noWrap sx={{ display: "block", fontSize: 11, mt: 0.2 }}>
                      {item.caption}
                    </Typography>
                  )}
                </Box>

                <Box
                  sx={{
                    width: 42,
                    height: 42,
                    borderRadius: "10px",
                    display: "grid",
                    placeItems: "center",
                    flexShrink: 0,
                    ...iconStyle,
                  }}
                >
                  {item.icon}
                </Box>
              </Box>
            );

            const borderSx = {
              borderColor: "divider",
              borderBottom: {
                xs: idx < count - 1 ? 1 : 0,
                sm: idx < count - (count % 2 === 0 ? 2 : 1) ? 1 : 0,
                lg: 0,
              },
              borderRight: {
                xs: 0,
                sm: idx % 2 === 0 && idx < count - 1 ? 1 : 0,
                lg: idx < count - 1 ? 1 : 0,
              },
            };

            return item.onClick ? (
              <ButtonBase
                key={item.id ?? String(idx)}
                onClick={item.onClick}
                sx={{
                  ...borderSx,
                  px: 2.5,
                  py: 2.25,
                  textAlign: "left",
                  display: "flex",
                  width: "100%",
                  transition: "background-color 160ms ease",
                  "&:hover": { bgcolor: "action.hover" },
                  "&:focus-visible": {
                    outline: "2px solid",
                    outlineColor: "primary.main",
                    outlineOffset: "-2px",
                  },
                }}
              >
                {body}
              </ButtonBase>
            ) : (
              <Box key={item.id ?? String(idx)} sx={{ ...borderSx, px: 2.5, py: 2.25, display: "flex", minWidth: 0 }}>
                {body}
              </Box>
            );
          })}
        </Box>
      </Card>
    </MotionSection>
  );
}
