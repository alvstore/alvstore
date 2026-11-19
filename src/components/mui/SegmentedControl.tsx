"use client";

import { useId, type KeyboardEvent, type ReactNode } from "react";
import { Box, ToggleButton, ToggleButtonGroup, type SxProps, type Theme } from "@mui/material";
import { alpha } from "@mui/material/styles";
import { LayoutGroup, motion, useReducedMotion } from "framer-motion";
import { easeOut, motionTokens } from "@/lib/motion-presets";

export interface SegmentOption<T extends string | number> {
  value: T;
  label: ReactNode;
  ariaLabel?: string;
  disabled?: boolean;
}

/** Native MUI pressed buttons, with one shared selection surface and roving focus. */
export function SegmentedControl<T extends string | number>({ value, onChange, options, label, tone = "neutral", sx }: {
  value: T; onChange: (value: T) => void; options: SegmentOption<T>[]; label: string;
  tone?: "neutral" | "brand"; sx?: SxProps<Theme>;
}) {
  const id = useId();
  const reduced = useReducedMotion();
  const selected = options.some(option => option.value === value && !option.disabled) ? value : options.find(option => !option.disabled)?.value;
  const handleKey = (event: KeyboardEvent<HTMLElement>, current: T) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    const enabled = options.filter(option => !option.disabled);
    if (!enabled.length) return;
    event.preventDefault();
    const index = enabled.findIndex(option => option.value === current);
    const next = event.key === "Home" ? enabled[0] : event.key === "End" ? enabled[enabled.length - 1]
      : enabled[(index + (event.key === "ArrowRight" ? 1 : -1) + enabled.length) % enabled.length];
    const buttons = Array.from(event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>("button") ?? []);
    buttons[options.findIndex(option => option.value === next.value)]?.focus();
    onChange(next.value);
  };
  return <LayoutGroup id={id}><ToggleButtonGroup exclusive value={value} size="small" aria-label={label}
    onChange={(_event, next: T | null) => { if (next !== null) onChange(next); }}
    sx={[{ position: "relative", maxWidth: "100%", flexWrap: "wrap", gap: .25, isolation: "isolate" }, ...(Array.isArray(sx) ? sx : [sx])]}>
    {options.map(option => <ToggleButton key={option.value} value={option.value} aria-label={option.ariaLabel} disabled={option.disabled}
      tabIndex={selected === option.value ? 0 : -1} onKeyDown={event => handleKey(event, option.value)}
      sx={theme => ({ position: "relative", borderRadius: "9px !important", whiteSpace: "nowrap", minWidth: 0,
        "&.Mui-selected, &.Mui-selected:hover": { bgcolor: "transparent", boxShadow: "none", color: tone === "brand" ? theme.palette.primary.contrastText : theme.palette.text.primary },
        "&:hover": { bgcolor: alpha(theme.palette.primary.main, .06) },
      })}>
      {value === option.value && <Box component={motion.div} data-segment-indicator aria-hidden="true" layoutId={reduced ? undefined : "selection"} initial={false}
        transition={{ duration: reduced ? 0 : motionTokens.base, ease: easeOut }}
        sx={theme => ({ position: "absolute", inset: 0, borderRadius: "inherit", zIndex: 0, pointerEvents: "none", bgcolor: tone === "brand" ? theme.palette.primary.main : theme.palette.background.paper, boxShadow: `0 2px 6px ${alpha(theme.palette.common.black, .09)}` })} />}
      <Box component="span" sx={{ position: "relative", zIndex: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", width: "100%", color: "inherit" }}>{option.label}</Box>
    </ToggleButton>)}
  </ToggleButtonGroup></LayoutGroup>;
}
