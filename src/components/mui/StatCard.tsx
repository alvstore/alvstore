"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { Box, Card, CardActionArea, CardContent, Chip, Skeleton, Typography, useTheme, type SxProps, type Theme } from "@mui/material";
import { alpha } from "@mui/material/styles";
import { motion, useInView, useReducedMotion } from "framer-motion";
import { gsap } from "gsap";
import { easeOut, motionTokens } from "@/lib/motion-presets";
import { MotionSection } from "./MotionSection";
import { Sparkline } from "./widgets/Sparkline";

export type StatAccent = "primary" | "secondary" | "success" | "info" | "warning" | "error";
const integer = (value: number) => new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(value);
const currency = (value: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value);

/** GSAP only changes a leaf text node; it never reparents React-owned DOM. */
export function CountUp({ value, formatter = integer, duration = .85 }: { value: number; formatter?: (value: number) => string; duration?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const displayed = useRef(0);
  const formatterRef = useRef(formatter);
  formatterRef.current = formatter;
  const reduced = useReducedMotion();
  const entered = useInView(ref, { once: true, margin: "40px" });
  const target = Number.isFinite(value) ? value : 0;
  useEffect(() => {
    if (reduced) {
      displayed.current = target;
      if (ref.current) ref.current.textContent = formatterRef.current(target);
      return;
    }
    if (ref.current) ref.current.textContent = formatterRef.current(displayed.current);
    if (!entered) return;
    const counter = { value: displayed.current };
    const tween = gsap.to(counter, { value: target, duration, ease: "power3.out", onUpdate: () => {
      displayed.current = counter.value;
      if (ref.current) ref.current.textContent = formatterRef.current(counter.value);
    } });
    return () => { tween.kill(); };
  }, [target, duration, reduced, entered]);
  useEffect(() => { if (ref.current) ref.current.textContent = formatter(displayed.current); }, [formatter]);
  return <><Box component="span" ref={ref} data-count-up-text aria-label={formatter(target)} sx={{ "@media print": { display: "none" } }}>{formatter(target)}</Box>
    <Box component="span" data-count-up-print aria-hidden="true" sx={{ display: "none", "@media print": { display: "inline" } }}>{formatter(target)}</Box></>;
}

export function StatCard({ label, value, icon, accent = "primary", isCurrency, formatter, trend, caption, sparkline, loading = false, onClick, index = 0, sx }: {
  label: ReactNode; value: number | string; icon?: ReactNode; accent?: StatAccent; isCurrency?: boolean;
  formatter?: (value: number) => string; trend?: ReactNode; caption?: ReactNode; sparkline?: number[];
  loading?: boolean; onClick?: () => void; index?: number; sx?: SxProps<Theme>;
}) {
  const reduced = useReducedMotion();
  const theme = useTheme();
  const color = theme.palette[accent].main;
  const content = <CardContent sx={{ p: 2.5, height: "100%", position: "relative", "&:last-child": { pb: 2.5 } }}>
    {loading ? <Box role="status" aria-label="Loading statistic" sx={{ display: "grid", gap: 1.5 }}>
      <Skeleton width="60%" /><Skeleton width="70%" height={38} /><Skeleton width="45%" />
    </Box> : <>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1, mb: 1.75 }}>
        <Typography variant="body2" color="text.secondary" sx={{ fontSize: 12, fontWeight: 500 }}>{label}</Typography>
        {icon && <Box sx={{ width: 32, height: 32, borderRadius: "10px", display: "grid", placeItems: "center", color, bgcolor: alpha(color, .09), flexShrink: 0 }}>{icon}</Box>}
      </Box>
      <Typography component="div" sx={{ fontSize: { xs: 25, sm: 29 }, fontWeight: 700, letterSpacing: "-.055em", fontVariantNumeric: "tabular-nums", lineHeight: 1.15 }}>
        {typeof value === "number" ? <CountUp value={value} formatter={formatter ?? (isCurrency ? currency : integer)} /> : value}
      </Typography>
      <Box sx={{ display: "flex", flexWrap: "wrap", gap: .75, alignItems: "center", mt: 1.5, minHeight: 20 }}>
        {trend && <Chip size="small" label={trend} sx={{ height: 20, fontSize: 10, fontWeight: 600, color, bgcolor: alpha(color, .08), border: 0, borderRadius: "6px" }} />}
        {caption && <Typography variant="caption" color="text.secondary" sx={{ fontSize: 10.5 }}>{caption}</Typography>}
      </Box>
      {sparkline && sparkline.length > 1 && <Sparkline values={sparkline} color={color} label={`${typeof label === "string" ? label : "Statistic"} recent values`} sx={{ mt: 1.25, height: 36 }} />}
    </>}
  </CardContent>;
  return <MotionSection index={index}><Box component={motion.div} whileHover={reduced || !onClick ? undefined : { y: -2 }}
    transition={{ duration: reduced ? 0 : motionTokens.fast, ease: easeOut }} sx={{ height: "100%", minWidth: 0 }}>
    <Card data-stat-card sx={[{ height: "100%", borderRadius: "18px", transition: "border-color .18s ease, box-shadow .18s ease", ...(onClick && { "@media (hover: hover) and (pointer: fine)": { "&:hover": { borderColor: alpha(color, .32), boxShadow: `0 8px 24px ${alpha(theme.palette.common.black, theme.palette.mode === "dark" ? .14 : .045)}` } } }) }, ...(Array.isArray(sx) ? sx : [sx])]}>
      {onClick ? <CardActionArea onClick={onClick} sx={{ height: "100%" }}>{content}</CardActionArea> : content}
    </Card>
  </Box></MotionSection>;
}
