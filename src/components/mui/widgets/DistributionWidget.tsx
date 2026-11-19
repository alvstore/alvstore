"use client";

import { Box, LinearProgress, Skeleton, Typography, useTheme } from "@mui/material";
import { alpha } from "@mui/material/styles";
import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";
import { WidgetCard, type WidgetFeedback } from "./WidgetCard";
import { ChartViewport } from "./ChartViewport";
import { EmptyState } from "../EmptyState";
import { CountUp } from "../StatCard";
import { money } from "./TrendChart";
import { completionPercent } from "@/lib/widget-data";

export function DistributionWidget({ title, subtitle, items, loading, index = 0, formatter = money, error, onRetry }: {
  title: string; subtitle?: string; items: { name: string; value: number }[]; loading?: boolean; index?: number; formatter?: (value: number) => string;
} & WidgetFeedback) {
  const theme = useTheme();
  const colors = [theme.palette.primary.main, theme.palette.info.main, theme.palette.success.main, theme.palette.warning.main, theme.palette.secondary.main];
  const sorted = [...items].filter(item => Number.isFinite(item.value) && item.value > 0).sort((a, b) => b.value - a.value);
  const total = sorted.reduce((sum, item) => sum + item.value, 0);
  const visible = sorted.length > 5 ? [...sorted.slice(0, 4), { name: "Remaining categories", value: sorted.slice(4).reduce((sum, item) => sum + item.value, 0) }] : sorted;
  return <WidgetCard title={title} subtitle={subtitle} index={index} error={error} onRetry={onRetry}>
    {loading ? <Box role="status" aria-label={`Loading ${title}`}><Skeleton variant="circular" width={154} height={154} sx={{ mx: "auto", mb: 2 }} /><Skeleton height={45} /><Skeleton height={45} /></Box> : total === 0 ? <EmptyState title="Nothing to compare yet" description="Categories will appear as activity is recorded." sx={{ py: 5 }} /> : <>
      <Box sx={{ mb: 1.5 }}><ChartViewport height={170} label={`${title}: ${formatter(total)} across ${sorted.length} categories`}>{animate => <>
        <ResponsiveContainer width="100%" height="100%" minWidth={1}><PieChart><Pie data={visible} dataKey="value" nameKey="name" innerRadius={60} outerRadius={77} paddingAngle={4} cornerRadius={4} stroke="none" isAnimationActive={animate} animationDuration={700} animationEasing="ease-out">{visible.map((item, index) => <Cell key={item.name} fill={colors[index % colors.length]} />)}</Pie></PieChart></ResponsiveContainer>
        <Box sx={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", pointerEvents: "none" }}><Typography variant="caption" color="text.secondary" sx={{ fontSize: 10 }}>Total</Typography><Typography component="div" sx={{ fontSize: 21, fontWeight: 650, letterSpacing: "-.04em" }}><CountUp value={total} formatter={formatter} /></Typography></Box>
      </>}</ChartViewport></Box>
      <Box sx={{ display: "grid", gap: 1.5 }}>{visible.map((item, index) => <Box key={item.name}><Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: .65, gap: 1 }}><Typography variant="caption" noWrap sx={{ fontSize: 11, display: "flex", alignItems: "center", gap: .75 }}><Box component="span" sx={{ width: 6, height: 6, borderRadius: "50%", bgcolor: colors[index % colors.length], flexShrink: 0 }} />{item.name}</Typography><Typography variant="caption" sx={{ fontSize: 11, fontWeight: 600, whiteSpace: "nowrap" }}>{formatter(item.value)}</Typography></Box>
        <LinearProgress variant="determinate" value={completionPercent(item.value, total)} aria-label={`${item.name} share`} sx={{ height: 4, borderRadius: 4, bgcolor: alpha(colors[index % colors.length], .08), "& .MuiLinearProgress-bar": { bgcolor: colors[index % colors.length], borderRadius: 4 } }} />
      </Box>)}</Box>
    </>}
  </WidgetCard>;
}
