"use client";

import { useState } from "react";
import { Box, LinearProgress, Skeleton, Typography, useTheme } from "@mui/material";
import { alpha } from "@mui/material/styles";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { WidgetCard, type WidgetFeedback } from "./WidgetCard";
import { ChartViewport } from "./ChartViewport";
import { ChartTooltipCard } from "./ChartTooltipCard";
import { EmptyState } from "../EmptyState";
import { CountUp } from "../StatCard";
import { money } from "./TrendChart";
import { categoricalChartPalette, sharePercent } from "@/lib/chart-theme";
import { completionPercent } from "@/lib/widget-data";
import { motionTokens } from "@/lib/motion-presets";

export function DistributionWidget({ title, subtitle, items, loading, index = 0, formatter = money, error, onRetry }: {
  title: string; subtitle?: string; items: { name: string; value: number }[]; loading?: boolean; index?: number; formatter?: (value: number) => string;
} & WidgetFeedback) {
  const theme = useTheme();
  const colors = categoricalChartPalette(theme);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const sorted = [...items].filter(item => Number.isFinite(item.value) && item.value > 0).sort((a, b) => b.value - a.value);
  const total = sorted.reduce((sum, item) => sum + item.value, 0);
  const visible = sorted.length > 5 ? [...sorted.slice(0, 4), { name: "Remaining categories", value: sorted.slice(4).reduce((sum, item) => sum + item.value, 0) }] : sorted;
  return <WidgetCard title={title} subtitle={subtitle} index={index} error={error} onRetry={onRetry}>
    {loading ? <Box role="status" aria-label={`Loading ${title}`}><Skeleton variant="circular" width={154} height={154} sx={{ mx: "auto", mb: 2 }} /><Skeleton height={45} /><Skeleton height={45} /></Box> : total === 0 ? <EmptyState title="Nothing to compare yet" description="Categories will appear as activity is recorded." sx={{ py: 5 }} /> : <>
      <Box sx={{ mb: 1.5 }}><ChartViewport height={176} label={`${title}: ${formatter(total)} across ${sorted.length} categories`}>{animate => <>
        <ResponsiveContainer width="100%" height="100%" minWidth={1}>
          <PieChart>
            <Tooltip content={({ active, payload }) => {
              const entry = payload?.[0] as { name?: string; value?: number } | undefined;
              const entryIdx = visible.findIndex(item => item.name === entry?.name);
              const pct = sharePercent(Number(entry?.value ?? 0), total);
              return <ChartTooltipCard active={active} entries={entry ? [{ name: entry.name, value: Number(entry.value ?? 0), color: colors[(entryIdx >= 0 ? entryIdx : 0) % colors.length] }] : []} formatter={formatter} hint={`${Math.round(pct)}% of total`} />;
            }} />
            <Pie data={visible} dataKey="value" nameKey="name" innerRadius={58} outerRadius={78} paddingAngle={3.5} cornerRadius={5} stroke="none"
              isAnimationActive={animate} animationDuration={motionTokens.chart * 1000} animationEasing="ease-out"
              onMouseLeave={() => setActiveIndex(null)}>
              {visible.map((item, idx) => <Cell key={item.name} fill={colors[idx % colors.length]}
                fillOpacity={activeIndex === null || activeIndex === idx ? 1 : 0.34}
                style={{ transition: "fill-opacity 160ms ease" }}
                onMouseEnter={() => setActiveIndex(idx)} />)}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <Box sx={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", pointerEvents: "none" }}>
          <Typography variant="caption" color="text.secondary" sx={{ fontSize: 10.5 }}>Total</Typography>
          <Typography component="div" sx={{ fontSize: 21, fontWeight: 650, letterSpacing: "-.04em", fontVariantNumeric: "tabular-nums" }}><CountUp value={total} formatter={formatter} /></Typography>
        </Box>
      </>}</ChartViewport></Box>
      <Box role="list" aria-label={`${title} breakdown`} sx={{ display: "grid", gap: 1.35 }}>
        {visible.map((item, idx) => {
          const sliceColor = colors[idx % colors.length];
          const pct = completionPercent(item.value, total);
          const highlighted = activeIndex === idx;
          return <Box key={item.name} role="listitem" tabIndex={0}
            onMouseEnter={() => setActiveIndex(idx)} onMouseLeave={() => setActiveIndex(null)}
            onFocus={() => setActiveIndex(idx)} onBlur={() => setActiveIndex(null)}
            sx={{ px: .75, py: .4, mx: -.75, borderRadius: "10px", transition: "background-color 160ms ease, opacity 160ms ease", opacity: activeIndex === null || highlighted ? 1 : 0.52, bgcolor: highlighted ? alpha(sliceColor, theme.palette.mode === "dark" ? 0.1 : 0.06) : "transparent", outline: "none", "&:focus-visible": { boxShadow: `0 0 0 2px ${sliceColor}` } }}>
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: .55, gap: 1 }}>
              <Typography variant="caption" noWrap sx={{ fontSize: 11.5, display: "flex", alignItems: "center", gap: .75, fontWeight: highlighted ? 600 : 450 }}>
                <Box component="span" sx={{ width: 7, height: 7, borderRadius: "50%", bgcolor: sliceColor, flexShrink: 0 }} />{item.name}
              </Typography>
              <Typography variant="caption" sx={{ fontSize: 11.5, fontWeight: 600, whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>
                {formatter(item.value)} <Box component="span" sx={{ color: "text.secondary", fontWeight: 500 }}>· {Math.round(pct)}%</Box>
              </Typography>
            </Box>
            <LinearProgress variant="determinate" value={pct} aria-label={`${item.name} (${Math.round(pct)}%)`} sx={{ height: 4.5, borderRadius: 4, bgcolor: alpha(sliceColor, .1), "& .MuiLinearProgress-bar": { bgcolor: sliceColor, borderRadius: 4 } }} />
          </Box>;
        })}
      </Box>
    </>}
  </WidgetCard>;
}
