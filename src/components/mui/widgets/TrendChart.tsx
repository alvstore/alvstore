"use client";

import { useId, useState } from "react";
import { Box, Chip, Skeleton, Typography, useTheme } from "@mui/material";
import { alpha } from "@mui/material/styles";
import { Area, Bar, CartesianGrid, Cell, ComposedChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ArrowDownward, ArrowUpward } from "@mui/icons-material";
import { WidgetCard, type WidgetFeedback } from "./WidgetCard";
import { CountUp, type StatAccent } from "../StatCard";
import { EmptyState } from "../EmptyState";
import { SegmentedControl } from "../SegmentedControl";
import { ChartViewport } from "./ChartViewport";
import { ChartTooltipCard } from "./ChartTooltipCard";
import { compactAxisNumber } from "@/lib/chart-theme";
import { localDateKey, periodSummary, type DailyValue } from "@/lib/widget-data";
import { motionTokens } from "@/lib/motion-presets";

export type TrendSeries = { id: string; label: string; values: DailyValue[]; color?: StatAccent; increaseIsGood?: boolean };
export const money = (value: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value);

export function TrendChart({ title, subtitle, series, loading = false, index = 0, formatter = money, visual = "bars", error, onRetry }: {
  title: string; subtitle?: string; series: TrendSeries[]; loading?: boolean; index?: number; formatter?: (value: number) => string; visual?: "bars" | "area";
} & WidgetFeedback) {
  const gradient = `trend-${useId().replace(/:/g, "")}`;
  const [days, setDays] = useState<7 | 30>(7);
  const [activeId, setActiveId] = useState(series[0]?.id ?? "");
  const [hoveredBar, setHoveredBar] = useState<number | null>(null);
  const active = series.find(item => item.id === activeId) ?? series[0];
  const summary = periodSummary(active?.values ?? [], days);
  const theme = useTheme();
  const color = theme.palette[active?.color ?? "primary"].main;
  const hasRecords = (active?.values ?? []).some(item => summary.series.some(day => day.date === localDateKey(item.date)));
  const maxDayValue = Math.max(...summary.series.map(day => day.value), 0);
  return <WidgetCard title={title} subtitle={subtitle} index={index} error={error} onRetry={onRetry} action={<SegmentedControl<7 | 30> value={days} onChange={setDays} label={`${title} date range`}
    options={[{ value: 7, label: "7 days" }, { value: 30, label: "30 days" }]} />}>
    {series.length > 1 && <SegmentedControl value={active?.id ?? ""} onChange={setActiveId} label={`${title} metric`} options={series.map(item => ({ value: item.id, label: item.label }))} sx={{ mb: 2 }} />}
    {loading ? <Box role="status" aria-label={`Loading ${title}`}><Skeleton width="45%" height={44} /><Skeleton variant="rounded" height={196} sx={{ mt: 2 }} /></Box> : <>
      <Box sx={{ display: "flex", alignItems: "flex-end", flexWrap: "wrap", justifyContent: "space-between", gap: 1.5, mb: 2.5 }}>
        <Box><Typography component="div" sx={{ fontSize: 32, fontWeight: 700, letterSpacing: "-.055em", lineHeight: 1.15, fontVariantNumeric: "tabular-nums" }}><CountUp value={summary.total} formatter={formatter} /></Typography>
          <Typography variant="caption" color="text.secondary" sx={{ fontSize: 11 }}>{active?.label ?? "Total"} · last {days} days</Typography></Box>
        {summary.change !== null ? <Chip size="small" icon={summary.change >= 0 ? <ArrowUpward /> : <ArrowDownward />} label={`${Math.abs(summary.change).toFixed(1)}% vs prior ${days} days`} color={(summary.change >= 0) === (active?.increaseIsGood !== false) ? "success" : "warning"} variant="outlined" sx={{ fontSize: 10.5, height: 24, fontVariantNumeric: "tabular-nums" }} /> : <Typography variant="caption" color="text.secondary" sx={{ fontSize: 10.5 }}>No prior-period total</Typography>}
      </Box>
      {hasRecords ? <ChartViewport height={196} label={`${active?.label}: ${formatter(summary.total)} over the last ${days} days`}>{animate => <ResponsiveContainer width="100%" height="100%" minWidth={1}>
          <ComposedChart accessibilityLayer data={summary.series} margin={{ top: 8, right: 6, left: -10, bottom: 0 }} barCategoryGap={days === 7 ? "34%" : "22%"}>
            {visual === "area" && <defs><linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity={.26} /><stop offset="100%" stopColor={color} stopOpacity={.015} /></linearGradient></defs>}
            <CartesianGrid vertical={false} stroke={alpha(theme.palette.divider, 0.75)} strokeDasharray="3 5" />
            <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: theme.palette.text.secondary }} interval={days === 7 ? 0 : 5} dy={7} />
            <YAxis width={44} axisLine={false} tickLine={false} tickFormatter={compactAxisNumber} tick={{ fontSize: 11, fill: theme.palette.text.secondary }} tickCount={4} />
            {summary.average > 0 && <ReferenceLine y={summary.average} stroke={alpha(theme.palette.text.secondary, 0.4)} strokeDasharray="3 4" ifOverflow="extendDomain" />}
            <Tooltip cursor={{ fill: alpha(color, .06), stroke: alpha(color, .22), strokeWidth: 1, radius: 6 }}
              content={({ active: isActive, payload }) => {
                const point = payload?.[0]?.payload as { date?: string; value?: number } | undefined;
                return <ChartTooltipCard active={isActive} title={point?.date} entries={payload?.map(item => ({ name: active?.label ?? "Total", value: Number(item.value ?? 0), color }))} formatter={formatter} hint={summary.average > 0 ? `Daily avg: ${formatter(summary.average)}` : undefined} />;
              }} />
            {visual === "area" ? <Area key={`${active?.id}-${days}`} type="monotone" dataKey="value" stroke={color} strokeWidth={2.5} fill={`url(#${gradient})`}
                dot={days === 7 ? { r: 3, strokeWidth: 1.75, stroke: color, fill: theme.palette.background.paper } : false}
                activeDot={{ r: 5, strokeWidth: 2, stroke: theme.palette.background.paper, fill: color }} animationDuration={motionTokens.chart * 1000} animationEasing="ease-out" isAnimationActive={animate} />
              : <Bar key={`${active?.id}-${days}`} dataKey="value" radius={[6, 6, 2, 2]} maxBarSize={38} animationDuration={motionTokens.chart * 1000} animationEasing="ease-out" isAnimationActive={animate}
                onMouseEnter={(_data, barIndex) => setHoveredBar(barIndex)} onMouseLeave={() => setHoveredBar(null)}>
                {summary.series.map((day, itemIndex) => {
                  const isToday = itemIndex === summary.series.length - 1;
                  const isPeak = maxDayValue > 0 && day.value === maxDayValue;
                  const isHovered = hoveredBar === itemIndex;
                  const fill = isHovered || isToday ? color : isPeak ? alpha(color, theme.palette.mode === "dark" ? .78 : .68) : alpha(color, theme.palette.mode === "dark" ? .48 : .34);
                  return <Cell key={day.date} fill={fill} />;
                })}
              </Bar>}
          </ComposedChart>
        </ResponsiveContainer>}</ChartViewport> : <EmptyState title="No transactions in this period" description="Your actual activity will appear here as it is recorded." sx={{ py: 4 }} />}
      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 1, pt: 2.5, mt: 1, borderTop: 1, borderColor: "divider" }}>
        {[{ label: "Daily average", value: summary.average }, { label: "Best day", value: maxDayValue }, { label: `Previous ${days} days`, value: summary.previous }].map((item, idx) => <Box key={idx} sx={{ textAlign: idx === 2 ? "right" : "left", minWidth: 0 }}><Typography variant="caption" color="text.secondary" sx={{ fontSize: 10.5 }}>{item.label}</Typography><Typography variant="body2" sx={{ fontWeight: 600, fontSize: 12.5, mt: .25, overflowWrap: "anywhere", fontVariantNumeric: "tabular-nums" }}>{formatter(item.value)}</Typography></Box>)}
      </Box>
    </>}
  </WidgetCard>;
}
